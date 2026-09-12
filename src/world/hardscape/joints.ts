/**
 * Joint fill: a terrain-hugging surface of dark mossy earth (packed soil only where feet keep
 * the moss off — the dry plaza core and the trodden strip, zones.ts) that sits a hair above the
 * ground under the paved area, so the gaps between slabs read as filled joints rather than
 * holes down to the terrain texture. Grid is aligned to the terrain's 0.2 m detail grid so the
 * two surfaces are parallel (no z-fighting), the cells the paving mask's 0.5 iso crosses are
 * clipped to it (the fill ends where the slabs and the vegetation's rim do, fading to the turf
 * tone over its last 10 cm). A joint-width field (5 cm texels) lets the shader keep the tight
 * soil seams dark and lift only the wide soil junctions a shade; the mossy earth stays dark
 * whatever the joint width (reference B/E foreground: 15–45 cm joints of one dark olive tone
 * between the slabs).
 */
import { BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, LinearFilter, Mesh, MeshStandardMaterial, RedFormat, UnsignedByteType, Vector2, Vector4 } from 'three';
import type { Terrain } from '../terrain/heightfield';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { jointSoil, lawnPocket, lawnZone } from './zones';

/** what the joint fill needs to know about the slabs around it */
export interface JointPaving {
  /** distance (m) from a point to the nearest slab edge (Infinity far from any slab) */
  edgeGap(x: number, z: number): number;
  /** is the point under a slab */
  onStone(x: number, z: number): boolean;
}

/** gap-field texel (m) and the distance at which the field saturates */
const GAP_CELL = 0.05;
const GAP_MAX = 0.3;

/** distance from (x, z) to the segment (ax, az)–(bx, bz) */
function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-12 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}

/**
 * Joint-width tinting of the fill (the shader below and `jointFillLift` share these). Soil: a
 * seam tighter than ~3 cm stays damp soil — same luminance, browner (the reference's dark
 * quantile is a saturated brown, B/R 0.52); a seam up to round 11's 10 cm (5 cm from the nearest
 * slab) stays the dark seam soil edge to edge, and only from there does the fill dry out, fully
 * at 11 cm from a slab, to `JOINT_SOIL_DRY` — the pale dirt of the junctions and trodden margins.
 * Round 12: the old 2–5.5 cm ramp dried every plaza seam centre out (×1.35–1.75), a fifth of why
 * camera A's seams rendered at sRGB 104,85,57 against frame 1 s's 78,66,45. Mossy earth: the
 * tight seam is a shade darker and browner, the wide joint barely lifted and a touch greener —
 * the reference's wide B/E joints are one dark tone edge to edge (unchanged since round 10; B/E
 * match).
 */
const CREVICE_RAMP: [number, number] = [0.015, 0.035];
const OPEN_RAMP: [number, number] = [0.02, 0.055];
const SOIL_OPEN_RAMP: [number, number] = [0.05, 0.11];
/** the dry-out only happens in the soil zones: the lift is gated on the fill's soil weight, so the
 *  B/E lawn fill (soil 0.02–0.06 where the plaza's falloff reaches it) keeps its one dark tone */
const SOIL_OPEN_GATE: [number, number] = [0.1, 0.4];
const CREVICE_TINT: [number, number, number] = [1.0, 0.96, 0.84];
const TURF_CREVICE_TINT: [number, number, number] = [0.92, 0.9, 0.82];
const TURF_OPEN_TINT: [number, number, number] = [1.06, 1.14, 1.0];
const glslVec3 = (v: [number, number, number]) => v.map((n) => n.toFixed(4)).join(', ');

/**
 * The fill's albedo multiplier at a point `gap` metres from the nearest slab edge, for a fill
 * that is `soil` (0..1, zones.ts `jointSoil`) packed dirt and otherwise mossy earth — the CPU
 * twin of the joint shader's gap-field tint, so what sits in the seam (the grit) can be tinted
 * to the fill it sits on instead of to the fill's mid-seam average.
 */
export function jointFillLift(gap: number, soil = 1): [number, number, number] {
  const crevice = 1 - smoothstep(CREVICE_RAMP[0], CREVICE_RAMP[1], gap);
  const open = smoothstep(OPEN_RAMP[0], OPEN_RAMP[1], gap);
  const openSoil = smoothstep(SOIL_OPEN_RAMP[0], SOIL_OPEN_RAMP[1], gap) * smoothstep(SOIL_OPEN_GATE[0], SOIL_OPEN_GATE[1], soil);
  const out: [number, number, number] = [1, 1, 1];
  for (let i = 0; i < 3; i++) {
    const ks = 1 + (CREVICE_TINT[i] - 1) * crevice;
    const kSoil = ks + (OPEN_TINT[i] - ks) * openSoil;
    const kt = 1 + (TURF_CREVICE_TINT[i] - 1) * crevice;
    const kTurf = kt + (TURF_OPEN_TINT[i] - kt) * open;
    out[i] = kTurf + (kSoil - kTurf) * soil;
  }
  return out;
}

/**
 * The fill's two albedos (linear, from the palette): packed soil (`JOINT_SOIL` → `JOINT_SOIL_MID`
 * where the damp noise lifts it) and mossy earth — round 10's soil (`TURF_BASE`) pulled two
 * thirds of the way to the deep grass green, the reference's dark olive joint tone (B/E dark
 * quantile sRGB ≈ 95,79,49: hue 39°, sat 0.48, B/R 0.53 — ours rendered the soil at 122,97,64, a
 * fifth too bright and redder). The mossy earth keeps deriving from the round-10 constant so the
 * round-12 soil darkening leaves the B/E fill as tuned. `mean` is the tone at the damp noise's
 * mean (soil.lerp(mid, 0.3)) for the seam grit.
 */
export function jointFillTones(palette: WorldConfig['palette']): { soil: Color; soilMid: Color; turf: Color; turfMid: Color; lawn: Color; soilMean: Color; soilMeanR10: Color; turfMean: Color } {
  const soil = new Color(JOINT_SOIL);
  const soilMid = new Color(JOINT_SOIL_MID);
  const turf = new Color(TURF_BASE).lerp(new Color(palette.grassDeep), 0.56);
  const turfMid = new Color(TURF_BASE_MID).lerp(new Color(palette.grassMid), 0.55);
  // the lawn pocket's fill: the deep grass green itself (the sprouts' tufts sit on it)
  const lawn = new Color(palette.grassDeep).lerp(new Color(palette.grassMid), 0.15);
  return {
    soil,
    soilMid,
    turf,
    turfMid,
    lawn,
    soilMean: soil.clone().lerp(soilMid, 0.3),
    // round 10's soil mean: what the stair grit was built in (the stairs stay as they are)
    soilMeanR10: new Color(TURF_BASE).lerp(new Color(TURF_BASE_MID), 0.3),
    turfMean: turf.clone().lerp(turfMid, 0.3),
  };
}

/**
 * Joint width field: how far each point of the fill is from the nearest slab edge, as an 8-bit
 * texture over the paved bbox (5 cm texels). The fill shader reads it per pixel: a tight seam
 * (< 3 cm from both slabs) is damp, shaded soil; a wide junction (> 10 cm from any slab) is a
 * shade drier and lighter (round 8's uniformly dark fill turned the junctions into dark blobs —
 * 60 % of the B plaza box's SSIM loss — while frame 1 s's plaza seams are dark edge to edge).
 * Texels under a slab take the smallest value in their neighbourhood so bilinear filtering
 * along a slab edge stays on the seam's side of the ramp.
 */
function buildGapField(bbox: { x0: number; x1: number; z0: number; z1: number }, paving: JointPaving): { texture: DataTexture; rect: Vector4 } {
  const w = Math.ceil((bbox.x1 - bbox.x0) / GAP_CELL) + 1;
  const h = Math.ceil((bbox.z1 - bbox.z0) / GAP_CELL) + 1;
  const gap = new Float32Array(w * h);
  const under = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = bbox.x0 + i * GAP_CELL;
      const z = bbox.z0 + j * GAP_CELL;
      const k = j * w + i;
      gap[k] = Math.min(GAP_MAX, paving.edgeGap(x, z));
      under[k] = paving.onStone(x, z) ? 1 : 0;
    }
  }
  // under-slab texels: take the minimum of the 3×3 neighbourhood, three times (15 cm inward)
  for (let pass = 0; pass < 3; pass++) {
    const src = Float32Array.from(gap);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!under[k]) continue;
        let m = src[k];
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
            m = Math.min(m, src[jj * w + ii]);
          }
        }
        gap[k] = m;
      }
    }
  }
  const data = new Uint8Array(w * h);
  for (let k = 0; k < data.length; k++) data[k] = Math.round((gap[k] / GAP_MAX) * 255);
  const texture = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
  texture.name = 'joint-gap-field';
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  // world xz → texel-centre uv: u = ((x − x0) / cell + 0.5) / w
  return { texture, rect: new Vector4(bbox.x0 - GAP_CELL * 0.5, bbox.z0 - GAP_CELL * 0.5, 1 / (w * GAP_CELL), 1 / (h * GAP_CELL)) };
}

/**
 * the seam soil's albedo (sRGB hex) in shade and where the damp noise lifts it; shared with the
 * seam grit. Round 8's brown (0x80583a / 0xa47c52) fixed the hue but sat 16 % below the older
 * olive soil in linear luminance, and the wide joints at the seam junctions turned into dark
 * blobs the reference does not have (its junctions are pale, mossy soil) — 60 % of the B plaza
 * box's SSIM loss was one such junction. Round 10's values (0x8a603f / 0xab8356, hue 26–31°,
 * the olive soil's luminance) live on as `TURF_BASE*`: the mossy earth is derived from them.
 * Round 12: the soil proper — camera A's plaza core and the trodden strip — at 0.36× / 0.38× that
 * linear luminance and 4° more olive (hue 32°), the damp seam soil of frame 1 s: its plaza seams
 * sample at sRGB 78,66,45 (hue 40°, sat 0.45), 0.47 of its lit slab tops, where ours rendered
 * 104,85,57 — the visible fill at 0.82 of the tops (camera-ray classification: 42 % of the joint
 * pixels there are the far slab's lit flank, the rest fill); the A plaza box's dark quantile sat
 * at 0.405 against the reference's 0.330. The fill's rendered luminance follows the albedo about
 * linearly at this level, so the albedo carries most of the 0.55–0.6 ratio wanted.
 *
 * `JOINT_SOIL_DRY` is what a wide junction or a trodden margin dries out to (`SOIL_OPEN_RAMP`
 * below): the reference's dark tone is the seams only — its open dirt is pale (camera A's
 * lower-right margin, 64 % of whose fill is 10–30 cm from the nearest slab, reads p50 0.445 in
 * frame 1 s), so the dry tone stays at round 11's rendered open-dirt colour (0x8a603f × the old
 * 1.35/1.75/1.6 lift) while only the seams took the darkening.
 */
export const JOINT_SOIL = 0x523d25;
export const JOINT_SOIL_MID = 0x6c5336;
export const JOINT_SOIL_DRY = 0x9e7c4e;
const TURF_BASE = 0x8a603f;
const TURF_BASE_MID = 0xab8356;
/** the open-soil lift of the width tint: the dry dirt over the seam soil, per (linear) channel */
const OPEN_TINT: [number, number, number] = (() => {
  const dry = new Color(JOINT_SOIL_DRY);
  const seam = new Color(JOINT_SOIL);
  return [dry.r / seam.r, dry.g / seam.g, dry.b / seam.b];
})();

/**
 * The paving mask level the fill is clipped to (flagstones.ts `PAVED_ISO`: the level the slabs
 * are laid to and the vegetation's mask-derived rim follows) and the width of the band inside
 * that rim over which the fill fades to the turf tone.
 */
const FILL_ISO = 0.5;
const RIM_FADE = 0.1;

export async function buildJointMesh(
  terrain: Terrain,
  pavedLevel: (x: number, z: number) => number,
  bbox: { x0: number; x1: number; z0: number; z1: number },
  textures: TextureLibrary,
  config: WorldConfig,
  seed: string,
  paving?: JointPaving,
): Promise<{ mesh: Mesh; vertices: number; triangles: number; gapField: [number, number] | null; clippedCells: number; rimVertices: number; rimLength: number }> {
  const step = 0.2;
  const x0 = Math.floor(bbox.x0 / step) * step;
  const z0 = Math.floor(bbox.z0 / step) * step;
  const nx = Math.ceil((bbox.x1 - x0) / step);
  const nz = Math.ceil((bbox.z1 - z0) / step);
  // the grid's origin in global terrain-lattice indices, for the diagonal parity (heightfield.ts)
  const gi0 = Math.round(x0 / step);
  const gj0 = Math.round(z0 / step);
  const noise = new Noise2D(`${seed}/joints`);
  const P = config.palette;
  // vertex colours are the *absolute* albedo here (the shader turns the texture into a
  // luminance modulator). Two fills (jointFillTones): packed soil — the dark warm brown of the
  // concept sheet's seams (02 'Stone path': ≈ #5a4a38 in shade / #8a7458 lit, hue 32–34°) at an
  // albedo leaning redder (hue ≈ 26–31°, R/B 2.0–2.2) because the rendered seam is a mix of
  // fill, shaded stone flank and shadow and the post chain passes only part of an albedo hue
  // change — and mossy earth, the soil pulled toward the deep grass green, for the reference's
  // dark olive joints (B/E dark quantile sRGB ≈ 95,79,49, hue 39°, sat 0.48, B/R 0.53; the soil
  // rendered there at 122,97,64 — a fifth too bright and 5° too red — and reference C/D's
  // joints are more olive still). Round 10: mossy earth is the default, soil only where feet
  // keep the moss off (zones.ts `jointSoil`); moss proper takes over in patches.
  const { soil, soilMid, turf, turfMid, lawn: lawnFill } = jointFillTones(P);
  // (the moss patches keep round 10's soil in their blend so the B/E fill does not shift)
  const mossD = new Color(P.mossDeep).lerp(new Color(TURF_BASE), 0.25);
  const mossB = new Color(P.mossBright);
  const tmp = new Color();
  const tmp2 = new Color();

  // the paving mask at the grid points. The fill used to keep a whole 0.2 m quad when any corner
  // was paved (at mask 0.38), so along a rising turf bank the pale fill ran up to 28 cm past the
  // slabs onto the grass and its grid-aligned edge read as a row of pale teeth (reviewer, camera
  // F's near-right rim). Cells the FILL_ISO contour crosses are now clipped to it: the inside
  // polygon is walked around the cell with the crossings interpolated on the cell edges.
  const level = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) level[j * (nx + 1) + i] = pavedLevel(x0 + i * step, z0 + j * step);
  const inside = (v: number) => v >= FILL_ISO;

  // the turf tone the fill fades to over the last RIM_FADE metres inside the rim: the shaded
  // foot of the grass bank (deep grass pulled toward dark soil), so the fill's edge disappears
  // into the terrain instead of ending in a pale line
  const rimTone = new Color(P.grassDeep).lerp(new Color(P.soilDark), 0.35);

  const index = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const crossings = new Map<number, number>();
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const soilW: number[] = [];
  const rimW: number[] = [];
  const idx: number[] = [];
  /** iso segments (x, z, x, z) per grid cell key, for the rim-distance fade */
  const isoSegs = new Map<number, number[]>();
  let rimLength = 0;
  const cellKey = (i: number, j: number) => j * (nx + 1) + i;
  const emitVertex = (x: number, z: number) => {
    // 0.8 cm above the ground: the slabs stand 1.2–2 cm proud, so the seams read as sunken soil
    const y = terrain.height(x, z) + 0.008;
    pos.push(x, y, z);
    uv.push(x / 1.1, z / 1.1);
    const m = noise.fbm(x * 0.9 + 4, z * 0.9 - 2, 3) * 0.5 + 0.5;
    const dampN = noise.fbm(x * 0.25, z * 0.25 + 9, 2) * 0.5 + 0.5;
    // mossy earth everywhere feet do not keep it off (zones.ts): packed soil only in the dry
    // plaza core (camera A's foreground) and down the trodden strip of the north path
    const sw = jointSoil(x, z);
    tmp.copy(turf).lerp(turfMid, 0.5 * dampN);
    tmp2.copy(soil).lerp(soilMid, 0.5 * dampN);
    tmp.lerp(tmp2, sw);
    // the lawn pocket (zones.ts): dark lawn, not earth — the reference's grass west of the path
    // is darker than its joints (lum 0.28 vs 0.35) and green (hue 59°)
    tmp.lerp(lawnFill, 0.9 * lawnPocket(x, z));
    // moss proper takes over in patches where the noise peaks (thinner in the plaza centre,
    // a little heavier on the lawn paving where the slabs sit in it)
    const lawn = lawnZone(x, z);
    const mossAmt = smoothstep(0.42, 0.8, m) * (0.7 + 0.3 * dampN) * (1 - 0.35 * smoothstep(3.5, 0, Math.hypot(x, z))) * (1 + 0.3 * lawn);
    tmp.lerp(mossD, clamp(mossAmt, 0, 1) * 0.55);
    tmp.lerp(mossB, clamp(smoothstep(0.72, 0.96, m), 0, 1) * 0.3 * (1 - 0.5 * lawn));
    col.push(tmp.r, tmp.g, tmp.b);
    soilW.push(sw);
    rimW.push(0);
    return pos.length / 3 - 1;
  };
  const vertexFor = (i: number, j: number) => {
    const k = cellKey(i, j);
    if (index[k] < 0) index[k] = emitVertex(x0 + i * step, z0 + j * step);
    return index[k];
  };
  /** the iso crossing on the grid edge from corner (i, j) to (i + di, j + dj), shared by both cells */
  const crossingFor = (i: number, j: number, di: number, dj: number) => {
    const key = (cellKey(i, j) << 1) | (di ? 0 : 1);
    const hit = crossings.get(key);
    if (hit !== undefined) return hit;
    const f0 = level[cellKey(i, j)];
    const f1 = level[cellKey(i + di, j + dj)];
    // linear estimate, then bisection on the mask itself (its ramp is a smoothstep, so the
    // linear crossing can sit up to ~8 cm off the iso along a 20 cm edge)
    let t = clamp((FILL_ISO - f0) / (f1 - f0), 0, 1);
    let lo = 0;
    let hi = 1;
    const ex = x0 + i * step;
    const ez = z0 + j * step;
    for (let k = 0; k < 6; k++) {
      const ft = pavedLevel(ex + di * t * step, ez + dj * t * step);
      if (ft >= FILL_ISO === f0 >= FILL_ISO) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    const v = emitVertex(ex + di * t * step, ez + dj * t * step);
    crossings.set(key, v);
    return v;
  };
  // corners in the winding the full quads use: (0,0) → (0,1) → (1,1) → (1,0)
  const WALK: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];
  let clippedCells = 0;
  const poly: number[] = [];
  const polyIsCrossing: boolean[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      let n = 0;
      for (const [ci, cj] of WALK) if (inside(level[cellKey(i + ci, j + cj)])) n++;
      if (n === 0) continue;
      if (n === 4) {
        const va = vertexFor(i, j);
        const vb = vertexFor(i + 1, j);
        const vc = vertexFor(i, j + 1);
        const vd = vertexFor(i + 1, j + 1);
        // the terrain's diagonal for this cell (heightfield.ts), so the fill stays parallel to it
        if ((gi0 + i + gj0 + j) & 1) idx.push(va, vc, vb, vb, vc, vd);
        else idx.push(va, vc, vd, va, vd, vb);
        continue;
      }
      clippedCells++;
      poly.length = 0;
      polyIsCrossing.length = 0;
      for (let c = 0; c < 4; c++) {
        const [ci, cj] = WALK[c];
        const [ni, nj] = WALK[(c + 1) % 4];
        const inA = inside(level[cellKey(i + ci, j + cj)]);
        const inB = inside(level[cellKey(i + ni, j + nj)]);
        if (inA) {
          poly.push(vertexFor(i + ci, j + cj));
          polyIsCrossing.push(false);
        }
        if (inA !== inB) {
          // the edge runs from the lower-index corner toward the higher one
          const si = Math.min(ci, ni);
          const sj = Math.min(cj, nj);
          poly.push(crossingFor(i + si, j + sj, Math.abs(ni - ci), Math.abs(nj - cj)));
          polyIsCrossing.push(true);
        }
      }
      // consecutive crossings bound the paved region: remember them for the rim fade
      for (let a = 0; a < poly.length; a++) {
        const b = (a + 1) % poly.length;
        if (!polyIsCrossing[a] || !polyIsCrossing[b]) continue;
        const pa = poly[a] * 3;
        const pb = poly[b] * 3;
        const seg = [pos[pa], pos[pa + 2], pos[pb], pos[pb + 2]];
        rimLength += Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
        const k = cellKey(i, j);
        const list = isoSegs.get(k);
        if (list) list.push(...seg);
        else isoSegs.set(k, seg);
      }
      // the terrain is two planes per cell (heightfield.ts: diagonal b–c on odd parity, a–d on
      // even), so the polygon is split along that diagonal and each half fanned on its own —
      // a fan across the fold floated the fill up to 4 cm off a steep bank
      const odd = (gi0 + i + gj0 + j) & 1;
      const pn = poly.length;
      const side = new Float64Array(pn);
      for (let a = 0; a < pn; a++) {
        const u = (pos[poly[a] * 3] - x0) / step - i;
        const v = (pos[poly[a] * 3 + 2] - z0) / step - j;
        side[a] = odd ? u + v - 1 : u - v;
      }
      const EPS = 1e-6;
      const onDiagonal = new Map<number, number>();
      const diagonalCrossing = (a: number) => {
        let v = onDiagonal.get(a);
        if (v === undefined) {
          const b = (a + 1) % pn;
          const t = side[a] / (side[a] - side[b]);
          const pa = poly[a] * 3;
          const pb = poly[b] * 3;
          v = emitVertex(pos[pa] + (pos[pb] - pos[pa]) * t, pos[pa + 2] + (pos[pb + 2] - pos[pa + 2]) * t);
          onDiagonal.set(a, v);
        }
        return v;
      };
      for (const sign of [1, -1]) {
        const half: number[] = [];
        for (let a = 0; a < pn; a++) {
          const b = (a + 1) % pn;
          const sa = side[a] * sign;
          const sb = side[b] * sign;
          if (sa >= -EPS) half.push(poly[a]);
          if (Math.abs(sa) > EPS && Math.abs(sb) > EPS && sa * sb < 0) half.push(diagonalCrossing(a));
        }
        // each half lies in one terrain triangle and is convex: a fan triangulates it
        for (let a = 1; a + 1 < half.length; a++) {
          const p0 = half[0] * 3;
          const p1 = half[a] * 3;
          const p2 = half[a + 1] * 3;
          const area = (pos[p1] - pos[p0]) * (pos[p2 + 2] - pos[p0 + 2]) - (pos[p2] - pos[p0]) * (pos[p1 + 2] - pos[p0 + 2]);
          if (Math.abs(area) < 1e-9) continue;
          idx.push(half[0], half[a], half[a + 1]);
        }
      }
    }
  }
  // rim fade: vertices within RIM_FADE of an iso segment (searching the 3×3 cells around them)
  let rimVertices = 0;
  if (isoSegs.size) {
    for (let v = 0; v < rimW.length; v++) {
      const x = pos[v * 3];
      const z = pos[v * 3 + 2];
      const ci = Math.floor((x - x0) / step + 1e-6);
      const cj = Math.floor((z - z0) / step + 1e-6);
      let best = Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const list = isoSegs.get(cellKey(ci + di, cj + dj));
          if (!list) continue;
          for (let s = 0; s < list.length; s += 4) best = Math.min(best, segmentDistance(x, z, list[s], list[s + 1], list[s + 2], list[s + 3]));
        }
      }
      if (best >= RIM_FADE) continue;
      const w = 1 - smoothstep(0, RIM_FADE, best);
      rimW[v] = w;
      rimVertices++;
      tmp.setRGB(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]).lerp(rimTone, w);
      col[v * 3] = tmp.r;
      col[v * 3 + 1] = tmp.g;
      col[v * 3 + 2] = tmp.b;
      soilW[v] *= 1 - w;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aSoil', new Float32BufferAttribute(soilW, 1));
  g.setAttribute('aRim', new Float32BufferAttribute(rimW, 1));
  g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const [mapT, nT] = await Promise.all([textures.load('brown_mud_leaves_01', 'color'), textures.load('brown_mud_leaves_01', 'normal')]);
  const mat = new MeshStandardMaterial({ map: mapT, normalMap: nT, normalScale: new Vector2(0.7, 0.7), vertexColors: true, roughness: 0.96, metalness: 0 });
  mat.name = 'flagstone-joints';
  const gapField = paving ? buildGapField(bbox, paving) : null;
  // brown_mud_leaves_01 averages ~0.10 linear luminance: use it as a ±70 % luminance modulator on
  // top of the vertex albedo instead of multiplying (which turned the joints black). The wide
  // modulation keeps the seams' darkest pits (the reference's dark quantile, B p10 0.331) while
  // the fill's mean luminance sits at the pale packed-dirt level the junctions need.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGapMap = { value: gapField?.texture ?? null };
    shader.uniforms.uGapRect = { value: gapField?.rect ?? new Vector4(0, 0, 1, 1) };
    shader.uniforms.uGapMax = { value: GAP_MAX };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vJointXZ; attribute float aSoil; attribute float aRim; varying float vJointSoil; varying float vJointRim;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvJointXZ = (modelMatrix * vec4(transformed, 1.0)).xz; vJointSoil = aSoil; vJointRim = aRim;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vJointXZ; varying float vJointSoil; varying float vJointRim;\n${gapField ? '#define JOINT_GAP_FIELD' : ''}\nuniform sampler2D uGapMap; uniform vec4 uGapRect; uniform float uGapMax;`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
      #include <map_fragment>
      {
        // the mud texture as a luminance modulator: ± 70 % on the packed soil (its pits are
        // the reference's dark quantile), ± 45 % on the mossy earth, whose reference joints are
        // one even dark tone (B p10 fell to 0.27 against the reference's 0.33 at ± 70 %); at the
        // paved rim (aRim → 1) the fill is turf tone and the modulation eases to ± 30 %
        float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float d = clamp(l / 0.10, 0.3, 2.4);
        float rim = clamp(vJointRim, 0.0, 1.0);
        diffuseColor.rgb = vec3(mix(1.0, d, mix(mix(0.45, 0.7, clamp(vJointSoil, 0.0, 1.0)), 0.3, rim)));
      }
      #ifdef JOINT_GAP_FIELD
      {
        // joint width (see buildGapField): soil seams up to 10 cm stay the dark seam soil, wider
        // soil junctions and margins (5–11 cm from a slab) dry out to JOINT_SOIL_DRY, in the soil
        // zones only (gated on aSoil); the mossy earth keeps one dark tone at every width; no width
        // tint at the rim, where the gap field saturates (no slab outside the paving)
        float gap = texture2D(uGapMap, (vJointXZ - uGapRect.xy) * uGapRect.zw).r * uGapMax;
        float crevice = 1.0 - smoothstep(${CREVICE_RAMP[0].toFixed(4)}, ${CREVICE_RAMP[1].toFixed(4)}, gap);
        float open = smoothstep(${OPEN_RAMP[0].toFixed(4)}, ${OPEN_RAMP[1].toFixed(4)}, gap);
        float openSoil = smoothstep(${SOIL_OPEN_RAMP[0].toFixed(4)}, ${SOIL_OPEN_RAMP[1].toFixed(4)}, gap)
          * smoothstep(${SOIL_OPEN_GATE[0].toFixed(4)}, ${SOIL_OPEN_GATE[1].toFixed(4)}, clamp(vJointSoil, 0.0, 1.0));
        vec3 kSoil = mix(vec3(1.0), vec3(${glslVec3(CREVICE_TINT)}), crevice);
        kSoil = mix(kSoil, vec3(${glslVec3(OPEN_TINT)}), openSoil);
        vec3 kTurf = mix(vec3(1.0), vec3(${glslVec3(TURF_CREVICE_TINT)}), crevice);
        kTurf = mix(kTurf, vec3(${glslVec3(TURF_OPEN_TINT)}), open);
        diffuseColor.rgb *= mix(mix(kTurf, kSoil, clamp(vJointSoil, 0.0, 1.0)), vec3(1.0), clamp(vJointRim, 0.0, 1.0));
      }
      #endif`,
      );
  };
  mat.customProgramCacheKey = () => `flagstone-joints-v6-dry-gap${gapField ? '1' : '0'}`;
  const mesh = new Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'flagstone-joints';
  return { mesh, vertices: pos.length / 3, triangles: idx.length / 3, gapField: gapField ? [gapField.texture.image.width, gapField.texture.image.height] : null, clippedCells, rimVertices, rimLength };
}
