/**
 * HUD (Phase 3) — owner: UI agent.
 *
 * Hearts top-left, item slot top-right, Kokiri Forest minimap bottom-right (rubric U01), drawn as
 * a DOM overlay (inline SVG, hand-drawn, no external assets) over the canvas so headless
 * screenshots include it. `?hud=0` disables it (handled by main.ts). The pause / equipment
 * screen (U02, U03) sits in the same overlay: `Escape` / `Tab` toggles it interactively and
 * `?screen=equipment` opens it on load (the only way it appears under headless capture;
 * `&item=<id>` picks the item shown).
 *
 * The bag (round 47, owner item 6): the equipment screen's centre oval is the ref-02 card — the
 * selected item rendered in 3-D by `itemCard.ts` with its name underneath; ← / → cycle the six
 * items (`items/index.ts`), the chosen one lands in the top-right slot. Right mouse / gamepad ZR /
 * Tab open it (`shell.ts`); the world's step is skipped while it is open (main.ts).
 *
 * Determinism: nothing animates under headless capture. The minimap marker follows
 * `window.__ZR__.cameraPose()` when present (a fixed default pose otherwise) and only touches the
 * DOM when the pose changes; the item card renders a fixed pose there, so re-rendering the same
 * viewpoint yields identical pixels. The speaker glyph (audio state) is only mounted in
 * interactive sessions or with `?hud=1`, never in a default capture.
 */
import { createHearts } from './hearts';
import { createItemSlot } from './itemSlot';
import { createMinimap, type MinimapPose } from './minimap';
import { createEquipmentScreen, CARD_BOX, GRID_COLS, GRID_ROWS, type EquipmentScreen } from './equipment';
import { createItemCard, type ItemCard } from './itemCard';
import { createSpeaker, type Speaker, type SpeakerState } from './speaker';
import { DEFAULT_ITEM, ITEMS, itemById, itemIndex, type ItemId } from './items';
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
  /** the bag: the item in the slot / on the card */
  selectItem?(id: ItemId): void;
  cycleItem?(dir: 1 | -1): void;
  selectedItem?(): ItemId;
  /** spin the card (drag / right stick) */
  spinItem?(dYaw: number, dPitch?: number): void;
  /** audio glyph (absent under a default headless capture) */
  setAudioState?(state: SpeakerState): void;
  /** register the speaker glyph's click */
  onSpeakerClick?(cb: () => void): void;
  /** register a listener for screen changes (the shell pauses the sim on it) */
  onScreenChange?(cb: (screen: HudScreen) => void): void;
}

export interface HudOptions {
  headless: boolean;
}

/** Camera B ("Saria's House") — used when the page has no `__ZR__` capture API. */
const DEFAULT_POSE: MinimapPose = { x: 0, z: 2, dx: 5 / 14.87, dz: -14 / 14.87 };

const DESIGN_W = 1280;
const DESIGN_H = 720;
/** grid thumbnail side (design px) */
const THUMB = 72;

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
  let screen: HudScreen = 'none';

  const hearts = createHearts(3);
  const slot = createItemSlot(4);
  const minimap = createMinimap();
  root.appendChild(hearts);
  root.appendChild(slot.svg);
  root.appendChild(slot.thumbHost);
  root.appendChild(minimap.svg);

  // the audio glyph is interactive-only (or explicitly `?hud=1`): a default capture never sees it
  let speaker: Speaker | null = null;
  let speakerClick: (() => void) | null = null;
  if (!opts.headless || params.get('hud') === '1') {
    speaker = createSpeaker(() => speakerClick?.());
    root.appendChild(speaker.svg);
  }

  const equipHost = document.createElement('div');
  equipHost.className = 'zr-equip';
  root.appendChild(equipHost);
  let equip: EquipmentScreen | null = null;
  let stage: HTMLDivElement | null = null;
  let card: ItemCard | null = null;
  const thumbs = new Map<ItemId, HTMLDivElement>();

  host.appendChild(root);

  // --- scale: 1 design px in host px ------------------------------------------------------------
  let u = 1;
  let s = 1;
  const applyScale = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    if (!w || !h) return;
    u = Math.min(w / DESIGN_W, h / DESIGN_H);
    s = Math.max(w / DESIGN_W, h / DESIGN_H);
    root.style.setProperty('--zr-u', `${u}px`);
    root.style.setProperty('--zr-s', `${s}`);
    if (card && screen === 'equipment') card.setSize(CARD_BOX.w * s * devicePixelRatio, CARD_BOX.h * s * devicePixelRatio);
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

  // --- the bag: items, card, slot -------------------------------------------------------------
  let selected: ItemId = DEFAULT_ITEM;
  const screenListeners: ((s: HudScreen) => void)[] = [];

  const buildEquipment = () => {
    if (equip) return;
    equip = createEquipmentScreen();
    equipHost.appendChild(equip.svg);
    stage = document.createElement('div');
    stage.className = 'zr-equip-stage';
    equipHost.appendChild(stage);
    card = createItemCard({ headless: opts.headless });
    if (card) {
      stage.appendChild(card.canvas);
      card.setSize(CARD_BOX.w * s * devicePixelRatio, CARD_BOX.h * s * devicePixelRatio);
      // grid thumbnails (rows 0–1)
      for (const def of ITEMS) {
        const [row, col] = def.cell;
        const cell = document.createElement('div');
        cell.className = 'zr-bag-thumb';
        cell.style.left = `${GRID_COLS[col] - THUMB / 2}px`;
        cell.style.top = `${GRID_ROWS[row].cy - THUMB / 2}px`;
        cell.style.width = `${THUMB}px`;
        cell.style.height = `${THUMB}px`;
        cell.appendChild(card.thumbnail(def.id, Math.round(THUMB * s * devicePixelRatio)));
        cell.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          selectItem(def.id);
        });
        stage.appendChild(cell);
        thumbs.set(def.id, cell);
      }
      // drag on the card spins the item (interactive only)
      if (!opts.headless) {
        let dragging = false;
        let lx = 0;
        let ly = 0;
        card.canvas.addEventListener('pointerdown', (e) => {
          dragging = true;
          lx = e.clientX;
          ly = e.clientY;
          e.stopPropagation();
          e.preventDefault();
        });
        window.addEventListener('pointermove', (e) => {
          if (!dragging) return;
          card?.spin((e.clientX - lx) * 0.06, (e.clientY - ly) * 0.03);
          lx = e.clientX;
          ly = e.clientY;
        });
        window.addEventListener('pointerup', () => (dragging = false));
      }
    }
    applyItem();
  };

  const applyItem = () => {
    const def = itemById(selected) ?? ITEMS[0];
    if (equip) {
      equip.setText(def.name, def.description);
      equip.setEquipped(def.cell[0], def.cell[1]);
      equip.setBrowsed(def.cell[0], def.cell[1]);
    }
    card?.setItem(def.id);
    if (def.id === DEFAULT_ITEM || !card) slot.set('stick', def.id === DEFAULT_ITEM ? def.count : undefined, null);
    else slot.set('thumb', def.count, card.thumbnail(def.id, Math.max(16, Math.round((72 * u || 72) * devicePixelRatio))));
  };

  const selectItem = (id: ItemId) => {
    if (!itemById(id)) return;
    selected = id;
    if (id !== DEFAULT_ITEM && !card) buildEquipment();
    applyItem();
  };

  // --- screens ----------------------------------------------------------------------------------
  const setScreen = (next: HudScreen) => {
    if (next === screen) return;
    if (next === 'equipment') buildEquipment();
    screen = next;
    root.dataset.screen = next;
    if (card) {
      if (next === 'equipment') card.setSize(CARD_BOX.w * s * devicePixelRatio, CARD_BOX.h * s * devicePixelRatio);
      card.setActive(next === 'equipment');
    }
    for (const cb of screenListeners) cb(next);
  };
  if (params.get('screen') === 'equipment') {
    const want = itemById(params.get('item'));
    if (want) selected = want.id;
    setScreen('equipment');
  }

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
    selectItem,
    cycleItem: (dir) => {
      const i = itemIndex(selected);
      selectItem(ITEMS[(i + dir + ITEMS.length) % ITEMS.length].id);
    },
    selectedItem: () => selected,
    spinItem: (dy, dp) => card?.spin(dy, dp),
    setAudioState: (state) => speaker?.setState(state),
    onSpeakerClick: (cb) => {
      speakerClick = cb;
    },
    onScreenChange: (cb) => {
      screenListeners.push(cb);
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', applyScale);
      window.removeEventListener('keydown', onKey);
      card?.dispose();
      root.remove();
      if (!document.querySelector('.zr-hud')) document.getElementById(HUD_STYLE_ID)?.remove();
    },
  };
}
