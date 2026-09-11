/**
 * Character palette + shared materials. Reference colours (reference/ANALYSIS.md §9/§10) are
 * post-haze display values; albedos here are ≈ 1.25–1.4× brighter so the graded, hazed frame lands
 * on the measured swatch (same convention as `config.ts`'s world palette).
 */
import { CanvasTexture, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';

export const CHAR_COLORS = {
  /** reference `#50542f` */
  tunic: 0x596832,
  tunicCollar: 0x68763a,
  clothThread: 0x929866,
  leatherStitch: 0xa38c5d,
  /** the pale undershirt showing at the collar, slightly warm so it does not blow out */
  undershirt: 0xe6dfcc,
  /** reference `#433825` */
  leather: 0x54462d,
  leatherDark: 0x3e3221,
  packLeather: 0x765738,
  buckle: 0xc4a25c,
  /** reference `#624d33` lit / `#533a21` shade: saturated leather brown, tan fold-over cuff `#876849` */
  boot: 0x6b4a2c,
  bootCuff: 0x957852,
  linkBootCuff: 0x81613f,
  sole: 0x2c2118,
  /** reference `#828450` (lighter than the tunic) */
  cap: 0x6f7c40,
  capBrim: 0x626e3a,
  /** reference `#865f2e` — the fringe reads golden-blond in the frames; kept a clear hue step from the skin */
  hair: 0xcf9c38,
  hairShade: 0x8c6630,
  /** reference `#87613e` hazed / `#be8556` in the 14 s sunlight: warm tan, a clear hue step from the hair */
  skin: 0xbe8a5e,
  /** Owner's hero turnaround: softer warm skin, separate from the existing NPC palette. */
  linkSkin: 0xd8ac88,
  eyeWhite: 0xf2f0ea,
  iris: 0x3268b8,
  irisKid: 0x5a3a22,
  pupil: 0x101214,
  brow: 0x7a5a2a,
  mouth: 0x6b3f30,
  shieldWood: 0x8a6538,
  shieldRim: 0x4f3a20,
  swordGrip: 0x2f3a4a,
  swordGuard: 0xc0a05a,
  steel: 0xb9bcc0,
  scabbard: 0x4a3521,
  stick: 0x7a5a38,
  /** Kokiri kids: reference `#1e2012` tunic, `#60402c` hair */
  kidTunic: 0x2a2e18,
  kidRope: 0xb59b6a,
  kidBoot: 0x2b2118,
  kidHair: 0x7a5236,
  kidHeadband: 0x5f7a3a,
  kidSkin: 0xb28058,
} as const;

export type CharColorKey = keyof typeof CHAR_COLORS;

const cache = new Map<string, MeshStandardMaterial>();
let weave: DataTexture | undefined;

/** Original blue-green iris pigment, using the clipped eye disc's radial UVs. */
export function linkIris(): MeshStandardMaterial {
  const id = 'link-radial-iris';
  const existing = cache.get(id);
  if (existing) return existing;
  const size = 128, data = new Uint8Array(size * size * 4);
  const smooth = (a: number, b: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const radius = Math.hypot(u, v), angle = Math.atan2(v, u);
    // Integer angular frequencies meet seamlessly; no random state or baked highlights.
    const fibre = 0.5 + 0.25 * Math.sin(angle * 61 + radius * 5 + 0.2 * Math.sin(angle * 11))
      + 0.15 * Math.sin(angle * 103 - radius * 8) + 0.10 * Math.sin(angle * 29 + radius * 13);
    const inner = Math.exp(-(((radius - 0.64) / 0.055) ** 2));
    const edge = smooth(0.85, 0.99, radius);
    const pigment = [54 + 28 * fibre + 8 * inner, 114 + 39 * fibre + 4 * inner, 147 + 35 * fibre - 9 * inner];
    const rim = [24, 51, 65], i = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.round(pigment[channel] * (1 - edge) + rim[channel] * edge);
    data[i + 3] = 255;
  }
  const texture = new DataTexture(data, size, size);
  texture.name = 'original-link-blue-green-iris'; texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true; texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter; texture.needsUpdate = true;
  const material = new MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.6, metalness: 0 });
  material.name = id;
  cache.set(id, material);
  return material;
}

/** Original strand variation; U follows each lock and V runs across its fibres. */
export function linkHair(): MeshStandardMaterial {
  const id = 'link-strand-hair';
  const existing = cache.get(id);
  if (existing) return existing;
  const width = 64, height = 512;
  const colour = new Uint8Array(width * height * 4), relief = new Uint8Array(colour.length);
  const tau = Math.PI * 2;
  const strands = 71;
  const seed = (index: number, salt: number) => {
    const n = ((index % strands) + strands) % strands;
    return ((n * 37 + n * n * 11 + salt * 53) % 101) / 100;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height, i = (y * width + x) * 4;
    let fibre = 0;
    const cell = Math.floor(v * strands);
    for (let j = cell - 1; j <= cell + 1; j++) {
      const centre = j + 0.5 + 0.42 * (seed(j, 1) - 0.5)
        + 0.12 * Math.sin(tau * u + tau * seed(j, 2));
      const distance = (v * strands - centre) / (0.11 + 0.08 * seed(j, 3));
      fibre += (0.65 + 0.35 * seed(j, 4)) * Math.exp(-distance * distance);
    }
    const fine = 0.5 + 0.5 * Math.sin(tau * (123 * v + 0.10 * Math.sin(tau * u + 0.8)));
    const broad = 0.5 + 0.5 * Math.sin(tau * (7 * v + 0.04 * Math.sin(tau * u + 1.1)));
    const value = Math.round(255 * (0.92 + 0.045 * fibre + 0.01 * fine + 0.015 * broad));
    const heightValue = Math.round(255 * (0.40 + 0.20 * fibre + 0.05 * fine));
    colour[i] = colour[i + 1] = colour[i + 2] = value; colour[i + 3] = 255;
    relief[i] = relief[i + 1] = relief[i + 2] = heightValue; relief[i + 3] = 255;
  }
  const makeTexture = (data: Uint8Array, name: string, isColour: boolean) => {
    const texture = new DataTexture(data, width, height);
    texture.name = name;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    if (isColour) texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = true; texture.minFilter = LinearMipmapLinearFilter;
    texture.needsUpdate = true;
    return texture;
  };
  const material = matte('hair').clone();
  material.name = id; material.roughness = 0.72;
  material.map = makeTexture(colour, 'original-link-hair-strand-colour', true);
  material.bumpMap = makeTexture(relief, 'original-link-hair-strand-relief', false);
  material.bumpScale = 0.00016;
  cache.set(id, material);
  return material;
}

/** Sub-millimetre authored weave; mipmapped so it softens naturally at gameplay distance. */
export function cloth(key: 'tunic' | 'tunicCollar' | 'cap' | 'capBrim'): MeshStandardMaterial {
  const id = `cloth-${key}`;
  const existing = cache.get(id);
  if (existing) return existing;
  if (!weave) {
    const size = 64, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const thread = Math.sin(x * Math.PI / 2) * Math.cos(y * Math.PI / 2);
      const grain = ((x * 13 + y * 29 + x * y * 7) % 17) / 16 - 0.5;
      data[i] = data[i + 1] = data[i + 2] = Math.round(128 + 26 * thread + 8 * grain);
      data[i + 3] = 255;
    }
    weave = new DataTexture(data, size, size);
    weave.name = 'original-character-cloth-weave';
    weave.wrapS = weave.wrapT = RepeatWrapping;
    weave.repeat.set(5, 5);
    weave.generateMipmaps = true; weave.minFilter = LinearMipmapLinearFilter;
    weave.needsUpdate = true;
  }
  const material = matte(key).clone();
  material.name = id; material.roughness = 0.97;
  material.bumpMap = weave; material.bumpScale = 0.0007;
  cache.set(id, material);
  return material;
}

/**
 * Shared matte MeshStandardMaterial per colour key (fog-compatible: the atmosphere patches the fog
 * chunks globally). The reference characters are soft and matte, so roughness defaults to 0.9 and
 * metalness stays 0 (metal-looking trim is done with colour alone).
 */
export function matte(key: CharColorKey, opts: { roughness?: number } = {}): MeshStandardMaterial {
  const roughness = Math.max(0.6, opts.roughness ?? 0.9);
  const id = `${key}|${roughness}`;
  let m = cache.get(id);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(CHAR_COLORS[key]), roughness, metalness: 0 });
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
  g.fillStyle = '#85633c';
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
  // dark-red painted swirl filling most of the face: a fat spiral (≈ 2 turns) whose stroke widens
  // outward, with a darker edge and a faint worn highlight along the middle
  const cx = size / 2;
  const cy = size / 2;
  const spiral = (r0: number, r1: number, turns: number, w0: number, w1: number, color: string) => {
    g.strokeStyle = color;
    g.lineCap = 'round';
    const steps = 200;
    let px = 0;
    let py = 0;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = u * turns * Math.PI * 2 - Math.PI * 0.5;
      const r = r0 + (r1 - r0) * Math.pow(u, 1.15);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 1.04;
      if (i > 0) {
        g.lineWidth = w0 + (w1 - w0) * u;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(x, y);
        g.stroke();
      }
      px = x;
      py = y;
    }
  };
  spiral(3, 96, 2.05, 16, 34, 'rgba(60,14,8,0.95)');
  spiral(3, 96, 2.05, 10, 26, '#7a2418');
  spiral(3, 96, 2.05, 3, 7, 'rgba(170,70,45,0.3)');
  // Restrained hand-worn nicks; the new shield geometry supplies its own shaped bevel.
  for (let i = 0; i < 34; i++) {
    const x = 11 + ((i * 67) % 234), y = 9 + ((i * 43) % 237);
    g.strokeStyle = i % 3 ? 'rgba(176,143,94,0.28)' : 'rgba(40,26,13,0.24)';
    g.lineWidth = 0.6 + (i % 3) * 0.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y + 3 + i % 7); g.stroke();
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.name = 'character-deku-shield';
  return tex;
}

/** Thin horizontal sparkle streak (bright centre fading to both tips) for Navi's 4-point star. */
export function streakTexture(): CanvasTexture {
  const w = 128;
  const h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2;
      const v = Math.abs(y / (h - 1) - 0.5) * 2;
      const along = Math.pow(1 - u, 2.2);
      const across = Math.max(0, 1 - v / Math.max(0.15, 1 - u * 0.9));
      const a = along * across * across;
      const i = (y * w + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 250;
      img.data[i + 2] = 240;
      img.data[i + 3] = Math.round(255 * Math.min(1, a));
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.name = 'character-navi-streak';
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

/**
 * Fairy "ear" wing for a billboard sprite: an upright leaf/petal, root at the bottom-centre,
 * widest at 40 % height, pointed tip, blown-out white core with a soft pale-blue edge.
 */
export function fairyWingTexture(): CanvasTexture {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = 1 - y / (h - 1); // 0 at the root (bottom), 1 at the tip
      const u = (x / (w - 1) - 0.5) * 2;
      // leaf half-width: opens fast from the root, peaks at v ≈ 0.4, closes to a point at the tip
      const halfWidth = 0.92 * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, v), 0.75)), 0.8);
      const edge = (halfWidth - Math.abs(u)) / 0.16;
      const inside = Math.min(1, Math.max(0, edge));
      const core = Math.min(1, Math.max(0, (halfWidth * 0.55 - Math.abs(u)) / 0.3));
      const a = inside * (0.55 + 0.45 * core);
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(225 + 30 * core);
      img.data[i + 1] = Math.round(240 + 15 * core);
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(255 * a);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.name = 'character-navi-fairy-wing';
  return tex;
}
