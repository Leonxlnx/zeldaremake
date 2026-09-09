/**
 * Headless capture / audit API. The gauntlet scripts (gauntlet/scripts/*.mjs) drive the page
 * through `window.__ZR__`. This is also the anti-cheat surface: the automated rubric checks
 * read scene facts from `audit()` (instance counts, variant counts, materials, textures…) and
 * the harness renders the frames itself — screenshots are never hand-supplied.
 *
 * Under `?capture=1` the world runs with a fixed timestep and no input so two captures of the
 * same commit are pixel-identical (modulo GPU), which is what makes before/after diffs honest.
 */
import { Vector3, type Camera, type Scene, type WebGLRenderer, type Object3D, type Mesh, type InstancedMesh, type Material, type Texture, type PerspectiveCamera } from 'three';
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
  /** promise resolved when all systems reported ready */
  ready: Promise<void>;
  audits: Map<string, () => Record<string, unknown>>;
  setQuality(tier: string): void;
  terrain: Terrain;
}

export interface ZRApi {
  version: 1;
  ready(): Promise<boolean>;
  viewpoints(): { id: string; label: string; refSeconds: number }[];
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
    if (!(m as Mesh).isMesh) return;
    meshes++;
    const t = triCount(m);
    const inst = (m as InstancedMesh).isInstancedMesh ? (m as InstancedMesh).count : 1;
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

export function installCaptureApi(hooks: CaptureHooks): ZRApi {
  let simTime = 0;
  const api: ZRApi = {
    version: 1,
    ready: async () => {
      await hooks.ready;
      return true;
    },
    viewpoints: () => LAYOUT.viewpoints.map((v) => ({ id: v.id, label: v.label, refSeconds: v.refSeconds })),
    setViewpoint: (id) => hooks.setViewpoint(id),
    setPose: (p, t, fov) => hooks.setPose(p, t, fov),
    render: async (frames = 1, dt = 1 / 60) => {
      for (let i = 0; i < frames; i++) {
        simTime += dt;
        hooks.step(dt);
        await new Promise((r) => requestAnimationFrame(r));
      }
    },
    setTime: (t) => {
      simTime = t;
    },
    stats: () => {
      const info = hooks.renderer.info;
      return {
        simTime,
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
      return { scene: sceneAudit(hooks.scene), systems, layout: { viewpoints: LAYOUT.viewpoints.map((v) => v.id), stairs: LAYOUT.stairs.map((s) => ({ id: s.id, steps: s.steps })) } };
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
  };
  window.__ZR__ = api;
  return api;
}
