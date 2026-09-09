/**
 * Procedural leaf-cluster alpha texture for the giant canopies: a ragged tuft of ~70 overlapping
 * leaves (teardrop laminae with a midrib) on a transparent background. Cards carrying it sit
 * INSIDE the real leaf laminae of each crown lobe and give the canopy the dense, roof-like
 * coverage that individual laminae cannot reach within the triangle budget. Seeded, so identical
 * across runs.
 */
import { CanvasTexture, Color, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Rng } from '../util/prng';

export interface LeafClusterPalette {
  leafCanopy: number;
  leafSun: number;
}

/** fraction of the texture reserved for the opaque corner patch */
const SOLID_PATCH = 0.1;
/** uv for solid (non-card) vertices sharing a cluster-card material */
export const SOLID_UV = SOLID_PATCH * 0.5;
/** cards map their quad onto [CARD_UV0, 1]² so they never touch the patch */
export const CARD_UV0 = SOLID_PATCH + 0.03;

export function createLeafClusterTexture(rng: Rng, palette: LeafClusterPalette, size = 512): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const r = rng.fork('leaf-cluster');
  const canopy = new Color(palette.leafCanopy);
  const sun = new Color(palette.leafSun);
  const cool = new Color(0x3d7346);
  const warm = new Color(0x93ab3f);
  const css = (c: Color) => `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;

  const gauss = () => r.gauss();
  // a fine-grained tuft: many small leaves so a 1–2 m card reads as a cluster of 10–20 cm leaves,
  // not as one big lamina. Coverage loss in the mip chain is compensated by a dark outline around
  // each leaf and a lower alpha test / negative mip bias in the material.
  const leaves = 84;
  for (let i = 0; i < leaves; i++) {
    const depth = i / leaves; // back leaves first (darker), front leaves last (brighter)
    const cx = size * (0.56 + gauss() * 0.16);
    const cy = size * (0.44 + gauss() * 0.16);
    const length = size * r.range(0.11, 0.19);
    const width = length * r.range(0.5, 0.72);
    const angle = r.range(0, Math.PI * 2);
    const shade = 0.55 + 0.55 * depth + r.range(-0.08, 0.08);
    const base = canopy
      .clone()
      .lerp(sun, r.range(0, 0.55) * depth)
      .lerp(r.chance(0.5) ? cool : warm, r.range(0, 0.3))
      .multiplyScalar(shade);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // teardrop lamina: base at (0,0), tip at (0,length)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(width * 0.62, length * 0.28, width * 0.1, length);
    ctx.quadraticCurveTo(-width * 0.62, length * 0.28, 0, 0);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, length * 0.05);
    ctx.strokeStyle = css(base.clone().multiplyScalar(0.6));
    ctx.stroke();
    ctx.fillStyle = css(base);
    ctx.fill();
    // lit half + midrib
    const grad = ctx.createLinearGradient(-width * 0.5, 0, width * 0.5, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,230,${0.14 + 0.16 * depth})`);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = css(base.clone().multiplyScalar(0.72));
    ctx.lineWidth = Math.max(1, length * 0.03);
    ctx.beginPath();
    ctx.moveTo(0, length * 0.05);
    ctx.lineTo(width * 0.05, length * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  // opaque white patch in the uv (0,0) corner: solid vertices (trunks, lobe cores) that share this
  // material point their uv here (see SOLID_UV) so they survive the alpha test; cards use CARD_UV0..1
  const patch = Math.round(size * SOLID_PATCH);
  ctx.clearRect(0, size - patch, patch, patch);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, size - patch, patch, patch);

  const texture = new CanvasTexture(canvas);
  texture.name = 'procedural:leaf-cluster';
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
