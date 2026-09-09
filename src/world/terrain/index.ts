/**
 * Terrain system — owner: terrain agent.
 * Chunked heightfield mesh with slope/mask-driven layered material (grass, soil, moss, path).
 * This starter builds the chunk grid with vertex colours from the mask so the composition is
 * visible; the material pass (textures, detail normals, slope blending) is the agent's job.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { Noise2D, lerp } from '../util/noise';

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'terrain';
  const T = ctx.terrain;
  const P = ctx.config.palette;
  const noise = new Noise2D(`${ctx.config.seed}/terrain-color`);

  const half = ctx.config.terrainHalfSize;
  const chunk = 40; // metres per chunk
  const n = Math.ceil((half * 2) / chunk);
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });

  const cGrassL = new Color(P.grassLight);
  const cGrassM = new Color(P.grassMid);
  const cGrassD = new Color(P.grassDeep);
  const cSoil = new Color(P.soil);
  const cMoss = new Color(P.mossDeep);
  const cStone = new Color(P.flagstone);
  const tmp = new Color();
  const nrm = new Vector3();

  let vertices = 0;
  for (let cz = 0; cz < n; cz++) {
    for (let cx = 0; cx < n; cx++) {
      const x0 = -half + cx * chunk;
      const z0 = -half + cz * chunk;
      const cxm = x0 + chunk / 2;
      const czm = z0 + chunk / 2;
      const dist = Math.hypot(cxm, czm);
      // resolution falls off with distance from the plaza
      const res = dist < 55 ? 0.5 : dist < 110 ? 1.25 : 4;
      const segs = Math.max(2, Math.round(chunk / res));
      const pos: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= segs; j++) {
        for (let i = 0; i <= segs; i++) {
          const x = x0 + (i / segs) * chunk;
          const z = z0 + (j / segs) * chunk;
          const y = T.height(x, z);
          pos.push(x, y, z);
          const m = T.mask(x, z);
          T.normal(x, z, nrm);
          const slope = 1 - nrm.y;
          const v = noise.fbm(x * 0.09, z * 0.09, 3) * 0.5 + 0.5;
          tmp.copy(cGrassD).lerp(cGrassM, v).lerp(cGrassL, Math.max(0, noise.noise(x * 0.3, z * 0.3)) * 0.5);
          tmp.lerp(cMoss, Math.min(1, m.plateau * 0.35 + (1 - v) * 0.25));
          tmp.lerp(cSoil, Math.min(1, slope * 2.2));
          tmp.lerp(cStone, m.path * 0.85);
          if (m.stairs) tmp.copy(cSoil).multiplyScalar(0.8);
          col.push(tmp.r, tmp.g, tmp.b);
        }
      }
      for (let j = 0; j < segs; j++) {
        for (let i = 0; i < segs; i++) {
          const a = j * (segs + 1) + i;
          const b = a + 1;
          const c = a + segs + 1;
          const d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const mesh = new Mesh(g, material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.name = `terrain-chunk-${cx}-${cz}`;
      group.add(mesh);
      vertices += pos.length / 3;
    }
  }

  ctx.audit('terrain', () => ({
    chunks: group.children.length,
    vertices,
    textured: false,
    layers: ['vertex-color'],
    halfSize: half,
    heightAtOrigin: T.height(0, 0),
    heightAtStairTop: T.height(14.5, -4),
  }));

  return { name: 'terrain', group };
}

export { lerp };
