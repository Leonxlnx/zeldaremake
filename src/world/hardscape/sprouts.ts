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

function buildTuft(rng: Rng, blades: number, height: number, spread: number): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const wind: number[] = []; // (heightFactor, phase)
  const uv: number[] = [];
  const deep = new Color(0x3f6a2c);
  const light = new Color(0x9fc25a);
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

export function createSproutMaterial(wind: Wind, _config: WorldConfig): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: DoubleSide });
  mat.name = 'joint-sprouts';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nattribute vec2 aWind;`)
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        wp.xyz += windGrass(wp.xyz, aWind.x, aWind.y, 0.3);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => 'joint-sprouts-wind-v1';
  return wind.bind(mat);
}

export function buildSproutMeshes(spots: SproutSpot[], rng: Rng, material: MeshStandardMaterial): { meshes: InstancedMesh[]; count: number } {
  const variants = [buildTuft(rng.fork('tuft-a'), 6, 0.11, 0.05), buildTuft(rng.fork('tuft-b'), 8, 0.17, 0.08), buildTuft(rng.fork('tuft-c'), 5, 0.08, 0.04)];
  const lists: SproutSpot[][] = variants.map(() => []);
  for (const s of spots) lists[s.size > 0.66 ? 1 : s.size > 0.33 ? 0 : 2].push(s);
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
      const k = 0.75 + rng.range(0, 0.6);
      p.set(s.x, s.y - 0.01, s.z);
      q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
      sc.set(k, k * rng.range(0.8, 1.25), k);
      im.setMatrixAt(i, m.compose(p, q, sc));
      c.setRGB(0.8 + rng.range(0, 0.35), 0.85 + rng.range(0, 0.3), 0.7 + rng.range(0, 0.3));
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
  return { meshes, count };
}
