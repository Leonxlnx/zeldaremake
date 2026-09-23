/**
 * Near-camera foliage fade (play only): the follow camera now orbits 35° down and tilts 60° up, and
 * lets slim things — a sapling's leaves, a fern frond, a bough's cards — pass between it and Link
 * (camera/collision.ts). Where a card comes within NEAR_FADE_M of the lens it is screen-doored out
 * with a 4 × 4 ordered dither instead of being sliced open by the near plane. Every alpha-tested
 * material in the scene takes it (cards only: `USE_ALPHATEST`), chained after its own
 * `onBeforeCompile`, its program cache key extended so a compiled program is not reused. Never
 * installed under a headless capture, so the fixed frames are untouched.
 */
import { Material, Vector2, type Object3D, type WebGLProgramParametersWithUniforms } from 'three';

/** fully gone at [0] m from the camera, whole beyond [1] m */
export const NEAR_FADE_M: [number, number] = [0.2, 0.7];

const DITHER = /* glsl */ `
#ifdef USE_ALPHATEST
  {
    float zrNearK = smoothstep(uZrNearFade.x, uZrNearFade.y, length(vViewPosition));
    if (zrNearK < 0.999) {
      // 4 × 4 Bayer threshold: the 2 × 2 matrix 2 (x xor y) + y, nested
      vec2 zrQ = mod(floor(gl_FragCoord.xy), 4.0);
      vec2 zrLo = mod(zrQ, 2.0);
      vec2 zrHi = floor(zrQ * 0.5);
      float zrB = 4.0 * (2.0 * abs(zrLo.x - zrLo.y) + zrLo.y) + 2.0 * abs(zrHi.x - zrHi.y) + zrHi.y;
      if (zrNearK < (zrB + 0.5) / 16.0) discard;
    }
  }
#endif
`;

export function installNearFade(root: Object3D): { materials: number } {
  const uniform = { value: new Vector2(NEAR_FADE_M[0], NEAR_FADE_M[1]) };
  const seen = new Set<Material>();
  root.traverse((o) => {
    const mats = (o as { material?: Material | Material[] }).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      if (seen.has(m) || !(m.alphaTest > 0)) continue;
      // depth / distance materials carry the shadow maps: their cards must not thin out
      if ((m as { isMeshDepthMaterial?: boolean }).isMeshDepthMaterial || (m as { isMeshDistanceMaterial?: boolean }).isMeshDistanceMaterial) continue;
      seen.add(m);
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
        prev.call(m, shader, renderer);
        if (!shader.fragmentShader.includes('#include <alphatest_fragment>') || !shader.fragmentShader.includes('vViewPosition')) return;
        shader.uniforms.uZrNearFade = uniform;
        shader.fragmentShader = 'uniform vec2 uZrNearFade;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', `${DITHER}\n#include <alphatest_fragment>`);
      };
      // three's default key IS the onBeforeCompile source: keep keying by the material's own hook,
      // not by this wrapper (every wrapped material would share one program otherwise)
      const ownKey = m.customProgramCacheKey;
      const keyOf = ownKey === Material.prototype.customProgramCacheKey ? () => prev.toString() : () => ownKey.call(m);
      m.customProgramCacheKey = () => `${keyOf()}|zr-near-fade`;
      m.needsUpdate = true;
    }
  });
  return { materials: seen.size };
}
