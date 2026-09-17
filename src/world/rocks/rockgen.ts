/**
 * Procedural rock geometry: icosphere → ridged multi-noise displacement (+ low-frequency crown
 * lumps on the upper hemisphere, crack furrows) → bedding strata (tilted layers: each bed is a
 * ledge stepping in or out with a dark groove at the parting) → planar "cleave" cuts (flat facets
 * with sharp edges; the first can be aimed) → moss cushion (the cap and, optionally, the shaded
 * side swell by a lumpy moss thickness) → crease-angle normals (hard on the fractures, soft on the
 * cushion). Vertex colours carry cracks, bedding partings, darkened facets, the contact collar and
 * the per-rock tint; `aMoss` carries the moss coverage.
 */
import { BufferGeometry, Color, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';

/** cheap isotropic-ish 3D noise from three 2D planes */
export class Noise3 {
  private a: Noise2D;
  private b: Noise2D;
  private c: Noise2D;
  constructor(seed: string) {
    this.a = new Noise2D(`${seed}/xy`);
    this.b = new Noise2D(`${seed}/yz`);
    this.c = new Noise2D(`${seed}/zx`);
  }
  noise(x: number, y: number, z: number) {
    return (this.a.noise(x, y + 0.37 * z) + this.b.noise(y, z + 0.37 * x) + this.c.noise(z, x + 0.37 * y)) / 3;
  }
  fbm(x: number, y: number, z: number, oct = 3) {
    let amp = 1;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * this.noise(x * f, y * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  }
  ridged(x: number, y: number, z: number, oct = 3) {
    let amp = 0.55;
    let f = 1;
    let sum = 0;
    for (let o = 0; o < oct; o++) {
      const n = 1 - Math.abs(this.noise(x * f, y * f, z * f));
      sum += n * n * amp;
      amp *= 0.5;
      f *= 2.1;
    }
    return Math.min(1, sum);
  }
}

export interface RockOptions {
  radius: number;
  detail: number;
  /** ridged displacement amplitude (fraction of radius) */
  ridge?: number;
  /** low-frequency lump amplitude (fraction of radius) */
  lump?: number;
  /** number of planar cleave cuts */
  cuts?: number;
  /** vertical squash (1 = sphere) */
  squashY?: number;
  /** crease angle in degrees below which normals are smoothed */
  creaseDeg?: number;
  /** crack density 0..1 */
  cracks?: number;
  /** moss coverage 0..1 (on upward faces) */
  moss?: number;
  /** base tint */
  tint?: Color;
  /** contact dirt darkening near the base 0..1 */
  dirt?: number;
  /** noise frequency multiplier (per metre) */
  freq?: number;
  /**
   * bedding strata: ledge depth as a fraction of the radius (0 = none). Beds are ~0.3–0.45 r
   * thick on a slightly tilted axis; each parting is a dark groove and the bed above it steps in
   * or out a little, so the silhouette reads as stacked layers.
   */
  strata?: number;
  /** moss cushion thickness on the upward faces (fraction of the radius) */
  mossThickness?: number;
  /**
   * range of the cleave-plane normals' y component (default [-0.15, 1]: facets face up and out —
   * angular scree). Rounded boulders use a sideways band so the crown stays a dome.
   */
  cutUp?: [number, number];
  /** cleave depth range as a fraction of the radius for the first two cuts (default [0.42, 0.62]) */
  cutDepth?: [number, number];
  /**
   * horizontal direction the FIRST cleave faces (unit xz; yawed ±35° by the seed, near-vertical
   * plane): the D boulder's fresh fracture face turned toward the path
   */
  cutToward?: [number, number];
  /** darkening of the cleaved facets 0..1 (fresh fracture, damp: reads as a dark face) */
  cutDark?: number;
  /** how bare the cleaved facets stay of moss 0..1 (default 0: the small stones' flat tops moss over) */
  facetBare?: number;
  /**
   * crown lumps: low-frequency, high-amplitude swell of the upper hemisphere (fraction of the
   * radius; ± the same again in lumps) — the frames' boulders are rounded, soft-lumped masses
   * on top, and the ridging is halved there so the crown stays smooth
   */
  crown?: number;
  /** groove depth of the crack lines (fraction of the radius): the cracks become real furrows */
  crackDepth?: number;
  /**
   * moss on the shaded side: coverage 0..1 on faces turned toward `mossShade` (the horizontal
   * direction away from the sun), running from the shoulders down to the collar
   */
  mossSide?: number;
  mossShade?: [number, number];
  /** lumpiness of the moss cushion 0..1: its thickness varies ±50 % at 1 so the edge reads soft */
  mossLumpy?: number;
  /** colour of the contact collar (default: brown soil) */
  collar?: Color;
  /** the collar's fade band in normalised rock height 0..1 (default [0.05, 0.45]) */
  collarBand?: [number, number];
  /**
   * Near-LOD relief (round 42, default 0 — the far meshes are byte-identical with it off): a
   * high-frequency ridged skin, ± this fraction of the radius, at ~5× the base frequency — the
   * pitting and small fracture facets a rock shows at 1–4 m. Halved on the crown like `ridge`.
   */
  micro?: number;
  /**
   * a second, finer crack network 0..1 (default 0): thinner dark lines at ~2× the density of
   * `cracks`, painted like the main ones but cut only `fineCrackDepth` deep
   */
  fineCracks?: number;
  /**
   * furrow depth of the fine network (fraction of the radius, default 0.3 × `crackDepth`): kept
   * shallow — at the main depth the dense network corrugated the whole face into chevrons; the
   * hairlines are meant to read as dark lines in the colour, with only a hint of a groove
   */
  fineCrackDepth?: number;
  /**
   * chipping of the cleave-plane rims (fraction of the radius, default 0): vertices within
   * ~0.1 r of a facet's edge are notched inward where a high-frequency noise peaks, so the
   * fracture edges read broken and sharp instead of a clean line
   */
  chip?: number;
  /**
   * Round 44 (survey-1 crop 25): the rim chips as ROUNDED spalls. With it set the chip pass
   * scallops the rim — a low-frequency (~r/4) smooth bite instead of the ~r/8 noise peaks whose
   * teeth, 2–3 cm deep every 5–10 cm along the stair-foot boulder's cleave rim, read as a
   * saw-blade of thin triangular shards — and first fillets the arris itself over this fraction
   * of the radius (a quarter-round taken off the edge between the facet and the body).
   */
  rimRound?: number;
  /**
   * Round 44 (survey-1 crop 25): plate structure of the bare skin (fraction of the radius,
   * default 0 — the far meshes are byte-identical with it off): a three-ledge quantised noise at
   * ~r/2.5 wavelength steps the surface in and out by ± this, the step softened over 40 % of a
   * level so the crease normals catch it as a ledge, and the colour pass darkens the joint
   * between plates and shades each ledge its own value. Off on the moss cap (`crown`-style
   * upness) so the cushion stays a soft mass; the stair-foot boulder's flank read as one flat
   * photo texture without it.
   */
  plates?: number;
}

const _t = new Vector3();

const _p = new Vector3();
const _n = new Vector3();
const _bed = new Vector3();

export function buildRock(rng: Rng, seed: string, o: RockOptions): BufferGeometry {
  const N = new Noise3(seed);
  const r = o.radius;
  const ridge = o.ridge ?? 0.16;
  const lump = o.lump ?? 0.18;
  const cuts = o.cuts ?? 3;
  const squashY = o.squashY ?? 0.8;
  const strata = o.strata ?? 0;
  const freq = (o.freq ?? 1) / Math.max(0.2, r);
  // PolyhedronGeometry subdivides linearly: 20·(detail+1)² triangles, already non-indexed
  const ico = new IcosahedronGeometry(r, o.detail);
  const base = ico.index ? ico.toNonIndexed() : ico;
  const pos = base.attributes.position as Float32BufferAttribute;
  const count = pos.count;

  // per-rock random rotation of the noise domain so instances differ
  const ox = rng.range(-50, 50);
  const oy = rng.range(-50, 50);
  const oz = rng.range(-50, 50);

  // bedding: near-vertical axis tilted 8–22°, bed thickness and per-bed in/out offsets
  const tilt = rng.range(0.14, 0.38);
  const tiltDir = rng.range(0, Math.PI * 2);
  _bed.set(Math.sin(tilt) * Math.cos(tiltDir), Math.cos(tilt), Math.sin(tilt) * Math.sin(tiltDir));
  const bedThick = r * squashY * rng.range(0.26, 0.4);
  const bedPhase = rng();
  const bedOffsets = [0, 1, 2, 3, 4, 5, 6, 7].map(() => rng.range(-1, 1));
  /** returns { groove: 0..1 at the parting, step: -1..1 per-bed radial offset } for a point */
  const bedding = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    const h = (x * _bed.x + y * _bed.y + z * _bed.z) / bedThick + bedPhase + 0.18 * N.fbm(nx * 0.9, ny * 0.9, nz * 0.9, 2);
    const k = Math.floor(h);
    const f = h - k;
    // parting groove: narrow band around f = 0 (both sides), softened by noise so it breaks up
    const g = 1 - smoothstep(0.0, 0.16, Math.min(f, 1 - f));
    const step = bedOffsets[((k % 8) + 8) % 8];
    return { groove: g, step, f };
  };

  const crackAmt = o.cracks ?? 0.6;
  const crown = o.crown ?? 0;
  const crackDepth = o.crackDepth ?? 0;
  const micro = o.micro ?? 0;
  const fineCracks = o.fineCracks ?? 0;
  const fineCrackDepth = o.fineCrackDepth ?? crackDepth * 0.3;
  const chip = o.chip ?? 0;
  const rimRound = o.rimRound ?? 0;
  const plates = o.plates ?? 0;
  // the near relief is an absolute scale (pits ~15 cm, hairlines ~9 cm apart on every rock): its
  // noise frequencies, expressed in the rock-relative domain above, scale with the radius
  const nk = Math.max(1, r / 0.75);
  /**
   * the plate field at a noise-domain point: { level 0..1 (three ledges, the step between them
   * softened over 40 % of a level), step 0..1 (1 on the joint between two plates), id (the ledge) }
   */
  const plateAt = (x: number, y: number, z: number) => {
    const f = 2.6 * nk;
    const pn = N.fbm(x * f + 4.4, y * f - 6.2, z * f + 2.9, 2) * 0.5 + 0.5;
    const q = clamp(pn, 0, 0.999) * 3;
    const id = Math.floor(q);
    const fr = q - id;
    const step = 1 - smoothstep(0, 0.2, Math.abs(fr - 0.5));
    return { level: (id + smoothstep(0.3, 0.7, fr)) / 3, step, id };
  };
  /** main crack line strength 0..1 at a (final-shape) point; the bedding partings count as cracks */
  const mainCrackAt = (p: Vector3) => {
    const x = p.x * freq + ox;
    const y = p.y * freq + oy;
    const z = p.z * freq + oz;
    // thin dark lines where ridged noise peaks (the zero contours of its first octave), plus the
    // bedding partings. Two octaves of `ridged` top out at 0.825, so the value is normalised to
    // 0..1 first — against the raw value the old 0.84 threshold was never reached and the
    // "cracks" were a 13 % tint at best
    const cr = N.ridged(x * 4.2, y * 4.2, z * 4.2, 2) / 0.825;
    let crack = smoothstep(0.8 - 0.15 * crackAmt, 0.95, cr) * crackAmt;
    if (strata > 0) crack = Math.max(crack, 0.85 * bedding(p.x, p.y, p.z, x, y, z).groove * (1 - Math.abs(p.y / (r * squashY)) * 0.5));
    return clamp(crack, 0, 1);
  };
  /** the fine network 0..1: the same ridged contours at 2.3× the frequency with a narrower band */
  const fineCrackAt = (p: Vector3) => {
    if (fineCracks <= 0) return 0;
    const x = p.x * freq + ox;
    const y = p.y * freq + oy;
    const z = p.z * freq + oz;
    // thinner lines, twice as dense — hairline partings between the main cracks
    const f = 9.7 * nk;
    const fc = N.ridged(x * f + 7.7, y * f - 3.3, z * f + 5.1, 2) / 0.825;
    return smoothstep(0.88 - 0.08 * fineCracks, 0.975, fc) * 0.8 * fineCracks;
  };
  /** crack line strength 0..1 for the colour pass: main lines, partings and the fine network */
  const crackAt = (p: Vector3) => clamp(Math.max(mainCrackAt(p), fineCrackAt(p)), 0, 1);

  // 1. displacement (do it per unique direction so shared vertices stay welded)
  const disp = new Map<string, number>();
  // the plate field per vertex (joint weight, ledge id) for the colour pass, from the same
  // pre-displacement point the geometry used, so the dark joints sit on the geometric steps
  const plateStep = plates > 0 ? new Float32Array(count) : null;
  const plateId = plates > 0 ? new Uint8Array(count) : null;
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    const key = `${_p.x.toFixed(4)},${_p.y.toFixed(4)},${_p.z.toFixed(4)}`;
    let d = disp.get(key);
    if (plateStep && plateId) {
      const pl = plateAt(_p.x * freq + ox, _p.y * freq + oy, _p.z * freq + oz);
      plateStep[i] = pl.step;
      plateId[i] = pl.id;
    }
    if (d === undefined) {
      const x = _p.x * freq + ox;
      const y = _p.y * freq + oy;
      const z = _p.z * freq + oz;
      const rd = N.ridged(x * 1.6, y * 1.6, z * 1.6, 3); // 0..1
      const lp = N.fbm(x * 0.55, y * 0.55, z * 0.55, 2); // -1..1
      // the crown: the upper hemisphere carries big soft lumps (fbm at ~3 r wavelength, so two or
      // three swells across the top) and half the ridging — the frames' A/D boulders are rounded,
      // weathered masses with a lumpy moss-covered top, not a faceted crown
      const upness = crown > 0 ? smoothstep(-0.3, 0.55, _p.y / r) : 0;
      const ridgeHere = ridge * (1 - 0.5 * upness);
      d = 1 + lump * lp + ridgeHere * (rd - 0.5) * 2 * 0.5 + ridgeHere * 0.35 * N.fbm(x * 3.1, y * 3.1, z * 3.1, 2);
      if (crown > 0) {
        const cl = N.fbm(x * 0.34 + 11.3, y * 0.34 - 4.1, z * 0.34 + 7.7, 2); // -1..1
        d *= 1 + crown * upness * (0.45 + 0.9 * cl);
      }
      if (micro > 0) {
        // the near skin: ridged noise at ~5× the base frequency (sharp creases where its first
        // octave crosses zero, pits between) plus a small-facet fbm — the fractured, pitted
        // texture of frame-01 / frame-05's rock faces, which the far mesh's ridging (1.6×)
        // cannot carry; halved on the crown so the moss cap stays a soft mass
        const f1 = 5.3 * nk;
        const f2 = 3.6 * nk;
        const mr = N.ridged(x * f1 + 3.1, y * f1 - 2.7, z * f1 + 1.9, 2) / 0.825;
        const mf = N.fbm(x * f2 - 8.2, y * f2 + 6.4, z * f2 - 1.7, 2);
        d *= 1 + micro * (1 - 0.6 * upness) * ((mr - 0.55) + 0.45 * mf);
      }
      if (plates > 0) {
        // the bare skin in plates: three ledges stepping the surface ± `plates`, off under the cap
        const pl = plateAt(x, y, z);
        d *= 1 + plates * (1 - 0.85 * upness) * (pl.level - 0.5) * 2;
      }
      if (strata > 0) {
        // beds step in/out (mostly on the sides — the flat cap stays whole) and sink at the
        // parting. Evaluated on the noise-displaced position so the colour pass (which sees the
        // final vertex) finds the groove where the geometry has it.
        const b = bedding(_p.x * d, _p.y * d * squashY, _p.z * d, x, y, z);
        const side = 1 - Math.abs(_p.y / r) * 0.6;
        d *= 1 + strata * side * (0.55 * b.step - 1.1 * b.groove);
      }
      if (crackDepth > 0) {
        // the crack lines become furrows: the vertex sinks by the groove depth where the colour
        // pass will paint the line (same noise, evaluated on the displaced position); the fine
        // network only scratches the surface (`fineCrackDepth`)
        _t.set(_p.x * d, _p.y * d * squashY, _p.z * d);
        d *= 1 - crackDepth * mainCrackAt(_t) - fineCrackDepth * fineCrackAt(_t);
      }
      disp.set(key, d);
    }
    _p.multiplyScalar(d);
    _p.y *= squashY;
    pos.setXYZ(i, _p.x, _p.y, _p.z);
  }

  // 2. cleave cuts: project everything beyond a plane onto it → flat fracture faces
  const cutUp = o.cutUp ?? [-0.15, 1.0];
  const cutDepth = o.cutDepth ?? [0.42, 0.62];
  // per-vertex facet flag (0..1): how far the vertex was pushed onto a cleave plane
  const facet = new Float32Array(count);
  // per-vertex distance to the nearest cleave plane (either side), for the rim chipping below
  const rimGap = chip > 0 ? new Float32Array(count).fill(Infinity) : null;
  for (let c = 0; c < cuts; c++) {
    if (c === 0 && o.cutToward) {
      // the first cleave faces the given horizontal direction (yawed ±35° by the seed), near
      // vertical, so the fracture face stands toward the path
      const yaw = Math.atan2(o.cutToward[1], o.cutToward[0]) + rng.range(-0.6, 0.6);
      const ny = rng.range(-0.05, 0.18);
      rng(); // same three draws as a free cut, so the later cuts land where they did
      _n.set(Math.cos(yaw), ny, Math.sin(yaw)).normalize();
    } else {
      // bias normals toward the upper hemisphere and sideways so facets are visible
      _n.set(rng.range(-1, 1), rng.range(cutUp[0], cutUp[1]), rng.range(-1, 1)).normalize();
    }
    // deeper cuts on the first planes (big fracture faces), shallower chips afterwards
    const depth = c < 2 ? rng.range(cutDepth[0], cutDepth[1]) : rng.range(0.6, 0.82);
    const dist = r * depth * (0.6 + 0.4 * squashY);
    for (let i = 0; i < count; i++) {
      _p.fromBufferAttribute(pos, i);
      const d = _p.dot(_n);
      if (rimGap) rimGap[i] = Math.min(rimGap[i], Math.abs(d - dist));
      if (d > dist) {
        _p.addScaledVector(_n, dist - d);
        pos.setXYZ(i, _p.x, _p.y, _p.z);
        facet[i] = Math.max(facet[i], smoothstep(0.0, 0.04 * r, d - dist));
      }
    }
  }
  if (rimGap && rimRound <= 0) {
    // chipped edges: within ~0.1 r of a cleave plane (on the facet and on the body beside it)
    // the vertex is notched toward the rock's centre where a high-frequency noise peaks, so the
    // fracture rim is a broken line of small spalls (frame-05's sharp, chipped ledges). Purely
    // position-dependent, so co-located vertices stay welded.
    for (let i = 0; i < count; i++) {
      const w = 1 - smoothstep(0, 0.1 * r, rimGap[i]);
      if (w <= 0) continue;
      _p.fromBufferAttribute(pos, i);
      const x = _p.x * freq + ox;
      const y = _p.y * freq + oy;
      const z = _p.z * freq + oz;
      const f = 7.5 * nk;
      const hf = N.fbm(x * f + 2.2, y * f + 4.6, z * f - 6.1, 2); // -1..1
      const notch = chip * r * w * Math.max(0, hf - 0.15) / 0.85;
      if (notch <= 0) continue;
      const l = _p.length() || 1;
      _p.multiplyScalar(Math.max(0, l - notch) / l);
      pos.setXYZ(i, _p.x, _p.y, _p.z);
    }
  } else if (rimGap) {
    // round 44: rounded rims. The arris between a facet and the body is filleted — within
    // `rimRound` r of the plane the vertex moves toward the centre by a quarter-round's sagitta,
    // so the edge is a roll, not a knife — and the chips are smooth scallops ~r/4 across (a
    // 2-octave fbm's positive lobes, eased in over their full width) to `chip` r deep: bites
    // taken out of a rounded edge, each one continuous with the surface on both sides.
    const rr = rimRound * r;
    for (let i = 0; i < count; i++) {
      const g = rimGap[i];
      const w = 1 - smoothstep(0, 0.16 * r, g);
      if (w <= 0 && g >= rr) continue;
      _p.fromBufferAttribute(pos, i);
      let inward = 0;
      if (g < rr) {
        const t = 1 - g / rr;
        inward += rr * (1 - Math.sqrt(Math.max(0, 1 - t * t))) * 0.6;
      }
      if (w > 0) {
        const x = _p.x * freq + ox;
        const y = _p.y * freq + oy;
        const z = _p.z * freq + oz;
        const f = 4.2 * nk;
        const hf = N.fbm(x * f + 2.2, y * f + 4.6, z * f - 6.1, 2); // -1..1
        inward += chip * r * w * smoothstep(-0.05, 0.7, hf);
      }
      if (inward <= 0) continue;
      const l = _p.length() || 1;
      _p.multiplyScalar(Math.max(0, l - inward) / l);
      pos.setXYZ(i, _p.x, _p.y, _p.z);
    }
  }
  // flat-ish bottom (buried anyway) so the rock never balances on a spike
  const floor = -r * squashY * 0.62;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < floor) pos.setY(i, floor + (y - floor) * 0.25);
  }
  pos.needsUpdate = true;

  const mossAmt = o.moss ?? 0.6;
  const mossThick = o.mossThickness ?? 0;
  const mossSide = o.mossSide ?? 0;
  const shadeX = o.mossShade?.[0] ?? 0;
  const shadeZ = o.mossShade?.[1] ?? 0;
  const mossLumpy = o.mossLumpy ?? 0;
  const facetBare = o.facetBare ?? 0;

  /**
   * moss coverage 0..1 for a vertex at p with normal n: the cap (upward faces), patches, the
   * shaded side when `mossSide` is set, never the buried collar or the fresh cleave facets
   */
  const mossAt = (p: Vector3, n: Vector3, crack: number, fct = 0) => {
    const x = p.x * freq + ox;
    const y = p.y * freq + oy;
    const z = p.z * freq + oz;
    const h01 = clamp((p.y + r * squashY) / (2 * r * squashY), 0, 1);
    // a heavy cap: everything facing up within ~35° carries moss, thinning out over the
    // shoulders (gone by ~65°) so the sides stay bare grey rock (the reference boulders are
    // stone with a moss hat, not green mounds — C reads the stair-foot boulder from its shaded
    // north side and it must still look like rock there)
    const wob = N.fbm(x * 2.2, y * 2.2, z * 2.2, 2);
    const up = smoothstep(0.38, 0.82, n.y + 0.12 * wob);
    const patch = smoothstep(0.15, 0.6, N.fbm(x * 1.4 + 3, y * 1.4 - 5, z * 1.4, 3) * 0.5 + 0.5);
    // a thin moss/lichen skin also creeps down the shaded sides in a few places
    let side = 0.12 * smoothstep(0.6, 0.9, patch) * smoothstep(-0.3, 0.2, n.y);
    let cov = up * (0.7 + 0.5 * patch);
    if (mossSide > 0) {
      // the shaded side (turned away from the sun) is a damp face: a thick, nearly continuous
      // moss blanket from the shoulders down to the collar, its edge wobbled by the same noise
      // so it laps down the rock in tongues rather than a level line
      const facing = n.x * shadeX + n.z * shadeZ + 0.22 * wob;
      const blanket = mossSide * smoothstep(0.05, 0.6, facing) * smoothstep(-0.45, 0.15, n.y) * smoothstep(0.12, 0.4, h01 + 0.08 * wob);
      cov = Math.max(cov, blanket * (0.75 + 0.35 * patch));
      side *= 1.5;
    }
    return clamp(mossAmt * (cov + side) * smoothstep(0.02, 0.2, h01) * (1 - crack * 0.5) * (1 - facetBare * fct), 0, 1);
  };

  // 3. moss cushion: upward faces swell by the moss thickness (welded per position), so the cap
  // reads as a thick pad sitting on the rock rather than a green tint. The mask is evaluated on
  // the fully smoothed vertex normal (no crease jumps), otherwise the pad's thickness steps at
  // every crease and the cushion comes out crumpled.
  computeCreaseNormals(base, 180);
  if (mossThick > 0) {
    const nrm0 = base.attributes.normal as Float32BufferAttribute;
    const swell = new Map<string, [number, number, number]>();
    for (let i = 0; i < count; i++) {
      _p.fromBufferAttribute(pos, i);
      const key = `${_p.x.toFixed(4)},${_p.y.toFixed(4)},${_p.z.toFixed(4)}`;
      let s = swell.get(key);
      if (!s) {
        _n.fromBufferAttribute(nrm0, i);
        // vertex-averaged direction (independent of which face we came from) → welded offset
        const m = mossAt(_p, _n, crackAt(_p), facet[i]);
        let k = mossThick * r * smoothstep(0.1, 0.75, m);
        if (mossLumpy > 0) {
          // the cushion is a pad of pillows, not a uniform shell: its thickness varies ±50 % at
          // ~0.3 r wavelength so the silhouette edge reads soft and lumpy
          const lm = N.fbm(_p.x * freq * 3.3 + ox + 5, _p.y * freq * 3.3 + oy, _p.z * freq * 3.3 + oz - 9, 2) * 0.5 + 0.5;
          k *= 1 + mossLumpy * (lm - 0.5);
        }
        _n.set(_p.x, _p.y * 1.4, _p.z).normalize().lerp(_n, 0.5).normalize();
        s = [_n.x * k, _n.y * k, _n.z * k];
        swell.set(key, s);
      }
      pos.setXYZ(i, _p.x + s[0], _p.y + s[1], _p.z + s[2]);
    }
    pos.needsUpdate = true;
    computeCreaseNormals(base, 180);
  }
  // the moss mask of the final shape, on smooth normals (colour pass + normal blend below)
  const smoothN = (base.attributes.normal.array as Float32Array).slice();

  // 4. crease-angle normals on the final shape: hard creases on the bare rock; the cushion, when
  // there is one, is a soft pad (its own wide crease angle, blended in by the moss value below)
  computeCreaseNormals(base, o.creaseDeg ?? 38);
  const hardN = (base.attributes.normal.array as Float32Array).slice();
  let softN: Float32Array | null = null;
  if (mossThick > 0) {
    computeCreaseNormals(base, 85);
    softN = (base.attributes.normal.array as Float32Array).slice();
  }

  // 5. colours + moss
  const nrm = new Float32BufferAttribute(smoothN, 3);
  const col = new Float32Array(count * 3);
  const moss = new Float32Array(count);
  // `aWet` 0..1: the damp band above the ground (the lowest ~0.3 of the rock, the undersides
  // wetter) — read only by the near-LOD material's wet/dark term (material.ts), so the far look
  // is untouched by the attribute
  const wet = new Float32Array(count);
  const tint = o.tint ?? new Color(0.72, 0.72, 0.7);
  const dirt = o.dirt ?? 0.5;
  const cutDark = o.cutDark ?? 0;
  const collarBand = o.collarBand ?? [0.05, 0.45];
  const tmp = new Color();
  // cracks and partings read near-black in the reference (A rock p10 ≈ 0.14 in frame)
  const dark = new Color(0.15, 0.14, 0.12);
  const soil = o.collar ?? new Color(0.24, 0.19, 0.13);
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nrm, i);
    const x = _p.x * freq + ox;
    const y = _p.y * freq + oy;
    const z = _p.z * freq + oz;
    // tonal variation, with the beds alternating slightly lighter / darker
    const v = N.fbm(x * 1.1 + 7, y * 1.1, z * 1.1, 2) * 0.5 + 0.5;
    let tone = 0.87 + 0.26 * v;
    if (strata > 0) tone *= 1 + 0.08 * bedding(_p.x, _p.y, _p.z, x, y, z).step;
    tmp.copy(tint).multiplyScalar(tone);
    // cracks + bedding partings: dark
    const crack = crackAt(_p);
    tmp.lerp(dark, crack * 0.92);
    // fresh cleave facets: darker, a shade cooler (damp fracture face, no weathered skin)
    if (cutDark > 0 && facet[i] > 0) tmp.lerp(dark, cutDark * facet[i] * (0.55 + 0.25 * v));
    if (plateStep && plateId) {
      // round 44: each plate its own value (±6 %), the joint between plates a dark line — off
      // under the cap like the steps themselves
      const upness = smoothstep(-0.3, 0.55, _p.y / (r * squashY));
      const pw = 1 - 0.85 * upness;
      tmp.multiplyScalar(1 + 0.06 * (plateId[i] - 1) * pw);
      tmp.lerp(dark, 0.55 * plateStep[i] * pw);
    }
    // contact dirt at the base (darker, higher than before: the reference boulders sit in a
    // shadowed collar of soil and moss)
    const h01 = clamp((_p.y + r * squashY) / (2 * r * squashY), 0, 1);
    tmp.lerp(soil, dirt * (1 - smoothstep(collarBand[0], collarBand[1], h01)));
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
    moss[i] = mossAt(_p, _n, crack, facet[i]);
    wet[i] = clamp(1 - smoothstep(0.06, 0.32, h01 + 0.04 * v) + 0.6 * smoothstep(0.15, -0.4, _n.y) * (1 - smoothstep(0.3, 0.7, h01)), 0, 1);
  }
  base.setAttribute('color', new Float32BufferAttribute(col, 3));
  base.setAttribute('aMoss', new Float32BufferAttribute(moss, 1));
  base.setAttribute('aWet', new Float32BufferAttribute(wet, 1));
  // final normals: hard on the bare rock, soft on the cushion
  if (softN) {
    const out = hardN;
    for (let i = 0; i < count; i++) {
      const w = smoothstep(0.25, 0.7, moss[i]);
      if (w <= 0) continue;
      const nx = out[i * 3] + (softN[i * 3] - out[i * 3]) * w;
      const ny = out[i * 3 + 1] + (softN[i * 3 + 1] - out[i * 3 + 1]) * w;
      const nz = out[i * 3 + 2] + (softN[i * 3 + 2] - out[i * 3 + 2]) * w;
      const l = Math.hypot(nx, ny, nz) || 1;
      out[i * 3] = nx / l;
      out[i * 3 + 1] = ny / l;
      out[i * 3 + 2] = nz / l;
    }
  }
  base.setAttribute('normal', new Float32BufferAttribute(hardN, 3));
  // audit facts: share of vertices on a crack line (> 0.3 — the lines peak at `cracks`), under
  // moss (> 0.5) and on a cleave facet
  let nCrack = 0;
  let nMoss = 0;
  let nFacet = 0;
  for (let i = 0; i < count; i++) {
    _p.fromBufferAttribute(pos, i);
    if (crackAt(_p) > 0.3) nCrack++;
    if (moss[i] > 0.5) nMoss++;
    if (facet[i] > 0.5) nFacet++;
  }
  base.userData.rockStats = { crackShare: nCrack / count, mossShare: nMoss / count, facetShare: nFacet / count };
  base.computeBoundingSphere();
  base.computeBoundingBox();
  return base;
}

/** normals for a non-indexed geometry: average adjacent face normals within the crease angle */
export function computeCreaseNormals(g: BufferGeometry, creaseDeg: number) {
  const pos = g.attributes.position as Float32BufferAttribute;
  const count = pos.count;
  const faceN = new Float32Array(count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cb = new Vector3();
  const ab = new Vector3();
  const byPos = new Map<string, number[]>();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    cb.subVectors(c, b);
    ab.subVectors(a, b);
    cb.cross(ab).normalize();
    for (let k = 0; k < 3; k++) {
      faceN[(i + k) * 3] = cb.x;
      faceN[(i + k) * 3 + 1] = cb.y;
      faceN[(i + k) * 3 + 2] = cb.z;
      const key = `${pos.getX(i + k).toFixed(4)},${pos.getY(i + k).toFixed(4)},${pos.getZ(i + k).toFixed(4)}`;
      const l = byPos.get(key);
      if (l) l.push(i + k);
      else byPos.set(key, [i + k]);
    }
  }
  const cosT = Math.cos((creaseDeg * Math.PI) / 180);
  const out = new Float32Array(count * 3);
  for (const list of byPos.values()) {
    for (const i of list) {
      let nx = 0;
      let ny = 0;
      let nz = 0;
      const fx = faceN[i * 3];
      const fy = faceN[i * 3 + 1];
      const fz = faceN[i * 3 + 2];
      for (const j of list) {
        const gx = faceN[j * 3];
        const gy = faceN[j * 3 + 1];
        const gz = faceN[j * 3 + 2];
        if (fx * gx + fy * gy + fz * gz >= cosT) {
          nx += gx;
          ny += gy;
          nz += gz;
        }
      }
      const l = Math.hypot(nx, ny, nz) || 1;
      out[i * 3] = nx / l;
      out[i * 3 + 1] = ny / l;
      out[i * 3 + 2] = nz / l;
    }
  }
  g.setAttribute('normal', new Float32BufferAttribute(out, 3));
}
