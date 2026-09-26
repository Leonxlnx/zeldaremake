/**
 * Realtime viewer chrome, never shown in ?capture=1 renders: a loading / error panel while the film
 * builds, then a compact transport bar (restart, play/pause, time, a scrubber with a tick at every
 * cut, the current shot) that hides itself during playback and comes back on any pointer or key.
 */
export interface Transport {
  duration: number;
  shots: { name: string; start: number; end: number }[];
  time(): number;
  seek(t: number): void;
  paused(): boolean;
  setPaused(p: boolean): void;
}

const css = `
.lsw-panel { position: fixed; inset: 0; display: grid; place-items: center; background: #000; color: #d9dde3; font: 500 15px Inter, Arimo, Arial, sans-serif; z-index: 20; pointer-events: auto; text-align: center; }
.lsw-panel .spin { width: 34px; height: 34px; margin: 0 auto 14px; border-radius: 50%; border: 3px solid #2a2f37; border-top-color: #f2c33a; animation: lsw-spin 0.9s linear infinite; }
.lsw-panel .err { color: #ff8a7a; max-width: 34em; margin: 0 auto 14px; line-height: 1.45; }
.lsw-panel button { font: 600 14px Inter, Arimo, Arial, sans-serif; color: #111; background: #f2c33a; border: 0; border-radius: 6px; padding: 9px 18px; cursor: pointer; }
@keyframes lsw-spin { to { transform: rotate(360deg); } }
.lsw-controls { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 10px; padding: 18px 14px 12px; background: linear-gradient(transparent, rgba(0,0,0,0.78) 45%); color: #e8ebef; font: 500 13px Inter, Arimo, Arial, sans-serif; pointer-events: auto; transition: opacity 0.25s; z-index: 10; user-select: none; -webkit-user-select: none; touch-action: none; }
.lsw-controls.hidden { opacity: 0; }
.lsw-controls button { flex: none; width: 38px; height: 34px; display: grid; place-items: center; background: rgba(255,255,255,0.1); color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-size: 15px; line-height: 1; }
.lsw-controls button:hover { background: rgba(255,255,255,0.2); }
.lsw-controls .time { flex: none; font-variant-numeric: tabular-nums; min-width: 8.6em; }
.lsw-controls .shot { flex: none; color: #f2c33a; min-width: 9em; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lsw-controls .build, .lsw-panel .build { color: #8d96a3; font-size: 11px; white-space: nowrap; }
.lsw-panel .build { margin-top: 10px; }
@media (max-width: 760px) { .lsw-controls .build { display: none; } }
.lsw-controls .track { position: relative; flex: 1; height: 26px; cursor: pointer; }
.lsw-controls .rail { position: absolute; left: 0; right: 0; top: 11px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.22); }
.lsw-controls .fill { position: absolute; left: 0; top: 11px; height: 4px; border-radius: 2px; background: #f2c33a; }
.lsw-controls .tick { position: absolute; top: 8px; width: 1px; height: 10px; background: rgba(255,255,255,0.45); }
.lsw-controls .knob { position: absolute; top: 6px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.6); }
@media (max-width: 640px) { .lsw-controls .shot { display: none; } .lsw-controls .time { min-width: 7.4em; } }
`;

/** build label a published page carries in <meta name="lsw-build"> (source SHA, build time) */
const BUILD = document.querySelector<HTMLMetaElement>('meta[name="lsw-build"]')?.content ?? '';

let styled = false;
function style(): void {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

/** Full-page loading / error panel. */
export class Loading {
  private el: HTMLDivElement;
  private msg: HTMLDivElement;

  constructor(text = 'Building the fleet…') {
    style();
    this.el = document.createElement('div');
    this.el.className = 'lsw-panel';
    this.el.setAttribute('role', 'status');
    const box = document.createElement('div');
    const spin = document.createElement('div');
    spin.className = 'spin';
    this.msg = document.createElement('div');
    this.msg.textContent = text;
    box.append(spin, this.msg);
    if (BUILD) {
      const b = document.createElement('div');
      b.className = 'build';
      b.textContent = BUILD;
      box.append(b);
    }
    this.el.append(box);
    document.body.append(this.el);
  }

  status(text: string): void {
    this.msg.textContent = text;
  }

  fail(err: unknown): void {
    const text = err instanceof Error ? err.message : String(err);
    if (!this.el.isConnected) document.body.append(this.el);
    this.el.innerHTML = '';
    const box = document.createElement('div');
    const e = document.createElement('div');
    e.className = 'err';
    e.textContent = `The film could not start: ${text}`;
    const b = document.createElement('button');
    b.textContent = 'Reload';
    b.onclick = () => location.reload();
    box.append(e, b);
    this.el.append(box);
    this.el.style.display = 'grid';
  }

  done(): void {
    this.el.remove();
  }
}

/** The transport bar. Call update() once per rendered frame. */
export class Controls {
  readonly el: HTMLDivElement;
  private play: HTMLButtonElement;
  private timeEl: HTMLDivElement;
  private shotEl: HTMLDivElement;
  private track: HTMLDivElement;
  private fill: HTMLDivElement;
  private knob: HTMLDivElement;
  private dragging = false;
  private lastActive = performance.now();

  constructor(private tr: Transport) {
    style();
    const el = (this.el = document.createElement('div'));
    el.className = 'lsw-controls';
    const btn = (label: string, title: string, fn: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.onclick = (e) => {
        e.stopPropagation();
        this.lastActive = performance.now();
        fn();
      };
      return b;
    };
    const restart = btn('⏮', 'Restart (Home)', () => {
      tr.seek(0);
      tr.setPaused(false);
    });
    this.play = btn('❚❚', 'Play / pause (Space)', () => tr.setPaused(!tr.paused()));
    this.timeEl = document.createElement('div');
    this.timeEl.className = 'time';
    this.track = document.createElement('div');
    this.track.className = 'track';
    this.track.setAttribute('role', 'slider');
    this.track.setAttribute('aria-label', 'Seek');
    const rail = document.createElement('div');
    rail.className = 'rail';
    this.fill = document.createElement('div');
    this.fill.className = 'fill';
    this.knob = document.createElement('div');
    this.knob.className = 'knob';
    this.track.append(rail);
    for (const s of tr.shots.slice(1)) {
      const k = document.createElement('div');
      k.className = 'tick';
      k.style.left = `${(s.start / tr.duration) * 100}%`;
      k.title = s.name;
      this.track.append(k);
    }
    this.track.append(this.fill, this.knob);
    this.shotEl = document.createElement('div');
    this.shotEl.className = 'shot';
    el.append(restart, this.play, this.timeEl, this.track, this.shotEl);
    if (BUILD) {
      const b = document.createElement('div');
      b.className = 'build';
      b.textContent = BUILD;
      el.append(b);
    }
    document.body.append(el);

    const seekAt = (x: number) => {
      const r = this.track.getBoundingClientRect();
      tr.seek(Math.max(0, Math.min(1, (x - r.left) / r.width)) * tr.duration);
    };
    this.track.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.lastActive = performance.now();
      this.dragging = true;
      this.track.setPointerCapture(e.pointerId);
      seekAt(e.clientX);
    });
    this.track.addEventListener('pointermove', (e) => this.dragging && seekAt(e.clientX));
    const end = () => (this.dragging = false);
    this.track.addEventListener('pointerup', end);
    this.track.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => e.stopPropagation());
    const wake = () => (this.lastActive = performance.now());
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { passive: true });
  }

  update(): void {
    const t = this.tr.time();
    const d = this.tr.duration;
    this.el.dataset.t = t.toFixed(3);
    const f = `${(Math.min(1, t / d) * 100).toFixed(3)}%`;
    this.fill.style.width = f;
    this.knob.style.left = f;
    this.timeEl.textContent = `${fmt(t)} / ${fmt(d)}`;
    const shot = this.tr.shots.find((s) => t >= s.start && t < s.end) ?? this.tr.shots[this.tr.shots.length - 1];
    if (shot && this.shotEl.textContent !== shot.name) this.shotEl.textContent = shot.name;
    const p = this.tr.paused();
    const icon = p ? '▶' : '❚❚';
    if (this.play.textContent !== icon) this.play.textContent = icon;
    const idle = performance.now() - this.lastActive > 2500;
    this.el.classList.toggle('hidden', idle && !p && !this.dragging);
  }
}
