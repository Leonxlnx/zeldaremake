/**
 * Plant geometry variants (ferns, bushes, purple flowers, broad-leaf weeds, seed-head stalks,
 * clover, moss tufts, saplings). Each builder returns one geometry per LOD, highest detail
 * first. Derived from Verdant Forest by Leonxlnx (understory.js / botanical-refinement.js).
 */
import { Vector3, type BufferGeometry } from 'three';
import { createRng, type Rng } from '../util/prng';
import { MeshBuilder, TAU, V, blend, curvedLeaf, disc, dome, foldedLeaf, lanceLeaf, rgb, sampleCurve, tone, tube, type RGB } from './geometry';

export type Detail = 'high' | 'mid' | 'low';
const DETAILS: Detail[] = ['high', 'mid', 'low'];

export interface PlantPalette {
  fern: RGB;
  leaf: RGB;
  leafSun: RGB;
  stem: RGB;
  bark: RGB;
  purple: RGB;
  purpleLight: RGB;
  purpleDeep: RGB;
  yellow: RGB;
  weed: RGB;
  straw: RGB;
  mossDeep: RGB;
  mossBright: RGB;
  grassLight: RGB;
}

export function makePalette(p: { fernGreen: number; leafCanopy: number; leafSun: number; barkDark: number; flowerPurple: number; mossDeep: number; mossBright: number; grassLight: number; grassMid: number }): PlantPalette {
  return {
    fern: rgb(p.fernGreen),
    leaf: rgb(p.leafCanopy),
    leafSun: rgb(p.leafSun),
    stem: blend(rgb(p.grassMid), rgb(p.barkDark), 0.35),
    bark: rgb(p.barkDark),
    // the reference blooms read as deep saturated violet (sRGB ≈ 80/50/95 in shadow); the palette
    // hue is kept but pulled darker/more saturated so lit petals still land in the purple band
    purple: blend(rgb(p.flowerPurple), rgb(0x5a2496), 0.6),
    purpleLight: blend(rgb(p.flowerPurple), rgb(0x8f55d6), 0.6),
    purpleDeep: blend(tone(rgb(p.flowerPurple), 0.5), rgb(0x3a1466), 0.5),
    yellow: rgb(0xf0d060),
    weed: blend(rgb(p.grassLight), rgb(0xb9c25a), 0.5),
    straw: rgb(0xc7b26a),
    mossDeep: rgb(p.mossDeep),
    mossBright: rgb(p.mossBright),
    grassLight: rgb(p.grassLight),
  };
}

const arch = (radial: Vector3, lateral: Vector3, reach: number, sway: number, h: number, rise = 0.75) => (t: number) =>
  radial
    .clone()
    .multiplyScalar(0.02 + reach * Math.pow(t, 1.6))
    .addScaledVector(lateral, sway * t * t)
    .add(V(0, h * Math.sin(t * Math.PI * rise), 0));

// ---------------------------------------------------------------- ferns
export function fernGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const fronds = low ? 5 : 6 + rng.int(0, 3);
  const height = 0.5 + rng() * 0.32;
  const azimuth = rng() * TAU;
  const stemColor = blend(pal.stem, pal.fern, 0.5);
  for (let f = 0; f < fronds; f++) {
    const angle = azimuth + (f * TAU) / fronds + (rng() - 0.5) * 0.35;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    const h = height * (f === 0 ? 1 : 0.68 + rng() * 0.32);
    const reach = 0.58 + rng() * 0.36 + (1 - h / height) * 0.2;
    const curve = arch(radial, lateral, reach, (rng() - 0.5) * 0.18, h);
    const segs = high ? 10 : low ? 4 : 6;
    tube(m, sampleCurve(curve, segs), 0.0075, 0.001, stemColor, high ? 4 : 3);
    const pairs = high ? 11 : low ? 5 : 8;
    const frondTone = 0.85 + rng() * 0.3;
    for (let p = 0; p < pairs; p++) {
      const t = 0.15 + (p / (pairs - 1)) * 0.8;
      const envelope = Math.pow(Math.sin(Math.PI * ((t - 0.05) / 0.95)), 0.8);
      const length = (0.2 + rng() * 0.05) * Math.max(0.1, envelope) * (1 - t * 0.25) * (low ? 1.25 : 1);
      for (const sign of [-1, 1]) {
        const origin = curve(Math.min(1, Math.max(0, t + sign * 0.005)));
        const dir = lateral
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(radial, 0.25 + t * 0.3)
          .add(V(0, 0.12 - t * 0.28 + (rng() - 0.5) * 0.15, 0));
        const color = tone(pal.fern, frondTone * (0.9 + rng() * 0.2));
        const opts = { curl: 0.05 + rng() * 0.12, twist: sign * (0.05 + rng() * 0.2), ridge: 0.15, serration: 0.05 };
        if (high) lanceLeaf(m, origin, dir, length * (0.92 + rng() * 0.16), length * (0.26 + rng() * 0.06), color, { ...opts, sections: 3 });
        else if (low) foldedLeaf(m, origin, dir, length, length * 0.3, color, opts);
        else curvedLeaf(m, origin, dir, length, length * 0.28, color, opts);
      }
    }
    const tipDir = radial.clone().add(V(0, -0.35, 0));
    if (low) foldedLeaf(m, curve(0.96), tipDir, 0.07, 0.02, tone(pal.fern, 1.05));
    else curvedLeaf(m, curve(0.96), tipDir, 0.075, 0.02, tone(pal.fern, 1.05), { curl: 0.2 });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- bushes
export function bushGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const stems = 4 + rng.int(0, 3);
  const height = 0.7 + rng() * 0.5;
  const phase = rng() * TAU;
  for (let s = 0; s < stems; s++) {
    const angle = phase + (s * TAU) / stems + (rng() - 0.5) * 0.8;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    const bend = 0.25 + rng() * 0.35;
    const h = height * (0.65 + rng() * 0.35);
    const curve = (t: number) => radial.clone().multiplyScalar(0.05 + bend * t * t).addScaledVector(lateral, Math.sin(t * Math.PI) * 0.06).add(V(0, t * h, 0));
    tube(m, sampleCurve(curve, high ? 5 : 3), 0.012 + rng() * 0.005, 0.0025, pal.bark, high ? 4 : 3);
    const branches = high ? 4 : low ? 2 : 3;
    for (let b = 0; b < branches; b++) {
      const t = 0.2 + (b / Math.max(1, branches - 1)) * 0.72;
      const start = curve(t);
      const sign = b % 2 ? -1 : 1;
      const reach = (0.26 + rng() * 0.18) * (1.1 - t * 0.3);
      const branchDir = lateral.clone().multiplyScalar(sign * (0.7 + rng() * 0.35)).addScaledVector(radial, 0.45 + rng() * 0.4).normalize();
      const rise = 0.1 + rng() * 0.18;
      const twig = (u: number) => start.clone().addScaledVector(branchDir, reach * u).add(V(0, rise * u + Math.sin(u * Math.PI) * 0.04, 0));
      if (!low) tube(m, sampleCurve(twig, high ? 3 : 2), 0.005 * (1 - t * 0.4), 0.001, tone(pal.bark, 1.15), 3);
      const leafCount = high ? 7 : low ? 4 : 5;
      for (let l = 0; l < leafCount; l++) {
        const u = 0.1 + (l / (leafCount - 1)) * 0.9;
        const attach = twig(u);
        const leafSide = l % 2 ? -1 : 1;
        const cross = V(-branchDir.z, 0, branchDir.x);
        const dir = cross
          .multiplyScalar(leafSide * (0.6 + rng() * 0.45))
          .addScaledVector(branchDir, 0.4 + rng() * 0.35)
          .add(V(0, (rng() - 0.4) * 0.7, 0))
          .normalize();
        const len = (0.11 + rng() * 0.07) * (1.05 - u * 0.15) * (low ? 1.5 : 1);
        const sun = Math.min(1, (attach.y / height) * 0.7 + Math.hypot(attach.x, attach.z) * 0.5);
        const color = tone(blend(pal.leaf, pal.leafSun, sun * 0.7), 0.85 + rng() * 0.3);
        const opts = { curl: 0.1 + rng() * 0.12, twist: (rng() - 0.5) * 0.6, ridge: 0.12 };
        if (low) foldedLeaf(m, attach, dir, len, len * 0.6, color, opts);
        else curvedLeaf(m, attach, dir, len, len * (0.55 + rng() * 0.25), color, opts);
      }
    }
    for (let terminal = 0; terminal < 2; terminal++) {
      const dir = radial.clone().addScaledVector(lateral, terminal ? 0.55 : -0.55).add(V(0, 0.45, 0));
      const color = tone(pal.leafSun, 0.95 + rng() * 0.15);
      if (low) foldedLeaf(m, curve(0.98), dir, 0.12, 0.08, color);
      else curvedLeaf(m, curve(0.98), dir, terminal ? 0.1 : 0.13, terminal ? 0.06 : 0.085, color, { curl: 0.17, twist: 0.15, ridge: 0.11 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- purple flowers
export function flowerGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const stems = low ? 4 : 5 + rng.int(0, 4);
  const phase = rng() * TAU;
  const leafColor = blend(pal.leaf, pal.grassLight, 0.3);
  for (let i = 0; i < stems; i++) {
    const angle = phase + (i * TAU) / stems + (rng() - 0.5) * 0.5;
    const radius = 0.03 + rng() * 0.14;
    const root = V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const height = 0.2 + rng() * 0.2;
    const lean = V(Math.cos(angle) * height * 0.3, height, Math.sin(angle) * height * 0.3);
    const curve = (t: number) => root.clone().add(lean.clone().multiplyScalar(t)).add(V(Math.sin(angle + 0.8) * Math.sin(t * Math.PI) * 0.015, 0, Math.cos(angle + 0.8) * Math.sin(t * Math.PI) * 0.015));
    tube(m, sampleCurve(curve, high ? 3 : 2), 0.0022, 0.0012, pal.stem, 3);
    if (!low) {
      for (let j = 0; j < 2; j++) {
        for (const sign of [-1, 1]) {
          const dir = V(Math.cos(angle + j * 1.3) * sign, 0.3, Math.sin(angle + j * 1.3) * sign);
          curvedLeaf(m, curve(0.22 + j * 0.3), dir, 0.05 + rng() * 0.035, 0.02, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.12, twist: sign * 0.15 });
        }
      }
    }
    // head: ring of petals + a yellow centre
    const top = curve(1);
    const petals = high ? 6 : low ? 5 : 6;
    const petalLen = 0.036 + rng() * 0.014;
    const petalPhase = rng() * TAU;
    const up = lean.clone().normalize();
    for (let p = 0; p < petals; p++) {
      const a = petalPhase + (p * TAU) / petals;
      const dir = V(Math.cos(a), 0.35 + rng() * 0.2, Math.sin(a)).normalize();
      const base = top.clone().addScaledVector(dir, petalLen * 0.12);
      const color = blend(pal.purple, pal.purpleLight, rng() * 0.5);
      if (low) foldedLeaf(m, base, dir, petalLen, petalLen * 0.7, color, { curl: 0.1, tipColor: pal.purpleLight });
      else curvedLeaf(m, base, dir, petalLen, petalLen * 0.72, color, { curl: 0.18, ridge: -0.05, tipColor: pal.purpleLight, planeNormal: up });
    }
    disc(m, top.clone().add(V(0, 0.004, 0)), up, petalLen * 0.28, low ? 4 : 6, pal.yellow, tone(pal.yellow, 0.8), 0.004);
  }
  if (!low) {
    const rosette = 4 + rng.int(0, 3);
    for (let l = 0; l < rosette; l++) {
      const a = phase + (l * TAU) / rosette + rng() * 0.4;
      const dir = V(Math.cos(a), 0.55 + rng() * 0.3, Math.sin(a)).normalize();
      curvedLeaf(m, V(Math.cos(a) * 0.02, 0.005, Math.sin(a) * 0.02), dir, 0.07 + rng() * 0.05, 0.035, tone(leafColor, 0.85 + rng() * 0.2), { curl: 0.2, ridge: 0.12 });
    }
  }
  return m.finish({ groundToZero: true });
}

/** Purple flower spikes (hyacinth / lupin-like): a stem carrying a column of small bells. */
export function flowerSpikeGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const low = detail === 'low';
  const stems = low ? 4 : 5 + rng.int(0, 4);
  const phase = rng() * TAU;
  const leafColor = blend(pal.leaf, pal.grassLight, 0.35);
  for (let i = 0; i < stems; i++) {
    const angle = phase + (i * TAU) / stems + (rng() - 0.5) * 0.5;
    const radius = 0.02 + rng() * 0.13;
    const root = V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const height = 0.26 + rng() * 0.2;
    const lean = V(Math.cos(angle) * height * 0.22, height, Math.sin(angle) * height * 0.22);
    const curve = (t: number) => root.clone().add(lean.clone().multiplyScalar(t)).add(V(Math.sin(angle + 1.1) * Math.sin(t * Math.PI) * 0.012, 0, Math.cos(angle + 1.1) * Math.sin(t * Math.PI) * 0.012));
    tube(m, sampleCurve(curve, low ? 2 : 3), 0.0026, 0.0014, pal.stem, 3);
    if (!low) {
      for (const sign of [-1, 1]) {
        const dir = V(Math.cos(angle + 0.9) * sign, 0.35, Math.sin(angle + 0.9) * sign);
        curvedLeaf(m, curve(0.18), dir, 0.07 + rng() * 0.04, 0.022, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.15, twist: sign * 0.2 });
      }
    }
    const bells = low ? 5 : 7 + rng.int(0, 4);
    const bellR = 0.016 + rng() * 0.006;
    for (let b = 0; b < bells; b++) {
      const t = 0.5 + (b / (bells - 1)) * 0.5;
      const c = curve(t);
      const a0 = rng() * TAU;
      const petals = low ? 3 : 4;
      const scale = 1 - 0.35 * Math.max(0, (t - 0.85) / 0.15);
      for (let p = 0; p < petals; p++) {
        const a = a0 + (p * TAU) / petals;
        const dir = V(Math.cos(a), -0.35 + rng() * 0.3, Math.sin(a)).normalize();
        const color = blend(pal.purple, pal.purpleLight, 0.2 + rng() * 0.5);
        if (low) foldedLeaf(m, c, dir, bellR * 1.6 * scale, bellR * 1.5 * scale, color, { curl: 0.2 });
        else curvedLeaf(m, c, dir, bellR * 1.7 * scale, bellR * 1.5 * scale, color, { curl: 0.3, ridge: -0.1, tipColor: pal.purpleLight });
      }
    }
    // terminal bud
    foldedLeaf(m, curve(1), lean.clone().normalize(), bellR * 1.4, bellR, blend(pal.purple, pal.purpleDeep, 0.3));
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- broad-leaf weeds (dock / plantain rosettes)
export function weedGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const leaves = high ? 5 + rng.int(0, 3) : 4;
  const phase = rng() * TAU;
  for (let l = 0; l < leaves; l++) {
    const a = phase + (l * TAU) / leaves + (rng() - 0.5) * 0.5;
    const lift = 0.35 + rng() * 0.45;
    const dir = V(Math.cos(a), lift, Math.sin(a)).normalize();
    const len = 0.12 + rng() * 0.12;
    const color = tone(blend(pal.weed, pal.leaf, rng() * 0.4), 0.85 + rng() * 0.3);
    const base = V(Math.cos(a) * 0.012, 0.004, Math.sin(a) * 0.012);
    if (high) lanceLeaf(m, base, dir, len, len * (0.36 + rng() * 0.14), color, { sections: 3, curl: 0.22 + rng() * 0.15, twist: (rng() - 0.5) * 0.4, ridge: 0.14, serration: 0.04 });
    else foldedLeaf(m, base, dir, len * 1.1, len * 0.45, color, { curl: 0.25, ridge: 0.12 });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- tall seed-head stalks
export function seedheadGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const stalks = high ? 3 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  const stalkColor = blend(pal.weed, pal.straw, 0.5);
  for (let s = 0; s < stalks; s++) {
    const a = phase + (s * TAU) / stalks + (rng() - 0.5) * 0.7;
    const r = 0.02 + rng() * 0.06;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.42 + rng() * 0.33;
    const lean = 0.08 + rng() * 0.16;
    const curve = (t: number) => root.clone().add(V(Math.cos(a) * lean * t * t, h * t, Math.sin(a) * lean * t * t));
    tube(m, sampleCurve(curve, high ? 3 : 2), 0.0022, 0.0012, stalkColor, 3);
    // seed spike
    const top = curve(1);
    const tipDir = V(Math.cos(a) * lean * 2, h, Math.sin(a) * lean * 2).normalize();
    const spike = [top, top.clone().addScaledVector(tipDir, 0.035), top.clone().addScaledVector(tipDir, 0.075)];
    tube(m, spike, 0.006, 0.002, blend(pal.straw, pal.bark, 0.25), 3, true);
    if (high) foldedLeaf(m, curve(0.35), V(-Math.sin(a), 0.55, Math.cos(a)), 0.11, 0.012, tone(pal.weed, 0.95), { curl: 0.2 });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- clover / sorrel ground cover
export function cloverGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const stems = high ? 4 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  const color = blend(pal.leaf, pal.grassLight, 0.45);
  for (let s = 0; s < stems; s++) {
    const a = phase + (s * TAU) / stems + (rng() - 0.5) * 0.6;
    const r = 0.015 + rng() * 0.05;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.04 + rng() * 0.05;
    const top = root.clone().add(V(Math.cos(a) * h * 0.3, h, Math.sin(a) * h * 0.3));
    if (high) tube(m, [root, top], 0.0012, 0.0008, pal.stem, 3);
    const size = 0.022 + rng() * 0.014;
    for (let l = 0; l < 3; l++) {
      const la = a + (l * TAU) / 3 + rng() * 0.3;
      const dir = V(Math.cos(la), 0.2 + (rng() - 0.5) * 0.3, Math.sin(la)).normalize();
      foldedLeaf(m, top, dir, size, size * 0.85, tone(color, 0.9 + rng() * 0.3), { curl: 0.12, ridge: 0.15 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- moss tufts
export function mossGeometry(seed: string, pal: PlantPalette): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const jitterTable = Array.from({ length: 512 }, () => rng());
  dome(m, 1, 0.38 + rng() * 0.12, 9, 3, tone(pal.mossDeep, 0.85), tone(pal.mossBright, 0.9), (i) => jitterTable[Math.abs(i) % 512]);
  return m.finish();
}

// ---------------------------------------------------------------- saplings
export function saplingGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const height = 1.3 + rng() * 0.9;
  const lean = V((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25);
  const trunk = (t: number) => lean.clone().multiplyScalar(t * t * height).add(V(0, t * height, 0));
  tube(m, sampleCurve(trunk, high ? 6 : 4), 0.022, 0.006, blend(pal.bark, [0.35, 0.33, 0.3], 0.35), high ? 5 : 3);
  const branches = high ? 5 : low ? 3 : 4;
  for (let b = 0; b < branches; b++) {
    const t = 0.45 + (b / branches) * 0.5;
    const a = rng() * TAU;
    const start = trunk(t);
    const dir = V(Math.cos(a), 0.35 + rng() * 0.3, Math.sin(a)).normalize();
    const reach = 0.3 + rng() * 0.25;
    const twig = (u: number) => start.clone().addScaledVector(dir, reach * u).add(V(0, Math.sin(u * Math.PI) * 0.03, 0));
    if (!low) tube(m, sampleCurve(twig, 3), 0.006, 0.0015, tone(pal.bark, 1.1), 3);
    const leaves = high ? 8 : low ? 4 : 6;
    for (let l = 0; l < leaves; l++) {
      const u = 0.15 + (l / (leaves - 1)) * 0.85;
      const side = l % 2 ? -1 : 1;
      const cross = V(-dir.z, 0, dir.x);
      const ld = cross.multiplyScalar(side * 0.7).addScaledVector(dir, 0.5).add(V(0, (rng() - 0.3) * 0.5, 0)).normalize();
      const len = (0.09 + rng() * 0.05) * (low ? 1.6 : 1);
      const color = tone(blend(pal.leaf, pal.leafSun, 0.3 + u * 0.4), 0.85 + rng() * 0.3);
      if (low) foldedLeaf(m, twig(u), ld, len, len * 0.6, color);
      else curvedLeaf(m, twig(u), ld, len, len * 0.6, color, { curl: 0.12, twist: (rng() - 0.5) * 0.5 });
    }
  }
  // crown tuft
  for (let l = 0; l < (low ? 3 : 5); l++) {
    const a = rng() * TAU;
    const ld = V(Math.cos(a), 0.6, Math.sin(a)).normalize();
    curvedLeaf(m, trunk(1), ld, 0.1, 0.06, tone(pal.leafSun, 0.95 + rng() * 0.1), { curl: 0.15 });
  }
  return m.finish({ groundToZero: true });
}

/** Build `count` variants × all LODs. */
export function variants(count: number, seed: string, pal: PlantPalette, build: (seed: string, pal: PlantPalette, detail: Detail) => BufferGeometry, lods: Detail[] = DETAILS): BufferGeometry[][] {
  const out: BufferGeometry[][] = [];
  for (let v = 0; v < count; v++) out.push(lods.map((d) => build(`${seed}/${v}`, pal, d)));
  return out;
}

export function maxHeight(geos: BufferGeometry[][]): number {
  let h = 0;
  for (const row of geos) for (const g of row) h = Math.max(h, g.boundingBox?.max.y ?? 1);
  return h;
}

export type { Rng };
