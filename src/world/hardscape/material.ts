/**
 * Cut-stone material for stairs, flagstones and landing slabs: warm grey-beige worn stone
 * with Poly Haven micro detail (worn_rock_natural_01, desaturated), vertex colours for
 * per-stone tint / grime, and an `aMoss` attribute that blends toward moss in the joints.
 */
import { Color, MeshStandardMaterial, Vector2, type WebGLProgramParametersWithUniforms } from 'three';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';

export const STONE_SET = 'worn_rock_natural_01';

export async function createStoneMaterial(textures: TextureLibrary, config: WorldConfig, anisotropy = 8, opts: { instanced?: boolean } = {}) {
  const [color, normal, rough, ao] = await Promise.all([
    textures.load(STONE_SET, 'color', { anisotropy }),
    textures.load(STONE_SET, 'normal', { anisotropy }),
    textures.load(STONE_SET, 'roughness', { anisotropy }),
    textures.load(STONE_SET, 'ao', { anisotropy }),
  ]);
  const P = config.palette;
  // our slabs only carry one uv set; read the AO map through it instead of uv1
  const aoT = ao.clone();
  aoT.channel = 0;
  aoT.needsUpdate = true;
  const mat = new MeshStandardMaterial({
    map: color,
    normalMap: normal,
    // dusty, low-relief surfaces: the reference slabs read almost flat, pitting is a 1–3 cm hint
    normalScale: new Vector2(0.55, 0.55),
    roughnessMap: rough,
    aoMap: aoT,
    aoMapIntensity: 0.35,
    roughness: 0.92,
    metalness: 0,
    vertexColors: true,
    // worn_rock_natural_01 averages ~0.30 linear luminance and leans orange; the shader
    // desaturates it, this lift takes the sunlit slabs to the pale warm beige of the reference.
    // Measured against the frames the stone must sit ≈ 1.2–1.5× brighter than the grass beside
    // it (A plaza 1.21, B path 1.26, D path 1.49) with R−B ≈ 47–52 at lum ≈ 130 — i.e. warmer and
    // ~20 % lighter than the first pass, which landed at 1.05–1.18 and R−B 34–45. Warmth (R−B)
    // is set by the blue channel: the reference slab tops are sRGB B/R ≈ 0.66–0.69.
    // Hue: worn_rock_natural_01 is orange (linear R/G 1.44); the desat/lift targets below set most
    // of the final hue. Measured on the pure-stone boxes of A/E/F/D (gauntlet/tmp/hard/bands.mjs)
    // the reference's sunlit slabs are sRGB R/G 1.11 / B/R 0.68 (hue ≈ 41°, a grey-beige) where
    // ours rendered 1.08 / 0.65 (hue ≈ 47°, yellower). The near-neutral hemisphere fill means
    // the shaded slabs only get their warmth from the albedo, so the simulated mean albedo
    // (texture × base → desat → lift, gauntlet/tmp/hard/albedo-sim2.mjs) is now linear R/G 1.21
    // / B/R 0.51 at the same luminance (was 1.08 / 0.55). The post chain (warm channel mix,
    // ACES, saturation) compresses the rendered R/G to roughly a fifth of the albedo change, so
    // the albedo has to lean further red than the target itself.
    // (blue up a notch from 0.911: with the wider soil joints the plaza boxes measured sat 0.43
    // against the reference's 0.38 — the stone tops themselves were a shade too warm)
    color: new Color(1.586, 1.497, 0.95),
  });
  mat.name = opts.instanced ? 'stone-instanced' : 'stone';
  const mossDeep = new Color(P.mossDeep);
  const mossBright = new Color(P.mossBright);
  // the growth on slab rims is as much damp soil and dead moss as living green (reference joints
  // are dark warm brown with green only in patches), so the moss blend is pulled toward soil
  const mossSoil = new Color(P.soilDark).lerp(new Color(0x3a2c1c), 0.5);
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uMossDeep = { value: mossDeep };
    shader.uniforms.uMossBright = { value: mossBright };
    shader.uniforms.uMossSoil = { value: mossSoil };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float aMoss; varying float vMoss; varying vec3 vWPosS;\n#ifdef USE_INSTANCING\nattribute float aMossScale;\n#endif',
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n#ifdef USE_INSTANCING\nvMoss = aMoss * aMossScale;\nvWPosS = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvMoss = aMoss;\nvWPosS = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uMossDeep; uniform vec3 uMossBright; uniform vec3 uMossSoil; varying float vMoss; varying vec3 vWPosS;
        float stoneHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float stoneVNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(stoneHash(i), stoneHash(i + vec2(1.0, 0.0)), f.x), mix(stoneHash(i + vec2(0.0, 1.0)), stoneHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        {
          // second, finer sample (rotated 90°, 3.1× tighter) so the 0.55 m close-up shows real grain
          vec3 fine = texture2D(map, vec2(-vMapUv.y, vMapUv.x) * 3.1 + vec2(0.37, 0.61)).rgb;
          float lf = dot(fine, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb *= mix(1.0, clamp(lf / 0.32, 0.55, 1.5), 0.2);
          // desaturate the orange-leaning rock texture toward the warm grey-beige of the reference
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          // (reference plaza box sat 0.38 against our 0.44 once the joints widened: a little less
          // blue-starved than before)
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(1.12, 1.0, 0.74), 0.7);
          // lift the darkest pits so the slab tops stay pale and low-contrast (dusty, not pitted)
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l * 0.5 + 0.17) * vec3(1.09, 1.0, 0.76), 0.24);
          // fine grain breakup so distant slabs don't read as a single flat tone
          float grain = fract(sin(dot(floor(vWPosS.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453);
          diffuseColor.rgb *= 0.975 + 0.05 * grain;
          // moss: bright to deep green with the stone's luminance as detail, pulled toward damp
          // soil where the coverage is thin (rim grime) and green only where it is full
          float ln = clamp(l / 0.4, 0.0, 1.6);
          vec3 moss = mix(uMossDeep, uMossBright, smoothstep(0.4, 1.3, ln)) * (0.75 + 0.45 * ln);
          // ragged inner boundary: a 6–10 cm world-space noise scales the interpolated coverage,
          // so a moss film ends in a feathered, lobed edge (sheet 02 'Moss edges') rather than
          // along the mesh rings; clean tops (vMoss = 0) stay clean
          float rag = stoneVNoise(vWPosS.xz * 13.0) * 0.6 + stoneVNoise(vWPosS.xz * 31.0 + 5.7) * 0.4;
          float m = clamp(vMoss * (0.62 + 0.76 * rag), 0.0, 1.0);
          // thin coverage is damp soil grime on the shoulder; real green needs a solid film
          moss = mix(uMossSoil * (0.8 + 0.4 * ln), moss, smoothstep(0.28, 0.72, m));
          diffuseColor.rgb = mix(diffuseColor.rgb, moss, smoothstep(0.07, 0.72, m));
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.97, clamp(vMoss, 0.0, 1.0));`,
      );
  };
  mat.customProgramCacheKey = () => `stone-moss-v10-${opts.instanced ? 'i' : 's'}`;
  return mat;
}
