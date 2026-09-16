import { Scene, WebGLRenderer, WebGLRenderTarget, ACESFilmicToneMapping, SRGBColorSpace, BasicShadowMap, type Camera, type DirectionalLight, type Material, type Mesh, type Object3D, type ShaderMaterial, type Texture } from 'three';
import { createWorld, qualityFor } from './world';
import { createFreeCam } from './camera/freecam';
import { createFollowCam, type FollowCam } from './camera/follow';
import type { PlayerHandle } from './world/character/player';
import { getTerrain } from './world/terrain/heightfield';
import { installCaptureApi, isHeadlessCapture } from './capture/api';
import { WORLD } from './world/config';
import type { Quality } from './world/system';
import { mountHud } from './ui/hud';
import { perfFlags, perfReport, perfRuntime, QualityGovernor } from './perfFlags';

/**
 * Warm-up before the first frame of the walkable build (round 37). Measured on the r37 trace
 * without it: entering play mode compiled 8 programs on the first rendered frame (104 ms) and
 * 206 geometries were first uploaded during the 45 s walk (42 of 90 sampled frames) — every LOD
 * bucket / grass ring / caster the camera first meets. Here, before `ready()` resolves:
 *   1. every mesh outside the grass tiles is made visible and unculled for the duration (the
 *      hidden LOD buckets have count 0: they upload their geometry and instance buffers and draw
 *      nothing), `renderer.compileAsync` then compiles every material's colour program (with
 *      KHR_parallel_shader_compile the driver links them on its own threads while the main thread
 *      polls every 10 ms; without it the links stall at the warm pass, as `compile` would) and
 *      `initTexture` uploads every texture a material references;
 *   2. one warm pass renders the scene into an off-screen 4×4 target (the canvas untouched) with
 *      the sun's shadow window widened to the whole world, so the depth variants of every caster
 *      compile too; the window is restored to the same numbers (the shadow map is redrawn every
 *      frame anyway), and every mesh gets its `visible` / `frustumCulled` back exactly.
 * The scene state after it is the state before it; only the GL side is warm. Headless captures
 * skip it by default (their settle frames absorb compiles; `?warmup=1` forces it, `?warmup=0`
 * disables it). Grass tiles keep their on-demand LOD geometry uploads (551k blades × 3 LODs would
 * not fit residently); their instance buffers upload when a tile first comes into range.
 */
async function warmUp(renderer: WebGLRenderer, scene: Scene, camera: Camera, sun: DirectionalLight | null) {
  const t0 = performance.now();
  const programsBefore = renderer.info.programs?.length ?? 0;
  const geometriesBefore = renderer.info.memory.geometries;
  const exposed: { o: Object3D; visible: boolean; frustumCulled: boolean }[] = [];
  scene.traverse((o) => {
    if (!(o as Mesh).isMesh || o.name.startsWith('grass-tile-')) return;
    exposed.push({ o, visible: o.visible, frustumCulled: o.frustumCulled });
    o.visible = true;
    o.frustumCulled = false;
  });
  const seen = new Set<Texture>();
  const parallel = renderer.extensions.has('KHR_parallel_shader_compile');
  const report = { programs: 0, textures: 0, geometries: 0, exposed: exposed.length, parallel, compileMs: 0, textureMs: 0, warmPassMs: 0, ms: 0 };
  try {
    // nothing renders while this awaits: boot() has not started the frame loop yet
    await renderer.compileAsync(scene, camera);
    const tCompile = performance.now();
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
    const sc = sun?.castShadow ? sun.shadow.camera : null;
    const saved = sc ? { left: sc.left, right: sc.right, top: sc.top, bottom: sc.bottom, near: sc.near, far: sc.far } : null;
    if (sc) {
      sc.left = -500;
      sc.right = 500;
      sc.top = 500;
      sc.bottom = -500;
      sc.near = 0.1;
      sc.far = 2000;
      sc.updateProjectionMatrix();
    }
    const rt = new WebGLRenderTarget(4, 4);
    const prevTarget = renderer.getRenderTarget();
    try {
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(prevTarget);
      rt.dispose();
      if (sc && saved) {
        Object.assign(sc, saved);
        sc.updateProjectionMatrix();
      }
    }
    const t1 = performance.now();
    report.compileMs = Math.round(tCompile - t0);
    report.textureMs = Math.round(tTextures - tCompile);
    report.warmPassMs = Math.round(t1 - tTextures);
  } finally {
    for (const e of exposed) {
      e.o.visible = e.visible;
      e.o.frustumCulled = e.frustumCulled;
    }
  }
  report.ms = Math.round(performance.now() - t0);
  report.programs = (renderer.info.programs?.length ?? 0) - programsBefore;
  report.textures = seen.size;
  report.geometries = renderer.info.memory.geometries - geometriesBefore;
  console.info(`[warmup] ${report.programs} programs, ${report.textures} textures, ${report.geometries} geometries (${report.exposed} meshes exposed) in ${report.ms} ms (compile ${report.compileMs}${parallel ? ', parallel' : ''}, textures ${report.textureMs}, warm pass ${report.warmPassMs})`);
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
  if (params.get('hud') !== '0') mountHud(host, { headless });

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
    warmup = await warmUp(renderer, scene, cam.camera, world.ctx.sun);
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

  let simTime = 0;
  // CPU ms of the last step's phases (camera / world.update / render issue), read by __ZR__.perf()
  const perf = { step: 0, camera: 0, update: 0, render: 0 };

  // Auto quality: the governor steps the ladder in perfFlags.ts from the frame time. It is fed the
  // rAF interval in play (what the GPU actually lets through) and, under the trace harness, the
  // finished step's wall time through `__ZR__` (see perftrace.mjs --auto). Its render-scale
  // changes resize the renderer here; the other rungs' settings are read by the systems themselves.
  const governor = flags.governor ? new QualityGovernor(perfState) : null;
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
      // the step's wall time carries the render cost, then feed that to the governor
      renderer.getContext().finish();
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
      return { ...perf, systems: { ...world.timings }, buildMs: { ...world.buildMs }, warmup, flags: report.flags, tier: report.tier, perfState: report, governor: governor?.report() ?? null };
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
      if (governor) governor.observe(rawDt * 1000, lastNow);
      step(dt);
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
              ? `PLAY: WASD / arrows walk · Shift run · drag to look · Tab equipment · P free camera · H hide`
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
