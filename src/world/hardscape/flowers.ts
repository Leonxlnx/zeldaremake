/**
 * White flower heads on the lawn pocket (reference frame 14 s: the left-third lawn carries a
 * scatter of small white dots — clover / daisy heads in the turf). The shared sprout system has
 * no pale variant (its instance colours only scale the palette greens), so the heads are a
 * small hardscape-owned mesh: every head a squashed icosphere on a thin stem, all merged into
 * one geometry — one draw for the lot, no wind, no shadow casting.
 */
import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';
import type { Rng } from '../util/prng';
import type { WorldConfig } from '../config';

export interface FlowerHead {
  x: number;
  /** ground height at (x, z) */
  y: number;
  z: number;
}

/** head radius (m): 1.6–2.4 cm, a cluster of florets read as one dot from 5–9 m */
const HEAD_RADIUS: [number, number] = [0.016, 0.024];
/** stem height (m): the heads stand at the lawn's canopy (the clumps are 8–13 cm) so the grazing
 * B/E view sees them over the blades instead of buried among them */
const STEM_HEIGHT: [number, number] = [0.1, 0.14];

export function buildFlowerHeads(heads: FlowerHead[], rng: Rng, palette: WorldConfig['palette']): { mesh: Mesh; triangles: number } {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const unit = new IcosahedronGeometry(1, 1).toNonIndexed();
  const up = unit.getAttribute('position').array as Float32Array;
  const un = unit.getAttribute('normal').array as Float32Array;
  const stem = new Color(palette.grassDeep);
  const cream = new Color();
  for (const h of heads) {
    const r = rng.range(HEAD_RADIUS[0], HEAD_RADIUS[1]);
    const sh = rng.range(STEM_HEIGHT[0], STEM_HEIGHT[1]);
    // a slight lean, so the heads do not all stand plumb
    const lx = rng.range(-0.15, 0.15) * sh;
    const lz = rng.range(-0.15, 0.15) * sh;
    const cx = h.x + lx;
    const cy = h.y + sh;
    const cz = h.z + lz;
    // the head: white with a faint warm/cool drift per head (the pocket's warm light does the
    // rest — a cream albedo rendered as beige), a touch darker underneath
    cream.setRGB(0.96 + rng.range(-0.03, 0.03), 0.96 + rng.range(-0.03, 0.02), 0.92 + rng.range(-0.04, 0.05));
    for (let i = 0; i < up.length; i += 3) {
      const nx = un[i];
      const ny = un[i + 1];
      const nz = un[i + 2];
      pos.push(cx + up[i] * r, cy + up[i + 1] * r * 0.72, cz + up[i + 2] * r);
      nrm.push(nx, ny, nz);
      const shade = 0.78 + 0.22 * (ny * 0.5 + 0.5);
      col.push(cream.r * shade, cream.g * shade, cream.b * shade);
    }
    // the stem: one thin vertical quad (two triangles), grass-deep
    const ang = rng.range(0, Math.PI);
    const w = 0.0022;
    const px = Math.cos(ang) * w;
    const pz = Math.sin(ang) * w;
    const quad = [
      [h.x - px, h.y, h.z - pz],
      [h.x + px, h.y, h.z + pz],
      [cx + px, cy - r * 0.5, cz + pz],
      [cx - px, cy - r * 0.5, cz - pz],
    ];
    for (const [a, b, c] of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      for (const q of [quad[a], quad[b], quad[c]]) {
        pos.push(q[0], q[1], q[2]);
        nrm.push(0, 0.7, 0.7);
        col.push(stem.r, stem.g, stem.b);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  mat.name = 'lawn-flowers';
  const mesh = new Mesh(g, mat);
  mesh.name = 'lawn-flowers';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return { mesh, triangles: pos.length / 9 };
}
