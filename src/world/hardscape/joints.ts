/**
 * Joint fill: a terrain-hugging surface of dark damp soil + moss that sits a hair above the
 * ground under the paved area, so the gaps between slabs read as filled joints rather than
 * holes down to the terrain texture. Grid is aligned to the terrain's 0.2 m detail grid so the
 * two surfaces are parallel (no z-fighting). A joint-width field (5 cm texels) lets the shader
 * keep the tight seams dark and dry the wide junctions out to pale packed dirt.
 */
import { BufferAttribute, BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, LinearFilter, Mesh, MeshStandardMaterial, RedFormat, UnsignedByteType, Vector2, Vector4 } from 'three';
import type { Terrain } from '../terrain/heightfield';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';
import { Noise2D, clamp, smoothstep } from '../util/noise';

/** what the joint fill needs to know about the slabs around it */
export interface JointPaving {
  /** distance (m) from a point to the nearest slab edge (Infinity far from any slab) */
  edgeGap(x: number, z: number): number;
  /** is the point under a slab */
  onStone(x: number, z: number): boolean;
}

/** gap-field texel (m) and the distance at which the field saturates */
const GAP_CELL = 0.05;
const GAP_MAX = 0.3;

/**
 * Joint-width tinting of the fill (the shader below and `jointFillLift` share these): a seam
 * tighter than ~3 cm stays damp soil — same luminance, browner (the reference's dark quantile
 * is a saturated brown, B/R 0.52); a joint wider than ~5 cm dries out to pale khaki packed dirt.
 */
const CREVICE_RAMP: [number, number] = [0.015, 0.035];
const OPEN_RAMP: [number, number] = [0.02, 0.055];
const CREVICE_TINT: [number, number, number] = [1.0, 0.96, 0.84];
const OPEN_TINT: [number, number, number] = [1.35, 1.75, 1.6];
const glslVec3 = (v: [number, number, number]) => v.map((n) => n.toFixed(4)).join(', ');

/**
 * The fill's albedo multiplier at a point `gap` metres from the nearest slab edge — the CPU
 * twin of the joint shader's gap-field tint, so what sits in the seam (the grit) can be tinted
 * to the fill it sits on instead of to the fill's mid-seam average.
 */
export function jointFillLift(gap: number): [number, number, number] {
  const crevice = 1 - smoothstep(CREVICE_RAMP[0], CREVICE_RAMP[1], gap);
  const open = smoothstep(OPEN_RAMP[0], OPEN_RAMP[1], gap);
  const out: [number, number, number] = [1, 1, 1];
  for (let i = 0; i < 3; i++) {
    const k = 1 + (CREVICE_TINT[i] - 1) * crevice;
    out[i] = k + (OPEN_TINT[i] - k) * open;
  }
  return out;
}

/**
 * Joint width field: how far each point of the fill is from the nearest slab edge, as an 8-bit
 * texture over the paved bbox (5 cm texels). The fill shader reads it per pixel: a tight seam
 * (< 3 cm from both slabs) is damp, shaded soil; a wide junction (> 10 cm from any slab) is dry,
 * pale, mossy packed dirt — the reference's junctions are as pale as the slabs around them,
 * and a uniformly dark fill turned them into dark blobs (60 % of the B plaza box's SSIM loss).
 * Texels under a slab take the smallest value in their neighbourhood so bilinear filtering
 * along a slab edge stays on the seam's side of the ramp.
 */
function buildGapField(bbox: { x0: number; x1: number; z0: number; z1: number }, paving: JointPaving): { texture: DataTexture; rect: Vector4 } {
  const w = Math.ceil((bbox.x1 - bbox.x0) / GAP_CELL) + 1;
  const h = Math.ceil((bbox.z1 - bbox.z0) / GAP_CELL) + 1;
  const gap = new Float32Array(w * h);
  const under = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = bbox.x0 + i * GAP_CELL;
      const z = bbox.z0 + j * GAP_CELL;
      const k = j * w + i;
      gap[k] = Math.min(GAP_MAX, paving.edgeGap(x, z));
      under[k] = paving.onStone(x, z) ? 1 : 0;
    }
  }
  // under-slab texels: take the minimum of the 3×3 neighbourhood, three times (15 cm inward)
  for (let pass = 0; pass < 3; pass++) {
    const src = Float32Array.from(gap);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (!under[k]) continue;
        let m = src[k];
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            const jj = j + dj;
            if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
            m = Math.min(m, src[jj * w + ii]);
          }
        }
        gap[k] = m;
      }
    }
  }
  const data = new Uint8Array(w * h);
  for (let k = 0; k < data.length; k++) data[k] = Math.round((gap[k] / GAP_MAX) * 255);
  const texture = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
  texture.name = 'joint-gap-field';
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  // world xz → texel-centre uv: u = ((x − x0) / cell + 0.5) / w
  return { texture, rect: new Vector4(bbox.x0 - GAP_CELL * 0.5, bbox.z0 - GAP_CELL * 0.5, 1 / (w * GAP_CELL), 1 / (h * GAP_CELL)) };
}

/**
 * the seam soil's albedo (sRGB hex) in shade and where the damp noise lifts it; shared with the
 * seam grit. Round 8's brown (0x80583a / 0xa47c52) fixed the hue but sat 16 % below the older
 * olive soil in linear luminance, and the wide joints at the seam junctions turned into dark
 * blobs the reference does not have (its junctions are pale, mossy soil) — 60 % of the B plaza
 * box's SSIM loss was one such junction. Same hue (26–31°, R/B ≈ 2.1), the olive soil's luminance.
 */
export const JOINT_SOIL = 0x8a603f;
export const JOINT_SOIL_MID = 0xab8356;

export async function buildJointMesh(
  terrain: Terrain,
  paved: (x: number, z: number, threshold?: number) => boolean,
  bbox: { x0: number; x1: number; z0: number; z1: number },
  textures: TextureLibrary,
  config: WorldConfig,
  seed: string,
  paving?: JointPaving,
): Promise<{ mesh: Mesh; vertices: number; triangles: number; gapField: [number, number] | null }> {
  const step = 0.2;
  const x0 = Math.floor(bbox.x0 / step) * step;
  const z0 = Math.floor(bbox.z0 / step) * step;
  const nx = Math.ceil((bbox.x1 - x0) / step);
  const nz = Math.ceil((bbox.z1 - z0) / step);
  const noise = new Noise2D(`${seed}/joints`);
  const P = config.palette;
  // vertex colours are the *absolute* albedo here (the shader turns the texture into a
  // luminance modulator). The joint soil is the dark warm brown of the reference seams
  // (E/A/D dark band ≈ sRGB 60,50,30, hue 35–42°, R/G 1.2 — the palette's olive `soil` rendered
  // them hue 48° and a fifth too bright); moss takes over only in patches. Now that the joints
  // are 5–10 cm wide and sunk below the stones' shoulders (which shade them), the albedo is a
  // notch lighter so the seams land on the reference's joint pixels (B/A dark band sRGB ≈
  // 95,79,49 / 84,74,52) rather than a saturated near-black brown. The concept sheet (02 'Stone
  // path' / 'Path boundary') settles the hue: packed brown dirt, ≈ #5a4a38 in shade / #8a7458
  // lit (hue 32–34°, R/B 1.6), not grey soil — so the albedo leans well redder (hue ≈ 26–31°,
  // R/B 2.0–2.2) at nearly the same luminance as before: the rendered seam is a mix of fill,
  // shaded stone flank and shadow, and the post chain passes only part of an albedo hue change
  // (the first step, hue 29° at R/B 1.85, moved the B dark-quantile B/R by just 0.007).
  const soil = new Color(JOINT_SOIL);
  const soilMid = new Color(JOINT_SOIL_MID);
  const mossD = new Color(P.mossDeep).lerp(soil, 0.25);
  const mossB = new Color(P.mossBright);
  const tmp = new Color();

  // mark paved grid points (slightly wider than the slabs so the fill peeks out at the edges)
  const pavedFlag = new Uint8Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pavedFlag[j * (nx + 1) + i] = paved(x0 + i * step, z0 + j * step, 0.38) ? 1 : 0;

  const index = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const vertexFor = (i: number, j: number) => {
    const k = j * (nx + 1) + i;
    if (index[k] >= 0) return index[k];
    const x = x0 + i * step;
    const z = z0 + j * step;
    // 0.8 cm above the ground: the slabs stand 1.2–2 cm proud, so the seams read as sunken soil
    const y = terrain.height(x, z) + 0.008;
    pos.push(x, y, z);
    uv.push(x / 1.1, z / 1.1);
    const m = noise.fbm(x * 0.9 + 4, z * 0.9 - 2, 3) * 0.5 + 0.5;
    const dampN = noise.fbm(x * 0.25, z * 0.25 + 9, 2) * 0.5 + 0.5;
    tmp.copy(soil).lerp(soilMid, 0.5 * dampN);
    // reference joints are warm dark soil with moss in patches, not green seams everywhere:
    // keep the soil dominant and let moss take over only where the noise peaks, thinner still
    // in the plaza centre
    const mossAmt = smoothstep(0.42, 0.8, m) * (0.7 + 0.3 * dampN) * (1 - 0.35 * smoothstep(3.5, 0, Math.hypot(x, z)));
    tmp.lerp(mossD, clamp(mossAmt, 0, 1) * 0.55);
    tmp.lerp(mossB, clamp(smoothstep(0.72, 0.96, m), 0, 1) * 0.3);
    col.push(tmp.r, tmp.g, tmp.b);
    index[k] = pos.length / 3 - 1;
    return index[k];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = pavedFlag[j * (nx + 1) + i];
      const b = pavedFlag[j * (nx + 1) + i + 1];
      const c = pavedFlag[(j + 1) * (nx + 1) + i];
      const d = pavedFlag[(j + 1) * (nx + 1) + i + 1];
      if (a + b + c + d === 0) continue;
      const va = vertexFor(i, j);
      const vb = vertexFor(i + 1, j);
      const vc = vertexFor(i, j + 1);
      const vd = vertexFor(i + 1, j + 1);
      if ((i + j) & 1) idx.push(va, vc, vb, vb, vc, vd);
      else idx.push(va, vc, vd, va, vd, vb);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(new Uint32Array(idx), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const [mapT, nT] = await Promise.all([textures.load('brown_mud_leaves_01', 'color'), textures.load('brown_mud_leaves_01', 'normal')]);
  const mat = new MeshStandardMaterial({ map: mapT, normalMap: nT, normalScale: new Vector2(0.7, 0.7), vertexColors: true, roughness: 0.96, metalness: 0 });
  mat.name = 'flagstone-joints';
  const gapField = paving ? buildGapField(bbox, paving) : null;
  // brown_mud_leaves_01 averages ~0.10 linear luminance: use it as a ±70 % luminance modulator on
  // top of the vertex albedo instead of multiplying (which turned the joints black). The wide
  // modulation keeps the seams' darkest pits (the reference's dark quantile, B p10 0.331) while
  // the fill's mean luminance sits at the pale packed-dirt level the junctions need.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGapMap = { value: gapField?.texture ?? null };
    shader.uniforms.uGapRect = { value: gapField?.rect ?? new Vector4(0, 0, 1, 1) };
    shader.uniforms.uGapMax = { value: GAP_MAX };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vJointXZ;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvJointXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vJointXZ;\n${gapField ? '#define JOINT_GAP_FIELD' : ''}\nuniform sampler2D uGapMap; uniform vec4 uGapRect; uniform float uGapMax;`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
      #include <map_fragment>
      {
        float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float d = clamp(l / 0.10, 0.3, 2.4);
        diffuseColor.rgb = vec3(mix(1.0, d, 0.7));
      }
      #ifdef JOINT_GAP_FIELD
      {
        // joint width (see buildGapField): tight seams stay damp dark soil, wide junctions dry
        // out to pale, mossy packed dirt (the vertex albedo is the mid-width seam)
        float gap = texture2D(uGapMap, (vJointXZ - uGapRect.xy) * uGapRect.zw).r * uGapMax;
        float crevice = 1.0 - smoothstep(${CREVICE_RAMP[0].toFixed(4)}, ${CREVICE_RAMP[1].toFixed(4)}, gap);
        float open = smoothstep(${OPEN_RAMP[0].toFixed(4)}, ${OPEN_RAMP[1].toFixed(4)}, gap);
        vec3 k = mix(vec3(1.0), vec3(${glslVec3(CREVICE_TINT)}), crevice);
        k = mix(k, vec3(${glslVec3(OPEN_TINT)}), open);
        diffuseColor.rgb *= k;
      }
      #endif`,
      );
  };
  mat.customProgramCacheKey = () => `flagstone-joints-v3-gap${gapField ? '1' : '0'}`;
  const mesh = new Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'flagstone-joints';
  return { mesh, vertices: pos.length / 3, triangles: idx.length / 3, gapField: gapField ? [gapField.texture.image.width, gapField.texture.image.height] : null };
}
