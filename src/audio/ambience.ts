/**
 * Forest ambience bed (owner item 19): band-limited noise wind whose level follows the world's
 * wind gust, a high leaf-rustle layer fluttering on top of it, four synthesised bird calls on a
 * seeded schedule spread across the stereo field, and the pod lanterns' warm hum attenuated by
 * the listener's distance to the nearest pods. Everything is synthesised — no samples.
 */
import { adEnvelope, filter, gain, lfo, noiseBuffer, noiseSource, type Rng } from './graph';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AmbienceState {
  /** 0..1 world gust (wind.uniforms.uGust) */
  gust: number;
  /** listener (Link's sole or the camera) */
  listener: Vec3;
  /** listener's horizontal forward (unit xz) for panning */
  forward: { x: number; z: number };
  /** pod lantern positions (world) */
  pods: readonly Vec3[];
}

export interface Ambience {
  /** schedule every bird call up to time t (context seconds) */
  scheduleUntil(t: number): void;
  /** set the continuous parameters as of context time t */
  update(t: number, state: AmbienceState): void;
  dispose(): void;
}

type BirdKind = 'whistle' | 'trill' | 'chirps' | 'warble';
const BIRDS: BirdKind[] = ['whistle', 'trill', 'chirps', 'warble'];

export function createAmbience(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Ambience {
  const noise = noiseBuffer(ctx, rng.fork('bed'), 5);
  const nodes: AudioScheduledSourceNode[] = [];

  // ---- wind bed: two noise paths, a low rumble and a slow moving band ----------------------
  const windSrc = noiseSource(ctx, noise, startAt);
  nodes.push(windSrc);
  const windLow = filter(ctx, 'lowpass', 380, 0.6);
  const windBand = filter(ctx, 'bandpass', 760, 1.1);
  const windGain = gain(ctx, 0.16);
  const windBandGain = gain(ctx, 0.05);
  windSrc.connect(windLow).connect(windGain).connect(out);
  windSrc.connect(windBand).connect(windBandGain).connect(out);
  windGain.connect(reverbSend);
  nodes.push(lfo(ctx, windBand.frequency, 0.07, 260, 'sine', startAt));
  nodes.push(lfo(ctx, windBandGain.gain, 0.11, 0.025, 'sine', startAt));

  // ---- leaf rustle: high band, fluttering ------------------------------------------------
  const rustleSrc = noiseSource(ctx, noise, startAt + 1.3);
  nodes.push(rustleSrc);
  const rustleHp = filter(ctx, 'highpass', 2200, 0.7);
  const rustleBp = filter(ctx, 'bandpass', 4600, 0.9);
  const rustleGain = gain(ctx, 0.012);
  const flutter = gain(ctx, 1);
  rustleSrc.connect(rustleHp).connect(rustleBp).connect(flutter).connect(rustleGain).connect(out);
  rustleGain.connect(reverbSend);
  nodes.push(lfo(ctx, flutter.gain, 6.3, 0.45, 'triangle', startAt));
  nodes.push(lfo(ctx, flutter.gain, 0.9, 0.3, 'sine', startAt));

  // ---- pod lantern hum -------------------------------------------------------------------
  const humGain = gain(ctx, 0);
  const humPan = ctx.createStereoPanner();
  humGain.connect(humPan).connect(out);
  humGain.connect(reverbSend);
  const humLp = filter(ctx, 'lowpass', 900, 0.8);
  humLp.connect(humGain);
  for (const [f, g, type] of [
    [96, 0.5, 'sine'],
    [192.4, 0.24, 'sine'],
    [287.5, 0.09, 'triangle'],
    [384.8, 0.05, 'sine'],
  ] as [number, number, OscillatorType][]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const og = gain(ctx, g);
    o.connect(og).connect(humLp);
    nodes.push(lfo(ctx, o.detune, 0.23 + f / 900, 6 + f / 60, 'sine', startAt));
    o.start(startAt);
    nodes.push(o);
  }
  // wisp: a thin whistling partial, like a flame breathing inside the husk
  const wispSrc = noiseSource(ctx, noise, startAt + 0.7);
  nodes.push(wispSrc);
  const wisp = filter(ctx, 'bandpass', 1750, 9);
  const wispGain = gain(ctx, 0.05);
  wispSrc.connect(wisp).connect(wispGain).connect(humGain);
  nodes.push(lfo(ctx, wisp.frequency, 0.4, 180, 'sine', startAt));

  // ---- birds -----------------------------------------------------------------------------
  const birdRng = rng.fork('birds');
  let nextBird = startAt + 1.5 + birdRng() * 2;
  const birdCall = (kind: BirdKind, t: number, pan: number, level: number) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    const g = gain(ctx, 0);
    const hp = filter(ctx, 'highpass', 900, 0.7);
    g.connect(hp).connect(panner).connect(out);
    panner.connect(reverbSend);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.connect(g);
    let end = t;
    switch (kind) {
      case 'whistle': {
        // two descending notes
        for (let i = 0; i < 2; i++) {
          const s = t + i * 0.34;
          const f0 = 3150 - i * 260;
          osc.frequency.setValueAtTime(f0, s);
          osc.frequency.exponentialRampToValueAtTime(f0 * 0.78, s + 0.2);
          adEnvelope(g.gain, s, level, 0.02, 0.2);
        }
        end = t + 0.34 + 0.24;
        break;
      }
      case 'trill': {
        const n = 7 + Math.floor(birdRng() * 4);
        const f = 3300 + birdRng() * 400;
        osc.frequency.setValueAtTime(f, t);
        const mod = ctx.createOscillator();
        mod.frequency.value = 28;
        const md = gain(ctx, 240);
        mod.connect(md).connect(osc.frequency);
        mod.start(t);
        mod.stop(t + n * 0.055 + 0.1);
        for (let i = 0; i < n; i++) adEnvelope(g.gain, t + i * 0.055, level * (0.7 + 0.3 * Math.sin(i)), 0.006, 0.04);
        end = t + n * 0.055 + 0.1;
        break;
      }
      case 'chirps': {
        for (let i = 0; i < 3; i++) {
          const s = t + i * 0.17;
          osc.frequency.setValueAtTime(1900, s);
          osc.frequency.exponentialRampToValueAtTime(3400, s + 0.085);
          adEnvelope(g.gain, s, level, 0.008, 0.09);
        }
        end = t + 0.17 * 2 + 0.12;
        break;
      }
      case 'warble': {
        const f = 1450 + birdRng() * 200;
        osc.frequency.setValueAtTime(f, t);
        const vib = ctx.createOscillator();
        vib.frequency.value = 9.5;
        const vd = gain(ctx, 95);
        vib.connect(vd).connect(osc.frequency);
        vib.start(t);
        vib.stop(t + 1.6);
        g.gain.setValueAtTime(0.0005, t);
        g.gain.linearRampToValueAtTime(level * 0.8, t + 0.12);
        g.gain.setValueAtTime(level * 0.8, t + 1.0);
        g.gain.exponentialRampToValueAtTime(0.0005, t + 1.45);
        end = t + 1.5;
        break;
      }
    }
    osc.start(t);
    osc.stop(end + 0.05);
  };
  const scheduleUntil = (t: number) => {
    while (nextBird < t) {
      const kind = BIRDS[Math.floor(birdRng() * BIRDS.length)];
      const pan = (birdRng() * 2 - 1) * 0.85;
      const level = 0.035 + birdRng() * 0.07;
      birdCall(kind, nextBird, pan, level);
      // sometimes a second bird answers from the other side
      if (birdRng() < 0.3) birdCall(BIRDS[Math.floor(birdRng() * BIRDS.length)], nextBird + 1.2 + birdRng() * 0.8, -pan * 0.8, level * 0.7);
      nextBird += 3 + birdRng() * 6;
    }
  };

  const update = (t: number, s: AmbienceState) => {
    const gust = Math.max(0, Math.min(1, s.gust));
    windGain.gain.setTargetAtTime(0.11 + gust * 0.2, t, 0.35);
    windLow.frequency.setTargetAtTime(300 + gust * 320, t, 0.4);
    rustleGain.gain.setTargetAtTime(0.008 + gust * gust * 0.075, t, 0.2);
    // pods: summed inverse-square-ish attenuation, panned toward their weighted direction
    let sum = 0;
    let px = 0;
    let pz = 0;
    for (const p of s.pods) {
      const dx = p.x - s.listener.x;
      const dy = p.y - s.listener.y;
      const dz = p.z - s.listener.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const a = 1 / (1 + (d / 1.7) ** 2);
      sum += a;
      px += dx * a;
      pz += dz * a;
    }
    const level = Math.min(1, sum) * 0.11;
    humGain.gain.setTargetAtTime(level, t, 0.25);
    let pan = 0;
    if (sum > 1e-4) {
      // right = forward × up
      const rx = -s.forward.z;
      const rz = s.forward.x;
      const len = Math.hypot(px, pz) || 1;
      pan = Math.max(-1, Math.min(1, ((px * rx + pz * rz) / len) * 0.8));
    }
    humPan.pan.setTargetAtTime(pan, t, 0.3);
  };

  return {
    scheduleUntil,
    update,
    dispose() {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
    },
  };
}
