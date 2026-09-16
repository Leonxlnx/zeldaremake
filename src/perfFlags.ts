/**
 * Performance flags and the auto-quality governor (round 38, perf-2).
 *
 * ONE place parses the render-cost URL parameters, so a trace carries its configuration and a
 * flag means the same thing to every system:
 *
 *   fx=off|noao|norays|nobloom|nosoft   composer stages off (comma list; `off` = all four)
 *   shadow=<mapSize>[,<pcssTaps>]       sun shadow map size in texels (0 = shadow maps off) and the
 *                                       PCSS filter tap count (the blocker search takes 2/3 of it)
 *   veg=<lodScale>[,<grassDensity>]     0..1 multipliers on the vegetation LOD distances and on the
 *                                       share of each grass tile's blades that is drawn
 *   scale=<renderScale>                 0.5..1 multiplier on the renderer's pixel ratio (every
 *                                       composer target follows the drawing buffer)
 *   quality=auto                        the governor below steps a tier ladder from the frame time
 *
 * Every flag defaults to the current behaviour: with no parameters the runtime state below is the
 * one the systems already had, and the six fixed captures stay byte-identical (W41). Under a
 * headless capture the governor never runs (the capture is fixed high; `governor=1` lets the
 * perftrace harness enable it explicitly — it is a trace, not a capture).
 *
 * Systems read the LIVE state through `perfRuntime()` (or `globalThis.__KF_PERF__`, the same object,
 * for a module that must stay free of imports); the governor mutates that object and bumps its
 * `version`, and a consumer re-applies when the version differs from the one it last saw.
 */
import { WORLD } from './world/config';

export interface FxStages {
  ao: boolean;
  rays: boolean;
  bloom: boolean;
  soft: boolean;
}

export interface PerfSettings {
  fx: FxStages;
  /** sun shadow map size (texels); 0 = shadow maps off */
  shadowMapSize: number;
  /** PCSS filter taps (lighting/shadowfilter.ts; 12 as shipped) */
  shadowTaps: number;
  /** multiplier on the vegetation LOD distances (grass tiles and the plant sets) */
  vegLodScale: number;
  /** share (0..1) of each grass tile's blades that is drawn */
  grassDensity: number;
  /** multiplier on the renderer's pixel ratio */
  renderScale: number;
}

export interface PerfFlags extends PerfSettings {
  /** `?quality=auto` */
  auto: boolean;
  /** the governor may run: auto, and not a headless capture unless `governor=1` */
  governor: boolean;
  /** the flags given on the URL, as given (empty when everything is at its default) */
  active: Record<string, string>;
}

/** the live state every system reads; the governor writes it */
export interface PerfRuntime extends PerfSettings {
  /** incremented on every change */
  version: number;
  /** `high` (fixed) or the governor's current rung, e.g. `auto:2` */
  tier: string;
}

export const DEFAULT_SHADOW_TAPS = 12;

export function defaultPerfSettings(): PerfSettings {
  return {
    fx: { ao: true, rays: true, bloom: true, soft: true },
    shadowMapSize: WORLD.sun.shadowMapSize,
    shadowTaps: DEFAULT_SHADOW_TAPS,
    vegLodScale: 1,
    grassDensity: 1,
    renderScale: 1,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (s: string | undefined, fallback: number) => {
  if (s === undefined || s === '') return fallback;
  const v = Number(s);
  return Number.isFinite(v) ? v : fallback;
};

/** Parse the flags from a query string (pure; `search` may carry the leading `?`). */
export function parsePerfFlags(search: string, opts: { headless?: boolean } = {}): PerfFlags {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const d = defaultPerfSettings();
  const active: Record<string, string> = {};
  const fx = { ...d.fx };
  const fxParam = q.get('fx');
  if (fxParam) {
    active.fx = fxParam;
    for (const tok of fxParam.split(',').map((t) => t.trim().toLowerCase())) {
      if (tok === 'off') fx.ao = fx.rays = fx.bloom = fx.soft = false;
      else if (tok === 'noao') fx.ao = false;
      else if (tok === 'norays') fx.rays = false;
      else if (tok === 'nobloom') fx.bloom = false;
      else if (tok === 'nosoft') fx.soft = false;
    }
  }
  let shadowMapSize = d.shadowMapSize;
  let shadowTaps = d.shadowTaps;
  const shadowParam = q.get('shadow');
  if (shadowParam) {
    active.shadow = shadowParam;
    const [size, taps] = shadowParam.split(',');
    shadowMapSize = Math.round(clamp(num(size, d.shadowMapSize), 0, 8192));
    shadowTaps = Math.round(clamp(num(taps, d.shadowTaps), 1, 64));
  }
  let vegLodScale = d.vegLodScale;
  let grassDensity = d.grassDensity;
  const vegParam = q.get('veg');
  if (vegParam) {
    active.veg = vegParam;
    const [lod, grass] = vegParam.split(',');
    vegLodScale = clamp(num(lod, d.vegLodScale), 0.05, 2);
    grassDensity = clamp(num(grass, d.grassDensity), 0, 1);
  }
  let renderScale = d.renderScale;
  const scaleParam = q.get('scale');
  if (scaleParam) {
    active.scale = scaleParam;
    renderScale = clamp(num(scaleParam, d.renderScale), 0.25, 1);
  }
  const auto = q.get('quality') === 'auto';
  const headless = opts.headless ?? false;
  const governor = auto && (!headless || q.get('governor') === '1');
  if (auto) active.quality = 'auto';
  return { fx, shadowMapSize, shadowTaps, vegLodScale, grassDensity, renderScale, auto, governor, active };
}

/** true when nothing on the URL changes the shipped behaviour (the byte-identical path) */
export function isDefaultPerf(f: PerfFlags): boolean {
  return Object.keys(f.active).length === 0;
}

// --- singletons -----------------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __KF_PERF__: PerfRuntime | undefined;
}

const isHeadless = (): boolean => {
  if (typeof location === 'undefined') return false;
  const q = new URLSearchParams(location.search);
  return q.get('capture') === '1' || (typeof navigator !== 'undefined' && (navigator as unknown as { webdriver?: boolean }).webdriver === true);
};

let flags: PerfFlags | null = null;
/** the page's flags (parsed once from `location.search`; defaults outside a browser) */
export function perfFlags(): PerfFlags {
  if (!flags) flags = parsePerfFlags(typeof location === 'undefined' ? '' : location.search, { headless: isHeadless() });
  return flags;
}

let runtime: PerfRuntime | null = null;
/** the live state (initialised from the flags; also published as `globalThis.__KF_PERF__`) */
export function perfRuntime(): PerfRuntime {
  if (!runtime) {
    const f = perfFlags();
    runtime = {
      fx: { ...f.fx },
      shadowMapSize: f.shadowMapSize,
      shadowTaps: f.shadowTaps,
      vegLodScale: f.vegLodScale,
      grassDensity: f.grassDensity,
      renderScale: f.renderScale,
      version: 0,
      // auto under a headless capture (no governor=1) is the fixed high path
      tier: f.governor ? 'auto:0' : 'high',
    };
    globalThis.__KF_PERF__ = runtime;
  }
  return runtime;
}

/** the runtime state's report for `__ZR__.perf()` / the trace */
export function perfReport(): Record<string, unknown> {
  const f = perfFlags();
  const r = perfRuntime();
  return {
    flags: { ...f.active },
    tier: r.tier,
    version: r.version,
    fx: { ...r.fx },
    shadowMapSize: r.shadowMapSize,
    shadowTaps: r.shadowTaps,
    vegLodScale: r.vegLodScale,
    grassDensity: r.grassDensity,
    renderScale: r.renderScale,
  };
}

/** write `s` into the runtime (bumping the version when anything changed); returns true on a change */
export function applyPerfSettings(r: PerfRuntime, s: PerfSettings, tier: string): boolean {
  const same =
    r.fx.ao === s.fx.ao &&
    r.fx.rays === s.fx.rays &&
    r.fx.bloom === s.fx.bloom &&
    r.fx.soft === s.fx.soft &&
    r.shadowMapSize === s.shadowMapSize &&
    r.shadowTaps === s.shadowTaps &&
    r.vegLodScale === s.vegLodScale &&
    r.grassDensity === s.grassDensity &&
    r.renderScale === s.renderScale;
  const tierSame = r.tier === tier;
  if (same && tierSame) return false;
  r.fx = { ...s.fx };
  r.shadowMapSize = s.shadowMapSize;
  r.shadowTaps = s.shadowTaps;
  r.vegLodScale = s.vegLodScale;
  r.grassDensity = s.grassDensity;
  r.renderScale = s.renderScale;
  r.tier = tier;
  if (!same) r.version++;
  return !same;
}

// --- auto quality ---------------------------------------------------------------------------------

export interface TierRung extends PerfSettings {
  name: string;
}

/**
 * The ladder, rung 0 = the shipped high path. Ordered by visual cost per millisecond saved on an
 * integrated GPU (Astra's 780M trace: render-issue 56 ms median at 1280×720 with the JS update at
 * 13 ms — the frame is GPU-bound): the shadow map first (its 4096² depth pass rasterises every
 * caster a second time and every lit fragment pays 20 PCSS taps into a 64 MB texture), then the
 * screen-space stages and the pixel count, then the vegetation LOD ranges and the grass share.
 * Shadows stay on at every rung (a light losing its shadow recompiles every material — a
 * multi-second hitch mid-play) and the tone/grade composite is never touched (it is the look).
 */
export const AUTO_LADDER: TierRung[] = [
  { name: 'auto:0 high', fx: { ao: true, rays: true, bloom: true, soft: true }, shadowMapSize: 4096, shadowTaps: 12, vegLodScale: 1, grassDensity: 1, renderScale: 1 },
  { name: 'auto:1 shadow-2k', fx: { ao: true, rays: true, bloom: true, soft: true }, shadowMapSize: 2048, shadowTaps: 8, vegLodScale: 1, grassDensity: 1, renderScale: 1 },
  { name: 'auto:2 no-ao scale-0.85', fx: { ao: false, rays: true, bloom: true, soft: true }, shadowMapSize: 2048, shadowTaps: 8, vegLodScale: 1, grassDensity: 1, renderScale: 0.85 },
  { name: 'auto:3 no-rays scale-0.75 veg-0.75', fx: { ao: false, rays: false, bloom: true, soft: true }, shadowMapSize: 2048, shadowTaps: 8, vegLodScale: 0.75, grassDensity: 0.8, renderScale: 0.75 },
  { name: 'auto:4 shadow-1k no-soft scale-0.6 veg-0.5', fx: { ao: false, rays: false, bloom: true, soft: false }, shadowMapSize: 1024, shadowTaps: 6, vegLodScale: 0.5, grassDensity: 0.6, renderScale: 0.6 },
  { name: 'auto:5 floor scale-0.5 veg-0.5/0.5', fx: { ao: false, rays: false, bloom: false, soft: false }, shadowMapSize: 1024, shadowTaps: 4, vegLodScale: 0.5, grassDensity: 0.5, renderScale: 0.5 },
];

export interface GovernorOptions {
  /** sustained frame time (ms) above which the governor steps down */
  slowMs?: number;
  /** frame time (ms) below which frames count as fast */
  fastMs?: number;
  /** seconds of uninterrupted fast frames before a step up */
  fastForS?: number;
  /** minimum seconds between two changes */
  minIntervalS?: number;
  /** frames in the measurement window */
  window?: number;
  ladder?: TierRung[];
  startRung?: number;
}

export interface TierChange {
  frame: number;
  /** wall-clock ms (performance.now()) */
  at: number;
  from: number;
  to: number;
  name: string;
  /** median frame ms of the window that triggered it */
  medianMs: number;
  reason: 'slow' | 'fast';
}

/**
 * Frame-time governor: the median of the last `window` frames' wall time (the rAF interval in
 * play — the GPU-side proxy — or the finished step under the trace harness) drives one step down
 * the ladder when it sits above `slowMs` and one step up when every frame of the last `fastForS`
 * seconds sat below `fastMs`. Changes are at least `minIntervalS` apart, the window is refilled
 * after each change before it can trigger again, and a step up that is punished within twice the
 * interval doubles the fast time the next step up must earn (up to 32×), so a borderline
 * machine settles on a rung instead of oscillating.
 */
export class QualityGovernor {
  readonly ladder: TierRung[];
  readonly changes: TierChange[] = [];
  rung: number;
  private readonly slowMs: number;
  private readonly fastMs: number;
  private readonly fastForMs: number;
  private readonly minIntervalMs: number;
  private readonly window: number;
  private readonly samples: Float64Array;
  private readonly sorted: Float64Array;
  private n = 0;
  private head = 0;
  private sinceChange = 0;
  private lastChangeAt = -Infinity;
  private fastSince: number | null = null;
  private fastPenalty = 1;
  private lastUpAt = -Infinity;
  private frame = 0;

  constructor(private readonly runtime: PerfRuntime, opts: GovernorOptions = {}) {
    this.ladder = opts.ladder ?? AUTO_LADDER;
    this.slowMs = opts.slowMs ?? 20;
    this.fastMs = opts.fastMs ?? 11;
    this.fastForMs = (opts.fastForS ?? 3) * 1000;
    this.minIntervalMs = (opts.minIntervalS ?? 2) * 1000;
    this.window = Math.max(8, opts.window ?? 60);
    this.samples = new Float64Array(this.window);
    this.sorted = new Float64Array(this.window);
    this.rung = Math.min(this.ladder.length - 1, Math.max(0, opts.startRung ?? 0));
    applyPerfSettings(runtime, this.ladder[this.rung], this.tierName(this.rung));
  }

  tierName(rung: number): string {
    return `auto:${rung}`;
  }

  /** median of the filled window (no allocation: the scratch copy is sorted in place) */
  medianMs(): number {
    if (this.n === 0) return 0;
    const s = this.sorted.subarray(0, this.n);
    s.set(this.samples.subarray(0, this.n));
    s.sort();
    return s[this.n >> 1];
  }

  /**
   * Feed one frame's wall time. Returns the change made this frame, if any. `now` is the frame's
   * wall clock (performance.now()); the trace harness passes its own.
   */
  observe(frameMs: number, now: number = performance.now()): TierChange | null {
    this.frame++;
    if (!(frameMs > 0) || !Number.isFinite(frameMs)) return null;
    this.samples[this.head] = frameMs;
    this.head = (this.head + 1) % this.window;
    if (this.n < this.window) this.n++;
    this.sinceChange++;
    if (frameMs < this.fastMs) this.fastSince ??= now;
    else this.fastSince = null;
    // the window must be all post-change frames before it can speak, and changes keep their distance
    if (this.sinceChange < this.window || now - this.lastChangeAt < this.minIntervalMs) return null;
    const median = this.medianMs();
    if (median > this.slowMs && this.rung < this.ladder.length - 1) {
      // a step up punished within two intervals: the next step up must earn a longer fast run
      if (now - this.lastUpAt < 2 * this.minIntervalMs) this.fastPenalty = Math.min(32, this.fastPenalty * 2);
      return this.step(this.rung + 1, now, median, 'slow');
    }
    if (this.rung > 0 && this.fastSince !== null && now - this.fastSince >= this.fastForMs * this.fastPenalty && median < this.fastMs) {
      this.lastUpAt = now;
      return this.step(this.rung - 1, now, median, 'fast');
    }
    return null;
  }

  private step(to: number, now: number, median: number, reason: 'slow' | 'fast'): TierChange {
    const from = this.rung;
    this.rung = to;
    applyPerfSettings(this.runtime, this.ladder[to], this.tierName(to));
    this.lastChangeAt = now;
    this.sinceChange = 0;
    this.fastSince = null;
    const change: TierChange = { frame: this.frame, at: Math.round(now), from, to, name: this.ladder[to].name, medianMs: Math.round(median * 10) / 10, reason };
    this.changes.push(change);
    return change;
  }

  report(): Record<string, unknown> {
    return {
      rung: this.rung,
      name: this.ladder[this.rung].name,
      medianMs: Math.round(this.medianMs() * 10) / 10,
      windowFilled: this.n >= this.window,
      fastPenalty: this.fastPenalty,
      changes: this.changes.map((c) => ({ ...c })),
      ladder: this.ladder.map((l) => l.name),
    };
  }
}
