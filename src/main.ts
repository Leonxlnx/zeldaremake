import { Scene, WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace, BasicShadowMap } from 'three';
import { createWorld, qualityFor } from './world';
import { createFreeCam } from './camera/freecam';
import { createFollowCam, type FollowCam } from './camera/follow';
import type { PlayerHandle } from './world/character/player';
import { getTerrain } from './world/terrain/heightfield';
import { installCaptureApi, isHeadlessCapture } from './capture/api';
import { WORLD } from './world/config';
import type { Quality } from './world/system';
import { mountHud } from './ui/hud';

async function boot() {
  const host = document.getElementById('app')!;
  const dev = document.getElementById('dev')!;
  const loading = document.getElementById('loading')!;
  const params = new URLSearchParams(location.search);
  const headless = isHeadlessCapture();
  const tier = (params.get('quality') as Quality['tier']) || 'high';
  const quality = qualityFor(tier);

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: headless });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio, WORLD.renderer.maxPixelRatio));
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
  const step = (dt: number) => {
    simTime += dt;
    if (!headless) {
      if (follow?.enabled) follow.update(dt);
      else cam.update(dt);
    }
    world.update(dt, simTime);
    if (composer) composer.render(dt);
    else renderer.render(scene, cam.camera);
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
  if (params.get('mode') === 'play') setPlayMode(true);

  const loop = () => {
    if (!headless) {
      const dt = Math.min(getDelta(), 0.1);
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
          dev.textContent =
            `${fps.toFixed(0)} fps · ${info.calls} draws · ${(info.triangles / 1e6).toFixed(2)}M tris\n` +
            `cam ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} · quality ${quality.tier}\n` +
            `WASD move · drag/dbl-click look · 1-6 viewpoints · R reset · P play (follow cam) · H hide`;
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
