/**
 * Rocks & geology — owner: terrain agent.
 * Hero mossy boulders (LAYOUT.heroBoulders) with fractured/faceted silhouettes and rubble skirts,
 * half-buried angular strata on the steep embankment faces, and thousands of instanced pebbles
 * along path edges, stair feet and boulder bases. Everything is seated on the heightfield.
 * Each hero boulder also carries a near LOD (NEAR_ROCK_IN_M below) for the live camera at
 * player height: the same rock rebuilt denser with a fractured skin, moss pads, lichen plates
 * and loose fragments, and a material variant whose 2.6 m texture tile, wet band and crack grime
 * fade in under 6 m (material.ts). The six fixed hero cameras always render the far meshes.
 */
import { Color, Frustum, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Quaternion, Sphere, Vector3, type BufferGeometry, type Camera } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { buildRock, type RockOptions } from './rockgen';
import { createRockMaterial, NEAR_FADE_M, NEAR_TILE_M } from './material';
import { dressRock, mergeRockParts } from './dressing';
import { CUSHION, FERN, TUFT_A, TUFT_B, buildSproutMeshes, createSproutMaterial, type SproutSpot } from '../materials/sprouts';
import type { Rng } from '../util/prng';

/**
 * Near-LOD swap radii (m, 3D to the boulder's centre) for the hero boulders (round 42): within
 * NEAR_ROCK_IN_M of the live camera a boulder's far mesh is replaced by its near version —
 * the same rock (same stream, same low-frequency shape, cuts and bedding) at 2.2× the vertex
 * density with a fractured skin, deeper crack furrows, a fine crack network, chipped cleave rims,
 * strata ledges, moss cushions and lichen plates on its faces and loose fragments at its foot
 * (rockgen.ts / dressing.ts) — and out again past NEAR_ROCK_OUT_M (hysteresis). A boulder a
 * hero camera frames from d m swaps only at d − NEAR_ROCK_HERO_MARGIN (out at d − margin / 3),
 * so the six fixed captures always render today's far meshes; a rock whose in-radius would fall
 * under NEAR_ROCK_MIN_IN_M gets no near version.
 */
export const NEAR_ROCK_IN_M = 12;
export const NEAR_ROCK_OUT_M = 14;
export const NEAR_ROCK_HERO_MARGIN = 1.5;
export const NEAR_ROCK_MIN_IN_M = 2.5;
/** the boulder cap / crevice plants: tufts, ferns and moss pads, all variants in one draw */
const ROCK_PLANT_PACKS: number[][] = [[TUFT_A, TUFT_B, FERN, CUSHION]];

const _m = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _n = new Vector3();
const _cam = new Vector3();

interface NearRock {
  id: string;
  centre: Vector3;
  far: Mesh;
  near: Mesh;
  inM: number;
  outM: number;
  /** distance (m) of the nearest hero camera that frames the rock, Infinity when none does */
  hero: number;
  active: boolean;
  dist: number;
  triangles: number;
  cushions: number;
  lichen: number;
  fragments: number;
}

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
  // the hero boulders' own material: the same look with the near-detail terms (material.ts
  // NEAR_TILE_M) that fade in under NEAR_FADE_M — the rubble, strata and pebbles keep the plain
  // one, so the stones in a hero camera's foreground never change
  const heroMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4, 1, { near: true });
  // the stair-foot boulder at the right edge of shot A (the mossy rock the Kokiri kid stands
  // beside): the reference reads it at lum ≈ 0.26 (box (0.82,0.60)-(0.98,0.70)) where the shared
  // rock material rendered 0.29 at exposure 1.0 — darker rock and moss for it alone, without
  // moving it
  const stairFootMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 1.4, 0.9, { near: true });
  const pebbleMaterial = await createRockMaterial(ctx.textures, ctx.config, anisotropy, 0.35);
  const density = clamp(ctx.quality.density, 0.4, 1.4);
  const detailR = ctx.config.detailRadius;
  const nearLod = ctx.quality.tier !== 'low';
  // the hero cameras' frusta (a little wider than the captures), for the near-LOD swap radii
  const heroFrusta = ctx.layout.viewpoints.map((v) => {
    const cam = new PerspectiveCamera(v.fov + 4, 1.85, 0.1, 400);
    cam.position.set(v.position[0], v.position[1], v.position[2]);
    cam.lookAt(v.target[0], v.target[1], v.target[2]);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    return { position: cam.position.clone(), frustum: new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)) };
  });
  const heroSphere = new Sphere();
  /** distance of the nearest hero camera that frames the sphere (centre, radius + 1 m), or Infinity */
  const heroDistance = (centre: Vector3, radius: number) => {
    heroSphere.center.copy(centre);
    heroSphere.radius = radius + 1;
    let nearest = Infinity;
    for (const h of heroFrusta) {
      const d = h.position.distanceTo(centre);
      if (d < nearest && h.frustum.intersectsSphere(heroSphere)) nearest = d;
    }
    return nearest;
  };
  const nearRocks: NearRock[] = [];
  const nearDropped: string[] = [];
  const mossPalette = { mossDeep: new Color(ctx.config.palette.mossDeep), mossBright: new Color(ctx.config.palette.mossBright) };

  const notPaved = (x: number, z: number) => {
    const m = T.mask(x, z);
    return m.path < 0.02 && m.stairs < 0.5 && m.structure < 0.5;
  };

  // --- hero boulders -----------------------------------------------------------------------
  const contact: [number, number, number][] = [];
  const boulderInfo: { id: string; radius: number; triangles: number; sink: number; contacts: number; baseGap: number; crackShare: number; mossShare: number; facetShare: number; topAboveGround: number }[] = [];
  const rubble: Instance[] = [];
  const pebbles: Instance[] = [];
  const boulderPlants: SproutSpot[] = [];
  const crevicePlants: SproutSpot[] = [];
  let basePlants = 0;
  let spillStones = 0;
  const bRng = rng.fork('boulders');
  // the shaded side of every rock: horizontal direction away from the sun (config.sun, azimuth
  // from +Z toward +X) — the moss blanket in the frames hangs on the faces the sun never reaches
  const sunAz = (ctx.config.sun.azimuthDeg * Math.PI) / 180;
  const shadeDir: [number, number] = [-Math.sin(sunAz), -Math.cos(sunAz)];
  const pathPtsAll = [...ctx.layout.pathSpine, ...ctx.layout.pathToStairs, ...ctx.layout.pathToHouse];
  /** unit xz direction from (x, z) to the nearest path spine point */
  const towardPath = (x: number, z: number): [number, number] => {
    let best = pathPtsAll[0];
    let bd = Infinity;
    for (const p of pathPtsAll) {
      const d = Math.hypot(p[0] - x, p[2] - z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    const l = Math.max(1e-6, bd);
    return [(best[0] - x) / l, (best[2] - z) / l];
  };
  /** a world xz direction expressed in the local frame of a mesh yawed by `yaw` about +Y */
  const toLocal = (d: [number, number], yaw: number): [number, number] => [d[0] * Math.cos(yaw) - d[1] * Math.sin(yaw), d[0] * Math.sin(yaw) + d[1] * Math.cos(yaw)];
  for (const b of ctx.layout.heroBoulders) {
    const r = b.radius;
    const collar = new Color(0.13, 0.135, 0.09);
    // the mesh yaw is drawn first (same bRng draw as before — the geometry stream is a fork) so
    // the sun-shade and path directions can be baked into the geometry in its local frame
    const yaw = bRng.range(0, Math.PI * 2);
    // frame 56 s reads the D boulder as a low loaf ≈ 1.3 m wide standing 0.6 m proud of the plants
    // (0.09 of the frame height at 7 m) where a 0.74 squash stood 1.13 m: squashed lower and sunk
    // deeper (0.94 m proud) — but still a dome, since the low camera only sees its lit top as a
    // curve; the A/terrace rocks keep the rounded 0.74 profile
    // (round 24: 0.64 / 0.18 still stood 0.88 m proud = 0.159 of frame D against the frame's 0.09;
    // the loaf went lower as a stopgap: squash 0.42, sink 0.22 -> ~0.55 m proud at r 0.9.
    // Layout round 6: the layout radius is 0.6 (the vegetation's exclusions read the boulder's
    // layout `clearRadius`, still 0.9, so its scatter streams do not move) and the loaf is a
    // rounded 0.64 dome again on the shared 0.15 seat: ≈ 1.2 m wide, ≈ 0.5 m proud)
    const squash = b.id === 'shot-d-boulder' ? 0.64 : 0.74;
    const sinkFrac = 0.15;
    const rockOpts: RockOptions = {
      radius: r,
      // 20·(detail+1)² triangles: ≈ 16.8k for the 2.2 m terrace boulder, ≈ 14.6k for the small
      // ones (detail 26: the crack furrows are 5 cm wide and need ~4 cm edges to read as lines)
      detail: r > 1.5 ? 28 : 26,
      // rounded, weathered boulders (reference A/C/D): low ridging, soft lumps, and only shallow
      // sideways cleaves so the crown stays a dome under its moss cap instead of a faceted wedge
      ridge: 0.12,
      lump: 0.3,
      // round 4 (frames 1 s / 8 s / 56 s): the crown is a lumpy, soft mass — big swells on the
      // upper hemisphere (+0.45·crown mean, ±0.9·crown in lumps) under a thick lumpy cushion
      crown: 0.2,
      // the big terrace rock: two shallow cleaves only (four deep ones read as a stack of cut
      // slabs with a flat front) — it is a rounded mossy mass in frame 14 s
      cuts: 2,
      cutUp: [-0.35, 0.3],
      // D keeps a deep fracture face; the A rock's cleaves are shallow chips (frame 1 s: rounded)
      cutDepth: r > 1.5 ? [0.9, 1.02] : b.id === 'shot-d-boulder' ? [0.68, 0.84] : [0.82, 0.94],
      // the D boulder's fresh fracture face stands toward the path (frame 56 s: a dark cleaved
      // face on the path side under a bright moss top)
      cutToward: b.id === 'shot-d-boulder' ? toLocal(towardPath(b.position[0], b.position[2]), yaw) : undefined,
      cutDark: b.id === 'shot-d-boulder' ? 0.4 : 0.3,
      facetBare: b.id === 'shot-d-boulder' ? 0.9 : 0.5,
      squashY: squash,
      creaseDeg: 24,
      // a few dark cracks, not a crazed surface: the reference boulders (C stair-foot loaf, A
      // terrace boulder) are smooth mid-grey with two or three dark partings — cut as furrows
      // 2.5 % of the radius deep so they read as dark lines under any light
      cracks: 0.55,
      crackDepth: 0.025,
      // frame 56 s: the D rock is half bare stone (moss 35 % of its box, bare 54 %); at 1.0 the
      // cushion took 51 % of ours
      moss: b.id === 'shot-d-boulder' ? 0.85 : 1.0,
      // faint bedding (dark partings, only a hint of a ledge) under a thick moss cap, sitting in
      // a dark collar of soil — the reference boulders are rounded first, layered second.
      // Sheet 01 'Mossy root' / sheet 04: the caps are thick pads over grey — not warm-brown —
      // rock faces; round 4 thickens the cushion (8.5 → 13 % of the radius, ±50 % lumpy) and
      // hangs a moss blanket down the shaded side (frames 1 s / 8 s: the A rock's face toward the
      // camera is moss from shoulder to collar)
      // bedding (ledges + dark partings) on D only (frame 56 s: layered); on the A rock the
      // partings drew dark rings round the whole boulder (frame 1 s: smooth) and the moss
      // blanket over the ledges read as stacked pancakes
      strata: b.id === 'shot-d-boulder' ? 0.06 : 0,
      // 12 cm cushion whatever the radius (13 % of a 1 m rock; the 2.2 m rock would otherwise
      // wear a 30 cm pad and crumple at its edge)
      mossThickness: Math.min(0.13, 0.12 / r),
      mossLumpy: 1.0,
      // D's frame face is bare lit stone under the moss top with the fracture in shade, so its
      // blanket is thinner; the A rock's face toward frame 1 s is moss from shoulder to collar
      mossSide: b.id === 'shot-d-boulder' ? 0.45 : 0.9,
      mossShade: toLocal(shadeDir, yaw),
      // the lower band is a dark, damp green-brown (not bare soil), reaching ~0.35 m up the
      // visible face of the small boulders
      dirt: 0.8,
      collar,
      collarBand: [0.12, 0.6],
      // frame 56 s reads the D rock's sunlit face at lum 0.42 (flagstone-bright grey-tan) where a
      // 0.55 tint rendered 0.24: mid-grey stone, the collar and the fracture faces carry the dark.
      // The D rock's bare stone is warm and pale in the frame (hue 46, sat 0.34) where the A/terrace
      // rocks are cool grey under their moss, so it gets a tan tint of its own
      tint: b.id === 'shot-d-boulder' ? new Color(0.82, 0.77, 0.68) : new Color(0.72, 0.72, 0.71),
      freq: 0.9,
    };
    const geo = buildRock(bRng.fork(b.id), `${seed}/boulder-${b.id}`, rockOpts);
    // seat: base sinks ~15 % of the rock height into the ground under the footprint
    let gSum = 0;
    let gn = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      gSum += T.height(b.position[0] + Math.cos(a) * r * 0.55, b.position[2] + Math.sin(a) * r * 0.55);
      gn++;
    }
    const ground = gSum / gn;
    const height = 2 * r * squash;
    const sink = sinkFrac * height;
    const cy = ground + r * squash * 0.62 - sink; // flat-ish bottom is at -0.62·r·squash
    const mesh = new Mesh(geo, b.id === 'stair-foot' ? stairFootMaterial : heroMaterial);
    mesh.position.set(b.position[0], cy, b.position[2]);
    mesh.rotation.y = yaw;
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
    // base gap: per azimuth bin, does the rock's outer body (outside the buried centre column)
    // enter the ground? The bin's gap is the smallest height of its vertices above the terrain
    // under them, clamped at 0 — positive only where no vertex reaches the ground, i.e. the
    // silhouette floats on the downhill side of a bank. 0 all round = the rock sits IN the ground.
    let baseGap = 0;
    let top = -Infinity;
    {
      const GB = 24;
      const wide = new Float32Array(GB);
      const wpos: number[] = [];
      for (let i = 0; i < pos.count; i++) {
        va.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        top = Math.max(top, va.y);
        const dx = va.x - b.position[0];
        const dz = va.z - b.position[2];
        const hr = Math.hypot(dx, dz);
        const bin = ((Math.round((Math.atan2(dz, dx) / (Math.PI * 2)) * GB) % GB) + GB) % GB;
        wide[bin] = Math.max(wide[bin], hr);
        wpos.push(va.x, va.y, va.z, hr, bin);
      }
      const low = new Float32Array(GB).fill(Infinity);
      for (let i = 0; i < wpos.length; i += 5) {
        const bin = wpos[i + 4];
        if (wpos[i + 3] < 0.35 * wide[bin]) continue;
        low[bin] = Math.min(low[bin], wpos[i + 1] - T.height(wpos[i], wpos[i + 2]));
      }
      for (let k = 0; k < GB; k++) if (Number.isFinite(low[k])) baseGap = Math.max(baseGap, low[k]);
    }
    const st = (geo.userData.rockStats ?? { crackShare: 0, mossShare: 0, facetShare: 0 }) as { crackShare: number; mossShare: number; facetShare: number };
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    boulderInfo.push({ id: b.id, radius: r, triangles: pos.count / 3, sink: r3(sink), contacts: keep.length, baseGap: r3(baseGap), crackShare: r3(st.crackShare), mossShare: r3(st.mossShare), facetShare: r3(st.facetShare), topAboveGround: r3(top - ground) });

    // small plants in the cap (sheet 01 'Roots' / 'Mossy root', sheet 04): grass tufts and a
    // fern or two rooted where a dark parting crosses the mossy upper faces — one candidate per
    // upward, mossy triangle, cracks first, spaced ≥ 0.28 r apart
    {
      const nrmA = geo.attributes.normal;
      const colA = geo.attributes.color;
      const mossA = geo.attributes.aMoss;
      const cand: { i: number; crack: boolean }[] = [];
      for (let i = 0; i < pos.count; i += 3) {
        _n.fromBufferAttribute(nrmA, i);
        if (_n.y < 0.55) continue;
        if (mossA.getX(i) < 0.35) continue;
        // world height: only the crown and shoulders, never the buried collar
        va.fromBufferAttribute(pos, i);
        if (va.y < -0.1 * r) continue;
        cand.push({ i, crack: colA.getX(i) + colA.getY(i) + colA.getZ(i) < 1.1 });
      }
      cand.sort((p, q) => Number(q.crack) - Number(p.crack) || p.i - q.i);
      const want = r > 1.5 ? 14 : 8;
      const placed: Vector3[] = [];
      // own stream: the rubble skirt and pebbles drawn from bRng below must not move
      const pRng = bRng.fork(`plants-${b.id}`);
      for (const cd of cand) {
        if (placed.length >= want) break;
        if (!pRng.chance(cd.crack ? 0.45 : 0.12)) continue;
        va.fromBufferAttribute(pos, cd.i).applyMatrix4(mesh.matrixWorld);
        if (placed.some((p) => p.distanceTo(va) < 0.28 * r)) continue;
        placed.push(va.clone());
        const fern = pRng.chance(0.3);
        boulderPlants.push({ x: va.x, y: va.y - 0.006, z: va.z, size: fern ? 0.5 : pRng.range(0.45, 0.95), kind: fern ? 'fern' : 'tuft', scale: fern ? pRng.range(0.9, 1.3) : pRng.range(1.2, 1.7) });
      }
    }

    // crevice plants (round 42; sheet 05 'Roots', frame-05: moss and small ferns rooted IN the
    // rock's partings): candidates are the dark crack / parting vertices on the shoulders and
    // sides — not the mossy cap the cap plants use — a fern or two arching out of the deeper
    // clefts and a few moss pads filling the shallower ones. Own stream; the spots are appended
    // after every boulder's cap and base plants (below), so those keep their jitter draws.
    {
      const nrmA = geo.attributes.normal;
      const colA = geo.attributes.color;
      const mossA = geo.attributes.aMoss;
      const cRng = bRng.fork(`crevice-${b.id}`);
      const cand: { i: number; ny: number }[] = [];
      for (let i = 0; i < pos.count; i += 3) {
        _n.fromBufferAttribute(nrmA, i);
        if (_n.y < 0.12 || _n.y > 0.8) continue;
        if (mossA.getX(i) > 0.45) continue;
        va.fromBufferAttribute(pos, i);
        if (va.y < -0.05 * r) continue;
        if (colA.getX(i) + colA.getY(i) + colA.getZ(i) >= 1.05) continue;
        cand.push({ i, ny: _n.y });
      }
      // shuffle deterministically, then take ferns from the steeper clefts and pads from the flatter
      const order = cand.map((c) => ({ c, k: cRng() })).sort((p, q) => p.k - q.k || p.c.i - q.c.i).map((o) => o.c);
      const wantFerns = r > 1.5 ? 3 : 2;
      const wantPads = r > 1.5 ? 5 : 3;
      const placed: Vector3[] = [];
      let ferns = 0;
      let pads = 0;
      for (const cd of order) {
        if (ferns >= wantFerns && pads >= wantPads) break;
        va.fromBufferAttribute(pos, cd.i).applyMatrix4(mesh.matrixWorld);
        if (placed.some((p) => p.distanceTo(va) < 0.2 * r)) continue;
        const fern = ferns < wantFerns && (cd.ny < 0.55 || pads >= wantPads);
        if (!fern && cd.ny < 0.4) continue;
        placed.push(va.clone());
        if (fern) {
          crevicePlants.push({ x: va.x, y: va.y - 0.012, z: va.z, size: 0.5, kind: 'fern', scale: cRng.range(0.8, 1.15) });
          ferns++;
        } else {
          crevicePlants.push({ x: va.x, y: va.y - 0.004, z: va.z, size: cRng.range(0.3, 0.8), kind: 'cushion', scale: cRng.range(0.9, 1.3) });
          pads++;
        }
      }
    }

    // the rock's rim at ground level, per azimuth bin (world frame): where the ground plants and
    // the spill stones start
    const BINS = 24;
    const rim = new Float32Array(BINS).fill(r * 0.6);
    for (let i = 0; i < pos.count; i++) {
      va.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (va.y > ground + 0.35 || va.y < ground - 0.3) continue;
      const dx = va.x - b.position[0];
      const dz = va.z - b.position[2];
      const bin = ((Math.round((Math.atan2(dz, dx) / (Math.PI * 2)) * BINS) % BINS) + BINS) % BINS;
      rim[bin] = Math.max(rim[bin], Math.hypot(dx, dz));
    }
    const rimAt = (a: number) => rim[((Math.round((a / (Math.PI * 2)) * BINS) % BINS) + BINS) % BINS];

    // ground plants at the foot (frames 1 s / 56 s: ferns and grass sprigs lap the rock's base
    // and spill onto the paving edge) — sown around the rim, denser on the shaded side and the
    // path side, so the rock sits in the ground rather than on it. Own stream: nothing below moves.
    {
      const gRng = bRng.fork(`base-plants-${b.id}`);
      const want = r > 1.5 ? 18 : 12;
      const toPath = towardPath(b.position[0], b.position[2]);
      let placed = 0;
      for (let k = 0; k < want * 4 && placed < want; k++) {
        const a = gRng.range(0, Math.PI * 2);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // acceptance: 0.35 anywhere, up to 1 where the rim faces the shade or the path
        const favour = Math.max(ca * shadeDir[0] + sa * shadeDir[1], ca * toPath[0] + sa * toPath[1]);
        if (!gRng.chance(0.35 + 0.65 * smoothstep(0.0, 0.8, favour))) continue;
        const d = rimAt(a) * gRng.range(0.98, 1.22) + 0.04;
        const x = b.position[0] + ca * d;
        const z = b.position[2] + sa * d;
        if (!notPaved(x, z)) continue;
        const fern = gRng.chance(0.45);
        boulderPlants.push({ x, y: T.height(x, z) - 0.004, z, size: fern ? 0.5 : gRng.range(0.5, 0.95), kind: fern ? 'fern' : 'tuft', scale: fern ? gRng.range(1.5, 2.3) : gRng.range(1.5, 2.1) });
        placed++;
        basePlants++;
      }
    }

    // spill stones: fist-sized mossy stones at the foot, spilling from the rim toward the paving
    // edge (frame 1 s: the A rock's foot sheds a few stones onto the flagstone verge)
    {
      const sRng = bRng.fork(`spill-${b.id}`);
      const toPath = towardPath(b.position[0], b.position[2]);
      const a0 = Math.atan2(toPath[1], toPath[0]);
      // march toward the path to find the paved edge (the spill stops there)
      let edge = rimAt(a0) + 1.2;
      for (let d = rimAt(a0); d < rimAt(a0) + 3; d += 0.1) {
        const m = T.mask(b.position[0] + toPath[0] * d, b.position[2] + toPath[1] * d);
        if (m.path > 0.3 || m.stairs > 0.5 || m.structure > 0.5) {
          edge = d;
          break;
        }
      }
      const n = r > 1.5 ? 6 : 8;
      let placed = 0;
      for (let k = 0; k < n * 3 && placed < n; k++) {
        const a = a0 + sRng.range(-0.65, 0.65);
        const t = sRng.range(0, 1) ** 0.7; // biased toward the rim
        const d = rimAt(a) * 1.02 + t * Math.max(0.2, edge - rimAt(a) * 1.02 - 0.05);
        const x = b.position[0] + Math.cos(a) * d;
        const z = b.position[2] + Math.sin(a) * d;
        if (!notPaved(x, z)) continue;
        const sc = sRng.range(0.07, 0.13);
        T.normal(x, z, _n);
        rubble.push({ x, y: T.height(x, z) - sc * 0.35, z, scale: sc, yaw: sRng.range(0, Math.PI * 2), tiltTo: _n.clone().lerp(_up, 0.5).normalize(), variant: sRng.int(0, 4) });
        spillStones++;
        placed++;
      }
    }

    // near LOD (see NEAR_ROCK_IN_M): the same rock from the same stream, rebuilt denser with the
    // near relief, dressed, with loose fragments at its foot — swapped in for the far mesh while
    // the live camera stands within the in-radius. Own streams only; nothing below moves.
    if (nearLod) {
      const centre = new Vector3(b.position[0], cy, b.position[2]);
      const hero = heroDistance(centre, r * 1.4 + 0.3);
      const inM = Math.min(NEAR_ROCK_IN_M, hero - NEAR_ROCK_HERO_MARGIN);
      const outM = Math.min(NEAR_ROCK_OUT_M, hero - NEAR_ROCK_HERO_MARGIN / 3);
      if (inM < NEAR_ROCK_MIN_IN_M) nearDropped.push(b.id);
      else {
        // absolute-scale relief on every rock, whatever its radius: main furrows ≤ 3 cm deep, the
        // fine network ≈ 1.2 cm (hairlines in the colour, barely a groove — at the main depth the
        // dense network corrugated the stair-foot rock's flank into chevrons), skin ≈ 2.5 cm,
        // chips ≈ 3 cm
        const nearGeo = buildRock(bRng.fork(b.id), `${seed}/boulder-${b.id}`, {
          ...rockOpts,
          detail: r > 1.5 ? 44 : 40,
          creaseDeg: 18,
          crackDepth: Math.min(0.045, 0.03 / r),
          fineCracks: 0.6,
          fineCrackDepth: Math.min(0.015, 0.012 / r),
          micro: Math.min(0.03, 0.025 / r),
          chip: Math.min(0.035, 0.03 / r),
          // bedding ledges: D's deeper, the A / terrace rocks a faint layering the far mesh omits
          strata: b.id === 'shot-d-boulder' ? 0.1 : 0.035,
        });
        const nRng = bRng.fork(`near-${b.id}`);
        const dressed = dressRock(nearGeo, nRng.fork('dressing'), { radius: r, minY: -0.35 * r * squash, cushions: r > 1.5 ? 40 : r > 0.8 ? 24 : 14, lichen: r > 1.5 ? 32 : r > 0.8 ? 20 : 12, shade: toLocal(shadeDir, yaw) }, mossPalette);
        nearGeo.dispose();
        // loose fragments: fist-sized angular spalls (five cleaves, no moss cap) lying at the foot
        // on the un-paved ground, seated on the terrain, folded into the near mesh's local frame
        const fRng = nRng.fork('fragments');
        const inv = new Matrix4().copy(mesh.matrixWorld).invert();
        const parts: { geometry: BufferGeometry; matrix: Matrix4 }[] = [];
        const nFrag = r > 1.5 ? 8 : 6;
        for (let k = 0; k < nFrag * 4 && parts.length < nFrag; k++) {
          const a = fRng.range(0, Math.PI * 2);
          const d = rimAt(a) * fRng.range(1.0, 1.3) + 0.03;
          const x = b.position[0] + Math.cos(a) * d;
          const z = b.position[2] + Math.sin(a) * d;
          if (!notPaved(x, z)) continue;
          const fr = fRng.range(0.045, 0.12) * (0.85 + 0.15 * Math.min(2, r));
          const frag = buildRock(fRng.fork(`frag-${k}`), `${seed}/frag-${b.id}-${k}`, { radius: fr, detail: 2, ridge: 0.22, lump: 0.2, cuts: 5, cutUp: [-0.3, 1], squashY: 0.72, creaseDeg: 35, cracks: 0.3, moss: 0.2, dirt: 0.5, tint: new Color(0.8, 0.79, 0.76), freq: 1 });
          T.normal(x, z, _n);
          _q.setFromUnitVectors(_up, _n.clone().lerp(_up, 0.5).normalize()).multiply(new Quaternion().setFromAxisAngle(_up, fRng.range(0, Math.PI * 2)));
          _p.set(x, T.height(x, z) - fr * 0.15, z);
          parts.push({ geometry: frag, matrix: inv.clone().multiply(new Matrix4().compose(_p, _q, _s.setScalar(1))) });
        }
        const kit = mergeRockParts(dressed.geometry, parts);
        dressed.geometry.dispose();
        for (const p of parts) p.geometry.dispose();
        const nearMesh = new Mesh(kit, mesh.material);
        nearMesh.position.copy(mesh.position);
        nearMesh.rotation.y = yaw;
        nearMesh.castShadow = true;
        nearMesh.receiveShadow = true;
        nearMesh.visible = false;
        nearMesh.name = `boulder-${b.id}-near`;
        nearMesh.updateMatrixWorld(true);
        group.add(nearMesh);
        nearRocks.push({ id: b.id, centre, far: mesh, near: nearMesh, inM, outM, hero, active: false, dist: Infinity, triangles: kit.attributes.position.count / 3, cushions: dressed.stats.cushions, lichen: dressed.stats.lichen, fragments: parts.length });
      }
    }

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
  // (round 24: the strata and pebble variants take cracks 0 - before rockgen normalised its ridged
  // noise their 0.2-0.5 never reached the crack threshold, so the 2 730 pebbles and 159 scree had
  // no crack lines; with it they grew crazed dark lines everywhere on the plaza verges and cost
  // B/C 0.002-0.003 SSIM against take-77 for nothing the frames show. The rubble keeps 0.4.)
  const vRng = rng.fork('variants');
  // the skirt and spill stones are mossy (frame 1 s: the stones at the A rock's foot are green
  // pads with a grey underside), with a thin cushion so the moss has a silhouette
  const rubbleGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`rubble-${i}`), `${seed}/rubble-${i}`, { radius: 1, detail: 3, ridge: 0.2, lump: 0.22, cuts: 3, squashY: 0.75, creaseDeg: 40, cracks: 0.4, moss: 0.65, mossThickness: 0.06, dirt: 0.4, tint: new Color(0.68, 0.67, 0.64), freq: 1 }),
  );
  const strataGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`strata-${i}`), `${seed}/strata-${i}`, { radius: 1, detail: 3, ridge: 0.14, lump: 0.15, cuts: 4, squashY: 0.55, creaseDeg: 30, cracks: 0, moss: 0.65, dirt: 0.5, tint: new Color(0.62, 0.6, 0.56), freq: 1, strata: 0.1 }),
  );
  const pebbleGeos = [0, 1, 2, 3].map((i) =>
    buildRock(vRng.fork(`pebble-${i}`), `${seed}/pebble-${i}`, { radius: 1, detail: 1, ridge: 0.12, lump: 0.25, cuts: 1, squashY: 0.7, creaseDeg: 50, cracks: 0, moss: 0.25, dirt: 0.3, tint: new Color(0.7, 0.69, 0.66), freq: 1 }),
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
  const pathPts = pathPtsAll;
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
  // the boulder-cap plants share the hardscape joint-sprout geometry and wind material; the
  // tufts, ferns and moss pads are packed into one InstancedMesh (one draw for all the cap and
  // crevice plants). The crevice spots go last so the cap / base plants keep their jitter draws.
  boulderPlants.push(...crevicePlants);
  const plants = buildSproutMeshes(boulderPlants, rng.fork('boulder-plants'), createSproutMaterial(ctx.wind, ctx.config), ctx.config, ROCK_PLANT_PACKS);
  for (const m of plants.meshes) {
    m.name = `boulder-plants-${m.name}`;
    group.add(m);
  }

  /**
   * The near-LOD state for the camera at `camera`: with `reset` (an explicit re-pose — the
   * capture harness, the viewpoint keys) recomputed from the distances alone, so a capture's
   * frame never depends on where the camera was before; per frame the hysteresis holds a rock's
   * near version in until its out-radius.
   */
  const nearUpdate = (camera: Camera, reset: boolean) => {
    camera.getWorldPosition(_cam);
    for (const nr of nearRocks) {
      nr.dist = nr.centre.distanceTo(_cam);
      if (reset) nr.active = nr.dist < nr.inM;
      else if (nr.active) nr.active = nr.dist <= nr.outM;
      else nr.active = nr.dist < nr.inM;
      nr.far.visible = !nr.active;
      nr.near.visible = nr.active;
    }
  };

  const samplePebbles = pebbles.filter((_, i) => i % Math.max(1, Math.ceil(pebbles.length / 200)) === 0).slice(0, 200);
  const rnd = (v: number) => Math.round(v * 1000) / 1000;
  ctx.audit('rocks', () => ({
    heroBoulders: boulderInfo.length,
    boulders: boulderInfo,
    /** the highest any hero boulder's underside stands above the terrain (m); 0 = fully seated */
    maxBaseGap: Math.max(0, ...boulderInfo.map((b) => b.baseGap)),
    geometry: 'procedural-v4-near-lod',
    features: ['ridged-displacement', 'crown-lumps', 'bedding-strata', 'cleave-cuts', 'crack-furrows', 'moss-cushion', 'moss-shade-blanket', 'crease-normals', 'crack-vertex-colour', 'moss-upward-faces', 'contact-dirt', 'rubble-skirt', 'spill-stones', 'triplanar-texture', 'lichen-flecks', 'sun-side-moss', 'cap-plants', 'base-plants', 'crevice-plants', 'near-lod', 'near-tile', 'micro-relief', 'fine-cracks', 'chipped-rims', 'wet-band', 'crack-grime', 'moss-pads', 'lichen-plates', 'foot-fragments'],
    mossCoverage: true,
    boulderPlants: plants.count,
    boulderFerns: plants.ferns,
    boulderMossPads: plants.cushions,
    crevicePlants: crevicePlants.length,
    basePlants,
    spillStones,
    /** the hero boulders' near LOD (NEAR_ROCK_IN_M): swap radii, kit sizes and what the current camera shows */
    nearLod: {
      enabled: nearLod,
      inM: NEAR_ROCK_IN_M,
      outM: NEAR_ROCK_OUT_M,
      heroMargin: NEAR_ROCK_HERO_MARGIN,
      tileM: NEAR_TILE_M,
      fadeM: NEAR_FADE_M,
      dropped: nearDropped,
      rocks: nearRocks.map((nr) => ({ id: nr.id, inM: rnd(nr.inM), outM: rnd(nr.outM), hero: Number.isFinite(nr.hero) ? rnd(nr.hero) : null, triangles: nr.triangles, cushions: nr.cushions, lichen: nr.lichen, fragments: nr.fragments, active: nr.active, dist: Number.isFinite(nr.dist) ? rnd(nr.dist) : null })),
      active: nearRocks.filter((nr) => nr.active).map((nr) => nr.id),
    },
    boulderPlantDrawCalls: plants.meshes.length,
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

  return {
    name: 'rocks',
    group,
    update(_dt, _t, c) {
      nearUpdate(c.camera, false);
    },
    onCameraMove(camera) {
      nearUpdate(camera, true);
    },
    dispose() {
      for (const nr of nearRocks) nr.near.geometry.dispose();
    },
  };
}
