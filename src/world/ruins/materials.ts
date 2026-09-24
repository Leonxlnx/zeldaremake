/**
 * Round 57 (expansion-ruins): the ruins' materials.
 *
 * `createStone` — pale weathered limestone for the masonry, the outcrop, the cliff and the ivy
 * rock: a world-space triplanar sample of a CC0 Poly Haven rock set (already in the library),
 * pulled to its luminance and normalised to a target albedo (`tint`, linear) — the sources are
 * tan / orange, the reference's ruins a pale grey-cream stone — broken by a broad tone noise; the
 * vertex colour (per-block tint, grime) on top; `aMoss` blends to a moss that is greener and
 * brighter than the village's olive palette (the reference's ruins carry vivid yellow-green
 * cushions, r_043) and darker, damper on the faces turned from the sun; `aWet` a darker, glossier
 * band (the waterline, the fall's spray).
 *
 * `createTiles` — the parapet's glazed band (a row of small blue-teal tiles in pale grout, some
 * lost, the glaze crazed) and `createCarving` — the parapet's carved interlace panel; both are
 * procedural over the geometry's uv (u metres along the band, v 0…1 across it).
 */
import { Color, MeshStandardMaterial, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import type { WorldConfig } from '../config';
import type { TextureLibrary } from '../materials/textures';

export interface StoneOpts {
  name: string;
  /** texture set (public/textures/<set>) */
  set: string;
  /** mean linear luminance of the set's colour map (measured; the albedo is normalised by it) */
  meanL: number;
  /** metres per texture repeat */
  tile: number;
  /** target mean albedo (linear rgb) */
  tint: [number, number, number];
  /** share of the source's own chroma kept (0 = its luminance only) */
  keep: number;
  /** contrast about the mean (1 = the source's) */
  contrast: number;
  normalScale: number;
  roughness: number;
  /** the set has a roughness map */
  rough?: boolean;
  /** ± share of a broad (2–6 m) tone variation */
  tone?: number;
}

const f = (v: number) => v.toFixed(4);
const vec3 = (c: Color | [number, number, number]) => (Array.isArray(c) ? `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})` : `vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`);

/** the ruins' moss (linear): cushions on the lit tops, deep green, damp shade green */
export const RUINS_MOSS = {
  bright: new Color(0.3, 0.36, 0.07),
  deep: new Color(0.1, 0.14, 0.032),
  damp: new Color(0.066, 0.098, 0.029),
};

export function sunDirOf(config: WorldConfig): Vector3 {
  const az = (config.sun.azimuthDeg * Math.PI) / 180;
  const el = (config.sun.elevationDeg * Math.PI) / 180;
  return new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
}

const NOISE_GLSL = /* glsl */ `
  float rnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rnNoise(vec2 p) {
    vec2 i = floor(p); vec2 fr = fract(p); fr = fr * fr * (3.0 - 2.0 * fr);
    return mix(mix(rnHash(i), rnHash(i + vec2(1.0, 0.0)), fr.x), mix(rnHash(i + vec2(0.0, 1.0)), rnHash(i + vec2(1.0, 1.0)), fr.x), fr.y);
  }
  float rnNoise3(vec3 p) { return rnNoise(p.xz + p.y * 0.37) * 0.5 + rnNoise(p.zy * 1.13 + 3.1) * 0.5; }
  vec3 rnTriW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
`;

export async function createStone(textures: TextureLibrary, config: WorldConfig, o: StoneOpts): Promise<MeshStandardMaterial> {
  const [color, normal, rough] = await Promise.all([
    textures.load(o.set, 'color', { anisotropy: 8 }),
    textures.load(o.set, 'normal', { anisotropy: 8 }),
    o.rough ? textures.load(o.set, 'roughness', { anisotropy: 8 }) : Promise.resolve(null),
  ]);
  const mat = new MeshStandardMaterial({
    map: color,
    normalMap: normal,
    normalScale: new Vector2(o.normalScale, o.normalScale),
    roughnessMap: rough ?? null,
    roughness: o.roughness,
    metalness: 0,
    vertexColors: true,
  });
  mat.name = `ruins-${o.name}`;
  const sun = sunDirOf(config);
  const tone = (o.tone ?? 0.12).toFixed(3);
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRnTile = { value: 1 / o.tile };
    shader.uniforms.uRnSun = { value: sun };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMoss; attribute float aWet; varying float vRnMoss; varying float vRnWet; varying vec3 vRnPos; varying vec3 vRnNrm;')
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vRnMoss = aMoss; vRnWet = aWet;
        #ifdef USE_INSTANCING
          vRnPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vRnNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vRnPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vRnNrm = normalize(mat3(modelMatrix) * objectNormal);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float uRnTile; uniform vec3 uRnSun; varying float vRnMoss; varying float vRnWet; varying vec3 vRnPos; varying vec3 vRnNrm;\n${NOISE_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        vec3 rnW = rnTriW(normalize(vRnNrm));
        float rnL;
        {
          vec3 cx = texture2D(map, vRnPos.zy * uRnTile).rgb;
          vec3 cy = texture2D(map, vRnPos.xz * uRnTile).rgb;
          vec3 cz = texture2D(map, vRnPos.xy * uRnTile).rgb;
          vec3 c = cx * rnW.x + cy * rnW.y + cz * rnW.z;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, ${f(o.keep)});
          c = mix(vec3(${f(o.meanL)}), c, ${f(o.contrast)});
          c *= ${vec3(o.tint)} / ${f(o.meanL)};
          // broad tone: neighbouring 2–6 m patches a shade lighter / darker, a little warmer / cooler
          float bt = rnNoise3(vRnPos * 0.23) * 0.65 + rnNoise3(vRnPos * 0.61 + 7.0) * 0.35;
          c *= 1.0 + ${tone} * (bt - 0.5) * 2.0;
          c *= mix(vec3(1.02, 1.0, 0.96), vec3(0.97, 0.99, 1.03), bt);
          rnL = l / ${f(o.meanL)};
          diffuseColor.rgb *= c;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        {
          // moss: the stone's own grain picks deep → bright, the lit side is the yellow-green
          // cushion, the side turned from the sun the damp dark green
          float cov = smoothstep(0.04, 0.8, clamp(vRnMoss, 0.0, 1.0));
          float grain = clamp(rnL, 0.2, 1.8);
          float clump = rnNoise3(vRnPos * 2.7) * 0.6 + rnNoise3(vRnPos * 7.3 + 2.0) * 0.4;
          cov *= smoothstep(0.18, 0.5, clump + 0.45 * clamp(vRnMoss, 0.0, 1.0));
          vec3 moss = mix(${vec3(RUINS_MOSS.deep)}, ${vec3(RUINS_MOSS.bright)}, smoothstep(0.35, 1.3, grain) * smoothstep(0.25, 0.9, clamp(vRnMoss, 0.0, 1.0)) * (0.55 + 0.45 * clump));
          float sunSide = smoothstep(-0.3, 0.55, dot(normalize(vRnNrm), uRnSun));
          moss = mix(${vec3(RUINS_MOSS.damp)} * (0.8 + 0.3 * grain), moss * (0.8 + 0.3 * grain), sunSide);
          diffuseColor.rgb = mix(diffuseColor.rgb, moss, cov);
          // the damp band: darker, a touch cooler
          float wet = clamp(vRnWet, 0.0, 1.0);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.52, 0.55, 0.58), wet * (1.0 - 0.5 * cov));
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        {
          vec3 nx = texture2D(normalMap, vRnPos.zy * uRnTile).xyz * 2.0 - 1.0;
          vec3 ny = texture2D(normalMap, vRnPos.xz * uRnTile).xyz * 2.0 - 1.0;
          vec3 nz = texture2D(normalMap, vRnPos.xy * uRnTile).xyz * 2.0 - 1.0;
          float ns = normalScale.x * (1.0 - 0.55 * clamp(vRnMoss, 0.0, 1.0));
          nx.xy *= ns; ny.xy *= ns; nz.xy *= ns;
          mat3 tx = getTangentFrame(-vViewPosition, normal, vRnPos.zy);
          mat3 ty = getTangentFrame(-vViewPosition, normal, vRnPos.xz);
          mat3 tz = getTangentFrame(-vViewPosition, normal, vRnPos.xy);
          normal = normalize(tx * normalize(nx) * rnW.x + ty * normalize(ny) * rnW.y + tz * normalize(nz) * rnW.z);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        float roughnessFactor = roughness;
        ${
          o.rough
            ? `roughnessFactor *= 0.75 + 0.3 * (texture2D(roughnessMap, vRnPos.zy * uRnTile).g * rnW.x + texture2D(roughnessMap, vRnPos.xz * uRnTile).g * rnW.y + texture2D(roughnessMap, vRnPos.xy * uRnTile).g * rnW.z);`
            : ''
        }
        roughnessFactor = mix(roughnessFactor, 0.97, clamp(vRnMoss, 0.0, 1.0));
        roughnessFactor *= 1.0 - 0.5 * clamp(vRnWet, 0.0, 1.0);`,
      );
  };
  mat.customProgramCacheKey = () => `ruins-stone-${o.name}-v1`;
  return mat;
}

/**
 * The glazed tile band: small square tiles (TILE_M) in `rows` rows across the band, blue to teal
 * per tile, pale grout, a few lost (the bedding shows, darker), the glaze crazed and dulled toward
 * the band's lower edge where the grime and moss creep in.
 */
export function createTiles(rows = 2): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0 });
  mat.name = 'ruins-tiles';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRnUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRnUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vRnUv;\nfloat rnTileRough = 1.0;\n${NOISE_GLSL}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        {
          const float TILE_M = 0.105;
          vec2 g = vec2(vRnUv.x / TILE_M, vRnUv.y * ${f(rows)});
          vec2 id = floor(g);
          vec2 fr = fract(g);
          float h = rnHash(id + 3.7);
          float lost = step(0.93, rnHash(id * 1.7 + 11.0));
          vec3 blue = vec3(0.028, 0.075, 0.2);
          vec3 teal = vec3(0.03, 0.13, 0.15);
          vec3 tile = mix(blue, teal, smoothstep(0.35, 0.75, h)) * (0.8 + 0.4 * rnHash(id + 9.1));
          // glaze pooling: a paler rim, a darker middle; crazing lines
          float rim = smoothstep(0.34, 0.5, max(abs(fr.x - 0.5), abs(fr.y - 0.5)));
          tile *= 1.0 + 0.35 * rim;
          float craze = smoothstep(0.93, 1.0, rnNoise(vRnUv * vec2(70.0, 90.0) + id * 3.0)) * 0.6;
          tile = mix(tile, vec3(0.34, 0.36, 0.34), craze * 0.5);
          float grout = step(0.44, max(abs(fr.x - 0.5), abs(fr.y - 0.5)));
          vec3 groutC = vec3(0.4, 0.38, 0.33) * (0.8 + 0.3 * rnNoise(vRnUv * 30.0));
          vec3 bed = vec3(0.16, 0.14, 0.11) * (0.8 + 0.4 * rnNoise(vRnUv * 40.0));
          vec3 c = mix(tile, groutC, grout);
          c = mix(c, bed, lost);
          // grime and moss from the lower edge
          float low = 1.0 - smoothstep(0.0, 0.55, vRnUv.y);
          float g2 = low * (0.5 + 0.5 * rnNoise(vRnUv * vec2(6.0, 3.0)));
          c = mix(c, vec3(0.11, 0.14, 0.05), 0.55 * smoothstep(0.35, 0.8, g2));
          c *= 0.85 + 0.15 * rnNoise(vRnUv * vec2(2.0, 1.0) + 4.0);
          diffuseColor.rgb *= c;
          rnTileRough = mix(0.32, 0.9, max(max(grout, lost), smoothstep(0.35, 0.8, g2)));
        }`,
      )
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * rnTileRough / 0.42;');
  };
  mat.customProgramCacheKey = () => 'ruins-tiles-v1';
  return mat;
}

/**
 * The carved interlace: rings (radius ≈ 0.09 m) chained along the panel in two rows, their grooves
 * shaded dark with a lit lip above and a shadowed lip below, on the masonry's pale stone.
 */
export function createCarving(tint: [number, number, number]): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  mat.name = 'ruins-carving';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRnUv; varying vec3 vRnPos;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRnUv = uv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRnPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vRnUv; varying vec3 vRnPos;\n${NOISE_GLSL}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        {
          // panel space: u metres along, v metres up (the band is 0.3 m tall)
          vec2 p = vec2(vRnUv.x, vRnUv.y * 0.3);
          float groove = 1e3;
          float lip = 0.0;
          for (int row = 0; row < 2; row++) {
            float cy = 0.085 + float(row) * 0.13;
            float off = float(row) * 0.09;
            float cx = floor((p.x - off) / 0.18) * 0.18 + 0.09 + off;
            for (int k = -1; k <= 1; k++) {
              vec2 c = vec2(cx + float(k) * 0.18, cy);
              float d = abs(length(p - c) - 0.075);
              if (d < groove) { groove = d; lip = (p.y - c.y) / 0.075; }
            }
          }
          float cut = 1.0 - smoothstep(0.009, 0.016, groove);
          float edge = smoothstep(0.016, 0.009, groove) - cut * 0.6;
          vec3 stone = ${vec3(tint)} * (0.86 + 0.28 * rnNoise(vRnPos.xz * 3.0 + vRnPos.y * 5.0));
          stone *= 0.92 + 0.16 * rnNoise(p * 60.0);
          vec3 c = stone * (1.0 - 0.62 * cut) * (1.0 + 0.12 * edge * sign(lip));
          // weather: grime down the lower half, lichen spots
          c *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.2, p.y)) * rnNoise(p * 8.0);
          c = mix(c, vec3(0.32, 0.34, 0.24), 0.35 * smoothstep(0.72, 0.9, rnNoise(p * 14.0 + 5.0)));
          diffuseColor.rgb *= c;
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'ruins-carving-v1';
  return mat;
}
