/**
 * Shade floor: the light under the closed roof. What reaches a face the sun does not is not the
 * open hemisphere but light that has come through and off the leaves many times — flat, dim,
 * slightly leaf-tinted, and much the same from every direction. The reference's trunks out of
 * the sun are hazed grey-green columns (D left trunks (0–0.15, 0.2–0.7) p50 0.43, hue 65°; the
 * lantern limb's underside ≈ 0.50) while bark lit by the hemisphere alone reads 0.19–0.31 and
 * warm: the bark albedo is dark and orange-brown (kept so for the sunlit rims, which match the
 * reference) and a Lambert response to the hemisphere is all a shadowed face gets. Likewise the
 * self-shadowed upper faces of the canopy cards seen from below in shot A (p10 0.29) sit below
 * the reference's roof (p10 0.39).
 *
 * The floor is the hemisphere's mean colour (sky/ground average, so undersides get it too), part
 * leaf-filtered and part desaturated, times a near-flat albedo, scaled by `lift`. It is a floor,
 * not an addition: it fades out linearly as the light the fragment already has reaches it, so
 * the sunlit faces are unchanged, dappled light never reads darker than the shade around it, and
 * only the faces below the floor move. Moss, lichen and tufts ride on the same diffuseColor and
 * are lifted with it.
 *
 * Lives in materials/ because trees (their own combined bark + leaf shader) and structures (the
 * lantern limb's wrap, Saria's house bark and moss) both need it and systems must not import
 * each other's internals (AGENTS.md rule 1). Two entry points:
 * - `applyShadeFloor(material, params)` for a plain lit material: chains onto whatever
 *   `onBeforeCompile` the material already has and injects the floor after
 *   `#include <lights_fragment_end>` (fragment side only; it does not touch `common`,
 *   `begin_vertex` or the fog chunks, so it composes with the wind and indoor-fog vertex hooks).
 * - `shadeFloorPars` / `shadeFloorGlsl` / `bindShadeFloor` for shaders that place the block
 *   themselves (the tree shader runs one floor for its leaf branch and another for its bark).
 */
import { Color, type Material, type WebGLProgramParametersWithUniforms } from 'three';
import { WORLD } from '../config';

export interface ShadeFloor {
  /** multiple of the hemisphere-mean Lambert response (at the mean albedo) the floor sits at (0 = off) */
  lift: number;
  /** share of the surface's own textured, coloured albedo kept in the floor (1 = fully textured) */
  texture: number;
  /** share of the floor's light that is leaf-filtered (toward the sunlit leaf colour's hue) */
  canopy: number;
  /** mean linear albedo luminance of the surface in shade: the level the floor's flat grey sits at before `lift` */
  albedo: number;
  /** chroma kept in the floor's light (1 = the tinted hemisphere mean as is, 0 = its luminance as grey) */
  chroma: number;
}

/**
 * giants' bark: mostly flat (the fissures and the orange tint only modulate the floor by 0.25 —
 * the reference's hazed columns are near-smooth), leaf-filtered for the hue and then half
 * desaturated, because the reference's shaded trunks are grey-green (D's left trunks (0–0.15,
 * 0.2–0.7) hue 65°, sat 0.18) while the hemisphere mean is yellow (53°) and the bark orange.
 * Calibration (round 10, quick shots at the hero poses, same tree, wood pixels by a mask render):
 * - additive lift of the bark's own Lambert response: ×1.4 moved D's left trunks p50 only
 *   0.219 → 0.244 and ×4.5 → 0.287, hue drifting warmer (54° → 52°) as the orange texture came
 *   up with it, and the trunk's SSIM cells fell (the fissures gained contrast while the
 *   reference column is smooth): the visible 0.2 of a shaded trunk is mostly veil over a tiny
 *   albedo × ambient term, so the term has to be flat, not scaled.
 * - flat floor, texture 0.3: D left trunks p50 0.365 / hue 58.6° at lift 8 (reference 0.429 /
 *   65°), D's SSIM +0.014 with the gain in the trunk's own cells; F's stair-bank trunk
 *   (0.85–1, 0.3–0.7) overshot at 0.385 against 0.331 and cost F −0.002 — the two trunks stand
 *   at the same 10–11 m but the reference veils D's more — so lift 7 sits between them (D 0.33,
 *   F 0.33).
 * - hue and chroma: canopy 0 → 0.5 turned the D box 53° → 58°, 0.8 → 60° but at sat 0.38
 *   (an olive column); chroma 0.5 with canopy 1 gives 59.6° at sat 0.30 — the greener filter
 *   buys hue, the desaturation gives most of it back, and the pair is the closest to the
 *   reference's grey-green the two allow without a neutral floor that would leave the hue at 53°.
 * - sunlit wood is untouched by construction: wood pixels the control rendered above 0.5 moved
 *   ≤ +0.006 in every view while the 0.2–0.3 bucket moved +0.12–0.18.
 *
 * The same floor suits other dark bark that stands against the giants (the lantern limb's wrap,
 * the house bark): the reference's shaded wood is the same hazed grey-green everywhere.
 */
export const GIANT_BARK_FLOOR: ShadeFloor = { lift: 7, texture: 0.25, canopy: 1, albedo: 0.08, chroma: 0.5 };

/**
 * leaves (all species and the canopy cards): the floor keeps the leaf's own colour and texture
 * and only catches the darkest self-shadowed faces. Measured in shot A's top band (0–1, 0–0.2)
 * with facing masks: no visible leaf face there is sunlit (the band is the roof's underside), 17 %
 * of the band is card undersides toward the camera (p10 0.32 — the trees' sky transmission
 * already carries them) and 13 % is upper/side faces in the crown's own shadow (p10 0.29, 21 %
 * of the darkest decile against the undersides' 6 %): the dark cards are the self-shadowed faces,
 * not the undersides, so the fix is a floor under those faces rather than more transmission or a
 * thinner card set. A floor proportional to the leaf's own albedo (texture 1) never reached them
 * at lift 2.5 or 5 (p10 +0.002): the dark faces are the dark-albedo leaves and card edges, and
 * a proportional floor is dark with them — like the bark it needs a flat part. At 0.6 flat ×
 * 0.15 (the leaves' mean albedo) and lift 6 the band's leaf pixels below 0.34 fall from 5.9 % to
 * 1.0 % (undersides p10 0.32 → 0.36, self-shadowed faces 0.29 → 0.37) with the band's saturation
 * 0.145 → 0.153 against the reference's 0.148 — no neon. The band's p10 itself is then capped
 * near 0.35 by pixels that are not trees (the HUD's item box at (0.86–0.98, 0.02–0.18) and the
 * lantern limb's wrap — 7.4 % of the band below 0.34, 80 % of the darkest decile).
 *
 * Also the preset for green surfaces that sit in the roof (moss sheets, vine leaves): it keeps
 * their own colour and only lifts the self-shadowed faces.
 */
export const LEAF_FLOOR: ShadeFloor = { lift: 6, texture: 0.4, canopy: 0.3, albedo: 0.15, chroma: 1 };

export interface ShadeFloorGlslOptions {
  /**
   * GLSL name of a `vec3` uniform the shader already declares for the sunlit leaf colour (the
   * tree shader's `uLeafSun`). When set, `shadeFloorPars` declares no leaf-sun uniform and the
   * block reads this one; when unset the floor owns `${u}LeafSun`, which `bindShadeFloor` binds.
   */
  leafSun?: string;
}

/**
 * Fragment-shader uniform declarations for one shade floor whose uniforms are prefixed `u`:
 * `${u}Lift`, `${u}Texture`, `${u}Canopy`, `${u}Albedo`, `${u}Chroma` (the `ShadeFloor` fields)
 * and, unless `leafSun` names an existing uniform, `${u}LeafSun` (the sunlit leaf colour the
 * canopy filter leans toward). Prepend to `shader.fragmentShader`.
 */
export const shadeFloorPars = (u: string, opts: ShadeFloorGlslOptions = {}) =>
  `uniform float ${u}Lift;\nuniform float ${u}Texture;\nuniform float ${u}Canopy;\nuniform float ${u}Albedo;\nuniform float ${u}Chroma;\n` +
  (opts.leafSun ? '' : `uniform vec3 ${u}LeafSun;\n`);

/**
 * The floor itself, for a shader that declared `shadeFloorPars(u, opts)` with the same options.
 * Place it after `#include <lights_fragment_end>` (it reads `diffuseColor`, `hemisphereLights[0]`
 * and the accumulated `reflectedLight`, and adds to `reflectedLight.indirectDiffuse`). Compiles
 * to nothing when the scene has no hemisphere light.
 */
export const shadeFloorGlsl = (u: string, opts: ShadeFloorGlslOptions = {}) => {
  const sun = opts.leafSun ?? `${u}LeafSun`;
  return /* glsl */ `
  #if NUM_HEMI_LIGHTS > 0
  {
    vec3 lumW = vec3(0.2126, 0.7152, 0.0722);
    vec3 ambientMean = (hemisphereLights[0].skyColor + hemisphereLights[0].groundColor) * 0.5;
    vec3 canopyFilter = mix(vec3(1.0), ${sun} / max(dot(${sun}, lumW), 1e-3), ${u}Canopy);
    vec3 floorAlbedo = mix(vec3(${u}Albedo), diffuseColor.rgb, ${u}Texture);
    vec3 floorLight = ${u}Lift * ambientMean * canopyFilter * BRDF_Lambert(floorAlbedo);
    floorLight = mix(vec3(dot(floorLight, lumW)), floorLight, ${u}Chroma);
    float have = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, lumW);
    reflectedLight.indirectDiffuse += max(0.0, 1.0 - have / (dot(floorLight, lumW) + 1e-4)) * floorLight;
  }
  #endif
`;
};

/**
 * Bind the uniforms `shadeFloorPars(u)` declares. `leafSun` (a linear Color, the palette's
 * `leafSun`) binds `${u}LeafSun`; leave it out when the shader supplies its own leaf-sun uniform.
 */
export function bindShadeFloor(shader: WebGLProgramParametersWithUniforms, u: string, floor: ShadeFloor, leafSun?: Color) {
  shader.uniforms[`${u}Lift`] = { value: floor.lift };
  shader.uniforms[`${u}Texture`] = { value: floor.texture };
  shader.uniforms[`${u}Canopy`] = { value: floor.canopy };
  shader.uniforms[`${u}Albedo`] = { value: floor.albedo };
  shader.uniforms[`${u}Chroma`] = { value: floor.chroma };
  if (leafSun) shader.uniforms[`${u}LeafSun`] = { value: leafSun };
}

const APPLIED_PREFIX = 'uShadeFloor';

/**
 * Give a lit material (MeshStandard / MeshPhysical / MeshLambert / MeshPhong) a shade floor.
 *
 * ```ts
 * applyShadeFloor(mats.bark, GIANT_BARK_FLOOR);   // dark bark that stands against the giants
 * applyShadeFloor(mats.moss, LEAF_FLOOR);         // green surfaces in the roof
 * ```
 *
 * - Chains onto the material's existing `onBeforeCompile` (called first, so the floor sees every
 *   other light the fragment has been given) and composes with hooks such as the wind binding or
 *   a vertex-fog hook: it only prepends uniform declarations to the fragment shader and injects
 *   after `#include <lights_fragment_end>`, which it leaves in place. Apply it after the
 *   material's own hooks are assigned — a hook that sets `onBeforeCompile` / `customProgramCacheKey`
 *   outright instead of chaining (structures' `windLeafMaterial`, `indoorFog`) would drop an
 *   earlier floor; `wind.bind` chains and is safe in either order. `Material.clone()` does not
 *   carry hooks, so a clone needs its own call. Any earlier hook that replaces
 *   `lights_fragment_end` must keep the include for the floor to land (the tree shader does).
 * - Extends `customProgramCacheKey` (`…|shade-floor`) so a floored material never shares a
 *   program with an unfloored copy. The floor's values are uniforms, so materials with different
 *   presets but otherwise equal parameters share one compiled program.
 * - `leafSun` is the sunlit leaf colour the canopy filter leans toward; defaults to the
 *   palette's `leafSun`. Pass `ctx.config.palette.leafSun` (or a Color) to follow a live palette.
 * - `params` is read when the program compiles (the material's first render): settle the values
 *   before then.
 *
 * Returns the same material for chaining.
 */
export function applyShadeFloor<T extends Material>(material: T, params: ShadeFloor, leafSun: Color | number = WORLD.palette.leafSun): T {
  const sun = leafSun instanceof Color ? leafSun : new Color(leafSun);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    prev?.call(material, shader, renderer);
    bindShadeFloor(shader, APPLIED_PREFIX, params, sun);
    shader.fragmentShader = shadeFloorPars(APPLIED_PREFIX) + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>\n${shadeFloorGlsl(APPLIED_PREFIX)}`,
    );
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|shade-floor`;
  return material;
}
