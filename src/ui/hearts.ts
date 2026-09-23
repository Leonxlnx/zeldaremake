/**
 * Life meter: three red hearts (reference bbox 0.045–0.10 × 0.056–0.078 → design px 60–132 × 40–56,
 * heart centres at x 72 / 96 / 120, y 48).
 */
import { svgRoot } from './svg';
import { heart, heartDefs } from './glyphs';

/** Design-space box of the hearts svg (1280 × 720 basis). */
export const HEARTS_BOX = { x: 58, y: 36, w: 76, h: 24 };

export function createHearts(count = 3): SVGSVGElement {
  const root = svgRoot([0, 0, HEARTS_BOX.w, HEARTS_BOX.h], { class: 'zr-hud-el zr-hud-hearts', 'aria-hidden': 'true' });
  root.appendChild(heartDefs());
  for (let i = 0; i < count; i++) root.appendChild(heart(2 + i * 24, 2));
  return root;
}
