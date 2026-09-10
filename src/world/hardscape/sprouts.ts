/**
 * Joint sprouts (W21): small grass / weed tufts growing out of flagstone and stair joints.
 * Geometry blades (no alpha cards), two tuft variants, GPU instanced, animated with the shared
 * wind model's `windGrass` so they ripple with the rest of the vegetation.
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { Rng } from '../util/prng';
import type { Wind } from '../wind/wind';
import { WIND_GLSL } from '../wind/wind';
import type { WorldConfig } from '../config';

export interface SproutSpot {
  x: number;
  y: number;
  z: number;
  /** 0..1 size factor */
  size: number;
}

function buildTuft(rng: Rng, blades: number, height: number, spread: number, deep: Color, light: Color): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const wind: number[] = []; // (heightFactor, phase)
  const uv: number[] = [];
  const tmp = new Color();
  for (let b = 0; b < blades; b++) {
    const ang = (b / blades) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const lean = rng.range(0.25, 0.75) * spread;
    const h = height * rng.range(0.55, 1.15);
    const wBase = rng.range(0.006, 0.013);
    const segs = 3;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const phase = rng();
    const t0 = rng.range(0.1, 0.6);
    const pts: number[][] = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // curve outward with height (quadratic), taper to a point
      const bend = lean * t * t;
      const y = h * t;
      const w = wBase * (1 - t * 0.92);
      pts.push([dx * bend, y, dz * bend, w, t]);
    }
    const ox = rng.range(-0.02, 0.02);
    const oz = rng.range(-0.02, 0.02);
    for (let s = 0; s < segs; s++) {
      const a = pts[s];
      const c = pts[s + 1];
      // blade lies in the plane perpendicular to its lean direction
      const px = -dz;
      const pz = dx;
      const quad = [
        [a[0] - px * a[3] + ox, a[1], a[2] - pz * a[3] + oz, a[4]],
        [a[0] + px * a[3] + ox, a[1], a[2] + pz * a[3] + oz, a[4]],
        [c[0] + px * c[3] + ox, c[1], c[2] + pz * c[3] + oz, c[4]],
        [c[0] - px * c[3] + ox, c[1], c[2] - pz * c[3] + oz, c[4]],
      ];
      const tri = (i: number, j: number, k: number) => {
        for (const q of [quad[i], quad[j], quad[k]]) {
          pos.push(q[0], q[1], q[2]);
          // normal: mostly up with a tilt toward the blade face
          nrm.push(dx * 0.35, 0.85, dz * 0.35);
          const t = q[3];
          tmp.copy(deep).lerp(light, t0 + t * 0.5);
          col.push(tmp.r, tmp.g, tmp.b);
          wind.push(t, phase);
          uv.push(0, t);
        }
      };
      tri(0, 1, 2);
      tri(0, 2, 3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aWind', new Float32BufferAttribute(wind, 2));
  g.computeBoundingSphere();
  return g;
}

/** clover: three short stalks, each carrying three round leaflets (reference joints show clover among the grass tufts) */
function buildClover(rng: Rng, height: number, deep: Color, light: Color): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const wind: number[] = [];
  const uv: number[] = [];
  const tmp = new Color();
  const push = (p: number[], n: number[], c: Color, wf: number, phase: number) => {
    pos.push(p[0], p[1], p[2]);
    nrm.push(n[0], n[1], n[2]);
    col.push(c.r, c.g, c.b);
    wind.push(wf, phase);
    uv.push(0, wf);
  };
  const stalks = 3;
  for (let s = 0; s < stalks; s++) {
    const ang = (s / stalks) * Math.PI * 2 + rng.range(-0.5, 0.5);
    const h = height * rng.range(0.7, 1.15);
    const lean = rng.range(0.008, 0.02);
    const phase = rng();
    const bx = rng.range(-0.015, 0.015);
    const bz = rng.range(-0.015, 0.015);
    const tx = bx + Math.cos(ang) * lean;
    const tz = bz + Math.sin(ang) * lean;
    // stem: one thin quad
    const sw = 0.0025;
    const px = -Math.sin(ang) * sw;
    const pz = Math.cos(ang) * sw;
    tmp.copy(deep);
    const stem = [
      [bx - px, 0, bz - pz],
      [bx + px, 0, bz + pz],
      [tx + px, h, tz + pz],
      [tx - px, h, tz - pz],
    ];
    const sn = [0, 0.7, 0];
    push(stem[0], sn, tmp, 0, phase);
    push(stem[1], sn, tmp, 0, phase);
    push(stem[2], sn, tmp, 1, phase);
    push(stem[0], sn, tmp, 0, phase);
    push(stem[2], sn, tmp, 1, phase);
    push(stem[3], sn, tmp, 1, phase);
    // three leaflets, slightly cupped, around the stalk top
    const r = height * rng.range(0.28, 0.4);
    for (let l = 0; l < 3; l++) {
      const la = ang + (l / 3) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const cx = tx + Math.cos(la) * r * 0.9;
      const cz = tz + Math.sin(la) * r * 0.9;
      const cy = h + 0.004 + rng.range(-0.002, 0.002);
      const ux = Math.cos(la) * r * 0.55;
      const uz = Math.sin(la) * r * 0.55;
      const vx = -Math.sin(la) * r * 0.5;
      const vz = Math.cos(la) * r * 0.5;
      const droop = 0.004;
      const n = [Math.cos(la) * 0.25, 0.95, Math.sin(la) * 0.25];
      // diamond leaflet: centre + four rim points, rim drooping a little
      const c0 = [cx, cy, cz];
      const rim = [
        [cx - ux, cy - droop, cz - uz],
        [cx + vx, cy - droop, cz + vz],
        [cx + ux, cy - droop, cz + uz],
        [cx - vx, cy - droop, cz - vz],
      ];
      for (let k = 0; k < 4; k++) {
        tmp.copy(light).lerp(deep, 0.15);
        push(c0, n, tmp, 1, phase);
        tmp.copy(deep).lerp(light, 0.35);
        push(rim[k], n, tmp, 1, phase);
        push(rim[(k + 1) % 4], n, tmp, 1, phase);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('aWind', new Float32BufferAttribute(wind, 2));
  g.computeBoundingSphere();
  return g;
}

/** sprouts collapse to their base beyond this camera distance (a LOD cull without extra draw calls) */
export const SPROUT_LOD_FAR = 25;

export function createSproutMaterial(wind: Wind, _config: WorldConfig): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: DoubleSide });
  mat.name = 'joint-sprouts';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSproutLodFar = { value: SPROUT_LOD_FAR };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nattribute vec2 aWind; uniform float uSproutLodFar;`)
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        // LOD: tufts further than uSproutLodFar from the camera shrink onto their base point over
        // the last 4 m, so distant joints cost no fill and the near ones keep their blades
        vec3 sproutBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sproutLod = 1.0 - smoothstep(uSproutLodFar - 4.0, uSproutLodFar, distance(sproutBase, cameraPosition));
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed * sproutLod, 1.0);
        wp.xyz += windGrass(wp.xyz, aWind.x, aWind.y, 0.3) * sproutLod;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => 'joint-sprouts-wind-v2-lod';
  return wind.bind(mat);
}

export function buildSproutMeshes(spots: SproutSpot[], rng: Rng, material: MeshStandardMaterial, config: WorldConfig): { meshes: InstancedMesh[]; count: number; variants: number } {
  // Reference (B/E/D): small dark-green grass tufts and clover growing from the joints across
  // the whole plaza, 6–12 cm tall — the deep/mid grass greens, not lime blades.
  const deep = new Color(config.palette.grassDeep).lerp(new Color(config.palette.grassMid), 0.3);
  const light = new Color(config.palette.grassMid).lerp(new Color(config.palette.grassLight), 0.45);
  const variants = [
    buildTuft(rng.fork('tuft-a'), 7, 0.08, 0.035, deep, light),
    buildTuft(rng.fork('tuft-b'), 9, 0.11, 0.05, deep, light),
    buildTuft(rng.fork('tuft-c'), 5, 0.065, 0.03, deep, light),
    buildClover(rng.fork('clover'), 0.05, deep, light),
  ];
  const lists: SproutSpot[][] = variants.map(() => []);
  for (const s of spots) lists[s.size > 0.7 ? 1 : s.size > 0.42 ? 0 : s.size > 0.2 ? 2 : 3].push(s);
  const meshes: InstancedMesh[] = [];
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const sc = new Vector3();
  const up = new Vector3(0, 1, 0);
  const c = new Color();
  let count = 0;
  lists.forEach((list, v) => {
    if (!list.length) return;
    const im = new InstancedMesh(variants[v], material, list.length);
    list.forEach((s, i) => {
      const k = 0.9 + rng.range(0, 0.2);
      p.set(s.x, s.y - 0.01, s.z);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      sc.set(k, k * rng.range(0.9, 1.1), k);
      im.setMatrixAt(i, m.compose(p, q, sc));
      c.setRGB(0.78 + rng.range(0, 0.25), 0.8 + rng.range(0, 0.25), 0.75 + rng.range(0, 0.2));
      im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.name = `joint-sprouts-v${v}`;
    im.computeBoundingSphere();
    meshes.push(im);
    count += list.length;
  });
  return { meshes, count, variants: variants.length };
}
