/** Original wood relief beneath the existing painted shield; no baked lighting. */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial } from 'three';
import { shieldTexture } from './palette';

const SIZE = 512, TAU = Math.PI * 2;
let cached: MeshStandardMaterial | undefined;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** The existing canvas spiral, in its original top-left image coordinates.
 * This mask controls thin paint film/roughness only; its color pixels stay untouched. */
function paintedArea(): Float32Array {
  const mask = new Float32Array(SIZE * SIZE), scale = SIZE / 256;
  let previousX = 128, previousY = 128 - 3 * 1.04;
  for (let segment = 1; segment <= 200; segment++) {
    const t = segment / 200, angle = t * 2.05 * TAU - Math.PI / 2;
    const radius = 3 + 93 * Math.pow(t, 1.15);
    const x = 128 + Math.cos(angle) * radius, y = 128 + Math.sin(angle) * radius * 1.04;
    const ax = previousX * scale, ay = previousY * scale, bx = x * scale, by = y * scale;
    const dx = bx - ax, dy = by - ay, lengthSquared = dx * dx + dy * dy;
    const halfWidth = (16 + 18 * t) * scale / 2;
    const lowX = Math.max(0, Math.floor(Math.min(ax, bx) - halfWidth - 1));
    const highX = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx) + halfWidth + 1));
    const lowY = Math.max(0, Math.floor(Math.min(ay, by) - halfWidth - 1));
    const highY = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by) + halfWidth + 1));
    for (let iy = lowY; iy <= highY; iy++) for (let ix = lowX; ix <= highX; ix++) {
      const along = clamp(((ix + .5 - ax) * dx + (iy + .5 - ay) * dy) / lengthSquared, 0, 1);
      const distance = Math.hypot(ix + .5 - ax - along * dx, iy + .5 - ay - along * dy);
      const alpha = clamp(halfWidth + .5 - distance, 0, 1);
      const index = iy * SIZE + ix;
      mask[index] = Math.max(mask[index], alpha);
    }
    previousX = x; previousY = y;
  }
  return mask;
}

/** Shared once across Link actors. Geometry, UVs, paint colors and light response
 * remain conventional: R is bump height and G is material roughness. */
export function createLinkShieldMaterial(): MeshStandardMaterial {
  if (cached) return cached;
  const painted = paintedArea(), bytes = new Uint8Array(SIZE * SIZE * 4);
  for (let row = 0; row < SIZE; row++) for (let column = 0; column < SIZE; column++) {
    const u = (column + .5) / SIZE, v = (row + .5) / SIZE;
    // Grain follows the upright planks. Two small knot fields bend its fibres
    // without adding large circular rings or changing the carved plank joins.
    const knot = (x: number, y: number, width: number, height: number) =>
      Math.exp(-(((u - x) / width) ** 2 + ((v - y) / height) ** 2));
    const bend = .032 * knot(.22, .68, .075, .105) - .022 * knot(.78, .30, .060, .080);
    const across = u + bend + .004 * Math.sin(TAU * (1.4 * v + .2 * u))
      + .0014 * Math.sin(TAU * (5 * v - .3 * u));
    const broad = .5 + .5 * Math.sin(TAU * (43 * across + .12 * Math.sin(TAU * v)));
    const fibre = .5 + .5 * Math.sin(TAU * (116 * across + .18 * Math.sin(TAU * (3 * v + u))));
    const pores = Math.pow(.5 + .5 * Math.sin(TAU * (73 * across + .12 * v)), 2);
    // DataTexture's first row is the bottom; the preserved canvas map flips Y.
    const paint = painted[(SIZE - 1 - row) * SIZE + column];
    const grain = .14 * (broad - .5) + .20 * (fibre - .5) - .15 * pores;
    const height = clamp(.48 + grain * (1 - .55 * paint) + .10 * paint, 0, 1);
    const roughness = clamp(.97 - .14 * paint + .025 * (1 - fibre), .80, 1);
    const at = (row * SIZE + column) * 4;
    bytes[at] = Math.round(255 * height);
    bytes[at + 1] = Math.round(255 * roughness);
    bytes[at + 2] = bytes[at + 3] = 255;
  }
  const surface = new DataTexture(bytes, SIZE, SIZE);
  surface.name = 'original-link-shield-wood-height-roughness';
  surface.generateMipmaps = true; surface.minFilter = LinearMipmapLinearFilter;
  surface.magFilter = LinearFilter; surface.needsUpdate = true;
  cached = new MeshStandardMaterial({ map: shieldTexture(), color: 0xffffff,
    roughness: .95, metalness: 0, bumpMap: surface, bumpScale: .00022,
    roughnessMap: surface });
  cached.name = 'char-shield-carved-wood';
  return cached;
}
