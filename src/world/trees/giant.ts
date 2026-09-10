/**
 * Giant old Kokiri trees — the massive trunks that frame the house and roof the clearing.
 * Built as unique geometry per layout entry in LOCAL space (origin = trunk centre at ground
 * level) so buttress roots can be conformed vertex-by-vertex to the real terrain through
 * `groundAt`. Trunk: gnarled cross-section (noise displacement + fluting), heavy basal flare and a
 * buried skirt; ≥ 5 buttress roots that grip the ground 3–6 m outward; ≥ 2 large near-horizontal
 * limbs (the `lantern-tree` limb follows the layout's from→to vector exactly so the structures
 * system can hang lanterns from it); a crown of diverging leaders carrying big leaf lobes at
 * 14–24 m. Botanical primitives derived from Verdant Forest by Leonxlnx.
 */
import { BufferGeometry, Color, Vector3 } from 'three';
import type { GiantTreeDef } from '../layout';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import {
  GeometryWriter,
  TAU,
  UP,
  addLeaf,
  between,
  divergingLeaderPath,
  frame,
  growthPath,
  mergeParts,
  sample,
  stiffnessFor,
  tangent,
  taper,
  tube,
} from './writer';
import type { Palette } from './whitebark';
import { CARD_UV0 } from './leaf-cluster-texture';

export interface GiantAsset {
  /** wood + leaves merged, local space (leaf vertices flagged in aRoot.w) */
  geometry: BufferGeometry;
  /** leaf-cluster alpha cards filling the lobe interiors (separate material) */
  cards: BufferGeometry;
  cardCount: number;
  leafCount: number;
  woodTriangles: number;
  leafTriangles: number;
  limbs: number;
  roots: number;
  /** local-space ground contact points (trunk origin + root tips), y exactly on the terrain */
  contacts: Vector3[];
  /** the authored limb centreline in local space (lantern tree only) */
  limbPath?: Vector3[];
  crownRadius: number;
}

/**
 * An authored near-horizontal limb leaving the trunk at `height` (local metres) toward a world
 * azimuth, rising `rise` metres per metre of run before sagging at the tip. Carries three leaf
 * lobes along its outer half (scaled by `foliage`; 0 = a bare limb).
 */
export interface SpreadLimb {
  /** world azimuth in degrees (0 = +x east, 90 = +z south) */
  azimuthDeg: number;
  height: number;
  length: number;
  rise: number;
  radius?: number;
  /** lobe size scale (0 = a bare limb) */
  foliage?: number;
  /** leaf + card population scale of the lobes (> 1 = dense dark masses) */
  density?: number;
  /** how far the lobes ride above the limb (1 = the wild-limb 1.2–1.8 m; 0 = wrapped around it) */
  lift?: number;
}

/**
 * Per-tree shape overrides for giants a hero camera sees from a few metres, where the generic
 * heavy flare / 4–7 m root spread / random limbs do not match the reference silhouette. Flare,
 * girth and root scaling draw no extra random numbers, so a profiled tree keeps the limbs and crown
 * (and therefore the canopy shadows) it had without the profile.
 */
export interface GiantProfile {
  /** basal flare multiplier (1 = the default heavy flare) */
  flare?: number;
  /** trunk girth multiplier below the fork (1 = the layout radius) */
  girth?: number;
  /** buttress root reach beyond the trunk (1 = 3–6 m) */
  rootReach?: number;
  /** buttress root thickness (1 = default) */
  rootGirth?: number;
  /** number of un-authored big limbs (default: 2–4 at random) */
  wildLimbs?: number;
  /** authored spreading limbs, built last from their own random stream */
  spread?: SpreadLimb[];
  /**
   * per-channel multiplier on the bark vertex colour (default 1,1,1). A trunk standing in
   * another giant's crown shadow only ever shows its ambient-lit bark (stock albedo ≈ 0.055
   * linear, a black cut-out); > 1 lifts it towards the hazy grey-brown column the reference shows.
   * `barkTintFade` [from, to] (local metres) blends the tint back to 1 with height, so wood that
   * does reach the sun keeps the stock bark.
   */
  barkTint?: [number, number, number];
  barkTintFade?: [number, number];
}

/**
 * An authored lobe hung on a canopy bough (local space): `t` is where its stem leaves the bough,
 * `center` the lobe centre, hR / vR its radii. `density` scales the leaf + card population,
 * `tone` multiplies the leaf colours (< 1 = a shaded mass), `eye` overrides the eye-detail
 * treatment (0 = roof: full-size cards spread through the lobe; 1 = leaf-sized laminae).
 */
export interface CanopyLobe {
  t: number;
  center: Vector3;
  hR: number;
  vR: number;
  density?: number;
  tone?: number;
  eye?: number;
}

/**
 * A heavy authored bough built LAST from its own random stream (so adding one never re-rolls the
 * trunk, limbs or crown): leaves the trunk at `fromHeight`, droops to `to`, and carries `lobes`
 * whose centres are authored absolutely — shade lobes riding above the wood, pendulous leaf
 * curtains hanging beneath it (the reference's low, dark foliage a few metres from the cameras).
 */
export interface CanopyBough {
  to: Vector3;
  fromHeight: number;
  radius: number;
  tipRadius?: number;
  lobes: CanopyLobe[];
}

export interface GiantOptions {
  /** local ground height under local (x, z); 0 at the origin */
  groundAt: (x: number, z: number) => number;
  /** authored limb (world from → to) for the lantern tree */
  limbSpec?: { from: Vector3; to: Vector3; radius?: number; tipRadius?: number };
  palette: Palette;
  /** leaf population multiplier (quality) */
  leafDensity?: number;
  /** cluster-card population multiplier (defaults to leafDensity) */
  cardDensity?: number;
  /** local horizontal unit vector toward the clearing: crowns grow into the light (phototropism) */
  towardPlaza?: Vector3;
  /**
   * Extra authored boughs (local space): each leaves the trunk at `fromHeight`, droops out to `to`
   * and carries leaf lobes along its length and at its tip (e.g. the boughs framing Saria's roof).
   * `foliage` scales the lobe size and leaf count (1 = the default roof-lobe treatment); `density`
   * scales the leaf and card population of every lobe on the bough (dense dark masses > 1).
   */
  boughs?: { to: Vector3; fromHeight: number; radius: number; tipRadius?: number; foliage?: number; density?: number }[];
  /** per-tree shape overrides (see GiantProfile) */
  profile?: GiantProfile;
  /**
   * Clear corridors (local space): infinite lines, along the sun direction (shafts, sunlit ground)
   * or along a hero camera's line of sight (canopy gaps). Foliage inside a corridor is not built
   * (laminae only with probability `porosity`, cluster cards only with probability `cardPorosity`,
   * default none), so the canopy shadow map carries a few bold holes instead of only fine-grained
   * gaps, or the view opens onto the haze. Wood is untouched — the branches inside keep casting
   * thin shadows; surviving laminae add a leaf fringe, surviving cards (0.5–1.2 m) are what casts
   * visible dapple from 25 m up, where laminae blur away in the soft shadow filter. `yMin` (local)
   * restricts a corridor to the part of the line at or above that height, so a sun line can thin a
   * crown 15–25 m up without touching the low hero boughs it also crosses.
   */
  corridors?: { point: Vector3; dir: Vector3; radius: number; porosity?: number; cardPorosity?: number; yMin?: number }[];
  /**
   * Foliage scale of the authored lantern limb's lobes (1 = full). The reference limb in shot A
   * is a bare bough with a few leaf clusters and haze between them, not a hedge on a pole.
   */
  limbFoliage?: number;
  /**
   * 0–1: how closely the hero cameras see this tree's LOW foliage (4–9 m). At 1 the low lobes get
   * leaf-sized 8-triangle laminae and no cluster cards; at 0 they use the cheap roof treatment.
   */
  eyeDetail?: number;
  /** authored canopy boughs (see CanopyBough), built after everything else */
  canopyBoughs?: CanopyBough[];
}

export function createGiantTree(def: GiantTreeDef, rng: Rng, o: GiantOptions): GiantAsset {
  const r = rng.fork(`giant/${def.id}`);
  const bt = (a: number, b: number) => between(r, a, b);
  const gnarl = new Noise2D(`giant-bark/${def.id}`);
  const wood = new GeometryWriter('high');
  const leaves = new GeometryWriter('high');
  const cards = new GeometryWriter('high');
  const R = def.trunkRadius;
  const H = def.height;
  const density = o.leafDensity ?? 1;
  const toPlaza = o.towardPlaza ?? new Vector3(1, 0, 0);
  const plazaBias = o.towardPlaza ? 1 : 0;
  const contacts: Vector3[] = [new Vector3(0, 0, 0)];
  const canopy = new Color(o.palette.leafCanopy);
  const sunny = new Color(o.palette.leafSun);
  const cool = new Color(0x3f7a4a);
  const warm = new Color(0x8fa83c);
  const barkBase = new Color(0.7, 0.64, 0.56);
  const barkDeep = new Color(0.3, 0.25, 0.2);
  const barkTint = new Color(...(o.profile?.barkTint ?? [1, 1, 1]));
  const tintFade = o.profile?.barkTintFade;
  const white = new Color(1, 1, 1);
  const crownRadius = H * bt(0.44, 0.5);

  const barkColor = (pt: Vector3) => {
    // soil-stained near the ground, lighter with height; ridges shaded by the tube grain
    const soil = 1 - smoothstep(-0.5, 2.5, pt.y);
    const tint = tintFade ? barkTint.clone().lerp(white, smoothstep(tintFade[0], tintFade[1], pt.y)) : barkTint;
    return barkBase
      .clone()
      .lerp(barkDeep, 0.4 * soil)
      .multiplyScalar(0.9 + 0.12 * smoothstep(2, 12, pt.y))
      .multiply(tint);
  };
  // large gnarl (metre-scale bulges + fluting) plus a mid-frequency term so the silhouette is never a pipe
  const gnarlBump = (scale: number, amount: number) => (angle: number, distance: number) => {
    const cx = Math.cos(angle) * 1.6;
    const cz = Math.sin(angle) * 1.6;
    const low = gnarl.fbm(cx * scale + distance * 0.11, cz * scale + distance * 0.09, 3);
    const mid = gnarl.noise(cx * scale * 3.1 + distance * 0.45, cz * scale * 3.1 - distance * 0.37);
    const flute = Math.sin(angle * 7 + distance * 0.12) * 0.35 + Math.sin(angle * 3 - distance * 0.07) * 0.2;
    return 1 + amount * (low * 0.9 + flute * 0.35 + mid * 0.3);
  };
  const stiff = () => 1;

  // ---------- trunk ----------
  const profile = o.profile ?? {};
  const flare = 0.85 * (profile.flare ?? 1);
  const girth = profile.girth ?? 1;
  const rootReach = profile.rootReach ?? 1;
  const rootGirth = profile.rootGirth ?? 1;
  const lean = Math.tan((bt(1, 3) * Math.PI) / 180);
  const leanAz = plazaBias ? Math.atan2(toPlaza.z, toPlaza.x) + bt(-0.7, 0.7) : r() * TAU;
  const fork = H * bt(0.5, 0.56);
  const top = new Vector3(Math.cos(leanAz) * lean * fork, fork, Math.sin(leanAz) * lean * fork);
  const skirt = 1.3;
  const trunk = growthPath(new Vector3(0, -skirt, 0), top, UP, r, 30, 0.18);
  const trunkRadii = trunk.map((pt, i) => {
    const t = i / (trunk.length - 1);
    const above = Math.max(0, pt.y) / H;
    // girth thins the lower bole only; the radius at the fork (which sizes the crown leaders) is kept
    const radius = R * (0.42 + 0.58 * girth * Math.pow(1 - t, 0.75));
    return radius * (1 + flare * Math.exp(-above * 7));
  });
  tube(wood, trunk, trunkRadii, 30, r, {
    color: barkColor,
    roughness: 0.06,
    bump: gnarlBump(1.0, 0.16),
    creviceShade: 2.2,
    barkTile: 1.6,
    flatBase: true,
    isTrunk: true,
    structural: true,
    stiffness: stiff,
  });

  // ---------- buttress roots ----------
  const rootCount = r.int(6, 9);
  for (let i = 0; i < rootCount; i++) {
    const angle = (i / rootCount) * TAU + bt(-0.22, 0.22);
    const dir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new Vector3(-dir.z, 0, dir.x);
    const length = R + bt(3, 6) * rootReach;
    const r0 = R * bt(0.36, 0.48) * rootGirth;
    const wigglePhase = r() * TAU;
    const wiggle = bt(0.15, 0.4);
    const segments = 11;
    const path: Vector3[] = [];
    const radii: number[] = [];
    // the root collar sits on the flare: lower when the flare is reduced
    const collar = R * (0.35 + 0.47 * flare);
    for (let k = 0; k <= segments; k++) {
      const t = k / segments;
      const radius = 0.14 + (r0 - 0.14) * Math.pow(1 - t, 0.9);
      const d = R * 0.55 * girth + (length - R * 0.55 * girth) * t;
      const p = dir.clone().multiplyScalar(d).addScaledVector(side, Math.sin(t * 4.2 + wigglePhase) * wiggle * t);
      const g = o.groundAt(p.x, p.z);
      // starts high on the flare, dives to the ground, then rides half-buried along the terrain
      const dive = smoothstep(0, 0.45, t);
      p.y = (1 - dive) * (collar * (1 - t * 0.8) + g) + dive * (g + radius * 0.4);
      if (k === segments) p.y = g - 0.25;
      path.push(p);
      radii.push(radius);
    }
    tube(wood, path, radii, 10, r, { color: barkColor, roughness: 0.08, bump: gnarlBump(1.4, 0.16), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    const tip = path[path.length - 1];
    contacts.push(new Vector3(tip.x, o.groundAt(tip.x, tip.z), tip.z));
    // small side roots
    const sub = r.int(1, 3);
    for (let s = 0; s < sub; s++) {
      const st = bt(0.3, 0.65);
      const origin = sample(path, st);
      const a2 = angle + (s % 2 === 0 ? 1 : -1) * bt(0.55, 1.0);
      const len = bt(1.4, 2.6) * rootReach;
      const sp: Vector3[] = [];
      const sr: number[] = [];
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = origin.clone().add(new Vector3(Math.cos(a2) * len * t, 0, Math.sin(a2) * len * t));
        const rad = 0.05 + 0.11 * (1 - t);
        const g = o.groundAt(p.x, p.z);
        p.y = k === 0 ? origin.y : g + rad * 0.35 * (1 - t) - 0.05 * t;
        if (k === n) p.y = g - 0.15;
        sp.push(p);
        sr.push(rad);
      }
      tube(wood, sp, sr, 6, r, { color: barkColor, roughness: 0.1, structural: true, stiffness: stiff });
      const tip2 = sp[sp.length - 1];
      contacts.push(new Vector3(tip2.x, o.groundAt(tip2.x, tip2.z), tip2.z));
    }
  }

  // ---------- leaves ----------
  // Foliage near eye level (the lantern limb, low boughs at 4–9 m) is seen from 3–8 m: it needs
  // real leaf-sized laminae (~10 cm, beech/oak obovate outline, 8 triangles). The roof at 14–24 m
  // is 15+ m away and uses bigger stylised laminae plus cluster cards.
  const eyeDetail = o.eyeDetail ?? 0;
  // per-lobe overrides for the authored canopy boughs (null / 1 = the tree's own treatment)
  let eyeOverride: number | null = null;
  let lobeTone = 1;
  const nearEye = (y: number) => (eyeOverride ?? (1 - smoothstep(7, 12, y)) * eyeDetail);
  const leafOpts = (radius: number, y: number) => ({
    widthRatio: 0.6,
    wideFirst: 0.7,
    wideSecond: 0.82,
    stiffness: stiffnessFor(radius),
    flutter: 0.03,
    detailOverride: (nearEye(y) > 0.75 ? 'high' : 'medium') as 'high' | 'medium',
    tipColor: new Color('#8a9a4c'),
  });
  const corridors = o.corridors ?? [];
  const corrTmp = new Vector3();
  // corridor survival is a hash of the caster's position rather than a stream: adding or moving one
  // corridor then never re-rolls the survivors of another (a shared stream shifted every later
  // draw, re-dappling the plaza whenever a corridor elsewhere changed), and culled laminae/cards
  // still make their own draws from the main stream, so the rest of the tree (limbs, crown built
  // after the foliage a corridor touches) is the same whatever the corridors
  const survives = (p: Vector3, porosity: number) => {
    if (porosity <= 0) return false;
    const h = Math.sin(p.x * 12.9898 + p.y * 78.233 + p.z * 37.719) * 43758.5453;
    return h - Math.floor(h) < porosity;
  };
  /**
   * the tightest corridor within `extent` of p (smallest porosity wins), or null — `extent` is the
   * half-size of the caster, so a cluster card centred just outside a corridor cannot lean into it
   */
  const inCorridor = (p: Vector3, extent = 0) => {
    let hit: (typeof corridors)[number] | null = null;
    for (const c of corridors) {
      if (c.yMin !== undefined && p.y < c.yMin) continue;
      corrTmp.subVectors(p, c.point);
      const along = corrTmp.dot(c.dir);
      corrTmp.addScaledVector(c.dir, -along);
      const reach = c.radius + extent;
      if (corrTmp.lengthSq() < reach * reach && (!hit || (c.porosity ?? 0) < (hit.porosity ?? 0))) hit = c;
    }
    return hit;
  };
  /** false when a lamina at p must be dropped for a corridor */
  const leafAllowed = (p: Vector3) => {
    if (!corridors.length) return true;
    const c = inCorridor(p);
    return !c || survives(p, c.porosity ?? 0);
  };
  /** false when a cluster card of half-size `s` at p must be dropped for a corridor */
  const cardAllowed = (p: Vector3, s: number) => {
    if (!corridors.length) return true;
    const c = inCorridor(p, s * 0.7);
    return !c || survives(p, c.cardPorosity ?? 0);
  };
  let lobe: { center: Vector3; hR: number } | null = null;
  function leafSpray(path: Vector3[], pathRadius: number, count: number, vigor = 1, startT = 0.15) {
    const midY = sample(path, 0.6).y;
    // low foliage seen up close is carried by many small laminae (cards only fill the core there)
    count = Math.max(1, Math.round(count * density * (1 + 4.0 * nearEye(midY))));
    const phase = r() * TAU;
    const opts = leafOpts(pathRadius, midY);
    for (let j = 0; j < count; j++) {
      const t = startT + ((1 - startT) * (j + bt(0.15, 0.85))) / count;
      const base = sample(path, t);
      // a culled lamina still makes every draw below (addLeaf included), so the main stream — and
      // with it every branch, lobe and leaf built after this one — is the same whatever the corridors
      const allowed = leafAllowed(base);
      const axis = tangent(path, t);
      const [u, v] = frame(axis);
      const angle = phase + j * 2.399963229728653 + bt(-0.3, 0.3);
      const outward = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
      const direction = axis.clone().multiplyScalar(bt(0.25, 0.6)).addScaledVector(outward, 1).addScaledVector(UP, bt(-0.35, 0.3)).normalize();
      const heightF = base.y / H;
      const outF = Math.hypot(base.x, base.z) / crownRadius;
      const sun = Math.min(1, Math.max(0, (heightF - 0.55) * 2.0 + outF * 0.3)) * bt(0.3, 1);
      // leaves deep inside a lobe are self-shadowed: darker and cooler
      const interior = lobe ? smoothstep(0.85, 0.3, base.distanceTo(lobe.center) / Math.max(0.5, lobe.hR)) : 0;
      const color = canopy
        .clone()
        .multiplyScalar(0.92)
        .lerp(sunny, sun * (1 - interior * 0.7))
        .lerp(bt(0, 1) < 0.5 ? cool : warm, bt(0, 0.3))
        .multiplyScalar(vigor * (1 - interior * 0.32) * lobeTone);
      // leaves near eye level (low limbs) stay believable; the high roof uses big stylised laminae
      const roofSize = 0.17 + 0.22 * smoothstep(4, 15, base.y);
      const eyeSize = 0.13 + 0.24 * smoothstep(6, 16, base.y);
      const size = bt(0.72, 1.0) * (roofSize + (eyeSize - roofSize) * (eyeOverride ?? eyeDetail));
      addLeaf(leaves, base, direction, size, color, r, opts, allowed);
    }
  }

  /**
   * Leaf-cluster cards filling a lobe: quads biased to the lobe shell, each carrying the cluster
   * alpha texture, with normals pointing out of the lobe (so the canopy shades as one volume
   * instead of a patchwork of flat quads). Cards ride the branch wind layer of their bough.
   */
  const cardN = new Vector3();
  const cardU = new Vector3();
  const cardW = new Vector3();
  function clusterCards(center: Vector3, hR: number, vR: number, boughRadius: number, count: number) {
    // near eye level a card seen obliquely reads as one flat cut-out, so low lobes seen up close
    // keep only half-size cards deep in the lobe core (dark filler behind the laminae)
    const eye = nearEye(center.y);
    const sizeF = 1 - 0.5 * eye;
    count = Math.max(2, Math.round(count * 1.5 * Math.min(1.4, o.cardDensity ?? density)));
    const stiffness = stiffnessFor(boughRadius * 0.5);
    const phase = r();
    for (let i = 0; i < count; i++) {
      const rr = Math.pow(r(), 0.4) * (1 - 0.45 * eye);
      const th = r() * TAU;
      const ph = Math.acos(2 * r() - 1);
      const local = new Vector3(Math.sin(ph) * Math.cos(th) * hR * rr, Math.cos(ph) * vR * rr, Math.sin(ph) * Math.sin(th) * hR * rr);
      const p = center.clone().add(local);
      cardN.set(local.x / hR, local.y / vR + 0.7, local.z / hR).normalize();
      cardN.x += bt(-0.35, 0.35);
      cardN.z += bt(-0.35, 0.35);
      cardN.normalize();
      const ref = Math.abs(cardN.y) < 0.9 ? UP : new Vector3(1, 0, 0);
      cardU.crossVectors(cardN, ref).normalize();
      cardW.crossVectors(cardN, cardU).normalize();
      // spin the card in its plane
      const spin = r() * TAU;
      const su = cardU.clone().multiplyScalar(Math.cos(spin)).addScaledVector(cardW, Math.sin(spin));
      const sw = cardW.clone().multiplyScalar(Math.cos(spin)).addScaledVector(cardU, -Math.sin(spin));
      const s = Math.min(1.25, Math.max(0.36, bt(0.22, 0.34) * hR)) * sizeF;
      const heightF = p.y / H;
      const outF = Math.hypot(p.x, p.z) / crownRadius;
      const sun = Math.min(1, Math.max(0, (heightF - 0.55) * 2.0 + outF * 0.3)) * bt(0.35, 1);
      const interior = 1 - rr;
      const color = canopy
        .clone()
        .multiplyScalar(0.9)
        .lerp(sunny, sun * (1 - interior * 0.7))
        .lerp(bt(0, 1) < 0.5 ? cool : warm, bt(0, 0.25))
        .multiplyScalar(bt(0.85, 1.05) * (1 - interior * 0.4) * lobeTone);
      // culled after its draws (see leafSpray): the corridors never shift the main stream
      if (!cardAllowed(p, s)) continue;
      const V = (du: number, dw: number, u: number, v: number) =>
        cards.vertexN(
          p.clone().addScaledVector(su, du * s).addScaledVector(sw, dw * s),
          cardN,
          color,
          CARD_UV0 + (1 - CARD_UV0) * u,
          CARD_UV0 + (1 - CARD_UV0) * v,
          stiffness,
          phase,
          0.012 * (0.5 + v),
          1,
        );
      const a = V(-1, -1, 0, 0);
      const b = V(1, -1, 1, 0);
      const c = V(1, 1, 1, 1);
      const d = V(-1, 1, 0, 1);
      cards.triangle(a, b, c);
      cards.triangle(a, c, d);
    }
  }

  function foliateLobe(bough: Vector3[], center: Vector3, hR: number, vR: number, boughRadius: number, subCount = 3, twigCount = 4, sprigCount = 4, mult = 0.55, cardMult = 1) {
    lobe = { center, hR };
    clusterCards(center, hR, vR, boughRadius, (7 + subCount * 3) * cardMult);
    leafSpray(bough, boughRadius * 0.4, 6 * mult, 0.94, 0.8);
    const phase = r() * TAU;
    for (let j = 0; j < subCount; j++) {
      const attachment = 0.4 + (j / subCount) * 0.48 + bt(-0.035, 0.035);
      const origin = sample(bough, attachment);
      const a = phase + j * 2.39996 + bt(-0.45, 0.45);
      const elevation = bt(-0.55, 0.8);
      const reach = hR * Math.sqrt(1 - elevation * elevation) * bt(0.58, 0.95);
      const target = center.clone().add(new Vector3(Math.cos(a) * reach, elevation * vR, Math.sin(a) * reach));
      const secondary = growthPath(origin, target, tangent(bough, attachment), r, 6, 0.85);
      const secondaryRadius = Math.max(0.03, boughRadius * Math.pow(1 - attachment, 0.9) * 0.5);
      tube(wood, secondary, taper(secondary, secondaryRadius, 0.008), 5, r, { color: barkColor, roughness: 0.04 });
      leafSpray(secondary, secondaryRadius * 0.5, 6 * mult, bt(0.88, 1.03), 0.7);
      for (let k = 0; k < twigCount; k++) {
        const twigT = 0.18 + (k / twigCount) * 0.72 + bt(-0.025, 0.025);
        const twigOrigin = sample(secondary, twigT);
        const twigAngle = a - 1.08 + (k / Math.max(1, twigCount - 1)) * 2.16 + bt(-0.23, 0.23);
        const twigElevation = bt(-0.75, 0.82);
        const twigReach = hR * (k === 2 ? bt(0.16, 0.36) : bt(0.57, 1.04));
        const twigTarget = center.clone().add(new Vector3(Math.cos(twigAngle) * twigReach, twigElevation * vR, Math.sin(twigAngle) * twigReach));
        twigTarget.y -= bt(0.1, 0.6);
        const twig = growthPath(twigOrigin, twigTarget, tangent(secondary, twigT), r, 4, 0.64);
        const twigRadius = Math.max(0.012, secondaryRadius * (1 - twigT) * 0.4);
        tube(wood, twig, taper(twig, twigRadius, 0.004), 3, r, { color: barkColor, roughness: 0.02 });
        leafSpray(twig, twigRadius * 0.6, 8 * mult, bt(0.9, 1.04), 0.45);
        const sprigPhase = r() * TAU;
        for (let s = 0; s < sprigCount; s++) {
          const sprigT = 0.3 + s * (0.68 / sprigCount);
          const start = sample(twig, sprigT);
          const axis = tangent(twig, sprigT);
          const [u, v] = frame(axis);
          const angle = sprigPhase + s * 2.39996 + bt(-0.25, 0.25);
          const direction = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle)).addScaledVector(axis, 0.36).addScaledVector(UP, -0.12).normalize();
          // short sprigs carry dense leaf clusters; the sub-centimetre sprig wood itself is sub-pixel
          // from the ground and is not built
          const end = start.clone().addScaledVector(direction, bt(0.45, 0.85));
          leafSpray([start, end], 0.006, 14 * mult, bt(0.9, 1.04), 0.05);
        }
      }
    }
    lobe = null;
  }

  // ---------- big near-horizontal limbs ----------
  let limbs = 0;
  let limbPath: Vector3[] | undefined;
  const limbLobes = (path: Vector3[], baseRadius: number, positions: number[], hR: number, vR: number, upOffset: number, mult = 0.4, cardMult = 1) => {
    for (const s of positions) {
      const origin = sample(path, s);
      const ax = tangent(path, s);
      const [u] = frame(ax);
      const center = origin.clone().addScaledVector(UP, upOffset).addScaledVector(u, bt(-1.2, 1.2)).addScaledVector(ax, bt(0.5, 1.8));
      const bough = growthPath(origin, center, ax.clone().lerp(UP, 0.5), r, 7, 0.7);
      const radius = Math.max(0.06, baseRadius * (1 - s) * 0.42);
      tube(wood, bough, taper(bough, radius, 0.02), 6, r, { color: barkColor, roughness: 0.04 });
      foliateLobe(bough, center, hR, vR, radius, 2, 3, 4, mult, cardMult);
    }
  };

  if (o.limbSpec) {
    // authored lantern limb: leaves the trunk axis at `from` height, runs exactly along from→to
    const from = o.limbSpec.from;
    const to = o.limbSpec.to;
    const dir = to.clone().sub(from);
    const len = dir.length();
    dir.normalize();
    const side = new Vector3(-dir.z, 0, dir.x).normalize();
    const r0 = o.limbSpec.radius ?? 0.7;
    const r1 = o.limbSpec.tipRadius ?? 0.25;
    const path: Vector3[] = [new Vector3(0, from.y, 0)];
    const radii: number[] = [r0 * 1.3];
    const n = 16;
    const wigglePhase = r() * TAU;
    // trunk → `from`: the authored waypoint may sit well out along the limb (it marks where the
    // visible, lantern-bearing part begins), so this first reach gets the same organic wiggle
    // and a gentle sag instead of being one straight rod
    const reach = from.clone();
    reach.y = 0;
    const reachLen = reach.length();
    if (reachLen > 1.2) {
      const rn = Math.max(2, Math.ceil(reachLen / 0.9));
      const rside = new Vector3(-reach.z, 0, reach.x).normalize();
      for (let k = 1; k < rn; k++) {
        const s = k / rn;
        const p = new Vector3(from.x * s, from.y, from.z * s);
        p.addScaledVector(rside, Math.sin(s * 7 + wigglePhase * 0.7) * 0.14 * Math.sin(s * Math.PI));
        p.y += (0.25 * Math.sin(s * Math.PI) - 0.12 * Math.sin(s * 11 + wigglePhase) * Math.sin(s * Math.PI)) * Math.min(1, reachLen / 6);
        path.push(p);
        radii.push(r0 * 1.3 + (r0 - r0 * 1.3) * Math.pow(s, 0.7));
      }
    }
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const p = from.clone().addScaledVector(dir, len * s);
      p.addScaledVector(side, Math.sin(s * 9 + wigglePhase) * 0.12 * Math.sin(s * Math.PI));
      p.y -= 0.16 * Math.sin(s * Math.PI) + 0.05 * Math.sin(s * 13 + wigglePhase) * Math.sin(s * Math.PI);
      path.push(p);
      radii.push(r0 + (r1 - r0) * Math.pow(s, 0.85));
    }
    // short continuation beyond `to`: thinner, barely lifting, so the tip and its cluster stay at
    // the bough's own height (the reference bough ends in a small leaf cluster just past the last
    // pod, not in a crown that climbs into the upper-left of shot A)
    const tail = 3;
    for (let k = 1; k <= tail; k++) {
      const s = k / tail;
      const p = to.clone().addScaledVector(dir, 1.8 * s).addScaledVector(UP, 0.25 * s * s).addScaledVector(side, 0.4 * s);
      path.push(p);
      radii.push(r1 * (1 - 0.72 * s));
    }
    tube(wood, path, radii, 14, r, { color: barkColor, roughness: 0.05, bump: gnarlBump(1.8, 0.1), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    limbPath = path;
    limbs++;
    // foliage rides on top of the limb (lanterns hang below it) as separate small clusters —
    // the bough itself stays readable between them, with haze showing through. The outer cluster
    // sits at 0.6 (world x ≈ −1.4): from camera A that is the top-left corner, where the
    // reference has near foliage, not the upper-left band, where it has only veiled far trees. It
    // is a wide, loose lobe: from F it is the near roof at the centre-right of the frame and keeps
    // the canopy there closed now that the old tip clusters are gone.
    const lf = o.limbFoliage ?? 1;
    limbLobes(path, r0, [0.32, 0.6], 1.4 + 0.9 * lf, 0.7 + 0.45 * lf, 1.0 + 0.4 * lf, 0.4 * lf, lf);
    // small end cluster riding just above the tip
    const endCenter = path[path.length - 1].clone().addScaledVector(UP, 0.2 + 0.3 * lf).addScaledVector(dir, 0.6);
    const endBough = growthPath(path[path.length - 2], endCenter, dir, r, 5, 0.5);
    tube(wood, endBough, taper(endBough, 0.09, 0.02), 5, r, { color: barkColor, roughness: 0.03 });
    foliateLobe(endBough, endCenter, 0.8 + 0.7 * lf, 0.45 + 0.35 * lf, 0.09, lf < 0.7 ? 2 : 3, 3, lf < 0.7 ? 3 : 4, 0.35 * lf, lf);
  }

  // ---------- authored boughs (e.g. the pair reaching over Saria's roof) ----------
  for (const spec of o.boughs ?? []) {
    const tTrunk = Math.min(0.98, Math.max(0.05, (spec.fromHeight + skirt) / (fork + skirt)));
    const origin = sample(trunk, tTrunk);
    origin.y = spec.fromHeight;
    const to = spec.to;
    const dir = to.clone().sub(origin);
    const len = dir.length();
    const horiz = new Vector3(dir.x, 0, dir.z).normalize();
    const side = new Vector3(-horiz.z, 0, horiz.x);
    const r0 = spec.radius;
    const r1 = spec.tipRadius ?? r0 * 0.35;
    const path: Vector3[] = [origin.clone()];
    const radii: number[] = [r0 * 1.35];
    const n = 14;
    const wigglePhase = r() * TAU;
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      // leaves the trunk almost level, arches a little, then droops onto the target
      const p = origin.clone().addScaledVector(horiz, Math.hypot(dir.x, dir.z) * s);
      p.y = origin.y + (to.y - origin.y) * s * s + 0.35 * len * 0.06 * Math.sin(s * Math.PI);
      p.addScaledVector(side, Math.sin(s * 7 + wigglePhase) * 0.09 * len * 0.12 * Math.sin(s * Math.PI));
      path.push(p);
      radii.push(r0 + (r1 - r0) * Math.pow(s, 0.85));
    }
    const tail = 3;
    for (let k = 1; k <= tail; k++) {
      const s = k / tail;
      const p = to.clone().addScaledVector(horiz, 2.4 * s).addScaledVector(UP, 1.1 * s * s).addScaledVector(side, 0.4 * s);
      path.push(p);
      radii.push(r1 * (1 - 0.7 * s));
    }
    tube(wood, path, radii, 12, r, { color: barkColor, roughness: 0.06, bump: gnarlBump(1.7, 0.11), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    limbs++;
    // `foliage` thins only the outer third + tip (the part that reaches into the hero frames); the
    // lobes near the trunk keep their full roof density
    const bf = spec.foliage ?? 1;
    const bd = spec.density ?? 1;
    limbLobes(path, r0, [0.42, 0.64], 2.7, 1.3, 1.7, 0.62 * bd, bd);
    limbLobes(path, r0, [0.84], 2.7 * bf, 1.3 * bf, 1.1 + 0.6 * bf, 0.62 * bf * bd, bf * bd);
    const endCenter = path[path.length - 1].clone().addScaledVector(UP, 1.1 * bf).addScaledVector(horiz, 0.9);
    const endBough = growthPath(path[path.length - 2], endCenter, horiz, r, 5, 0.5);
    tube(wood, endBough, taper(endBough, r1 * 0.6, 0.02), 5, r, { color: barkColor, roughness: 0.03 });
    foliateLobe(endBough, endCenter, 2.9 * bf, 1.4 * bf, r1 * 0.6, bf < 0.7 ? 2 : 3, 3, bf < 0.7 ? 3 : 4, 0.62 * bf * bd, bf * bd);
  }

  const extraLimbs = profile.wildLimbs ?? (o.limbSpec ? 2 : r.int(2, 4));
  const limbBaseAngle = o.limbSpec ? Math.atan2(o.limbSpec.to.z - o.limbSpec.from.z, o.limbSpec.to.x - o.limbSpec.from.x) : r() * TAU;
  for (let i = 0; i < extraLimbs; i++) {
    const a = limbBaseAngle + ((i + 1) / (extraLimbs + 1)) * TAU + bt(-0.35, 0.35);
    const t = bt(0.36, 0.62);
    const origin = sample(trunk, t);
    const trunkR = trunkRadii[Math.round(t * (trunkRadii.length - 1))];
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new Vector3(-dir.z, 0, dir.x);
    const elev = bt(0.12, 0.3);
    const length = bt(7, 11) * (R / 1.5);
    const sag = bt(0.6, 1.6);
    const path: Vector3[] = [];
    const n = 11;
    const wigglePhase = r() * TAU;
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      const p = origin
        .clone()
        .addScaledVector(dir, length * s)
        .addScaledVector(UP, length * elev * s - sag * s * s)
        .addScaledVector(side, Math.sin(s * 6 + wigglePhase) * 0.08 * length * s);
      path.push(p);
    }
    const r0 = Math.max(0.55, trunkR * bt(0.3, 0.42));
    tube(wood, path, taper(path, r0, 0.1, 0.9), 12, r, { color: barkColor, roughness: 0.06, bump: gnarlBump(1.6, 0.12), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    limbs++;
    limbLobes(path, r0, [0.5, 0.78, 1.0], crownRadius * bt(0.2, 0.26), H * 0.07, bt(1.5, 2.5));
  }

  // ---------- crown ----------
  const leaders = r.int(4, 6);
  const weights = Array.from({ length: leaders }, () => bt(0.65, 1.2));
  const total = weights.reduce((s, w) => s + w, 0);
  const topRadius = trunkRadii[trunkRadii.length - 1];
  for (let i = 0; i < leaders; i++) {
    const origin = sample(trunk, i === 0 ? 1 : bt(0.93, 0.995));
    const angle = leanAz + (i / leaders) * TAU + bt(-0.35, 0.35);
    const radial = crownRadius * bt(0.35, 0.58);
    const target = new Vector3(Math.cos(angle) * radial, H * bt(0.76, 0.92), Math.sin(angle) * radial);
    // phototropism: the whole crown shifts toward the clearing
    target.addScaledVector(toPlaza, plazaBias * crownRadius * bt(0.12, 0.28));
    const path = divergingLeaderPath(origin, target, r, 14);
    const radius = topRadius * Math.sqrt(weights[i] / total) * 1.15;
    tube(wood, path, taper(path, radius, 0.06, 0.88), 10, r, { color: barkColor, roughness: 0.05, bump: gnarlBump(2, 0.08), creviceShade: 1.5, barkTile: 1.2, structural: true });
    const boughs = r.int(3, 5);
    for (let j = 0; j < boughs; j++) {
      const t = 0.3 + (j / Math.max(1, boughs - 1)) * 0.62 + bt(-0.03, 0.03);
      const bOrigin = sample(path, t);
      const inward = j >= 2 && j % 2 === 0;
      const ba = angle + (j === 0 ? -0.9 : j === 1 ? 0.85 : j === 2 ? 1.6 : j === 3 ? -0.1 : -1.6) + bt(-0.3, 0.3);
      const bRadial = crownRadius * (inward ? bt(0.15, 0.35) : bt(0.6, 0.95));
      // lobes span 0.58–0.92 H (≈ 14–24 m) so the crown roofs the clearing rather than floating above it
      const lobeY = H * (j === 0 ? bt(0.58, 0.68) : j === 1 ? bt(0.66, 0.76) : inward ? bt(0.82, 0.92) : bt(0.72, 0.84));
      const center = new Vector3(Math.cos(ba) * bRadial, lobeY, Math.sin(ba) * bRadial);
      center.addScaledVector(toPlaza, plazaBias * crownRadius * bt(0.15, 0.35));
      const end = center.clone().add(new Vector3(bt(-0.5, 0.5), bt(-0.6, 0.1), bt(-0.5, 0.5)));
      const bough = growthPath(bOrigin, end, tangent(path, t), r, 10, 0.7);
      const bRadius = Math.max(0.09, radius * Math.pow(1 - t, 0.7) * bt(0.5, 0.7));
      tube(wood, bough, taper(bough, bRadius, 0.03, 1.0), 6, r, { color: barkColor, roughness: 0.04 });
      const hR = crownRadius * bt(0.27, 0.36);
      const vR = H * bt(0.08, 0.11);
      foliateLobe(bough, center, hR, vR, bRadius);
    }
  }

  // ---------- authored spreading limbs ----------
  // Built after everything else from their own stream, so adding or editing one never re-rolls the
  // trunk, roots, wild limbs or crown above (the crown's shadows are tuned per hero frame).
  const rs = r.fork('spread');
  for (const spec of profile.spread ?? []) {
    const az = (spec.azimuthDeg * Math.PI) / 180;
    const dir = new Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new Vector3(-dir.z, 0, dir.x);
    const tTrunk = Math.min(0.98, Math.max(0.05, (spec.height + skirt) / (fork + skirt)));
    const origin = sample(trunk, tTrunk);
    origin.y = spec.height;
    const trunkR = trunkRadii[Math.round(tTrunk * (trunkRadii.length - 1))];
    const r0 = spec.radius ?? Math.max(0.5, trunkR * 0.42);
    const length = spec.length;
    const sag = length * length * 0.007;
    const n = 12;
    const wigglePhase = rs() * TAU;
    const path: Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      const s = k / n;
      // leaves the bole from inside its radius so the collar reads as a fork, not a peg
      const run = -trunkR * 0.5 + (length + trunkR * 0.5) * s;
      const p = origin
        .clone()
        .addScaledVector(dir, run)
        .addScaledVector(UP, length * spec.rise * s - sag * s * s)
        .addScaledVector(side, Math.sin(s * 5.5 + wigglePhase) * 0.07 * length * s);
      path.push(p);
    }
    tube(wood, path, taper(path, r0, 0.08, 0.85), 12, rs, { color: barkColor, roughness: 0.06, bump: gnarlBump(1.6, 0.12), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    limbs++;
    const lf = spec.foliage ?? 1;
    const ld = spec.density ?? 1;
    const lift = spec.lift ?? 1;
    if (lf > 0) {
      const hR = (1.9 + 0.6 * lf) * Math.min(1.15, length / 8);
      limbLobes(path, r0, [0.48, 0.74, 0.98], hR, hR * 0.52, (1.2 + 0.6 * lf) * lift, 0.4 * lf * ld, lf * ld);
    }
  }

  // ---------- authored canopy boughs ----------
  // Built after everything else from their own stream (the lobe foliage draws from the main stream,
  // but nothing is generated after it), so the tree above is identical with or without them.
  const rcb = r.fork('canopy-bough');
  for (const spec of o.canopyBoughs ?? []) {
    const tTrunk = Math.min(0.98, Math.max(0.05, (spec.fromHeight + skirt) / (fork + skirt)));
    const origin = sample(trunk, tTrunk);
    origin.y = spec.fromHeight;
    const to = spec.to;
    const run = Math.hypot(to.x - origin.x, to.z - origin.z);
    const horiz = new Vector3(to.x - origin.x, 0, to.z - origin.z).normalize();
    const side = new Vector3(-horiz.z, 0, horiz.x);
    const r0 = spec.radius;
    const r1 = spec.tipRadius ?? r0 * 0.35;
    const path: Vector3[] = [origin.clone()];
    const radii: number[] = [r0 * 1.35];
    const n = 16;
    const wigglePhase = rcb() * TAU;
    for (let k = 1; k <= n; k++) {
      const s = k / n;
      // a weight-bearing limb: level off the trunk, then an ever-steeper droop onto the target
      const p = origin.clone().addScaledVector(horiz, run * s);
      p.y = origin.y + (to.y - origin.y) * Math.pow(s, 1.7) + 0.02 * run * Math.sin(s * Math.PI);
      p.addScaledVector(side, Math.sin(s * 6 + wigglePhase) * 0.012 * run * Math.sin(s * Math.PI));
      path.push(p);
      radii.push(r0 + (r1 - r0) * Math.pow(s, 0.85));
    }
    tube(wood, path, radii, 12, rcb, { color: barkColor, roughness: 0.06, bump: gnarlBump(1.7, 0.11), creviceShade: 1.8, barkTile: 1.2, structural: true, stiffness: stiff });
    limbs++;
    for (const lobeSpec of spec.lobes) {
      const at = sample(path, lobeSpec.t);
      const ax = tangent(path, lobeSpec.t);
      const toCenter = lobeSpec.center.clone().sub(at);
      const hanging = toCenter.y < -0.5;
      // shade lobes leave the bough upward like the wild-limb lobes; curtains leave it along the
      // wood and then swing down under their own weight
      const parentDir = hanging ? ax.clone().lerp(UP.clone().negate(), 0.35).normalize() : ax.clone().lerp(UP, 0.5);
      const stem = growthPath(at, lobeSpec.center, parentDir, rcb, 7, 0.6);
      const stemRadius = Math.max(0.07, r0 * (1 - lobeSpec.t * 0.6) * 0.34);
      tube(wood, stem, taper(stem, stemRadius, 0.02), 6, rcb, { color: barkColor, roughness: 0.04 });
      const d = lobeSpec.density ?? 1;
      eyeOverride = lobeSpec.eye ?? null;
      lobeTone = lobeSpec.tone ?? 1;
      // a curtain's arms leave the last ~30 % of its long drop (foliateLobe attaches them at
      // 0.4–0.88 of the path it is given: here 0.83–0.97 of the stem, within 0.7 m of the centre),
      // so the leaves gather around the authored centre instead of trailing up towards the bough
      const lobePath = hanging ? stem.slice(stem.length - 3) : stem;
      foliateLobe(lobePath, lobeSpec.center, lobeSpec.hR, lobeSpec.vR, stemRadius, 3, 4, 4, 0.55 * d, d);
      eyeOverride = null;
      lobeTone = 1;
    }
  }

  return {
    geometry: mergeParts(`giant-${def.id}`, [wood.finish('wood'), leaves.finish('leaves')]),
    cards: cards.finish(`giant-cards-${def.id}`),
    cardCount: cards.triangles / 2,
    leafCount: leaves.leafCount,
    woodTriangles: wood.triangles,
    leafTriangles: leaves.triangles,
    limbs,
    roots: rootCount,
    contacts,
    limbPath,
    crownRadius,
  };
}
