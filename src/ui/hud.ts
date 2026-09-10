/**
 * HUD (Phase 3) — owner: UI agent.
 *
 * Hearts top-left, item slot top-right, Kokiri Forest minimap bottom-right (rubric U01), drawn as a
 * DOM overlay over the canvas so headless screenshots include it. `?hud=0` disables it.
 *
 * Stub: mounts nothing yet.
 */
export interface HudHandle {
  setVisible(visible: boolean): void;
  dispose(): void;
}

export function mountHud(_host: HTMLElement, _opts: { headless: boolean }): HudHandle | null {
  return null;
}
