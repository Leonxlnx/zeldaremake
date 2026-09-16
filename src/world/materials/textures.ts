/**
 * Texture library. All texture files live in /public/textures/<set>/ and are credited in
 * /public/textures/CREDITS.md (CC0 / original only — see GAUNTLET.md anti-cheat rules: no
 * reference-video frames or proprietary Nintendo assets may ever be loaded as textures).
 *
 * Loading is tolerant: a missing file yields a generated fallback so a half-finished branch
 * still renders and can be captured.
 */
import {
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  NoColorSpace,
} from 'three';

export type MapKind = 'color' | 'normal' | 'roughness' | 'ao' | 'height' | 'alpha';

export interface TextureLibrary {
  /** load `/textures/<set>/<kind>.jpg|png`; cached; returns fallback on failure */
  load(set: string, kind: MapKind, opts?: { repeat?: number; anisotropy?: number }): Promise<Texture>;
  /** solid/noise fallback generated on a canvas */
  fallback(kind: MapKind, tint?: number): Texture;
  /** all sets that were actually loaded from disk (for the audit) */
  loaded(): string[];
  /** sets that fell back (surfaces the gap in the gauntlet report) */
  missing(): string[];
}

const EXT_ORDER = ['jpg', 'png', 'webp'];

export function createTextureLibrary(maxAnisotropy = 8): TextureLibrary {
  const loader = new TextureLoader();
  const cache = new Map<string, Promise<Texture>>();
  const fallbacks = new Map<string, Texture>();
  const loadedSets = new Set<string>();
  const missingSets = new Set<string>();

  const fallback = (kind: MapKind, tint = 0x808080) => {
    const key = `${kind}:${tint}`;
    const cached = fallbacks.get(key);
    if (cached) return cached;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d')!;
    const c = new Color(tint);
    if (kind === 'normal') {
      g.fillStyle = 'rgb(128,128,255)';
      g.fillRect(0, 0, size, size);
    } else if (kind === 'roughness') {
      g.fillStyle = 'rgb(200,200,200)';
      g.fillRect(0, 0, size, size);
    } else if (kind === 'ao' || kind === 'alpha') {
      g.fillStyle = 'white';
      g.fillRect(0, 0, size, size);
    } else if (kind === 'height') {
      g.fillStyle = 'rgb(128,128,128)';
      g.fillRect(0, 0, size, size);
    } else {
      // colour: mild noise so a fallback surface is not a dead flat
      const img = g.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        const n = 0.85 + 0.3 * Math.sin(i * 12.9898) * Math.cos(i * 0.233);
        img.data[i * 4] = Math.min(255, c.r * 255 * n);
        img.data[i * 4 + 1] = Math.min(255, c.g * 255 * n);
        img.data[i * 4 + 2] = Math.min(255, c.b * 255 * n);
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.colorSpace = kind === 'color' ? SRGBColorSpace : NoColorSpace;
    tex.name = `fallback:${key}`;
    fallbacks.set(key, tex);
    return tex;
  };

  const tryLoad = (url: string) =>
    new Promise<Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

  const load: TextureLibrary['load'] = (set, kind, opts) => {
    const key = `${set}/${kind}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const p = (async () => {
      for (const ext of EXT_ORDER) {
        try {
          const tex = await tryLoad(`${import.meta.env.BASE_URL}textures/${set}/${kind}.${ext}`);
          tex.wrapS = tex.wrapT = RepeatWrapping;
          tex.colorSpace = kind === 'color' ? SRGBColorSpace : NoColorSpace;
          tex.anisotropy = Math.min(maxAnisotropy, opts?.anisotropy ?? 8);
          tex.minFilter = LinearMipmapLinearFilter;
          tex.magFilter = LinearFilter;
          tex.generateMipmaps = true;
          if (opts?.repeat) tex.repeat.set(opts.repeat, opts.repeat);
          tex.name = key;
          loadedSets.add(set);
          return tex;
        } catch {
          // try next extension
        }
      }
      missingSets.add(set);
      const fb = fallback(kind);
      if (opts?.repeat) fb.repeat.set(opts.repeat, opts.repeat);
      return fb;
    })();
    cache.set(key, p);
    return p;
  };

  return {
    load,
    fallback,
    loaded: () => [...loadedSets].sort(),
    missing: () => [...missingSets].sort(),
  };
}
