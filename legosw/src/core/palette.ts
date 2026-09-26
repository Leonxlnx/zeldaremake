import {
  CanvasTexture,
  Color,
  DoubleSide,
  FrontSide,
  LinearSRGBColorSpace,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  type Material,
  type Texture,
} from 'three';
import { Rng } from './rng';

/**
 * The LEGO colour palette (sRGB, close to the official / LDraw values) and the ABS plastic
 * materials. Every part of every model is one of these keys, so the whole film shares ~40
 * materials and colour-merged geometry keeps draw calls low.
 */
type Kind = 'solid' | 'slope' | 'trans' | 'metal' | 'glow' | 'rubber';
interface Swatch {
  hex: number;
  kind: Kind;
  rough?: number;
  op?: number;
  glow?: number;
}

export const LEGO = {
  white: { hex: 0xf4f4f1, kind: 'solid' },
  lbg: { hex: 0xa3a8ab, kind: 'solid' },
  dbg: { hex: 0x62666a, kind: 'solid' },
  pearlDarkGray: { hex: 0x575857, kind: 'metal', rough: 0.42 },
  black: { hex: 0x1a1d21, kind: 'solid' },
  red: { hex: 0xc1150b, kind: 'solid' },
  darkRed: { hex: 0x720e0f, kind: 'solid' },
  yellow: { hex: 0xf7c21a, kind: 'solid' },
  brightLightOrange: { hex: 0xf8ab2f, kind: 'solid' },
  orange: { hex: 0xf67f13, kind: 'solid' },
  darkOrange: { hex: 0xa0500f, kind: 'solid' },
  blue: { hex: 0x1350b4, kind: 'solid' },
  darkBlue: { hex: 0x0e2d57, kind: 'solid' },
  mediumAzure: { hex: 0x36aebf, kind: 'solid' },
  sandBlue: { hex: 0x5f7497, kind: 'solid' },
  sandGreen: { hex: 0x8fb09b, kind: 'solid' },
  darkGreen: { hex: 0x184632, kind: 'solid' },
  tan: { hex: 0xe0c796, kind: 'solid' },
  darkTan: { hex: 0x958a73, kind: 'solid' },
  reddishBrown: { hex: 0x5a3120, kind: 'solid' },
  darkBrown: { hex: 0x352617, kind: 'solid' },
  lightNougat: { hex: 0xf6d7b3, kind: 'solid' },
  hairAnakin: { hex: 0x5e3217, kind: 'solid' },
  hairObiwan: { hex: 0x8e4a1c, kind: 'solid' },
  mediumNougat: { hex: 0xb07f55, kind: 'solid' },
  flatSilver: { hex: 0x9c9d9f, kind: 'metal', rough: 0.34 },
  metalSilver: { hex: 0xc8ccd2, kind: 'metal', rough: 0.2 },
  pearlGold: { hex: 0xc4953a, kind: 'metal', rough: 0.3 },
  gunmetal: { hex: 0x3b3e42, kind: 'metal', rough: 0.38 },
  rubberBlack: { hex: 0x15171a, kind: 'rubber', rough: 0.62 },
  slopeLbg: { hex: 0xa3a8ab, kind: 'slope' },
  slopeDbg: { hex: 0x62666a, kind: 'slope' },
  slopeWhite: { hex: 0xf4f4f1, kind: 'slope' },
  slopeTan: { hex: 0xe0c796, kind: 'slope' },
  slopeBlack: { hex: 0x1a1d21, kind: 'slope' },
  trClear: { hex: 0xf4f8ff, kind: 'trans', op: 0.16 },
  trBlack: { hex: 0x3e3a33, kind: 'trans', op: 0.62 },
  trSmoke: { hex: 0x6e7174, kind: 'trans', op: 0.42 },
  trLightBlue: { hex: 0xaef0f0, kind: 'trans', op: 0.45 },
  trBlue: { hex: 0x1b48c8, kind: 'trans', op: 0.55 },
  trRed: { hex: 0xd01010, kind: 'trans', op: 0.6 },
  trOrange: { hex: 0xf08a1c, kind: 'trans', op: 0.6 },
  trYellow: { hex: 0xf5d52f, kind: 'trans', op: 0.55 },
  trGreen: { hex: 0x44c46a, kind: 'trans', op: 0.55 },
  glowOrange: { hex: 0xff8a3a, kind: 'glow', glow: 7 },
  glowEngine: { hex: 0xffb0a0, kind: 'glow', glow: 9 },
  glowBlue: { hex: 0x5ab8ff, kind: 'glow', glow: 7 },
  glowCyan: { hex: 0x9ff6ff, kind: 'glow', glow: 6 },
  glowRed: { hex: 0xff2a1a, kind: 'glow', glow: 7 },
  glowWhite: { hex: 0xfff3dd, kind: 'glow', glow: 5 },
  glowYellow: { hex: 0xffd66a, kind: 'glow', glow: 5 },
  glowGreen: { hex: 0x5cff7a, kind: 'glow', glow: 6 },
  windowWarm: { hex: 0xffd9a0, kind: 'glow', glow: 2.2 },
  windowCool: { hex: 0xcfe6ff, kind: 'glow', glow: 2.0 },
} satisfies Record<string, Swatch>;

export type ColorKey = keyof typeof LEGO;

export function swatch(key: ColorKey): Swatch {
  return LEGO[key] as Swatch;
}

export function isTransparent(key: ColorKey): boolean {
  return swatch(key).kind === 'trans';
}

/** Shared quality switches (set once before any material is created). */
export const MATERIAL_QUALITY = { clearcoat: true };

let roughTex: Texture | null = null;

/**
 * ABS surface micro-variation: faint fingerprints, swirl marks and hairline scratches in the
 * roughness channel. Box-projected by the builder so every brick gets its own patch.
 */
export function plasticRoughnessTexture(): Texture {
  if (roughTex) return roughTex;
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const img = g.createImageData(N, N);
  const rng = new Rng(4242);
  // low-frequency smudges: sum of a few soft blobs, tiled
  const blobs = Array.from({ length: 26 }, () => ({ x: rng.next() * N, y: rng.next() * N, r: rng.range(30, 120), a: rng.range(-0.1, 0.12) }));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0.66;
      for (const b of blobs) {
        let dx = Math.abs(x - b.x);
        let dy = Math.abs(y - b.y);
        dx = Math.min(dx, N - dx);
        dy = Math.min(dy, N - dy);
        const d2 = (dx * dx + dy * dy) / (b.r * b.r);
        if (d2 < 4) v += b.a * Math.exp(-d2 * 1.6);
      }
      v += (rng.next() - 0.5) * 0.05;
      const i = (y * N + x) * 4;
      const q = Math.max(0, Math.min(255, v * 255));
      img.data[i] = q;
      img.data[i + 1] = q;
      img.data[i + 2] = q;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // hairline scratches
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 90; k++) {
    const x = rng.next() * N;
    const y = rng.next() * N;
    const a = rng.next() * Math.PI;
    const len = rng.range(10, 70);
    g.strokeStyle = `rgba(40,40,40,${rng.range(0.25, 0.6)})`;
    g.lineWidth = rng.range(0.5, 1.2);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rng.range(-6, 6), y + Math.sin(a) * len * 0.5 + rng.range(-6, 6), x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  roughTex = t;
  return t;
}

const cache = new Map<string, Material>();

export function glowColor(key: ColorKey, scale = 1): Color {
  const s = swatch(key);
  return new Color(s.hex).multiplyScalar((s.glow ?? 1) * scale);
}

/**
 * The material for a palette key. `vertexColors` is on for everything the builder makes (the
 * per-brick tint lives in the colour attribute); `plain` variants are for hand-made meshes.
 */
export function mat(key: ColorKey, opts: { plain?: boolean; doubleSide?: boolean } = {}): Material {
  const id = `${key}|${opts.plain ? 'p' : 'v'}|${opts.doubleSide ? 'd' : 's'}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const s = swatch(key);
  const vertexColors = !opts.plain;
  const side = opts.doubleSide ? DoubleSide : FrontSide;
  let m: Material;
  switch (s.kind) {
    case 'glow': {
      m = new MeshBasicMaterial({ color: glowColor(key), vertexColors, side, toneMapped: false, fog: false });
      break;
    }
    case 'trans': {
      m = new MeshPhysicalMaterial({
        color: s.hex,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: s.op ?? 0.4,
        depthWrite: false,
        side: DoubleSide,
        vertexColors,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.6,
      });
      break;
    }
    case 'metal': {
      m = new MeshStandardMaterial({ color: s.hex, roughness: s.rough ?? 0.3, metalness: 0.92, vertexColors, side, envMapIntensity: 1.25 });
      break;
    }
    case 'rubber': {
      m = new MeshStandardMaterial({ color: s.hex, roughness: s.rough ?? 0.6, metalness: 0, vertexColors, side });
      break;
    }
    case 'slope': {
      // the textured top of a slope brick: same colour, satin finish
      m = new MeshStandardMaterial({ color: s.hex, roughness: 0.62, metalness: 0, vertexColors, side, roughnessMap: plasticRoughnessTexture() });
      break;
    }
    default: {
      const rough = plasticRoughnessTexture();
      if (MATERIAL_QUALITY.clearcoat) {
        m = new MeshPhysicalMaterial({
          color: s.hex,
          roughness: 0.5,
          roughnessMap: rough,
          metalness: 0,
          vertexColors,
          side,
          clearcoat: 0.55,
          clearcoatRoughness: 0.14,
          envMapIntensity: 1.0,
        });
      } else {
        m = new MeshStandardMaterial({ color: s.hex, roughness: 0.42, roughnessMap: rough, metalness: 0, vertexColors, side });
      }
    }
  }
  m.name = `lego:${key}`;
  cache.set(id, m);
  return m;
}

/** Linear-space colour of a key (for shaders / lights). */
export function linearColor(key: ColorKey): Color {
  const c = new Color(swatch(key).hex);
  return c;
}

export { LinearSRGBColorSpace };
