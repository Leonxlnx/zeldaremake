/**
 * HUD stylesheet, injected once by `mountHud`. Element boxes are the reference boxes measured on
 * the 1280 × 720 frames: positions are fractions of the host so they land on the same screen
 * fractions at any size; sizes scale with `--zr-u` = one design px = min(hostW / 1280, hostH / 720)
 * (a length; `mountHud` refreshes it from the host's real size on resize).
 */
import { HEARTS_BOX } from './hearts';
import { ITEM_BOX } from './itemSlot';
import { MAP_BOX } from './minimap';

const pct = (v: number, total: number) => `${((v / total) * 100).toFixed(4)}%`;
const box = (b: { x: number; y: number; w: number; h: number }) =>
  `left:${pct(b.x, 1280)};top:${pct(b.y, 720)};width:calc(${b.w} * var(--zr-u));height:calc(${b.h} * var(--zr-u));`;

export const HUD_STYLE_ID = 'zr-hud-style';

export const HUD_CSS = `
.zr-hud{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;user-select:none;
  --zr-u:min(calc(100vw / 1280), calc(100vh / 720));}
.zr-hud[data-visible="0"]{visibility:hidden}
.zr-hud .zr-hud-el{position:absolute;display:block;overflow:visible}
.zr-hud[data-screen="equipment"] .zr-hud-el{visibility:hidden}
.zr-hud-hearts{${box(HEARTS_BOX)}}
.zr-hud-item{${box(ITEM_BOX)}}
.zr-hud-map{${box(MAP_BOX)}}
.zr-equip{position:absolute;inset:0;display:none;background:#171108;pointer-events:none}
.zr-hud[data-screen="equipment"] .zr-equip{display:block}
.zr-equip .zr-equip-svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.zr-equip text{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
`;
