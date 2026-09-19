import { Scene, WebGLRenderer, WebGLRenderTarget, ACESFilmicToneMapping, SRGBColorSpace, BasicShadowMap, MeshDepthMaterial, FrontSide, BackSide, DoubleSide, type BufferGeometry, type Camera, type DirectionalLight, type Material, type Mesh, type ShaderMaterial, type Texture } from 'three';
import { createWorld, qualityFor } from './world';
import { createFreeCam } from './camera/freecam';
import { createFollowCam, type FollowCam } from './camera/follow';
import type { PlayerHandle } from './world/character/player';
import { getTerrain } from './world/terrain/heightfield';
import { installCaptureApi, isHeadlessCapture } from './capture/api';
import { WORLD } from './world/config';
import type { Quality } from './world/system';
import { mountHud } from './ui/hud';
import { mountShell } from './ui/shell'; // shell-1: bag input (RMB / ZR) + audio
import { perfFlags, perfReport, perfRuntime, QualityGovernor } from './perfFlags';

/**
 * Warm-up before the first frame of the walkable build (round 37). Measured on the r37 trace
 * without it: entering play mode compiled 8 programs on the first rendered frame (104 ms) and
 * 206 geometries were first uploaded during the 45 s walk (42 of 90 sampled frames) — every LOD
 * bucket / grass ring / caster the camera first meets. Here, before `ready()` resolves:
 *   1. every mesh outside the grass tiles is made visible and unculled for the duration (the
 *      hidden LOD buckets have count 0: they upload their geometry and instance buffers and draw
 *      nothing) and its geometry's draw range is stubbed to one triangle;
 *   2. `renderer.compileAsync` compiles every material's colour program — with a render target
 *      bound (see below) — and, with every caster's material swapped for the depth material
 *      three's shadow pass builds for it, every depth program; with KHR_parallel_shader_compile
 *      the driver links them on its own threads while the main thread polls every 10 ms;
 *   3. `initTexture` uploads every texture a material references;
 *   4. one warm pass renders the scene into an off-screen 4×4 target (the canvas untouched): the
 *      shadow pass and the colour pass issue one triangle per mesh, which uploads every geometry
 *      and instance buffer and binds every program (a program the compile step missed links here,
 *      synchronously, and is counted in `warmPassPrograms`); then the composer draws one frame
 *      so its post-processing programs compile too. Every mesh gets its `visible` /
 *      `frustumCulled` / draw range back exactly.
 *
 * Round 48 (lod-1): fable-6 measured the round-37 warm-up at 106–144 s natively (compile 18–20 s,
 * the warm pass 83–121 s) — docs/PERF_2026-09-19.md §3. Two things were wrong with it. Three's
 * `compile()` chooses a program's tone-mapping / output-colour-space variant from the render
 * target bound WHEN IT IS CALLED: bound to the canvas it compiled the ACES / sRGB variants, but
 * the composer renders the scene into a linear HDR target, so play never binds those programs and
 * the warm pass linked the real variants one draw at a time — synchronously, plus every depth
 * variant (`compile()` never compiles the shadow pass's materials). And the warm pass drew the
 * whole world (every LOD, every part, the shadow window widened to ±500 m) to reach those
 * programs, which on a software rasteriser is minutes of triangles for nothing: the buffers
 * upload and the programs bind whatever the draw range is. Now the compile step runs with the
 * 4×4 target bound, the depth programs are compiled in parallel through stand-in
 * `MeshDepthMaterial`s carrying what `WebGLShadowMap.getDepthMaterial` copies (three r186: side
 * flipped for a non-VSM map, map / alphaMap / alphaTest, displacement, clipping, wireframe), and
 * the warm pass draws one triangle per mesh. The shadow window is left alone: with
 * `frustumCulled` off every caster is issued whatever the window.
 *
 * The scene state after it is the state before it; only the GL side is warm. Headless captures
 * skip it by default (their settle frames absorb compiles; `?warmup=1` forces it, `?warmup=0`
 * disables it). Grass tiles keep their on-demand LOD geometry uploads (551k blades × 3 LODs would
 * not fit residently); their instance buffers upload when a tile first comes into range.
 */
async function warmUp(renderer: WebGLRenderer, scene: Scene, camera: Camera, sun: DirectionalLight | null, composer: { render(dt: number): void } | null) {
  const t0 = performance.now();
  const programCount = () => renderer.info.programs?.length ?? 0;
  const programsBefore = programCount();
  const geometriesBefore = renderer.info.memory.geometries;
  const exposed: { o: Mesh; visible: boolean; frustumCulled: boolean }[] = [];
  const ranges = new Map<BufferGeometry, { start: number; count: number }>();
  scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh || o.name.startsWith('grass-tile-')) return;
    exposed.push({ o: m, visible: m.visible, frustumCulled: m.frustumCulled });
    m.visible = true;
    m.frustumCulled = false;
    // one triangle per mesh: the program binds and the buffers upload whole whatever the range
    // (three uploads every attribute of a geometry it meets); a multi-material mesh keeps its
    // range so each group still issues its own program
    if (!Array.isArray(m.material) && !ranges.has(m.geometry)) {
      ranges.set(m.geometry, { start: m.geometry.drawRange.start, count: m.geometry.drawRange.count });
      m.geometry.setDrawRange(0, 3);
    }
  });
  const seen = new Set<Texture>();
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const report = {
    programs: 0,
    colourPrograms: 0,
    depthPrograms: 0,
    warmPassPrograms: 0,
    composerPrograms: 0,
    textures: 0,
    geometries: 0,
    exposed: exposed.length,
    casters: 0,
    parallel,
    compileMs: 0,
    depthCompileMs: 0,
    textureMs: 0,
    warmPassMs: 0,
    composerMs: 0,
    ms: 0,
  };
  const rt = new WebGLRenderTarget(4, 4);
  const prevTarget = renderer.getRenderTarget();
  try {
    // nothing renders while this awaits: boot() has not started the frame loop yet. The target is
    // bound first: three picks the program variant (tone mapping off, linear output) from it, and
    // that is the variant the composer's scene pass binds.
    renderer.setRenderTarget(rt);
    await renderer.compileAsync(scene, camera);
    const tCompile = performance.now();
    report.colourPrograms = programCount() - programsBefore;
    if (sun?.castShadow && renderer.shadowMap.enabled) {
      // the depth programs: every caster's material swapped for the depth material three's shadow
      // pass would pick for it — its own `customDepthMaterial`, or a stand-in carrying exactly what
      // WebGLShadowMap.getDepthMaterial copies, so the program's cache key is the shadow pass's.
      // Compiled against an empty target scene (no fog, no environment — the shadow pass binds its
      // programs with three's empty scene; the lights come from `scene`).
      const standIns = new Map<Material, MeshDepthMaterial>();
      const depthFor = (m: Mesh, source: Material): Material => {
        if (m.customDepthMaterial) return m.customDepthMaterial;
        let d = standIns.get(source);
        if (!d) {
          const s = source as Material & { wireframe?: boolean; wireframeLinewidth?: number; map?: Texture | null; alphaMap?: Texture | null; displacementMap?: Texture | null; displacementScale?: number; displacementBias?: number };
          d = new MeshDepthMaterial();
          d.wireframe = s.wireframe === true;
          d.wireframeLinewidth = s.wireframeLinewidth ?? 1;
          d.side = source.shadowSide !== null ? source.shadowSide : source.side === FrontSide ? BackSide : source.side === BackSide ? FrontSide : DoubleSide;
          d.alphaMap = s.alphaMap ?? null;
          d.alphaTest = source.alphaToCoverage ? 0.5 : source.alphaTest;
          d.map = s.map ?? null;
          d.clipShadows = source.clipShadows;
          d.clippingPlanes = source.clippingPlanes;
          d.clipIntersection = source.clipIntersection;
          d.displacementMap = s.displacementMap ?? null;
          d.displacementScale = s.displacementScale ?? 1;
          d.displacementBias = s.displacementBias ?? 0;
          standIns.set(source, d);
        }
        return d;
      };
      const swapped: { m: Mesh; material: Material | Material[] }[] = [];
      scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || !m.castShadow || o.name.startsWith('grass-tile-')) return;
        swapped.push({ m, material: m.material });
        m.material = Array.isArray(m.material) ? m.material.map((mat) => depthFor(m, mat)) : depthFor(m, m.material);
      });
      report.casters = swapped.length;
      const programsBeforeDepth = programCount();
      try {
        await renderer.compileAsync(scene, camera, new Scene());
      } finally {
        for (const s of swapped) s.m.material = s.material;
      }
      report.depthPrograms = programCount() - programsBeforeDepth;
      // the stand-ins are not disposed: disposing releases their programs, and three's own depth
      // material only takes a reference to each program at the first shadow draw that uses it
    }
    const tDepth = performance.now();
    const init = (v: unknown) => {
      const t = v as Texture | null;
      if (t && t.isTexture && !seen.has(t)) {
        seen.add(t);
        renderer.initTexture(t);
      }
    };
    scene.traverse((o) => {
      const mats = (o as Mesh).material as Material | Material[] | undefined;
      if (!mats) return;
      for (const m of Array.isArray(mats) ? mats : [mats]) {
        for (const v of Object.values(m as unknown as Record<string, unknown>)) init(v);
        const uniforms = (m as ShaderMaterial).uniforms;
        if (uniforms) for (const k of Object.keys(uniforms)) init(uniforms[k]?.value);
      }
    });
    const tTextures = performance.now();
    const programsBeforePass = programCount();
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);
    const tPass = performance.now();
    report.warmPassPrograms = programCount() - programsBeforePass;
    // the meshes back exactly before the composer's frame: it renders the scene as play does
    for (const [g, r] of ranges) g.setDrawRange(r.start, r.count);
    ranges.clear();
    for (const e of exposed) {
      e.o.visible = e.visible;
      e.o.frustumCulled = e.frustumCulled;
    }
    exposed.length = 0;
    if (composer) {
      // the post-processing programs (AO, blur, rays, bloom, composite, FXAA, the mist overlay)
      // compile on the composer's first frame: draw it now, behind the boot overlay. Every pass is
      // a pure function of the frame (no temporal accumulation), so the frame leaves no state.
      const programsBeforeComposer = programCount();
      composer.render(0);
      report.composerPrograms = programCount() - programsBeforeComposer;
    }
    const t1 = performance.now();
    report.compileMs = Math.round(tCompile - t0);
    report.depthCompileMs = Math.round(tDepth - tCompile);
    report.textureMs = Math.round(tTextures - tDepth);
    report.warmPassMs = Math.round(tPass - tTextures);
    report.composerMs = Math.round(t1 - tPass);
  } finally {
    renderer.setRenderTarget(prevTarget);
    rt.dispose();
    for (const [g, r] of ranges) g.setDrawRange(r.start, r.count);
    for (const e of exposed) {
      e.o.visible = e.visible;
      e.o.frustumCulled = e.frustumCulled;
    }
  }
  report.ms = Math.round(performance.now() - t0);
  report.programs = programCount() - programsBefore;
  report.textures = seen.size;
  report.geometries = renderer.info.memory.geometries - geometriesBefore;
  console.info(
    `[warmup] ${report.programs} programs (colour ${report.colourPrograms}, depth ${report.depthPrograms}, warm pass ${report.warmPassPrograms}, composer ${report.composerPrograms}), ${report.textures} textures, ${report.geometries} geometries (${report.exposed} meshes exposed, ${report.casters} casters) in ${report.ms} ms (compile ${report.compileMs}${parallel ? ', parallel' : ''}, depth compile ${report.depthCompileMs}, textures ${report.textureMs}, warm pass ${report.warmPassMs}, composer ${report.composerMs})`,
  );
  return report;
}

async function boot() {
  const host = document.getElementById('app')!;
  const dev = document.getElementById('dev')!;
  const loading = document.getElementById('loading')!;
  const params = new URLSearchParams(location.search);
  const headless = isHeadlessCapture();
  // performance flags (perfFlags.ts): `?quality=auto` runs the governor over the high tier's
  // world; under a headless capture it stays fixed high unless the trace harness says `governor=1`
  const flags = perfFlags();
  const perfState = perfRuntime();
  const tierParam = params.get('quality');
  const tier = (tierParam === 'auto' ? 'high' : (tierParam as Quality['tier'])) || 'high';
  const quality = qualityFor(tier);

  // The composer draws the frame into its own targets and blits the final image, so the canvas
  // itself is never rasterised with anything but a fullscreen quad: a multisampled default
  // framebuffer (`antialias: true`) only added a 4× colour buffer and a resolve per frame for an
  // identical image (FXAA is the anti-aliasing; measured byte-identical on the six fixed captures).
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: headless });
  const basePixelRatio = Math.min(devicePixelRatio, quality.pixelRatio, WORLD.renderer.maxPixelRatio);
  // `?scale=` / the governor's render scale multiply the pixel ratio (every composer target follows
  // the drawing buffer); 1 as shipped, so the product is the ratio itself
  const applyRenderScale = () => renderer.setPixelRatio(perfState.renderScale === 1 ? basePixelRatio : basePixelRatio * perfState.renderScale);
  applyRenderScale();
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = WORLD.renderer.exposure;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = BasicShadowMap;
  host.appendChild(renderer.domElement);
  const hud = params.get('hud') !== '0' ? mountHud(host, { headless }) : null; // shell-1: handle kept for the bag

  const scene = new Scene();
  const terrain = getTerrain();
  const cam = createFreeCam(host, terrain, host.clientWidth / host.clientHeight);
  if (headless) cam.enabled = false;

  const audits = new Map<string, () => Record<string, unknown>>();
  const progress = new Map<string, number>();
  const world = await createWorld({
    scene,
    renderer,
    camera: cam.camera,
    quality,
    headless,
    audits,
    onProgress: (name, v) => {
      progress.set(name, v);
      loading.textContent = `building kokiri forest… ${[...progress.keys()].join(' · ')}`;
    },
  });

  // Post-processing (if the atmosphere system installed one) drives the frame; otherwise plain render.
  const composer = (scene.userData.composer as { render(dt: number): void; setSize(w: number, h: number): void } | undefined) ?? null;

  const warmupParam = params.get('warmup');
  let warmup: Awaited<ReturnType<typeof warmUp>> | null = null;
  if (warmupParam === '1' || (warmupParam !== '0' && !headless)) {
    loading.textContent = 'building kokiri forest… warming up shaders';
    warmup = await warmUp(renderer, scene, cam.camera, world.ctx.sun, composer);
  }

  let lastNow = performance.now();
  const getDelta = () => {
    const now = performance.now();
    const dt = (now - lastNow) / 1000;
    lastNow = now;
    return dt;
  };
  // Phase 2 walkable build: third-person follow camera behind Link (`?mode=play` or the P key).
  // Never active under headless capture, so the reference-viewpoint captures are unaffected.
  let follow: FollowCam | null = null;
  const player = scene.userData.player as PlayerHandle | undefined;
  const setPlayMode = (on: boolean) => {
    if (headless || !player) return;
    if (on && !follow) follow = createFollowCam(host, terrain, cam.camera, player);
    if (follow) follow.enabled = on;
    cam.enabled = !on;
    player.setPlayMode(on);
    if (on) follow?.snap();
  };

  // shell-1: bag (right mouse / gamepad ZR / Tab; pauses the world step while open) + audio (first gesture, M mutes)
  const shell = mountShell({ host, hud, scene, headless, wind: world.ctx.wind });

  let simTime = 0;
  // CPU ms of the last step's phases (camera / world.update / render issue), read by __ZR__.perf()
  const perf = { step: 0, camera: 0, update: 0, render: 0 };

  // Auto quality: the governor steps the ladder in perfFlags.ts from the frame time. It is fed the
  // rAF interval in play (what the GPU actually lets through) and, under the trace harness, the
  // finished step's wall time through `__ZR__` (see perftrace.mjs --auto). Its render-scale
  // changes resize the renderer here; the other rungs' settings are read by the systems themselves.
  const governor = flags.governor ? new QualityGovernor(perfState, flags.governorOpts) : null;
  const syncPixel = new Uint8Array(4);
  let perfApplied = perfState.version;
  const applyPerfState = () => {
    if (perfState.version === perfApplied) return;
    perfApplied = perfState.version;
    applyRenderScale();
    composer?.setSize(host.clientWidth, host.clientHeight);
  };

  const step = (dt: number) => {
    const t0 = performance.now();
    simTime += dt;
    if (!headless) {
      if (follow?.enabled) follow.update(dt);
      else cam.update(dt);
    }
    if (governor) applyPerfState();
    const t1 = performance.now();
    world.update(dt, simTime);
    const t2 = performance.now();
    if (composer) composer.render(dt);
    else renderer.render(scene, cam.camera);
    const t3 = performance.now();
    perf.camera = t1 - t0;
    perf.update = t2 - t1;
    perf.render = t3 - t2;
    perf.step = t3 - t0;
    if (governor && headless) {
      // the trace harness steps the frame itself (no frame interval to read): wait for the GPU so
      // the step's wall time carries the render cost, then feed that to the governor. Chromium's
      // WebGL finish() is only a flush; a one-pixel readPixels of the canvas is the synchronous
      // round-trip that returns once the frame is drawn.
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, syncPixel);
      const t4 = performance.now();
      perf.step = t4 - t0;
      governor.observe(perf.step, t4);
    }
  };

  let readyResolve!: () => void;
  const ready = new Promise<void>((r) => (readyResolve = r));

  // An explicit pose jump (capture harness, viewpoint keys) bypasses the systems' movement-gated
  // LOD refresh, so tell every system the camera moved — otherwise a capture could render the
  // LOD buckets of the previous pose (codex, PR #3 vegetation review).
  const notifyCameraMove = () => {
    cam.camera.updateMatrixWorld();
    for (const s of world.systems) s.onCameraMove?.(cam.camera, world.ctx);
  };

  installCaptureApi({
    scene,
    renderer,
    camera: cam.camera,
    setViewpoint: (id) => {
      const ok = cam.setViewpoint(id);
      if (ok) notifyCameraMove();
      return ok;
    },
    setPose: (p, t, fov) => {
      cam.setPose(p, t, fov);
      notifyCameraMove();
    },
    step,
    setTime: (t) => {
      simTime = t;
    },
    getTime: () => simTime,
    ready,
    failures: world.failures,
    headless,
    audits,
    terrain,
    setQuality: () => {
      /* runtime quality switching is a later task */
    },
    perf: () => {
      const report = perfReport();
      // the systems' own runtime state (the trees' near-LOD geometry pools: live bytes, builds, evictions, build-time percentiles)
      const systemPerf: Record<string, unknown> = {};
      for (const s of world.systems) if (s.perf) systemPerf[s.name] = s.perf();
      return { ...perf, systems: { ...world.timings }, systemPerf, buildMs: { ...world.buildMs }, warmup, flags: report.flags, tier: report.tier, perfState: report, governor: governor?.report() ?? null };
    },
  });

  const onResize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h);
    cam.camera.aspect = w / h;
    cam.camera.updateProjectionMatrix();
    composer?.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  let frames = 0;
  let fpsAcc = 0;
  let fps = 0;
  let devVisible = !headless && params.get('dev') !== '0';
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') {
      devVisible = !devVisible;
      dev.classList.toggle('hidden', !devVisible);
    }
    if (e.code === 'KeyP') setPlayMode(!follow?.enabled);
  });
  dev.classList.toggle('hidden', !devVisible);
  // The walkable build boots in play mode (you are Link); `?mode=free` (or P) gives the free camera
  // used for authoring. Headless captures never enter play mode.
  if (params.get('mode') !== 'free') setPlayMode(true);

  const loop = () => {
    if (!headless) {
      const rawDt = getDelta();
      const dt = Math.min(rawDt, 0.1);
      // the frame interval is the GPU-side proxy the governor steps on (the JS step alone never
      // sees a GPU-bound frame: the driver throttles the next requestAnimationFrame instead)
      if (governor && !shell.paused) governor.observe(rawDt * 1000, lastNow);
      if (!shell.paused) step(dt); // shell-1: the bag holds the world (the last frame stays on the canvas)
      frames++;
      fpsAcc += dt;
      if (fpsAcc >= 0.5) {
        fps = frames / fpsAcc;
        frames = 0;
        fpsAcc = 0;
        if (devVisible) {
          const p = cam.camera.position;
          const info = renderer.info.render;
          const tierHint = governor ? `auto → ${governor.ladder[governor.rung].name}${perfState.renderScale !== 1 ? ` · scale ${perfState.renderScale}` : ''}` : quality.tier;
          const flagHint = Object.keys(flags.active).length ? ` · flags ${Object.entries(flags.active).map(([k, v]) => `${k}=${v}`).join(' ')}` : '';
          dev.textContent =
            `${fps.toFixed(0)} fps · ${info.calls} draws · ${(info.triangles / 1e6).toFixed(2)}M tris\n` +
            `cam ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · quality ${tierHint}${flagHint}\n` +
            (follow?.enabled
              ? `PLAY: WASD / arrows walk · Shift run · Space jump · drag to look · Tab equipment · P free camera · H hide`
              : `FREE CAM: WASD move · drag/dbl-click look · 1-6 viewpoints · R reset · P play as Link · H hide`);
        }
      }
      requestAnimationFrame(loop);
    }
  };

  loading.classList.add('done');
  readyResolve();
  if (headless) {
    // render one frame so the canvas has content before the harness takes over
    step(1 / 60);
  } else {
    requestAnimationFrame(loop);
  }
}

boot().catch((e) => {
  console.error(e);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `failed to boot: ${e?.message ?? e}`;
});
