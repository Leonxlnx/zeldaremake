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
import { EXPANSION, LAYOUT } from '../world/layout';
import { createBuses, createRng, type Buses } from './graph';
import { createAmbience, type Ambience, type Vec3 } from './ambience';
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

export interface AudioStats extends FootstepStats {
  state: AudioState;
  music: MusicSource;
  /** pod lanterns found in the scene (the flame's distance sources) */
  pods: number;
  /** true while the character system is reporting the gait's boot plants */
  gaitDriven: boolean;
  /** how closed the space over the listener is — 1 inside the log tunnel's bore, 0 in the open */
  enclosure: number;
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
export function surfaceAt(x: number, z: number): { surface: Surface; stairs: boolean; enclosure: number } {
  const m = surfaceMask(x, z, 'live');
  if (m.stairs > 0.5) return { surface: 'stone', stairs: true, enclosure: 0 };
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
      return { surface: 'hollow', stairs: false, enclosure: Math.max(0, Math.min(1, Math.min(fromMouth, fromWall))) };
    }
  }
  // the west house's platform and deck
  {
    const wh = EXPANSION.westHouse;
    const hx = wh.host[0];
    const hz = wh.host[1];
    if (Math.hypot(x - hx, z - hz) < wh.radius) return { surface: 'wood', stairs: false, enclosure: 0 };
    const ex = wh.deckEnd[0];
    const ez = wh.deckEnd[2];
    const ax = ex - hx;
    const az = ez - hz;
    const len = Math.hypot(ax, az) || 1;
    const t = ((x - hx) * ax + (z - hz) * az) / (len * len);
    if (t > 0 && t < 1) {
      const px = hx + ax * t;
      const pz = hz + az * t;
      if (Math.hypot(x - px, z - pz) < 0.475) return { surface: 'wood', stairs: false, enclosure: 0 };
    }
  }
  if (m.path > 0.5) return { surface: 'stone', stairs: false, enclosure: 0 };
  if (m.path > 0.12) return { surface: 'dirt', stairs: false, enclosure: 0 };
  if (forestFloorZone(x, z) > 0.5) return { surface: 'leaf', stairs: false, enclosure: 0 };
  return { surface: 'grass', stairs: false, enclosure: 0 };
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
  let gaitDriven = false;
  let enclosure = 0;
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
    const fwd = pose?.direction ?? [0, 0, -1];
    const fl = Math.hypot(fwd[0], fwd[2]) || 1;
    // one ground lookup a frame, shared by the bed's enclosure and the boots' surface
    const s = surfaceAt(listener.x, listener.z);
    enclosure = s.enclosure;
    ambience.update(t, { gust: o.wind?.uniforms.uGust.value ?? 0.4, listener, forward: { x: fwd[0] / fl, z: fwd[2] / fl }, pods, enclosure: s.enclosure });
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
      await ctx.resume().catch(() => undefined);
      console.info(`[audio] started (${ctx.sampleRate} Hz, ${pods.length} pod lanterns)`);
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
      ...(live?.footsteps.stats() ?? { steps: 0, gaitSteps: 0, surfaces: {}, lastSurface: null, landings: 0 }),
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
  // listener path: starts under the lantern bough (the plaza) and walks north-east
  const gust = (t: number) => {
    const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
    const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
    return Math.min(1, g * 0.8 + push * 0.6);
  };
  const step = 1 / 20;
  let x = 0;
  let z = 2;
  for (let t = 0; t < seconds; t += step) {
    const leg = OFFLINE_WALK.find((l) => t < l.until) ?? OFFLINE_WALK[OFFLINE_WALK.length - 1];
    x += leg.speed * step * 0.6;
    z -= leg.speed * step * 0.8;
    ambience?.update(t, { gust: gust(t), listener: { x, y: 1.2, z }, forward: { x: 0.6, z: -0.8 }, pods });
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
