/**
 * Footsteps: synthesised stone / grass steps driven by the player's ground speed and the
 * terrain mask under him (path / stairs = stone, everything else = grass). The character system
 * publishes only `scene.userData.player` (position + heading), so the stride is integrated from
 * the distance travelled: a step every `strideM` (walk 0.68 m, run 0.95 m), alternating a little
 * left / right in the stereo field.
 */
import { adEnvelope, filter, gain, noiseBuffer, noiseSource, type Rng } from './graph';

export type Surface = 'stone' | 'grass';

export interface Footsteps {
  /** one step at context time t */
  step(surface: Surface, t: number, strength: number, pan: number): void;
  /** integrate the player's motion; `t` is the context time the step would sound at */
  drive(t: number, dt: number, speed: number, surface: Surface, onStairs: boolean): void;
  dispose(): void;
}

export function createFootsteps(ctx: BaseAudioContext, out: AudioNode, reverbSend: AudioNode, rng: Rng, startAt = 0): Footsteps {
  const noise = noiseBuffer(ctx, rng.fork('steps'), 2);
  const src = noiseSource(ctx, noise, startAt);
  // one always-running noise source; each step opens a short gate on its own filter chain
  const stepRng = rng.fork('stepjitter');

  const stone = (t: number, k: number, pan: number) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    panner.connect(reverbSend);
    // heel: bright gritty click
    const bp = filter(ctx, 'bandpass', 1500 + stepRng() * 500, 1.1);
    const g1 = gain(ctx, 0);
    src.connect(bp).connect(g1).connect(panner);
    adEnvelope(g1.gain, t, 0.28 * k, 0.003, 0.06 + stepRng() * 0.02);
    // body: a short low tock
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(85, t + 0.05);
    const g2 = gain(ctx, 0);
    osc.connect(g2).connect(panner);
    adEnvelope(g2.gain, t, 0.22 * k, 0.002, 0.07);
    osc.start(t);
    osc.stop(t + 0.15);
    // toe: tiny high tick a moment later
    const hp = filter(ctx, 'highpass', 4200, 0.7);
    const g3 = gain(ctx, 0);
    src.connect(hp).connect(g3).connect(panner);
    adEnvelope(g3.gain, t + 0.045 + stepRng() * 0.02, 0.07 * k, 0.002, 0.03);
    const end = t + 0.3;
    // disconnect the gates once silent so the graph does not grow
    setTimeoutCtx(ctx, end, () => {
      src.disconnect(bp);
      src.disconnect(hp);
      g1.disconnect();
      g2.disconnect();
      g3.disconnect();
      bp.disconnect();
      hp.disconnect();
      panner.disconnect();
    });
  };

  const grass = (t: number, k: number, pan: number) => {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    panner.connect(reverbSend);
    const bp = filter(ctx, 'bandpass', 850 + stepRng() * 250, 0.55);
    const lp = filter(ctx, 'lowpass', 2600, 0.7);
    const g1 = gain(ctx, 0);
    src.connect(bp).connect(lp).connect(g1).connect(panner);
    adEnvelope(g1.gain, t, 0.2 * k, 0.012, 0.11 + stepRng() * 0.03);
    // the brush of blades springing back
    const hp = filter(ctx, 'highpass', 1800, 0.6);
    const g2 = gain(ctx, 0);
    src.connect(hp).connect(g2).connect(panner);
    adEnvelope(g2.gain, t + 0.05, 0.06 * k, 0.02, 0.09);
    const end = t + 0.35;
    setTimeoutCtx(ctx, end, () => {
      src.disconnect(bp);
      src.disconnect(hp);
      g1.disconnect();
      g2.disconnect();
      bp.disconnect();
      lp.disconnect();
      hp.disconnect();
      panner.disconnect();
    });
  };

  const step = (surface: Surface, t: number, strength: number, pan: number) => {
    if (surface === 'stone') stone(t, strength, pan);
    else grass(t, strength, pan);
  };

  let travelled = 0;
  let side = 1;
  let moving = false;
  const drive = (t: number, dt: number, speed: number, surface: Surface, onStairs: boolean) => {
    if (speed < 0.25) {
      // stopped: the next step starts fresh
      if (moving) travelled = 0;
      moving = false;
      return;
    }
    if (!moving) {
      // first step lands right away
      moving = true;
      travelled = 0;
      step(onStairs ? 'stone' : surface, t, Math.min(1, 0.55 + speed * 0.12), side * 0.12);
      side = -side;
    }
    travelled += speed * dt;
    const stride = onStairs ? 0.5 : speed > 2.6 ? 0.95 : 0.68;
    if (travelled >= stride) {
      travelled -= stride;
      step(onStairs ? 'stone' : surface, t, Math.min(1, 0.55 + speed * 0.12), side * 0.12);
      side = -side;
    }
  };

  return {
    step,
    drive,
    dispose() {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

/** run `fn` once the context clock has passed `when` (a plain timer live; a no-op offline — the graph is discarded after rendering). */
function setTimeoutCtx(ctx: BaseAudioContext, when: number, fn: () => void) {
  if (typeof (ctx as OfflineAudioContext).startRendering === 'function') return;
  const ms = Math.max(0, (when - ctx.currentTime) * 1000 + 50);
  setTimeout(fn, ms);
}
