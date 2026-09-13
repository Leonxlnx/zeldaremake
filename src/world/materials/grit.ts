/**
 * Seam grit: the small stones (1.5–4 cm) packed into the dirt joints between the flagstones and
 * scattered at the stair feet (concept sheet 02 'Stone path': packed brown dirt seams with small
 * stones and a few grass blades). One flattened, noise-displaced icosahedron in the seam fill's
 * own tone; it is a sprout variant (sprouts.ts `GRIT`) so the pebbles ride in the joint-sprout
 * instanced sets — per-instance squash / yaw / ± 15 % tint, LOD-collapsed with the tufts — and
 * add no draw call of their own.
 */
import { Color, Float32BufferAttribute, IcosahedronGeometry, Vector3, type BufferGeometry } from 'three';
import type { Rng } from '../util/prng';


/**
 * the seam fill's vertex albedo at the damp noise's mean: soil.lerp(soilMid, 0.3). Each pebble
 * instance is then tinted by the fill shader's joint-width lift at its own spot
 * (joints.ts `jointFillLift`) and jittered ± 15 %, so it stays within ± 15 % of the fill it
 * sits on — relief in the seam, not pale specks on it.
 */
/** Grit tone from a seam's soil colours (the caller owns the soil palette; hardscape passes its joints). */
export function seamGritTone(soil: number | string | Color, soilMid: number | string | Color): Color {
  return new Color(soil).lerp(new Color(soilMid), 0.3);
}
/** Neutral fallback when no seam palette is given (mid grey-brown). */
export const DEFAULT_GRIT_TONE = new Color(0x8a7458);

export function buildGritGeometry(rng: Rng, tone: Color): BufferGeometry {
  // detail 0: 20 triangles — a 2–4 cm pebble is a handful of pixels even from camera E
  const g = new IcosahedronGeometry(1, 0);
  const pos = g.attributes.position;
  // welded displacement per unique direction, then a squash so the pebble lies flat
  const disp = new Map<string, number>();
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let d = disp.get(key);
    if (d === undefined) {
      d = rng.range(0.82, 1.14);
      disp.set(key, d);
    }
    v.multiplyScalar(d);
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  // smooth normals: the displaced shape is still star-convex around its centre
  const nrm = g.attributes.normal;
  const col: number[] = [];
  const wind: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.set(v.x, v.y / 0.62, v.z).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
    // a touch darker on the faces that lean down into the dirt
    const k = 0.94 + 0.08 * (v.y * 0.5 + 0.5);
    col.push(tone.r * k, tone.g * k, tone.b * k);
    wind.push(0, 0);
  }
  nrm.needsUpdate = true;
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('aWind', new Float32BufferAttribute(wind, 2));
  g.computeBoundingSphere();
  return g;
}
