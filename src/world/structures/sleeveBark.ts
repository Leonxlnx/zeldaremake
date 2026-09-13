import type { Material } from 'three';

const FLOOR_ANCHOR = 'floorLight = mix(vec3(dot(floorLight, lumW)), floorLight, uShadeFloorChroma);';
const SLEEVE_HEMISPHERE = /* glsl */ `
    #if NUM_HEMI_LIGHTS > 0
      float sleeveHemiWeight = 0.5 + 0.5 * dot(normal, hemisphereLights[0].direction);
      vec3 sleeveHemi = mix(hemisphereLights[0].groundColor,
                           hemisphereLights[0].skyColor, sleeveHemiWeight);
      float sleeveRatio = dot(sleeveHemi, lumW) / max(dot(ambientMean, lumW), 1e-4);
      floorLight *= mix(1.0, sleeveRatio, 0.20);
    #endif
`;

/**
 * Give only the lantern sleeve's shade floor a small part of the existing hemisphere's
 * angular response. The already mapped fragment normal carries the bark relief; the shared
 * floor otherwise nearly cancels normal-driven diffuse variation on this shaded bough.
 * Apply after applyShadeFloor. No new light, sampler, uniform, or resource is owned here.
 */
export function applySleeveBarkResponse<T extends Material>(material: T): T {
  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer);
    if (shader.fragmentShader.split(FLOOR_ANCHOR).length !== 2) {
      throw new Error('Lantern sleeve response requires exactly one applied shade floor.');
    }
    shader.fragmentShader = shader.fragmentShader.replace(FLOOR_ANCHOR, `${FLOOR_ANCHOR}\n${SLEEVE_HEMISPHERE}`);
  };
  const previousKey = material.customProgramCacheKey;
  material.customProgramCacheKey = function () {
    return `${previousKey.call(this)}|sleeve-hemi-angular-020-v1`;
  };
  return material;
}
