/**
 * Canopy roof system (owner-fable, 2026-09-19): the upper canopy that closes the open sky
 * between the giants' crowns when the walker looks up. Independent module: reads only
 * `WorldContext` (layout giants, terrain, wind, rng, palette) and the data-only corridor exports
 * of the trees system; touches no other system's internals. See roof.ts for the placement rules
 * and what the fixed frames' contracts require of it (no shadow casting, carved along every
 * god-ray column and sun pool, dropped inside the hero frames).
 *
 * Material: MeshStandardMaterial over the seeded roof atlas (atlas.ts), double-sided with an
 * alpha test, vertex colours for the per-clump tint, the shared wind's branch layer for a slow
 * sway, and two additions in the fragment shader — sun transmission through the thin fringe of
 * a mass (the atlas' overlap-depth channel: a single leaf lets the sun through, a mass does
 * not) and a small ambient lift on the underside so a mass in shade is a dark green, never a
 * black cut-out. The height fog reaches it through the shared shader chunks like every other
 * material.
 */
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Frustum, Group, Matrix4, Mesh, MeshStandardMaterial, Sphere, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { WIND_GLSL } from '../wind/wind';
import { createRoofAtlas, type RoofAtlas } from './atlas';
import { buildRoof, HERO_DROP_STAND_M, ROOF_STAND_BANDS, type RoofBuild } from './roof';

/** alpha test of the roof cards (below 0.5 so the fine fringe keeps its coverage in the mips) */
export const ROOF_ALPHA_TEST = 0.4;
/** negative mip bias on the atlas so the fringe leaves do not mip to a sprinkle at 30 m */
export const ROOF_MIP_BIAS = -0.6;
/** sun transmission strength through the fringe (× the sun's colour × the leaf albedo) */
export const ROOF_SUN_THROUGH = 0.42;
/** ambient lift of the underside (× the leaf albedo), so a mass in shade never reads black */
export const ROOF_UNDER_LIFT = 0.16;
/**
 * Sky light through the layer (× the leaf albedo × the air's own colour, unit-scaled): the lift
 * above is one number for every texel, so under a mass the atlas' leaf detail is multiplied by 0.16
 * and lands inside one or two display levels — measured looking up 60° from the open north
 * (art/environment/squad2-2026-09-23/roofsky), the roof's own pixels there were 98.5 % under
 * display level 30 and the frame's neighbour-to-neighbour luminance difference was 1.75 against
 * 5.0–5.3 in the leafy parts of the same frame: a dark slab, which is what the owner's backlog
 * item 4 calls "a dark flat disc overhead".
 *
 * This term is the diffuse sky the canopy transmits, so it scales with the atlas' overlap-depth
 * channel (`thin`, linear — the sun-through term above uses `thin²` and needs the sun behind the
 * card, so a mass in shade gets nothing from it). Thin fringes lift, deep masses stay dark, and the
 * variation between them is the structure the flat lift cannot give.
 */
export const ROOF_SKY_THROUGH = 0.6;
/** the roof cards' wind: heightAboveGround share and stiffness of the shared `windBranch` */
export const ROOF_WIND: [number, number] = [0.35, 0.86];
/** sector meshes the roof is split into for frustum culling */
export const ROOF_SECTORS = 6;
/**
 * a card's coverage by |cos| of the angle between its normal and the view ray — gone at and
 * under the first value, full from the second (the giants' cluster cards use the same rule,
 * trees/materials.ts CARD_EDGE_FADE): a card seen edge-on is a line, and a nearly edge-on one
 * read as a dark sliver cutting the sky in the first render
 */
export const ROOF_EDGE_FADE: [number, number] = [0.12, 0.3];

const ROOF_VERTEX_PARS = /* glsl */ `
attribute vec3 aRoot;
`;
const ROOF_VERTEX_BODY = /* glsl */ `
  #include <begin_vertex>
  {
    vec3 rootWorld = (modelMatrix * vec4(aRoot, 1.0)).xyz;
    vec3 sway = windBranch(rootWorld, aRoot.y * ROOF_WIND_HEIGHT, ROOF_WIND_STIFF);
    // a card's corners sway with their clump; the far corner a touch more (the layer flexes)
    transformed += sway * (0.8 + 0.2 * uv.y);
    // the card's own world position and plane normal for the edge-on fade (three's
    // vWorldPosition exists only with an env map / shadows on the material — this one has neither)
    vRoofWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vRoofNormal = normalize(mat3(modelMatrix) * normal);
  }
`;
const ROOF_FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uRoofDepth;
uniform vec3 uRoofSunDir;
uniform vec3 uRoofSunColor;
uniform float uRoofThrough;
uniform float uRoofUnderLift;
uniform vec3 uRoofSkyColor;
uniform float uRoofSkyThrough;
uniform vec2 uRoofEdgeFade;
varying vec3 vRoofNormal;
varying vec3 vRoofWorld;
`;
/** after lights_fragment_end: `normal` is the face-corrected shading normal (toward the viewer) */
const ROOF_FRAGMENT_BODY = /* glsl */ `
  #include <lights_fragment_end>
  {
    float thin = 1.0 - texture2D(uRoofDepth, vMapUv).r;
    // the sun behind the card (its light comes through toward the viewer): dot of the viewer-facing
    // normal's opposite with the sun direction
    float back = max(0.0, dot(-normal, uRoofSunDir));
    reflectedLight.directDiffuse += uRoofSunColor * uRoofThrough * thin * thin * back * diffuseColor.rgb;
    reflectedLight.indirectDiffuse += uRoofUnderLift * diffuseColor.rgb;
    reflectedLight.indirectDiffuse += uRoofSkyThrough * thin * uRoofSkyColor * diffuseColor.rgb;
  }
`;

function createRoofMaterial(ctx: WorldContext, atlas: RoofAtlas, sunDir: Vector3): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    map: atlas.color,
    alphaTest: ROOF_ALPHA_TEST,
    vertexColors: true,
    side: DoubleSide,
    roughness: 0.92,
    metalness: 0,
  });
  mat.name = 'canopy-roof';
  const sunColor = ctx.sun ? ctx.sun.color.clone().multiplyScalar(Math.min(1, ctx.sun.intensity * 0.3)) : new Color(1, 0.96, 0.85);
  // the air's own colour at unit scale, so ROOF_SKY_THROUGH is the whole strength of the term and
  // the sky the layer transmits keeps the haze's warm grey rather than going neutral
  const skyTint = new Color(ctx.config.fog.color);
  skyTint.multiplyScalar(1 / Math.max(1e-3, Math.max(skyTint.r, skyTint.g, skyTint.b)));
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uRoofDepth = { value: atlas.depth };
    shader.uniforms.uRoofSunDir = { value: sunDir.clone().normalize() };
    shader.uniforms.uRoofSunColor = { value: sunColor };
    shader.uniforms.uRoofThrough = { value: ROOF_SUN_THROUGH };
    shader.uniforms.uRoofUnderLift = { value: ROOF_UNDER_LIFT };
    shader.uniforms.uRoofSkyColor = { value: skyTint };
    shader.uniforms.uRoofSkyThrough = { value: ROOF_SKY_THROUGH };
    shader.uniforms.uRoofEdgeFade = { value: new Vector2(ROOF_EDGE_FADE[0], ROOF_EDGE_FADE[1]) };
    shader.vertexShader = `#define ROOF_WIND_HEIGHT ${ROOF_WIND[0].toFixed(3)}\n#define ROOF_WIND_STIFF ${ROOF_WIND[1].toFixed(3)}\n${WIND_GLSL}\n${ROOF_VERTEX_PARS}\nvarying vec3 vRoofNormal;\nvarying vec3 vRoofWorld;\n${shader.vertexShader}`.replace('#include <begin_vertex>', ROOF_VERTEX_BODY);
    shader.fragmentShader = `${ROOF_FRAGMENT_PARS}\n${shader.fragmentShader}`
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
    #ifdef USE_MAP
      vec4 sampledDiffuseColor = texture2D(map, vMapUv, ${ROOF_MIP_BIAS.toFixed(2)});
      #ifdef DECODE_VIDEO_TEXTURE
        sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
      #endif
      // edge-on fade: the view ray against the card's plane normal (world space, before the
      // face flip — the fade is symmetric)
      float roofFacing = abs(dot(normalize(vRoofNormal), normalize(cameraPosition - vRoofWorld)));
      sampledDiffuseColor.a *= smoothstep(uRoofEdgeFade.x, uRoofEdgeFade.y, roofFacing);
      diffuseColor *= sampledDiffuseColor;
    #endif
    `,
      )
      .replace('#include <lights_fragment_end>', ROOF_FRAGMENT_BODY);
  };
  mat.customProgramCacheKey = () => 'canopy-roof-v2';
  ctx.wind.bind(mat);
  return mat;
}

/**
 * The sector geometries concatenated into one. Every sector carries the same five attributes and an index,
 * so this is an array copy and an index offset per part — no dependency, and the vertex data is identical,
 * which is why the merged mesh draws the same pixels as the seven did.
 */
function mergeSectors(parts: BufferGeometry[]): BufferGeometry {
  const sizes = { position: 3, normal: 3, uv: 2, color: 3, aRoot: 3 } as const;
  const out = new BufferGeometry();
  let vertices = 0;
  let indices = 0;
  for (const p of parts) {
    vertices += p.getAttribute('position').count;
    indices += p.index!.count;
  }
  for (const name of Object.keys(sizes) as (keyof typeof sizes)[]) {
    const merged = new Float32Array(vertices * sizes[name]);
    let at = 0;
    for (const p of parts) {
      const a = p.getAttribute(name).array as Float32Array;
      merged.set(a, at);
      at += a.length;
    }
    out.setAttribute(name, new BufferAttribute(merged, sizes[name]));
  }
  const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  let at = 0;
  let base = 0;
  for (const p of parts) {
    const a = p.index!.array;
    for (let i = 0; i < a.length; i++) index[at + i] = a[i] + base;
    at += a.length;
    base += p.getAttribute('position').count;
  }
  out.setIndex(new BufferAttribute(index, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'canopy';
  const rng = ctx.rng.fork('canopy-roof');
  const atlas = createRoofAtlas(rng, ctx.config.palette, ctx.quality.tier === 'low' ? 512 : 1024);
  const sunDir = ctx.sun ? ctx.sun.position.clone().sub(ctx.sun.target.position).normalize() : new Vector3(0.6, 0.6, 0.5).normalize();
  const built: RoofBuild = buildRoof(ctx, rng, { sunDir, density: Math.min(1, Math.max(0.5, ctx.quality.density)), sectors: ROOF_SECTORS });
  const material = createRoofMaterial(ctx, atlas, sunDir);
  /**
   * ONE mesh, not one per sector. `roof.ts` splits the cards into sectors "for frustum culling", and the
   * renderer never drops one: `isolate('canopy')` reads **7 calls / 8 210 triangles** at hero A, at
   * `stairs1-top` and at `stairs2-top` alike — seven meshes, seven draws, every time. A sector's bounding
   * sphere spans most of the forest, so the test cannot fire from inside it.
   *
   * Seven draws for 8 210 triangles is **1 173 a draw**, the thinnest ratio in the frame, and draws are the
   * scarcer resource where it is tight (`lookspots/`: `stairs1-top` runs at 661 of W38's 700). The split's
   * worst case if culling ever did fire is the whole roof's 8 210 triangles, 0.09 % of an 8.7 M frame,
   * against six draws saved at every pose. The sector *build* is untouched — the stand still writes its own
   * writer so the plaza sectors' geometry never changes — this merges only what is handed to the renderer.
   */
  const roofGeometry = mergeSectors(built.sectors.map((s) => s.geometry));
  for (const s of built.sectors) s.geometry.dispose();
  const roof = new Mesh(roofGeometry, material);
  roof.name = 'canopy-roof';
  // no shadow casting or receiving: the ground dapple / sun pools / ray mask are measured
  // contracts of the fixed frames, and an underside facing away from the sun needs no lookup
  roof.castShadow = false;
  roof.receiveShadow = false;
  roof.userData.kind = 'canopy-roof';
  const meshes: Mesh[] = [roof];
  group.add(roof);

  /**
   * What the renderer gets for the current camera, which `triangles` below is NOT: that is the roof as
   * built, and until this was added the roof had no per-frame figure at all. With one mesh, no casting and a
   * single material it is one draw when the sphere is in view and nothing when it is not — the whole rule,
   * so this can be checked against `isolate('canopy')` and should agree exactly
   * (`auditvsrenderer/vsrenderer.mjs --system canopy --audit-key canopyRoof`).
   */
  const submission = () => {
    const cam = ctx.camera;
    if (!cam) return { drawCalls: 0, triangles: 0, meshes: meshes.length };
    cam.updateMatrixWorld();
    const view = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const s = new Sphere();
    let drawCalls = 0;
    let triangles = 0;
    for (const m of meshes) {
      if (!m.visible || !material.visible) continue;
      const bs = m.geometry.boundingSphere;
      if (bs && m.frustumCulled && !view.intersectsSphere(s.copy(bs).applyMatrix4(m.matrixWorld))) continue;
      drawCalls++;
      triangles += Math.floor(m.geometry.index!.count / 3);
    }
    return { drawCalls, triangles, meshes: meshes.length };
  };

  ctx.audit('canopyRoof', () => ({
    clumps: built.clumps.length,
    cards: built.cards,
    /** the roof AS BUILT; `submission` is what a frame pays */
    triangles: built.triangles,
    submission: submission(),
    meshes: meshes.length,
    castsShadow: false,
    dropped: built.dropped,
    cells: built.cells,
    minAboveGroundM: Math.round(built.minAboveGround * 100) / 100,
    heightsM: [Math.round(Math.min(...built.clumps.map((c) => c.y)) * 10) / 10, Math.round(Math.max(...built.clumps.map((c) => c.y)) * 10) / 10],
    /** the north-stand pass (roof.ts ROOF_STAND_BANDS): its own counts, its own hero-frame drop distance */
    stand: {
      clumps: built.stand.clumps,
      cards: built.stand.cards,
      cells: built.stand.cells,
      dropped: built.stand.dropped,
      minAboveGroundM: Math.round(built.stand.minAboveGround * 100) / 100,
      heroDropM: HERO_DROP_STAND_M,
      /** the nearest built stand clump inside each hero frame (view depth, m; null = none): what the drop distance is measured against */
      nearestHeroM: Object.fromEntries(Object.entries(built.stand.nearestHeroM).map(([k, v]) => [k, v === null ? null : Math.round(v * 10) / 10])),
      bands: ROOF_STAND_BANDS.length,
    },
    atlas: { tiles: atlas.tiles, size: atlas.color.image.width },
    material: { alphaTest: ROOF_ALPHA_TEST, mipBias: ROOF_MIP_BIAS, sunThrough: ROOF_SUN_THROUGH, underLift: ROOF_UNDER_LIFT, wind: ROOF_WIND },
    samplePositions: { clumps: built.clumps.slice(0, 64).map((c) => [c.x, c.y, c.z]) },
  }));

  return {
    name: 'canopy',
    group,
    dispose() {
      roofGeometry.dispose();
      material.dispose();
      atlas.color.dispose();
      atlas.depth.dispose();
    },
  };
}
