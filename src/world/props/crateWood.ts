import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, Texture } from 'three';

// Original UV layout into credited weathered_planks/color.jpg (1024 square).
// These interiors avoid photographed board seams, nail rows and edge damage.
const CROP_X = [200, 312, 664, 888] as const;
const CROP_MEAN = [.06305632270601604, .06432445152133405, .059656669481729874, .06592831381191619] as const;

/** Preserve physical grain direction before the existing board/brace transform. */
export function tagCrateWood(geometry: BufferGeometry, along: 'x' | 'y', board: number): void {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const axis = along === 'x' ? 0 : 1;
  const extent = [0, 0, 0];
  for (let i = 0; i < p.count; i++) for (let a = 0; a < 3; a++) {
    extent[a] = Math.max(extent[a], Math.abs(p.getComponent(i, a)) * 2);
  }
  const crossExtent = Math.max(...extent.filter((_, a) => a !== axis));
  const scale = Math.min(400, 320 / extent[axis], 64 / crossExtent);
  const crop = (board * 3) % CROP_X.length;
  const uv: number[] = [], mean: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const end = Math.abs(n.getComponent(i, axis)) > .9;
    const crossAxis = along === 'y' ? (Math.abs(n.getZ(i)) > .9 ? 0 : 2)
      : (Math.abs(n.getY(i)) > .9 ? 2 : 1);
    const across = end ? 0 : p.getComponent(i, crossAxis);
    const length = end ? 0 : p.getComponent(i, axis);
    uv.push((CROP_X[crop] + 32 + across * scale) / 1024, 1 - (504 - length * scale) / 1024);
    mean.push(end ? 0 : CROP_MEAN[crop]);
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('aCrateGrainMean', new Float32BufferAttribute(mean, 1));
}

/** One owned material; the cached color texture is borrowed without mutation. */
export function createCrateWoodMaterial(shared: MeshStandardMaterial, map: Texture): MeshStandardMaterial {
  const material = shared.clone();
  if (map.name.startsWith('fallback:')) return material;
  const priorHook = shared.onBeforeCompile;
  const priorKey = shared.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    priorHook.call(material, shader, renderer);
    shader.uniforms.crateWoodMap = { value: map };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
attribute float aCrateGrainMean;
varying vec3 vCrateWood;`).replace('#include <uv_vertex>', `#include <uv_vertex>
// Absolute crop UVs; leave material.map null so automatic shadow programs stay unchanged.
vCrateWood = vec3(uv, aCrateGrainMean);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D crateWoodMap;
varying vec3 vCrateWood;`).replace('#include <map_fragment>', `#include <map_fragment>
  vec3 crateSample = texture2D(crateWoodMap, vCrateWood.xy).rgb;
  float crateLuminance = dot(crateSample, vec3(0.2126, 0.7152, 0.0722));
  float crateGrain = clamp(crateLuminance / max(vCrateWood.z, 0.01), 0.55, 1.65);
  vec2 crateTexels = vCrateWood.xy * 1024.0;
  float crateFootprint = max(length(dFdx(crateTexels)), length(dFdy(crateTexels)));
  float crateResolved = 1.0 - smoothstep(6.0, 12.0, crateFootprint);
  diffuseColor.rgb *= mix(1.0, crateGrain, 0.8 * crateResolved * step(0.01, vCrateWood.z));
`);
  };
  material.customProgramCacheKey = () => `${priorKey}/crate-cc0-interior-grain-v1`;
  return material;
}
