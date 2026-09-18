/**
 * Distant trees for the 60–220 m band: hundreds of cheap trees that form layered silhouettes in
 * the haze beyond the detail radius. Two LOD levels, both real geometry:
 *   near/mid — low-poly bent trunk + limbs and a crown of leaf-card clusters over dark lobe cores;
 *   far      — impostor-like geometry: three fixed vertical silhouette fans + crossed trunk quads
 *              (not camera-facing, no photographs). Fog does the atmospheric tinting.
 * Placement is seeded, clumped by noise, spaced by a hash grid, and seated on the terrain.
 */
import { BufferGeometry, Color, IcosahedronGeometry, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import type { Terrain } from '../terrain/heightfield';
import { GeometryWriter, TAU, UP, growthPath, rootButtress, taper, tube, type RandomFn } from './writer';
import { consumeTubeDraws } from './bole';
import type { Palette } from './whitebark';
import { CARD_UV0, SOLID_UV } from './leaf-cluster-texture';

export type DistantKind = 'broad' | 'slender';

export interface DistantVariant {
  kind: DistantKind;
  near: BufferGeometry;
  far: BufferGeometry;
  height: number;
  nearTriangles: number;
  farTriangles: number;
  /** authored depth bands only — never drawn from the radial 60–215 m pool */
  bandOnly: boolean;
}

export interface DistantPlacement {
  variant: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  tint: Color;
}

const ICO0 = new IcosahedronGeometry(1, 0);
/** round 45: the near LOD bole's basal flare — extra radius share at the path's foot … */
export const DISTANT_FLARE = 0.4;
/** … falling off with this e-folding distance (m) along the bole */
export const DISTANT_FLARE_FALL = 1.6;
/** round 45 (item 4): a near-LOD limb's length as a share of the crown radius (0.6–1.0 through round 44: past the lobe shells) */
export const LIMB_REACH: [number, number] = [0.45, 0.75];
/**
 * how far a limb is tinted from the bark toward the crown's dark (0 = bark throughout), over
 * LIMB_TINT_FROM..LIMB_TINT_TO of its length (bark at the bole, the crown's own dark from
 * halfway: from under the crown the limbs show against the sky over their whole length,
 * w19-spine-u — the first take at 0.35–1.0 left the inner half a pale plank)
 */
export const LIMB_TIP_TINT = 0.8;
export const LIMB_TINT_FROM = 0.08;
export const LIMB_TINT_TO = 0.5;

/** dark shadow core of a crown lobe (a small noise-displaced polyhedron) */
function lumpyBlob(writer: GeometryWriter, center: Vector3, radius: number, squash: number, color: Color, top: Color, noise: Noise2D, seed: number) {
  const src = ICO0.getAttribute('position');
  const v = new Vector3();
  const idx: number[] = [];
  for (let i = 0; i < src.count; i++) {
    v.fromBufferAttribute(src, i);
    const n = noise.fbm(v.x * 1.6 + seed, v.z * 1.6 + v.y * 0.9 - seed, 3);
    const rr = radius * (1 + 0.42 * n);
    const p = new Vector3(center.x + v.x * rr, center.y + v.y * rr * squash, center.z + v.z * rr);
    const shade = 0.55 + 0.45 * smoothstep(-1, 1, v.y) + 0.08 * n;
    const c = color.clone().lerp(top, smoothstep(0.1, 1, v.y)).multiplyScalar(shade);
    idx.push(writer.vertex(p, c, 0, 0, 1, 0, 0));
  }
  for (let i = 0; i < idx.length; i += 3) writer.triangle(idx[i], idx[i + 1], idx[i + 2]);
}

/**
 * Leaf-card cluster: randomly oriented quads carrying the procedural leaf-cluster alpha texture,
 * filling a lobe volume with normals pointing out of the lobe (so it shades as one volume).
 * Reads as a broken, leafy crown from 60 m+ where laminae would be sub-pixel; a dark blob core
 * underneath hides the interior. The vertex colour is a tint — the texture carries the green.
 */
function leafCardLobe(writer: GeometryWriter, center: Vector3, radius: number, squash: number, count: number, cardSize: number, tint: Color, topTint: Color, r: RandomFn, shell?: [number, number]) {
  const n = new Vector3();
  const u = new Vector3();
  const w = new Vector3();
  for (let i = 0; i < count; i++) {
    // biased to the shell of the lobe so the silhouette is ragged and the core stays dark;
    // `shell` confines the cards to a band of the radius (the round-40 rim layer)
    const rr = radius * (shell ? shell[0] + r() * (shell[1] - shell[0]) : Math.pow(r(), 0.4));
    const th = r() * TAU;
    const ph = Math.acos(2 * r() - 1);
    const p = new Vector3(center.x + Math.sin(ph) * Math.cos(th) * rr, center.y + Math.cos(ph) * rr * squash, center.z + Math.sin(ph) * Math.sin(th) * rr);
    n.set((p.x - center.x) / radius, (p.y - center.y) / (radius * squash) + 0.7, (p.z - center.z) / radius).normalize();
    n.x += (r() - 0.5) * 0.7;
    n.z += (r() - 0.5) * 0.7;
    n.normalize();
    const ref = Math.abs(n.y) < 0.9 ? UP : new Vector3(1, 0, 0);
    u.crossVectors(n, ref).normalize();
    w.crossVectors(n, u).normalize();
    const spin = r() * TAU;
    const su = u.clone().multiplyScalar(Math.cos(spin)).addScaledVector(w, Math.sin(spin));
    const sw = w.clone().multiplyScalar(Math.cos(spin)).addScaledVector(u, -Math.sin(spin));
    const s = cardSize * (0.75 + r() * 0.6);
    const heightF = smoothstep(-1, 1, (p.y - center.y) / (radius * squash));
    const interior = 1 - rr / radius;
    const c = tint
      .clone()
      .lerp(topTint, heightF * 0.8 + r() * 0.2)
      .multiplyScalar((0.85 + r() * 0.3) * (1 - interior * 0.35));
    const V = (du: number, dw: number, tu: number, tv: number) =>
      writer.vertexN(p.clone().addScaledVector(su, du * s).addScaledVector(sw, dw * s), n, c, CARD_UV0 + (1 - CARD_UV0) * tu, CARD_UV0 + (1 - CARD_UV0) * tv, 1, 0, 0, 1);
    const a = V(-1, -1, 0, 0);
    const b = V(1, -1, 1, 0);
    const cc = V(1, 1, 1, 1);
    const d = V(-1, 1, 0, 1);
    writer.triangle(a, b, cc);
    writer.triangle(a, cc, d);
  }
}

/** solid (non-card) vertices of a geometry sharing the cluster-card material sample the opaque patch */
function solidUv(writer: GeometryWriter) {
  for (let i = 0; i < writer.roots.length / 4; i++) {
    if (writer.roots[i * 4 + 3] === 0) {
      writer.uvs[i * 2] = SOLID_UV;
      writer.uvs[i * 2 + 1] = SOLID_UV;
    }
  }
}

export function createDistantVariants(rng: Rng, palette: Palette): DistantVariant[] {
  const variants: DistantVariant[] = [];
  const specs: { kind: DistantKind; height: number; bandOnly?: boolean; radius?: number; taperTop?: number }[] = [
    { kind: 'broad', height: 19 },
    { kind: 'broad', height: 23 },
    { kind: 'broad', height: 27 },
    { kind: 'slender', height: 11 },
    { kind: 'slender', height: 14 },
    // round 31: a tall pale pole for the mid-distance "far trunk" row (trees index.ts
    // DEPTH_BANDS): a 1.9 m bole thinning to 0.65 m — the giants here are 2.2–4.4 m thick, and
    // frame 56 s's far trunks read 1.5–2 m at 25–40 m — with its small crown 18 m+ up, so at
    // 35–45 m only the trunk is in frame, the way the reference's far trunks run out of the top
    // of D and B. Five 1.4 m poles measured ≈ 1.4 % of frame D in their 2.5 m depth bucket
    // (a layer is 1.5 %); at 1.9 m the row measures 2.3 %. Band-only, so the radial layer's
    // variant picks (slenderIdx) are unchanged.
    { kind: 'slender', height: 26, bandOnly: true, radius: 0.95, taperTop: 0.35 },
  ];
  // darker than the near trees: the far layer is silhouette against haze, the fog lightens it
  const canopy = new Color(palette.leafCanopy).multiplyScalar(0.48);
  const sunny = new Color(palette.leafSun).multiplyScalar(0.55);
  // card vertex colours are tints over the cluster texture's own greens
  const cardTint = new Color(0.62, 0.66, 0.6);
  const cardTopTint = new Color(0.9, 0.95, 0.72);
  specs.forEach((spec, index) => {
    const r = rng.fork(`distant-${index}`);
    const noise = new Noise2D(`distant-noise-${index}`);
    const H = spec.height;
    const slender = spec.kind === 'slender';
    const R = spec.radius ?? (slender ? H * 0.014 : H * 0.05);
    const bark = slender ? new Color(palette.barkWhite).multiplyScalar(0.7) : new Color(palette.barkDark).multiplyScalar(0.85);
    const crownY = slender ? H * 0.68 : H * 0.66;
    const crownR = slender ? H * 0.2 : H * 0.42;

    // ---- near LOD ----
    const near = new GeometryWriter('high');
    const lean = Math.tan((r.range(1.5, 6) * Math.PI) / 180) * crownY;
    const az = r.range(0, TAU);
    const trunk = growthPath(new Vector3(0, -0.6, 0), new Vector3(Math.cos(az) * lean, crownY + crownR * 0.3, Math.sin(az) * lean), UP, r, 6, 0.3);
    // round 44 (survey #2, crops 04/05: a depth row's bole 10–20 m from a walker was a 7-sided
    // prism): 10 / 7 sides. The sweep's draws are taken as the 7 / 5-sided one took them (phase,
    // wind phase, one grain per old side) and the grain resampled over the new sides, so the
    // limbs and lobes after it draw exactly what they did — the rows' silhouettes in D hold.
    const oldSides = slender ? 5 : 7;
    const sides = slender ? 7 : 10;
    const trunkDraws = consumeTubeDraws(r, oldSides);
    trunkDraws.grain = Array.from({ length: sides }, (_, j) => trunkDraws.grain[Math.floor((j / sides) * oldSides)]);
    // round 45 (trees-27's leftover, w19-spine-r / sn-arch-outside: the depth rows' boles 15–30 m
    // from a walker were straight pale cylinders): a basal flare on the near LOD — the radius
    // × (1 + DISTANT_FLARE e^(−d / DISTANT_FLARE_FALL)) along the bole, 1.27 R at the ground line
    // (the path starts 0.6 m under it), 1.1 R at 2 m — through the tube's bump hook (no draws),
    // so every draw after it is what it was. Near LOD only: the far LOD's crossed quads stand in
    // beyond 44 m, and no near-LOD distant tree is inside a fixed frame (depth rows 52 m+ from D,
    // the radial pool 51 m+ from A).
    const flare = (_angle: number, distance: number) => 1 + DISTANT_FLARE * Math.exp(-distance / DISTANT_FLARE_FALL);
    tube(near, trunk, taper(trunk, R, R * (spec.taperTop ?? 0.25), 0.9), sides, r, { color: bark, roughness: 0.1, flatBase: true, structural: true, stiffness: () => 1, draws: trunkDraws, bump: flare });
    const limbs = slender ? 1 : r.int(2, 4);
    // round 45 (trees-28 item 4, survey pose w19-spine-u: the "pale twig tips spiking the crown
    // rim" straight overhead on the north spine are a depth-row tree's limbs — 4-sided bark-
    // coloured tubes 0.3–0.5 m thick running to 0.6–1.0 crown radii, past the lobe shells, pale
    // planks against the sky from under them): the limbs end inside the lobes (LIMB_REACH), are
    // 6-sided with their draws taken as the 4-sided ones took them (the grain resampled, like the
    // trunk above, so the lobes and the far LOD after them draw exactly what they did), and run
    // from the bark at the bole to the crown's own dark from halfway out (LIMB_TIP_TINT).
    const limbTip = canopy.clone().multiplyScalar(0.6);
    for (let i = 0; i < limbs; i++) {
      const t = r.range(0.45, 0.75);
      const o = trunk[Math.round(t * (trunk.length - 1))].clone();
      const a = az + (i / limbs) * TAU + r.range(-0.4, 0.4);
      const len = crownR * r.range(LIMB_REACH[0], LIMB_REACH[1]);
      const target = o.clone().add(new Vector3(Math.cos(a) * len, len * r.range(0.25, 0.6), Math.sin(a) * len));
      const path = growthPath(o, target, UP, r, 4, 0.5);
      const limbDraws = consumeTubeDraws(r, 4);
      limbDraws.grain = Array.from({ length: 6 }, (_, j) => limbDraws.grain[Math.floor((j / 6) * 4)]);
      const limbLength = Math.max(0.5, o.distanceTo(target));
      tube(near, path, taper(path, R * 0.45, 0.05, 0.9), 6, r, { color: (pt) => bark.clone().lerp(limbTip, smoothstep(LIMB_TINT_FROM, LIMB_TINT_TO, pt.distanceTo(o) / limbLength) * LIMB_TIP_TINT), roughness: 0.05, structural: true, stiffness: () => 1, draws: limbDraws });
    }
    const lobes = slender ? 3 : 5;
    const cardsPerLobe = slender ? 18 : 24;
    const rim = rng.fork(`distant-rim-${index}`);
    for (let i = 0; i < lobes; i++) {
      const a = r.range(0, TAU);
      const rad = crownR * r.range(0, 0.6);
      const lift = r.range(-0.1, 0.4);
      // round 44 (survey crop 27, the "T" tree with a disc crown): a slender's three lobes sat at
      // one height, squashed to 0.6–0.85 — a flat plate on a pole. They now stack up the leader
      // (0, 0.55, 1.1 crown radii) and stay rounder; same draws, so the radial pool's placements
      // and every broad variant (the depth rows in D) are untouched.
      const c = new Vector3(Math.cos(a) * rad, crownY + (slender ? lift * 0.4 + i * 0.55 : lift) * crownR + (i === 0 ? crownR * 0.3 : 0), Math.sin(a) * rad);
      const br = crownR * r.range(0.36, 0.6);
      const shade = r.range(0.75, 1.05);
      const squashDraw = r.range(0.6, 0.85);
      const squash = slender ? 0.78 + (squashDraw - 0.6) * 0.8 : squashDraw;
      // dark core + ragged leaf-card shell
      lumpyBlob(near, c, br * 0.66, squash, canopy.clone().multiplyScalar(shade * 0.6), canopy.clone().multiplyScalar(shade * 0.85), noise, i * 3.7);
      leafCardLobe(near, c, br, squash, cardsPerLobe, br * 0.42, cardTint.clone().multiplyScalar(shade), cardTopTint.clone().multiplyScalar(shade), r);
      // round 40: a finer rim layer of small cards just outside the shell so the outline breaks
      // into leaf clumps at 60–120 m instead of a few large cards over a blob (the stair-landing
      // and plaza looking-up views); own stream, so the lobes above keep their draws
      leafCardLobe(near, c, br, squash, slender ? 6 : 8, br * 0.24, cardTint.clone().multiplyScalar(shade * 0.9), cardTopTint.clone().multiplyScalar(shade * 0.9), rim, [0.96, 1.12]);
    }
    // round 44 (survey #2: "no base flare, a hard base seam"): a root flare — 4–6 short buttress
    // roots (writer.ts rootButtress) diving under the ground from the foot of the bole, from
    // their own stream so nothing above re-rolls; the depth rows' feet are at the ground line of
    // D at 47 m+ where a 0.5 m root is 5 px in the haze
    const rootRng = rng.fork(`distant-roots-${index}`);
    const rootColor = bark.clone().multiplyScalar(0.86);
    const rootCount = slender ? 4 : rootRng.int(5, 7);
    for (let i = 0; i < rootCount; i++) {
      const a = (i / rootCount) * TAU + rootRng.range(-0.3, 0.3);
      rootButtress(near, a, R * rootRng.range(1.4, 2.1), R * rootRng.range(0.3, 0.45), R * rootRng.range(0.45, 0.7), rootColor, rootRng, () => 0, new Vector3(0, 0, 0), 6);
    }
    solidUv(near);

    // ---- far LOD: three fixed vertical silhouette planes, each a solid core fan with a rim of
    // leaf-cluster cards, + crossed trunk quads ----
    // (round 40: one solid 12-point fan per plane read as a flat paddle from the stair landing —
    // the owner's "far crowns must read as trees". Now each plane is layered: an 8-point solid
    // fan at 0.74 of the radius is the dark mass, and seven alpha cluster cards ride its outline
    // at 0.86–1.0 of the radius, in the plane, so the silhouette breaks into leaf clumps. 70
    // triangles a tree against 40; the radial pool's 500 far trees cost 15 k more.)
    const far = new GeometryWriter('high');
    const dark = canopy.clone().multiplyScalar(0.8);
    const light = canopy.clone().lerp(sunny, 0.5);
    const rimTint = cardTint.clone().multiplyScalar(0.8);
    const rimTop = cardTopTint.clone().multiplyScalar(0.8);
    for (let plane = 0; plane < 3; plane++) {
      const a = (plane / 3) * Math.PI;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const planeN = new Vector3(-Math.sin(a), 0, Math.cos(a));
      const centre = new Vector3(0, crownY + crownR * 0.15, 0);
      const ci = far.vertex(centre, canopy.clone().multiplyScalar(0.9), 0.5, 0.5, 1, 0, 0);
      const outline: number[] = [];
      const points = 8;
      const radiusAt = (th: number) => {
        const n = noise.noise(Math.cos(th) * 1.7 + plane * 5, Math.sin(th) * 1.7);
        return crownR * (0.8 + 0.3 * n) * (Math.sin(th) < -0.3 ? 0.75 : 1);
      };
      for (let k = 0; k < points; k++) {
        const th = (k / points) * TAU;
        const rr = radiusAt(th) * 0.74;
        const p = centre.clone().addScaledVector(dir, Math.cos(th) * rr).addScaledVector(UP, Math.sin(th) * rr * 0.8);
        const c = dark.clone().lerp(light, smoothstep(-0.5, 1, Math.sin(th)));
        outline.push(far.vertex(p, c, 0.5 + Math.cos(th) * 0.5, 0.5 + Math.sin(th) * 0.5, 1, 0, 0));
      }
      for (let k = 0; k < points; k++) far.triangle(ci, outline[k], outline[(k + 1) % points]);
      // the rim: cards in the plane along the outline (the underside sparser: two of the seven
      // sit below the centre, where the mass reads as one dark base against the ground haze)
      const rimCards = 7;
      for (let k = 0; k < rimCards; k++) {
        const th = ((k + 0.5) / rimCards) * TAU + r.range(-0.15, 0.15);
        const rr = radiusAt(th) * r.range(0.86, 1.0);
        const p = centre.clone().addScaledVector(dir, Math.cos(th) * rr).addScaledVector(UP, Math.sin(th) * rr * 0.8);
        const s = crownR * r.range(0.3, 0.42);
        const spin = r.range(0, TAU);
        const su = dir.clone().multiplyScalar(Math.cos(spin)).addScaledVector(UP, Math.sin(spin));
        const sw = UP.clone().multiplyScalar(Math.cos(spin)).addScaledVector(dir, -Math.sin(spin));
        const c = rimTint.clone().lerp(rimTop, smoothstep(-0.5, 1, Math.sin(th)) * 0.8 + r() * 0.2).multiplyScalar(0.85 + r() * 0.3);
        const V = (du: number, dw: number, tu: number, tv: number) =>
          far.vertexN(p.clone().addScaledVector(su, du * s).addScaledVector(sw, dw * s), planeN, c, CARD_UV0 + (1 - CARD_UV0) * tu, CARD_UV0 + (1 - CARD_UV0) * tv, 1, 0, 0, 1);
        const q0 = V(-1, -1, 0, 0);
        const q1 = V(1, -1, 1, 0);
        const q2 = V(1, 1, 1, 1);
        const q3 = V(-1, 1, 0, 1);
        far.triangle(q0, q1, q2);
        far.triangle(q0, q2, q3);
      }
    }
    for (let plane = 0; plane < 2; plane++) {
      const a = (plane / 2) * Math.PI;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const w = R * 1.1;
      const a0 = far.vertex(new Vector3().addScaledVector(dir, -w).setY(-0.6), bark, 0, 0, 1, 0, 0);
      const a1 = far.vertex(new Vector3().addScaledVector(dir, w).setY(-0.6), bark, 1, 0, 1, 0, 0);
      const b0 = far.vertex(new Vector3().addScaledVector(dir, -w * 0.6).setY(crownY + crownR * 0.2), bark, 0, 1, 1, 0, 0);
      const b1 = far.vertex(new Vector3().addScaledVector(dir, w * 0.6).setY(crownY + crownR * 0.2), bark, 1, 1, 1, 0, 0);
      far.triangle(a0, a1, b1);
      far.triangle(a0, b1, b0);
    }
    solidUv(far);

    variants.push({
      kind: spec.kind,
      near: near.finish(`distant-near-${index}`),
      far: far.finish(`distant-far-${index}`),
      height: H,
      nearTriangles: near.triangles,
      farTriangles: far.triangles,
      bandOnly: spec.bandOnly ?? false,
    });
  });
  return variants;
}

/**
 * A dense row of silhouettes filling a narrow depth range (a "depth layer" behind a landmark):
 * jittered grid over [xMin, xMax] × [zMin, zMax], broad variants only (unless `kind` says
 * otherwise), darker tint.
 */
export interface DepthBand {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  spacing: number;
  scale: [number, number];
  /** brightness multiplier (< 1 = darker silhouette under the haze) */
  shade: number;
  /** only broad variants up to this unscaled height are used (keeps a row's skyline low) */
  maxVariantHeight?: number;
  /** variant kind for the row (default 'broad'); 'slender' rows may use band-only variants */
  kind?: DistantKind;
  /** only variants at least this tall (unscaled) */
  minVariantHeight?: number;
  /**
   * own PRNG stream for the row's jitter / picks / tints; without it the row draws from the
   * shared 'distant-placement' stream and every later placement (the other bands, the radial
   * layer) moves when the row is added or edited
   */
  stream?: string;
}

/**
 * Ground a distant tree may not stand on (round 45, structures-28's ray pick: a depth-row trunk
 * 5 m off the path spine, inside the log arch's west root mass, dead on the arch's north sight
 * line). `spine` is a polyline (xz) every instance keeps `spineClearance` metres off; an instance
 * drawn closer is slid out along the perpendicular to `spineClearance + 0.5` (the depth rows fill
 * a hero frame's far layer, so a tree is moved, not dropped, when the ground there allows it).
 * `footprints` are oriented boxes (a hollow log's body) nothing may stand in. Applied AFTER every
 * random draw of the candidate, so every other placement — the other rows, the radial layer — is
 * exactly what it was without the rule.
 */
export interface DistantClearance {
  spine: [number, number][];
  spineClearance: number;
  footprints: { x: number; z: number; ax: number; az: number; halfLength: number; halfWidth: number }[];
}

function pointSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { d: number; nx: number; nz: number } {
  const abx = bx - ax;
  const abz = bz - az;
  const l2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / l2));
  const qx = ax + abx * t;
  const qz = az + abz * t;
  const dx = px - qx;
  const dz = pz - qz;
  const d = Math.hypot(dx, dz);
  return d > 1e-6 ? { d, nx: dx / d, nz: dz / d } : { d, nx: -abz / Math.sqrt(l2), nz: abx / Math.sqrt(l2) };
}

/** nearest point of the clearance spine: distance and the unit vector away from it */
function spineOffset(spine: [number, number][], x: number, z: number): { d: number; nx: number; nz: number } {
  let best = { d: Infinity, nx: 1, nz: 0 };
  for (let i = 0; i + 1 < spine.length; i++) {
    const s = pointSegment(x, z, spine[i][0], spine[i][1], spine[i + 1][0], spine[i + 1][1]);
    if (s.d < best.d) best = s;
  }
  return best;
}

function inFootprint(f: DistantClearance['footprints'][number], x: number, z: number): boolean {
  const rx = x - f.x;
  const rz = z - f.z;
  const along = rx * f.ax + rz * f.az;
  const across = -rx * f.az + rz * f.ax;
  return Math.abs(along) <= f.halfLength && Math.abs(across) <= f.halfWidth;
}

export function placeDistantTrees(rng: Rng, terrain: Terrain, variants: DistantVariant[], target: number, inner = 60, outer = 215, bands: DepthBand[] = [], clearance?: DistantClearance): DistantPlacement[] {
  const r = rng.fork('distant-placement');
  const clump = new Noise2D('distant-clumps');
  const out: DistantPlacement[] = [];
  const cell = 6;
  const grid = new Map<string, DistantPlacement[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const push = (p: DistantPlacement) => {
    out.push(p);
    const k = key(p.x, p.z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(p);
  };
  /** a candidate that has drawn everything: keep as is, slide off the spine, or drop (null) */
  let moved = 0;
  let dropped = 0;
  const cleared = (p: DistantPlacement, minD: number): DistantPlacement | null => {
    if (!clearance) return p;
    const spine = spineOffset(clearance.spine, p.x, p.z);
    const inside = (x: number, z: number) => clearance.footprints.some((f) => inFootprint(f, x, z));
    if (spine.d < clearance.spineClearance || inside(p.x, p.z)) {
      // slide out along the perpendicular: to the clearance ring first, then a metre at a time
      // (≤ 8 m) until the point is out of every footprint too
      for (let push = Math.max(0, clearance.spineClearance + 0.5 - spine.d); push <= clearance.spineClearance + 8.5; push += 1) {
        const x = p.x + spine.nx * push;
        const z = p.z + spine.nz * push;
        if (inside(x, z)) continue;
        const m = terrain.mask(x, z);
        if (m.structure > 0.4 || m.path > 0.4 || terrain.slope(x, z) > 0.72 || tooCloseIn(grid, cell, x, z, minD)) break;
        moved++;
        return { ...p, x, z, y: terrain.height(x, z) };
      }
      dropped++;
      return null;
    }
    return p;
  };
  const broadOnly = variants.map((v, i) => (v.kind === 'broad' && !v.bandOnly ? i : -1)).filter((i) => i >= 0);
  for (const band of bands) {
    const kind = band.kind ?? 'broad';
    const pool = variants
      .map((v, i) => (v.kind === kind && (band.maxVariantHeight === undefined || v.height <= band.maxVariantHeight) && (band.minVariantHeight === undefined || v.height >= band.minVariantHeight) ? i : -1))
      .filter((i) => i >= 0);
    const bandPool = pool.length ? pool : broadOnly;
    const rb = band.stream ? rng.fork(band.stream) : r;
    const nx = Math.max(1, Math.round((band.xMax - band.xMin) / band.spacing));
    const nz = Math.max(1, Math.round((band.zMax - band.zMin) / band.spacing));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const x = band.xMin + ((i + 0.5 + rb.range(-0.4, 0.4)) / nx) * (band.xMax - band.xMin);
        const z = band.zMin + ((j + 0.5 + rb.range(-0.4, 0.4)) / nz) * (band.zMax - band.zMin);
        const m = terrain.mask(x, z);
        if (m.structure > 0.4 || m.path > 0.4 || terrain.slope(x, z) > 0.72) continue;
        if (tooCloseIn(grid, cell, x, z, band.spacing * 0.6)) continue;
        const tintShift = rb.range(-0.05, 0.05);
        const tint = new Color(1 + tintShift * 0.5, 1 + tintShift, 1 - tintShift * 0.6).multiplyScalar(band.shade * rb.range(0.9, 1.05));
        const p = cleared({ variant: bandPool[rb.int(0, bandPool.length)], x, y: terrain.height(x, z), z, yaw: rb() * TAU, scale: rb.range(band.scale[0], band.scale[1]), tint }, band.spacing * 0.6);
        if (p) push(p);
      }
    }
  }
  const tooClose = (x: number, z: number, minD: number) => tooCloseIn(grid, cell, x, z, minD);
  const broadIdx = broadOnly;
  const slenderIdx = variants.map((v, i) => (v.kind === 'slender' && !v.bandOnly ? i : -1)).filter((i) => i >= 0);
  let attempts = 0;
  // a radial candidate the clearance drops still counts toward the target: the loop then ends on
  // the same draw it always did and no later tree appears to replace it
  let placed = 0;
  while (placed < target && attempts < target * 40) {
    attempts++;
    const a = r() * TAU;
    // area-uniform radius in the annulus, slightly biased inward so the near band is dense
    const u = r();
    const rad = Math.sqrt(inner * inner + (outer * outer - inner * inner) * Math.pow(u, 1.15));
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const density = 0.35 + 0.65 * (clump.fbm(x * 0.02, z * 0.02, 3) * 0.5 + 0.5);
    if (r() > density) continue;
    const m = terrain.mask(x, z);
    if (m.structure > 0.4 || m.path > 0.4 || terrain.slope(x, z) > 0.72) continue;
    const slender = r() < 0.22;
    const minD = slender ? 4.5 : 7.5;
    if (tooClose(x, z, minD)) continue;
    const variant = slender ? slenderIdx[r.int(0, slenderIdx.length)] : broadIdx[r.int(0, broadIdx.length)];
    const tintShift = r.range(-0.06, 0.06);
    const tint = new Color(1 + tintShift * 0.5, 1 + tintShift, 1 - tintShift * 0.6).multiplyScalar(r.range(0.82, 1.08));
    const p = cleared({ variant, x, y: terrain.height(x, z), z, yaw: r() * TAU, scale: r.range(0.8, 1.28), tint }, minD);
    placed++;
    if (p) push(p);
  }
  lastClearanceTally = { moved, dropped };
  return out;
}

let lastClearanceTally = { moved: 0, dropped: 0 };
/** how many placements the last `placeDistantTrees` clearance slid off the spine / dropped (audit) */
export function distantClearanceTally(): { moved: number; dropped: number } {
  return { ...lastClearanceTally };
}

function tooCloseIn(grid: Map<string, DistantPlacement[]>, cell: number, x: number, z: number, minD: number): boolean {
  const cx = Math.floor(x / cell);
  const cz = Math.floor(z / cell);
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const list = grid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (const p of list) if (Math.hypot(p.x - x, p.z - z) < minD) return true;
    }
  }
  return false;
}
