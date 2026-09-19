/**
 * LOD geometry pool (round 42, the owner: "run more efficiently, byte for byte, same quality").
 *
 * The near LOD parts of the trees — the near-canopy parts (nearCanopy.ts: 364 lobe / limb parts,
 * 2.4 M triangles, 173 MB of buffers resident with a handful ever shown) and the near bases
 * (giant.ts / column.ts: a relief bole, fins and plants per giant and seated column) — are
 * deterministic: every part is built from a stream forked off its tree's by the part's index
 * (util/prng.ts `fork` derives the child seed from the parent's seed string and the label, never
 * from the parent's state), so a part rebuilt at any later time is byte-identical to its first
 * build. That makes them cacheable rather than resident: this pool keeps only the parts near the
 * camera built, evicts the least recently used past a byte cap, and builds an approaching part
 * ahead of its swap distance in chunks across frames (a time budget per frame, measured with
 * `performance.now()`, checked between the yields of the part's build generator) so the build
 * never hitches. A part that must be drawn NOW (an explicit re-pose — the capture harness, a
 * viewpoint key — or a walk faster than the pre-fetch) is finished synchronously (`pin`), so
 * the frame is what it would have been with every part resident: the pool changes when a part's
 * buffers exist, never whether it is drawn.
 *
 * Generic over the built buffers (three's BufferGeometry in the trees system; anything with a
 * byte count and a `dispose` here, so the pool is testable without a renderer).
 */

export interface PoolBuilt {
  /** the buffers' bytes (what the cap counts) */
  bytes: number;
  /** free the buffers (GPU and heap) */
  dispose(): void;
}

export interface PoolItem<B extends PoolBuilt = PoolBuilt> {
  /** stable id (the audit) */
  id: string;
  /** the bytes one build of this item takes: known from the first build (`add` with a built), an estimate before */
  bytes: number;
  /** one build: a generator yielding between chunks of work, returning the built buffers (identical every time) */
  build(): Generator<void, B>;
  /** the built buffers go live (the mesh takes the geometry) */
  install(built: B): void;
  /** the built buffers leave (the mesh takes its placeholder); the pool disposes them afterwards */
  uninstall(): void;
}

interface Slot<B extends PoolBuilt> {
  item: PoolItem<B>;
  built: B | null;
  /** an in-progress chunked build */
  gen: Generator<void, B> | null;
  /** ms spent so far on the in-progress build */
  genMs: number;
  /** the tick the item was last wanted or pinned (LRU order) */
  lastUse: number;
  pinned: boolean;
  wanted: boolean;
  /** lower = sooner (the caller's distance); Infinity when not wanted */
  priority: number;
}

export interface PoolReport {
  capBytes: number;
  poolBytes: number;
  items: number;
  resident: number;
  pinned: number;
  wanted: number;
  /** the pinned items' bytes (the floor the cap cannot cut under) and the wanted items' (the pre-fetch demand; built or not) */
  pinnedBytes: number;
  wantedBytes: number;
  /** pending = wanted, not built, not building; building = chunked builds in progress */
  pending: number;
  building: number;
  /** builds completed (chunked + synchronous), evictions, synchronous builds (a pinned item that was not ready), pins served from the pool */
  built: number;
  evicted: number;
  syncBuilds: number;
  hits: number;
  /** ms of one whole build: p50 / p95 / max over the last builds */
  buildMsP50: number;
  buildMsP95: number;
  buildMsMax: number;
  /** the longest single chunk (ms) a chunked build ran between yields, and the longest `work` call (ms) */
  stepMsMax: number;
  workMsMax: number;
  /** how much of the frame budgets `work` used (ms, summed) */
  workMsTotal: number;
}

const percentile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1) + 0.5))] : 0);

export class LodPool<B extends PoolBuilt = PoolBuilt> {
  private readonly slots = new Map<PoolItem<B>, Slot<B>>();
  private tick = 0;
  private bytes = 0;
  private builtCount = 0;
  private evictedCount = 0;
  private syncCount = 0;
  private hitCount = 0;
  private readonly buildMs: number[] = [];
  private stepMsMax = 0;
  private workMsMax = 0;
  private workMsTotal = 0;

  /**
   * @param capBytes byte cap: unpinned items are evicted past it (the unwanted least recently used
   * first, then the wanted farthest first); pinned items are never evicted, so a frame that pins
   * more than the cap overflows it rather than dropping a part
   * @param now clock (ms) for the budgets; `performance.now` by default
   * @param history how many build durations the percentiles cover
   */
  constructor(
    readonly capBytes: number,
    private readonly now: () => number = () => performance.now(),
    private readonly history = 512,
  ) {}

  /** register an item; `built` = buffers that already exist (the measurement build), counted resident */
  add(item: PoolItem<B>, built: B | null = null) {
    if (this.slots.has(item)) throw new Error(`LodPool: ${item.id} added twice`);
    const slot: Slot<B> = { item, built, gen: null, genMs: 0, lastUse: this.tick, pinned: false, wanted: false, priority: Infinity };
    this.slots.set(item, slot);
    if (built) {
      item.bytes = built.bytes;
      this.bytes += built.bytes;
    }
  }

  /** start a frame: the previous frame's wants and pins are cleared */
  begin() {
    this.tick++;
    for (const s of this.slots.values()) {
      s.pinned = false;
      s.wanted = false;
      s.priority = Infinity;
    }
  }

  /** the item should be resident soon (pre-fetch); `priority` orders the pending builds (lower first) */
  want(item: PoolItem<B>, priority: number) {
    const s = this.slot(item);
    s.wanted = true;
    s.priority = Math.min(s.priority, priority);
    s.lastUse = this.tick;
  }

  /**
   * The item is drawn this frame: never evicted, and built NOW if it is not resident (a
   * synchronous build — the in-progress chunked build is finished rather than restarted).
   */
  pin(item: PoolItem<B>) {
    const s = this.slot(item);
    s.pinned = true;
    s.wanted = true;
    s.priority = -1;
    s.lastUse = this.tick;
    if (s.built) {
      this.hitCount++;
      return;
    }
    const t0 = this.now();
    const gen = s.gen ?? item.build();
    let r = gen.next();
    while (!r.done) r = gen.next();
    const ms = this.now() - t0;
    this.finish(s, r.value, s.genMs + ms);
    this.syncCount++;
  }

  isResident(item: PoolItem<B>) {
    return !!this.slot(item).built;
  }

  /** forget an item (its buffers disposed if resident) */
  remove(item: PoolItem<B>) {
    const s = this.slots.get(item);
    if (!s) return;
    if (s.built) {
      s.item.uninstall();
      this.bytes -= s.built.bytes;
      s.built.dispose();
      s.built = null;
    }
    this.slots.delete(item);
  }

  /**
   * The frame's pool work within `budgetMs`: evict down to the cap — the items not wanted this
   * frame first (least recently used first), then the wanted ones farthest first, so past the cap
   * the pool holds the pinned items and the NEAREST of the wanted; a pre-fetch radius that covers
   * more than the cap (the hollow is ~40 m across: from the plaza 2/3 of the canopy parts are
   * within 34 m) shrinks to what fits, it never inflates the pool — then advance the pending
   * builds — the in-progress one first, then the wanted items by priority — chunk by chunk while
   * the budget lasts (a chunk that ends past the budget ends the call). A pending item is only
   * started while it can fit: room at the cap, or evictable items that are not wanted or are
   * wanted with a worse priority (so the pool never thrashes between a near and a far one).
   */
  work(budgetMs: number) {
    const t0 = this.now();
    for (const s of this.slots.values()) {
      if (s.gen && !s.wanted && !s.pinned) {
        s.gen = null;
        s.genMs = 0;
      }
    }
    this.evictToCap(0, -Infinity);
    for (;;) {
      const elapsed = this.now() - t0;
      if (elapsed >= budgetMs) break;
      const s = this.next();
      if (!s) break;
      if (!s.gen) {
        if (!this.canFit(s)) {
          // nothing nearer can be made room for either: the pending list is ordered by priority
          break;
        }
        s.gen = s.item.build();
        s.genMs = 0;
      }
      const c0 = this.now();
      const r = s.gen.next();
      const c1 = this.now();
      s.genMs += c1 - c0;
      this.stepMsMax = Math.max(this.stepMsMax, c1 - c0);
      if (r.done) this.finish(s, r.value, s.genMs);
    }
    const ms = this.now() - t0;
    this.workMsMax = Math.max(this.workMsMax, ms);
    this.workMsTotal += ms;
  }

  get poolBytes() {
    return this.bytes;
  }

  report(): PoolReport {
    const sorted = [...this.buildMs].sort((a, b) => a - b);
    let resident = 0;
    let pinned = 0;
    let wanted = 0;
    let pinnedBytes = 0;
    let wantedBytes = 0;
    let pending = 0;
    let building = 0;
    for (const s of this.slots.values()) {
      if (s.built) resident++;
      if (s.pinned) {
        pinned++;
        pinnedBytes += s.item.bytes;
      }
      if (s.wanted) {
        wanted++;
        wantedBytes += s.item.bytes;
      }
      if (s.gen) building++;
      else if (s.wanted && !s.built) pending++;
    }
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      capBytes: this.capBytes,
      poolBytes: this.bytes,
      items: this.slots.size,
      resident,
      pinned,
      wanted,
      pinnedBytes,
      wantedBytes,
      pending,
      building,
      built: this.builtCount,
      evicted: this.evictedCount,
      syncBuilds: this.syncCount,
      hits: this.hitCount,
      buildMsP50: r(percentile(sorted, 0.5)),
      buildMsP95: r(percentile(sorted, 0.95)),
      buildMsMax: r(sorted.length ? sorted[sorted.length - 1] : 0),
      stepMsMax: r(this.stepMsMax),
      workMsMax: r(this.workMsMax),
      workMsTotal: r(this.workMsTotal),
    };
  }

  /** the resident items' ids (tests, audits) */
  resident(): string[] {
    return [...this.slots.values()].filter((s) => s.built).map((s) => s.item.id);
  }

  /** drop every built item (the system's dispose) */
  dispose() {
    for (const s of this.slots.values()) {
      if (s.built) {
        s.item.uninstall();
        s.built.dispose();
        s.built = null;
      }
      s.gen = null;
    }
    this.bytes = 0;
  }

  private slot(item: PoolItem<B>) {
    const s = this.slots.get(item);
    if (!s) throw new Error(`LodPool: ${item.id} not added`);
    return s;
  }

  /** the build to advance: the in-progress one with the best priority, else the best pending */
  private next(): Slot<B> | null {
    let best: Slot<B> | null = null;
    for (const s of this.slots.values()) {
      if (s.built || !s.wanted) continue;
      if (!best) best = s;
      else if (!!s.gen !== !!best.gen) {
        if (s.gen) best = s;
      } else if (s.priority < best.priority) best = s;
    }
    return best;
  }

  private finish(s: Slot<B>, built: B, ms: number) {
    s.gen = null;
    s.genMs = 0;
    this.evictToCap(built.bytes, s.priority);
    s.built = built;
    s.item.bytes = built.bytes;
    this.bytes += built.bytes;
    s.item.install(built);
    this.builtCount++;
    this.buildMs.push(ms);
    if (this.buildMs.length > this.history) this.buildMs.shift();
  }

  /** whether `s` could be made resident: room at the cap or enough evictable bytes among the items it outranks */
  private canFit(s: Slot<B>) {
    let room = this.capBytes - this.bytes - s.item.bytes;
    if (room >= 0) return true;
    for (const o of this.slots.values()) {
      if (!o.built || o.pinned || o === s) continue;
      if (o.wanted && o.priority <= s.priority) continue;
      room += o.built.bytes;
      if (room >= 0) return true;
    }
    return false;
  }

  /**
   * Evict unpinned items until `incoming` more bytes fit under the cap: the items not wanted
   * this frame first (least recently used first), then the wanted ones farther than the incoming
   * item's `priority` (farthest first). Pinned items are never evicted.
   */
  private evictToCap(incoming: number, priority: number) {
    if (this.bytes + incoming <= this.capBytes) return;
    const candidates = [...this.slots.values()]
      .filter((s) => s.built && !s.pinned && (!s.wanted || s.priority > priority))
      .sort((a, b) => Number(a.wanted) - Number(b.wanted) || (a.wanted ? b.priority - a.priority : a.lastUse - b.lastUse));
    for (const s of candidates) {
      if (this.bytes + incoming <= this.capBytes) break;
      this.evict(s);
    }
  }

  private evict(s: Slot<B>) {
    if (!s.built) return;
    s.item.uninstall();
    this.bytes -= s.built.bytes;
    s.built.dispose();
    s.built = null;
    this.evictedCount++;
  }
}

/** run a build generator to its end (the measurement build at load, tests) */
export function runBuild<B>(gen: Generator<void, B>): B {
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}
