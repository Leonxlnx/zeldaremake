/**
 * Rock material: vertex-coloured MeshStandardMaterial with world-space triplanar colour + normal
 * detail from a Poly Haven rock set and an `aMoss` blend toward the palette moss greens.
 * Works for plain meshes and InstancedMesh (instance matrices are folded into the world position).
 */
import { Color, MeshStandardMaterial, Vector2, type WebGLProgramParametersWithUniforms } from 'three';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';

export const ROCK_SET = 'rock_boulder_cracked';

export async function createRockMaterial(textures: TextureLibrary, config: WorldConfig, anisotropy = 8, tile = 1.4) {
  const [color, normal, rough] = await Promise.all([
    textures.load(ROCK_SET, 'color', { anisotropy }),
    textures.load(ROCK_SET, 'normal', { anisotropy }),
    textures.load(ROCK_SET, 'roughness', { anisotropy }),
  ]);
  const P = config.palette;
  const mat = new MeshStandardMaterial({
    map: color,
    normalMap: normal,
    normalScale: new Vector2(0.8, 0.8),
    roughnessMap: rough,
    roughness: 0.92,
    metalness: 0,
    vertexColors: true,
    color: new Color(1, 1, 1),
  });
  mat.name = 'rock-triplanar';
  // the boulder caps in the reference are an olive-brown moss (#70683b, R > G), not the yellow-green
  // of the ground moss: pull both palette greens toward it
  const cap = new Color(0x70683b);
  const mossDeep = new Color(P.mossDeep).lerp(cap, 0.45);
  const mossBright = new Color(P.mossBright).lerp(cap, 0.55);
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uMossDeep = { value: mossDeep };
    shader.uniforms.uMossBright = { value: mossBright };
    shader.uniforms.uRockTile = { value: 1 / tile };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aMoss; varying float vMossR; varying vec3 vWPosR; varying vec3 vWNrmR;')
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vMossR = aMoss;
        #ifdef USE_INSTANCING
          vWPosR = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vWNrmR = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWPosR = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrmR = normalize(mat3(modelMatrix) * objectNormal);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uMossDeep; uniform vec3 uMossBright; uniform float uRockTile;
        varying float vMossR; varying vec3 vWPosR; varying vec3 vWNrmR;
        vec3 triW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        {
          vec3 bw = triW(normalize(vWNrmR));
          vec3 cx = texture2D(map, vWPosR.zy * uRockTile).rgb;
          vec3 cy = texture2D(map, vWPosR.xz * uRockTile).rgb;
          vec3 cz = texture2D(map, vWPosR.xy * uRockTile).rgb;
          vec3 c = cx * bw.x + cy * bw.y + cz * bw.z;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          // the source rock is orange; keep its detail but pull to a neutral warm grey
          c = mix(c, vec3(l) * vec3(1.0, 0.99, 0.96), 0.7);
          diffuseColor.rgb *= c * 1.15;
          // moss: the texture luminance (mean ≈ 0.3) picks between deep and bright green so the
          // moss keeps the rock's pitting; blend is near-opaque where the coverage is full
          float ln = clamp(l / 0.3, 0.0, 1.8);
          vec3 moss = mix(uMossDeep, uMossBright, smoothstep(0.45, 1.4, ln)) * (0.85 + 0.4 * ln);
          diffuseColor.rgb = mix(diffuseColor.rgb, moss, smoothstep(0.03, 0.85, clamp(vMossR, 0.0, 1.0)));
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        {
          vec3 bw = triW(normalize(vWNrmR));
          vec3 nx = texture2D(normalMap, vWPosR.zy * uRockTile).xyz * 2.0 - 1.0;
          vec3 ny = texture2D(normalMap, vWPosR.xz * uRockTile).xyz * 2.0 - 1.0;
          vec3 nz = texture2D(normalMap, vWPosR.xy * uRockTile).xyz * 2.0 - 1.0;
          float ns = normalScale.x * (1.0 - 0.6 * clamp(vMossR, 0.0, 1.0));
          nx.xy *= ns; ny.xy *= ns; nz.xy *= ns;
          mat3 tx = getTangentFrame(-vViewPosition, normal, vWPosR.zy);
          mat3 ty = getTangentFrame(-vViewPosition, normal, vWPosR.xz);
          mat3 tz = getTangentFrame(-vViewPosition, normal, vWPosR.xy);
          normal = normalize(tx * normalize(nx) * bw.x + ty * normalize(ny) * bw.y + tz * normalize(nz) * bw.z);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        float roughnessFactor = roughness;
        {
          vec3 bw = triW(normalize(vWNrmR));
          float r = texture2D(roughnessMap, vWPosR.zy * uRockTile).g * bw.x + texture2D(roughnessMap, vWPosR.xz * uRockTile).g * bw.y + texture2D(roughnessMap, vWPosR.xy * uRockTile).g * bw.z;
          roughnessFactor *= mix(0.75 + 0.3 * r, 1.0, clamp(vMossR, 0.0, 1.0));
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'rock-triplanar-v3';
  return mat;
}
