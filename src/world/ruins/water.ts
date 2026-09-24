/**
 * Round 57 (expansion-ruins): the ruins' water — the pool's surface, the fall's sheet pouring over
 * the cliff's notched lip, and the spray and mist over its plunge.
 *
 * Every motion is a function of one time uniform (`update(t)`, deterministic under the capture
 * harness): the pool's ripples, the rings and foam drifting out from the plunge, the sheet's
 * streaks (their phase is the time of flight, so a streak accelerates as it falls), the droplets'
 * arcs and the mist's drift. Nothing here is a light: the whitewater's glow is a small emissive
 * share (light scattered inside the aerated water), capped well under white.
 *
 * - pool: a grid over the basin (terrain/ruins.ts POOL_BOX) out to where the live ground has risen
 *   over the waterline; per-vertex depth (waterline − ground) drives the colour (a peaty green over
 *   the shallows to a dark teal), the opacity (the bed shows through the shelf, the edge fades out
 *   on the bank) and the shore foam; the normal is gentle wind ripples, a fine breakup and the
 *   plunge's rings; the scene's environment is its reflection (Fresnel lifts the opacity at a
 *   grazing view).
 * - sheet: one column per z across the fall, each following the cliff's own surface (rock.ts
 *   `cliffPoint`) down the brow to the lip, then a ballistic arc to the waterline, held clear of
 *   the face's relief; a front layer (the flow's core, ropier and whiter) leaves the lip faster
 *   and parts from it as it falls, so the sheet has thickness from the side (one draw).
 * - spray / mist: camera-facing quads animated in the vertex shader (one draw): droplets thrown up
 *   and out of the plunge, mist puffs rolling off it and up the fall's foot.
 */
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sphere,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { EXPANSION_RUINS } from '../layout';
import { CLIFF_FACE_V, POOL_BOX, POOL_WATER_Y, cliffFaceAt, cliffFaceX, poolSigned } from '../terrain/ruins';
import { clamp } from '../util/noise';
import type { Rng } from '../util/prng';
import { cliffPoint } from './rock';

const R = EXPANSION_RUINS;
const F = R.fall;
type Ground = (x: number, z: number) => number;

/** the sheet's speed over the lip (m/s, outward): enough to land it clear of the cliff's foot in the plunge */
const LIP_SPEED = 1.5;
/** the front layer's (the flow's core): it lands ≈ 0.6 m out past the back layer */
const LIP_SPEED_FRONT = 1.9;
/** the water's skin over the rock of the brow (m; the mesh's chord over the lip's corner stands ≈ 4 cm proud of the surface) */
const SKIN = 0.09;
const GRAVITY = 9.81;

export interface Water {
  meshes: Mesh[];
  materials: Material[];
  /** the plunge's centre on the waterline (x, z) */
  plunge: [number, number];
  update(t: number): void;
}

const f = (v: number) => v.toFixed(4);

const NOISE_GLSL = /* glsl */ `
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p); vec2 fr = fract(p); fr = fr * fr * (3.0 - 2.0 * fr);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), fr.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), fr.x), fr.y);
  }
`;

// ---------------------------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------------------------

/** the pool's surface: a 0.35 m grid over the basin, kept where the bank has not yet risen over the water */
function poolGeometry(ground: Ground): BufferGeometry {
  const STEP = 0.35;
  const x0 = POOL_BOX.x0;
  const z0 = POOL_BOX.z0;
  const nx = Math.ceil((POOL_BOX.x1 - x0) / STEP);
  const nz = Math.ceil((POOL_BOX.z1 - z0) / STEP);
  const pos: number[] = [];
  const nrm: number[] = [];
  const depth: number[] = [];
  const keep: boolean[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * STEP;
      const z = z0 + j * STEP;
      pos.push(x, POOL_WATER_Y, z);
      nrm.push(0, 1, 0);
      depth.push(clamp(POOL_WATER_Y - ground(x, z), 0, 3));
      // past the shore by more than a lattice cell the rim stands ≥ 0.7 m over the water (and the
      // cliff's foot and the wall's footing are opaque over what is left inside them)
      keep.push(poolSigned(x, z) < 1.0 && x > cliffFaceX(z, 0.5) - 0.6);
    }
  }
  const idx: number[] = [];
  const row = nx + 1;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      if (!(keep[a] || keep[b] || keep[c] || keep[d])) continue;
      if (Math.max(depth[a], depth[b], depth[c], depth[d]) <= 0) continue;
      // wound to face +y
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('aDepth', new Float32BufferAttribute(depth, 1));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

interface SheetInfo {
  geometry: BufferGeometry;
  /** the centre column's landing point on the waterline */
  landX: number;
  /** the lip's height and the run-in's start (texture time, s) */
  lipY: number;
  runS0: number;
}

/**
 * The fall's sheet in two layers (one mesh, the back layer's triangles first): the back, per column
 * the run-in over the brow (on the rock + SKIN), the lip, then the arc to the waterline; the front,
 * the flow's core, from a little proud of the lip at LIP_SPEED_FRONT, so it parts from the back as
 * it falls and the sheet thickens toward the plunge. uv = (across 0…1, time of flight in s —
 * negative on the run-in), `aLayer` 0 back / 1 front.
 */
function sheetGeometry(ground: Ground): SheetInfo {
  const NU = 20;
  const RUN = [0.15, 0.11, 0.075, 0.045, 0.02, 0.0];
  const FALL = 40;
  const pos: number[] = [];
  const uv: number[] = [];
  const nrm: number[] = [];
  const layer: number[] = [];
  const idx: number[] = [];
  let landX: number = F.x;
  let lipY: number = F.top;
  let runS0 = -1;
  for (const front of [false, true]) {
    const v0 = pos.length / 3;
    const rows = (front ? 0 : RUN.length) + 1 + FALL;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const across = u - 0.5;
      const width = front ? 0.86 : 0.94;
      const zTop = F.z + across * F.width * width;
      const path: { p: Vector3; s: number }[] = [];
      const lip = cliffPoint(zTop, CLIFF_FACE_V, ground).p;
      lip.x += front ? 0.12 : 0.05;
      lip.y += SKIN + (front ? 0.02 : 0);
      if (!front) {
        // the run-in: over the brow toward the lip (texture time counts back from the lip at 1.1 m/s)
        const brow: Vector3[] = RUN.map((s) => {
          const p = cliffPoint(zTop, CLIFF_FACE_V + (1 - CLIFF_FACE_V) * s, ground).p;
          p.y += SKIN;
          return p;
        });
        let dist = 0;
        const back: number[] = [];
        for (let k = brow.length - 1; k >= 0; k--) {
          dist += brow[k].distanceTo(k === brow.length - 1 ? lip : brow[k + 1]);
          back[k] = dist;
        }
        for (let k = 0; k < brow.length; k++) path.push({ p: brow[k], s: -back[k] / 1.1 });
      }
      path.push({ p: lip.clone(), s: 0 });
      // the arc: ballistic from the lip, held clear of the face where it bulges
      const drop = lip.y - (POOL_WATER_Y - 0.06);
      const T = Math.sqrt((2 * drop) / GRAVITY);
      for (let k = 1; k <= FALL; k++) {
        const t = (T * k) / FALL;
        const y = lip.y - 0.5 * GRAVITY * t * t;
        const spread = width + (front ? 0.3 : 0.2) * (t / T);
        const sway = front ? 0.09 * Math.sin(t * 2.3 + u * 7.0 + 1.7) : 0.06 * Math.sin(t * 3.1 + u * 9.0);
        const z = F.z + across * F.width * spread + sway * (t / T);
        const x = Math.max(lip.x + (front ? LIP_SPEED_FRONT : LIP_SPEED) * t, cliffFaceAt(z, y, ground) + (front ? 0.2 : 0.12));
        path.push({ p: new Vector3(x, y, z), s: t });
        if (!front && k === FALL && i === NU / 2) landX = x;
      }
      if (!front && i === NU / 2) {
        lipY = lip.y;
        runS0 = path[0].s;
      }
      for (const q of path) {
        pos.push(q.p.x, q.p.y, q.p.z);
        uv.push(u, q.s);
        nrm.push(1, 0, 0);
        layer.push(front ? 1 : 0);
      }
    }
    for (let i = 0; i < NU; i++) {
      for (let k = 0; k + 1 < rows; k++) {
        const a = v0 + i * rows + k;
        const b = a + 1;
        const c = a + rows;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('aLayer', new Float32BufferAttribute(layer, 1));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  // face the normals out of the cliff (+x) whichever way the grid wound
  const n = g.attributes.normal.array as Float32Array;
  let sx = 0;
  for (let k = 0; k < n.length; k += 3) sx += n[k];
  if (sx < 0) {
    for (let k = 0; k < n.length; k++) n[k] = -n[k];
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
    g.setIndex(new Uint32BufferAttribute(idx, 1));
  }
  g.computeBoundingSphere();
  return { geometry: g, landX, lipY, runS0 };
}

/**
 * The spray and the mist: one quad per particle (all four corners at its origin), `aCorner` the
 * corner, `aSeed` (phase, kind 0 droplet / 1 mist, size, shade), `aVel` its launch velocity.
 */
function particleGeometry(rng: Rng, landX: number, ground: Ground): BufferGeometry {
  const pos: number[] = [];
  const corner: number[] = [];
  const seed: number[] = [];
  const vel: number[] = [];
  const idx: number[] = [];
  const quad = (o: [number, number, number], s: [number, number, number, number], v: [number, number, number]) => {
    const base = pos.length / 3;
    for (const [cx, cy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      pos.push(o[0], o[1], o[2]);
      corner.push(cx, cy);
      seed.push(...s);
      vel.push(...v);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const W = POOL_WATER_Y;
  const half = F.width * 0.55;
  // droplets thrown up and out of the plunge
  const dr = rng.fork('droplets');
  for (let k = 0; k < 220; k++) {
    const o: [number, number, number] = [landX + dr.range(-0.45, 0.8), W + 0.08, F.z + dr.range(-half, half)];
    const s: [number, number, number, number] = [dr(), 0, dr(), dr()];
    const v: [number, number, number] = [dr.range(0.3, 2.3), dr.range(1.1, 3.3), dr.range(-1.1, 1.1)];
    quad(o, s, v);
  }
  // mist rolling off the plunge over the pool
  const mr = rng.fork('mist');
  for (let k = 0; k < 30; k++) {
    const o: [number, number, number] = [landX + mr.range(-0.3, 2.6), W + mr.range(0.35, 1.5), F.z + mr.range(-2.3, 2.3)];
    const s: [number, number, number, number] = [mr(), 1, mr(), mr()];
    const v: [number, number, number] = [mr.range(0.12, 0.5), mr.range(0.06, 0.3), mr.range(-0.16, 0.16)];
    quad(o, s, v);
  }
  // mist hanging up the fall's foot, in front of the sheet
  for (let k = 0; k < 12; k++) {
    const y = W + mr.range(1.0, 3.8);
    const z = F.z + mr.range(-1.6, 1.6);
    const x = Math.max(landX - 0.2, cliffFaceAt(z, y, ground) + 0.7) + mr.range(0.1, 0.6);
    const s: [number, number, number, number] = [mr(), 1, mr() * 0.6, mr()];
    const v: [number, number, number] = [mr.range(0.1, 0.3), mr.range(0.04, 0.18), mr.range(-0.1, 0.1)];
    quad([x, y, z], s, v);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aCorner', new Float32BufferAttribute(corner, 2));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 4));
  g.setAttribute('aVel', new Float32BufferAttribute(vel, 3));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  // the particles travel up to ≈ 4 m from their origins
  g.computeBoundingSphere();
  const bs = g.boundingSphere as Sphere;
  g.boundingSphere = new Sphere(bs.center.clone().add(new Vector3(0.8, 1.2, 0)), bs.radius + 4.5);
  return g;
}

// ---------------------------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------------------------

function poolMaterial(time: { value: number }, plunge: Vector2): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.14, metalness: 0, transparent: true, envMapIntensity: 0.9 });
  mat.name = 'ruins-pool';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    shader.uniforms.uPlunge = { value: plunge };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth; varying float vWDepth; varying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWDepth = aDepth; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform vec2 uPlunge; varying float vWDepth; varying vec3 vWPos;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        vec2 wP = vWPos.xz;
        vec2 wD = wP - uPlunge;
        float wR = length(wD);
        vec2 wDir = wD / max(wR, 1e-3);
        // foam: carried out from the plunge (faster close in) and drifting east with the outflow
        vec2 wAdv = wP - wDir * uTime * 0.5 * (1.0 - smoothstep(1.0, 8.0, wR)) - vec2(0.07, 0.0) * uTime;
        float wCell = 0.6 * wNoise(wAdv * 1.7) + 0.4 * wNoise(wAdv * 4.3 + 7.0);
        float wPl = (1.0 - smoothstep(0.35, 2.6, wR)) * (0.5 + 0.5 * wCell);
        float wTr = (1.0 - smoothstep(1.8, 7.5, wR)) * smoothstep(0.6, 0.82, wCell) * 0.7;
        float wSh = (1.0 - smoothstep(0.015, 0.1, vWDepth)) * smoothstep(0.5, 0.75, wNoise(wP * 3.1 + uTime * 0.05)) * 0.5;
        float wFoam = clamp(max(max(wPl, wTr), wSh), 0.0, 1.0);
        vec3 wCol = mix(vec3(0.075, 0.112, 0.085), vec3(0.012, 0.04, 0.038), smoothstep(0.05, 1.2, vWDepth));
        float wEdge = smoothstep(0.0, 0.05, vWDepth);
        diffuseColor.rgb = mix(wCol, vec3(0.6, 0.625, 0.615), wFoam);
        diffuseColor.a = mix(mix(0.34, 0.93, smoothstep(0.0, 1.0, vWDepth)), 0.95, wFoam) * wEdge;`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.82, wFoam);')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        {
          vec2 g = vec2(0.0);
          // gentle wind ripples from three directions
          g += 0.022 * cos(dot(wP, vec2(0.91, 0.41)) * 5.3 - uTime * 1.7) * vec2(0.91, 0.41);
          g += 0.017 * cos(dot(wP, vec2(-0.35, 0.94)) * 7.9 - uTime * 2.3) * vec2(-0.35, 0.94);
          g += 0.011 * cos(dot(wP, vec2(0.6, -0.8)) * 12.7 - uTime * 3.1) * vec2(0.6, -0.8);
          // fine breakup
          vec2 q = wP * 2.3 + vec2(0.21, 0.13) * uTime;
          float h0 = wNoise(q);
          g += 0.028 * vec2(wNoise(q + vec2(0.16, 0.0)) - h0, wNoise(q + vec2(0.0, 0.16)) - h0) / 0.16;
          // the plunge's rings and churn
          float ring = 0.13 * exp(-wR * 0.45);
          g += ring * cos(wR * 9.0 - uTime * 7.0) * wDir + 0.12 * (1.0 - smoothstep(0.0, 2.4, wR)) * (vec2(wCell, wNoise(wAdv * 2.9 + 3.0)) - 0.5);
          vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
          normal = normalize(mat3(viewMatrix) * nW);
          // Fresnel: at a grazing view the surface reflects and the bed hides
          float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
          diffuseColor.a = max(diffuseColor.a, 0.92 * fres * wEdge);
        }`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.045, 0.05, 0.05) * wFoam;')
      .replace(
        '#include <lights_fragment_end>',
        // the sun's glint stays a highlight, never a clipped blot
        '#include <lights_fragment_end>\nreflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(1.3));\nreflectedLight.indirectSpecular = min(reflectedLight.indirectSpecular, vec3(0.8));',
      );
  };
  mat.customProgramCacheKey = () => 'ruins-pool-v1';
  return mat;
}

function sheetMaterial(time: { value: number }, lipY: number, runS0: number): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, transparent: true, depthWrite: false, side: DoubleSide });
  mat.name = 'ruins-fall';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer; varying vec2 vFUv; varying vec3 vFPos; varying float vFLayer;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvFUv = uv; vFPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vFLayer = aLayer;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; varying vec2 vFUv; varying vec3 vFPos; varying float vFLayer;\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        float fFall = clamp((${f(lipY)} - vFPos.y) / ${f(lipY - POOL_WATER_Y)}, 0.0, 1.0);
        // the front layer's streaks are its own (shifted across and in phase)
        float fPh = vFUv.y - uTime + 0.53 * vFLayer;
        float fU = vFUv.x + 0.37 * vFLayer;
        // streaks: long along the flow, narrow across; finer as the water accelerates and breaks up
        float fA = wNoise(vec2(fU * 26.0, fPh * 1.6));
        float fB = wNoise(vec2(fU * 71.0 + 5.3, fPh * 4.2));
        float fC = wNoise(vec2(fU * 9.0 - 2.1, fPh * 0.7));
        float fDens = 0.45 * fA + 0.3 * fB + 0.25 * fC;
        // the sides thin and fray, more so lower down
        float fEdge = min(vFUv.x, 1.0 - vFUv.x) * 2.0;
        float fBody = smoothstep(0.0, 0.22 + 0.4 * fFall, fEdge + 0.35 * (fDens - 0.5));
        // the front layer is ropes of white water, the back sheet showing between them
        fBody *= mix(1.0, smoothstep(0.4, 0.6, fDens), vFLayer);
        // aeration: glassy over the brow, white once it has broken over the lip
        float fAir = smoothstep(-0.25, 0.3, vFUv.y);
        float fWhite = fAir * smoothstep(0.3 + 0.08 * vFLayer, 0.78 - 0.1 * vFLayer, fDens) * (0.65 + 0.35 * fFall);
        vec3 fCol = mix(vec3(0.1, 0.15, 0.14), vec3(0.34, 0.43, 0.43), fAir);
        fCol = mix(fCol, vec3(0.7, 0.735, 0.725), fWhite);
        float fAlpha = fBody * mix(mix(0.72, 0.5, fAir), 0.93, fWhite) * mix(1.0, 0.85, vFLayer);
        // fade in at the run-in's start (the front layer just under the lip) and out into the plunge's foam
        fAlpha *= smoothstep(${f(runS0)}, ${f(runS0 + 0.3)}, vFUv.y) * mix(1.0, smoothstep(0.0, 0.14, vFUv.y), vFLayer);
        fAlpha *= smoothstep(${f(POOL_WATER_Y - 0.02)}, ${f(POOL_WATER_Y + 0.35)}, vFPos.y);
        diffuseColor.rgb = fCol;
        diffuseColor.a = fAlpha;`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.12, 0.55, fAir);')
      // light scattered inside the aerated water: a glow well under white
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fCol * (0.05 + 0.13 * fWhite);')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(1.0));');
  };
  mat.customProgramCacheKey = () => 'ruins-fall-v2';
  return mat;
}

function particleMaterial(time: { value: number }): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
  mat.name = 'ruins-spray';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; attribute vec2 aCorner; attribute vec4 aSeed; attribute vec3 aVel; varying vec2 vPCorner; varying float vPLife; varying float vPKind; varying float vPY; varying float vPShade;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        float pKind = aSeed.y;
        float pPeriod = pKind < 0.5 ? 0.9 + 0.6 * aSeed.z : 5.0 + 4.0 * aSeed.z;
        float pAge = fract(uTime / pPeriod + aSeed.x);
        float pT = pAge * pPeriod;
        vec3 pC = position + aVel * pT;
        float pSize;
        if (pKind < 0.5) {
          // droplets: a dragged ballistic arc, spreading into mist as they go
          pC.y -= 0.5 * 9.81 * 0.62 * pT * pT;
          pSize = 0.03 + 0.05 * aSeed.w + 0.14 * pAge * pAge;
        } else {
          pSize = (0.8 + 1.1 * aSeed.z) * (0.65 + 0.7 * pAge);
        }
        vec4 mvPosition = modelViewMatrix * vec4(pC, 1.0);
        mvPosition.xy += aCorner * pSize;
        gl_Position = projectionMatrix * mvPosition;
        vPCorner = aCorner; vPLife = pAge; vPKind = pKind; vPY = pC.y + aCorner.y * pSize * 0.9; vPShade = aSeed.w;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vPCorner; varying float vPLife; varying float vPKind; varying float vPY; varying float vPShade;\n${NOISE_GLSL}`)
      .replace(
        '#include <alphamap_fragment>',
        /* glsl */ `
        {
          float r = length(vPCorner);
          float life = smoothstep(0.0, 0.14, vPLife) * (1.0 - smoothstep(0.5, 1.0, vPLife));
          float a;
          vec3 c;
          if (vPKind < 0.5) {
            // a ragged speck that thins as it spreads (round soft discs stack into white balls where they overlap)
            float n = wNoise(vPCorner * 2.3 + vec2(vPShade * 23.0, vPLife * 2.0));
            a = (1.0 - smoothstep(0.0, 0.85, r + 0.45 * (n - 0.5))) * mix(0.28, 0.06, vPLife);
            c = vec3(0.55, 0.6, 0.6);
          } else {
            float n = wNoise(vPCorner * 1.3 + vec2(vPShade * 17.0, vPLife * 1.5)) * 0.6 + wNoise(vPCorner * 3.1 - vec2(vPLife, vPShade * 9.0)) * 0.4;
            a = (1.0 - smoothstep(0.1, 1.0, r)) * smoothstep(0.2, 0.75, n + 0.25 * (1.0 - r)) * 0.15;
            c = mix(vec3(0.46, 0.51, 0.51), vec3(0.55, 0.6, 0.6), vPShade);
          }
          // never under the water's skin
          a *= life * smoothstep(${f(POOL_WATER_Y - 0.05)}, ${f(POOL_WATER_Y + 0.45)}, vPY);
          diffuseColor = vec4(c, a);
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'ruins-spray-v2';
  return mat;
}

// ---------------------------------------------------------------------------------------------

export function buildWater(rng: Rng, ground: Ground): Water {
  const time = { value: 0 };
  const sheet = sheetGeometry(ground);
  const plunge = new Vector2(sheet.landX, F.z);
  const poolMat = poolMaterial(time, plunge);
  const sheetMat = sheetMaterial(time, sheet.lipY, sheet.runS0);
  const sprayMat = particleMaterial(time);
  const pool = new Mesh(poolGeometry(ground), poolMat);
  const fall = new Mesh(sheet.geometry, sheetMat);
  const spray = new Mesh(particleGeometry(rng, sheet.landX, ground), sprayMat);
  pool.name = 'ruins-pool';
  fall.name = 'ruins-fall';
  spray.name = 'ruins-spray';
  // the pool first, then the sheet over it, the spray and mist last
  pool.renderOrder = 1;
  fall.renderOrder = 2;
  spray.renderOrder = 3;
  for (const m of [pool, fall, spray]) {
    m.castShadow = false;
    m.receiveShadow = m !== spray;
  }
  return {
    meshes: [pool, fall, spray],
    materials: [poolMat, sheetMat, sprayMat],
    plunge: [sheet.landX, F.z],
    update(t: number) {
      // wrapped hourly: the shader's hash noise loses its grain at very large arguments
      time.value = t % 3600;
    },
  };
}
