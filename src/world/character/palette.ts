/**
 * Character palette + shared materials. Reference colours (reference/ANALYSIS.md §9/§10) are
 * post-haze display values; albedos here are ≈ 1.25–1.4× brighter so the graded, hazed frame lands
 * on the measured swatch (same convention as `config.ts`'s world palette).
 */
import { CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace } from 'three';

export const CHAR_COLORS = {
  /** reference `#50542f` */
  tunic: 0x5c6a33,
  tunicCollar: 0x6b7a3c,
  undershirt: 0xd9cfb4,
  /** reference `#433825` */
  leather: 0x54462d,
  leatherDark: 0x3e3221,
  buckle: 0xb0925a,
  /** reference `#624d33` */
  boot: 0x745b3c,
  bootCuff: 0xa88f66,
  /** reference `#828450` (lighter than the tunic) */
  cap: 0x8e9457,
  capBrim: 0x7c8149,
  /** reference `#865f2e` */
  hair: 0xa3742f,
  hairShade: 0x8c6630,
  /** reference `#87613e` */
  skin: 0xa67d58,
  eyeWhite: 0xf2f0ea,
  iris: 0x3d78c8,
  irisKid: 0x5a3a22,
  pupil: 0x101214,
  brow: 0x7a5a2a,
  mouth: 0x6b3f30,
  shieldWood: 0x8a6538,
  shieldRim: 0x5e4426,
  swordGrip: 0x2f3a4a,
  swordGuard: 0xc0a05a,
  steel: 0xb9bcc0,
  scabbard: 0x4a3521,
  /** Kokiri kids: reference `#1e2012` tunic, `#60402c` hair */
  kidTunic: 0x2a2e18,
  kidRope: 0xb59b6a,
  kidBoot: 0x2b2118,
  kidHair: 0x7a5236,
  kidHeadband: 0x5f7a3a,
  kidSkin: 0xa47a55,
} as const;

export type CharColorKey = keyof typeof CHAR_COLORS;

const cache = new Map<string, MeshStandardMaterial>();

/** Shared matte MeshStandardMaterial per colour key (fog-compatible: the atmosphere patches the fog chunks globally). */
export function matte(key: CharColorKey, opts: { roughness?: number; metalness?: number } = {}): MeshStandardMaterial {
  const id = `${key}|${opts.roughness ?? 0.85}|${opts.metalness ?? 0}`;
  let m = cache.get(id);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(CHAR_COLORS[key]), roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0 });
    m.name = `char-${key}`;
    cache.set(id, m);
  }
  return m;
}

/**
 * Deku Shield face: wood grain with the orange-red swirl. Drawn once on a small canvas — an
 * original design, not a copy of any game texture.
 */
export function shieldTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#8a6538';
  g.fillRect(0, 0, size, size);
  // grain: vertical-ish wavy dark lines
  for (let i = 0; i < 26; i++) {
    const x = (i / 26) * size + 4;
    g.strokeStyle = i % 3 === 0 ? 'rgba(60,38,18,0.45)' : 'rgba(70,46,22,0.25)';
    g.lineWidth = 1.2 + (i % 4) * 0.5;
    g.beginPath();
    for (let y = 0; y <= size; y += 8) {
      const wob = Math.sin(y * 0.05 + i * 1.7) * 4 + Math.sin(y * 0.13 + i) * 1.5;
      if (y === 0) g.moveTo(x + wob, y);
      else g.lineTo(x + wob, y);
    }
    g.stroke();
  }
  // orange-red swirl (spiral), thick stroke with a darker outline
  const cx = size / 2;
  const cy = size / 2;
  const spiral = (r0: number, r1: number, turns: number, w: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    const steps = 180;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = u * turns * Math.PI * 2;
      const r = r0 + (r1 - r0) * u;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 1.05;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  };
  spiral(4, 78, 2.15, 22, 'rgba(90,30,14,0.9)');
  spiral(4, 78, 2.15, 15, '#c8502a');
  spiral(4, 78, 2.15, 5, 'rgba(240,140,70,0.55)');
  // rim darkening
  const grad = g.createRadialGradient(cx, cy, size * 0.3, cx, cy, size * 0.5);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(30,18,8,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.name = 'character-deku-shield';
  return tex;
}

/** Soft radial glow for Navi's halo. */
export function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(225,245,255,0.75)');
  grad.addColorStop(0.45, 'rgba(150,215,255,0.22)');
  grad.addColorStop(1, 'rgba(120,200,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.name = 'character-navi-glow';
  return tex;
}

/** Translucent dragonfly wing (teardrop with veins), root at the left edge. */
export function wingTexture(): CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const v = y / (h - 1) - 0.5;
      const halfWidth = 0.5 * Math.sqrt(Math.max(1 - u, 0)) * (0.5 + 0.5 * (1 - u)) * (1 - Math.exp(-u * 30));
      const inside = 1 - Math.min(1, Math.max(0, (Math.abs(v) - halfWidth + 0.06) / 0.06));
      const vein = 0.5 + 0.5 * Math.sin(Math.abs(v) * 30 - u * 12);
      const a = inside * (0.45 + 0.35 * vein) * (1 - 0.45 * u);
      const i = (y * w + x) * 4;
      img.data[i] = 220;
      img.data[i + 1] = 245;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * Math.min(1, a));
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.name = 'character-navi-wing';
  return tex;
}
