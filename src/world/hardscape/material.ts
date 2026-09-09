/**
 * Cut-stone material for stairs, flagstones and landing slabs: warm grey-beige worn stone
 * (palette.flagstone) with Poly Haven micro detail (rock_pitted_mossy), vertex colours for
 * per-stone tint / grime, and an `aMoss` attribute that blends toward moss in the joints.
 */
import { Color, MeshStandardMaterial, Vector2, type WebGLProgramParametersWithUniforms } from 'three';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';

export const STONE_SET = 'rock_pitted_mossy';

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
    normalScale: new Vector2(0.55, 0.55),
    roughnessMap: rough,
    aoMap: aoT,
    aoMapIntensity: 0.45,
    roughness: 0.9,
    metalness: 0,
    vertexColors: true,
    // the texture's mean albedo is ~0.45; lift it so the sunlit slabs read as pale warm stone
    color: new Color(P.flagstone).multiplyScalar(1.75),
  });
  mat.name = opts.instanced ? 'stone-instanced' : 'stone';
  const mossDeep = new Color(P.mossDeep);
  const mossBright = new Color(P.mossBright);
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uMossDeep = { value: mossDeep };
    shader.uniforms.uMossBright = { value: mossBright };
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
      .replace('#include <common>', '#include <common>\nuniform vec3 uMossDeep; uniform vec3 uMossBright; varying float vMoss; varying vec3 vWPosS;')
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #include <map_fragment>
        {
          // desaturate the orange-ish rock texture toward the warm grey of the reference
          float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(1.03, 1.0, 0.95), 0.82);
          // soften the deep cracks of the source texture: compress dark values
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l * 0.6 + 0.25) * vec3(1.03, 1.0, 0.95), 0.35);
          // fine grain breakup so distant slabs don't read as a single flat tone
          float grain = fract(sin(dot(floor(vWPosS.xz * 40.0), vec2(12.9898, 78.233))) * 43758.5453);
          diffuseColor.rgb *= 0.96 + 0.08 * grain;
          // moss: bright to deep green with the stone's luminance as detail
          vec3 moss = mix(uMossDeep, uMossBright, smoothstep(0.25, 0.75, l)) * (0.85 + 0.5 * l);
          float m = clamp(vMoss, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, moss, smoothstep(0.05, 0.9, m));
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.97, clamp(vMoss, 0.0, 1.0));`,
      );
  };
  mat.customProgramCacheKey = () => `stone-moss-v1-${opts.instanced ? 'i' : 's'}`;
  return mat;
}
