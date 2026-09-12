/** Original Link hair pigment and fibre relief. No light, view or scene inputs. */
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, LinearSRGBColorSpace, RepeatWrapping } from 'three';

/** U follows growth; V crosses each bundle. Shared with the geometry's UV metric. */
export const LINK_HAIR_TILE_METRES = { u: .160, v: .064 } as const;
export const LINK_HAIR_GROUPS = 16;
export const LINK_HAIR_FIBRES = 80;

export interface LinkHairSurface {
  albedo: DataTexture;
  /** R is fibre height, G is roughness. Both are linear data. */
  surface: DataTexture;
}

/** A continuous periodic pigment field; exported so seam tests exercise the actual formula. */
export function sampleLinkHairSurface(u: number, v: number): { tone: number; height: number; roughness: number } {
  const tau = Math.PI * 2, groups = LINK_HAIR_GROUPS;
  const wrap = (x: number, period: number) => ((x % period) + period) % period;
  const hash = (i: number, salt: number) => {
    const n = wrap(i, groups);
    return ((n * 37 + n * n * 11 + salt * 53) % 101) / 100;
  };
  const x = wrap(u, 1), y = wrap(v, 1) * groups, cell = Math.floor(y);
  let pigment = 0, weight = 0;
  for (let j = cell - 2; j <= cell + 2; j++) {
    const phase = tau * hash(j, 2);
    const centre = j + .5 + .24 * (hash(j, 1) - .5)
      + .13 * Math.sin(tau * x + phase) + .045 * Math.sin(2 * tau * x - phase);
    const span = .44 + .18 * hash(j, 3);
    const w = Math.exp(-(((y - centre) / span) ** 2));
    // Pigment varies between neighbouring groups and gradually along their growth.
    // There is deliberately no dark root, bright tip or painted highlight direction.
    const tone = .22 + .62 * hash(j, 4) + .075 * Math.sin(tau * x + tau * hash(j, 5));
    pigment += w * tone; weight += w;
  }
  const wander = .12 * Math.sin(tau * x + .65 * Math.sin(tau * y / groups));
  const fibrePhase = tau * (wrap(v, 1) * LINK_HAIR_FIBRES + wander);
  const fibre = .5 + .5 * Math.sin(fibrePhase);
  const secondary = .5 + .5 * Math.sin(fibrePhase * 2 + .35 * Math.sin(tau * x));
  return {
    tone: Math.max(0, Math.min(1, pigment / weight + .055 * (fibre - .5) + .020 * (secondary - .5))),
    height: .20 + .54 * fibre + .10 * secondary,
    roughness: .82 + .035 * (pigment / weight - .5) - .045 * (fibre - .5),
  };
}

export function createLinkHairSurface(): LinkHairSurface {
  const width = 256, height = 512;
  const albedo = new Uint8Array(width * height * 4), surface = new Uint8Array(albedo.length);
  // Honey brown through warm gold to pale gold: pigment, not baked strand shadows.
  const dark = new Color(0xa87930), middle = new Color(0xcea34e), pale = new Color(0xe9ca7c);
  const colour = new Color();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sample = sampleLinkHairSurface((x + .5) / width, (y + .5) / height), i = (y * width + x) * 4;
    if (sample.tone < .5) colour.copy(dark).lerp(middle, sample.tone * 2);
    else colour.copy(middle).lerp(pale, sample.tone * 2 - 1);
    albedo[i] = Math.round(colour.r * 255); albedo[i + 1] = Math.round(colour.g * 255);
    albedo[i + 2] = Math.round(colour.b * 255); albedo[i + 3] = 255;
    surface[i] = Math.round(sample.height * 255); surface[i + 1] = Math.round(sample.roughness * 255);
    surface[i + 2] = 255; surface[i + 3] = 255;
  }
  const texture = (data: Uint8Array, name: string) => {
    const result = new DataTexture(data, width, height);
    result.name = name; result.wrapS = result.wrapT = RepeatWrapping;
    result.generateMipmaps = true; result.minFilter = LinearMipmapLinearFilter;
    result.magFilter = LinearFilter; result.needsUpdate = true;
    return result;
  };
  const pigment = texture(albedo, 'original-link-grouped-gold-hair-pigment');
  pigment.colorSpace = LinearSRGBColorSpace;
  return { albedo: pigment, surface: texture(surface, 'original-link-hair-fibre-height-roughness') };
}
