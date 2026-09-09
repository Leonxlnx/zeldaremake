/**
 * Materials for the structures system. PBR sets come from Poly Haven (CC0) via the shared
 * texture library; small detail textures (heart leaves, grass tufts, carved runes, lantern
 * glow gradient) are generated on a canvas so nothing external is needed for them.
 */
import {
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { WorldContext } from '../system';
import { WIND_GLSL } from '../wind/wind';

export interface StructureMaterials {
  /** house trunk + roots (bark_brown_02, warm tint) */
  bark: MeshStandardMaterial;
  /** pale living branches over the roofs (bark_willow_02) */
  barkPale: MeshStandardMaterial;
  /** log arch outer bark (bark_willow_02, greyer, mossy vertex tint) */
  logBark: MeshStandardMaterial;
  /** hollow interiors seen from inside */
  interior: MeshStandardMaterial;
  /** thatch + moss dome (vertex colours drive the moss gradient) */
  roof: MeshStandardMaterial;
  /** weathered planks: signpost, fences, door frames, thresholds */
  wood: MeshStandardMaterial;
  /** darker wood for door frames / lantern hooks */
  woodDark: MeshStandardMaterial;
  /** warm emissive interior planes (hearth, shelves) */
  hearth: MeshBasicMaterial;
  /** warm window glow disc */
  windowGlow: MeshBasicMaterial;
  /**
   * Pod lantern (body + cap + stem + cord in one draw): emissive gradient texture, brighter at
   * the bottom; UV v ≥ LANTERN_DARK_V is black so caps and cords do not glow. Vertex colours tint.
   */
  lantern: MeshStandardMaterial;
  /** heart-shaped leaf cards, wind-animated (aPhase/aAmount attributes) */
  leaf: MeshStandardMaterial;
  /** vine stems, wind-animated */
  vine: MeshStandardMaterial;
  /** grass tufts + fern fronds on roofs and the log, wind-animated */
  tuft: MeshStandardMaterial;
  /** moss cushions (vertex colours) */
  moss: MeshStandardMaterial;
  /** carved rune decal for the signpost plank */
  runes: MeshStandardMaterial;
  /** dark splintered end-grain */
  endGrain: MeshStandardMaterial;
  /** number of materials that ended up with real texture files */
  texturedSets: string[];
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function finishTexture(tex: Texture, srgb: boolean, name: string): Texture {
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.name = name;
  tex.needsUpdate = true;
  return tex;
}

/** Heart-shaped leaf with a pale central vein; stem notch at the top (v = 1), tip at the bottom. */
export function heartLeafTexture(): Texture {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.clearRect(0, 0, S, S);
  const cx = S / 2;
  // heart outline: two lobes at the top, point at the bottom
  g.beginPath();
  g.moveTo(cx, S * 0.16);
  g.bezierCurveTo(cx + S * 0.05, S * 0.02, cx + S * 0.5, S * 0.02, cx + S * 0.47, S * 0.34);
  g.bezierCurveTo(cx + S * 0.45, S * 0.62, cx + S * 0.12, S * 0.82, cx, S * 0.985);
  g.bezierCurveTo(cx - S * 0.12, S * 0.82, cx - S * 0.45, S * 0.62, cx - S * 0.47, S * 0.34);
  g.bezierCurveTo(cx - S * 0.5, S * 0.02, cx - S * 0.05, S * 0.02, cx, S * 0.16);
  g.closePath();
  const grad = g.createRadialGradient(cx, S * 0.4, S * 0.05, cx, S * 0.45, S * 0.55);
  grad.addColorStop(0, '#b4e06c');
  grad.addColorStop(0.55, '#86bb4a');
  grad.addColorStop(1, '#5c9236');
  g.fillStyle = grad;
  g.fill();
  g.save();
  g.clip();
  // veins
  g.strokeStyle = 'rgba(214, 236, 160, 0.75)';
  g.lineWidth = S * 0.02;
  g.beginPath();
  g.moveTo(cx, S * 0.16);
  g.lineTo(cx, S * 0.97);
  g.stroke();
  g.lineWidth = S * 0.011;
  g.strokeStyle = 'rgba(214, 236, 160, 0.5)';
  for (let i = 0; i < 5; i++) {
    const y = S * (0.28 + i * 0.13);
    g.beginPath();
    g.moveTo(cx, y);
    g.quadraticCurveTo(cx + S * 0.2, y + S * 0.06, cx + S * 0.4, y + S * 0.16 - i * S * 0.03);
    g.moveTo(cx, y);
    g.quadraticCurveTo(cx - S * 0.2, y + S * 0.06, cx - S * 0.4, y + S * 0.16 - i * S * 0.03);
    g.stroke();
  }
  // slight darker edge
  g.restore();
  g.lineWidth = S * 0.012;
  g.strokeStyle = 'rgba(40, 70, 25, 0.6)';
  g.stroke();
  return finishTexture(new CanvasTexture(c), true, 'structures:heart-leaf');
}

/** Atlas: left half grass tuft, right half fern frond. Alpha in the shape. */
export function tuftTexture(): Texture {
  const W = 512;
  const H = 256;
  const { c, g } = canvas(W, H);
  g.clearRect(0, 0, W, H);
  // grass tuft
  const bx = W * 0.25;
  const by = H * 0.98;
  for (let i = 0; i < 15; i++) {
    const a = ((i / 14 - 0.5) * 1.5 + (Math.sin(i * 12.9) * 0.08)) as number;
    const len = H * (0.62 + 0.3 * Math.abs(Math.sin(i * 3.3)));
    const tipx = bx + Math.sin(a) * len;
    const tipy = by - Math.cos(a) * len;
    const w = W * 0.014;
    const shade = 0.75 + 0.25 * Math.sin(i * 1.7);
    g.fillStyle = `rgb(${Math.round(120 * shade)}, ${Math.round(165 * shade)}, ${Math.round(70 * shade)})`;
    g.beginPath();
    g.moveTo(bx - w, by);
    g.quadraticCurveTo(bx + Math.sin(a) * len * 0.5 - w * 0.5, by - Math.cos(a) * len * 0.5 - H * 0.05, tipx, tipy);
    g.quadraticCurveTo(bx + Math.sin(a) * len * 0.5 + w * 0.5, by - Math.cos(a) * len * 0.5 - H * 0.02, bx + w, by);
    g.closePath();
    g.fill();
  }
  // fern frond: central stem + paired leaflets, base at the bottom centre of the right half
  const fx = W * 0.75;
  const fy = H * 0.98;
  const fl = H * 0.9;
  g.strokeStyle = '#5a7a34';
  g.lineWidth = W * 0.008;
  g.beginPath();
  g.moveTo(fx, fy);
  g.quadraticCurveTo(fx + W * 0.03, fy - fl * 0.5, fx + W * 0.06, fy - fl);
  g.stroke();
  const pairs = 13;
  for (let i = 0; i < pairs; i++) {
    const t = 0.08 + (i / pairs) * 0.9;
    const sx = fx + W * 0.03 * 2 * t * (1 - t) + W * 0.06 * t * t;
    const sy = fy - fl * t;
    const len = W * 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + W * 0.02;
    for (const side of [-1, 1]) {
      const shade = 0.8 + 0.2 * Math.sin(i * 2.1 + side);
      g.fillStyle = `rgb(${Math.round(92 * shade)}, ${Math.round(150 * shade)}, ${Math.round(66 * shade)})`;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + side * len * 0.5, sy - len * 0.35, sx + side * len, sy - len * 0.25);
      g.quadraticCurveTo(sx + side * len * 0.5, sy + len * 0.05, sx, sy + len * 0.06);
      g.closePath();
      g.fill();
      // serration
      g.strokeStyle = 'rgba(30, 60, 20, 0.35)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  return finishTexture(new CanvasTexture(c), true, 'structures:tuft-fern');
}

/**
 * Straw colour map for the moss/thatch roofs: fine slightly-curved stalks with brightness
 * variation around a light neutral mean, so the vertex colours (moss ↔ straw gradient) set the
 * hue while the Poly Haven thatch normal map supplies the fibre relief. Deterministic.
 */
export function strawTexture(seedRng: () => number): Texture {
  const S = 512;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#b9ae94';
  g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  // long stalks
  for (let i = 0; i < 1400; i++) {
    const x = seedRng() * S;
    const y = seedRng() * S;
    const len = S * (0.08 + seedRng() * 0.22);
    const lean = (seedRng() - 0.5) * 0.5;
    const shade = 0.62 + seedRng() * 0.55;
    const v = Math.round(190 * shade);
    g.strokeStyle = `rgba(${Math.min(255, v + 12)}, ${Math.min(255, v + 4)}, ${Math.round(v * 0.82)}, ${0.35 + seedRng() * 0.4})`;
    g.lineWidth = 1 + seedRng() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + lean * len * 0.5 + (seedRng() - 0.5) * 6, y + len * 0.5, x + lean * len, y + len);
    g.stroke();
    // wrap vertically so the tile repeats cleanly
    if (y + len > S) {
      g.beginPath();
      g.moveTo(x, y - S);
      g.quadraticCurveTo(x + lean * len * 0.5, y - S + len * 0.5, x + lean * len, y - S + len);
      g.stroke();
    }
  }
  // dark gaps + small bright flecks
  for (let i = 0; i < 900; i++) {
    const x = seedRng() * S;
    const y = seedRng() * S;
    const dark = seedRng() < 0.6;
    g.fillStyle = dark ? `rgba(60, 50, 30, ${0.15 + seedRng() * 0.25})` : `rgba(255, 245, 210, ${0.15 + seedRng() * 0.25})`;
    g.beginPath();
    g.ellipse(x, y, 1 + seedRng() * 2.5, 3 + seedRng() * 9, (seedRng() - 0.5) * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  return finishTexture(new CanvasTexture(c), true, 'structures:straw');
}

/** UV v above this row of the lantern gradient is black (caps, stems, cords). */
export const LANTERN_DARK_V = 0.86;

/** Emissive gradient for pod lanterns: bright at the bottom (v = 0), deeper orange near the cap, faint ribs. */
export function lanternGradientTexture(glow: number): Texture {
  const W = 64;
  const H = 128;
  const { c, g } = canvas(W, H);
  // the palette value is treated as the sRGB hue of the pod: bottom = brighter, yellower;
  // toward the cap = deeper orange
  const base = new Color(glow);
  const bottom = [Math.min(1, base.r * 1.02), Math.min(1, base.g * 1.12), Math.min(1, base.b * 1.3)];
  const top = [base.r * 0.86, base.g * 0.5, base.b * 0.35];
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = 1 - y / (H - 1); // canvas y grows downward; texture v = 0 is the bottom row
    const i0 = y * W * 4;
    if (v >= LANTERN_DARK_V - 0.01) {
      for (let x = 0; x < W; x++) {
        img.data[i0 + x * 4 + 3] = 255;
      }
      continue;
    }
    const body = v / (LANTERN_DARK_V - 0.01);
    const heat = Math.pow(1 - body, 1.4);
    for (let x = 0; x < W; x++) {
      const rib = 0.9 + 0.1 * Math.sin((x / W) * Math.PI * 2 * 9);
      const r = (top[0] + (bottom[0] - top[0]) * heat) * rib;
      const gg = (top[1] + (bottom[1] - top[1]) * heat) * rib;
      const b = (top[2] + (bottom[2] - top[2]) * heat) * rib;
      const i = i0 + x * 4;
      img.data[i] = Math.min(255, r * 255);
      img.data[i + 1] = Math.min(255, gg * 255);
      img.data[i + 2] = Math.min(255, b * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = finishTexture(new CanvasTexture(c), true, 'structures:lantern-gradient');
  tex.wrapS = RepeatWrapping;
  return tex;
}

/** Carved rune-like marks, dark strokes on transparent; two rows. Deterministic (no Math.random). */
export function runeTexture(seedRng: () => number): Texture {
  const W = 512;
  const H = 192;
  const { c, g } = canvas(W, H);
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const rows = 2;
  const cols = 11;
  const cellW = (W * 0.86) / cols;
  const cellH = (H * 0.72) / rows;
  const x0 = W * 0.07;
  const y0 = H * 0.14;
  for (let r = 0; r < rows; r++) {
    const n = r === 0 ? cols : cols - 3;
    for (let k = 0; k < n; k++) {
      const cx = x0 + (k + 0.5) * cellW + (r === 1 ? cellW * 1.5 : 0);
      const cy = y0 + (r + 0.5) * cellH;
      const strokes = 2 + Math.floor(seedRng() * 3);
      for (let s = 0; s < strokes; s++) {
        const kind = seedRng();
        g.strokeStyle = `rgba(${45 + Math.floor(seedRng() * 20)}, ${30 + Math.floor(seedRng() * 12)}, 18, ${0.78 + seedRng() * 0.2})`;
        g.lineWidth = 5 + seedRng() * 3;
        g.beginPath();
        const hw = cellW * 0.32;
        const hh = cellH * 0.36;
        if (kind < 0.35) {
          const ox = (seedRng() - 0.5) * hw;
          g.moveTo(cx + ox, cy - hh);
          g.lineTo(cx + ox + (seedRng() - 0.5) * hw * 0.4, cy + hh);
        } else if (kind < 0.6) {
          const oy = (seedRng() - 0.5) * hh * 1.2;
          g.moveTo(cx - hw, cy + oy);
          g.lineTo(cx + hw, cy + oy + (seedRng() - 0.5) * hh * 0.3);
        } else if (kind < 0.85) {
          const dir = seedRng() < 0.5 ? 1 : -1;
          g.moveTo(cx - hw * 0.8, cy - hh * dir);
          g.lineTo(cx + hw * 0.8, cy + hh * dir);
        } else {
          g.arc(cx + (seedRng() - 0.5) * hw, cy + (seedRng() - 0.5) * hh, hh * 0.45, 0, Math.PI * (1 + seedRng()));
        }
        g.stroke();
      }
    }
  }
  return finishTexture(new CanvasTexture(c), true, 'structures:runes');
}

/** Inject the shared wind model into a MeshStandardMaterial; uses aPhase/aAmount vertex attributes. */
export function windLeafMaterial<T extends MeshStandardMaterial>(mat: T, ctx: WorldContext, key: string): T {
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nattribute float aPhase;\nattribute float aAmount;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
          transformed += windLeaf(wp, aPhase, aAmount);
          transformed += windBranch(wp, 1.0, 0.75) * aAmount * 6.0;
        }`,
      );
  };
  mat.customProgramCacheKey = () => key;
  ctx.wind.bind(mat);
  return mat;
}

export async function loadMaterials(ctx: WorldContext, rng: () => number): Promise<StructureMaterials> {
  const T = ctx.textures;
  const [barkC, barkN, barkR, willowC, willowN, willowR, thatchN, thatchR, plankC, plankN, plankR] = await Promise.all([
    T.load('bark_brown_02', 'color'),
    T.load('bark_brown_02', 'normal'),
    T.load('bark_brown_02', 'roughness'),
    T.load('bark_willow_02', 'color'),
    T.load('bark_willow_02', 'normal'),
    T.load('bark_willow_02', 'roughness'),
    T.load('thatch_roof_angled', 'normal'),
    T.load('thatch_roof_angled', 'roughness'),
    T.load('weathered_planks', 'color'),
    T.load('weathered_planks', 'normal'),
    T.load('weathered_planks', 'roughness'),
  ]);
  const P = ctx.config.palette;

  const bark = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    normalScale: new Vector2(1.5, 1.5),
    roughnessMap: barkR,
    roughness: 1,
    color: new Color(0xd4a678),
    vertexColors: true,
  });
  const barkPale = new MeshStandardMaterial({
    map: willowC,
    normalMap: willowN,
    normalScale: new Vector2(1.1, 1.1),
    roughnessMap: willowR,
    roughness: 1,
    color: new Color(0xc4ae8e),
    vertexColors: true,
  });
  const logBark = new MeshStandardMaterial({
    map: willowC,
    normalMap: willowN,
    normalScale: new Vector2(1.4, 1.4),
    roughnessMap: willowR,
    roughness: 1,
    color: new Color(0xa89478),
    vertexColors: true,
  });
  const interior = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    roughness: 1,
    color: new Color(0x9a7452),
    side: BackSide,
  });
  const roof = new MeshStandardMaterial({
    map: strawTexture(rng),
    normalMap: thatchN,
    normalScale: new Vector2(0.9, 0.9),
    roughnessMap: thatchR,
    roughness: 1,
    color: new Color(0xffffff),
    vertexColors: true,
  });
  const wood = new MeshStandardMaterial({
    map: plankC,
    normalMap: plankN,
    roughnessMap: plankR,
    roughness: 1,
    color: new Color(0xf0d6a8),
    vertexColors: true,
  });
  const woodDark = new MeshStandardMaterial({
    map: plankC,
    normalMap: plankN,
    roughnessMap: plankR,
    roughness: 1,
    color: new Color(0x9a7650),
  });
  // kept below the tone-mapper's shoulder so the glow stays orange instead of clipping to cream
  const hearth = new MeshBasicMaterial({ color: new Color(0xff8c2a).multiplyScalar(1.15), toneMapped: true });
  const windowGlow = new MeshBasicMaterial({ color: new Color(0xffb04a).multiplyScalar(1.3), toneMapped: true });

  const lantern = new MeshStandardMaterial({
    color: new Color(0xffffff),
    vertexColors: true,
    emissive: new Color(0xffffff),
    emissiveMap: lanternGradientTexture(P.lanternGlow),
    emissiveIntensity: 2.0,
    roughness: 0.6,
    metalness: 0,
  });

  const leaf = windLeafMaterial(
    new MeshStandardMaterial({
      map: heartLeafTexture(),
      alphaTest: 0.45,
      side: DoubleSide,
      roughness: 0.75,
      vertexColors: true,
      color: new Color(0xffffff),
    }),
    ctx,
    'structures-leaf',
  );
  const vine = windLeafMaterial(new MeshStandardMaterial({ color: new Color(0x4c5a2c), roughness: 1 }), ctx, 'structures-vine');
  const tuft = windLeafMaterial(
    new MeshStandardMaterial({
      map: tuftTexture(),
      alphaTest: 0.4,
      side: DoubleSide,
      roughness: 0.85,
      vertexColors: true,
      color: new Color(0xffffff),
    }),
    ctx,
    'structures-tuft',
  );
  const moss = new MeshStandardMaterial({ color: new Color(0xffffff), vertexColors: true, roughness: 1, normalMap: thatchN, normalScale: new Vector2(0.5, 0.5) });
  const runes = new MeshStandardMaterial({ map: runeTexture(rng), alphaTest: 0.4, transparent: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const endGrain = new MeshStandardMaterial({ color: new Color(0x8a6848), roughness: 1, map: willowC, vertexColors: true });

  const texturedSets = T.loaded().filter((s) => ['bark_brown_02', 'bark_willow_02', 'thatch_roof_angled', 'weathered_planks'].includes(s));
  return { bark, barkPale, logBark, interior, roof, wood, woodDark, hearth, windowGlow, lantern, leaf, vine, tuft, moss, runes, endGrain, texturedSets };
}
