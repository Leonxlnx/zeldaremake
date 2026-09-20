import type { WebGLProgramParametersWithUniforms } from 'three';

/** Candidate strength; __ATMO_UNIFORMS__.uTreeLeafWarmth probes 0 / 0.35 / 0.65. */
export const TREE_LEAF_WARMTH = 0.35;

/**
 * Warm completed leaf radiance before fog, without changing its linear luminance. In the
 * olive interval b <= r <= g, red approaches green without crossing it, so the common
 * luminance rescale also preserves HSV saturation. Final display HSL still depends on the
 * haze and grade. Combined tree materials supply a leaf gate; crown-only materials use true.
 */
export function injectTreeLeafWarmth(shader: WebGLProgramParametersWithUniforms, leafGate = 'true') {
  // Separate values let the existing per-material capture overrides restore each shader.
  shader.uniforms.uTreeLeafWarmth = { value: TREE_LEAF_WARMTH };
  shader.fragmentShader = `uniform float uTreeLeafWarmth;\n${shader.fragmentShader}`.replace(
    '#include <opaque_fragment>',
    /* glsl */ `
    // Tree leaf warmth: after lighting, before opacity and fog.
    if (${leafGate} && uTreeLeafWarmth > 0.0) {
      const vec3 leafLumaWeights = vec3(0.2126, 0.7152, 0.0722);
      float leafLuma = dot(outgoingLight, leafLumaWeights);
      float leafGreen = max(outgoingLight.g - max(outgoingLight.r, outgoingLight.b), 0.0);
      if (leafLuma > 1e-6 && leafGreen > 0.0) {
        vec3 warmLeaf = outgoingLight;
        warmLeaf.r += clamp(uTreeLeafWarmth, 0.0, 1.0) * leafGreen;
        outgoingLight = warmLeaf * (leafLuma / max(dot(warmLeaf, leafLumaWeights), 1e-6));
      }
    }
    // End tree leaf warmth.
    #include <opaque_fragment>`,
  );
}
