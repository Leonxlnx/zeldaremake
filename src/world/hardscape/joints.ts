/**
 * Joint fill: a terrain-hugging surface of dark damp soil + moss that sits a hair above the
 * ground under the paved area, so the gaps between slabs read as filled joints rather than
 * holes down to the terrain texture. Grid is aligned to the terrain's 0.2 m detail grid so the
 * two surfaces are parallel (no z-fighting).
 */
import { BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshStandardMaterial, Vector2 } from 'three';
import type { Terrain } from '../terrain/heightfield';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';
import { Noise2D, clamp, smoothstep } from '../util/noise';

export async function buildJointMesh(
  terrain: Terrain,
  paved: (x: number, z: number, threshold?: number) => boolean,
  bbox: { x0: number; x1: number; z0: number; z1: number },
  textures: TextureLibrary,
  config: WorldConfig,
  seed: string,
): Promise<{ mesh: Mesh; vertices: number }> {
  const step = 0.2;
  const x0 = Math.floor(bbox.x0 / step) * step;
  const z0 = Math.floor(bbox.z0 / step) * step;
  const nx = Math.ceil((bbox.x1 - x0) / step);
  const nz = Math.ceil((bbox.z1 - z0) / step);
  const noise = new Noise2D(`${seed}/joints`);
  const P = config.palette;
  const soil = new Color(P.soilDark);
  const soilMid = new Color(P.soil);
  const mossD = new Color(P.mossDeep);
  const mossB = new Color(P.mossBright);
  const tmp = new Color();

  // mark paved grid points (slightly wider than the slabs so the fill peeks out at the edges)
  const pavedFlag = new Uint8Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pavedFlag[j * (nx + 1) + i] = paved(x0 + i * step, z0 + j * step, 0.38) ? 1 : 0;

  const index = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const vertexFor = (i: number, j: number) => {
    const k = j * (nx + 1) + i;
    if (index[k] >= 0) return index[k];
    const x = x0 + i * step;
    const z = z0 + j * step;
    const y = terrain.height(x, z) + 0.012;
    pos.push(x, y, z);
    uv.push(x / 1.3, z / 1.3);
    const m = noise.fbm(x * 0.9 + 4, z * 0.9 - 2, 3) * 0.5 + 0.5;
    const dampN = noise.fbm(x * 0.25, z * 0.25 + 9, 2) * 0.5 + 0.5;
    tmp.copy(soil).lerp(soilMid, 0.35 * dampN);
    const mossAmt = smoothstep(0.45, 0.8, m) * (0.6 + 0.4 * dampN) * (1 - 0.4 * smoothstep(3.5, 0, Math.hypot(x, z)));
    tmp.lerp(mossD, clamp(mossAmt, 0, 1) * 0.85);
    tmp.lerp(mossB, clamp(smoothstep(0.7, 0.95, m), 0, 1) * 0.5);
    col.push(tmp.r, tmp.g, tmp.b);
    index[k] = pos.length / 3 - 1;
    return index[k];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = pavedFlag[j * (nx + 1) + i];
      const b = pavedFlag[j * (nx + 1) + i + 1];
      const c = pavedFlag[(j + 1) * (nx + 1) + i];
      const d = pavedFlag[(j + 1) * (nx + 1) + i + 1];
      if (a + b + c + d === 0) continue;
      const va = vertexFor(i, j);
      const vb = vertexFor(i + 1, j);
      const vc = vertexFor(i, j + 1);
      const vd = vertexFor(i + 1, j + 1);
      if ((i + j) & 1) idx.push(va, vc, vb, vb, vc, vd);
      else idx.push(va, vc, vd, va, vd, vb);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const [mapT, nT] = await Promise.all([textures.load('brown_mud_leaves_01', 'color'), textures.load('brown_mud_leaves_01', 'normal')]);
  const mat = new MeshStandardMaterial({ map: mapT, normalMap: nT, normalScale: new Vector2(0.6, 0.6), vertexColors: true, roughness: 0.96, metalness: 0, color: new Color(1.35, 1.3, 1.2) });
  mat.name = 'flagstone-joints';
  const mesh = new Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'flagstone-joints';
  return { mesh, vertices: pos.length / 3 };
}
