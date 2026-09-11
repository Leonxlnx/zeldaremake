/**
 * Weathered wooden signpost: a slightly leaning tapered post seated in the terrain, a plank
 * with beveled hand-cut edges, rune-like marks, inset wooden pegs and a tied post binding.
 */
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, PlaneGeometry, Shape, Vector2, Vector3, type BufferGeometry } from 'three';
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

/** Original control-point jitter; keep its draws stable so the sign's lean/roll do not change. */
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

/** Cut and bevel the control outline while keeping a flat, continuous face for the lettering. */
function carvedPlank(control: BufferGeometry, width: number, height: number, thickness: number): BufferGeometry {
  const pos = control.attributes.position;
  const rim = new Map<string, Vector2>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    if (pos.getZ(i) < thickness * 0.25 || (Math.abs(x) < width * 0.5 - 0.04 && Math.abs(y) < height * 0.5 - 0.04)) continue;
    rim.set(`${x.toFixed(6)}|${y.toFixed(6)}`, new Vector2(x, y));
  }
  const outline = [...rim.values()].sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  const min = new Vector2(Math.min(...outline.map(p => p.x)), Math.min(...outline.map(p => p.y)));
  const max = new Vector2(Math.max(...outline.map(p => p.x)), Math.max(...outline.map(p => p.y)));
  const bevel = 0.008;
  for (const p of outline) {
    p.x = ((p.x - min.x) / (max.x - min.x) - 0.5) * (width - bevel * 2);
    p.y = ((p.y - min.y) / (max.y - min.y) - 0.5) * (height - bevel * 2);
  }
  const board = new ExtrudeGeometry(new Shape(outline), {
    depth: thickness - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 1,
  });
  board.translate(0, 0, -thickness * 0.5 + bevel);
  // The structures merge helper expects indexed inputs; ExtrudeGeometry expands its faces.
  board.setIndex(Array.from({ length: board.attributes.position.count }, (_, i) => i));
  const p = board.attributes.position, normal = board.attributes.normal;
  const uv = board.attributes.uv as Float32BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < uv.count; i++) {
    // The same grain direction and texture slice as the previous board front.
    uv.setXY(i, 0.1 + (p.getY(i) / height + 0.5) * 0.42, 0.2 + (p.getX(i) / width + 0.5) * 0.24);
    const cut = 0.64 + 0.36 * Math.abs(normal.getZ(i));
    colors.set([2.3 * cut, 1.95 * cut, 1.35 * cut], i * 3);
  }
  board.setAttribute('color', new Float32BufferAttribute(colors, 3));
  control.dispose();
  return board;
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
  const control = new BoxGeometry(plankW, plankH, plankT, 3, 2, 1);
  roughen(control, rng, 0.03);
  const plank = carvedPlank(control, plankW, plankH, plankT);
  const plankY = 1.08;
  const plankCentre = axisAt(plankY + plankH / 2).addScaledVector(F, 0.085);
  const tiltM = new Matrix4().makeRotationZ((rng() - 0.5) * 0.06);
  const plankM = basisMatrix(plankCentre, F).multiply(tiltM);
  plank.applyMatrix4(plankM);
  parts.push(plank);

  // Brace behind the plank; four inset wooden pegs stay outside the lettering's ink margins.
  const brace = new BoxGeometry(0.09, plankH * 0.85, 0.05);
  plankUV(brace, 0.08, 0.3, false);
  setColorAttribute(brace, [0.75, 0.68, 0.55]);
  brace.applyMatrix4(basisMatrix(axisAt(plankY + plankH / 2).addScaledVector(F, 0.035), F));
  parts.push(brace);
  for (const side of [-1, 1]) for (const row of [-1, 1]) {
    const peg = new CylinderGeometry(0.017, 0.02, 0.07, 7);
    peg.rotateX(Math.PI / 2);
    peg.translate(side * plankW * 0.43, row * plankH * 0.35, 0.008);
    setColorAttribute(peg, [0.45, 0.36, 0.24]);
    peg.applyMatrix4(plankM);
    parts.push(peg);
  }
  // Three turns of natural-fibre lashing below the board, fitted to the leaning post.
  const wrap: Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, angle = t * Math.PI * 6;
    wrap.push(axisAt(plankY - 0.02 - t * 0.055).addScaledVector(Rt, Math.cos(angle) * 0.065).addScaledVector(F, Math.sin(angle) * 0.065));
  }
  parts.push(sweepTube(new CatmullRomCurve3(wrap), {
    radius: () => 0.009, tubularSegments: 64, radialSegments: 5, uvMetres: 0.12,
    color: () => [1.3, 1.03, 0.62], capStart: true, capEnd: true,
  }));
  const tie = wrap[wrap.length - 1];
  parts.push(sweepTube(new CatmullRomCurve3([
    tie, tie.clone().addScaledVector(F, 0.016).add(new Vector3(0, -0.018, 0)),
    tie.clone().addScaledVector(Rt, -0.008).add(new Vector3(0, -0.08, 0)),
  ]), {
    radius: (t) => 0.009 - t * 0.003, tubularSegments: 7, radialSegments: 5, uvMetres: 0.12,
    color: () => [1.3, 1.03, 0.62], capEnd: true,
  }));
  const woodMesh = new Mesh(merge(parts), mats.wood);
  woodMesh.name = 'signpost-wood';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // carved marks decal on the front face
  const decal = new PlaneGeometry(plankW * 0.9, plankH * 0.8);
  decal.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(F, plankT / 2 + 0.001), F).multiply(tiltM));
  const decalMesh = new Mesh(decal, mats.runes);
  decalMesh.name = 'signpost-runes';
  decalMesh.receiveShadow = true;
  group.add(decalMesh);

  return { group, base: [x, gy, z] };
}
