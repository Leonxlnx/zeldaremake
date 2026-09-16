/**
 * Texture library. All texture files live in /public/textures/<set>/ and are credited in
 * /public/textures/CREDITS.md (CC0 / original only — see GAUNTLET.md anti-cheat rules: no
 * reference-video frames or proprietary Nintendo assets may ever be loaded as textures).
 *
 * Every set ships at 1K (`<set>/<kind>.jpg`) and 2K (`<set>/2k/<kind>.jpg`, same Poly Haven
 * asset re-encoded, so colour statistics are identical). Which one a load() picks depends on the
 * quality tier — see `resolutionFor` — and a missing 2K file silently falls back to the 1K one.
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
export type TextureTier = 'low' | 'medium' | 'high' | 'ultra';
export type TextureResolution = '1k' | '2k';

export interface TextureMapReport {
  set: string;
  kind: MapKind;
  /** resolution the tier rule asked for */
  requested: TextureResolution;
  /** resolution actually loaded (`1k` when the 2K file was missing; `fallback` when neither loaded) */
  loaded: TextureResolution | 'fallback';
  width: number;
  height: number;
  anisotropy: number;
  /** estimated GPU bytes: w × h × 4 × 1.33 (RGBA8 + mip chain) */
  bytes: number;
}

export interface TextureLibraryReport {
  tier: TextureTier;
  maxAnisotropy: number;
  /** 2K anisotropy actually applied (device max, capped at 16) */
  anisotropy2k: number;
  heroSets: string[];
  maps: TextureMapReport[];
  /** per set: resolution of its loaded maps, e.g. "color:2k normal:2k roughness:1k" */
  sets: Record<string, string>;
  /** loaded maps that asked for 2K and got the 1K file */
  fallback2k: string[];
  /** estimated GPU texture memory (MB) of the maps this library has loaded */
  loadedMB: number;
  /** what the same set of loaded maps would cost (MB) under every tier's rule */
  estimateMB: Record<TextureTier, number>;
}

export interface TextureLibrary {
  /** quality tier the library was created for (decides 1K vs 2K per set/kind) */
  readonly tier: TextureTier;
  /** load `/textures/<set>/[2k/]<kind>.jpg|png`; cached; returns fallback on failure */
  load(set: string, kind: MapKind, opts?: { repeat?: number; anisotropy?: number }): Promise<Texture>;
  /** solid/noise fallback generated on a canvas */
  fallback(kind: MapKind, tint?: number): Texture;
  /** all sets that were actually loaded from disk (for the audit) */
  loaded(): string[];
  /** sets that fell back (surfaces the gap in the gauntlet report) */
  missing(): string[];
  /** tier, per-map resolution and the GPU memory estimate (for the `textures` audit) */
  report(): TextureLibraryReport;
}

const EXT_ORDER = ['jpg', 'png', 'webp'];

/**
 * Sets the hero cameras get within a few metres of: the giant boles (tree_bark_03), the house
 * trunks and the log arch (bark_brown_02), the hero boulders, the flagstone/stair stone, the
 * mossy dome roofs and the ground layers under the camera (grass, path gravel, leaf litter — the
 * litter also fills the flagstone joints). From the `high` tier up their colour and normal maps
 * load at 2K; roughness/ao stay 1K there (low-frequency, not what limits resolvable detail).
 * Soil, moss, cliff rock, willow branches and planks are mid-distance in every hero view and
 * stay 1K until `ultra`, where every map of every set is 2K. Budget (w×h×4×1.33 per map, 33
 * maps loaded): low/medium ≈ 184 MB, high ≈ 435 MB (15 maps at 2K), ultra ≈ 736 MB.
 */
export const HERO_SETS: ReadonlySet<string> = new Set([
  'tree_bark_03',
  'bark_brown_02',
  'rock_boulder_cracked',
  'worn_rock_natural_01',
  'thatch_roof_angled',
  'leafy_grass',
  'rocky_trail',
  'brown_mud_leaves_01',
]);

/** map kinds promoted to 2K on `high` (every kind is 2K on `ultra`) */
export const HERO_KINDS: ReadonlySet<MapKind> = new Set(['color', 'normal']);

/** anisotropy applied to 2K maps: the device maximum, capped at 16 */
export const ANISOTROPY_2K = 16;

/** The tier rule: which resolution `load(set, kind)` asks for under `tier`. */
export function resolutionFor(tier: TextureTier, set: string, kind: MapKind): TextureResolution {
  if (tier === 'ultra') return '2k';
  if (tier === 'high' && HERO_SETS.has(set) && HERO_KINDS.has(kind)) return '2k';
  return '1k';
}

const TIERS: TextureTier[] = ['low', 'medium', 'high', 'ultra'];
const MIP_FACTOR = 1.33;
const bytesFor = (w: number, h: number) => Math.round(w * h * 4 * MIP_FACTOR);

export function createTextureLibrary(maxAnisotropy = 8, tier: TextureTier = 'high'): TextureLibrary {
  const loader = new TextureLoader();
  const cache = new Map<string, Promise<Texture>>();
  const fallbacks = new Map<string, Texture>();
  const loadedSets = new Set<string>();
  const missingSets = new Set<string>();
  const reports = new Map<string, TextureMapReport>();
  const anisotropy2k = Math.min(maxAnisotropy, ANISOTROPY_2K);

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

  const imageSize = (tex: Texture): [number, number] => {
    const img = tex.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined;
    return [img?.naturalWidth || img?.width || 0, img?.naturalHeight || img?.height || 0];
  };

  const load: TextureLibrary['load'] = (set, kind, opts) => {
    const key = `${set}/${kind}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const requested = resolutionFor(tier, set, kind);
    const p = (async () => {
      // 2K first when the tier asks for it, then the 1K files: a missing 2K map is never a failure
      const candidates: { res: TextureResolution; url: string }[] = [];
      const base = `${import.meta.env.BASE_URL}textures/${set}/`;
      if (requested === '2k') for (const ext of EXT_ORDER) candidates.push({ res: '2k', url: `${base}2k/${kind}.${ext}` });
      for (const ext of EXT_ORDER) candidates.push({ res: '1k', url: `${base}${kind}.${ext}` });
      for (const { res, url } of candidates) {
        try {
          const tex = await tryLoad(url);
          tex.wrapS = tex.wrapT = RepeatWrapping;
          tex.colorSpace = kind === 'color' ? SRGBColorSpace : NoColorSpace;
          // 2K maps get the device maximum (≤ 16) so the extra texels survive grazing angles;
          // 1K keeps the caller's request (default 8) exactly as before
          tex.anisotropy = res === '2k' ? anisotropy2k : Math.min(maxAnisotropy, opts?.anisotropy ?? 8);
          tex.minFilter = LinearMipmapLinearFilter;
          tex.magFilter = LinearFilter;
          tex.generateMipmaps = true;
          if (opts?.repeat) tex.repeat.set(opts.repeat, opts.repeat);
          tex.name = key;
          tex.userData.resolution = res;
          loadedSets.add(set);
          const [w, h] = imageSize(tex);
          reports.set(key, { set, kind, requested, loaded: res, width: w, height: h, anisotropy: tex.anisotropy, bytes: bytesFor(w, h) });
          return tex;
        } catch {
          // try the next candidate
        }
      }
      missingSets.add(set);
      reports.set(key, { set, kind, requested, loaded: 'fallback', width: 64, height: 64, anisotropy: 1, bytes: bytesFor(64, 64) });
      const fb = fallback(kind);
      if (opts?.repeat) fb.repeat.set(opts.repeat, opts.repeat);
      return fb;
    })();
    cache.set(key, p);
    return p;
  };

  const report = (): TextureLibraryReport => {
    const maps = [...reports.values()].sort((a, b) => (a.set + a.kind).localeCompare(b.set + b.kind));
    const sets: Record<string, string> = {};
    for (const m of maps) sets[m.set] = `${sets[m.set] ? `${sets[m.set]} ` : ''}${m.kind}:${m.loaded}`;
    const toMB = (b: number) => Number((b / 1048576).toFixed(1));
    // what this same list of maps would cost under each tier (assuming every 2K file exists);
    // a fallback map counts what its 1K file would cost, so the tiers compare like for like
    const estimate = {} as Record<TextureTier, number>;
    for (const t of TIERS) {
      let bytes = 0;
      for (const m of maps) {
        const res = resolutionFor(t, m.set, m.kind);
        const side = m.loaded === 'fallback' ? 1024 : m.loaded === '2k' ? m.width / 2 : m.width;
        bytes += res === '2k' ? bytesFor(side * 2, side * 2) : bytesFor(side, side);
      }
      estimate[t] = toMB(bytes);
    }
    return {
      tier,
      maxAnisotropy,
      anisotropy2k,
      heroSets: [...HERO_SETS].sort(),
      maps,
      sets,
      fallback2k: maps.filter((m) => m.requested === '2k' && m.loaded === '1k').map((m) => `${m.set}/${m.kind}`),
      loadedMB: toMB(maps.reduce((s, m) => s + m.bytes, 0)),
      estimateMB: estimate,
    };
  };

  return {
    tier,
    load,
    fallback,
    loaded: () => [...loadedSets].sort(),
    missing: () => [...missingSets].sort(),
    report,
  };
}
