/**
 * Column trees — the dark mid-distance trunks of the forest wall (12–45 m from the hero cameras).
 *
 * The reference frames read their far wall as a few bold dark boles standing in bright haze:
 * ≈ 1–1.4 m thick, bare from the ground to 10–12 m, crowns only above that. The white-bark species
 * cannot give that (its pale bole matches the haze's luminance and its crown starts at 5–9 m), so
 * this family is a tall straight tree with a dark, lightly gnarled bole, buttress roots, and a
 * lobed laminae crown lifted onto the top 40 %: from 20–40 m the bole is a dark column with light
 * between it and the next, the crown a broken silhouette at the frame's top edge. Same writer
 * primitives and LOD scheme as the white-barks (three detail levels, one InstancedMesh per
 * variant/LOD); the bark is the giants' (materials.giantTree), so the trunks match the giant boles
 * the same frames show at 9–15 m. Geometry-only: metres, +Y up, base at y = 0.
 */
import { BufferGeometry, Color, Vector3 } from 'three';
import { createRng, type Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { GeometryWriter, TAU, UP, addLeaf, between, divergingLeaderPath, frame, growthPath, mergeParts, rootButtress, sample, stiffnessFor, tangent, taper, tube, type Detail, type RootButtressShape } from './writer';
import type { Palette, TreeAsset } from './whitebark';
import { buttressRoot, consumeTubeDraws, kneeBump, kneeStub, reliefBole, reliefBoleSteps, shadedSheetMask, sweepAxisAt, type BoleKnee } from './bole';
import { basePlants, basePlantsSteps, type BasePlantResult } from './base-plants';
import { NEAR_BASE_CUT_Y, NEAR_BASE_PITCH, nearBaseAmplitude } from './giant';
import { NEAR_CANOPY_MAX_Y, createNearCanopyKit, runSteps, swapRadiiFor, type HeroDistanceFn, type NearCanopyPart, type NearLobeRecord } from './nearCanopy';

/**
 * Round 46 (survey-2 crop 03, "buttress flares as faceted low-poly cones with a hard straight
 * base"): the plain roots — what a walker outside a column's near band sees (col-3 at 14 m from
 * w09-spine-l, band 10 / 13 m) — had a 6-step semicircular section meeting the ground at a
 * corner. Now 10 arc sides and a 0.6 fillet running out flat into the ground (writer.ts
 * RootButtressShape). The draws are unchanged, so nothing else re-rolls.
 */
export const PLAIN_ROOT_SHAPE: RootButtressShape = { arcSides: 10, fillet: 0.6 };

/**
 * A knee on a column's bole (round 40, the owner's bole brief): a one-sided swelling at `height`
 * (local m) toward the local horizontal unit vector `toward`, and the broken stub limb that leaves
 * it (bole.ts BoleKnee). Silhouette features, built at every detail level.
 */
export interface ColumnKnee {
  height: number;
  toward: Vector3;
  /** extra radius at the crest, fraction of the bole radius there */
  reach: number;
  /** vertical half-width of the swelling (m) */
  halfWidth: number;
  /** stub length (m; 0 = a burl only), collar radius as a fraction of the bole radius, elevation (rad) */
  stubLength: number;
  stubRadius: number;
  stubPitch: number;
}

/** A column tree plus the bole its `tube()` sweep was built from, for `ctx.shared.trunkSeats`. */
export interface ColumnAsset extends TreeAsset {
  /** the bole's ring centres in local space, base → fork (the first ring is the skirt below y = 0) */
  trunkPath: Vector3[];
  /** one nominal radius per `trunkPath` ring, before the gnarl relief (root flare included) */
  trunkRadii: number[];
  /** local height where the lowest bough leaves the bole (the crown begins here; ≤ the fork) */
  bareHeight: number;
  /** the near-bole bark as built (bole.ts; `ColumnParams.relief`), or null for the plain sweep */
  bark: { relief: number; rings: number; sides: number; mossShare: number; triangles: number } | null;
  /** the near base (giant.ts NEAR_BASE_CUT_Y), local space — built for the high detail only (the first build; `nearBaseBuild` repeats it, chunked, for the caller's LOD pool) */
  nearBase: BufferGeometry | null;
  nearBaseBuild: (() => Generator<void, BufferGeometry>) | null;
  nearBaseAudit: {
    relief: number;
    rings: number;
    sides: number;
    cutY: number;
    mossShare: number;
    fins: number;
    toes: number;
    /** 3-D moss cushions (bole.ts mossCushion) on the bole and the fins */
    cushions: number;
    woodTriangles: number;
    plants: BasePlantResult;
    triangles: number;
    /**
     * the near base holds fins and plants only and the plain roots alone fold for it (the bole
     * is never replaced). Round 46: false for every column — a relief column's near base carries
     * its own bole of the far sweep's field and the far rings under the cut fold for it.
     */
    rootsOnly: boolean;
  } | null;
  /** the knees as built (bole.ts), local distances along the sweep */
  knees: BoleKnee[];
  /** round 41: the near-canopy parts (nearCanopy.ts), local space — high detail only, empty otherwise */
  nearCanopy: NearCanopyPart[];
  /** swap groups this tree's lobes took (every detail tags them alike) */
  nearCanopyGroups: number;
  nearCanopyHeroKept: number;
  nearCanopyHeroLimited: number;
}

export interface ColumnBuildOptions {
  /** local ground height under local (x, z); only roots and the near base use it */
  groundAt?: (x: number, z: number) => number;
  /** build the near base for the high detail (default false: the far-wall columns never get close) */
  nearBase?: boolean;
  /** unit vector toward the sun in the tree's LOCAL frame (yaw undone): the shaded foot wears moss */
  sunDir?: Vector3;
  /** 0–1 path / paving mask under local (x, z) */
  pathAt?: (x: number, z: number) => number;
  basePalette?: Parameters<typeof basePlants>[2]['palette'];
  /** knees with stub limbs on the bole (local frame; see ColumnKnee) */
  knees?: ColumnKnee[];
  /**
   * Near-canopy LOD (nearCanopy.ts): tag the lower lobes' laminae with their swap group at every
   * detail and build the near parts for the high detail. `heroDistance` takes LOCAL centres (the
   * caller maps the seat's frame to the world). Undefined = no near canopy.
   */
  nearCanopy?: { heroDistance?: HeroDistanceFn };
}

export interface ColumnParams {
  seed: string;
  height: number;
  /** bole radius at the ground (before the root flare) */
  trunkRadius: number;
  leanDeg: number;
  leanAzimuth: number;
  /** height fraction where the bole forks into the crown leaders (the crown starts here) */
  fork: number;
  leaders: number;
  boughs: number;
  /** fraction of the bole (0 = ground, 1 = fork) where the lowest bough leaves it */
  boughStart: number;
  /** crown radius as a fraction of height */
  crownWidth: number;
  leafSize: [number, number];
  leafDensity: number;
  roots: number;
  /** buttress root reach as a multiple of the trunk radius (min, max) */
  rootReach: [number, number];
  /** extra bole radius at the ground (fraction of the trunk radius), gone by ≈ 3 m up */
  flare: number;
  /** metres of bark texture per tile around the bole */
  barkTile: number;
  /** amplitude of the bole's gnarl (radius displacement, fraction) — also its crevice shading */
  gnarl: number;
  /**
   * near-bole bark (bole.ts): relief amplitude scale for a bole a hero camera sees from a few
   * metres (1 = the default for its radius). Unset = the plain sweep (the far columns, the hut hosts).
   */
  relief?: number;
  /** round 44: the relief bole's moss stands proud of the cords by this × the amplitude (bole.ts mossBulge); unset = flat */
  mossBulge?: number;
  /**
   * Round 45 (trees-27's leftover: "columns beyond ~15 m read as pale cylinders"): the far
   * columns' colouring for distance. `barkDark` scales the bark tones (1 = the round-44 bark);
   * `grime` is the strength of the soil-dark band at the foot (0.45 = the round-44 band, to 3 m;
   * larger also reaches higher); `toneBands` is the relief's albedo band amplitude (bole.ts
   * BoleReliefOptions.toneBands); `flareFall` is the exponent rate of the basal flare's decay
   * with height / H (9 = the default, gone by ≈ 3 m; smaller = a foot that reads from 20 m).
   * Unset = the round-44 column (the emergent, whose bole camera D has at 4.4 m).
   */
  barkDark?: number;
  grime?: number;
  toneBands?: number;
  flareFall?: number;
  /**
   * Round 52 (the owner's 09-23 markup, red circle 1: the column left of the north path is "a
   * smooth pale cylinder in grey haze"). Knees and broken stub limbs on the bole's BARE run, in
   * the variant's own local frame (`azimuthDeg`: 0 = local +x, turned with the seat's yaw like
   * everything else the variant carries), so a column seen at 12–35 m has a silhouette instead of
   * a profile: a swelling breaks its edge and the stub stands out of it against the haze. The
   * emergent and the hut host keep the authored / no knees they had (`ColumnBuildOptions.knees`
   * is merged with these).
   */
  boleKnees?: { height: number; azimuthDeg: number; reach: number; halfWidth: number; stubLength: number; stubRadius: number; stubPitch: number }[];
}

/** Deterministic architecture for variant `index` of `total`. */
export function columnParams(rng: Rng, index: number, total: number): ColumnParams {
  const r = rng.fork(`variant-${index}`);
  // the taller variants are also the girthier ones (old trees), spread evenly over the set
  const f = total > 1 ? index / (total - 1) : 0.5;
  // round 52: two knees on the bare run (see ColumnParams.boleKnees). Own fork — the draws below
  // and every seat, white-bark and giant after them are unmoved. The lower one (3.6–4.7 m) always
  // carries a broken stub, the upper (7.0–8.2 m, still under the lowest bough at ≈ 8.4 m) carries
  // one on half the variants and is a burl on the rest; the azimuths are a third of a turn apart
  // plus a jitter, so a column never shows both on the same edge.
  const kr = r.fork('knees');
  const kneeTurn = kr.range(0, 360);
  const boleKnees = [0, 1].map((i) => ({
    height: i === 0 ? 3.6 + kr.range(0, 1.1) : 7.0 + kr.range(0, 1.2),
    azimuthDeg: kneeTurn + i * 132 + kr.range(-40, 40),
    reach: kr.range(0.26, 0.4),
    halfWidth: kr.range(0.5, 0.8),
    stubLength: i === 0 ? kr.range(0.95, 1.6) : kr.chance(0.5) ? kr.range(0.7, 1.15) : 0,
    stubRadius: kr.range(0.17, 0.25),
    stubPitch: kr.range(0.1, 0.5),
  }));
  return {
    boleKnees,
    seed: `col-${index}-${r.int(0, 1e9)}`,
    height: 17.5 + f * 5 + r.range(-0.6, 0.6),
    trunkRadius: 0.5 + f * 0.2 + r.range(-0.03, 0.03),
    leanDeg: r.range(1, 4),
    leanAzimuth: r.range(0, TAU),
    fork: r.range(0.54, 0.62),
    leaders: r.int(2, 4),
    boughs: r.int(4, 6),
    boughStart: 0.72,
    crownWidth: r.range(0.2, 0.27),
    leafSize: [0.24, 0.36],
    leafDensity: r.range(0.9, 1.1),
    roots: r.int(5, 8),
    rootReach: [2.4, 3.8],
    // round 45: a foot that survives distance — the flare 0.55 → 0.85 of the radius at the
    // ground and falling at 6 instead of 9 (0.47 R extra at 2 m, 0.26 R at 4 m; was 0.23 / 0.09)
    flare: 0.85,
    flareFall: 6,
    barkTile: 1.6,
    gnarl: 0.1,
    // round 44 (survey #2: "column trees are untextured grey cylinders"): the near-bole cords and
    // furrows (bole.ts) at every distance and every detail, as the emergent has had since round
    // 40 — 0.7 of the default amplitude for the radius (≈ 5 cm on a 60 cm bole): the cords and
    // their crevice shading read from 5–20 m, the silhouette stays a straight dark column
    relief: 0.7,
    mossBulge: 0.5,
    // round 45: coloured for 15–45 m in haze (with the columns' own bark floor, materials.ts
    // COLUMN_BARK_FLOOR): the bark 0.84 of the round-44 tones, the soil-dark grime 0.7 to 4 m,
    // ±24 % tone bands around and along the bole
    barkDark: 0.84,
    grime: 0.7,
    toneBands: 0.24,
  };
}

/**
 * The emergent: one very tall column (≈ 28 m) with a straight bole bare to ≈ 18 m and a narrow, thin
 * crown on the top third. It is the near dark trunk of a hero frame's edge (reference B's left
 * 13 %: a 1.5 m bole from the ground out of the frame's top), so the crown is never in a frame;
 * what matters is where its shadow lands — from a seat beside the plaza, foliage 18–28 m up throws
 * its shade ≥ 14 m east-south-east of the bole, past the plaza and the stair bank the sun
 * corridors keep lit (index.ts), and only the bole's thin shadow crosses them. Short roots and a
 * slight flare keep it off a path edge it may stand next to; the same bole stands 4.4 m from
 * camera D, so its bark is tiled finer and gnarled deeper than the far columns' (which the haze
 * would flatten anyway) to keep that frame's texture where it hides the verge ferns.
 */
export function emergentParams(rng: Rng): ColumnParams {
  const r = rng.fork('emergent');
  return {
    seed: `col-emergent-${r.int(0, 1e9)}`,
    height: 28 + r.range(-0.4, 0.4),
    trunkRadius: 0.62 + r.range(-0.02, 0.02),
    leanDeg: r.range(0.5, 2),
    leanAzimuth: r.range(0, TAU),
    fork: r.range(0.66, 0.7),
    leaders: 3,
    boughs: 4,
    boughStart: 0.88,
    crownWidth: r.range(0.14, 0.16),
    leafSize: [0.24, 0.36],
    leafDensity: 0.75,
    roots: 7,
    rootReach: [1.4, 1.9],
    flare: 0.3,
    barkTile: 1.0,
    gnarl: 0.14,
    // Round 17 integration switched the near-bole cords and furrows (bole.ts) OFF here — the
    // frame shows a near-smooth hazed column 4.4 m from camera D, 8.4 m from B, and the relief
    // cost B −0.001 / D −0.004 SSIM. Round 40 (the owner's markup on our own frame A, 14 m: "the
    // smooth pale bole at the left edge") turns it back on at every distance, with the knees,
    // moss sheets and lichen the brief asks for (createColumnTree, ColumnBuildOptions.knees);
    // the owner accepted the SSIM for real detail. 0.85 of the default amplitude for its radius
    // (≈ 6.7 cm on a 62 cm bole): the cords read at 4–14 m, the silhouette stays a column.
    relief: 0.85,
  };
}

/**
 * Round 50 (trees-32): the far hut's host — the tree-trunk hut on the knoll 53 m south-west of the
 * plaza (layout `EXPANSION.farHut`) hangs on this column: the placeholder's bole (`farHutTrunk`:
 * 0.78 m at the foot, 10.5 m, crown 9.9 m) as a proper column with the columns' bark, taper, relief
 * and grime, and a SMALL crown. 14 m, not the regular 17.5–22.5 m: the hut's cap top is 9.3 m over
 * the foot (floor 5.6 + wall 2.2 + cap 1.5), so the fork sits at 10.1 m and the lowest bough
 * leaves it there — nothing of the crown grows through the cap — and the crown (2.5 m) stays a
 * clump over the roof, not a canopy over the knoll. This column's meshes NEVER cast (the trees
 * index): its shadow footprint runs 1.28 m ESE per m of height, and a 13 m column's tip already
 * sat on camera C's west edge (layout.ts farHutTrunk) — the shadow, not the tree, is what the six
 * frames could see.
 */
export function hutHostParams(rng: Rng): ColumnParams {
  const r = rng.fork('hut-host');
  return {
    seed: `col-hut-host-${r.int(0, 1e9)}`,
    height: 14 + r.range(-0.3, 0.3),
    trunkRadius: 0.78,
    leanDeg: r.range(1.5, 3),
    leanAzimuth: r.range(0, TAU),
    fork: 0.72,
    leaders: 3,
    boughs: 4,
    boughStart: 0.98,
    crownWidth: 0.18,
    leafSize: [0.24, 0.36],
    leafDensity: 0.9,
    roots: 6,
    rootReach: [2.2, 3.2],
    flare: 0.85,
    flareFall: 6,
    barkTile: 1.6,
    gnarl: 0.1,
    relief: 0.7,
    mossBulge: 0.5,
    barkDark: 0.84,
    grime: 0.7,
    toneBands: 0.24,
  };
}

/** `groundAt` samples terrain in this particular seat's local coordinates; only roots use it. */
export function createColumnTree(p: ColumnParams, palette: Palette, detail: Detail, groundAtIn: ((x: number, z: number) => number) | ColumnBuildOptions = () => 0): ColumnAsset {
  const o: ColumnBuildOptions = typeof groundAtIn === 'function' ? { groundAt: groundAtIn } : groundAtIn;
  const groundAt = o.groundAt ?? (() => 0);
  const rng = createRng(`column/${p.seed}`);
  const bt = (a: number, b: number) => between(rng, a, b);
  const gnarl = new Noise2D(`column-bark/${p.seed}`);
  const wood = new GeometryWriter(detail);
  const leaves = new GeometryWriter(detail);
  const H = p.height;
  const R = p.trunkRadius;
  // well below the giants' bark tones (giant.ts, 0.70/0.64/0.56): at 20–35 m the haze mixes ≈ 55–65 %
  // of its own brightness into whatever stands there, so only a bole this dark still reads as a
  // dark column against it (the reference's far trunks sit 0.03–0.07 under the haze between them,
  // its near ones at 0.30–0.33); never the pale white-bark species beside them
  const barkDark = p.barkDark ?? 1;
  const barkBase = new Color(0.44, 0.39, 0.33).multiplyScalar(barkDark);
  const barkDeep = new Color(0.19, 0.155, 0.125).multiplyScalar(barkDark);
  const canopy = new Color(palette.leafCanopy);
  const sunny = new Color(palette.leafSun);
  const grimeStrength = p.grime ?? 0.45;
  // the grime reaches higher as it strengthens (0.45 → 3 m, 0.7 → 4 m), its lower metre darkest
  const grimeTop = 3 + (grimeStrength - 0.45) * 4;
  const barkColor = (pt: Vector3) => {
    const soil = 1 - smoothstep(-0.5, grimeTop, pt.y);
    return barkBase.clone().lerp(barkDeep, Math.min(0.85, grimeStrength) * soil).multiplyScalar(0.92 + 0.1 * smoothstep(3, 14, pt.y));
  };
  const gnarlBump = (angle: number, distance: number) => {
    const cx = Math.cos(angle) * 1.6;
    const cz = Math.sin(angle) * 1.6;
    const low = gnarl.fbm(cx + distance * 0.11, cz + distance * 0.09, 3);
    const flute = Math.sin(angle * 6 + distance * 0.1) * 0.3;
    return 1 + p.gnarl * (low * 0.9 + flute * 0.4);
  };
  const stiff = () => 1;

  // ---------- bole ----------
  const crownRadius = H * p.crownWidth;
  const forkY = H * p.fork;
  const lean = Math.tan((p.leanDeg * Math.PI) / 180) * forkY;
  const top = new Vector3(Math.cos(p.leanAzimuth) * lean, forkY, Math.sin(p.leanAzimuth) * lean);
  const skirt = 0.8;
  const trunk = growthPath(new Vector3(0, -skirt, 0), top, UP, rng, 22, 0.14);
  const forkRadius = R * 0.42;
  const trunkRadii = trunk.map((pt, i) => {
    const t = i / (trunk.length - 1);
    const above = Math.max(0, pt.y) / H;
    const radius = forkRadius + (R - forkRadius) * Math.pow(1 - t, 0.85);
    return radius * (1 + p.flare * Math.exp(-above * (p.flareFall ?? 9)));
  });
  let bark: ColumnAsset['bark'] = null;
  // the plain sweep's up-front draws are taken here whichever bole is built, so the near base
  // (below) can end on exactly the plain sweep's cut ring; the rings under the cut are collapsible
  const draws = consumeTubeDraws(rng, 16);
  const buildNearBase = o.nearBase === true && detail === 'high';
  const cutIndex = Math.max(1, trunk.findIndex((pt) => pt.y >= NEAR_BASE_CUT_Y));
  const cutY = trunk[cutIndex].y;
  const refRadius = (() => {
    let best = trunkRadii[0];
    let bestD = Infinity;
    trunk.forEach((pt, i) => {
      const dd = Math.abs(pt.y - 2);
      if (dd < bestD) {
        bestD = dd;
        best = trunkRadii[i];
      }
    });
    return best;
  })();
  // knees (ColumnKnee → bole.ts BoleKnee): the local `toward` vector becomes an angle in the
  // sweep's own ring frame at the knee's distance along it, so the swelling and the stub leave
  // the bole where the caller pointed whatever the parallel-transported frame has turned to
  const axisAt = sweepAxisAt(trunk, trunkRadii);
  const cumulative: number[] = [0];
  for (let i = 1; i < trunk.length; i++) cumulative.push(cumulative[i - 1] + trunk[i].distanceTo(trunk[i - 1]));
  const distanceAtHeight = (y: number) => {
    for (let i = 0; i < trunk.length - 1; i++) {
      if (trunk[i + 1].y >= y) {
        const f = Math.max(0, Math.min(1, (y - trunk[i].y) / Math.max(1e-6, trunk[i + 1].y - trunk[i].y)));
        return cumulative[i] + (cumulative[i + 1] - cumulative[i]) * f;
      }
    }
    return cumulative[cumulative.length - 1];
  };
  // the variant's own knees (ColumnParams.boleKnees, local azimuths) and whatever the caller
  // authored in world space (ColumnBuildOptions.knees — the emergent's pair)
  const kneeSpecs: ColumnKnee[] = [
    ...(p.boleKnees ?? []).map((k) => ({ ...k, toward: new Vector3(Math.cos((k.azimuthDeg * Math.PI) / 180), 0, Math.sin((k.azimuthDeg * Math.PI) / 180)) })),
    ...(o.knees ?? []),
  ];
  const knees: BoleKnee[] = kneeSpecs.map((k) => {
    const distance = distanceAtHeight(k.height);
    const { u, v } = axisAt(distance);
    return { distance, azimuth: Math.atan2(k.toward.dot(v), k.toward.dot(u)), reach: k.reach, halfWidth: k.halfWidth, stubLength: k.stubLength, stubRadius: k.stubRadius, stubPitch: k.stubPitch };
  });
  const boleBump = knees.length ? (angle: number, distance: number) => gnarlBump(angle, distance) * kneeBump(knees, angle, distance) : gnarlBump;
  // the sun in the local frame → the horizontal direction away from it: the moss sheets' side
  const shadeDir = o.sunDir ? new Vector3(-o.sunDir.x, 0, -o.sunDir.z).normalize() : undefined;
  const centreAt = (y: number) => {
    const d = distanceAtHeight(y);
    const c = axisAt(d).centre;
    return { x: c.x, z: c.z };
  };
  /** the relief bole's field (bole.ts): shared by the far sweep and the near base so they meet at the cut ring */
  const reliefNoise = new Noise2D(`column-relief/${p.seed}`);
  const reliefAmplitude = Math.max(0.06, Math.min(0.15, 0.11 * Math.sqrt(refRadius / 1.2))) * (p.relief ?? 0);
  const reliefShared = {
    color: barkColor,
    bump: boleBump,
    creviceShade: 1.8 * (p.gnarl / 0.1),
    barkTile: p.barkTile,
    refRadius,
    noise: reliefNoise,
    draws,
    stiffness: stiff,
    flatBase: true,
    mossBand: [1.5, 5] as [number, number],
    mossStrength: 0.7,
    shadeDir,
    sheetBand: [0.8, 2.4] as [number, number],
    mossExtra: shadeDir ? shadedSheetMask(shadeDir, reliefNoise, [0, 5.5], 0.9, centreAt) : undefined,
    lichen: { band: [3, 12] as [number, number], strength: 0.8 },
    toneBands: p.toneBands,
  };
  if (p.relief) {
    // the near-bole bark (bole.ts) at EVERY distance: the plain sweep's draws are consumed so the
    // roots and crown below draw the same stream; medium / low details keep the plain sweep's
    // side reduction. Moss sheets climb the shaded side to ≈ 7 m with a ragged edge
    // (shadedSheetMask), lichen plates sit on the cords' crests from 3 m up. Round 46 (survey-2
    // check 02, the emergent at 4.4 m "a flat camo decal"): the rings under the cut are
    // collapsible again — the near base carries its own finer bole of the SAME field (below),
    // drawn by the near-base program (fine bark, textured moss, its own floor), and the far
    // rings fold for it; the moss cover rides in the collapsible code (writer.ts woodMoss).
    const sideScale = detail === 'high' ? 1 : detail === 'medium' ? 0.72 : 0.5;
    const built = reliefBole(wood, trunk, trunkRadii, {
      ...reliefShared,
      sides: Math.max(24, Math.min(120, Math.round(((TAU * refRadius) / 0.075) * sideScale))),
      spacing: detail === 'high' ? 0.2 : 0.4,
      denseUntilY: 14,
      amplitude: reliefAmplitude,
      fadeY: [12, 18],
      farShare: 0.35,
      // round 44: the moss sheets stand a little proud of the cords (no extra triangles). Not the
      // emergent: camera D has its bole at 4.4 m and the frame is matched to the flat cover.
      mossBulge: p.mossBulge,
      collapsible: (pt) => buildNearBase && pt.y < cutY - 1e-6,
    });
    bark = { relief: built.amplitude, rings: built.rings, sides: built.sides, mossShare: built.mossShare, triangles: built.triangles };
  } else {
    tube(wood, trunk, trunkRadii, 16, rng, {
      color: barkColor,
      roughness: 0.05,
      bump: boleBump,
      // crevice shading scaled with the gnarl so a deeper gnarl also reads darker in its folds
      creviceShade: 1.8 * (p.gnarl / 0.1),
      barkTile: p.barkTile,
      flatBase: true,
      isTrunk: true,
      structural: true,
      stiffness: stiff,
      draws,
      collapsible: (pt) => buildNearBase && pt.y < cutY - 1e-6,
    });
  }
  // the knees' stubs, from their own stream (the roots and crown below draw what they did)
  if (knees.length) {
    const krng = rng.fork('knee-stubs');
    for (const knee of knees) kneeStub(wood, knee, axisAt(knee.distance).radius, axisAt, barkColor, krng, gnarl, 0.7);
  }

  // ---------- buttress roots ----------
  const rootColor = barkBase.clone().lerp(barkDeep, 0.5);
  /** the plain roots' architecture (angle, reach), for the near base's fins */
  const plainRoots: { angle: number; length: number; width: number }[] = [];
  wood.woodCollapsible = buildNearBase;
  wood.woodIsRoot = true;
  for (let i = 0; i < p.roots; i++) {
    const angle = (i / p.roots) * TAU + bt(-0.25, 0.25);
    const length = R * bt(p.rootReach[0], p.rootReach[1]);
    const width = R * bt(0.42, 0.6);
    const height = R * bt(0.9, 1.3);
    plainRoots.push({ angle, length, width });
    rootButtress(wood, angle, length, width, height, rootColor, rng, groundAt, undefined, 7, PLAIN_ROOT_SHAPE);
  }
  wood.woodCollapsible = false;
  wood.woodIsRoot = false;

  // ---------- near base (giant.ts NEAR_BASE_CUT_Y) ----------
  let nearBase: BufferGeometry | null = null;
  let nearBaseBuild: ColumnAsset['nearBaseBuild'] = null;
  let nearBaseAudit: ColumnAsset['nearBaseAudit'] = null;
  /**
   * One build of the near base, chunked (yields after the bole, after every fin, after the
   * plants), from its own forked stream: every run returns the same geometry (lodPool.ts).
   */
  function* nearBaseSteps(): Generator<void, { geometry: BufferGeometry; audit: NonNullable<ColumnAsset['nearBaseAudit']> }> {
    const nb = new GeometryWriter('high');
    const nrng = rng.fork('near-base');
    const nNoise = new Noise2D(`column-near-relief/${p.seed}`);
    /**
     * Round 46 (survey-2 check 02 / w07-spine-l: the emergent's bole at 4.4 m was still "a flat
     * camo decal" — its relief sweep is drawn by the far program, whose hero-calibrated floor
     * (materials.ts NEAR_BOLE_FLOOR, lift 13 / texture 0.25) and flat vertex-cover moss swallow
     * the cords; the near base held fins only). A relief column's near base now carries its own
     * bole to the cut: the SAME cord field, draws, tints and knees as the far sweep (so the two
     * coincide at the cut ring, where the far bole goes on), at twice the tessellation, 1.6 × the
     * amplitude at the foot fading to the far amplitude at the cut, the moss as a bulge with 3-D
     * cushions — and drawn by the near-base program (fine bark at BARK_DETAIL_M, textured moss
     * with its slopes in the normal, NEAR_BASE_FLOOR). The far rings under the cut fold for it.
     */
    const rootsOnly = false;
    const nearScale = 1.6;
    const bole = p.relief
      ? yield* reliefBoleSteps(nb, trunk.slice(0, cutIndex + 1), trunkRadii.slice(0, cutIndex + 1), {
          ...reliefShared,
          sides: Math.max(48, Math.min(200, Math.round((TAU * refRadius) / 0.04))),
          spacing: 0.1,
          denseUntilY: cutY + 1,
          amplitude: reliefAmplitude * nearScale,
          fadeY: [cutY - 2.5, cutY],
          farShare: 1 / nearScale,
          cap: false,
          // the bulge meets the far bole flush at the cut: the emergent's far sweep has none
          mossBulge: p.mossBulge ?? 0.6,
          bulgeFade: p.mossBulge ? undefined : [cutY - 2, cutY],
          // round 51 (the owner at the emergent's foot): fewer and smaller — 3 % of the eligible
          // vertices at 3.5–8 cm (was 5 % at 4–10 cm, up to 220): moss lumps in the furrows, not a
          // stuck-on leaf every hand's width; the tints darkened in bole.ts with them
          cushions: { rng: nrng.fork('cushions'), density: 0.03, size: [0.035, 0.08], maxCount: 120 },
        })
      : yield* reliefBoleSteps(nb, trunk.slice(0, cutIndex + 1), trunkRadii.slice(0, cutIndex + 1), {
          color: barkColor,
          bump: boleBump,
          creviceShade: 1.8 * (p.gnarl / 0.1),
          barkTile: p.barkTile,
          roughness: 0.05,
          sides: Math.max(40, Math.min(120, Math.round((TAU * refRadius) / 0.05))),
          spacing: 0.14,
          denseUntilY: cutY + 1,
          amplitude: nearBaseAmplitude(refRadius),
          pitch: NEAR_BASE_PITCH,
          fadeY: [cutY + 10, cutY + 20],
          farShare: 1,
          endFade: [cutY - 1.8, cutY],
          cap: false,
          refRadius,
          noise: nNoise,
          draws,
          stiffness: stiff,
          flatBase: true,
          mossBand: [0.6, 3.5],
          mossStrength: 0.9,
          shadeDir,
          sheetBand: [0.8, 2.0],
        });
    yield;
    let cushions = bole.cushions;
    // fins along the plain buttresses' directions: a centreline from the collar out to the reach,
    // riding the ground, then split toes (bole.ts)
    let toes = 0;
    const finFoot: { path: Vector3[]; halfWidth: number }[] = [];
    const flareR = trunkRadii[Math.max(0, trunk.findIndex((pt) => pt.y >= 0))];
    for (let i = 0; i < plainRoots.length; i++) {
      const root = plainRoots[i];
      const dir = new Vector3(Math.cos(root.angle), 0, Math.sin(root.angle));
      const side = new Vector3(-dir.z, 0, dir.x);
      const segments = 9;
      const path: Vector3[] = [];
      const radii: number[] = [];
      const r0 = root.width * 0.55;
      const wiggle = nrng.range(0.1, 0.25);
      const wPhase = nrng() * TAU;
      for (let k = 0; k <= segments; k++) {
        const t = k / segments;
        const d = flareR * 0.5 + (root.length - flareR * 0.5) * t;
        const q = dir.clone().multiplyScalar(d).addScaledVector(side, Math.sin(t * 4 + wPhase) * wiggle * t);
        const g = groundAt(q.x, q.z);
        const radius = 0.05 + (r0 - 0.05) * Math.pow(1 - t, 0.9);
        const dive = smoothstep(0, 0.4, t);
        q.y = (1 - dive) * (flareR * 0.55 * (1 - t) + g) + dive * (g + radius * 0.35);
        if (k === segments) q.y = g - 0.2;
        path.push(q);
        radii.push(radius);
      }
      const big = i % 2 === 0;
      const built = buttressRoot(nb, path, radii, {
        groundAt,
        pathAt: o.pathAt,
        color: barkColor,
        draws: consumeTubeDraws(nrng, 10),
        rng: nrng.fork(`root-toes/${i}`),
        flare: big ? 2.2 : 1.5,
        finHeight: big ? 1.9 : 1.3,
        maxReach: root.length + 0.1,
        stiffness: stiff,
        noise: nNoise,
        mossStrength: 0.9,
        // round 46: 3-D cushions on the fins' backs (the giants' fins have had them since round 44)
        cushions: { rng: nrng.fork(`fin-cushions/${i}`), density: 0.08, size: [0.04, 0.09], maxCount: 30 },
      });
      toes += built.toes;
      cushions += built.cushions;
      finFoot.push({ path, halfWidth: r0 * (big ? 2.2 : 1.5) });
      yield;
    }
    const woodTriangles = nb.triangles;
    const clear = (x: number, z: number) => {
      for (const f of finFoot) {
        for (let i = 0; i < Math.ceil(f.path.length * 0.6); i++) {
          const a = f.path[i];
          const b = f.path[Math.min(f.path.length - 1, i + 1)];
          const abx = b.x - a.x;
          const abz = b.z - a.z;
          const len2 = abx * abx + abz * abz || 1;
          const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2));
          const dx = x - (a.x + abx * t);
          const dz = z - (a.z + abz * t);
          if (dx * dx + dz * dz < f.halfWidth * f.halfWidth * 0.8) return false;
        }
      }
      return true;
    };
    const plants = yield* basePlantsSteps(nb, nrng.fork('plants'), {
      groundAt,
      pathAt: o.pathAt,
      clear,
      footRadius: flareR * 1.05,
      reach: flareR + 1.4,
      density: 0.6,
      shadeDir,
      palette: o.basePalette ?? {
        fern: new Color(0x5b6838),
        fernDeep: new Color(0x3c4927),
        tuft: new Color(0x5e764a),
        tuftSun: new Color(0x8a9a4c),
        litter: new Color(0x69613c),
        litterDark: new Color(0x423b26),
      },
    });
    yield;
    const geometry = yield* nb.finishSteps(`column-near-base-${p.seed}`);
    return { geometry, audit: { relief: bole.amplitude, rings: bole.rings, sides: bole.sides, cutY, mossShare: bole.mossShare, fins: plainRoots.length, toes, cushions, woodTriangles, plants, triangles: nb.triangles, rootsOnly } };
  }
  if (buildNearBase) {
    const first = runSteps(nearBaseSteps());
    nearBase = first.geometry;
    nearBaseAudit = first.audit;
    nearBaseBuild = function* () {
      return (yield* nearBaseSteps()).geometry;
    };
  }

  // ---------- crown ----------
  const leafOpts = (radius: number) => ({
    widthRatio: 0.62,
    wideFirst: 0.72,
    wideSecond: 0.8,
    stiffness: stiffnessFor(radius),
    flutter: 0.03,
    // seen from 20–45 m: stylised laminae; distance LODs keep every 3rd / 6th. Round 44 (survey
    // #2, crop 33: the crowns against the sky were "flat spiky cut-outs" — 4-triangle kites at
    // 0.3 m): the high detail, the one a walker under a column sees, builds the obovate
    // 8-triangle lamina (writer.ts addLeaf) — a rounded blade with a tip, the layered masses
    // the near canopy dresses; medium / low keep their kites (they are 3–6 px there)
    detailOverride: (detail === 'high' ? 'high' : 'medium') as Detail,
    mediumEvery: 3,
    lowEvery: 6,
    mediumScale: 1.7,
    lowScale: 2.4,
    tipColor: new Color('#8a9a4c'),
  });
  /**
   * A leaf lobe on a bough end: a few twigs fan from the bough into an ellipsoid and each carries
   * a spray of laminae, denser toward the shell so the lobe is a broken mass with a dark heart.
   */
  // near-canopy LOD (nearCanopy.ts): the lobes below the cap recorded while written, their far
  // laminae tagged with the lobe's group; the eligibility and the groups are the same at every
  // detail (the same stream, the same lobes), so a slot folds whichever LOD is drawn
  const near = o.nearCanopy;
  const nearLobes: NearLobeRecord[] = [];
  let nearGroups = 0;
  const nearTally = { kept: 0, limited: 0 };
  // Round 45 (survey w19-spine-u: "pale twig tips spiking the rim" of the crowns seen from
  // below): the twigs ran to 0.55–0.95 of the lobe's radius — their bare last 20 cm stood past
  // the laminae, and a 5 cm shaded twig against the sky is a pale line under the bark floor. The
  // twigs now end at 0.45–0.8 hR (the laminae along them, 0.25–0.35 m and turned outward, close
  // over the ends) and their wood is tinted from the bark toward the deep leaf tone over the
  // outer half, as are the leaders' and boughs' ends inside the lobes, so whatever still shows
  // between laminae reads as the mass's own dark, not a spike.
  const twigTip = canopy.clone().multiplyScalar(0.55);
  const lobe = (bough: Vector3[], boughRadius: number, center: Vector3, hR: number, vR: number, vigor: number) => {
    const twigs = 7;
    const count = Math.max(2, Math.round(56 * p.leafDensity));
    const phase = rng() * TAU;
    let rec: NearLobeRecord | null = null;
    if (near && center.y <= NEAR_CANOPY_MAX_Y) {
      const radii2 = swapRadiiFor(near.heroDistance, center, hR + 1.4, nearTally);
      if (radii2) {
        rec = { group: nearGroups++, center: center.clone(), hR, vR, stem: bough, stemRadii: taper(bough, boughRadius, 0.02, 1.05), secondaries: [], twigs: [], farLeaves: 0, farCards: 0, inM: radii2[0], outM: radii2[1] };
        leaves.leafSwapGroup = rec.group;
      }
    }
    const leavesBefore = leaves.leafCount;
    for (let k = 0; k < twigs; k++) {
      const attach = 0.55 + (k / twigs) * 0.45 + bt(-0.03, 0.03);
      const origin = sample(bough, Math.min(1, attach));
      const a = phase + k * 2.39996 + bt(-0.4, 0.4);
      const elevation = bt(-0.5, 0.75);
      const reach = hR * Math.sqrt(1 - elevation * elevation) * bt(0.45, 0.8);
      const target = center.clone().add(new Vector3(Math.cos(a) * reach, elevation * vR, Math.sin(a) * reach));
      const twig = growthPath(origin, target, tangent(bough, Math.min(1, attach)), rng, 5, 0.8);
      const twigRadius = Math.max(0.012, boughRadius * 0.35);
      const twigLength = Math.max(0.3, origin.distanceTo(target));
      tube(wood, twig, taper(twig, twigRadius, 0.004), 4, rng, { color: (pt) => barkDeep.clone().lerp(twigTip, smoothstep(0.35, 1, pt.distanceTo(origin) / twigLength) * 0.7), roughness: 0.02 });
      rec?.twigs.push({ path: twig, radius: twigRadius });
      const opts = leafOpts(twigRadius);
      for (let j = 0; j < count; j++) {
        const t = 0.25 + (0.75 * (j + bt(0.1, 0.9))) / count;
        const base = sample(twig, t);
        const axis = tangent(twig, t);
        const [u, v] = frame(axis);
        const angle = phase + j * 2.399963229728653 + bt(-0.3, 0.3);
        const outward = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
        const direction = axis.clone().multiplyScalar(bt(0.3, 0.7)).addScaledVector(outward, 1).addScaledVector(UP, bt(-0.25, 0.35)).normalize();
        const heightF = smoothstep(0, 1, (base.y - center.y) / Math.max(0.5, vR) * 0.5 + 0.5);
        const shell = smoothstep(0.3, 1, base.distanceTo(center) / Math.max(0.5, hR));
        const sun = Math.min(1, heightF * 0.6 + shell * 0.5) * bt(0.3, 1);
        const color = canopy.clone().lerp(sunny, sun).multiplyScalar(vigor * (0.7 + 0.3 * shell));
        addLeaf(leaves, base, direction, bt(p.leafSize[0], p.leafSize[1]), color, rng, opts);
      }
    }
    if (rec) {
      rec.farLeaves = leaves.leafCount - leavesBefore;
      leaves.leafSwapGroup = -1;
      nearLobes.push(rec);
    }
  };

  // leaders: the fork divides into a few rising stems that carry the highest lobes
  const forkTangent = tangent(trunk, 1);
  for (let i = 0; i < p.leaders; i++) {
    const angle = p.leanAzimuth + (i / p.leaders) * TAU + bt(-0.5, 0.5);
    const reach = crownRadius * bt(0.35, 0.7);
    const target = new Vector3(top.x + Math.cos(angle) * reach, H * bt(0.9, 1.0), top.z + Math.sin(angle) * reach);
    const path = divergingLeaderPath(top, target, rng, 12);
    const radius = forkRadius * bt(0.55, 0.75);
    // the leader's top runs up into its lobe: bark to the deep leaf tone over the last 15 % of H
    tube(wood, path, taper(path, radius, 0.03, 1.05), 8, rng, { color: (pt) => barkColor(pt).lerp(twigTip, smoothstep(H * 0.82, H * 0.97, pt.y) * 0.6), roughness: 0.04, barkTile: 1.4, structural: true, stiffness: stiff });
    const center = target.clone().add(new Vector3(bt(-0.3, 0.3), -H * bt(0.03, 0.06), bt(-0.3, 0.3)));
    lobe(path, radius, center, crownRadius * bt(0.32, 0.42), H * bt(0.07, 0.1), bt(0.9, 1.05));
  }
  // boughs: leave the bole between `boughStart` and just under the fork, reach out to the crown's rim
  let bareHeight = forkY;
  for (let j = 0; j < p.boughs; j++) {
    const t = p.boughStart + (j / Math.max(1, p.boughs - 1)) * (0.99 - p.boughStart) + bt(-0.02, 0.02);
    const origin = sample(trunk, Math.min(1, t));
    bareHeight = Math.min(bareHeight, origin.y);
    const angle = p.leanAzimuth + 1.1 + j * 2.13 + bt(-0.5, 0.5);
    const radial = crownRadius * bt(0.62, 0.9);
    const lobeY = origin.y + H * bt(0.06, 0.14);
    const center = new Vector3(Math.cos(angle) * radial, lobeY, Math.sin(angle) * radial);
    const end = center.clone().add(new Vector3(bt(-0.3, 0.3), bt(-0.4, 0.0), bt(-0.3, 0.3)));
    const bough = growthPath(origin, end, forkTangent.clone().lerp(new Vector3(Math.cos(angle), 0.35, Math.sin(angle)), 0.7), rng, 10, 0.6);
    const radius = Math.max(0.05, forkRadius * bt(0.4, 0.6));
    const boughLength = Math.max(0.5, origin.distanceTo(end));
    tube(wood, bough, taper(bough, radius, 0.02, 1.05), 6, rng, { color: (pt) => barkColor(pt).lerp(twigTip, smoothstep(0.6, 1, pt.distanceTo(origin) / boughLength) * 0.6), roughness: 0.04, structural: true, stiffness: stiff });
    lobe(bough, radius, center, crownRadius * bt(0.36, 0.48), H * bt(0.08, 0.12), bt(0.85, 1.0));
  }

  // ---------- near canopy (nearCanopy.ts; the high detail only, from streams forked off the tree's) ----------
  const nearCanopy: NearCanopyPart[] = [];
  if (near && detail === 'high' && nearLobes.length) {
    const nearLeafColor = (g: Rng, base: Vector3, center: Vector3, hR: number, vigor: number) => {
      const gb = (a: number, b: number) => between(g, a, b);
      const heightF = smoothstep(0, 1, ((base.y - center.y) / Math.max(0.5, hR * 0.45)) * 0.5 + 0.5);
      const shell = smoothstep(0.3, 1, base.distanceTo(center) / Math.max(0.5, hR));
      const sun = Math.min(1, heightF * 0.6 + shell * 0.5) * gb(0.3, 1);
      return canopy.clone().lerp(sunny, sun).multiplyScalar(vigor * (0.7 + 0.3 * shell));
    };
    const kit = createNearCanopyKit({ id: `column-${p.seed}`, barkColor: barkDeep, leafColor: nearLeafColor, canopy });
    nearLobes.forEach((rec, idx) => nearCanopy.push(kit.lobePart(rng, rec, idx)));
  }

  const geometry: BufferGeometry = mergeParts(`column-${p.seed}-${detail}`, [wood.finish('wood'), leaves.finish('leaves')]);
  let radius = 0;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) radius = Math.max(radius, Math.hypot(positions.getX(i), positions.getZ(i)));
  return {
    geometry,
    leafCount: leaves.leafCount,
    woodTriangles: wood.triangles,
    leafTriangles: leaves.triangles,
    height: geometry.boundingBox!.max.y,
    radius,
    trunkPath: trunk,
    trunkRadii,
    bareHeight,
    bark,
    nearBase,
    nearBaseBuild,
    nearBaseAudit,
    knees,
    nearCanopy,
    nearCanopyGroups: nearGroups,
    nearCanopyHeroKept: nearTally.kept,
    nearCanopyHeroLimited: nearTally.limited,
  };
}
