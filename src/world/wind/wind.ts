/**
 * Shared wind model. One set of uniforms, many responses: grass reacts fast, small plants
 * lightly, leaves flutter, small branches sway, big limbs bend slowly, trunks barely move.
 * Systems inject `WIND_GLSL` into their vertex shaders and call one of the wind functions
 * with a per-vertex stiffness/phase so nothing moves in lockstep.
 */
import { Vector2, type IUniform, type Material, type WebGLProgramParametersWithUniforms } from 'three';

export interface WindUniforms {
  uTime: IUniform<number>;
  uWindDir: IUniform<Vector2>;
  uWindStrength: IUniform<number>;
  uGust: IUniform<number>;
  [uniform: string]: IUniform;
}

export interface Wind {
  uniforms: WindUniforms;
  /** direction (xz, normalised) */
  direction: Vector2;
  strength: number;
  update(dt: number, t: number): void;
  /** patch a material so WIND_GLSL uniforms are bound; returns the same material */
  bind<T extends Material>(material: T): T;
}

export const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform float uGust;

// cheap spatial gust field so neighbouring plants are correlated but not identical
float windField(vec3 worldPos, float speed, float scale) {
  vec2 p = worldPos.xz * scale - uWindDir * uTime * speed;
  float a = sin(p.x * 1.7 + p.y * 0.9);
  float b = sin(p.x * 0.6 - p.y * 1.3 + 1.7);
  float c = sin((p.x + p.y) * 2.3 + uTime * 0.7);
  return (a * 0.5 + b * 0.35 + c * 0.15);
}

// Grass / small plants: fast, high frequency, bends from the root (heightFactor 0..1 along blade)
vec3 windGrass(vec3 worldPos, float heightFactor, float phase, float stiffness) {
  float gust = windField(worldPos, 1.6, 0.25) * (0.6 + 0.4 * uGust);
  float flutter = sin(uTime * 5.5 + phase * 6.2831 + worldPos.x * 3.1 + worldPos.z * 2.3) * 0.12;
  float bend = (gust + flutter) * uWindStrength * (1.0 - stiffness);
  float h2 = heightFactor * heightFactor;
  vec3 offset = vec3(uWindDir.x, 0.0, uWindDir.y) * bend * h2 * 0.35;
  offset.y -= abs(bend) * h2 * 0.08; // blades shorten slightly when bent
  offset.x += sin(uTime * 3.7 + phase * 9.0) * 0.02 * h2;
  return offset;
}

// Leaves: independent flutter on top of the branch sway.
vec3 windLeaf(vec3 worldPos, float phase, float amount) {
  float f1 = sin(uTime * 7.0 + phase * 12.566 + worldPos.y * 1.3);
  float f2 = sin(uTime * 4.3 + phase * 3.7 + worldPos.x * 0.7);
  return vec3(f1 * 0.6, f2 * 0.4, f1 * f2 * 0.5) * amount * uWindStrength * (0.5 + 0.5 * uGust);
}

// Branches / trunks: slow, low frequency, more at height. stiffness ~1 for trunks.
vec3 windBranch(vec3 worldPos, float heightAboveGround, float stiffness) {
  float sway = windField(worldPos, 0.35, 0.05) * (0.7 + 0.3 * uGust);
  float amp = (1.0 - stiffness) * uWindStrength * 0.06 * heightAboveGround;
  return vec3(uWindDir.x, 0.0, uWindDir.y) * sway * amp;
}
`;

export function createWind(): Wind {
  const direction = new Vector2(0.72, -0.69).normalize();
  const uniforms: WindUniforms = {
    uTime: { value: 0 },
    uWindDir: { value: direction.clone() },
    uWindStrength: { value: 0.85 },
    uGust: { value: 0 },
  };
  const wind: Wind = {
    uniforms,
    direction,
    strength: 0.85,
    update(dt, t) {
      uniforms.uTime.value = t;
      // gust envelope: slow beats with occasional stronger pushes
      const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
      const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
      uniforms.uGust.value = Math.min(1, g * 0.8 + push * 0.6);
      uniforms.uWindStrength.value = wind.strength;
      uniforms.uWindDir.value.copy(direction);
    },
    bind(material) {
      const prev = material.onBeforeCompile;
      material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
        Object.assign(shader.uniforms, uniforms);
        prev?.call(material, shader, renderer);
      };
      // ensure a unique program cache key so the injected uniforms stick
      const key = material.customProgramCacheKey;
      material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|wind`;
      return material;
    },
  };
  return wind;
}
