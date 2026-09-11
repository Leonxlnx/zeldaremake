/** Original, static Link complexion on the existing final skin geometry. */
import { Color, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { linkMouthHeight } from './face-geometry';
import type { Rig } from './rig';

const headMaterials = new WeakMap<MeshStandardMaterial, MeshStandardMaterial>();
let mouthMaterial: MeshStandardMaterial | undefined;

/** Only the Link mouth path calls this; NPC mouth pigment stays independent. */
export function linkMouthMaterial(): MeshStandardMaterial {
  mouthMaterial ??= new MeshStandardMaterial({ color: 0x91665b, roughness: .64, metalness: 0 });
  mouthMaterial.name = 'link-natural-mouth';
  return mouthMaterial;
}

const smooth = (low: number, high: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};
const compact = (value: number, extent: number): number => {
  const u = Math.min(1, Math.abs(value) / extent);
  return (1 - u * u) ** 2;
};

/**
 * Call once on the original built skin, before local orbital refinement. Existing position, normal and
 * index attributes remain untouched; no UVs or animation callback are needed.
 */
export function applyLinkSkinPigment(rig: Rig): void {
  const skull = rig.head.getObjectByName('skull');
  if (!(skull instanceof Mesh) || !(skull.material instanceof MeshStandardMaterial))
    throw new Error('Link complexion requires its final skin mesh');
  const geometry = skull.geometry, position = geometry.attributes.position, index = geometry.index;
  if (!index || geometry.hasAttribute('color')) throw new Error('Link complexion is construction-only');
  const skin = skull.material, k = rig.props.headRadius / .125;
  const base = skin.color, cheek = new Color(0xd69a8e), lip = new Color(0xc28b80), color = new Color();
  const maxIncidentY = new Float64Array(position.count); maxIncidentY.fill(-Infinity);
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    const top = Math.max(position.getY(a), position.getY(b), position.getY(c)) / k;
    for (const i of [a, b, c]) maxIncidentY[i] = Math.max(maxIncidentY[i], top);
  }
  // Share the conservative guard at duplicated wrap/pole positions as well.
  const keys = Array.from({ length: position.count }, (_, i) => [position.getX(i), position.getY(i), position.getZ(i)]
    .map(v => Math.round(v * 1e8)).join(':'));
  const guard = new Map<string, number>();
  for (let i = 0; i < position.count; i++) guard.set(keys[i], Math.max(guard.get(keys[i]) ?? -Infinity, maxIncidentY[i]));
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / k, y = position.getY(i) / k, z = position.getZ(i) / k;
    const front = smooth(.04, .08, z);
    // Every triangle reaching y=-.024k has base-color vertices. This avoids
    // interpolation carrying cheek pigment into the lower eyelid's -.0235k seam.
    const seamGuard = 1 - smooth(-.040, -.024, guard.get(keys[i])!);
    const cheekWeight = .30 * compact(Math.abs(x) - .055, .033) * compact(y + .040, .023) * seamGuard * front;
    const seam = linkMouthHeight(x * k, k) / k;
    const upper = compact(y - seam - .0021, .0038), lower = compact(y - seam + .0038, .0045);
    const lipWeight = .55 * compact(x, .019) * (1 - (1 - upper) * (1 - lower)) * front;
    const earX = Math.abs(position.getX(i)) / rig.props.headRadius;
    const earWeight = .22 * compact(earX - 1.155, .135) * compact(y - .016, .020) * smooth(-.008, .008, z);
    color.copy(base).lerp(cheek, cheekWeight).lerp(lip, lipWeight).lerp(cheek, earWeight);
    // Vertex color is a linear-light multiplier of the shared body/lid albedo.
    colors[i * 3] = color.r / base.r; colors[i * 3 + 1] = color.g / base.g; colors[i * 3 + 2] = color.b / base.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  let material = headMaterials.get(skin);
  if (!material) {
    material = skin.clone(); material.vertexColors = true; material.name = 'link-natural-complexion';
    headMaterials.set(skin, material);
  }
  skull.material = material;
}
