/**
 * Weathered wooden signpost: a slightly leaning tapered post seated in the terrain, a plank
 * with soft irregular edges carved with rune-like marks (canvas decal), a brace and two pegs.
 */
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, PlaneGeometry, Vector3, type BufferGeometry } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { basisMatrix, merge, setColorAttribute, sweepTube } from './geometry';
import type { StructureMaterials } from './materials';

export interface SignpostBuild {
  group: Group;
  base: [number, number, number];
}

/** Map box UVs to a slice of the plank texture so the grain runs along the plank. */
function plankUV(geo: BufferGeometry, su: number, sv: number, swap: boolean, u0 = 0, v0 = 0) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (swap) uv.setXY(i, u0 + v * su, v0 + u * sv);
    else uv.setXY(i, u0 + u * su, v0 + v * sv);
  }
}

/** Soften a box into a hand-cut plank: jitter the corner vertices and slightly bow the face. */
function roughen(geo: BufferGeometry, rng: Rng, amount: number) {
  const pos = geo.attributes.position as Float32BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) {
      j = [(rng() - 0.5) * amount, (rng() - 0.5) * amount, (rng() - 0.5) * amount * 0.4];
      seen.set(key, j);
    }
    pos.setXYZ(i, pos.getX(i) + j[0], pos.getY(i) + j[1], pos.getZ(i) + j[2]);
  }
  geo.computeVertexNormals();
}

export function buildSignpost(def: { id: string; position: readonly [number, number, number]; facing: readonly [number, number] }, ctx: WorldContext, mats: StructureMaterials, rng: Rng): SignpostBuild {
  const group = new Group();
  group.name = `signpost-${def.id}`;
  const x = def.position[0];
  const z = def.position[2];
  const gy = ctx.terrain.height(x, z);
  const F = new Vector3(def.facing[0], 0, def.facing[1]).normalize();
  const Rt = new Vector3(F.z, 0, -F.x);

  // lean: a few degrees, mostly sideways
  const leanA = (rng() - 0.5) * Math.PI * 2;
  const lean = 0.045 + rng() * 0.03;
  const leanDir = new Vector3(Math.cos(leanA), 0, Math.sin(leanA)).multiplyScalar(lean);
  const postH = 1.62;
  const axisAt = (y: number) => new Vector3(x + leanDir.x * y, gy + y, z + leanDir.z * y);

  const parts = [];
  const post = sweepTube(new CatmullRomCurve3([axisAt(-0.35), axisAt(postH * 0.5), axisAt(postH)]), {
    radius: (t) => 0.078 - 0.028 * t,
    tubularSegments: 8,
    radialSegments: 10,
    uvMetres: 0.9,
    displace: (t, ang) => Math.sin(ang * 5 + t * 12) * 0.004,
    color: () => [0.78, 0.7, 0.58],
    capEnd: true,
  });
  parts.push(post);

  // plank: wide, soft edged, mounted at eye height for a child
  const plankW = 0.98;
  const plankH = 0.44;
  const plankT = 0.055;
  const plank = new BoxGeometry(plankW, plankH, plankT, 3, 2, 1);
  plankUV(plank, 0.42, 0.24, true, 0.1, 0.2);
  roughen(plank, rng, 0.03);
  // the weathered_planks map is grey (~0.35 linear); lift it to the reference's sunlit tan
  setColorAttribute(plank, [2.3, 1.95, 1.35]);
  const plankY = 1.08;
  const plankCentre = axisAt(plankY + plankH / 2).addScaledVector(F, 0.085);
  const tiltM = new Matrix4().makeRotationZ((rng() - 0.5) * 0.06);
  const plankM = basisMatrix(plankCentre, F).multiply(tiltM);
  plank.applyMatrix4(plankM);
  parts.push(plank);

  // brace behind the plank and two pegs through it
  const brace = new BoxGeometry(0.09, plankH * 0.85, 0.05);
  plankUV(brace, 0.08, 0.3, false);
  setColorAttribute(brace, [0.75, 0.68, 0.55]);
  brace.applyMatrix4(basisMatrix(axisAt(plankY + plankH / 2).addScaledVector(F, 0.035), F));
  parts.push(brace);
  for (const side of [-1, 1]) {
    const peg = new CylinderGeometry(0.022, 0.022, 0.09, 8);
    peg.rotateX(Math.PI / 2);
    setColorAttribute(peg, [0.5, 0.42, 0.32]);
    peg.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(Rt, side * plankW * 0.36).addScaledVector(F, 0.02), F));
    parts.push(peg);
  }
  const woodMesh = new Mesh(merge(parts), mats.wood);
  woodMesh.name = 'signpost-wood';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // carved marks decal on the front face
  const decal = new PlaneGeometry(plankW * 0.9, plankH * 0.8);
  decal.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(F, plankT / 2 + 0.004), F).multiply(tiltM));
  const decalMesh = new Mesh(decal, mats.runes);
  decalMesh.name = 'signpost-runes';
  group.add(decalMesh);

  return { group, base: [x, gy, z] };
}
