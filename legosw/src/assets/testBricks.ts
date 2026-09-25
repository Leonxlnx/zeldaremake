import type { Object3D } from 'three';
import { Builder } from '../core/builder';

/** Calibration build: every primitive in a few colours, to judge the plastic look. */
export function testBricks(): Object3D {
  const b = new Builder({ seed: 3 });
  b.plate('dbg', -6, -1, -6, 12, 12);
  b.brick('red', -5, 0, -4, 4, 2);
  b.brick('yellow', -1, 0, -4, 2, 2);
  b.brick('white', 1, 0, -4, 4, 2);
  b.brick('lbg', -5, 3, -4, 2, 2);
  b.brick('blue', -3, 3, -4, 4, 2);
  b.slope('lbg', -5, 0, -1, 2, 2, 3, 1);
  b.slope('red', -3, 0, -1, 2, 3, 3, 1);
  b.slope('white', 0, 0, -1, 3, 2, 3, 1);
  b.tile('black', 3, 0, -1, 2, 2);
  b.tile('tan', 3, 0, 1, 2, 2);
  b.cyl('flatSilver', 4, 1.2, -3, 0.9, 2.4, { radial: 32 });
  b.cyl('trBlue', 1.5, 1.8, 3, 0.9, 1.2, { radial: 32 });
  b.cyl('glowOrange', -2, 0.6, 3, 0.5, 1.2, { radial: 24 });
  b.cyl('trClear', -4.5, 0.6, 3, 0.8, 1.2, { radial: 24 });
  b.box('pearlGold', 4.5, 0.6, 3, 1.4, 1.2, 1.4);
  b.shape('darkRed', [[-6, 6], [-2, 6], [-6, 4.5]], 0, 0.4);
  b.studs('darkRed', -6, 1, 5, 1, 1);
  return b.build('test-bricks').group;
}
