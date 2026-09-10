/**
 * Kokiri Forest minimap (bottom-right, reference 0.79–0.97 × 0.78–0.95): a hand-drawn,
 * semi-transparent ink-and-wash map — olive ground blobs with brown ink outlines, dark tree
 * circles, the Deku Tree meadow as a big circle joined by a narrow neck, parchment paths (the
 * Lost Woods trail heading off left, the stepped corridor to the bridge at the bottom-left), the
 * pond in grey-blue, the shop as an orange ring — with a red arrow for the player and a
 * translucent yellow view cone that follow the camera.
 *
 * All coordinates are 1280 × 720 design px (the svg's viewBox is the map's own design box).
 */
import { svgRoot, g, path, circle, ellipse, line, smoothClosedPath, smoothOpenPath, fmt } from './svg';

/** Design-space box of the minimap svg (1280 × 720 basis). */
export const MAP_BOX = { x: 960, y: 540, w: 320, h: 180 };

export interface MinimapPose {
  /** world xz of the player/camera (metres) */
  x: number;
  z: number;
  /** horizontal facing direction in world xz */
  dx: number;
  dz: number;
}

export interface Minimap {
  svg: SVGSVGElement;
  setPose(p: MinimapPose): void;
}

// Where world (0,0) — the plaza — lands on the map, in design px, and how many px one metre is.
// World north (−Z) points to the upper-left of the map, as in the reference (Link on the plaza
// looks north-west along the map toward the stairs / Lost Woods side).
// The reference marker sits at (0.822, 0.837) with Link a few metres north of camera B, so the
// world point (0, 3) lands there.
const SCALE = 1.0;
const ROT = -Math.PI / 4;
const MAX_RADIUS = 58;
const ANCHOR_WORLD: [number, number] = [0, 3];
const ANCHOR_MAP: [number, number] = [1051.6, 602.6];

export function worldToMap(x: number, z: number): [number, number] {
  const c = Math.cos(ROT);
  const s = Math.sin(ROT);
  const ax = x - ANCHOR_WORLD[0];
  const az = z - ANCHOR_WORLD[1];
  // east → +x on screen, south (+z) → +y on screen, then rotate the whole map
  let mx = SCALE * (ax * c - az * s);
  let my = SCALE * (ax * s + az * c);
  const r = Math.hypot(mx, my);
  if (r > MAX_RADIUS) {
    mx *= MAX_RADIUS / r;
    my *= MAX_RADIUS / r;
  }
  return [ANCHOR_MAP[0] + mx, ANCHOR_MAP[1] + my];
}

/** Screen heading (degrees, 0 = up, clockwise) of a world xz direction. */
export function worldHeadingDeg(dx: number, dz: number): number {
  const c = Math.cos(ROT);
  const s = Math.sin(ROT);
  const sx = dx * c - dz * s;
  const sy = dx * s + dz * c;
  return (Math.atan2(sx, -sy) * 180) / Math.PI;
}

// Colours are chosen for the composited look measured on the reference (the map is translucent):
// ground reads #a19248, tree circles #5a5c24, the meadow circle #5b5f1f, ink #5c5323, the
// corridor parchment #a69265, the cone #dac67d.
const INK = '#4a4018';
const GROUND = '#aa9e4c';
const GROUND_DEEP = '#8a8a3a';
const TREE = '#565a20';
const MEADOW = '#5c6022';
const PARCHMENT = '#b8a86c';

export function createMinimap(): Minimap {
  const root = svgRoot([MAP_BOX.x, MAP_BOX.y, MAP_BOX.w, MAP_BOX.h], { class: 'zr-hud-el zr-hud-map', 'aria-hidden': 'true' });

  // --- ground: the village blob (traced from the reference, clockwise from the top-left) --------
  const village: [number, number][] = [
    [1025, 568],
    [1031, 562],
    [1049, 559],
    [1068, 557],
    [1082, 564],
    [1095.5, 572],
    [1106.5, 580.5],
    [1117.5, 584.5],
    [1123, 594.5],
    [1128.5, 608],
    [1139.5, 622],
    [1150.5, 630.5],
    [1150.5, 638.5],
    [1142.5, 644],
    [1135.5, 656],
    [1123, 660],
    [1109.5, 662.5],
    [1095.5, 663],
    [1079, 664],
    [1068, 665],
    [1057, 663.5],
    [1047, 659.5],
    [1037, 650],
    [1032.5, 643],
    [1026, 634],
    [1021, 624],
    [1019, 612],
    [1021, 605],
    [1024, 599.5],
    [1026, 594],
    [1023, 587],
    [1026, 578],
  ];
  const villagePath = smoothClosedPath(village, 0.55);

  // parchment paths (drawn as wide ink strokes with a narrower parchment stroke on top)
  const lostWoodsTrail = smoothOpenPath(
    [
      [968, 594],
      [985, 590],
      [1004, 594],
      [1024, 599],
    ],
    0.8,
  );
  // stepped corridor down to the bridge (stair-like silhouette with a hook at the end)
  const corridor =
    'M1030 640 L1040 646 L1035 655 L1030 654 L1027 662 L1022 661 L1019 669 L1014 668 L1011 676 L1006 675 L1003 684 L1010 690 L1016 689 L1024 675 L1029 677 L1032 668 L1037 669 L1040 660 L1045 661 L1048 652 Z';
  const corridorHook = 'M1004 683 L996 679 L991 686 L997 690';
  const neck = 'M1146 632 L1163 621 L1181 613';

  const inkStroke = (d: string, w: number) => path(d, { fill: 'none', stroke: INK, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.85 });
  const fillStroke = (d: string, w: number, color: string, o = 0.9) => path(d, { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o });

  const ground = g({}, [
    // ink under-layer (outline) for every ground piece
    inkStroke(lostWoodsTrail, 7.5),
    path(corridor, { fill: INK, stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', opacity: 0.85 }),
    inkStroke(corridorHook, 7),
    inkStroke(neck, 12),
    path(villagePath, { fill: INK, stroke: INK, 'stroke-width': 3, opacity: 0.85, 'stroke-linejoin': 'round' }),
    circle(1211, 607, 34.5, { fill: INK, opacity: 0.85 }),
    // parchment / olive fills
    fillStroke(lostWoodsTrail, 4.6, PARCHMENT, 0.85),
    path(corridor, { fill: PARCHMENT, opacity: 0.85 }),
    fillStroke(corridorHook, 4.2, PARCHMENT, 0.85),
    fillStroke(neck, 8.8, GROUND, 0.82),
    path(villagePath, { fill: GROUND, opacity: 0.8 }),
    circle(1211, 607, 33, { fill: MEADOW, opacity: 0.88 }),
    circle(1211, 607, 29.5, { fill: 'none', stroke: '#7c7e30', 'stroke-width': 1.2, opacity: 0.35 }),
    // step lines across the corridor
    path('M1029 655 L1037 659 M1022 664 L1031 668 M1015 672 L1024 676', { stroke: INK, 'stroke-width': 0.9, opacity: 0.55, 'stroke-linecap': 'round' }),
    // wash variation so the olive does not read as a flat vector fill
    ellipse(1078, 618, 28, 15, { fill: '#c0b45a', opacity: 0.16, transform: 'rotate(-15 1078 618)' }),
    ellipse(1112, 646, 20, 9, { fill: GROUND_DEEP, opacity: 0.35 }),
    ellipse(1040, 630, 12, 18, { fill: GROUND_DEEP, opacity: 0.25 }),
  ]);
  root.appendChild(ground);

  // --- features: trees, shop, pond ----------------------------------------------------------------
  const tree = (cx: number, cy: number, r: number) =>
    g({}, [
      circle(cx, cy, r, { fill: TREE, stroke: INK, 'stroke-width': 1.1, opacity: 0.92 }),
      circle(cx + r * 0.15, cy + r * 0.15, r * 0.55, { fill: '#454a18', opacity: 0.45 }),
    ]);
  const features = g({}, [
    tree(1054, 592, 9),
    tree(1030, 619, 9),
    tree(1064, 651, 9.5),
    tree(1100, 651, 9.5),
    tree(1124, 651, 9),
    tree(1069, 562, 6),
    // the shop: light ring with an orange centre
    circle(1107, 605, 14, { fill: '#a89a50', stroke: INK, 'stroke-width': 1.1, opacity: 0.92 }),
    circle(1107, 605, 9, { fill: '#d4622c', stroke: '#7a3a14', 'stroke-width': 0.9 }),
    circle(1105, 603, 3.6, { fill: '#ee9a5c', opacity: 0.7 }),
    // the pond (two grey-blue pools)
    ellipse(1086, 606, 4, 7.2, { fill: '#6b8a86', stroke: INK, 'stroke-width': 0.9, opacity: 0.92, transform: 'rotate(-20 1086 606)' }),
    ellipse(1120, 628, 4.4, 9, { fill: '#6b8a86', stroke: INK, 'stroke-width': 0.9, opacity: 0.92, transform: 'rotate(-38 1120 628)' }),
    line(1085, 601, 1087, 611, { stroke: '#a6c2be', 'stroke-width': 0.7, opacity: 0.6 }),
  ]);
  root.appendChild(features);

  // --- player marker + view cone (transformed per camera pose) -----------------------------------
  const cone = path('M0 0 L-16 -34 A37.6 37.6 0 0 1 16 -34 Z', {
    fill: '#f4de7c',
    opacity: 0.6,
    stroke: '#e8cf62',
    'stroke-width': 0.8,
    'stroke-opacity': 0.5,
  });
  const coneG = g({ class: 'zr-map-cone' }, [cone]);
  const marker = g({ class: 'zr-map-marker' }, [
    path('M0 -7.5 L5.2 5.5 L0 2.4 L-5.2 5.5 Z', { fill: '#d8281c', stroke: '#5a0c08', 'stroke-width': 1, 'stroke-linejoin': 'round' }),
    path('M0 -5 L2.6 3.6 L0 2 Z', { fill: '#f0604a', opacity: 0.6 }),
  ]);
  root.appendChild(coneG);
  root.appendChild(marker);

  let last = '';
  const setPose = (p: MinimapPose) => {
    const [mx, my] = worldToMap(p.x, p.z);
    const heading = worldHeadingDeg(p.dx, p.dz);
    const t = `translate(${fmt(mx)} ${fmt(my)}) rotate(${fmt(heading)})`;
    if (t === last) return;
    last = t;
    coneG.setAttribute('transform', t);
    marker.setAttribute('transform', t);
  };

  return { svg: root, setPose };
}
