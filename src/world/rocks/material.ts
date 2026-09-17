/**
 * Rock material: vertex-coloured MeshStandardMaterial with world-space triplanar colour + normal
 * detail from a Poly Haven rock set and an `aMoss` blend toward the palette moss greens.
 * Works for plain meshes and InstancedMesh (instance matrices are folded into the world position).
 */
import { Color, MeshStandardMaterial, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import type { TextureLibrary } from '../materials/textures';
import type { WorldConfig } from '../config';

export const ROCK_SET = 'rock_boulder_cracked';

/**
 * Near detail of the hero-boulder material (round 42), all of it weighted by
 * `1 − smoothstep(NEAR_FADE_M[0], NEAR_FADE_M[1], distance to the camera)` per fragment, so a
 * hero camera 6.7 m or more from a rock renders exactly the far look:
 *  - a second triplanar sample at NEAR_TILE_M-metre tiles blended in — the 2K
 *    rock_boulder_cracked maps (textures-2k, round 38) then show the source's fractures at their
 *    real scale (10–30 cm plates and partings) instead of the 1.4 m tiling's hairline grain,
 *    with less of the far path's contrast compression
 *  - the normal map's strength lifted by NEAR_NORMAL_BOOST until the pitting reads
 *  - a wet, dark band above the ground (`aWet`, rockgen.ts) — darker, cooler, less rough
 *  - grime in the cracks: where the vertex colour is a crack/parting the texture is pulled to a
 *    dark damp brown
 *  - moss cushions (`aMoss` > 1) lifted toward the bright green on their crowns, and lichen
 *    plates (`aMoss` < 0) painted in their own pale vertex colour (dressing.ts)
 */
export const NEAR_TILE_M = 2.6;
export const NEAR_FADE_M: [number, number] = [3.0, 6.5];
export const NEAR_NORMAL_BOOST = 0.8;

/**
 * @param shade overall albedo multiplier (rock and moss alike) — the big terrace boulder in
 *   shot A reads darker than the small stair-foot ones in the reference
 * @param opts.near the hero boulders' near-detail variant (see NEAR_TILE_M)
 */
export async function createRockMaterial(textures: TextureLibrary, config: WorldConfig, anisotropy = 8, tile = 1.4, shade = 1, opts: { near?: boolean } = {}) {
  const near = !!opts.near;
  const [color, normal, rough] = await Promise.all([
    textures.load(ROCK_SET, 'color', { anisotropy }),
    textures.load(ROCK_SET, 'normal', { anisotropy }),
    textures.load(ROCK_SET, 'roughness', { anisotropy }),
  ]);
  const P = config.palette;
  const mat = new MeshStandardMaterial({
    map: color,
    normalMap: normal,
    // low relief: the reference boulders are weathered smooth, the texture only hints at pitting
    normalScale: new Vector2(0.55, 0.55),
    roughnessMap: rough,
    roughness: 0.92,
    metalness: 0,
    vertexColors: true,
    color: new Color(shade, shade, shade),
  });
  mat.name = `${shade === 1 ? 'rock-triplanar' : `rock-triplanar-shade${shade}`}${near ? '-near' : ''}`;
  // the boulder caps in the reference are an olive-brown moss (#70683b, R > G), not the yellow-green
  // of the ground moss: pull both palette greens toward it. Round 4 (frames 1 s / 56 s, measured
  // in the rock boxes): the sunlit cushion reads lum 0.45–0.47 at HSL sat 0.27–0.30 where ours
  // rendered 0.36 / 0.25, and the shaded moss 0.21–0.22 at sat 0.33–0.36 — so the bright end is
  // lifted 1.3× and kept greener, and a damp, darker, more saturated green takes over on the
  // faces turned away from the sun (uSunDir below), on top of the lighting's own falloff
  const cap = new Color(0x70683b);
  const mossDeep = new Color(P.mossDeep).lerp(cap, 0.5);
  const mossBright = new Color(P.mossBright).lerp(cap, 0.4).multiplyScalar(1.8);
  const mossDamp = new Color(P.mossDeep).lerp(new Color(0x2f3a1e), 0.45);
  const az = (config.sun.azimuthDeg * Math.PI) / 180;
  const el = (config.sun.elevationDeg * Math.PI) / 180;
  const sunDir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uMossDeep = { value: mossDeep };
    shader.uniforms.uMossBright = { value: mossBright };
    shader.uniforms.uMossDamp = { value: mossDamp };
    shader.uniforms.uSunDir = { value: sunDir };
    shader.uniforms.uRockTile = { value: 1 / tile };
    if (near) {
      shader.uniforms.uNearTile = { value: 1 / NEAR_TILE_M };
      shader.uniforms.uNearFade = { value: new Vector2(NEAR_FADE_M[0], NEAR_FADE_M[1]) };
      shader.uniforms.uNearNormalBoost = { value: NEAR_NORMAL_BOOST };
    }
    // the near variant's extra varying (the wet band) and its per-fragment weight
    const nearVaryV = near ? ' attribute float aWet; varying float vWetR;' : '';
    const nearVaryF = near ? ' varying float vWetR; uniform float uNearTile; uniform vec2 uNearFade; uniform float uNearNormalBoost;' : '';
    const nearAssign = near ? '\n        vWetR = aWet;' : '';
    const nearWeight = near ? 'float nearW = 1.0 - smoothstep(uNearFade.x, uNearFade.y, distance(vWPosR, cameraPosition));' : '';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aMoss; varying float vMossR; varying vec3 vWPosR; varying vec3 vWNrmR;${nearVaryV}`)
      .replace(
        '#include <worldpos_vertex>',
        /* glsl */ `
        #include <worldpos_vertex>
        vMossR = aMoss;${nearAssign}
        #ifdef USE_INSTANCING
          vWPosR = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vWNrmR = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWPosR = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrmR = normalize(mat3(modelMatrix) * objectNormal);
        #endif`,
      );
    // near-only blocks (empty strings in the far variant, whose GLSL is exactly what it was)
    const nearColour = near
      ? /* glsl */ `
          float plate = clamp(-vMossR, 0.0, 1.0);
          if (nearW > 0.0005) {
            // the near tile: the same maps at NEAR_TILE_M-metre repeats, the source's fractures at
            // their real scale, with less of the contrast compression (0.86 vs 0.7)
            vec3 nx = texture2D(map, vWPosR.zy * uNearTile).rgb;
            vec3 ny = texture2D(map, vWPosR.xz * uNearTile).rgb;
            vec3 nz = texture2D(map, vWPosR.xy * uNearTile).rgb;
            vec3 cn = nx * bw.x + ny * bw.y + nz * bw.z;
            float lnr = dot(cn, vec3(0.299, 0.587, 0.114));
            cn = mix(cn, vec3(lnr) * vec3(0.985, 0.99, 0.99), 0.78);
            cn = mix(vec3(0.3), cn, 0.86);
            c = mix(c, cn, nearW);
            l = dot(c, vec3(0.299, 0.587, 0.114));
          }`
      : '';
    const nearAlbedo = near
      ? /* glsl */ `
          // lichen plates (dressing.ts, aMoss < 0): their own pale vertex colour, the rock texture
          // flattened to its luminance under them
          diffuseColor.rgb *= mix(c * 1.08, vec3(0.8 + 0.4 * l), plate);
          if (nearW > 0.0005) {
            float vl = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
            // grime: the cracks and partings (dark vertex colour) hold a damp dark brown
            float grime = smoothstep(0.42, 0.16, vl) * nearW * (1.0 - plate);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.1, 0.075) * (0.7 + 0.8 * l), 0.7 * grime);
            // the wet band above the ground: darker and a shade cooler (frame-05's dark undersides)
            float wet = clamp(vWetR, 0.0, 1.0) * nearW * (1.0 - plate);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.5, 0.54, 0.58), wet);
          }`
      : /* glsl */ `
          diffuseColor.rgb *= c * 1.08;`;
    const nearLichenMask = near ? ' * (1.0 - plate)' : '';
    // cushions (aMoss > 1): the crown lifted toward the lit bright green, the rim the plain moss
    const nearMossLift = near ? '\n          moss *= 1.0 + 0.35 * max(0.0, vMossR - 1.0);' : '';
    const nearNormal = near
      ? /* glsl */ `
          if (nearW > 0.0005) {
            vec3 mx = texture2D(normalMap, vWPosR.zy * uNearTile).xyz * 2.0 - 1.0;
            vec3 my = texture2D(normalMap, vWPosR.xz * uNearTile).xyz * 2.0 - 1.0;
            vec3 mz = texture2D(normalMap, vWPosR.xy * uNearTile).xyz * 2.0 - 1.0;
            nx = mix(nx, mx, nearW); ny = mix(ny, my, nearW); nz = mix(nz, mz, nearW);
            ns *= 1.0 + uNearNormalBoost * nearW;
          }
          ns *= 1.0 - clamp(-vMossR, 0.0, 1.0);`
      : '';
    const nearRough = near
      ? /* glsl */ `
          roughnessFactor *= 1.0 - 0.4 * clamp(vWetR, 0.0, 1.0) * nearW;
          roughnessFactor = mix(roughnessFactor, 0.95, clamp(-vMossR, 0.0, 1.0));`
      : '';
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uMossDeep; uniform vec3 uMossBright; uniform vec3 uMossDamp; uniform vec3 uSunDir; uniform float uRockTile;
        varying float vMossR; varying vec3 vWPosR; varying vec3 vWNrmR;${nearVaryF}
        vec3 triW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
        float rockHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rockVNoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(rockHash(i), rockHash(i + vec2(1.0, 0.0)), f.x), mix(rockHash(i + vec2(0.0, 1.0)), rockHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }`,
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
          // the source rock is orange; keep its detail but pull to a near-neutral grey (the
          // concept sheets' boulders are grey stone under the moss, not warm brown), and
          // compress its cracked-texture contrast so the boulders read smooth, not crazed
          c = mix(c, vec3(l) * vec3(0.985, 0.99, 0.99), 0.78);
          c = mix(vec3(0.3), c, 0.7);
          ${nearWeight}${nearColour}${nearAlbedo}
          float mossCov = smoothstep(0.03, 0.85, clamp(vMossR, 0.0, 1.0));
          // lichen flecks (sheet 01 'Roots' / sheet 04): pale grey-green crusts 3–6 cm across,
          // clustered, on the bare rock only (they fade out under the moss cap and near the base)
          {
            vec3 bwl = bw * bw;
            vec2 lp = vWPosR.zy * bwl.x + vWPosR.xz * bwl.y + vWPosR.xy * bwl.z;
            float cluster = smoothstep(0.46, 0.7, rockVNoise(lp * 3.1 + 11.0));
            float fleck = smoothstep(0.56, 0.68, rockVNoise(lp * 19.0) * 0.7 + rockVNoise(lp * 43.0 + 3.0) * 0.3);
            float lichen = cluster * fleck * (1.0 - mossCov) * smoothstep(-0.5, 0.1, vWNrmR.y)${nearLichenMask};
            vec3 lichenCol = mix(vec3(0.62, 0.66, 0.5), vec3(0.7, 0.7, 0.64), rockVNoise(lp * 7.0)) * diffuse;
            diffuseColor.rgb = mix(diffuseColor.rgb, lichenCol * (0.85 + 0.3 * l), 0.75 * lichen);
          }
          // moss: the texture luminance (mean ≈ 0.3) picks between deep and bright green so the
          // moss keeps the rock's pitting; blend is near-opaque where the coverage is full. The
          // reference caps are a muted olive (#70683b), so the lift stays modest.
          float ln = clamp(l / 0.3, 0.0, 1.8);
          // the material colour is the per-rock shade and applies to the moss cap as well; only
          // the thick cushion (coverage → 1) reaches the bright end — thin skins on the small
          // stones and the cushion's edges stay the deeper green
          vec3 moss = mix(uMossDeep, uMossBright, smoothstep(0.3, 1.25, ln) * smoothstep(0.3, 0.95, vMossR)) * (0.74 + 0.34 * ln);
          // sun side vs shade side: the cushion facing the sun is the bright yellow-green of the
          // frames' lit caps; turned away it is a dark, damp, saturated green (the A rock's
          // shaded face, D's north side) — a stylised term the lighting alone leaves too flat
          float sunSide = smoothstep(-0.35, 0.5, dot(normalize(vWNrmR), uSunDir));
          moss = mix(uMossDamp * (0.75 + 0.3 * ln), moss, sunSide) * diffuse;${nearMossLift}
          diffuseColor.rgb = mix(diffuseColor.rgb, moss, mossCov);
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
          ${nearWeight}${nearNormal}
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
          ${nearWeight}${nearRough}
        }`,
      );
  };
  mat.customProgramCacheKey = () => (near ? 'rock-triplanar-v9-near-detail' : 'rock-triplanar-v8-sunside-moss');
  return mat;
}
