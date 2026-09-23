/**
 * Near-camera foliage fade (play only): the follow camera now orbits 35° down and tilts 60° up, and
 * lets slim things — a sapling's leaves, a fern frond, a bough's cards — pass between it and Link
 * (camera/collision.ts). Two screen-door fades (a 4 × 4 ordered dither), on cards only
 * (`USE_ALPHATEST`):
 *  - within NEAR_FADE_M of the lens a card dissolves instead of being sliced open by the near plane;
 *  - in front of Link, inside a narrow cone from the lens to his chest (FOCUS_CONE_M wide at him),
 *    foliage thins out so a sapling or a frond never hides him.
 * Every alpha-tested material in the scene takes it, chained after its own `onBeforeCompile`, its
 * program cache key extended so a compiled program is not reused. Never installed under a headless
 * capture, so the fixed frames are untouched.
 */
import { Material, Vector2, Vector4, type Camera, type Object3D, type Vector3, type WebGLProgramParametersWithUniforms } from 'three';

/** fully gone at [0] m from the camera, whole beyond [1] m */
export const NEAR_FADE_M: [number, number] = [0.2, 0.7];
/** the see-through cone's radius at Link (m), and how far in front of him it stops (m) */
export const FOCUS_CONE_M = 0.55;
export const FOCUS_GAP_M = 0.6;

const DITHER = /* glsl */ `
#ifdef USE_ALPHATEST
  {
    float zrKeep = smoothstep(uZrNearFade.x, uZrNearFade.y, length(vViewPosition));
    if (uZrFocus.w > 0.5) {
      vec3 zrP = -vViewPosition;
      float zrLf = length(uZrFocus.xyz);
      vec3 zrF = uZrFocus.xyz / max(zrLf, 1e-3);
      float zrT = dot(zrP, zrF);
      if (zrT > 0.0 && zrT < zrLf - ${FOCUS_GAP_M.toFixed(2)}) {
        float zrR = ${FOCUS_CONE_M.toFixed(2)} * zrT / max(zrLf, 1e-3);
        zrKeep = min(zrKeep, smoothstep(zrR * 0.6, zrR, length(zrP - zrF * zrT)));
      }
    }
    if (zrKeep < 0.999) {
      // 4 × 4 Bayer threshold: the 2 × 2 matrix 2 (x xor y) + y, nested
      vec2 zrQ = mod(floor(gl_FragCoord.xy), 4.0);
      vec2 zrLo = mod(zrQ, 2.0);
      vec2 zrHi = floor(zrQ * 0.5);
      float zrB = 4.0 * (2.0 * abs(zrLo.x - zrLo.y) + zrLo.y) + 2.0 * abs(zrHi.x - zrHi.y) + zrHi.y;
      if (zrKeep < (zrB + 0.5) / 16.0) discard;
    }
  }
#endif
`;

export interface NearFade {
  materials: number;
  /** each frame: Link's chest (world) seen from `camera`, or null to switch the see-through cone off */
  setFocus(camera: Camera, focus: Vector3 | null): void;
}

export function installNearFade(root: Object3D): NearFade {
  const near = { value: new Vector2(NEAR_FADE_M[0], NEAR_FADE_M[1]) };
  const focus = { value: new Vector4(0, 0, 0, 0) };
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
        shader.uniforms.uZrNearFade = near;
        shader.uniforms.uZrFocus = focus;
        shader.fragmentShader = 'uniform vec2 uZrNearFade;\nuniform vec4 uZrFocus;\n' + shader.fragmentShader.replace('#include <alphatest_fragment>', `${DITHER}\n#include <alphatest_fragment>`);
      };
      // three's default key IS the onBeforeCompile source: keep keying by the material's own hook,
      // not by this wrapper (every wrapped material would share one program otherwise)
      const ownKey = m.customProgramCacheKey;
      const keyOf = ownKey === Material.prototype.customProgramCacheKey ? () => prev.toString() : () => ownKey.call(m);
      m.customProgramCacheKey = () => `${keyOf()}|zr-near-fade-2`;
      m.needsUpdate = true;
    }
  });
  return {
    materials: seen.size,
    setFocus(camera, p) {
      if (!p) {
        focus.value.w = 0;
        return;
      }
      camera.updateMatrixWorld();
      const v = p.clone().applyMatrix4(camera.matrixWorldInverse);
      focus.value.set(v.x, v.y, v.z, 1);
    },
  };
}
