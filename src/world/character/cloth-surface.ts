/** Original woven cloth, generated in linear reflectance rather than painted lighting. */
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, LinearSRGBColorSpace, RepeatWrapping } from 'three';

export interface LinkClothSurface {
  albedo: DataTexture;
  /** R is fibre height; G is roughness, matching Three's material channels. */
  surface: DataTexture;
  /** Compensate the quantized linear albedo mean without changing the palette's hue. */
  albedoMean: number;
}

export const LINK_CLOTH_YARNS = 64;
export const LINK_CLOTH_TILE_METRES = .0768;

/** A 76.8 mm repeating tile: 64 yarns at a nominal 1.2 mm spacing. */
export function createLinkClothSurface(): LinkClothSurface {
  const size = 256, yarns = LINK_CLOTH_YARNS, tau = Math.PI * 2;
  const pigment = new Uint8Array(size * size * 4);
  const surface = new Uint8Array(pigment.length);
  let pigmentSum = 0;
  const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
  const hash = (x: number, y: number, salt: number) => {
    const ix = ((x % yarns) + yarns) % yarns, iy = ((y % yarns) + yarns) % yarns;
    return ((ix * 37 + iy * 53 + ix * iy * 11 + salt * 29) % 251) / 250;
  };
  // Smooth fibre-dye variation over 6.4 mm patches; periodic at the tile edges.
  // The cloth's geometry and real lights still provide every fold and shadow.
  const fibrePatch = (u: number, v: number) => {
    const cells = 12, x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const sx = smooth(x - ix), sy = smooth(y - iy);
    const value = (a: number, b: number) => hash((a + cells) % cells, (b + cells) % cells, 7);
    const low = value(ix, iy) * (1 - sx) + value(ix + 1, iy) * sx;
    const high = value(ix, iy + 1) * (1 - sx) + value(ix + 1, iy + 1) * sx;
    return low * (1 - sy) + high * sy;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    // Gentle periodic wander gives the yarns an uneven hand-woven alignment.
    const a = u * yarns + .075 * Math.sin(tau * (3 * v + .06 * Math.sin(tau * u)));
    const b = v * yarns + .065 * Math.sin(tau * (2 * u + .05 * Math.sin(tau * v)));
    const column = Math.floor(a), row = Math.floor(b);
    const ax = a - column, by = b - row;
    const warp = Math.exp(-(((ax - .5) / .34) ** 4));
    const weft = Math.exp(-(((by - .5) / .34) ** 4));
    const warpOver = ((column + row) & 1) === 0;
    const top = warpOver ? warp : weft, under = warpOver ? weft : warp;
    const relief = .18 + .55 * top + .13 * under * (1 - top);
    const irregular = hash(column, row, 3) - .5;
    // Broad fibre variation remains small; geometry supplies folds and scene lighting.
    const broad = .50 + .24 * Math.sin(tau * (2 * u + v) + .7)
      + .16 * Math.sin(tau * (u - 3 * v) + 1.4)
      + .10 * Math.sin(tau * (5 * u + 2 * v) - .4);
    const reflected = clamp(.78 + .18 * (top - .5) + .34 * (fibrePatch(u, v) - .5)
      + .10 * (broad - .5) + .060 * irregular, .62, .995);
    const roughness = clamp(.98 - .035 * top + .012 * (broad - .5) + .014 * irregular, .92, .995);
    const i = (y * size + x) * 4, value = Math.round(255 * reflected);
    pigment[i] = pigment[i + 1] = pigment[i + 2] = value; pigment[i + 3] = 255;
    surface[i] = Math.round(255 * relief);
    surface[i + 1] = Math.round(255 * roughness);
    surface[i + 2] = 255; surface[i + 3] = 255;
    pigmentSum += value;
  }
  const texture = (data: Uint8Array, name: string) => {
    const result = new DataTexture(data, size, size);
    result.name = name;
    result.wrapS = result.wrapT = RepeatWrapping;
    result.generateMipmaps = true;
    result.minFilter = LinearMipmapLinearFilter; result.magFilter = LinearFilter;
    result.needsUpdate = true;
    return result;
  };
  const albedo = texture(pigment, 'original-link-woven-cloth-albedo');
  albedo.colorSpace = LinearSRGBColorSpace;
  return {
    albedo,
    surface: texture(surface, 'original-link-woven-cloth-height-roughness'),
    albedoMean: pigmentSum / (size * size * 255),
  };
}
