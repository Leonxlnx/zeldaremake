/** Sign-owned finishes. Shared plank maps are borrowed; only the generated maps are disposed. */
import {
  ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter,
  MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Vector2, type Texture,
} from 'three';
import { applyShadeFloor, type ShadeFloor } from '../materials/shadeFloor';
import type { StructureMaterials } from './materials';

// The authored face is almost perpendicular to the sun. Keep most of its real textured albedo
// in the indirect floor, rather than raising emission or the already strong vertex colours.
const WOOD_FLOOR: ShadeFloor = { lift: 5.5, texture: 0.8, canopy: 0.65, albedo: 0.1, chroma: 0.9 };
const WOOD_BOUNCE = 0xc7b090;

function texture(data: Uint8Array, width: number, height: number, name: string, color: boolean, repeat = false) {
  const tex = new DataTexture(data, width, height);
  tex.name = `structures:sign-${name}`;
  tex.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = tex.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  // Rows below are authored top-to-bottom, as in the previous canvas atlas.
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

/** A shallow height field in metres, encoded as an OpenGL tangent-space normal. */
function normalMap(h: Float32Array, w: number, rows: number, metreW: number, metreH: number, repeat = false) {
  const pixels = new Uint8Array(w * rows * 4);
  const at = (x: number, y: number) => h[(repeat ? (y + rows) % rows : Math.max(0, Math.min(rows - 1, y))) * w
    + (repeat ? (x + w) % w : Math.max(0, Math.min(w - 1, x)))];
  for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) {
    const nx = -(at(x + 1, y) - at(x - 1, y)) / (2 * metreW / w);
    const ny = (at(x, y + 1) - at(x, y - 1)) / (2 * metreH / rows);
    const inv = 1 / Math.hypot(nx, ny, 1), i = (y * w + x) * 4;
    pixels[i] = Math.round((0.5 + 0.5 * nx * inv) * 255);
    pixels[i + 1] = Math.round((0.5 + 0.5 * ny * inv) * 255);
    pixels[i + 2] = Math.round((0.5 + 0.5 * inv) * 255);
    pixels[i + 3] = 255;
  }
  return pixels;
}

type Cut = readonly [number, number, number, number];
// Original hand-cut symbols: open angular stems, forks and hooks, not a font or copied alphabet.
// A symbol uses only two to four short cuts; narrow tapered ends avoid the old painted blobs.
const GLYPHS: readonly (readonly Cut[])[] = [
  [[-.7, 1, -.7, -1], [-.7, -1, .7, -.6], [.7, -.6, -.1, .1]],
  [[-.8, -.9, 0, 1], [0, 1, .8, -.9], [-.5, -.25, .5, -.25]],
  [[-.6, 1, -.6, -1], [-.6, -1, .7, -1], [-.6, 0, .5, 0]],
  [[-.7, -1, .7, -1], [.7, -1, -.4, 1], [-.4, 1, .6, .7]],
  [[-.7, 1, -.7, -1], [-.7, -1, .7, -.4], [.7, -.4, -.7, .2], [-.1, 0, .7, 1]],
  [[-.7, -.9, 0, -.25], [0, -.25, .7, -.9], [0, -.25, -.1, 1]],
  [[-.7, -.9, .7, -.9], [0, -.9, 0, 1], [-.5, .3, .5, .1]],
  [[-.6, -1, -.6, 1], [-.6, 1, .7, .7], [.7, .7, .7, -.3]],
  [[-.7, 0, 0, -1], [0, -1, .7, 0], [.7, 0, -.7, 0], [0, 0, 0, 1]],
  [[-.7, -1, -.7, 1], [-.7, -.1, .7, -.7], [-.7, -.1, .7, 1]],
  [[-.7, -.8, .7, -1], [.7, -1, .4, 1], [.4, 1, -.7, .7]],
];

function carvedMarks() {
  const W = 512, H = 192, cellW = W * 0.86 / 11, cellH = H * 0.72 / 2;
  const cover = new Float32Array(W * H), depth = new Float32Array(W * H);
  for (let row = 0; row < 2; row++) for (let col = 0; col < (row === 0 ? 11 : 8); col++) {
    // Exactly the previous atlas's 11/8 centres and scale; no random draws are consumed.
    const cx = W * 0.07 + (col + 0.5 + (row === 1 ? 1.5 : 0)) * cellW;
    const cy = H * 0.14 + (row + 0.5) * cellH;
    const hw = cellW * 0.32, hh = cellH * 0.36;
    const cuts = GLYPHS[(col + row * 4) % GLYPHS.length];
    for (let s = 0; s < cuts.length; s++) {
      const [u0, v0, u1, v1] = cuts[s];
      const ax = cx + u0 * hw, ay = cy + v0 * hh, bx = cx + u1 * hw, by = cy + v1 * hh;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      // Actual d7 S02 reduced the old 2.7–3.38 px cuts to near-pixel hairlines. These stay
      // below 5 px at atlas scale, retaining their open counters and tapered chisel ends.
      const halfW = 2.1 + ((col + s * 2 + row) % 3) * 0.18;
      for (let y = Math.floor(Math.min(ay, by) - 3); y <= Math.ceil(Math.max(ay, by) + 3); y++) {
        for (let x = Math.floor(Math.min(ax, bx) - 3); x <= Math.ceil(Math.max(ax, bx) + 3); x++) {
          const t = ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len2;
          if (t < 0 || t > 1) continue; // chisel-cut ends, not round caps
          const d = Math.abs((x + 0.5 - ax) * dy - (y + 0.5 - ay) * dx) / Math.sqrt(len2);
          const radius = halfW * (0.65 + 0.35 * Math.sin(Math.PI * t));
          const i = y * W + x;
          cover[i] = Math.max(cover[i], Math.min(1, Math.max(0, radius + 0.5 - d)));
          // Less than half a millimetre of V-groove relief; no displacement of the decal.
          depth[i] = Math.min(depth[i], -0.00045 * Math.max(0, 1 - d / radius));
        }
      }
    }
  }
  const pixels = new Uint8Array(W * H * 4);
  for (let i = 0; i < cover.length; i++) {
    const rim = 1 + depth[i] / 0.00045;
    // Keep the dark narrow cut bottom; the exposed side faces retain more wood albedo.
    // Both sides share this depth-based tint: only real lighting chooses the brighter face.
    pixels[i * 4] = Math.round(48 + 78 * rim);
    pixels[i * 4 + 1] = Math.round(31 + 63 * rim);
    pixels[i * 4 + 2] = Math.round(18 + 42 * rim);
    pixels[i * 4 + 3] = Math.round(cover[i] * 255);
  }
  return [texture(pixels, W, H, 'carved-marks', true),
    texture(normalMap(depth, W, H, 0.98 * 0.9, 0.44 * 0.8), W, H, 'groove-normal', false)] as const;
}

function bindingMaps() {
  const W = 64, H = 128, pixels = new Uint8Array(W * H * 4), heights = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const strand = Math.cos(Math.PI * 2 * (3 * u - 3 * v));
    const fibre = Math.sin(Math.PI * 2 * (23 * u - 12 * v));
    const i = y * W + x, tone = 0.86 + 0.08 * strand + 0.06 * fibre;
    heights[i] = 0.00012 * strand + 0.000025 * fibre;
    pixels[i * 4] = Math.round(208 * tone);
    pixels[i * 4 + 1] = Math.round(202 * tone);
    pixels[i * 4 + 2] = Math.round(182 * tone);
    pixels[i * 4 + 3] = 255;
  }
  return [texture(pixels, W, H, 'binding-fibres', true, true),
    texture(normalMap(heights, W, H, 0.12, 0.12, true), W, H, 'binding-normal', false, true)] as const;
}

export function createSignMaterials(mats: StructureMaterials) {
  const wood = mats.wood.clone();
  wood.name = 'sign-weathered-wood';
  applyShadeFloor(wood, WOOD_FLOOR, WOOD_BOUNCE);

  const [marks, groove] = carvedMarks();
  // The encoded 0.45 mm profile at scale 2.5 gives a 1.125 mm shallow V cut in 55 mm wood.
  // Keep the readable 7.2–8.5 mm stroke width; no displacement/parallax is implied.
  const runes = new MeshStandardMaterial({
    name: 'sign-carved-marks', map: marks, normalMap: groove, normalScale: new Vector2(2.5, 2.5), roughness: 1,
    transparent: true, alphaTest: 0.08, depthWrite: false,
  });
  // A weaker cavity floor lets the cut normals respond to the existing directional light.
  applyShadeFloor(runes, { ...WOOD_FLOOR, lift: 1.4, texture: 1 }, WOOD_BOUNCE);

  const [fibres, fibreNormal] = bindingMaps();
  const binding = new MeshStandardMaterial({
    name: 'sign-fibre-binding', map: fibres, normalMap: fibreNormal, roughness: 1,
    // The old plank-coloured vertex data stays intact, but this material supplies neutral flax.
    vertexColors: false, color: 0xb8b3a1,
  });
  applyShadeFloor(binding, { ...WOOD_FLOOR, lift: 2.2, texture: 1 }, WOOD_BOUNCE);

  const ownedMaps: readonly Texture[] = [marks, groove, fibres, fibreNormal];
  let disposed = false;
  return {
    wood, runes, binding,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const material of [wood, runes, binding]) material.dispose();
      for (const map of ownedMaps) map.dispose();
      // mats.wood's borrowed PBR maps and mats.runes remain owned by their original providers.
    },
  };
}
