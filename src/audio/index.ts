/**
 * Audio system (round 47, lane shell-1, owner item 19). WebAudio, created on the first user
 * gesture (browser autoplay rules — nothing plays in a headless capture, which has no gesture),
 * with master / music / ambience / sfx buses, the M key and the HUD's speaker glyph for mute.
 *
 *   ambience.ts  — wind bed following the world's gust, leaf rustle, four synthesised bird calls
 *                  on a seeded schedule, the pod lanterns' hum attenuated by distance
 *   footsteps.ts — stone / grass steps from the player's speed and the terrain mask
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
import { getTerrain } from '../world/terrain/heightfield';
import { createBuses, createRng, type Buses } from './graph';
import { createAmbience, type Ambience, type Vec3 } from './ambience';
import { createFootsteps, type Footsteps, type Surface } from './footsteps';
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
  /** render `seconds` of the mix offline and return 16-bit stereo WAV bytes */
  renderOffline(seconds: number, sampleRate?: number): Promise<Uint8Array>;
  dispose(): void;
}

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

function surfaceAt(x: number, z: number): { surface: Surface; stairs: boolean } {
  const m = getTerrain().mask(x, z);
  return { surface: m.path > 0.5 || m.stairs > 0.5 ? 'stone' : 'grass', stairs: m.stairs > 0.5 };
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
    ambience.update(t, { gust: o.wind?.uniforms.uGust.value ?? 0.4, listener, forward: { x: fwd[0] / fl, z: fwd[2] / fl }, pods });
    ambience.scheduleUntil(ctx.currentTime + 4);
    music.scheduleUntil(ctx.currentTime + 6);
    // footsteps from the player's ground speed
    if (p && player?.playMode?.()) {
      if (Number.isFinite(lastPos.x)) {
        const speed = Math.hypot(p.x - lastPos.x, p.z - lastPos.z) / Math.max(dt, 1e-3);
        const s = surfaceAt(p.x, p.z);
        footsteps.drive(t, dt, speed, s.surface, s.stairs);
      }
      lastPos.x = p.x;
      lastPos.z = p.z;
    } else {
      lastPos.x = NaN;
      footsteps.drive(t, dt, 0, 'grass', false);
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
    renderOffline: (seconds, sampleRate = 44100) => renderOffline(o, seed, seconds, sampleRate),
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
 * envelope (wind.ts) evaluated from time, the pods gathered from the scene, and a scripted walk:
 * Link stands 2 s, walks on grass 6 s, on stone 6 s, runs 4 s, stops. Exposed as
 * `window.__ZR_AUDIO__.renderOffline(seconds)` by the shell so a headless page (no gesture, no
 * output device) can still produce the WAV.
 */
export async function renderOffline(o: AudioOptions, seed: string, seconds: number, sampleRate: number): Promise<Uint8Array> {
  const Ctor = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext unavailable');
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const rng = createRng(seed);
  const buses = createBuses(ctx, rng.fork('buses'));
  const ambience = createAmbience(ctx, buses.ambience, buses.reverb, rng.fork('ambience'), 0);
  const footsteps = createFootsteps(ctx, buses.sfx, buses.reverb, rng.fork('footsteps'), 0);
  const music = createMusic(ctx, buses.music, buses.reverb, rng.fork('music'), 0.5);
  await music.ready;
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
    let speed = 0;
    let surface: Surface = 'grass';
    if (t >= 2 && t < 8) speed = 1.6;
    else if (t >= 8 && t < 14) {
      speed = 1.6;
      surface = 'stone';
    } else if (t >= 14 && t < 18) {
      speed = 4.2;
      surface = 'stone';
    }
    x += speed * step * 0.6;
    z -= speed * step * 0.8;
    ambience.update(t, { gust: gust(t), listener: { x, y: 1.2, z }, forward: { x: 0.6, z: -0.8 }, pods });
    footsteps.drive(t, step, speed, surface, false);
  }
  ambience.scheduleUntil(seconds);
  music.scheduleUntil(seconds);
  const buffer = await ctx.startRendering();
  return encodeWav(buffer);
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
