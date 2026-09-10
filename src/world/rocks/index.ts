/**
 * Rocks & geology — owner: terrain agent.
 * Hero mossy boulders (LAYOUT.heroBoulders) with fractured/faceted silhouettes and rubble skirts,
 * half-buried angular strata on the steep embankment faces, and thousands of instanced pebbles
 * along path edges, stair feet and boulder bases. Everything is seated on the heightfield.
 */
import { Color, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type BufferGeometry } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { buildRock } from './rockgen';
import { createRockMaterial } from './material';
import type { Rng } from '../util/prng';

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _n = new Vector3();

interface Instance {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  tiltTo?: Vector3;
  variant: number;
}

function buildInstanced(list: Instance[], geos: BufferGeometry[], material: InstancedMesh['material'], name: string, castShadow: boolean): InstancedMesh[] {
  const per: Instance[][] = geos.map(() => []);
  for (const it of list) per[it.variant % geos.length].push(it);
  const out: InstancedMesh[] = [];
  per.forEach((items, v) => {
    if (!items.length) return;
    const im = new InstancedMesh(geos[v], material, items.length);
    items.forEach((it, i) => {
      _p.set(it.x, it.y, it.z);
      if (it.tiltTo) _q.setFromUnitVectors(_up, it.tiltTo);
      else _q.identity();
      _q.multiply(new Quaternion().setFromAxisAngle(_up, it.yaw));
      _s.setScalar(it.scale);
      im.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = castShadow;
    im.receiveShadow = true;
    im.name = `${name}-v${v}`;
    im.computeBoundingSphere();
    out.push(im);
  });
  return out;
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'rocks';
  const T = ctx.terrain;
  const rng = ctx.rng.fork('rocks');
  const seed = ctx.config.seed;
  const P = ctx.config.palette;
  const anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
  const material = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4);
  // the stair-foot boulder at the right edge of shot A (the mossy rock the Kokiri kid stands
  // beside): the reference reads it at lum ≈ 0.26 (box (0.82,0.60)-(0.98,0.70)) where the shared
  // rock material rendered 0.29 at exposure 1.0 — darker rock and moss for it alone, without
  // moving it
  const stairFootMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4, 0.78);
  const pebbleMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 0.35);
  const density = clamp(ctx.quality.density, 0.4, 1.4);
  const detailR = ctx.config.detailRadius;

  const notPaved = (x: number, z: number) => {
    const m = T.mask(x, z);
    return m.path < 0.02 && m.stairs < 0.5 && m.structure < 0.5;
  };

  // --- hero boulders -----------------------------------------------------------------------
  const contact: [number, number, number][] = [];
  const boulderInfo: { id: string; radius: number; triangles: number; sink: number; contacts: number }[] = [];
  const rubble: Instance[] = [];
  const pebbles: Instance[] = [];
  const bRng = rng.fork('boulders');
  for (const b of ctx.layout.heroBoulders) {
    const r = b.radius;
    const geo = buildRock(bRng.fork(b.id), `${seed}/boulder-${b.id}`, {
      radius: r,
      // 20·(detail+1)² triangles: ≈ 16.8k for the 2.2 m terrace boulder, ≈ 8.8k for the small ones
      detail: r > 1.5 ? 28 : 20,
      // rounded, weathered boulders (reference A/C/D): low ridging, soft lumps, and only shallow
      // sideways cleaves so the crown stays a dome under its moss cap instead of a faceted wedge
      ridge: 0.12,
      lump: 0.3,
      cuts: r > 1.5 ? 4 : 2,
      cutUp: [-0.35, 0.3],
      cutDepth: [0.68, 0.84],
      squashY: 0.74,
      creaseDeg: 24,
      // a few dark cracks, not a crazed surface: the reference boulders (C stair-foot loaf, A
      // terrace boulder) are smooth mid-grey with two or three dark partings
      cracks: 0.55,
      moss: 1.0,
      // faint bedding (dark partings, only a hint of a ledge) under a thick moss cap, sitting in
      // a dark collar of soil — the reference boulders are rounded first, layered second
      strata: 0.06,
      mossThickness: 0.06,
      dirt: 0.75,
      tint: new Color(0.56, 0.555, 0.535),
      freq: 0.9,
    });
    // seat: base sinks ~15 % of the rock height into the ground under the footprint
    let gSum = 0;
    let gn = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      gSum += T.height(b.position[0] + Math.cos(a) * r * 0.55, b.position[2] + Math.sin(a) * r * 0.55);
      gn++;
    }
    const ground = gSum / gn;
    const squash = 0.74;
    const height = 2 * r * squash;
    const sink = 0.15 * height;
    const cy = ground + r * squash * 0.62 - sink; // flat-ish bottom is at -0.62·r·squash
    const mesh = new Mesh(geo, b.id === 'stair-foot' ? stairFootMaterial : material);
    mesh.position.set(b.position[0], cy, b.position[2]);
    mesh.rotation.y = bRng.range(0, Math.PI * 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `boulder-${b.id}`;
    mesh.updateMatrixWorld(true);
    group.add(mesh);

    // contact points: where mesh edges cross the terrain surface
    const pos = geo.attributes.position;
    const va = new Vector3();
    const vb = new Vector3();
    const pts: [number, number, number][] = [];
    for (let i = 0; i < pos.count && pts.length < 400; i += 3) {
      for (let e = 0; e < 3; e++) {
        va.fromBufferAttribute(pos, i + e).applyMatrix4(mesh.matrixWorld);
        vb.fromBufferAttribute(pos, i + ((e + 1) % 3)).applyMatrix4(mesh.matrixWorld);
        const ga = va.y - T.height(va.x, va.z);
        const gb = vb.y - T.height(vb.x, vb.z);
        if (ga * gb < 0) {
          const t = ga / (ga - gb);
          const x = va.x + (vb.x - va.x) * t;
          const y = va.y + (vb.y - va.y) * t;
          const z = va.z + (vb.z - va.z) * t;
          if (Math.abs(y - T.height(x, z)) <= 0.03) pts.push([x, y, z]);
        }
      }
    }
    // keep a spread-out subset
    const keep: [number, number, number][] = [];
    for (const p of pts) {
      if (keep.every((k) => Math.hypot(k[0] - p[0], k[2] - p[2]) > r * 0.35)) keep.push(p);
      if (keep.length >= 12) break;
    }
    contact.push(...keep);
    boulderInfo.push({ id: b.id, radius: r, triangles: pos.count / 3, sink: Math.round(sink * 1000) / 1000, contacts: keep.length });

    // rubble skirt + pebbles at the base
    const nRub = Math.round(rng.range(9, 16) * (0.6 + 0.4 * r) * density);
    for (let k = 0; k < nRub; k++) {
      const a = bRng.range(0, Math.PI * 2);
      const d = r * bRng.range(0.85, 1.55);
      const x = b.position[0] + Math.cos(a) * d;
      const z = b.position[2] + Math.sin(a) * d;
      if (!notPaved(x, z)) continue;
      const sc = bRng.range(0.09, 0.3) * (0.7 + 0.3 * r);
      T.normal(x, z, _n);
      rubble.push({ x, y: T.height(x, z) - sc * 0.3, z, scale: sc, yaw: bRng.range(0, Math.PI * 2), tiltTo: _n.clone().lerp(_up, 0.5).normalize(), variant: bRng.int(0, 4) });
    }
    const nPeb = Math.round(bRng.range(35, 60) * density);
    for (let k = 0; k < nPeb; k++) {
      const a = bRng.range(0, Math.PI * 2);
      const d = r * bRng.range(0.9, 1.9);
      const x = b.position[0] + Math.cos(a) * d;
      const z = b.position[2] + Math.sin(a) * d;
      if (!notPaved(x, z)) continue;
      const sc = bRng.range(0.03, 0.1);
      pebbles.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: bRng.range(0, Math.PI * 2), variant: bRng.int(0, 4) });
    }
  }
  ctx.progress('rocks', 0.4);

  // --- shared small-rock geometry variants -------------------------------------------------
  const vRng = rng.fork('variants');
  const rubbleGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`rubble-${i}`), `${seed}/rubble-${i}`, { radius: 1, detail: 3, ridge: 0.2, lump: 0.22, cuts: 3, squashY: 0.75, creaseDeg: 40, cracks: 0.4, moss: 0.5, dirt: 0.4, tint: new Color(0.68, 0.67, 0.64), freq: 1 }),
  );
  const strataGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`strata-${i}`), `${seed}/strata-${i}`, { radius: 1, detail: 3, ridge: 0.14, lump: 0.15, cuts: 4, squashY: 0.55, creaseDeg: 30, cracks: 0.5, moss: 0.65, dirt: 0.5, tint: new Color(0.62, 0.6, 0.56), freq: 1, strata: 0.1 }),
  );
  const pebbleGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`pebble-${i}`), `${seed}/pebble-${i}`, { radius: 1, detail: 1, ridge: 0.12, lump: 0.25, cuts: 1, squashY: 0.7, creaseDeg: 50, cracks: 0.2, moss: 0.25, dirt: 0.3, tint: new Color(0.7, 0.69, 0.66), freq: 1 }),
  );

  // --- embankment strata on steep faces ----------------------------------------------------
  const strata: Instance[] = [];
  const sRng = rng.fork('strata');
  const sNoise = new Noise2D(`${seed}/strata-density`);
  const step = 0.9;
  for (let z = -detailR; z <= detailR; z += step) {
    for (let x = -detailR; x <= detailR; x += step) {
      if (x * x + z * z > detailR * detailR) continue;
      const px = x + sRng.range(-0.4, 0.4);
      const pz = z + sRng.range(-0.4, 0.4);
      const m = T.mask(px, pz);
      if (m.path > 0.02 || m.stairs > 0.5 || m.structure > 0.5) continue;
      const slope = T.slope(px, pz);
      const want = smoothstep(0.17, 0.42, slope) * (0.45 + 0.55 * (sNoise.fbm(px * 0.35, pz * 0.35, 2) * 0.5 + 0.5)) + m.cliff * 0.6;
      if (sRng() > want * 0.75 * density) continue;
      const sc = sRng.range(0.22, 0.62) * (0.7 + 0.6 * slope);
      T.normal(px, pz, _n);
      strata.push({ x: px, y: T.height(px, pz) - sc * 0.32, z: pz, scale: sc, yaw: sRng.range(0, Math.PI * 2), tiltTo: _n.clone().lerp(_up, 0.25).normalize(), variant: sRng.int(0, 4) });
    }
  }
  ctx.progress('rocks', 0.6);

  // --- pebbles: path edges, stair feet, scatter ---------------------------------------------
  const pRng = rng.fork('pebbles');
  const pathEdgePebble = (x: number, z: number, r: Rng) => {
    const m = T.mask(x, z);
    if (m.stairs > 0.5 || m.structure > 0.5) return false;
    // fringe of the paved surface: dense right at the edge, thinning outward
    if (m.path > 0.55 || m.path < 0.01) return r() < 0.04 && m.path < 0.01;
    return r() < 0.9;
  };
  const pathPts = [...ctx.layout.pathSpine, ...ctx.layout.pathToStairs, ...ctx.layout.pathToHouse];
  const target = Math.round(2600 * density);
  let tries = 0;
  while (pebbles.length < target && tries < target * 30) {
    tries++;
    const seg = pathPts[pRng.int(0, pathPts.length)];
    const x = seg[0] + pRng.range(-4.2, 4.2);
    const z = seg[2] + pRng.range(-4.2, 4.2);
    if (!pathEdgePebble(x, z, pRng)) continue;
    const sc = pRng.range(0.025, 0.11);
    pebbles.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: pRng.range(0, Math.PI * 2), variant: pRng.int(0, 4) });
  }
  // stair feet
  for (const s of ctx.layout.stairs) {
    const l = Math.hypot(s.dir[0], s.dir[1]);
    const dx = s.dir[0] / l;
    const dz = s.dir[1] / l;
    const n = Math.round(70 * density);
    for (let k = 0; k < n; k++) {
      const u = pRng.range(-1.6, -0.1);
      const v = pRng.range(-s.width / 2 - 1.0, s.width / 2 + 1.0);
      const x = s.base[0] + u * dx - v * dz;
      const z = s.base[2] + u * dz + v * dx;
      const m = T.mask(x, z);
      if (m.stairs > 0.5 || m.structure > 0.5) continue;
      const sc = pRng.range(0.03, 0.12);
      pebbles.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: pRng.range(0, Math.PI * 2), variant: pRng.int(0, 4) });
    }
  }
  ctx.progress('rocks', 0.8);

  const rubbleMeshes = buildInstanced(rubble, rubbleGeos, material, 'rubble', true);
  const strataMeshes = buildInstanced(strata, strataGeos, material, 'strata', true);
  const pebbleMeshes = buildInstanced(pebbles, pebbleGeos, pebbleMaterial, 'pebbles', false);
  for (const m of [...rubbleMeshes, ...strataMeshes, ...pebbleMeshes]) group.add(m);

  const samplePebbles = pebbles.filter((_, i) => i % Math.max(1, Math.ceil(pebbles.length / 200)) === 0).slice(0, 200);
  const rnd = (v: number) => Math.round(v * 1000) / 1000;
  ctx.audit('rocks', () => ({
    heroBoulders: boulderInfo.length,
    boulders: boulderInfo,
    geometry: 'procedural-v2-strata',
    features: ['ridged-displacement', 'bedding-strata', 'cleave-cuts', 'moss-cushion', 'crease-normals', 'crack-vertex-colour', 'moss-upward-faces', 'contact-dirt', 'rubble-skirt', 'triplanar-texture'],
    mossCoverage: true,
    rubble: rubble.length,
    strata: strata.length,
    scree: rubble.length + strata.length,
    pebbles: pebbles.length,
    instancedMeshes: rubbleMeshes.length + strataMeshes.length + pebbleMeshes.length,
    samplePositions: {
      boulders: contact.map((p) => p.map(rnd)),
      pebbles: samplePebbles.map((p) => [rnd(p.x), rnd(p.y), rnd(p.z)]),
    },
    palette: { moss: [P.mossDeep, P.mossBright] },
  }));

  return { name: 'rocks', group };
}
