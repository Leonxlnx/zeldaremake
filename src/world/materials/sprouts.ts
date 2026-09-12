/**
 * Shared small-plant instancing (tufts, clover, moss cushions, fern fronds, seam grit) with variant
 * packs: legacy pack traversal preserves jitter; optional separate batches omit collapsed variants.
 * Lives in
 * materials/ because hardscape (joint sprouts) and rocks (boulder cap plants) both build with it —
 * systems must not import each other's internals (AGENTS.md rule 1).
 *
 * Joint sprouts (W21): small grass / weed tufts growing out of flagstone and stair joints, plus
 * the moss cushions and the seam grit that live in the same joints. Geometry blades (no alpha
 * cards), GPU instanced, animated with the shared wind model's `windGrass` so they ripple with
 * the rest of the vegetation. `HARDSCAPE_PACKS` keeps the original four-pack traversal; hardscape
 * opts into six variant batches to avoid submitting the other variants for every instance.
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Uint8BufferAttribute,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { Rng } from '../util/prng';
import type { Wind } from '../wind/wind';
import { WIND_GLSL } from '../wind/wind';
import type { WorldConfig } from '../config';
import { DEFAULT_GRIT_TONE, buildGritGeometry } from './grit';

export interface SproutSpot {
  x: number;
  y: number;
  z: number;
  /** 0..1 size factor (picks the tuft / clover variant; cushion radius); for 'grit' the pebble radius in metres */
  size: number;
  /**
   * 'cushion' = low moss dome (seam junctions, tread/riser corners); 'fern' = small frond
   * (boulder cracks); 'grit' = a small stone packed into the dirt seam
   */
  kind?: 'tuft' | 'cushion' | 'fern' | 'grit';
  /** overall scale multiplier (default 1) */
  scale?: number;
  /** 'grit': albedo multiplier of the fill under the pebble (joints.ts `jointFillLift`); default 1 */
  tint?: [number, number, number];
  /**
   * The scatter that sowed this spot (e.g. 'joints', 'seam-grit'). With `buildSproutMeshes`'s
   * `jitter` option, the instance's rotation / scale / tint randoms come from the stream of
   * (source, variant), so spots added to or removed from another source leave it byte-identical.
   */
  source?: string;
}

/**
 * Per-(source, variant) jitter streams for `buildSproutMeshes`: called once for each pair on first
 * use; the returned stream is drawn in the spots' list order for that pair only.
 */
export type SproutJitterStreams = (source: string | undefined, variant: number) => Rng;

/**
 * Moss cushion: a low dome (unit radius, 0.3 high) in deep→bright moss green with a faintly
 * lumpy top — the pads that sit in wide seam junctions and at the stair tread/riser corners
 * (concept sheet 02 'Moss edges', sheet 04 stairs inset). No wind (heightFactor 0).
 */
function buildCushion(rng: Rng, deep: Color, light: Color): BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const wind: number[] = [];
  const uv: number[] = [];
  const segs = 10;
  const rings = 3;
  const tmp = new Color();
  const phase = rng();
  const bump = Array.from({ length: segs * (rings + 1) }, () => rng.range(0.9, 1.1));
  const pt = (r: number, s: number): number[] => {
    // r = 0 is the crown, r = rings the rim; profile: cos dome squashed to 0.3 of the radius
    const t = r / rings;
    const a = (s / segs) * Math.PI * 2 + (r & 1 ? Math.PI / segs : 0);
    const rad = Math.sin((t * Math.PI) / 2) * (0.92 + 0.12 * bump[r * segs + (s % segs)]);
    const h = 0.3 * Math.cos((t * Math.PI) / 2) * bump[r * segs + (s % segs)];
    return [Math.cos(a) * rad, h, Math.sin(a) * rad, t];
  };
  const push = (p: number[]) => {
    pos.push(p[0], p[1], p[2]);
    // dome normal ≈ direction from a point below the centre
    const l = Math.hypot(p[0], p[1] + 0.35, p[2]) || 1;
    nrm.push(p[0] / l, (p[1] + 0.35) / l, p[2] / l);
    tmp.copy(light).lerp(deep, 0.25 + 0.7 * p[3]);
    col.push(tmp.r, tmp.g, tmp.b);
    wind.push(0, phase);
    uv.push(0, p[3]);
  };
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = pt(r, s);
      const b = pt(r, s + 1);
      const c = pt(r + 1, s);
      const d = pt(r + 1, s + 1);
      if (r === 0) {
        // crown fan
        push([0, 0.3, 0, 0]);
        push(d);
        push(c);
      } else {
        push(a);
        push(d);
        push(c);
        push(a);
        push(b);
        push(d);
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

/** small fern frond: an arching midrib with paired leaflets (the plants in the hero boulders' cracks) */
function buildFrond(rng: Rng, length: number, deep: Color, light: Color): BufferGeometry {
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
  const fronds = 3;
  for (let f = 0; f < fronds; f++) {
    const ang = (f / fronds) * Math.PI * 2 + rng.range(-0.5, 0.5);
    const L = length * rng.range(0.75, 1.15);
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz;
    const pz = dx;
    const phase = rng();
    const rise = rng.range(0.55, 0.8); // how steeply the frond climbs before arching over
    const pairs = 6;
    const rib = (t: number): number[] => {
      // parabola: up then over
      const y = L * (rise * t - 0.45 * t * t);
      const out = L * (0.25 * t + 0.6 * t * t);
      return [dx * out, y, dz * out];
    };
    // midrib: a thin quad strip
    for (let s = 0; s < pairs; s++) {
      const a = rib(s / pairs);
      const b = rib((s + 1) / pairs);
      const w = 0.003 * (1 - s / pairs) + 0.001;
      tmp.copy(deep).lerp(light, 0.3);
      const n = [0, 1, 0];
      push([a[0] - px * w, a[1], a[2] - pz * w], n, tmp, s / pairs, phase);
      push([a[0] + px * w, a[1], a[2] + pz * w], n, tmp, s / pairs, phase);
      push([b[0] + px * w, b[1], b[2] + pz * w], n, tmp, (s + 1) / pairs, phase);
      push([a[0] - px * w, a[1], a[2] - pz * w], n, tmp, s / pairs, phase);
      push([b[0] + px * w, b[1], b[2] + pz * w], n, tmp, (s + 1) / pairs, phase);
      push([b[0] - px * w, b[1], b[2] - pz * w], n, tmp, (s + 1) / pairs, phase);
    }
    // leaflets: pairs of tapered quads, longest a third of the way out
    for (let s = 1; s <= pairs; s++) {
      const t = (s - 0.5) / pairs;
      const a = rib(t);
      const b = rib(t + 0.07);
      const len = L * 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (0.7 + 0.3 * (1 - t)) + 0.01;
      for (const side of [-1, 1]) {
        const sx = px * side;
        const sz = pz * side;
        // droop the leaflet tip a little
        const tip = [a[0] + sx * len + dx * len * 0.35, a[1] - len * 0.25, a[2] + sz * len + dz * len * 0.35];
        const n = [sx * 0.3, 0.9, sz * 0.3];
        tmp.copy(light).lerp(deep, 0.2 + 0.4 * t);
        const c2 = new Color().copy(deep).lerp(light, 0.35);
        push(a, n, c2, t, phase);
        push(b, n, c2, t, phase);
        push(tip, n, tmp, t + 0.1, phase);
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
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}\nattribute vec2 aWind; attribute float aVariant; attribute float aSproutVariant; attribute float aTuftLighting; varying vec4 vTuftLighting; uniform float uSproutLodFar;`)
      .replace(
        '#include <defaultnormal_vertex>',
        /* glsl */ `#include <defaultnormal_vertex>
        // buildTuft authors an upward-biased blade normal. Preserve that axis across the
        // standard two-sided normal flip; the semantic mask excludes every other variant.
        vec3 sproutAuthoredUp = vec3(0.0, 1.0, 0.0);
        #ifdef USE_INSTANCING
          sproutAuthoredUp = normalize(instanceMatrix[1].xyz);
        #endif
        vTuftLighting = vec4(normalMatrix * sproutAuthoredUp, aTuftLighting);`,
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        // Variant packs: one InstancedMesh carries several sprout variants in one geometry; an
        // instance shows only the variant it was assigned (aSproutVariant) and collapses the
        // others' vertices onto its base point (zero-area triangles, no fill), so tufts, moss
        // cushions and seam grit share draw calls.
        float sproutKeep = 1.0 - step(0.5, abs(aVariant - aSproutVariant));
        // LOD: tufts further than uSproutLodFar from the camera shrink onto their base point over
        // the last 4 m, so distant joints cost no fill and the near ones keep their blades
        vec3 sproutBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float sproutLod = (1.0 - smoothstep(uSproutLodFar - 4.0, uSproutLodFar, distance(sproutBase, cameraPosition))) * sproutKeep;
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed * sproutLod, 1.0);
        wp.xyz += windGrass(wp.xyz, aWind.x, aWind.y, 0.3) * sproutLod;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTuftLighting;')
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `#include <normal_fragment_begin>
        #ifdef DOUBLE_SIDED
          if (vTuftLighting.w > 0.5) {
            vec3 sproutUp = normalize(vTuftLighting.xyz);
            float upComponent = dot(normal, sproutUp);
            if (upComponent < 0.0) {
              // Reflect only the downward component, retaining the horizontal face direction.
              normal = normalize(normal - 2.0 * upComponent * sproutUp);
              nonPerturbedNormal = normal;
            }
          }
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'joint-sprouts-wind-v3-variant-packs-tuft-up-v1';
  return wind.bind(mat);
}

/** sprout variant indices */
export const TUFT_A = 0;
export const TUFT_B = 1;
export const TUFT_C = 2;
export const CLOVER = 3;
export const CUSHION = 4;
export const FERN = 5;
export const GRIT = 6;

/**
 * Which variants share an InstancedMesh (= one draw call). Every instance of a pack processes the
 * vertices of all its variants (the others collapse), so the pairs are chosen to keep that
 * overhead small: the 2 000+ seam pebbles (60 vertices) ride with the smallest tuft (90), the
 * moss cushions (150) with the clover (126). Four draws for the whole joint flora + grit — the
 * same count the four tuft/clover variants alone used before the cushions and grit existed.
 */
export const HARDSCAPE_PACKS: number[][] = [[TUFT_B], [TUFT_A], [TUFT_C, GRIT], [CLOVER, CUSHION]];
/** the boulder cap plants: a few dozen instances, all variants in one draw */
export const BOULDER_PACKS: number[][] = [[TUFT_A, TUFT_B, FERN]];

const NO_TINT: [number, number, number] = [1, 1, 1];

export interface SproutBuild {
  meshes: InstancedMesh[];
  /** actual emitted variant batches, in legacy traversal order */
  packs: number[][];
  /** draws dedicated to grit (a shared pack does not count as dedicated) */
  gritDrawCalls: number;
  /** tufts + clover + cushions + ferns (not grit) */
  count: number;
  variants: number;
  cushions: number;
  ferns: number;
  grit: number;
  /** triangles actually shown (each instance's own variant), flora + grit */
  triangles: number;
  /** the grit's share of `triangles` */
  gritTriangles: number;
  /** triangles submitted to the GPU per frame, including the collapsed other-variant triangles */
  submittedTriangles: number;
}

/** concatenate non-indexed variant geometries (same attribute set) and tag each vertex with its variant slot */
function packGeometries(geos: BufferGeometry[], variantIds: number[]): BufferGeometry {
  const names = ['position', 'normal', 'color', 'uv', 'aWind'];
  const sizes: Record<string, number> = { position: 3, normal: 3, color: 3, uv: 2, aWind: 2 };
  const out: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const variant: number[] = [];
  const tuftLighting: number[] = [];
  geos.forEach((g, slot) => {
    for (const n of names) {
      const arr = g.getAttribute(n).array as Float32Array;
      for (let i = 0; i < arr.length; i++) out[n].push(arr[i]);
    }
    const count = g.getAttribute('position').count;
    const id = variantIds[slot];
    const isTuft = id === TUFT_A || id === TUFT_B || id === TUFT_C;
    for (let i = 0; i < count; i++) {
      variant.push(slot);
      tuftLighting.push(isTuft ? 255 : 0);
    }
  });
  const g = new BufferGeometry();
  for (const n of names) g.setAttribute(n, new Float32BufferAttribute(out[n], sizes[n]));
  g.setAttribute('aVariant', new Float32BufferAttribute(variant, 1));
  g.setAttribute('aTuftLighting', new Uint8BufferAttribute(tuftLighting, 1, true));
  g.computeBoundingSphere();
  return g;
}

/**
 * Instance jitter (the per-instance rotation, scale and tint randoms) is drawn from `rng` in pack →
 * variant → list order, so by default every spot appended to the list shifts the draws of all the
 * instances after it. `opts.jitter` replaces that with one stream per (spot.source, variant), each
 * consumed in list order by its own instances only: a scatter can then grow or shrink without
 * re-rolling any other scatter's instances. Without the option the behaviour is exactly the old one.
 * `opts.splitVariants` separates populated variants after that same traversal, retaining each
 * original pack's bounding sphere and material; its additional draw calls are reported explicitly.
 */
export function buildSproutMeshes(spots: SproutSpot[], rng: Rng, material: MeshStandardMaterial, config: WorldConfig, packs: number[][] = HARDSCAPE_PACKS, opts: { gritTone?: Color; jitter?: SproutJitterStreams; splitVariants?: boolean } = {}): SproutBuild {
  // Reference (B/E/D): small dark-green grass tufts and clover growing from the joints across
  // the whole plaza, 6–12 cm tall — the deep/mid grass greens, not lime blades.
  const deep = new Color(config.palette.grassDeep).lerp(new Color(config.palette.grassMid), 0.3);
  const light = new Color(config.palette.grassMid).lerp(new Color(config.palette.grassLight), 0.45);
  // cushions: the palette moss greens (deep→bright), a touch yellower on the crown like the
  // sheet's pads; the stone material's moss uses the same two colours so films and pads agree
  const mossDeep = new Color(config.palette.mossDeep).lerp(new Color(config.palette.grassDeep), 0.3);
  const mossBright = new Color(config.palette.mossBright).lerp(new Color(config.palette.grassLight), 0.25);
  const variants = [
    buildTuft(rng.fork('tuft-a'), 7, 0.08, 0.035, deep, light),
    buildTuft(rng.fork('tuft-b'), 9, 0.11, 0.05, deep, light),
    buildTuft(rng.fork('tuft-c'), 5, 0.065, 0.03, deep, light),
    buildClover(rng.fork('clover'), 0.05, deep, light),
    buildCushion(rng.fork('cushion'), mossDeep, mossBright),
    buildFrond(rng.fork('fern'), 0.2, new Color(config.palette.grassDeep), new Color(config.palette.grassMid).lerp(new Color(config.palette.grassLight), 0.3)),
    buildGritGeometry(rng.fork('grit-geo'), opts.gritTone ?? DEFAULT_GRIT_TONE),
  ];
  const variantOf = (s: SproutSpot) => (s.kind === 'cushion' ? CUSHION : s.kind === 'fern' ? FERN : s.kind === 'grit' ? GRIT : s.size > 0.7 ? TUFT_B : s.size > 0.42 ? TUFT_A : s.size > 0.2 ? TUFT_C : CLOVER);
  const lists: SproutSpot[][] = variants.map(() => []);
  for (const s of spots) lists[variantOf(s)].push(s);
  const packOf = new Map<number, [number, number]>(); // variant → [pack, slot]
  packs.forEach((pack, pi) => pack.forEach((v, slot) => packOf.set(v, [pi, slot])));
  for (let v = 0; v < variants.length; v++) if (lists[v].length && !packOf.has(v)) throw new Error(`sprout variant ${v} has instances but no pack`);

  const meshes: InstancedMesh[] = [];
  const emittedPacks: number[][] = [];
  let gritDrawCalls = 0;
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const sc = new Vector3();
  const axis = new Vector3();
  const up = new Vector3(0, 1, 0);
  const c = new Color();
  let count = 0;
  let triangles = 0;
  let gritTriangles = 0;
  let submittedTriangles = 0;
  const streams = new Map<string, Rng>();
  const jitterOf = (s: SproutSpot, v: number): Rng => {
    if (!opts.jitter) return rng;
    const key = `${s.source ?? ''}\u0000${v}`;
    let r = streams.get(key);
    if (!r) {
      r = opts.jitter(s.source, v);
      streams.set(key, r);
    }
    return r;
  };
  packs.forEach((pack, pi) => {
    const n = pack.reduce((a, v) => a + lists[v].length, 0);
    if (!n) return;
    const geo = packGeometries(pack.map((v) => variants[v]), pack);
    const slotOf = new Float32Array(n);
    const im = new InstancedMesh(geo, material, n);
    let i = 0;
    for (const v of pack) {
      const slot = packOf.get(v)![1];
      const triCount = variants[v].attributes.position.count / 3;
      for (const s of lists[v]) {
        const jr = jitterOf(s, v);
        const k = (0.9 + jr.range(0, 0.2)) * (s.scale ?? 1);
        if (v === GRIT) {
          // the pebble sits in the dirt: its centre a little below the fill so only the crown
          // shows; tumbled about a near-vertical axis, squashed unevenly
          p.set(s.x, s.y - s.size * 0.12, s.z);
          axis.set(jr.range(-0.25, 0.25), 1, jr.range(-0.25, 0.25)).normalize();
          q.setFromAxisAngle(axis, jr.range(0, Math.PI * 2));
          sc.set(s.size * jr.range(0.8, 1.25), s.size * jr.range(0.7, 1.05), s.size * jr.range(0.8, 1.25));
          // the fill's tone at this spot (vertex colours × the joint-width lift), then within
          // ± 15 % of it with a hint of warm / cool drift — no pale specks
          const t = s.tint ?? NO_TINT;
          const l = jr.range(0.87, 1.13);
          const w = jr.range(-0.02, 0.02);
          c.setRGB(t[0] * l * (1 + w), t[1] * l, t[2] * l * (1 - w));
        } else {
          q.setFromAxisAngle(up, jr.range(0, Math.PI * 2));
          if (v === CUSHION) {
            // the unit dome becomes a 4–7.5 cm radius, 1.2–2.5 cm high pad, sunk a few mm
            const r = (0.04 + 0.035 * s.size) * (s.scale ?? 1);
            p.set(s.x, s.y - 0.004, s.z);
            sc.set(r * jr.range(0.85, 1.2), r * jr.range(0.85, 1.15), r * jr.range(0.85, 1.2));
            c.setRGB(0.85 + jr.range(0, 0.3), 0.85 + jr.range(0, 0.3), 0.8 + jr.range(0, 0.2));
          } else {
            p.set(s.x, s.y - 0.01, s.z);
            sc.set(k, k * jr.range(0.9, 1.1), k);
            c.setRGB(0.78 + jr.range(0, 0.25), 0.8 + jr.range(0, 0.25), 0.75 + jr.range(0, 0.2));
          }
        }
        im.setMatrixAt(i, m.compose(p, q, sc));
        im.setColorAt(i, c);
        slotOf[i] = slot;
        i++;
      }
      triangles += triCount * lists[v].length;
      if (v === GRIT) gritTriangles += triCount * lists[v].length;
      else count += lists[v].length;
    }
    geo.setAttribute('aSproutVariant', new InstancedBufferAttribute(slotOf, 1));
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = true;
    im.name = `joint-sprouts-p${pi}-v${pack.join('')}`;
    im.computeBoundingSphere();
    if (!opts.splitVariants || pack.length === 1) {
      submittedTriangles += (geo.attributes.position.count / 3) * n;
      meshes.push(im);
      emittedPacks.push([...pack]);
      if (pack.length === 1 && pack[0] === GRIT) gritDrawCalls++;
      return;
    }
    // Build jitter in the original pack/variant/list order above, then copy its exact bytes.
    // Each batch keeps the old pack sphere: this removes collapsed geometry without changing
    // frustum admission, depth-sort centre or the existing wind/LOD visibility envelope.
    let first = 0;
    for (const v of pack) {
      const count = lists[v].length;
      if (!count) continue;
      const part = packGeometries([variants[v]], [v]);
      part.setAttribute('aSproutVariant', new InstancedBufferAttribute(new Float32Array(count), 1));
      const batch = new InstancedMesh(part, material, count);
      batch.instanceMatrix.array.set(im.instanceMatrix.array.subarray(first * 16, (first + count) * 16));
      batch.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) {
        batch.instanceColor = new InstancedBufferAttribute(im.instanceColor.array.slice(first * 3, (first + count) * 3), 3);
        batch.instanceColor.needsUpdate = true;
      }
      batch.castShadow = im.castShadow;
      batch.receiveShadow = im.receiveShadow;
      batch.name = `joint-sprouts-p${pi}-v${v}`;
      batch.boundingSphere = im.boundingSphere!.clone();
      meshes.push(batch);
      emittedPacks.push([v]);
      submittedTriangles += (part.attributes.position.count / 3) * count;
      if (v === GRIT) gritDrawCalls++;
      first += count;
    }
    // The temporary pack never enters the scene or uploads buffers. New batches own their
    // geometries/instance attributes and borrow the same material; dispose only scaffolding.
    im.dispose();
    geo.dispose();
  });
  return { meshes, packs: emittedPacks, gritDrawCalls, count, variants: variants.length, cushions: lists[CUSHION].length, ferns: lists[FERN].length, grit: lists[GRIT].length, triangles, gritTriangles, submittedTriangles };
}
