/**
 * Audio system (round 47, lane shell-1, owner item 19). WebAudio, created on the first user
 * gesture (browser autoplay rules — nothing plays in a headless capture, which has no gesture),
 * with master / music / ambience / sfx buses, the M key and the HUD's speaker glyph for mute.
 *
 *   ambience.ts  — wind bed following the world's gust, leaf rustle, four synthesised bird calls
 *                  on a seeded schedule, the pod lanterns' hum attenuated by distance
 *   footsteps.ts — stone / grass / dirt / wood / hollow steps from the player's speed and the ground under him
 *   music.ts     — the music slot: `public/audio/music.ogg|mp3` if present, else the original
 *                  placeholder loop; −12 dB under the ambience
 *
 * The per-frame update runs on its own requestAnimationFrame — the world's render loop and the
 * capture API are untouched. `renderOffline(seconds)` builds the same graph in an
 * OfflineAudioContext (a scripted walk for the footsteps) and returns a WAV — the evidence path.
 */
import type { Object3D, Scene, Vector3 } from 'three';
import type { Wind } from '../world/wind/wind';
import type { PlayerHandle } from '../world/character/player';
import { surfaceMask } from '../world/terrain/heightfield';
import { forestFloorZone } from '../world/terrain/material';
import { EXPANSION, EXPANSION_SOUTH, LAYOUT } from '../world/layout';
import { createBuses, createRng, voices as liveVoices, type Buses } from './graph';
import { createAmbience, type Ambience, type AmbienceStats, type Vec3 } from './ambience';
import { createFootsteps, type Footsteps, type FootstepStats, type Surface } from './footsteps';
import { createMusic, type Music, type MusicSource } from './music';

export type AudioState = 'idle' | 'on' | 'muted';

export interface AudioHandle {
  readonly started: boolean;
  readonly muted: boolean;
  /** create the context now (must be called from a user gesture to be audible) */
  start(): Promise<void>;
  toggleMute(): void;
  setMuted(muted: boolean): void;
  music(): MusicSource;
  /** what the system has done so far — the play-mode evidence path (`__ZR_AUDIO__.stats()`) */
  stats(): AudioStats;
  /** render `seconds` of the mix offline: 16-bit stereo WAV bytes + the music source it used */
  renderOffline(seconds: number, sampleRate?: number, options?: OfflineOptions): Promise<OfflineRender>;
  dispose(): void;
}

export interface AudioStats extends FootstepStats, AmbienceStats {
  state: AudioState;
  music: MusicSource;
  /** pod lanterns found in the scene (the flame's distance sources) */
  pods: number;
  /** true while the character system is reporting the gait's boot plants */
  gaitDriven: boolean;
  /** how closed the space over the listener is — 1 inside the log tunnel's bore, 0 in the open */
  enclosure: number;
  /** how closed the canopy over the listener is — 1 deep under the crowns, 0 under open sky */
  canopy: number;
  /** where the audio thinks the fairies are (world), so a harness can stand beside one */
  fairySpots: [number, number, number][];
  /**
   * How hard the audio thread is working, from Chrome's render-capacity monitor: the share of each
   * render quantum used on average and at its worst, and the share of quanta that MISSED. An
   * underrun is a gap in the output — which is what "the music shakes" sounds like. null where the
   * browser does not report it.
   */
  load: RenderLoad | null;
  /** scheduled voices alive in the graph (every event — step, leaf, bird, note — builds its own) */
  voices: number;
}

export interface RenderLoad {
  average: number;
  peak: number;
  underrun: number;
}

export interface OfflineRender {
  wav: Uint8Array;
  music: MusicSource;
}

/** what an offline render contains — the evidence path renders the parts separately */
export interface OfflineOptions {
  /** `mix` = what the player hears; the others isolate one part of it */
  stem?: 'mix' | 'bed' | 'steps' | 'music';
  /** include the music bus (default: only in `mix`) */
  music?: boolean;
  /** mute the shared hall's return — the same stem dry, so the tail can be measured on its own */
  reverb?: boolean;
  /** force the canopy over the whole render (0 open sky, 1 closed crowns) instead of the walk's own */
  canopy?: number;
}

/** one leg of the offline walk: seconds, ground speed (m/s) and what is underfoot */
export interface WalkLeg {
  until: number;
  speed: number;
  surface: Surface;
  stairs?: boolean;
}

/**
 * The scripted walk the offline render uses, so a before / after pair is the same journey and the
 * analysis can label each surface's steps: stand, walk every surface in turn, run, stand.
 */
export const OFFLINE_WALK: readonly WalkLeg[] = [
  { until: 3, speed: 0, surface: 'grass' },
  { until: 8, speed: 1.5, surface: 'grass' },
  { until: 13, speed: 1.5, surface: 'dirt' },
  { until: 18, speed: 1.5, surface: 'stone' },
  { until: 23, speed: 1.1, surface: 'stone', stairs: true },
  { until: 27, speed: 1.5, surface: 'wood' },
  { until: 31, speed: 1.5, surface: 'hollow' },
  { until: 36, speed: 1.5, surface: 'leaf' },
  { until: 41, speed: 4.2, surface: 'stone' },
  { until: 45, speed: 0, surface: 'grass' },
  // appended 2026-09-24 with the south exit, AFTER the closing stand so every earlier leg keeps its
  // times and older before/after renders stay comparable
  { until: 50, speed: 1.5, surface: 'bridge' },
];

export interface AudioOptions {
  scene: Scene;
  wind: Wind | null;
  onState?: (s: AudioState) => void;
  /** seed for every schedule (fixed so two sessions hear the same forest) */
  seed?: string;
}

interface Live {
  ctx: AudioContext;
  buses: Buses;
  ambience: Ambience;
  footsteps: Footsteps;
  music: Music;
}

/**
 * Every fairy in the scene (`navi.ts` names its root from `FairyOptions.name`: the Kokiri kids'
 * are `kokiri-fairy-<slot>`). Unlike the pod lanterns these MOVE — they hover, and the girl walks —
 * so the objects are kept and their world position read each frame rather than sampled once.
 */
function gatherFairies(scene: Scene): FairyRef[] {
  const roots = new Map<string, Object3D>();
  const lights = new Map<string, Object3D>();
  scene.updateMatrixWorld(true);
  // the ROOT only: createFairy names every child from the same prefix (`-body`, `-core`, `-halo`,
  // `-sparkle`…), so a prefix match collects fifteen objects per fairy
  scene.traverse((o: Object3D) => {
    if (FAIRY_ROOT.test(o.name)) roots.set(o.name, o);
    else if (FAIRY_LIGHT.test(o.name)) lights.set(o.name.slice(0, -6), o);
  });
  // The root itself never moves. `npc.ts` reparents the fairy's point light onto the NPC group (a
  // light joining or leaving the scene changes the light count every lit program is keyed on, and
  // recompiles them all) and writes `anchor + offset(t)` to THAT every frame — so the light is
  // where she is, and the root only says whether she is shown.
  return [...roots].map(([name, root]) => ({ root, at: lights.get(name) ?? root }));
}

interface FairyRef {
  /** the fairy's group: carries her visibility */
  root: Object3D;
  /** the object that is actually at her hover point */
  at: Object3D;
}

const FAIRY_ROOT = /^(navi|kokiri-fairy-\d+)$/;
const FAIRY_LIGHT = /^(navi|kokiri-fairy-\d+)-light$/;

/**
 * A fairy's world position, or null while it or anything above it is hidden. The matrix is brought
 * up to date here rather than trusted: the audio runs on its own animation frame, and the world's
 * matrices are only refreshed when it draws — with the bag open, or under a harness that steps the
 * simulation without rendering, a trusted `matrixWorld` is whatever it was when the context started.
 */
function fairyAt(f: FairyRef, out: Vec3): Vec3 | null {
  for (let n: Object3D | null = f.root; n; n = n.parent) if (!n.visible) return null;
  f.at.updateWorldMatrix(true, false);
  const e = f.at.matrixWorld.elements;
  out.x = e[12];
  out.y = e[13];
  out.z = e[14];
  return out;
}

/** world-space centres of every `pod-lantern` mesh (structures/lantern.ts) */
function gatherPods(scene: Scene): Vec3[] {
  const pods: Vec3[] = [];
  const tmp = { x: 0, y: 0, z: 0 };
  scene.updateMatrixWorld(true);
  scene.traverse((o: Object3D) => {
    if (o.name !== 'pod-lantern') return;
    const e = o.matrixWorld.elements;
    tmp.x = e[12];
    tmp.y = e[13];
    tmp.z = e[14];
    // the mesh origin is the cord's hook; the pod hangs ~0.5 m below it
    pods.push({ x: tmp.x, y: tmp.y - 0.5, z: tmp.z });
  });
  return pods;
}

/**
 * What Link's boot lands on (owner, 2026-09-22: "his footsteps should correlate where he's
 * walking — gentle stone, grass, etc."). Analytic, from the layout and the live terrain masks the
 * paving is built from — no raycasts:
 *  - hollow: inside the log tunnel's bore (LAYOUT.logArch axis where the path passes through, within 0.8 of its radius)
 *  - wood:   the west house's platform disc and its walkway deck (EXPANSION.westHouse)
 *  - stone:  the flagstone paths and the stair treads (surfaceMask path / stairs, live view — the
 *            expansion's stepping discs count)
 *  - dirt:   the trodden shoulders beside the paving (path influence 0.12–0.5) and the stair aprons
 *  - leaf:   the north forest floor (the terrain's own `forestFloorZone` — the ground the litter
 *            and humus patch covers, north of the log arch and off the path past the hollow's
 *            mouth). The owner's 09-23 list names leaves as one of the four surfaces.
 *  - grass:  everything else
 */
export function surfaceAt(x: number, z: number): { surface: Surface; stairs: boolean; enclosure: number; canopy: number } {
  const m = surfaceMask(x, z, 'live');
  // how much wood is overhead: the terrain's own forest-floor zone. The litter is there BECAUSE the
  // crowns are, so the same field that decides what is underfoot also says how closed the sky is —
  // the plaza and the village are open, the north corridor past the arch is roofed.
  const canopy = forestFloorZone(x, z);
  if (m.stairs > 0.5) return { surface: 'stone', stairs: true, enclosure: 0, canopy };
  // the log tunnel: distance from the log's axis in its own frame
  const la = LAYOUT.logArch;
  {
    const yaw = (la.yawDeg * Math.PI) / 180;
    const dx = x - la.position[0];
    const dz = z - la.position[2];
    const u = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    // the bore is where the north path passes through the log's west half (layout: the path spine
    // crosses at lu −3.4 … −4.8); elsewhere along the log the walker is on the ground beside it
    if (u > -8.5 && u < -0.5 && Math.abs(v) < la.radius * 0.8) {
      // how far in he is: the wood closes over the forest across the first 1.6 m of the bore
      const fromMouth = Math.min(u + 8.5, -0.5 - u) / 1.6;
      const fromWall = (la.radius * 0.8 - Math.abs(v)) / 0.5;
      return { surface: 'hollow', stairs: false, enclosure: Math.max(0, Math.min(1, Math.min(fromMouth, fromWall))), canopy };
    }
  }
  // the south expansion (EXPANSION_SOUTH): the rope-and-plank bridge over the ravine, and the
  // hollow log burrowing into the far bank. Both are walked and both used to sound like lawn.
  {
    const s = southSurfaceAt(x, z, canopy);
    if (s) return s;
  }
  // the west house's platform and deck
  {
    const wh = EXPANSION.westHouse;
    const hx = wh.host[0];
    const hz = wh.host[1];
    if (Math.hypot(x - hx, z - hz) < wh.radius) return { surface: 'wood', stairs: false, enclosure: 0, canopy };
    const ex = wh.deckEnd[0];
    const ez = wh.deckEnd[2];
    const ax = ex - hx;
    const az = ez - hz;
    const len = Math.hypot(ax, az) || 1;
    const t = ((x - hx) * ax + (z - hz) * az) / (len * len);
    if (t > 0 && t < 1) {
      const px = hx + ax * t;
      const pz = hz + az * t;
      if (Math.hypot(x - px, z - pz) < 0.475) return { surface: 'wood', stairs: false, enclosure: 0, canopy };
    }
  }
  if (m.path > 0.5) return { surface: 'stone', stairs: false, enclosure: 0, canopy };
  if (m.path > 0.12) return { surface: 'dirt', stairs: false, enclosure: 0, canopy };
  if (canopy > 0.5) return { surface: 'leaf', stairs: false, enclosure: 0, canopy };
  return { surface: 'grass', stairs: false, enclosure: 0, canopy };
}

/**
 * The south exit's two walked structures (`EXPANSION_SOUTH`), neither of which the surface map knew
 * about — the owner has been asking for the world to grow and both were sounding like the lawn.
 *
 *  - the rope-and-plank bridge: planks over 8 m of empty air, so they knock hollow and the ropes
 *    and lashings answer. Its own surface, not `wood`: a deck on the ground and a deck over a
 *    ravine are not the same sound.
 *  - the hollow log at the far bank: the same bore sound as the arch by the plaza, with the same
 *    smooth enclosure as the wood closes over the listener.
 */
function southSurfaceAt(x: number, z: number, canopy: number): { surface: Surface; stairs: boolean; enclosure: number; canopy: number } | null {
  const b = EXPANSION_SOUTH.bridge;
  {
    const ax = b.south[0] - b.north[0];
    const az = b.south[1] - b.north[1];
    const len2 = ax * ax + az * az;
    const t = ((x - b.north[0]) * ax + (z - b.north[1]) * az) / len2;
    if (t > -0.02 && t < 1.02) {
      const px = b.north[0] + ax * t;
      const pz = b.north[1] + az * t;
      if (Math.hypot(x - px, z - pz) < b.walkHalfWidth + 0.12) return { surface: 'bridge', stairs: false, enclosure: 0, canopy: 0 };
    }
  }
  const tn = EXPANSION_SOUTH.tunnel;
  {
    const dl = Math.hypot(tn.dir[0], tn.dir[1]) || 1;
    const dx = tn.dir[0] / dl;
    const dz = tn.dir[1] / dl;
    // along the bore from the mouth, and across it
    const u = (x - tn.mouth[0]) * dx + (z - tn.mouth[1]) * dz;
    const v = Math.abs(-(x - tn.mouth[0]) * dz + (z - tn.mouth[1]) * dx);
    if (u > -0.3 && u < tn.deadEnd && v < tn.innerRadius * 0.8) {
      return { surface: 'hollow', stairs: false, enclosure: Math.max(0, Math.min(1, Math.min(u / 1.6, (tn.innerRadius * 0.8 - v) / 0.5))), canopy };
    }
  }
  return null;
}

export const AUDIO_SEED = 'kokiri-audio-r47';

export function mountAudio(o: AudioOptions): AudioHandle {
  const seed = o.seed ?? AUDIO_SEED;
  let live: Live | null = null;
  let musicSource: MusicSource = 'none';
  let muted = false;
  let starting: Promise<void> | null = null;
  let raf = 0;
  let pods: Vec3[] = [];
  let fairyObjects: FairyRef[] = [];
  /** reused per-fairy vectors so the per-frame read allocates nothing */
  const fairySlots: Vec3[] = [];
  const fairyBuf: Vec3[] = [];
  let gaitDriven = false;
  let load: RenderLoad | null = null;
  let enclosure = 0;
  let canopy = 0;
  /** the highest point of the jump or drop in progress (m above the ground under him) */
  let peakAir = 0;
  const emit = () => o.onState?.(!live ? 'idle' : muted ? 'muted' : 'on');
  emit();

  const lastPos = { x: NaN, z: NaN };
  let lastT = 0;
  const tick = (now: number) => {
    if (!live) return;
    const { ctx, ambience, footsteps, music } = live;
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
    lastT = now;
    const t = ctx.currentTime + 0.03;
    // listener: Link's sole when the character system published him, the camera otherwise
    const player = o.scene.userData.player as PlayerHandle | undefined;
    const pose = window.__ZR__?.cameraPose?.();
    const cam = pose?.position ?? [0, 2, 0];
    const p: Vector3 | null = player?.position ?? null;
    const listener: Vec3 = p ? { x: p.x, y: p.y + 1.2, z: p.z } : { x: cam[0], y: cam[1], z: cam[2] };
    // Which way the listener faces. In play mode that is Link, and his heading is a plain number
    // the character system maintains — `cameraPose()` reads the camera's world MATRIX, which is
    // only refreshed when the world draws, so with the bag open or under a harness that steps the
    // simulation without rendering it hands back whichever way the camera was pointing at start-up.
    const heading = player?.playMode?.() ? player.heading() : null;
    const fwd = heading === null ? (pose?.direction ?? [0, 0, -1]) : [Math.sin(heading), 0, Math.cos(heading)];
    const fl = Math.hypot(fwd[0], fwd[2]) || 1;
    // one ground lookup a frame, shared by the bed's enclosure and the boots' surface
    const s = surfaceAt(listener.x, listener.z);
    enclosure = s.enclosure;
    canopy = s.canopy;
    // the fairies hover and their owners walk, so their positions are read fresh (and skipped
    // while the background cast is hidden)
    fairyBuf.length = 0;
    for (let i = 0; i < fairyObjects.length; i++) {
      const at = fairyAt(fairyObjects[i], fairySlots[i]);
      if (at) fairyBuf.push(at);
    }
    ambience.update(t, { gust: o.wind?.uniforms.uGust.value ?? 0.4, listener, forward: { x: fwd[0] / fl, z: fwd[2] / fl }, pods, fairies: fairyBuf, enclosure: s.enclosure, canopy: s.canopy, windDir: o.wind ? { x: o.wind.direction.x, z: o.wind.direction.y } : undefined });
    ambience.scheduleUntil(ctx.currentTime + 4);
    music.scheduleUntil(ctx.currentTime + 6);
    // footsteps: the gait's own boot plants when the character system reports them, the ground
    // speed otherwise (see footsteps.ts — a step is heard when a boot lands, not on a stride timer)
    if (p && player?.playMode?.()) {
      if (Number.isFinite(lastPos.x)) {
        const speed = Math.hypot(p.x - lastPos.x, p.z - lastPos.z) / Math.max(dt, 1e-3);
        const stance = player.feetContact?.()?.map((f) => f.stance);
        gaitDriven = !!stance;
        // the jump's arc (`airHeight` is 0 whenever a boot is down): the drop's highest point is
        // how hard he comes back onto whatever is under him
        const air = player.airHeight?.() ?? 0;
        if (air > 0.02) peakAir = Math.max(peakAir, air);
        else if (peakAir > 0.05) {
          footsteps.land(t, s.stairs ? 'stair' : s.surface, peakAir);
          peakAir = 0;
        } else peakAir = 0;
        footsteps.drive(t, dt, { speed, surface: s.surface, onStairs: s.stairs, stance });
      }
      lastPos.x = p.x;
      lastPos.z = p.z;
    } else {
      lastPos.x = NaN;
      footsteps.drive(t, dt, { speed: 0, surface: 'grass', onStairs: false });
    }
    raf = requestAnimationFrame(tick);
  };

  const start = async () => {
    if (live) return;
    if (starting) return starting;
    starting = (async () => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('WebAudio unavailable');
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const rng = createRng(seed);
      const buses = createBuses(ctx, rng.fork('buses'));
      buses.master.gain.value = muted ? 0 : 1;
      const ambience = createAmbience(ctx, buses.ambience, buses.reverb, rng.fork('ambience'), ctx.currentTime);
      const footsteps = createFootsteps(ctx, buses.sfx, buses.reverb, rng.fork('footsteps'), ctx.currentTime);
      const music = createMusic(ctx, buses.music, buses.reverb, rng.fork('music'), ctx.currentTime + 0.5);
      live = { ctx, buses, ambience, footsteps, music };
      music.ready.then((s) => (musicSource = s)).catch(() => undefined);
      pods = gatherPods(o.scene);
      fairyObjects = gatherFairies(o.scene);
      fairySlots.length = 0;
      for (let i = 0; i < fairyObjects.length; i++) fairySlots.push({ x: 0, y: 0, z: 0 });
      // Chrome's render-capacity monitor (AudioContext.renderCapacity): the only direct read on
      // whether the audio thread is missing its deadline, which is what a listener hears as the
      // music shaking. Absent elsewhere; the diagnostic just reports null then.
      const cap = (ctx as unknown as { renderCapacity?: { start(o: { updateInterval: number }): void; addEventListener(t: string, f: (e: RenderCapacityEvent) => void): void } }).renderCapacity;
      if (cap) {
        cap.addEventListener('update', (e: RenderCapacityEvent) => {
          load = { average: e.averageLoad, peak: e.peakLoad, underrun: e.underrunRatio };
        });
        cap.start({ updateInterval: 0.25 });
      }
      await ctx.resume().catch(() => undefined);
      console.info(`[audio] started (${ctx.sampleRate} Hz, ${pods.length} pod lanterns, ${fairyObjects.length} fairies)`);
      emit();
      lastT = 0;
      raf = requestAnimationFrame(tick);
    })();
    try {
      await starting;
    } finally {
      starting = null;
    }
  };

  // first gesture starts the context (pointer or key, once)
  const onGesture = () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    start().catch((e) => console.warn('[audio] start failed:', e));
  };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);

  const setMuted = (m: boolean) => {
    muted = m;
    if (live) live.buses.master.gain.setTargetAtTime(m ? 0 : 1, live.ctx.currentTime, 0.03);
    emit();
  };

  return {
    get started() {
      return !!live;
    },
    get muted() {
      return muted;
    },
    start,
    toggleMute: () => setMuted(!muted),
    setMuted,
    music: () => musicSource,
    stats: () => ({
      state: !live ? 'idle' : muted ? 'muted' : 'on',
      music: musicSource,
      pods: pods.length,
      gaitDriven,
      enclosure,
      canopy,
      fairySpots: fairyBuf.map((f) => [Number(f.x.toFixed(2)), Number(f.y.toFixed(2)), Number(f.z.toFixed(2))] as [number, number, number]),
      load,
      voices: liveVoices(),
      ...(live?.footsteps.stats() ?? { steps: 0, gaitSteps: 0, surfaces: {}, lastSurface: null, landings: 0 }),
      ...(live?.ambience.stats() ?? { birds: 0, flutters: 0, glints: 0, fairiesNear: 0, windLean: 0 }),
    }),
    renderOffline: (seconds, sampleRate = 44100, options) => renderOffline(o, seed, seconds, sampleRate, options),
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      if (live) {
        live.ambience.dispose();
        live.footsteps.dispose();
        live.music.dispose();
        live.ctx.close().catch(() => undefined);
        live = null;
      }
    },
  };
}

/**
 * Offline evidence render: the same graph in an OfflineAudioContext with the wind's gust
 * envelope (wind.ts) evaluated from time, the pods gathered from the scene, and the scripted walk
 * in `OFFLINE_WALK` — Link stands, crosses grass, trodden earth, flagstones, deck planks and the
 * log tunnel at a walk, runs on stone, stops. Exposed as
 * `window.__ZR_AUDIO__.renderOffline(seconds, rate, options)` by the shell so a headless page
 * (no gesture, no output device) can still produce the WAV; `options.stem` renders the ambience
 * bed or the footsteps alone so each can be measured without the other masking it.
 */
export async function renderOffline(o: AudioOptions, seed: string, seconds: number, sampleRate: number, options: OfflineOptions = {}): Promise<OfflineRender> {
  const stem = options.stem ?? 'mix';
  const withMusic = options.music ?? (stem === 'mix' || stem === 'music');
  const Ctor = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext unavailable');
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const rng = createRng(seed);
  const buses = createBuses(ctx, rng.fork('buses'));
  if (options.reverb === false) buses.reverbReturn.gain.value = 0;
  // every fork is drawn whatever the stem, so one part's stream never depends on another's presence
  const ambienceRng = rng.fork('ambience');
  const footstepsRng = rng.fork('footsteps');
  const musicRng = rng.fork('music');
  const ambience = stem === 'steps' || stem === 'music' ? null : createAmbience(ctx, buses.ambience, buses.reverb, ambienceRng, 0);
  const footsteps = stem === 'bed' || stem === 'music' ? null : createFootsteps(ctx, buses.sfx, buses.reverb, footstepsRng, 0);
  const music = withMusic ? createMusic(ctx, buses.music, buses.reverb, musicRng, 0.5) : null;
  const musicSource = music ? await music.ready : 'none';
  const pods = gatherPods(o.scene);
  // the fairies do not move in an offline render (nothing steps the character system), so one
  // sample of each is enough; the walk's last leg stands beside the nearest one so the glints are
  // in the evidence WAV — in play they are wherever their Kokiri is
  const fairies = gatherFairies(o.scene)
    .map((f) => fairyAt(f, { x: 0, y: 0, z: 0 }))
    .filter((v): v is Vec3 => !!v);
  // listener path: starts under the lantern bough (the plaza) and walks north-east
  const gust = (t: number) => {
    const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
    const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
    return Math.min(1, g * 0.8 + push * 0.6);
  };
  const step = 1 / 20;
  let x = 0;
  let z = 2;
  const lastLeg = OFFLINE_WALK[OFFLINE_WALK.length - 1];
  const standsBesideFairy = OFFLINE_WALK[OFFLINE_WALK.length - 2].until;
  for (let t = 0; t < seconds; t += step) {
    const leg = OFFLINE_WALK.find((l) => t < l.until) ?? lastLeg;
    x += leg.speed * step * 0.6;
    z -= leg.speed * step * 0.8;
    // the closing stand is beside a fairy, so its glints are in the evidence WAV
    const beside = t >= standsBesideFairy && fairies.length ? fairies[0] : null;
    const listener: Vec3 = beside ? { x: beside.x + 0.9, y: beside.y, z: beside.z + 0.5 } : { x, y: 1.2, z };
    // the walk's `leaf` leg IS the north forest floor, so it carries its closed canopy with it
    ambience?.update(t, { gust: gust(t), listener, forward: { x: 0.6, z: -0.8 }, pods, fairies, canopy: options.canopy ?? (leg.surface === 'leaf' ? 1 : 0), windDir: o.wind ? { x: o.wind.direction.x, z: o.wind.direction.y } : undefined });
    footsteps?.drive(t, step, { speed: leg.speed, surface: leg.surface, onStairs: !!leg.stairs });
  }
  ambience?.scheduleUntil(seconds);
  music?.scheduleUntil(seconds);
  const buffer = await ctx.startRendering();
  return { wav: encodeWav(buffer), music: musicSource };
}

/** 16-bit PCM WAV. */
export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = 44 + frames * channels * 2;
  const out = new ArrayBuffer(bytes);
  const v = new DataView(out);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, bytes - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
      off += 2;
    }
  }
  return new Uint8Array(out);
}

interface RenderCapacityEvent {
  averageLoad: number;
  peakLoad: number;
  underrunRatio: number;
}
