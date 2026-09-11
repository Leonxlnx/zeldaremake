/** Opt-in CI driver for the actual player. Normal/fixed gauntlet captures never install it. */
import type { PlayerHandle, PlayerInput } from './player';

declare global {
  interface Window {
    __ZR_PLAYER__?: { reset(): void; input(value: PlayerInput): void; advance(seconds: number): void };
  }
}

export function installPlayerCapture(player: PlayerHandle, advance: (seconds: number) => void) {
  window.__ZR_PLAYER__ = {
    reset: () => player.setPlayMode(true),
    input: value => player.setInput(value),
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) throw new Error('capture advance must be 0–5 seconds');
      advance(seconds);
    },
  };
}
