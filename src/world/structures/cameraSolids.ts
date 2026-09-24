/**
 * The play camera's view of the structures (camera/collision.ts), voxelised BEFORE the static
 * consolidation merges the parts by material (their names are gone after it). Two grids at
 * CELL m, each grown by one cell:
 *  - SOLID: the shells the camera keeps Link in front of — house trunks, roofs, eaves, porches,
 *    root arches, door and window frames; the log arch's bark, ends, passage tube and cheeks; the
 *    huts' bark, caps and planks, the far hut's column; the bridge keeper's mast, the waystation's
 *    walls;
 *  - SLIM: the parts it only refuses to stand inside — fence and lantern posts, the sign, the pods,
 *    the keeper's railing, braces, davit, firewood and beacon arm, the waystation's posts, bench
 *    and firewood, and its roof (0.42 m over Link's aim where he stands on its floor: as a shell
 *    it stopped every line but those out of the open front at the camera's minimum distance),
 *    the buttress roots, the boughs, the plaza bough's sleeve and the bough itself (the trees
 *    system's limb path, as spheres). A slim part between Link and the camera is allowed to pass.
 * A SOLID part may carry `userData.cameraShell` (a vertical cylinder: world x, z, radius): its
 * triangles wholly outside it are SLIM. The bridge keeper's eave hangs 1.7 m over its gallery,
 * where Link's aim (1.43 m) sits inside the eave's grown cells; as a shell the camera would snap
 * to its minimum distance on the walk. So its soffit, skirt and cap overhang are slim and only
 * the wall and the dome over the room stay solid.
 * Built for play only (never under a headless capture): ~0.1–0.3 s once at load.
 */
import { Box3, BufferGeometry, Float32BufferAttribute, InstancedMesh, Matrix4, type Mesh, type Object3D, Vector3 } from 'three';
import type { TubePath } from '../system';
import { VoxelGrid, worldBounds } from '../util/voxelGrid';

export const CAMERA_SOLID_CELL = 0.25;

const SOLID = /^(trunk|trunk-eave-band|porch|roof|roof-straw|roof-eave|roof-eave-bark|roots-arch|door-frame|window-frame|window-socket|log-bark|log-ends|log-tunnel|log-tunnel-cheeks|log-bark-plates|far-hut-column|keeper-mast|waystation-walls(-ends)?)$|^distant-house-(bark|cap|cap-skirt|planks):/;
const SLIM = /^(roots|support-boughs|roof-branches|signpost-wood|lantern-post|lantern-peg|lantern-hanger|pod-lantern|pod-lantern-static|lantern-branch-bark|fence-.+|distant-house-ladder:.+|keeper-(beacon|braces|davit|firewood|rail|rail-posts)(-ends)?|waystation-(bench|firewood|posts|roof)(-ends)?)$/;
const NOT_SLIM = /-(rope|foot-moss)$/;

export interface CameraSolids {
  solid: VoxelGrid | null;
  slim: VoxelGrid | null;
  /** part names per class and the build time (audit) */
  report: { solidParts: Record<string, number>; slimParts: Record<string, number>; ms: number; solidCells: number; slimCells: number; bytes: number };
}

interface Part {
  geometry: BufferGeometry;
  matrix: Matrix4;
  name: string;
}

interface Shell {
  x: number;
  z: number;
  r: number;
}

const _tri = [new Vector3(), new Vector3(), new Vector3()];

/** a part's triangles in world space: those wholly outside the shell's cylinder (`outside`), the rest (`inside`) */
function splitShell(geometry: BufferGeometry, matrix: Matrix4, shell: Shell): { inside: BufferGeometry; outside: BufferGeometry } {
  const pos = geometry.attributes.position;
  const idx = geometry.index;
  const n = idx ? idx.count : pos.count;
  const inside: number[] = [];
  const outside: number[] = [];
  for (let t = 0; t + 2 < n; t += 3) {
    let out = true;
    for (let k = 0; k < 3; k++) {
      const p = _tri[k].fromBufferAttribute(pos, idx ? idx.getX(t + k) : t + k).applyMatrix4(matrix);
      if ((p.x - shell.x) ** 2 + (p.z - shell.z) ** 2 <= shell.r * shell.r) out = false;
    }
    const dst = out ? outside : inside;
    for (const p of _tri) dst.push(p.x, p.y, p.z);
  }
  const geo = (a: number[]) => new BufferGeometry().setAttribute('position', new Float32BufferAttribute(a, 3));
  return { inside: geo(inside), outside: geo(outside) };
}

function collect(roots: Object3D[]): { solid: Part[]; slim: Part[] } {
  const solid: Part[] = [];
  const slim: Part[] = [];
  const inst = new Matrix4();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const cls = SOLID.test(m.name) ? solid : SLIM.test(m.name) && !NOT_SLIM.test(m.name) ? slim : null;
      if (!cls) return;
      const shell = m.userData.cameraShell as Shell | undefined;
      if (shell && cls === solid && !(m instanceof InstancedMesh)) {
        const { inside, outside } = splitShell(m.geometry, m.matrixWorld, shell);
        if (inside.attributes.position.count) solid.push({ geometry: inside, matrix: new Matrix4(), name: m.name });
        if (outside.attributes.position.count) slim.push({ geometry: outside, matrix: new Matrix4(), name: m.name });
        return;
      }
      if (m instanceof InstancedMesh) {
        for (let i = 0; i < m.count; i++) {
          m.getMatrixAt(i, inst);
          cls.push({ geometry: m.geometry, matrix: m.matrixWorld.clone().multiply(inst), name: m.name });
        }
      } else cls.push({ geometry: m.geometry, matrix: m.matrixWorld.clone(), name: m.name });
    });
  }
  return { solid, slim };
}

function tally(parts: Part[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parts) {
    const key = p.name.replace(/:.*$/, '');
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function voxelise(parts: Part[], spheres: { x: number; y: number; z: number; r: number }[]): VoxelGrid | null {
  const box = worldBounds(parts, 1);
  const ball = new Box3();
  for (const s of spheres) box.union(ball.setFromCenterAndSize(new Vector3(s.x, s.y, s.z), new Vector3().setScalar(2 * s.r + 2)));
  if (box.isEmpty()) return null;
  const grid = new VoxelGrid(box, CAMERA_SOLID_CELL);
  for (const p of parts) grid.addGeometry(p.geometry, p.matrix);
  for (const s of spheres) grid.addSphere(s.x, s.y, s.z, s.r);
  grid.dilate(1);
  return grid;
}

/** the limb as a chain of balls ≤ 0.3 m apart along its visible range */
export function limbSpheres(limb: TubePath | undefined): { x: number; y: number; z: number; r: number }[] {
  if (!limb) return [];
  const [s0, s1] = limb.range;
  const a = limb.centre(s0);
  const b = limb.centre(s1);
  const n = Math.max(2, Math.ceil(a.distanceTo(b) / 0.3) * 2);
  const out: { x: number; y: number; z: number; r: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const c = limb.centre(s);
    out.push({ x: c.x, y: c.y, z: c.z, r: limb.radius(s) });
  }
  return out;
}

export function buildCameraSolids(roots: Object3D[], slimSpheres: { x: number; y: number; z: number; r: number }[] = []): CameraSolids {
  const t0 = performance.now();
  const { solid, slim } = collect(roots);
  const solidGrid = voxelise(solid, []);
  const slimGrid = voxelise(slim, slimSpheres);
  const ms = performance.now() - t0;
  return {
    solid: solidGrid,
    slim: slimGrid,
    report: {
      solidParts: tally(solid),
      slimParts: tally(slim),
      ms: Math.round(ms),
      solidCells: solidGrid?.count() ?? 0,
      slimCells: slimGrid?.count() ?? 0,
      bytes: (solidGrid?.bytes() ?? 0) + (slimGrid?.bytes() ?? 0),
    },
  };
}
