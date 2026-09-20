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
 * hero camera 6 m or more from a rock's surface renders exactly the far look (camera D stands
 * 7.3 m from the D boulder's centre, ≈ 6.5 m from its nearest lump):
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
/**
 * fable-2: the near terms hold to 4 m and are gone by 6.3 m (were 2.5 / 6.0) so the wet band,
 * moss cushions and lichen crust read at player height, 2–6 m off; camera D — the nearest hero
 * camera to any hero rock — stands 7.22 m from the D boulder's centre, ≥ 6.4 m from its lumps.
 */
export const NEAR_FADE_M: [number, number] = [4.0, 6.3];
export const NEAR_NORMAL_BOOST = 0.8;

/**
 * @param shade overall albedo multiplier (rock and moss alike) — the big terrace boulder in
 *   shot A reads darker than the small stair-foot ones in the reference
 * @param opts.near the hero boulders' near-detail variant (see NEAR_TILE_M)
 * @param opts.fade the near variant's fade band (m) when it is not the hero boulders' NEAR_FADE_M —
 *   the ledge faces (ledge.ts) are read from the path, 3–9 m off, so theirs reaches further
 */
export async function createRockMaterial(textures: TextureLibrary, config: WorldConfig, anisotropy = 8, tile = 1.4, shade = 1, opts: { near?: boolean; fade?: [number, number] } = {}) {
  const near = !!opts.near;
  const fade = opts.fade ?? NEAR_FADE_M;
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
  mat.name = `${shade === 1 ? 'rock-triplanar' : `rock-triplanar-shade${shade}`}${near ? '-near' : ''}${opts.fade ? `-fade${opts.fade[1]}` : ''}`;
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
      shader.uniforms.uNearFade = { value: new Vector2(fade[0], fade[1]) };
      shader.uniforms.uNearNormalBoost = { value: NEAR_NORMAL_BOOST };
    }
    // the near variant's extra varyings (the wet band, the lichen crust) and its per-fragment weight
    const nearVaryV = near ? ' attribute float aWet; varying float vWetR; attribute float aLichen; varying float vLichenR;' : '';
    const nearVaryF = near ? ' varying float vWetR; varying float vLichenR; uniform float uNearTile; uniform vec2 uNearFade; uniform float uNearNormalBoost;' : '';
    const nearAssign = near ? '\n        vWetR = aWet; vLichenR = aLichen;' : '';
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
            // fable-2 (opus #10: the D boulder "an unreadable dark mass" at 2 m): in frame D the
            // reference's boulder face renders at parity with the ferns beside it (lum 0.32 both);
            // ours rendered 0.17 against ferns at 0.21 — probes at the pose (white lit rock 0.47,
            // normal map / roughness / near colour terms each changing nothing measurable) put the
            // whole gap in the stone's value, so the near stone is lifted ×1.35 and warmed toward
            // the reference's olive-tan (rgb 91/83/45), with a little less of the source's crazing
            cn = mix(vec3(0.37), cn, 0.8) * vec3(1.43, 1.35, 1.22);
            // plate tone: neighbouring 25–40 cm plates differ ±10 % in value (frame-05's faces are
            // a patchwork of lighter and darker slabs), so a face in flat shade still reads as
            // fractured stone rather than one even grey
            {
              vec3 bwp = bw * bw;
              vec2 pp = vWPosR.zy * bwp.x + vWPosR.xz * bwp.y + vWPosR.xy * bwp.z;
              cn *= 0.9 + 0.2 * rockVNoise(pp * 3.3 + 21.0);
            }
            c = mix(c, cn, nearW);
            l = dot(c, vec3(0.299, 0.587, 0.114));
          }`
      : '';
    const nearAlbedo = near
      ? /* glsl */ `
          // lichen plates (dressing.ts, aMoss < 0): their own muted vertex colour, the rock texture
          // flattened to its luminance under them (≈ 1.5× the stone's value, not the 2.5× that read
          // as white discs)
          diffuseColor.rgb *= mix(c * 1.08, vec3(0.62 + 0.45 * l), plate);
          if (nearW > 0.0005) {
            float vl = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
            float wet = clamp(vWetR, 0.0, 1.0) * nearW * (1.0 - plate);
            // grime: the cracks and partings (dark vertex colour) hold a damp dark brown — not the
            // collar (fable-2: the soil collar is dark already; grimed as well it went black and
            // swallowed the wet band, survey-2 #19 / #32)
            float grime = smoothstep(0.42, 0.16, vl) * nearW * (1.0 - plate) * (1.0 - 0.85 * wet);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.12, 0.1, 0.075) * (0.7 + 0.8 * l), 0.55 * grime);
            // the wet band above the ground: a shade darker, cooler, a little bluer (damp stone,
            // not mud); the gloss (roughness below) carries most of the read — at 0.56–0.68 the
            // band was the darkest thing on the D boulder's face (opus #10)
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.7, 0.72, 0.78), wet);
          }`
      : /* glsl */ `
          diffuseColor.rgb *= c * 1.08;`;
    const nearLichenMask = near ? ' * (1.0 - plate)' : '';
    // round 44 (survey-1 crop 32): the hero variant's flecks are irregular crusts, not dots — the
    // fleck field is domain-warped (the lattice of the value noise no longer shows), thresholded
    // lower inside a clump so neighbouring flecks fuse into one plate, and each crust has a dark
    // rim band outside its edge; the instanced far rocks keep the round-42 flecks.
    // fable-2 (survey-2 #32): at near range the flecks still read as polka dots at 1 m, so they
    // fade out with nearW and the CRUST field baked per vertex by rockgen (`aLichen`: colonies
    // that spread over the middle of a plate and stop at its joints) fades in — its edge torn by
    // a fine noise, a damp dark rim just outside it, a granular tone inside. The hero cameras
    // (≥ 6.5 m from every hero rock) keep the far flecks exactly.
    const fleckExpr = near
      ? /* glsl */ `
            vec2 lw = lp + (vec2(rockVNoise(lp * 9.0 + 5.0), rockVNoise(lp * 9.0 - 7.0)) - 0.5) * 0.09;
            float fl = rockVNoise(lw * 14.0) * 0.55 + rockVNoise(lw * 31.0 + 3.0) * 0.3 + rockVNoise(lp * 67.0 + 9.0) * 0.15;
            float thr = 0.66 - 0.16 * cluster;
            float fleck = smoothstep(thr - 0.03, thr + 0.05, fl) * (1.0 - nearW);
            float fleckRim = smoothstep(thr - 0.1, thr - 0.03, fl) * (1.0 - fleck) * cluster * (1.0 - mossCov) * smoothstep(-0.5, 0.1, vWNrmR.y) * (1.0 - plate) * (1.0 - nearW);
            diffuseColor.rgb *= 1.0 - 0.22 * fleckRim;
            float cn = rockVNoise(lp * 26.0 + 1.0) * 0.6 + rockVNoise(lp * 55.0 + 7.0) * 0.4;
            float cv = clamp(vLichenR, 0.0, 1.0) + 0.34 * (cn - 0.5);
            float crust = smoothstep(0.36, 0.52, cv) * nearW;
            float crustRim = smoothstep(0.18, 0.36, cv) * (1.0 - smoothstep(0.36, 0.52, cv)) * nearW * (1.0 - mossCov) * (1.0 - plate);
            diffuseColor.rgb *= 1.0 - 0.22 * crustRim;
            // the crust's own tone: per-colony pale grey / grey-green / whitish, granular inside
            // (crustose lichen is a chalky skin a shade paler than the stone, not a green paint)
            float colonyTone = rockVNoise(lp * 2.3 + 4.0);
            vec3 crustCol = mix(mix(vec3(0.66, 0.66, 0.59), vec3(0.62, 0.66, 0.52), smoothstep(0.3, 0.6, colonyTone)), vec3(0.75, 0.74, 0.68), smoothstep(0.65, 0.9, colonyTone));
            crustCol *= 0.86 + 0.28 * rockVNoise(lp * 44.0 + 2.0);`
      : /* glsl */ `
            float fleck = smoothstep(0.56, 0.68, rockVNoise(lp * 19.0) * 0.7 + rockVNoise(lp * 43.0 + 3.0) * 0.3);`;
    // the crust replaces the fleck colour where it is present
    const lichenColExpr = near ? 'mix(mix(vec3(0.62, 0.66, 0.5), vec3(0.7, 0.7, 0.64), rockVNoise(lp * 7.0)), crustCol, crust) * diffuse' : 'mix(vec3(0.62, 0.66, 0.5), vec3(0.7, 0.7, 0.64), rockVNoise(lp * 7.0)) * diffuse';
    const lichenAmount = near ? 'max(cluster * fleck, crust)' : 'cluster * fleck';
    // cushions (aMoss > 1): the crown lifted toward the lit bright green, the rim the plain moss
    // (opus #10: at near range the blanket's shaded rim — the damp dark green turned from the sun —
    // is what made the D boulder's cap a black-edged mass; lifted a quarter, sunlit moss untouched)
    const nearMossLift = near ? '\n          moss *= 1.0 + 0.35 * max(0.0, vMossR - 1.0);\n          moss *= 1.0 + 0.25 * nearW * (1.0 - sunSide);' : '';
    const nearNormal = near
      ? /* glsl */ `
          if (nearW > 0.0005) {
            vec3 mx = texture2D(normalMap, vWPosR.zy * uNearTile).xyz * 2.0 - 1.0;
            vec3 my = texture2D(normalMap, vWPosR.xz * uNearTile).xyz * 2.0 - 1.0;
            vec3 mz = texture2D(normalMap, vWPosR.xy * uNearTile).xyz * 2.0 - 1.0;
            nx = mix(nx, mx, nearW); ny = mix(ny, my, nearW); nz = mix(nz, mz, nearW);
            ns *= 1.0 + uNearNormalBoost * nearW;
            // the lichen crust is a smooth skin over the pitting
            ns *= 1.0 - 0.45 * smoothstep(0.34, 0.5, clamp(vLichenR, 0.0, 1.0)) * nearW;
          }
          ns *= 1.0 - clamp(-vMossR, 0.0, 1.0);`
      : '';
    const nearRough = near
      ? /* glsl */ `
          roughnessFactor *= 1.0 - 0.55 * clamp(vWetR, 0.0, 1.0) * nearW;
          roughnessFactor = mix(roughnessFactor, 0.95, clamp(-vMossR, 0.0, 1.0));
          roughnessFactor = mix(roughnessFactor, 0.96, smoothstep(0.34, 0.5, clamp(vLichenR, 0.0, 1.0)) * nearW);`
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
            float cluster = smoothstep(0.46, 0.7, rockVNoise(lp * 3.1 + 11.0));${fleckExpr}
            float lichen = ${lichenAmount} * (1.0 - mossCov) * smoothstep(-0.5, 0.1, vWNrmR.y)${nearLichenMask};
            vec3 lichenCol = ${lichenColExpr};
            diffuseColor.rgb = mix(diffuseColor.rgb, lichenCol * (0.85 + 0.3 * l), ${near ? 'mix(0.75, 0.7, crust)' : '0.75'} * lichen);
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
  mat.customProgramCacheKey = () => (near ? 'rock-triplanar-v12-pale-near-stone' : 'rock-triplanar-v8-sunside-moss');
  return mat;
}
