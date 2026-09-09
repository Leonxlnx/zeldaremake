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
import { GeometryWriter, TAU, UP, growthPath, taper, tube, type RandomFn } from './writer';
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
function leafCardLobe(writer: GeometryWriter, center: Vector3, radius: number, squash: number, count: number, cardSize: number, tint: Color, topTint: Color, r: RandomFn) {
  const n = new Vector3();
  const u = new Vector3();
  const w = new Vector3();
  for (let i = 0; i < count; i++) {
    // biased to the shell of the lobe so the silhouette is ragged and the core stays dark
    const rr = radius * Math.pow(r(), 0.4);
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
  const specs: { kind: DistantKind; height: number }[] = [
    { kind: 'broad', height: 19 },
    { kind: 'broad', height: 23 },
    { kind: 'broad', height: 27 },
    { kind: 'slender', height: 11 },
    { kind: 'slender', height: 14 },
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
    const R = slender ? H * 0.014 : H * 0.05;
    const bark = slender ? new Color(palette.barkWhite).multiplyScalar(0.7) : new Color(palette.barkDark).multiplyScalar(0.85);
    const crownY = slender ? H * 0.68 : H * 0.66;
    const crownR = slender ? H * 0.2 : H * 0.42;

    // ---- near LOD ----
    const near = new GeometryWriter('high');
    const lean = Math.tan((r.range(1.5, 6) * Math.PI) / 180) * crownY;
    const az = r.range(0, TAU);
    const trunk = growthPath(new Vector3(0, -0.6, 0), new Vector3(Math.cos(az) * lean, crownY + crownR * 0.3, Math.sin(az) * lean), UP, r, 6, 0.3);
    tube(near, trunk, taper(trunk, R, R * 0.25, 0.9), slender ? 5 : 7, r, { color: bark, roughness: 0.1, flatBase: true, structural: true, stiffness: () => 1 });
    const limbs = slender ? 1 : r.int(2, 4);
    for (let i = 0; i < limbs; i++) {
      const t = r.range(0.45, 0.75);
      const o = trunk[Math.round(t * (trunk.length - 1))].clone();
      const a = az + (i / limbs) * TAU + r.range(-0.4, 0.4);
      const len = crownR * r.range(0.6, 1.0);
      const target = o.clone().add(new Vector3(Math.cos(a) * len, len * r.range(0.25, 0.6), Math.sin(a) * len));
      const path = growthPath(o, target, UP, r, 4, 0.5);
      tube(near, path, taper(path, R * 0.45, 0.05, 0.9), 4, r, { color: bark, roughness: 0.05, structural: true, stiffness: () => 1 });
    }
    const lobes = slender ? 3 : 5;
    const cardsPerLobe = slender ? 18 : 24;
    for (let i = 0; i < lobes; i++) {
      const a = r.range(0, TAU);
      const rad = crownR * r.range(0, 0.6);
      const c = new Vector3(Math.cos(a) * rad, crownY + r.range(-0.1, 0.4) * crownR + (i === 0 ? crownR * 0.3 : 0), Math.sin(a) * rad);
      const br = crownR * r.range(0.36, 0.6);
      const shade = r.range(0.75, 1.05);
      const squash = r.range(0.6, 0.85);
      // dark core + ragged leaf-card shell
      lumpyBlob(near, c, br * 0.66, squash, canopy.clone().multiplyScalar(shade * 0.6), canopy.clone().multiplyScalar(shade * 0.85), noise, i * 3.7);
      leafCardLobe(near, c, br, squash, cardsPerLobe, br * 0.42, cardTint.clone().multiplyScalar(shade), cardTopTint.clone().multiplyScalar(shade), r);
    }
    solidUv(near);

    // ---- far LOD: three fixed vertical silhouette fans + crossed trunk quads ----
    const far = new GeometryWriter('high');
    const dark = canopy.clone().multiplyScalar(0.8);
    const light = canopy.clone().lerp(sunny, 0.5);
    for (let plane = 0; plane < 3; plane++) {
      const a = (plane / 3) * Math.PI;
      const dir = new Vector3(Math.cos(a), 0, Math.sin(a));
      const centre = new Vector3(0, crownY + crownR * 0.15, 0);
      const ci = far.vertex(centre, canopy.clone().multiplyScalar(0.9), 0.5, 0.5, 1, 0, 0);
      const outline: number[] = [];
      const points = 12;
      for (let k = 0; k < points; k++) {
        const th = (k / points) * TAU;
        const n = noise.noise(Math.cos(th) * 1.7 + plane * 5, Math.sin(th) * 1.7);
        const rr = crownR * (0.8 + 0.3 * n) * (Math.sin(th) < -0.3 ? 0.75 : 1);
        const p = centre.clone().addScaledVector(dir, Math.cos(th) * rr).addScaledVector(UP, Math.sin(th) * rr * 0.8);
        const c = dark.clone().lerp(light, smoothstep(-0.5, 1, Math.sin(th)));
        outline.push(far.vertex(p, c, 0.5 + Math.cos(th) * 0.5, 0.5 + Math.sin(th) * 0.5, 1, 0, 0));
      }
      for (let k = 0; k < points; k++) far.triangle(ci, outline[k], outline[(k + 1) % points]);
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
    });
  });
  return variants;
}

export function placeDistantTrees(rng: Rng, terrain: Terrain, variants: DistantVariant[], target: number, inner = 60, outer = 215): DistantPlacement[] {
  const r = rng.fork('distant-placement');
  const clump = new Noise2D('distant-clumps');
  const out: DistantPlacement[] = [];
  const cell = 6;
  const grid = new Map<string, DistantPlacement[]>();
  const key = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  const tooClose = (x: number, z: number, minD: number) => {
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
  };
  const broadIdx = variants.map((v, i) => (v.kind === 'broad' ? i : -1)).filter((i) => i >= 0);
  const slenderIdx = variants.map((v, i) => (v.kind === 'slender' ? i : -1)).filter((i) => i >= 0);
  let attempts = 0;
  while (out.length < target && attempts < target * 40) {
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
    const p: DistantPlacement = { variant, x, y: terrain.height(x, z), z, yaw: r() * TAU, scale: r.range(0.8, 1.28), tint };
    out.push(p);
    const k = key(x, z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(p);
  }
  return out;
}
