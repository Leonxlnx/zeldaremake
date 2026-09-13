/**
 * Soft radial contact-shadow decal under a character's feet (the reference characters sit on a
 * crisp dark contact shadow that the sun's shadow map alone does not give at 4–13 m). A flat disc
 * mesh whose radial fall-off is baked into RGBA vertex colours (no texture needed), laid on the
 * rendered ground surface by the character system every frame — deterministic, no extra render
 * passes. Note the scene is tone-mapped from HDR: on sunlit slabs (≈ 1.5–2 linear) a 0.35 black
 * blend lands in the curve's shoulder and reads weaker than 35 %, so the alpha runs at 0.6.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';

let sharedMat: MeshBasicMaterial | null = null;

/** alpha profile: plateau to 40 % of the radius, smooth fall-off to 0 at the rim */
const RINGS: { r: number; a: number }[] = [
  { r: 0.0, a: 1.0 },
  { r: 0.4, a: 0.95 },
  { r: 0.65, a: 0.6 },
  { r: 0.85, a: 0.2 },
  { r: 1.0, a: 0.0 },
];

function discGeometry(radius: number, segments: number): BufferGeometry {
  const pos: number[] = [0, 0, 0];
  const col: number[] = [0, 0, 0, RINGS[0].a];
  const idx: number[] = [];
  // ring k (k ≥ 1) has `segments` vertices starting at index 1 + (k − 1) · segments
  for (let k = 1; k < RINGS.length; k++) {
    const { r, a } = RINGS[k];
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2;
      pos.push(Math.cos(t) * r * radius, 0, Math.sin(t) * r * radius);
      col.push(0, 0, 0, a);
    }
  }
  const ring = (k: number, j: number) => 1 + (k - 1) * segments + (j % segments);
  for (let j = 0; j < segments; j++) idx.push(0, ring(1, j + 1), ring(1, j));
  for (let k = 1; k < RINGS.length - 1; k++) {
    for (let j = 0; j < segments; j++) {
      const a0 = ring(k, j);
      const a1 = ring(k, j + 1);
      const b0 = ring(k + 1, j);
      const b1 = ring(k + 1, j + 1);
      idx.push(a0, a1, b0, a1, b1, b0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createContactShadow(radius = 0.35, alpha = 0.6): Mesh {
  if (!sharedMat) {
    sharedMat = new MeshBasicMaterial({ color: 0x000000, vertexColors: true, opacity: alpha, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    sharedMat.name = 'char-contact-shadow';
  }
  const m = new Mesh(discGeometry(radius, 24), sharedMat);
  m.name = 'contact-shadow';
  m.castShadow = false;
  m.receiveShadow = false;
  m.renderOrder = 1;
  m.userData.depthAudit = false;
  return m;
}
