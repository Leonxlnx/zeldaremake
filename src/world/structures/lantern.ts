/**
 * Deku-nut pod lanterns: an elongated glowing pod (~0.32 m) with a darker cap and a short
 * stem, hanging from a cord. Body + cap + stem + cord are one geometry / one draw call; the
 * emissive gradient texture makes the bottom glow hottest and leaves caps and cords dark.
 * Each lantern hangs from a pivot at its hook so `update()` can swing it gently.
 *
 * Round 21: the pod is a fruit in a woven LEAF HUSK, as reference B's three pods over the door
 * read at 2× (a lit yellow-orange body under a green calyx whose sepals hang down its sides) and
 * as the distant huts' pods were already built (distantHouse.ts): dark sepal fins curl from
 * under the cap's brim down to a third of the body, standing 1.5 cm off it and flaring out at
 * their tips, and a calyx collar sits where the stem meets the cap. The fins ride in the same
 * geometry on the gradient's dark rows (no glow), so the pod is still one draw.
 *
 * Round 43 (structures-27): the pod at 1–3 m. The owner's board 05 "Hanging Lanterns" pod is a
 * plant pod — a SEGMENTED husk with a veined skin over a warm glowing core, on a knotted stem
 * with a leaf collar — where ours was a smooth lathe under a vertical gradient. Now:
 *  - the body is a ribbed surface with `ribs` (5–7) segments: a sharp groove on every seam, the
 *    segments bulging between (`podBulge`), the grooves fading at the tip; its uv lands on the
 *    pod-skin atlas (podSkin.ts / materials.ts) so the map's seams, midribs and side veins sit on
 *    the mesh's segments, and the emissive map's glow field (thin skin mid-segment, dark seams,
 *    a hotter core low down) reads as a translucent husk over a lit interior;
 *  - the calyx is scalloped — its brim dips over every seam — and carries one leathery leaf tile
 *    per segment; the sepals are one per segment, centred on the bulges, on the same leaf tiles;
 *  - the stem is a knuckled twig (two knots) with a small LEAF COLLAR of 3–5 bracts where the
 *    cord meets it, fluttering on the shared wind (aPhase / aAmount, materials.ts wind hook);
 *  - the cord is a laid three-strand rope (a 3 cm lay) with a two-turn hitch round the stem's
 *    top and a knot at the hook.
 * Still one geometry / one draw per pod. The pod centre (`pod`), the hook, the cord length and
 * the four draws from the caller's `rng` (cap tint, swing phase / amplitude / speed) are the
 * round-21 ones, so `podPositions` and every downstream stream are unchanged; all new detail
 * draws from the pod's own fork. The far look holds by construction: the albedo atlas
 * modulates round POD_MAP_MEAN and the tints below are divided by it, the emissive's body rows
 * keep the round-11 gradient's mean (see podEmissiveTexture).
 */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, LineCurve3, Matrix4, Mesh, type MeshStandardMaterial, Object3D, TorusGeometry, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { TAU, faceTowards, gridSurface, merge, setColorAttribute, setFloatAttribute, sweepTube } from './geometry';
import type { StructureMaterials } from './materials';
import { POD_BODY_V, POD_CAP_BAND, POD_CORD_BAND, POD_CORD_V, POD_MAP_MEAN, POD_TEX_SEGMENTS, podBulge, podU } from './podSkin';

export interface LanternRig {
  /** placed at the hook; rotate this to swing the lantern */
  pivot: Object3D;
  /** world-space position of the glowing pod centre (for point lights / audit) */
  pod: Vector3;
  phase: number;
  amp: number;
  speed: number;
}

type RGB = [number, number, number];

/**
 * Round 55 (owner review 2026-09-23: "believable structure — frame, supports, translucent panels, a
 * light source, subtle internal detail, wear, convincing attachment"): the husk is a crafted
 * lantern. Its segments are thin panels held by bent-wood RIBS over the seams, a hoop round an open
 * bottom and a band under the calyx; through the opening (a hanging lantern is seen from below) a
 * flame stands on a wick cup slung from the hoop on three spokes, and the panels are lined inside,
 * lit. Frame, cup and spokes ride the atlas' cord band (no glow), the flame the body band's hottest
 * row. The bottom opens at Y_OPEN, radius R_OPEN (scale 1).
 */
const Y_OPEN = 0.032;
const R_OPEN = 0.058;

const BODY_PROFILE: [number, number][] = [
  [R_OPEN, Y_OPEN],
  [0.074, 0.046],
  [0.1, 0.075],
  [0.135, 0.14],
  [0.148, 0.2],
  [0.14, 0.255],
  [0.115, 0.295],
  [0.08, 0.315],
];
const CAP_PROFILE: [number, number][] = [
  [0.085, 0.3],
  [0.15, 0.285],
  [0.16, 0.315],
  [0.14, 0.35],
  [0.095, 0.385],
  [0.04, 0.405],
  [0.0, 0.41],
];
/** the body's height (scale 1) */
const BODY_H = 0.315;
/** the stem's foot (the calyx's top) and its length (scale 1) */
const STEM_Y = 0.405;
const STEM_H = 0.075;
/** the husk's groove depth as a share of the body radius, on a seam mid-body (round 55: shallower — a rib covers each seam) */
const GROOVE = 0.05;
/** the cord's radius (m, not scaled — a cord is a cord) and its lay (m per turn of the strands) */
const CORD_R = 0.011;
const CORD_LAY = 0.03;

/** the lit body's radius at height y (scale 1), for the sepals to ride on */
function bodyRadius(y: number): number {
  for (let i = 0; i + 1 < BODY_PROFILE.length; i++) {
    const [r0, y0] = BODY_PROFILE[i];
    const [r1, y1] = BODY_PROFILE[i + 1];
    if (y <= y1) return lerp(r0, r1, clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return BODY_PROFILE[BODY_PROFILE.length - 1][0];
}

/** the calyx profile at t ∈ [0, 1] (brim → stem foot): [radius, y] (scale 1) */
function capProfile(t: number): [number, number] {
  const f = t * (CAP_PROFILE.length - 1);
  const i = Math.min(CAP_PROFILE.length - 2, Math.floor(f));
  const k = f - i;
  return [lerp(CAP_PROFILE[i][0], CAP_PROFILE[i + 1][0], k), lerp(CAP_PROFILE[i][1], CAP_PROFILE[i + 1][1], k)];
}

/** the depth of the seam grooves along the body: nothing at the very tip, full mid-body, half under the calyx */
function grooveDepth(vb: number): number {
  return GROOVE * smoothstep(0, 0.18, vb) * (1 - 0.5 * smoothstep(0.8, 1, vb));
}

/** number of sepal fins round a pod's husk (round 21; round 43: one per segment, `ribs`) */
export const SEPALS = 5;
/** the husk's segment count range (round 43) */
export const POD_RIBS: [number, number] = [5, 7];

/** the shared wind attributes on a pod part: `amount` 0 (rigid) or per vertex */
function windAttrs(geo: BufferGeometry, phase: number, amount: number | ((i: number) => number)): BufferGeometry {
  setFloatAttribute(geo, 'aPhase', phase);
  setFloatAttribute(geo, 'aAmount', amount);
  return geo;
}

function setV(geo: BufferGeometry, v: number) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v);
}

/** a tint divided by the albedo atlas' mean (the map modulates round it) */
const mapped = (c: RGB, k = 1): RGB => [(c[0] * k) / POD_MAP_MEAN, (c[1] * k) / POD_MAP_MEAN, (c[2] * k) / POD_MAP_MEAN];

/**
 * Round 43: the ribbed husk body. `ribs` segments round the pod; seam grooves at φ = k · 2π /
 * ribs, the segments bulging between; the noise gives each segment a little of its own girth.
 */
function ribbedBody(scale: number, ribs: number, noise: Noise2D, tint: RGB, opts: { inner?: boolean; freshPanel?: number } = {}): BufferGeometry {
  // the lining is only seen through the bottom opening: a coarse copy
  const cols = ribs * (opts.inner ? 3 : 8);
  const inset = opts.inner ? 0.985 : 1;
  const geo = gridSurface(
    (u, vb, out) => {
      const phi = u * TAU;
      const y = Y_OPEN + vb * (BODY_H - Y_OPEN);
      const bulge = podBulge(phi, ribs);
      // each side of the pod a little of its own girth (a smooth field round φ, so no step on a seam)
      const girth = 1 + 0.03 * noise.noise(Math.cos(phi) * 1.4 + 0.5, Math.sin(phi) * 1.4 + vb * 2.1) * smoothstep(0, 0.2, vb) * smoothstep(1, 0.85, vb);
      const r = bodyRadius(y) * girth * (1 - grooveDepth(vb) * (1 - bulge)) * inset;
      out.position.set(Math.cos(phi) * r * scale, y * scale, Math.sin(phi) * r * scale);
      // the lining takes the gradient's dimmer upper rows: seen through the opening, the flame is
      // the brightest thing inside
      out.uv = [podU(phi, ribs), (opts.inner ? 0.5 + 0.45 * vb : vb) * POD_BODY_V];
      const ao = 1 - 0.14 * (1 - bulge) * smoothstep(0, 0.15, vb);
      // one panel was replaced at some point: a paler, greener skin between two of the ribs
      const seg = Math.floor((((phi / TAU) * ribs) % ribs + ribs) % ribs);
      const fresh = opts.freshPanel === seg ? 1 : 0;
      out.color = [tint[0] * ao * (1 + 0.1 * fresh), tint[1] * ao * (1 + 0.2 * fresh), tint[2] * ao * (1 + 0.05 * fresh)];
    },
    { cols, rows: opts.inner ? 6 : 18, closedU: true },
  );
  return opts.inner ? faceTowards(geo, (p, o) => o.set(0, p.y, 0)) : faceTowards(geo, (p, o) => o.set(p.x * 4, p.y, p.z * 4));
}

/**
 * Round 55: the lantern's frame — a bent-wood rib over every seam from the bottom hoop to the band
 * under the calyx, standing ≈ 7 mm off the panels, the two hoops, and the wick cup on three spokes
 * with its flame. Returns the rigid parts (no glow but the flame).
 */
function lanternFrame(scale: number, ribs: number, rng: Rng, woodTint: RGB): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const yTop = 0.296;
  for (let k = 0; k < ribs; k++) {
    const phi = (k / ribs) * TAU;
    const tone = 0.85 + 0.3 * rng();
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = lerp(Y_OPEN - 0.004, yTop, i / 8);
      const vb = (y - Y_OPEN) / (BODY_H - Y_OPEN);
      const r = bodyRadius(y) * (1 - grooveDepth(clamp(vb, 0, 1))) + 0.007;
      pts.push(new Vector3(Math.cos(phi) * r * scale, y * scale, Math.sin(phi) * r * scale));
    }
    const rib = sweepTube(new CatmullRomCurve3(pts, false, 'catmullrom', 0.5), {
      radius: (t) => 0.0058 * scale * (1 - 0.2 * t),
      tubularSegments: 8,
      radialSegments: 4,
      uvMetres: 0.04,
      // soot darkens the ribs toward the top, the bottom is handled and paler
      color: (t) => {
        const k2 = tone * (1.08 - 0.35 * smoothstep(0.55, 1, t));
        return [woodTint[0] * k2, woodTint[1] * k2, woodTint[2] * k2];
      },
    });
    cordBandUv(rib);
    parts.push(rib);
  }
  const ring = (y: number, r: number, tube: number, k2: number) => {
    const g = new TorusGeometry(r * scale, tube * scale, 4, 14);
    g.rotateX(Math.PI / 2);
    g.translate(0, y * scale, 0);
    setV(g, POD_CORD_V);
    setColorAttribute(g, [woodTint[0] * k2, woodTint[1] * k2, woodTint[2] * k2]);
    return g;
  };
  // the hoop round the opening (handled, paler) and the band under the calyx (sooted)
  parts.push(ring(Y_OPEN, R_OPEN + 0.005, 0.0078, 1.05), ring(yTop, bodyRadius(yTop) + 0.006, 0.0065, 0.7));
  // the wick cup: a small clay cup slung from the hoop on three spokes, the flame standing in it
  const cupTint: RGB = [woodTint[0] * 1.3, woodTint[1] * 1.15, woodTint[2] * 1.0];
  const cup = gridSurface(
    (u, v, out) => {
      const phi = u * TAU;
      const r = lerp(0.016, 0.024, v) * scale;
      const y = lerp(0.046, 0.064, v) * scale;
      out.position.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
      out.uv = [u, POD_CORD_V];
      out.color = cupTint;
    },
    { cols: 10, rows: 3, closedU: true },
  );
  faceTowards(cup, (p, o) => o.set(p.x * 4, p.y - 0.05, p.z * 4));
  parts.push(cup);
  const spin = rng() * TAU;
  for (let s = 0; s < 3; s++) {
    const a = spin + (s / 3) * TAU;
    const from = new Vector3(Math.cos(a) * 0.023 * scale, 0.058 * scale, Math.sin(a) * 0.023 * scale);
    const to = new Vector3(Math.cos(a) * R_OPEN * scale, Y_OPEN * scale, Math.sin(a) * R_OPEN * scale);
    const spoke = sweepTube(new LineCurve3(from, to), { radius: () => 0.0024 * scale, tubularSegments: 2, radialSegments: 4, uvMetres: 0.02, color: () => [woodTint[0] * 0.8, woodTint[1] * 0.8, woodTint[2] * 0.8] });
    cordBandUv(spoke);
    parts.push(spoke);
  }
  // the flame: a teardrop on the cup, on the body band's hottest row (mid-segment, the core)
  const lean = (rng() - 0.5) * 0.004;
  const flame = gridSurface(
    (u, v, out) => {
      const phi = u * TAU;
      const r = 0.016 * scale * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + v * 0.94)), 0.75) * (1 - 0.45 * v);
      out.position.set(Math.cos(phi) * r + lean * v * scale, (0.062 + 0.064 * v) * scale, Math.sin(phi) * r);
      out.uv = [0.5 / POD_TEX_SEGMENTS, 0.012];
      out.color = [1.2, 1.0, 0.7];
    },
    { cols: 8, rows: 6, closedU: true },
  );
  faceTowards(flame, (p, o) => o.set(p.x * 4, p.y, p.z * 4));
  parts.push(flame);
  return parts;
}

/**
 * Round 55: what a house lantern hangs from — a wooden toggle pinned under the eave / arch (two
 * short pins up into the wood) with the cord's two turns round it. World space, static (the pod
 * swings from the toggle's centre, which is `hook`). `across` is the toggle's axis (horizontal).
 */
export function lanternHanger(hook: Vector3, across: Vector3, scale = 1): BufferGeometry {
  const ax = across.clone().setY(0).normalize();
  const half = 0.065 * scale;
  const c = hook.clone().add(new Vector3(0, 0.014 * scale, 0));
  const a = c.clone().addScaledVector(ax, -half);
  const b = c.clone().addScaledVector(ax, half);
  const tint: RGB = [0.62, 0.5, 0.4];
  const toggle = sweepTube(new LineCurve3(a, b), { radius: (t) => 0.0115 * scale * (1 - 0.12 * Math.abs(2 * t - 1)), tubularSegments: 4, radialSegments: 8, uvMetres: 0.08, capStart: true, capEnd: true, color: () => tint });
  const parts: BufferGeometry[] = [toggle];
  for (const end of [-1, 1]) {
    const p = c.clone().addScaledVector(ax, end * half * 0.75);
    parts.push(sweepTube(new LineCurve3(p, p.clone().add(new Vector3(0, 0.06 * scale, 0))), { radius: () => 0.0065 * scale, tubularSegments: 2, radialSegments: 6, uvMetres: 0.05, capEnd: true, color: () => [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8] }));
  }
  // the cord's two turns round the toggle
  for (const off of [-0.012, 0.012]) {
    const turn = new TorusGeometry(0.0165 * scale, CORD_R * 0.85, 5, 12);
    // the torus lies in its XY plane (axis z): turn its axis onto the toggle's
    turn.rotateY(Math.atan2(ax.x, ax.z));
    const p = c.clone().addScaledVector(ax, off * scale);
    turn.translate(p.x, p.y, p.z);
    setColorAttribute(turn, [0.42, 0.32, 0.22]);
    parts.push(turn);
  }
  for (const g of parts) if (!g.attributes.color) setColorAttribute(g, tint);
  return merge(parts);
}

/** Round 43: the scalloped calyx — the brim dips over every seam, one leaf tile per segment. */
function scallopedCap(scale: number, ribs: number, tint: RGB): BufferGeometry {
  const [b0, b1] = POD_CAP_BAND;
  const geo = gridSurface(
    (u, t, out) => {
      const phi = u * TAU;
      const bulge = podBulge(phi, ribs);
      const [r0, y0] = capProfile(t);
      // the scallop is the brim's: full at t ≈ 0.25 (the widest ring), gone at the stem
      const brim = smoothstep(0, 0.2, t) * smoothstep(0.75, 0.35, t);
      const r = r0 * (1 - 0.14 * (1 - bulge) * brim);
      const y = y0 - 0.02 * (1 - bulge) * brim;
      out.position.set(Math.cos(phi) * r * scale, y * scale, Math.sin(phi) * r * scale);
      out.uv = [podU(phi, ribs), lerp(b0, b1, t)];
      const shade = 1 - 0.18 * (1 - bulge) * brim;
      out.color = [tint[0] * shade, tint[1] * shade, tint[2] * shade];
    },
    { cols: ribs * 8, rows: 8, closedU: true },
  );
  // the profile ends on the axis (r = 0): its winding is the lathe's, outward
  return faceTowards(geo, (p, o) => o.set(p.x * 4, p.y + 0.02, p.z * 4));
}

/**
 * The husk (round 21): sepal fins from under the cap's brim (y 0.29) down to 0.08–0.12 of the
 * body, 1.5 cm off it, tapering to a point and curling outward toward the tip. Round 43: one per
 * segment, centred on the bulge between two seams, on the atlas' leaf tiles (midrib down the
 * fin's centre, side veins). Own rng (forked from the pod's hook, so no draw of the pods' stream moves).
 */
function sepals(scale: number, ribs: number, rng: Rng, tint: RGB): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const [b0, b1] = POD_CAP_BAND;
  for (let f = 0; f < ribs; f++) {
    const phi0 = ((f + 0.5) / ribs) * TAU + (rng() - 0.5) * 0.12;
    const yTop = 0.29;
    const yTip = 0.08 + rng() * 0.04;
    // round 21's fin width at five ribs (0.1 m), narrower on a seven-rib pod: the fins cover ~⅔ of a
    // segment at the brim and taper, so the veined skin between them shows at 1–3 m
    const width = (0.5 / ribs) * (0.85 + rng() * 0.25);
    const curl = 0.02 + rng() * 0.02;
    const tile = f % POD_TEX_SEGMENTS;
    const fin = gridSurface(
      (u, v, out) => {
        const y = lerp(yTop, yTip, u);
        // off the body, flaring out toward the tip (the sepal's tip curls away from the fruit);
        // cupped across so the fin wraps the segment
        const cup = 0.012 * (1 - Math.pow((v - 0.5) * 2, 2)) * (1 - u);
        const r = bodyRadius(y) + 0.015 + curl * u * u - cup;
        const w = width * Math.pow(1 - u, 0.7);
        const phi = phi0 + ((v - 0.5) * w) / Math.max(r, 0.02);
        out.position.set(Math.cos(phi) * r * scale, y * scale, Math.sin(phi) * r * scale);
        // the leaf tile: across the fin = across the tile (midrib at v 0.5), tip at the band's bottom
        out.uv = [(tile + v) / POD_TEX_SEGMENTS, lerp(b1, b0, u)];
        // a darker mid-rib, lighter edges, the tip a touch browner
        const k = (0.8 + 0.4 * Math.abs(v - 0.5) * 2) * (1 - 0.15 * u);
        out.color = [tint[0] * k * (1 + 0.25 * u), tint[1] * k, tint[2] * k];
      },
      { cols: 5, rows: 9 },
    );
    faceTowards(fin, (p, o) => o.set(p.x * 4, p.y, p.z * 4));
    parts.push(fin);
  }
  return parts;
}

/**
 * Round 43: the knuckled stem — a twig with two knots, bending a little, from the calyx's top
 * to the cord's hitch. Bark on the cord band's fibres.
 */
function knottedStem(scale: number, rng: Rng, tint: RGB): { geo: BufferGeometry; top: Vector3 } {
  const lean = (rng() - 0.5) * 0.02;
  const lean2 = (rng() - 0.5) * 0.02;
  const k0 = 0.3 + rng() * 0.15;
  const k1 = 0.7 + rng() * 0.12;
  const pts = [new Vector3(0, STEM_Y - 0.01, 0), new Vector3(lean, STEM_Y + STEM_H * 0.45, lean2), new Vector3(lean * 0.4, STEM_Y + STEM_H, -lean2 * 0.4)];
  for (const p of pts) p.multiplyScalar(scale);
  const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const geo = sweepTube(curve, {
    radius: (t) => 0.016 * scale * (1.15 - 0.3 * t) * (1 + 0.45 * Math.exp(-(((t - k0) / 0.1) ** 2)) + 0.3 * Math.exp(-(((t - k1) / 0.08) ** 2))),
    tubularSegments: 10,
    radialSegments: 8,
    uvMetres: 0.016 * scale * TAU,
    displace: (t, ang) => 0.0012 * scale * Math.sin(ang * 4 + t * 9) * (1 - Math.abs(2 * t - 1)),
    color: (t) => {
      const k = 0.9 + 0.2 * Math.exp(-(((t - k0) / 0.1) ** 2));
      return [tint[0] * k, tint[1] * k, tint[2] * k];
    },
  });
  cordBandUv(geo);
  return { geo, top: pts[2] };
}

/** the sweep's uv onto the atlas' cord band: fibres round (u), a gentle wander along (v) */
function cordBandUv(geo: BufferGeometry) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  const [b0, b1] = POD_CORD_BAND;
  const half = (b1 - b0) * 0.4;
  for (let i = 0; i < uv.count; i++) uv.setY(i, POD_CORD_V + half * Math.sin(uv.getY(i) * TAU));
}

/**
 * Round 43: the laid cord — three strands twisted round the axis (a CORD_LAY lay), straight
 * from the stem's top to the hook.
 */
function laidCord(from: Vector3, to: Vector3, tint: RGB): BufferGeometry {
  const length = from.distanceTo(to);
  const ts = Math.max(2, Math.ceil(length / 0.04));
  const geo = sweepTube(new LineCurve3(from, to), {
    radius: () => CORD_R,
    tubularSegments: ts,
    radialSegments: 9,
    uvMetres: CORD_R * TAU,
    displace: (t, ang) => 0.32 * CORD_R * Math.cos(3 * ang - (t * length * TAU) / CORD_LAY),
    color: (t, ang) => {
      const k = 0.88 + 0.24 * Math.max(0, Math.cos(3 * ang - (t * length * TAU) / CORD_LAY));
      return [tint[0] * k, tint[1] * k, tint[2] * k];
    },
  });
  cordBandUv(geo);
  return geo;
}

/** a rope turn: a torus round `axis` at `centre` (the hitch's turns, the hook's knot) */
function ropeTurn(centre: Vector3, radius: number, tube: number, tilt: number, tint: RGB): BufferGeometry {
  const g = new TorusGeometry(radius, tube, 6, 16);
  g.rotateX(Math.PI / 2 + tilt);
  g.translate(centre.x, centre.y, centre.z);
  setV(g, POD_CORD_V);
  setColorAttribute(g, tint);
  return g;
}

/**
 * Round 43: the leaf collar — 3–5 small bracts where the cord meets the stem, cupped, pointing
 * out and down, on the atlas' leaf tiles; they flutter on the shared wind (aAmount grows to the tip).
 */
function leafCollar(top: Vector3, scale: number, rng: Rng, tint: RGB): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const n = 3 + Math.floor(rng() * 3);
  const phase0 = rng() * TAU;
  const [b0, b1] = POD_CAP_BAND;
  for (let i = 0; i < n; i++) {
    const phi0 = phase0 + (i / n) * TAU + (rng() - 0.5) * 0.5;
    const len = (0.05 + rng() * 0.025) * scale;
    const wid = (0.022 + rng() * 0.01) * scale;
    const droop = 0.5 + rng() * 0.6;
    const tile = i % POD_TEX_SEGMENTS;
    const ca = Math.cos(phi0);
    const sa = Math.sin(phi0);
    const leaf = gridSurface(
      (u, v, out) => {
        // along the bract: out from the stem, drooping; across: a pointed leaf, cupped
        const half = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.92)), 0.7);
        const across = (v - 0.5) * 2 * half;
        const out_ = 0.012 * scale + u * len;
        const dy = -droop * u * u * len - 0.4 * Math.abs(across) * (1 - u);
        out.position.set(top.x + ca * out_ - sa * across, top.y + dy - 0.004 * scale, top.z + sa * out_ + ca * across);
        out.uv = [(tile + v) / POD_TEX_SEGMENTS, lerp(b1, b0, u)];
        const k = 0.85 + 0.3 * Math.abs(v - 0.5) * 2;
        out.color = [tint[0] * k, tint[1] * k, tint[2] * k];
      },
      { cols: 5, rows: 6 },
    );
    faceTowards(leaf, (p, o) => o.set(p.x, p.y + 1, p.z));
    // the flutter grows to the tip (the band's v runs b1 → b0 base → tip)
    const uvA = leaf.attributes.uv as Float32BufferAttribute;
    windAttrs(leaf, rng() * TAU, (k) => 0.009 * ((b1 - uvA.getY(k)) / (b1 - b0)));
    parts.push(leaf);
  }
  return parts;
}

export type LanternKind = 'orange' | 'lime';

/**
 * Build one lantern hanging `cordLength` metres below a hook point (world space). `far` (round
 * 32): the pod takes the far-veil material (materials.ts FAR_LANTERN_INTENSITY) — the log arch's
 * pods 50 m out; same geometry, same draws.
 */
export function buildLantern(hook: Vector3, cordLength: number, mats: StructureMaterials, rng: Rng, scale = 1, kind: LanternKind = 'orange', far = false): LanternRig {
  // the caller's stream: exactly the round-21 draws (cap tint, then swing phase / amplitude / speed)
  const capTint = 0.85 + rng() * 0.3;
  // round 21 / 43: the husk and every new detail draw from the hook's fork, so the pods' stream keeps its draws
  const own = rng.fork(`husk/${hook.x.toFixed(3)}/${hook.y.toFixed(3)}/${hook.z.toFixed(3)}`);
  const noise = new Noise2D(`pod/${hook.x.toFixed(3)}/${hook.y.toFixed(3)}/${hook.z.toFixed(3)}`);
  const ribs = POD_RIBS[0] + Math.floor(own() * (POD_RIBS[1] - POD_RIBS[0] + 1));
  // round 55: the frame, the flame and the replaced panel draw from their own fork (no stream above moves)
  const craft = own.fork('craft');
  const freshPanel = craft() < 0.6 ? Math.floor(craft() * ribs) : -1;

  // dark diffuse so sunlight does not wash the emissive gradient to cream
  const bodyTint = mapped(kind === 'lime' ? [0.4, 0.52, 0.12] : [0.5, 0.34, 0.12]);
  const body = ribbedBody(scale, ribs, noise, bodyTint, { freshPanel });
  const lining = ribbedBody(scale, ribs, noise, bodyTint, { inner: true });
  const frame = lanternFrame(scale, ribs, craft, mapped([0.2, 0.13, 0.075]));
  const cap = scallopedCap(scale, ribs, mapped([0.28, 0.33, 0.16], capTint));
  // (dark: the fins sit in the pods' own point light, so a mid tint rendered pale grey-green)
  const fins = sepals(scale, ribs, own, mapped([0.12, 0.18, 0.06], capTint));
  const stem = knottedStem(scale, own, mapped([0.22, 0.17, 0.1]));
  const podTop = stem.top.y;
  const hookLocal = new Vector3(0, podTop + cordLength, 0);
  const cordTint = mapped([0.2, 0.14, 0.08]);
  const cord = laidCord(stem.top.clone(), hookLocal, cordTint);
  // the hitch: two turns of the cord round the stem's top, the knot at the hook
  const hitch = [
    ropeTurn(stem.top.clone().setY(podTop - 0.014 * scale), 0.02 * scale + CORD_R * 0.6, CORD_R * 0.8, 0.25, mapped([0.17, 0.12, 0.07])),
    ropeTurn(stem.top.clone().setY(podTop - 0.014 * scale - CORD_R * 1.5), 0.021 * scale + CORD_R * 0.6, CORD_R * 0.8, -0.2, cordTint),
  ];
  const knot = ropeTurn(hookLocal.clone().setY(podTop + cordLength - 0.02), 0.018, 0.012, 0.3, mapped([0.16, 0.11, 0.07]));
  const collar = leafCollar(stem.top, scale, own, mapped([0.3, 0.42, 0.12], capTint));

  // every rigid part carries zero wind, so the merged geometry keeps the collar's attributes
  const rigid = [body, lining, ...frame, cap, ...fins, stem.geo, cord, ...hitch, knot];
  for (const g of rigid) windAttrs(g, 0, 0);
  const geo = merge([...rigid, ...collar]);
  // shift so the hook (top of cord) is at the origin of the pivot
  geo.translate(0, -(podTop + cordLength), 0);
  const mesh = new Mesh(geo, kind === 'lime' ? (far ? mats.lanternLimeFar : mats.lanternLime) : far ? mats.lanternFar : mats.lantern);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.name = 'pod-lantern';

  const pivot = new Object3D();
  pivot.position.copy(hook);
  pivot.add(mesh);
  const pod = hook.clone().add(new Vector3(0, -(cordLength + 0.2 * scale), 0));
  return {
    pivot,
    pod,
    phase: rng() * Math.PI * 2,
    amp: 0.035 + rng() * 0.03,
    speed: 1.1 + rng() * 0.5,
  };
}

/** Deterministic gentle swing from simulation time. */
export function swingLanterns(rigs: LanternRig[], t: number, windDirX: number, windDirZ: number): void {
  for (const r of rigs) {
    const s = Math.sin(t * r.speed + r.phase);
    const s2 = Math.sin(t * r.speed * 0.63 + r.phase * 1.7);
    // swing mostly along the wind direction, a little across it
    const along = r.amp * s;
    const across = r.amp * 0.45 * s2;
    r.pivot.rotation.set(along * windDirZ + across * windDirX, 0, -along * windDirX + across * windDirZ);
  }
}

/**
 * `swingLanterns` on the GPU, for pods baked into one mesh (`bakeSwingingPods`): each vertex carries
 * its rig's hook (`aHook`) and phase / amplitude / speed (`aSwing`) and turns about the hook by the
 * pivot's Euler XYZ (x = along·dir.z + across·dir.x, y = 0, z = −along·dir.x + across·dir.z) on the
 * same clock — the wind's uTime is the world's `t` (world/index.ts), uWindDir its direction. Keep
 * the two in step.
 */
const POD_SWING_GLSL = /* glsl */ `
attribute vec3 aHook;
attribute vec3 aSwing;
mat3 podSwing() {
  float s = sin(uTime * aSwing.z + aSwing.x);
  float s2 = sin(uTime * aSwing.z * 0.63 + aSwing.x * 1.7);
  float along = aSwing.y * s;
  float across = aSwing.y * 0.45 * s2;
  float rx = along * uWindDir.y + across * uWindDir.x;
  float rz = -along * uWindDir.x + across * uWindDir.y;
  float a = cos(rx);
  float b = sin(rx);
  float e = cos(rz);
  float f = sin(rz);
  return mat3(e, a * f, b * f, -f, a * e, b * e, 0.0, -b, a);
}
`;

/** `base` — a pod material bound to the shared wind — with POD_SWING_GLSL chained onto its hook */
export function podSwingMaterial(base: MeshStandardMaterial): MeshStandardMaterial {
  const m = base.clone();
  m.name = `${base.name || 'structures:lantern'}:swing`;
  const prev = base.onBeforeCompile;
  const prevKey = base.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${POD_SWING_GLSL}\nvoid main() {\n  mat3 podTurn = podSwing();`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = podTurn * objectNormal;')
      .replace('#include <project_vertex>', 'transformed = aHook + podTurn * (transformed - aHook);\n#include <project_vertex>');
  };
  m.customProgramCacheKey = () => `${prevKey.call(m)}|pod-swing`;
  return m;
}

/**
 * Bake unswung `rigs` that share one material into ONE mesh on `podSwingMaterial` — one draw (and
 * one shadow draw) where a pivot per pod costs one each. The vertices land in `into`'s frame; the
 * mesh is returned unparented. Each rig's pod leaves its pivot and the emptied pivot keeps its place
 * as `pod-lantern`, so whatever finds pods by name (the audio's pod voices) still finds every hook.
 * The shadow pass draws the rest pose (no custom depth material): a 2–4° swing moves it by a few cm.
 */
export function bakeSwingingPods(rigs: LanternRig[], into: Object3D): Mesh {
  const podOf = (r: LanternRig) => {
    const pod = r.pivot.children.find((c) => (c as Mesh).isMesh) as Mesh | undefined;
    if (!pod) throw new Error('bakeSwingingPods: a rig without its pod');
    return pod;
  };
  const first = podOf(rigs[0]);
  const material = first.material as MeshStandardMaterial;
  into.updateWorldMatrix(true, false);
  const toInto = new Matrix4().copy(into.matrixWorld).invert();
  const bake = new Matrix4();
  const hook = new Vector3();
  const geos = rigs.map((r) => {
    const pod = podOf(r);
    if (pod.material !== material) throw new Error('bakeSwingingPods: rigs on different materials');
    r.pivot.rotation.set(0, 0, 0);
    r.pivot.updateWorldMatrix(true, true);
    const g = pod.geometry.clone().applyMatrix4(bake.multiplyMatrices(toInto, pod.matrixWorld));
    hook.setFromMatrixPosition(r.pivot.matrixWorld).applyMatrix4(toInto);
    const n = g.attributes.position.count;
    const hooks = new Float32Array(n * 3);
    const swing = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      hooks[i * 3] = hook.x;
      hooks[i * 3 + 1] = hook.y;
      hooks[i * 3 + 2] = hook.z;
      swing[i * 3] = r.phase;
      swing[i * 3 + 1] = r.amp;
      swing[i * 3 + 2] = r.speed;
    }
    g.setAttribute('aHook', new Float32BufferAttribute(hooks, 3));
    g.setAttribute('aSwing', new Float32BufferAttribute(swing, 3));
    return g;
  });
  const geo = merge(geos);
  geo.computeBoundingSphere();
  // the swing's reach: amplitude ≤ 0.065 rad on cords ≤ 1.5 m
  if (geo.boundingSphere) geo.boundingSphere.radius += 0.15;
  const mesh = new Mesh(geo, podSwingMaterial(material));
  mesh.name = 'pod-lanterns';
  mesh.castShadow = first.castShadow;
  mesh.receiveShadow = first.receiveShadow;
  for (const r of rigs) {
    const pod = podOf(r);
    pod.removeFromParent();
    pod.geometry.dispose();
    r.pivot.name = 'pod-lantern';
  }
  return mesh;
}
