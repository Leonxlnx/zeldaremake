/**
 * HUD (Phase 3) — owner: UI agent.
 *
 * Hearts top-left, item slot top-right, Kokiri Forest minimap bottom-right (rubric U01), drawn as
 * a DOM overlay (inline SVG, hand-drawn, no external assets) over the canvas so headless
 * screenshots include it. `?hud=0` disables it (handled by main.ts). The pause / equipment
 * screen (U02, U03) sits in the same overlay: `Escape` / `Tab` toggles it interactively and
 * `?screen=equipment` opens it on load (the only way it appears under headless capture).
 *
 * Determinism: nothing animates. The minimap marker follows `window.__ZR__.cameraPose()` when
 * present (a fixed default pose otherwise) and only touches the DOM when the pose changes, so
 * re-rendering the same viewpoint yields identical pixels.
 */
import { createHearts } from './hearts';
import { createItemSlot } from './itemSlot';
import { createMinimap, type MinimapPose } from './minimap';
import { createEquipmentScreen } from './equipment';
import { HUD_CSS, HUD_STYLE_ID } from './styles';

export type HudScreen = 'none' | 'equipment';

export interface HudHandle {
  setVisible(visible: boolean): void;
  dispose(): void;
  /** open / close a full-screen menu (the equipment screen for now) */
  setScreen?(screen: HudScreen): void;
  getScreen?(): HudScreen;
  /** root overlay element (tests / later systems may want to attach to it) */
  element?: HTMLElement;
}

export interface HudOptions {
  headless: boolean;
}

/** Camera B ("Saria's House") — used when the page has no `__ZR__` capture API. */
const DEFAULT_POSE: MinimapPose = { x: 0, z: 2, dx: 5 / 14.87, dz: -14 / 14.87 };

const DESIGN_W = 1280;
const DESIGN_H = 720;

function ensureStyle(): void {
  if (document.getElementById(HUD_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HUD_STYLE_ID;
  style.textContent = HUD_CSS;
  document.head.appendChild(style);
}

function readCameraPose(): MinimapPose {
  const api = window.__ZR__;
  if (!api || typeof api.cameraPose !== 'function') return DEFAULT_POSE;
  const p = api.cameraPose();
  if (!p || !Array.isArray(p.position) || !Array.isArray(p.direction)) return DEFAULT_POSE;
  const dx = Number(p.direction[0]) || 0;
  const dz = Number(p.direction[2]) || 0;
  const horiz = Math.hypot(dx, dz);
  return {
    x: Number(p.position[0]) || 0,
    z: Number(p.position[2]) || 0,
    // looking straight up/down has no heading; keep the map's default (north) rather than 0/0
    dx: horiz > 1e-4 ? dx / horiz : DEFAULT_POSE.dx,
    dz: horiz > 1e-4 ? dz / horiz : DEFAULT_POSE.dz,
  };
}

export function mountHud(host: HTMLElement, opts: HudOptions): HudHandle | null {
  if (typeof document === 'undefined' || !host) return null;
  try {
    return mount(host, opts);
  } catch (e) {
    console.warn('[hud] failed to mount:', e);
    return null;
  }
}

function mount(host: HTMLElement, opts: HudOptions): HudHandle {
  ensureStyle();
  const params = new URLSearchParams(location.search);

  const root = document.createElement('div');
  root.className = 'zr-hud';
  root.setAttribute('aria-hidden', 'true');
  root.dataset.visible = '1';
  root.dataset.screen = 'none';

  const hearts = createHearts(3);
  const item = createItemSlot(4);
  const minimap = createMinimap();
  root.appendChild(hearts);
  root.appendChild(item);
  root.appendChild(minimap.svg);

  const equipHost = document.createElement('div');
  equipHost.className = 'zr-equip';
  root.appendChild(equipHost);
  let equipBuilt = false;

  host.appendChild(root);

  // --- scale: 1 design px in host px ------------------------------------------------------------
  const applyScale = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    if (!w || !h) return;
    const u = Math.min(w / DESIGN_W, h / DESIGN_H);
    root.style.setProperty('--zr-u', `${u}px`);
  };
  applyScale();
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(applyScale);
    observer.observe(host);
  }
  window.addEventListener('resize', applyScale);

  // --- minimap marker follows the camera ------------------------------------------------------
  minimap.setPose(DEFAULT_POSE);
  let raf = 0;
  const tick = () => {
    try {
      minimap.setPose(readCameraPose());
    } catch {
      /* a broken cameraPose must never take the HUD down */
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  // --- screens ----------------------------------------------------------------------------------
  let screen: HudScreen = 'none';
  const setScreen = (s: HudScreen) => {
    if (s === 'equipment' && !equipBuilt) {
      equipHost.appendChild(createEquipmentScreen());
      equipBuilt = true;
    }
    screen = s;
    root.dataset.screen = s;
  };
  if (params.get('screen') === 'equipment') setScreen('equipment');

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Escape' || e.code === 'Tab') {
      e.preventDefault();
      setScreen(screen === 'equipment' ? 'none' : 'equipment');
    }
  };
  // Never under headless capture: only `?screen=equipment` may show a menu there.
  if (!opts.headless) window.addEventListener('keydown', onKey);

  return {
    element: root,
    setVisible: (v) => {
      root.dataset.visible = v ? '1' : '0';
    },
    setScreen,
    getScreen: () => screen,
    dispose: () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', applyScale);
      window.removeEventListener('keydown', onKey);
      root.remove();
      if (!document.querySelector('.zr-hud')) document.getElementById(HUD_STYLE_ID)?.remove();
    },
  };
}
