/** Original tiled pebble grain for explicitly opted-in Link leather materials. */
import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, LinearSRGBColorSpace,
  MeshStandardMaterial, RepeatWrapping,
} from 'three';

/** A 24 mm tile with sixteen irregular cells across: about 1.5 mm per pebble. */
export const LINK_LEATHER_TILE_METRES = .024;
const SIZE = 256, CELLS = 16, TAU = Math.PI * 2;
type Grain = { colour: number; roughness: number; height: number };
type Pixels = { colour: Uint8Array; roughness: Uint8Array; height: Uint8Array };
let pixels: Pixels | undefined;

const wrap = (value: number, period: number) => ((value % period) + period) % period;
const smooth = (low: number, high: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

/** Local integer hash; no generator state and no use of Math.random. */
function cellHash(x: number, y: number, salt: number): number {
  let h = Math.imul(wrap(x, CELLS) + 1, 0x45d9f3b)
    ^ Math.imul(wrap(y, CELLS) + 1, 0x27d4eb2d) ^ Math.imul(salt, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/** Periodic warped Voronoi cells: recessed borders and gently rounded worn tops. */
function grainAt(u: number, v: number): Grain {
  u = wrap(u, 1); v = wrap(v, 1);
  const x = u * CELLS + .14 * Math.sin(TAU * (3 * v + u)),
    y = v * CELLS + .12 * Math.sin(TAU * (2 * u - v));
  let nearest = Infinity, second = Infinity;
  let ax = 0, ay = 0, bx = 0, by = 0, pigment = 0;
  // Two rings keep both nearest sites available through the periodic warp.
  for (let j = Math.floor(y) - 2; j <= Math.floor(y) + 2; j++) {
    for (let i = Math.floor(x) - 2; i <= Math.floor(x) + 2; i++) {
      const px = i + .5 + .56 * (cellHash(i, j, 1) - .5),
        py = j + .5 + .56 * (cellHash(i, j, 2) - .5);
      const distance = (x - px) ** 2 + (y - py) ** 2;
      if (distance < nearest) {
        second = nearest; bx = ax; by = ay;
        nearest = distance; ax = px; ay = py; pigment = cellHash(i, j, 3);
      } else if (distance < second) {
        second = distance; bx = px; by = py;
      }
    }
  }
  const border = (second - nearest) / (2 * Math.hypot(ax - bx, ay - by));
  const top = smooth(.015, .17, border);
  const dome = 1 - smooth(.12, .78, Math.sqrt(nearest));
  const broad = .5 + .25 * Math.sin(TAU * (2 * u + 3 * v))
    + .25 * Math.sin(TAU * (3 * u - 2 * v));
  return {
    // Pigment stays close to the base on worn cell tops; narrow creases retain
    // darker dye. This is neutral albedo variation, never directional lighting.
    colour: .985 + .010 * broad + .005 * pigment - .120 * (1 - top),
    roughness: .950 + .050 * (1 - top) - .090 * dome,
    height: .15 + .68 * top * (.72 + .28 * dome),
  };
}

function grainPixels(): Pixels {
  if (pixels) return pixels;
  const result = {
    colour: new Uint8Array(SIZE * SIZE * 4),
    roughness: new Uint8Array(SIZE * SIZE * 4),
    height: new Uint8Array(SIZE * SIZE * 4),
  };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const sample = grainAt((x + .5) / SIZE, (y + .5) / SIZE), offset = (y * SIZE + x) * 4;
    for (const key of ['colour', 'roughness', 'height'] as const) {
      const value = Math.round(255 * sample[key]);
      result[key][offset] = result[key][offset + 1] = result[key][offset + 2] = value;
      result[key][offset + 3] = 255;
    }
  }
  pixels = result;
  return result;
}

/**
 * Clone an existing untextured leather material; never mutate palette/NPC materials.
 * uvMetres is the measured surface distance covered by one U/V unit. Pick an integer
 * U repeat for a closed wrap (e.g. pack [.576, .480], belt [.696, .096]). Mesh UVs,
 * colour, opacity, roughness scalar and other material settings remain unchanged.
 * The caller owns this clone and its three textures. Assign only to reviewed meshes:
 * boot/cuff wraps require their articulation UV repair, and tongues use an
 * arc-length map. Fitted shoulder straps still need separate UV repair.
 */
export function createLinkLeatherMaterial(
  base: MeshStandardMaterial, uvMetres: readonly [number, number],
): MeshStandardMaterial {
  if (uvMetres.some(value => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError('Link leather requires positive finite metres per UV unit');
  }
  if (base.map || base.roughnessMap || base.bumpMap || base.normalMap) {
    throw new Error('Link leather grain must opt in from an untextured material');
  }
  const data = grainPixels();
  const make = (key: keyof Pixels) => {
    const texture = new DataTexture(data[key], SIZE, SIZE);
    texture.name = `original-link-leather-${key}`;
    if (key === 'colour') texture.colorSpace = LinearSRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(uvMetres[0] / LINK_LEATHER_TILE_METRES, uvMetres[1] / LINK_LEATHER_TILE_METRES);
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter; texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };
  const material = base.clone();
  material.name = `${base.name}-link-leather-grain`;
  material.map = make('colour');
  material.roughnessMap = make('roughness');
  material.bumpMap = make('height');
  // The encoded height span makes this about .355 mm peak to valley, not .52 mm.
  material.bumpScale = .00052;
  return material;
}
