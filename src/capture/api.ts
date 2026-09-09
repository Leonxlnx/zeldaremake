/**
 * Headless capture / audit API. The gauntlet scripts (gauntlet/scripts/*.mjs) drive the page
 * through `window.__ZR__`. This is also the anti-cheat surface: the automated rubric checks
 * read scene facts from `audit()` (instance counts, variant counts, materials, textures…) and
 * the harness renders the frames itself — screenshots are never hand-supplied.
 *
 * Under `?capture=1` the world runs with a fixed timestep and no input so two captures of the
 * same commit are pixel-identical (modulo GPU), which is what makes before/after diffs honest.
 */
import {
  Vector3,
  Color,
  MeshDepthMaterial,
  RGBADepthPacking,
  WebGLRenderTarget,
  NearestFilter,
  type Camera,
  type Scene,
  type WebGLRenderer,
  type Object3D,
  type Mesh,
  type InstancedMesh,
  type Material,
  type Texture,
  type PerspectiveCamera,
} from 'three';
import { LAYOUT } from '../world/layout';
import type { Terrain } from '../world/terrain/heightfield';

export interface CaptureHooks {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: Camera;
  setViewpoint(id: string): boolean;
  setPose(position: [number, number, number], target: [number, number, number], fov?: number): void;
  /** advance simulation by dt seconds and render one frame */
  step(dt: number): void;
  /** set / read the world's simulation clock (the one passed to every system's update) */
  setTime(t: number): void;
  getTime(): number;
  /** promise resolved when all systems reported ready */
  ready: Promise<void>;
  /** systems whose create() threw — under capture this makes ready() reject (fail closed) */
  failures: { name: string; error: string }[];
  headless: boolean;
  audits: Map<string, () => Record<string, unknown>>;
  setQuality(tier: string): void;
  terrain: Terrain;
}

export interface ZRApi {
  version: 1;
  /**
   * Resolves true when every system built. Under capture (`?capture=1`) it REJECTS if any system
   * failed, so a partial world can never be scored as if it were complete (fail closed).
   */
  ready(): Promise<boolean>;
  /** systems that failed to build (empty when healthy) */
  failures(): { name: string; error: string }[];
  viewpoints(): { id: string; label: string; refSeconds: number; diagnostic: boolean }[];
  setViewpoint(id: string): boolean;
  setPose(position: [number, number, number], target: [number, number, number], fov?: number): void;
  /** render `frames` frames at `dt` each (default 1/60) and resolve after the last one */
  render(frames?: number, dt?: number): Promise<void>;
  /** set deterministic simulation time (seconds) */
  setTime(t: number): void;
  stats(): Record<string, unknown>;
  audit(): Record<string, unknown>;
  setQuality(tier: string): void;
  /** terrain height + mask at a world xz (used by seating/contact checks) */
  probe(x: number, z: number): { height: number; slope: number; mask: Record<string, number> };
  cameraPose(): { position: number[]; direction: number[]; fov: number };
  /**
   * Render linear depth for the current camera at low resolution and return a histogram
   * (anti-cheat C3: a flat backdrop pretending to be scenery shows up as one huge bucket).
   * `buckets` are fractions of non-sky pixels per 1 % slice of [0, maxDepth]; sky = depth ≥ maxDepth.
   */
  depthHistogram(maxDepth?: number): { buckets: number[]; skyFraction: number; farLayerCount: number; maxBucketBeyond20m: number };
  /** project world points to normalised screen coords for the current camera ([x,y] in 0..1, y down; null if behind) */
  project(points: [number, number, number][]): ([number, number] | null)[];
  /**
   * Render one frame with only the named top-level system group visible and return its draw
   * calls / triangles, then restore visibility. Lets each system measure its own budget share.
   */
  isolate(systemName: string): { system: string; drawCalls: number; triangles: number; found: boolean };
}

declare global {
  interface Window {
    __ZR__?: ZRApi;
  }
}

export function isHeadlessCapture(): boolean {
  const q = new URLSearchParams(location.search);
  return q.get('capture') === '1' || (navigator as unknown as { webdriver?: boolean }).webdriver === true;
}

function sceneAudit(scene: Scene): Record<string, unknown> {
  let meshes = 0;
  let instanced = 0;
  let instances = 0;
  let triangles = 0;
  const materials = new Set<Material>();
  const textures = new Set<string>();
  const geometries = new Set<string>();
  const byName: Record<string, { meshes: number; instances: number; triangles: number }> = {};
  const forbidden: string[] = [];

  const triCount = (m: Mesh) => {
    const g = m.geometry;
    if (!g) return 0;
    const idx = g.index ? g.index.count : g.attributes.position?.count ?? 0;
    return Math.floor(idx / 3);
  };

  scene.traverse((o: Object3D) => {
    const m = o as Mesh;
    const asPoints = o as unknown as { isPoints?: boolean; isSprite?: boolean; geometry?: { attributes: { position?: { count: number } } } };
    const isParticles = !!(asPoints.isPoints || asPoints.isSprite);
    if (!(m as Mesh).isMesh && !isParticles) return;
    meshes++;
    // Points/Sprite particle systems count each vertex as one instance (a mote/leaf), zero triangles —
    // otherwise legitimate particle audits (fireflies, leaves) fail the B3 scene-graph cross-check.
    const t = isParticles ? 0 : triCount(m);
    const inst = isParticles
      ? asPoints.isSprite
        ? 1
        : asPoints.geometry?.attributes.position?.count ?? 1
      : (m as InstancedMesh).isInstancedMesh
        ? (m as InstancedMesh).count
        : 1;
    if ((m as InstancedMesh).isInstancedMesh) instanced++;
    instances += inst;
    triangles += t * inst;
    if (m.geometry) geometries.add(m.geometry.uuid);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      materials.add(mat);
      for (const [k, v] of Object.entries(mat as unknown as Record<string, unknown>)) {
        const tex = v as Texture | null;
        if (tex && (tex as Texture).isTexture) {
          const name = tex.name || `${k}:${tex.uuid.slice(0, 8)}`;
          textures.add(name);
          const anyTex = tex as unknown as { isVideoTexture?: boolean; image?: { tagName?: string; src?: string } };
          if (anyTex.isVideoTexture || anyTex.image?.tagName === 'VIDEO') forbidden.push(`video-texture:${name}`);
          if (anyTex.image?.src && /reference|oot|zelda|frame/i.test(anyTex.image.src)) forbidden.push(`suspicious-texture-src:${anyTex.image.src}`);
        }
      }
    }
    // roll up by top-level system group name
    let p: Object3D | null = o;
    while (p && p.parent && p.parent !== scene) p = p.parent;
    const key = p?.name || 'unnamed';
    byName[key] ??= { meshes: 0, instances: 0, triangles: 0 };
    byName[key].meshes++;
    byName[key].instances += inst;
    byName[key].triangles += t * inst;
  });

  return {
    meshes,
    instancedMeshes: instanced,
    instances,
    triangles,
    materials: materials.size,
    uniqueGeometries: geometries.size,
    textures: [...textures].sort(),
    bySystem: byName,
    forbidden,
  };
}

/** Layout geometry the rubric's projection/composition checks need, so tooling never parses layout.ts. */
function layoutAudit() {
  const stairs = LAYOUT.stairs.map((s) => {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    const dx = s.dir[0] / l;
    const dz = s.dir[1] / l;
    const run = s.steps * s.tread;
    const rise = s.steps * s.rise;
    const hw = s.width / 2;
    const corner = (u: number, v: number, y: number): [number, number, number] => [s.base[0] + dx * u - dz * v, s.base[1] + y, s.base[2] + dz * u + dx * v];
    return {
      id: s.id,
      steps: s.steps,
      width: s.width,
      rise: s.rise,
      tread: s.tread,
      base: s.base,
      top: corner(run, 0, rise),
      footprint: [corner(0, -hw, 0), corner(0, hw, 0), corner(run, hw, rise), corner(run, -hw, rise)],
    };
  });
  const lb = LAYOUT.lanternBranch;
  const mid: [number, number, number] = [(lb.from[0] + lb.to[0]) / 2, (lb.from[1] + lb.to[1]) / 2, (lb.from[2] + lb.to[2]) / 2];
  return {
    viewpoints: LAYOUT.viewpoints.map((v) => ({ id: v.id, refSeconds: v.refSeconds, diagnostic: !!v.diagnostic, position: v.position, target: v.target, fov: v.fov })),
    stairs,
    lanternBranch: { from: lb.from, mid, to: lb.to, lanterns: lb.lanterns },
    houses: LAYOUT.houses.map((h) => ({ id: h.id, position: h.position, trunkRadius: h.trunkRadius, roofHeight: h.roofHeight })),
    logArch: LAYOUT.logArch,
    heroBoulders: LAYOUT.heroBoulders,
    giantTrees: LAYOUT.giantTrees.map((g) => ({ id: g.id, position: g.position, trunkRadius: g.trunkRadius })),
  };
}

export function installCaptureApi(hooks: CaptureHooks): ZRApi {
  const api: ZRApi = {
    version: 1,
    ready: async () => {
      await hooks.ready;
      if (hooks.failures.length) {
        const list = hooks.failures.map((f) => `${f.name}: ${f.error.split('\n')[0]}`).join('; ');
        if (hooks.headless) throw new Error(`world incomplete — ${hooks.failures.length} system(s) failed to build: ${list}`);
        console.warn(`[capture] world incomplete: ${list}`);
        return false;
      }
      return true;
    },
    failures: () => hooks.failures.map((f) => ({ ...f })),
    viewpoints: () => LAYOUT.viewpoints.map((v) => ({ id: v.id, label: v.label, refSeconds: v.refSeconds, diagnostic: !!v.diagnostic })),
    setViewpoint: (id) => hooks.setViewpoint(id),
    setPose: (p, t, fov) => hooks.setPose(p, t, fov),
    render: async (frames = 1, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        hooks.step(dt);
        await new Promise((r) => requestAnimationFrame(r));
      }
    },
    setTime: (t) => hooks.setTime(t),
    stats: () => {
      const info = hooks.renderer.info;
      return {
        simTime: hooks.getTime(),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        width: hooks.renderer.domElement.width,
        height: hooks.renderer.domElement.height,
        pixelRatio: hooks.renderer.getPixelRatio(),
      };
    },
    audit: () => {
      const systems: Record<string, unknown> = {};
      for (const [name, fn] of hooks.audits) {
        try {
          systems[name] = fn();
        } catch (e) {
          systems[name] = { error: String(e) };
        }
      }
      return {
        scene: sceneAudit(hooks.scene),
        systems,
        systemFailures: hooks.failures.map((f) => ({ ...f })),
        layout: layoutAudit(),
      };
    },
    setQuality: (tier) => hooks.setQuality(tier),
    probe: (x, z) => ({ height: hooks.terrain.height(x, z), slope: hooks.terrain.slope(x, z), mask: { ...hooks.terrain.mask(x, z) } }),
    cameraPose: () => {
      const p = new Vector3();
      const d = new Vector3();
      hooks.camera.getWorldPosition(p);
      hooks.camera.getWorldDirection(d);
      return { position: [p.x, p.y, p.z], direction: [d.x, d.y, d.z], fov: (hooks.camera as PerspectiveCamera).fov ?? 0 };
    },
    depthHistogram: (maxDepth = 250) => {
      const W = 160;
      const H = 90;
      const cam = hooks.camera as PerspectiveCamera;
      const rt = new WebGLRenderTarget(W, H, { minFilter: NearestFilter, magFilter: NearestFilter });
      const depthMat = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
      const scene = hooks.scene;
      const prevOverride = scene.overrideMaterial;
      const prevBg = scene.background;
      const prevFog = scene.fog;
      const prevTarget = hooks.renderer.getRenderTarget();
      const prevClear = hooks.renderer.getClearColor(new Color());
      const prevClearAlpha = hooks.renderer.getClearAlpha();
      // temporarily render with a far plane at maxDepth so the packed depth maps to [0, maxDepth]
      const prevFar = cam.far;
      const prevNear = cam.near;
      const near = 0.1;
      const far = maxDepth;
      const px = new Uint8Array(W * H * 4);
      // objects flagged userData.depthAudit === false (mist sheets, particle billboards) are not
      // scenery and must not fill depth buckets in the anti-matte check
      const hidden: Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData?.depthAudit === false && o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      });
      try {
        cam.near = near;
        cam.far = far;
        cam.updateProjectionMatrix();
        scene.overrideMaterial = depthMat;
        scene.background = null;
        scene.fog = null;
        hooks.renderer.setRenderTarget(rt);
        hooks.renderer.setClearColor(0xffffff, 1);
        hooks.renderer.clear();
        hooks.renderer.render(scene, cam);
        hooks.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
      } finally {
        for (const o of hidden) o.visible = true;
        hooks.renderer.setRenderTarget(prevTarget);
        hooks.renderer.setClearColor(prevClear, prevClearAlpha);
        scene.overrideMaterial = prevOverride;
        scene.background = prevBg;
        scene.fog = prevFog;
        cam.near = prevNear;
        cam.far = prevFar;
        cam.updateProjectionMatrix();
        rt.dispose();
        depthMat.dispose();
      }
      const buckets = new Array(100).fill(0);
      let sky = 0;
      let n = 0;
      for (let i = 0; i < W * H; i++) {
        const r = px[i * 4];
        const g = px[i * 4 + 1];
        const b = px[i * 4 + 2];
        const a = px[i * 4 + 3];
        // sky = the untouched white clear sentinel (packDepthToRGBA only yields (1,1,1,1) for v >= 1,
        // i.e. at/beyond the far plane); a depth threshold would misclassify far geometry as sky
        if (r === 255 && g === 255 && b === 255 && a === 255) {
          sky++;
          continue;
        }
        // unpack RGBA depth exactly as three r186 packing.glsl.js (unpackRGBAToDepth):
        // dot(v, vec4(255/256 / (1, 256, 65536), 1/16777216)) with v = px/255, red = coarse channel
        const d = r / 256 + g / 65536 + b / 16777216 + a / 4278190080;
        // perspective depth → linear view distance, using the near/far the depth pass was rendered with
        const zNdc = d * 2 - 1;
        const lin = (2 * near * far) / (far + near - zNdc * (far - near));
        const bucket = Math.min(99, Math.floor((lin / maxDepth) * 100));
        buckets[bucket]++;
        n++;
      }
      const frac = buckets.map((c) => (n ? c / n : 0));
      const beyond20 = Math.floor((20 / maxDepth) * 100);
      let maxBucketBeyond20m = 0;
      for (let b = beyond20; b < 100; b++) maxBucketBeyond20m = Math.max(maxBucketBeyond20m, frac[b]);
      // count distinct occupied depth layers (runs of buckets with ≥ 1.5 % of pixels) beyond 8 m
      let farLayerCount = 0;
      let inRun = false;
      for (let b = Math.floor((8 / maxDepth) * 100); b < 100; b++) {
        const occupied = frac[b] >= 0.015;
        if (occupied && !inRun) farLayerCount++;
        inRun = occupied;
      }
      return { buckets: frac, skyFraction: sky / (W * H), farLayerCount, maxBucketBeyond20m };
    },
    isolate: (systemName) => {
      const scene = hooks.scene;
      const saved = scene.children.map((c) => [c, c.visible] as const);
      let found = false;
      try {
        for (const c of scene.children) {
          const keep = c.name === systemName;
          if (keep) found = true;
          c.visible = keep || c.name === 'lighting';
        }
        hooks.renderer.info.reset();
        hooks.renderer.render(scene, hooks.camera);
        const info = hooks.renderer.info.render;
        return { system: systemName, drawCalls: info.calls, triangles: info.triangles, found };
      } finally {
        for (const [c, v] of saved) c.visible = v;
      }
    },
    project: (points) => {
      const cam = hooks.camera as PerspectiveCamera;
      cam.updateMatrixWorld();
      const v = new Vector3();
      return points.map(([x, y, z]) => {
        v.set(x, y, z).project(cam);
        if (v.z > 1 || v.z < -1) return null;
        return [(v.x + 1) / 2, (1 - v.y) / 2] as [number, number];
      });
    },
  };
  window.__ZR__ = api;
  return api;
}
