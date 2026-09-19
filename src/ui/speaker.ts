/**
 * Speaker glyph (top-left, under the hearts): the audio system's state — `idle` (no gesture yet:
 * dim, a small dot instead of the waves), `on` (two sound arcs), `muted` (a slash). Hand-drawn
 * svg in the HUD's style; clicking it toggles mute. Mounted only in interactive sessions, so the
 * gauntlet's captures never see it (hud.ts).
 */
import { svgRoot, g, path, circle, line } from './svg';

export type SpeakerState = 'idle' | 'on' | 'muted';

/** Design-space box (1280 × 720 basis). */
export const SPEAKER_BOX = { x: 58, y: 66, w: 30, h: 22 };

export interface Speaker {
  svg: SVGSVGElement;
  setState(state: SpeakerState): void;
}

export function createSpeaker(onClick: () => void): Speaker {
  const root = svgRoot([0, 0, SPEAKER_BOX.w, SPEAKER_BOX.h], { class: 'zr-hud-el zr-hud-speaker', 'aria-hidden': 'true' });
  const ink = '#f3f0e8';
  const outline = '#15120e';
  // the cone: a small box with a flared horn
  const cone = 'M3 8.5 H7.5 L12.5 4 V18 L7.5 13.5 H3 Z';
  const body = g({}, [
    path(cone, { fill: outline, stroke: outline, 'stroke-width': 3.2, 'stroke-linejoin': 'round' }),
    path(cone, { fill: ink, stroke: '#3d352b', 'stroke-width': 0.6, 'stroke-linejoin': 'round' }),
  ]);
  const waves = g({ class: 'zr-speaker-waves' }, [
    path('M16 7.5 C 18 9, 18 13, 16 14.5', { fill: 'none', stroke: outline, 'stroke-width': 3.6, 'stroke-linecap': 'round' }),
    path('M19.5 5 C 23 8, 23 14, 19.5 17', { fill: 'none', stroke: outline, 'stroke-width': 3.6, 'stroke-linecap': 'round' }),
    path('M16 7.5 C 18 9, 18 13, 16 14.5', { fill: 'none', stroke: ink, 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    path('M19.5 5 C 23 8, 23 14, 19.5 17', { fill: 'none', stroke: ink, 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
  ]);
  const dot = g({ class: 'zr-speaker-dot' }, [circle(17.5, 11, 2.2, { fill: outline }), circle(17.5, 11, 1.2, { fill: ink })]);
  const slash = g({ class: 'zr-speaker-slash' }, [
    line(15, 16, 24, 6, { stroke: outline, 'stroke-width': 4, 'stroke-linecap': 'round' }),
    line(15, 16, 24, 6, { stroke: '#e8574a', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
  ]);
  root.appendChild(body);
  root.appendChild(waves);
  root.appendChild(dot);
  root.appendChild(slash);
  root.style.cursor = 'pointer';
  root.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  const setState = (s: SpeakerState) => {
    root.dataset.state = s;
    waves.style.display = s === 'on' ? '' : 'none';
    dot.style.display = s === 'idle' ? '' : 'none';
    slash.style.display = s === 'muted' ? '' : 'none';
    root.style.opacity = s === 'on' ? '0.92' : '0.6';
  };
  setState('idle');
  return { svg: root, setState };
}
