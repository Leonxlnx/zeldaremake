/** Link's original pigment and wet film share the existing seated white surface. */
import { Color, DataTexture, DynamicDrawUsage, Float32BufferAttribute, LinearFilter,
  LinearMipmapLinearFilter, MeshPhysicalMaterial, SRGBColorSpace, type BufferGeometry } from 'three';
import { CHAR_COLORS, linkIrisPigment } from './palette';

/** Unscaled metres, centred on the original iris/pupil circle. Both eyes use the same map. */
export const LINK_EYE_SURFACE = Object.freeze({
  width: .060, height: .036, textureWidth: 640, textureHeight: 384,
  irisRadius: .016, pupilRadius: .009, centreInsetX: .0025, centreY: -.0005,
});

let cached: MeshPhysicalMaterial | undefined;

/** One cached, deterministic pigment texture. All reflected light comes from the scene. */
export function linkEyeSurface(): MeshPhysicalMaterial {
  if (cached) return cached;
  const spec = LINK_EYE_SURFACE, data = new Uint8Array(spec.textureWidth * spec.textureHeight * 4);
  const white = new Color(CHAR_COLORS.eyeWhite), pupil = new Color(CHAR_COLORS.pupil), pigment = new Color();
  // Smooth analytic signed-distance coverage across the half-diagonal pixel footprint.
  const aa = .5 * Math.hypot(spec.width / spec.textureWidth, spec.height / spec.textureHeight);
  const coverage = (distance: number, radius: number) => {
    const t = Math.max(0, Math.min(1, (distance - radius + aa) / (2 * aa)));
    return 1 - t * t * (3 - 2 * t);
  };
  const encode = (linear: number) => Math.round(255 * (linear <= .0031308
    ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - .055));
  for (let y = 0; y < spec.textureHeight; y++) for (let x = 0; x < spec.textureWidth; x++) {
    const px = ((x + .5) / spec.textureWidth - .5) * spec.width;
    const py = ((y + .5) / spec.textureHeight - .5) * spec.height;
    const distance = Math.hypot(px, py), irisAlpha = coverage(distance, spec.irisRadius);
    const pupilAlpha = coverage(distance, spec.pupilRadius);
    const rgb = linkIrisPigment(px / spec.irisRadius, py / spec.irisRadius);
    pigment.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
    const i = (y * spec.textureWidth + x) * 4;
    for (let c = 0; c < 3; c++) {
      const key = (['r', 'g', 'b'] as const)[c];
      const irisMix = white[key] * (1 - irisAlpha) + pigment[key] * irisAlpha;
      data[i + c] = encode(irisMix * (1 - pupilAlpha) + pupil[key] * pupilAlpha);
    }
    data[i + 3] = 255;
  }
  const map = new DataTexture(data, spec.textureWidth, spec.textureHeight);
  map.name = 'original-link-continuous-eye-pigment'; map.colorSpace = SRGBColorSpace;
  map.generateMipmaps = true; map.minFilter = LinearMipmapLinearFilter;
  map.magFilter = LinearFilter; map.needsUpdate = true;
  cached = new MeshPhysicalMaterial({ map, color: 0xffffff, roughness: .6, metalness: 0,
    clearcoat: 1, clearcoatRoughness: .12 });
  cached.name = 'link-continuous-wet-eye';
  return cached;
}

/** Keep pigment coordinates physical while the existing white aperture closes in its parent. */
export function updateLinkEyeSurfaceUV(geometry: BufferGeometry, k: number, side: 1 | -1, blinkScale: number): void {
  const position = geometry.attributes.position, spec = LINK_EYE_SURFACE;
  let uv = geometry.getAttribute('uv');
  if (!uv) {
    uv = new Float32BufferAttribute(new Float32Array(position.count * 2), 2);
    uv.setUsage(DynamicDrawUsage); geometry.setAttribute('uv', uv);
  }
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / k, y = position.getY(i) * blinkScale / k;
    uv.setXY(i, .5 + (x + side * spec.centreInsetX) / spec.width,
      .5 + (y - spec.centreY) / spec.height);
  }
  uv.needsUpdate = true;
}
