/**
 * Game shell (round 47, lane shell-1): the bag's input bindings and the audio system's mount.
 * `mountShell` is the one call main.ts makes; everything else lives in src/ui and src/audio.
 *
 * Bag — owner item 6 ("reach into my bag — right-click or ZR"):
 *   right mouse button / gamepad ZR (button 7, standard mapping) / Tab / Escape toggle the
 *   equipment screen; ← → (arrows, A/D while open, d-pad 14/15, left stick) cycle the items;
 *   gamepad A (0) confirms, B (1) closes, the right stick spins the card; Enter confirms.
 *   Opening releases the pointer lock. While the screen is open `paused` is true and main.ts
 *   skips the world step (the character system does not advance); closing resumes.
 * Nothing here runs under headless capture: the screen then only opens via `?screen=equipment`.
 *
 * Audio — owner item 19: `mountAudio` (src/audio) starts on the first gesture, M mutes, the HUD's
 * speaker glyph shows the state.
 */
import type { Scene } from 'three';
import type { Wind } from '../world/wind/wind';
import type { HudHandle } from './hud';
import { mountAudio, renderOffline, AUDIO_SEED, type AudioHandle } from '../audio';

export interface ShellOptions {
  host: HTMLElement;
  hud: HudHandle | null;
  scene: Scene;
  headless: boolean;
  /** the world's shared wind (leaf rustle follows its gust) */
  wind?: Wind | null;
}

export interface ShellHandle {
  /** true while a full-screen menu is open: the world step is skipped */
  readonly paused: boolean;
  audio: AudioHandle | null;
  dispose(): void;
}

/** standard-mapping gamepad buttons */
const GP = { A: 0, B: 1, X: 2, Y: 3, ZL: 6, ZR: 7, DPAD_LEFT: 14, DPAD_RIGHT: 15 } as const;

export function mountShell(o: ShellOptions): ShellHandle {
  const { hud, host, headless } = o;
  let paused = false;
  const disposers: (() => void)[] = [];

  const screenOpen = () => hud?.getScreen?.() === 'equipment';
  const setOpen = (on: boolean) => {
    if (!hud?.setScreen) return;
    if (on === screenOpen()) return;
    if (on && document.pointerLockElement) document.exitPointerLock();
    hud.setScreen(on ? 'equipment' : 'none');
  };
  hud?.onScreenChange?.((s) => {
    paused = s !== 'none';
  });
  paused = screenOpen();

  const audio = headless ? null : mountAudio({ scene: o.scene, wind: o.wind ?? null, onState: (s) => hud?.setAudioState?.(s) });
  if (audio) hud?.onSpeakerClick?.(() => audio.toggleMute());
  // evidence hook: the same mix rendered offline (works headless — no gesture, no output device)
  (window as unknown as { __ZR_AUDIO__?: unknown }).__ZR_AUDIO__ = {
    renderOffline: (seconds = 20, sampleRate = 44100, options = {}) => renderOffline({ scene: o.scene, wind: o.wind ?? null }, AUDIO_SEED, seconds, sampleRate, options),
    music: () => audio?.music() ?? 'none',
  };

  if (!headless && hud) {
    // --- right mouse button: capture phase so the follow camera's drag never starts on it ------
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      if (!host.contains(e.target as Node)) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(!screenOpen());
    };
    const onContextMenu = (e: MouseEvent) => {
      if (host.contains(e.target as Node)) e.preventDefault();
    };
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('contextmenu', onContextMenu);
    disposers.push(() => window.removeEventListener('pointerdown', onPointerDown, { capture: true }), () => window.removeEventListener('contextmenu', onContextMenu));

    // --- keys while the bag is open (capture phase: the follow camera must not see the arrows) --
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyM') {
        audio?.toggleMute();
        return;
      }
      if (!screenOpen()) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
        hud.cycleItem?.(-1);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyE') {
        hud.cycleItem?.(1);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        hud.spinItem?.(0, -2.5);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        hud.spinItem?.(0, 2.5);
      } else if (e.code === 'KeyR') {
        hud.spinItem?.(6);
      } else if (e.code === 'Enter' || e.code === 'Space') {
        setOpen(false);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    disposers.push(() => window.removeEventListener('keydown', onKeyDown, { capture: true }));

    // --- gamepad: polled on its own rAF (never the world's loop) -----------------------------
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      const prev = new Map<number, boolean[]>();
      let axisLatch = 0;
      let raf = 0;
      const poll = (now: number) => {
        const pads = navigator.getGamepads();
        for (const pad of pads) {
          if (!pad) continue;
          const was = prev.get(pad.index) ?? [];
          const pressed = (i: number) => !!pad.buttons[i]?.pressed;
          const rising = (i: number) => pressed(i) && !was[i];
          if (rising(GP.ZR)) setOpen(!screenOpen());
          if (screenOpen()) {
            if (rising(GP.DPAD_LEFT)) hud.cycleItem?.(-1);
            if (rising(GP.DPAD_RIGHT)) hud.cycleItem?.(1);
            if (rising(GP.B)) setOpen(false);
            if (rising(GP.A)) setOpen(false);
            if (rising(GP.Y)) audio?.toggleMute();
            const lx = pad.axes[0] ?? 0;
            if (Math.abs(lx) > 0.6 && now > axisLatch) {
              hud.cycleItem?.(lx > 0 ? 1 : -1);
              axisLatch = now + 320;
            }
            const rx = pad.axes[2] ?? 0;
            const ry = pad.axes[3] ?? 0;
            if (Math.abs(rx) > 0.15 || Math.abs(ry) > 0.15) hud.spinItem?.(rx * 0.25, ry * 0.12);
          }
          prev.set(
            pad.index,
            pad.buttons.map((b) => b.pressed),
          );
        }
        raf = requestAnimationFrame(poll);
      };
      raf = requestAnimationFrame(poll);
      disposers.push(() => cancelAnimationFrame(raf));
    }
  }

  return {
    get paused() {
      return paused;
    },
    audio,
    dispose() {
      for (const d of disposers) d();
      audio?.dispose();
    },
  };
}
