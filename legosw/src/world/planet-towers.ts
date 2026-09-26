import { BufferGeometry, Float32BufferAttribute, Group, type IUniform, Mesh, ShaderMaterial, Uint32BufferAttribute, Vector3, Vector4 } from 'three';
import type { Tower } from './planet-data';
import {
  ATMO_GLSL,
  CITY_GLSL,
  COMMON_GLSL,
  GRID_ANGLE,
  PALETTE_GLSL,
  SB_OFF,
  SHADE_GLSL,
  SUPERW,
  TIER0_MIN,
  TOWER_N,
  TOWER_STYLES,
  UNIFORMS_GLSL,
} from './planet-glsl';
import { LIGHT_GLSL } from './planet-surface';

/**
 * Coruscant's mega-towers: real geometry (true parallax, silhouettes against the horizon), three
 * stacked tiers banded by plate ledges and capped by a spire, merged into a few chunk meshes. They
 * share the ground's sun, sky, baked shadows, cloud shadows, lights and haze; below the painted
 * roofline a short ray cast toward the camera hides whatever the painted city stands in front of.
 *
 * Level of detail is a continuous geomorph in the vertex shader: round tiers merge from 16 to 8 to
 * 4 sides and spires sink into their base as they shrink on screen. Merged triangles are degenerate
 * and never rasterise, so distant towers are not shaded many times over by sub-pixel slivers, and
 * nothing pops.
 */

// per-vertex material ids (+ 10 × tier)
const M_WALL = 0;
const M_ROOF = 2;
const M_SPIRE = 3;
/** plate-ledge band at the top of each tier (painted: a real 3-stud overhang is a pixel at most) */
const LEDGE_H = 6;
const ROUND_SEG = 16;
const ZERO4 = [0, 0, 0, 0];

class Buf {
  pos: number[] = [];
  nrm: number[] = [];
  dat: number[] = [];
  axis: number[] = [];
  m1: number[] = [];
  m2: number[] = [];
  idx: number[] = [];
  /** the same towers with every round tier at 4 sides (what the full mesh morphs into far away) */
  idxC: number[] = [];
  /** base centre of the current tower (chunk-local) and the current tier's top altitude */
  cur = ZERO4;
  vert(p: number[], n: number[], d: number[], m1 = ZERO4, m2 = ZERO4): number {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.dat.push(d[0], d[1], d[2], d[3]);
    this.axis.push(this.cur[0], this.cur[1], this.cur[2], this.cur[3]);
    this.m1.push(m1[0], m1[1], m1[2], m1[3]);
    this.m2.push(m2[0], m2[1], m2[2], m2[3]);
    return this.pos.length / 3 - 1;
  }
  // corners counter-clockwise in grid coordinates; the grid frame (u, v, up) is left-handed in world
  // space, so the triangles are emitted the other way round to face outward. `to` picks the full
  // mesh (1), the coarse one (2) or both (3).
  quad(a: number, b: number, c: number, d: number, to = 3) {
    if (to & 1) this.idx.push(a, c, b, a, d, c);
    if (to & 2) this.idxC.push(a, c, b, a, d, c);
  }
  fan(c: number, a: number, b: number, to = 3) {
    if (to & 1) this.idx.push(c, b, a);
    if (to & 2) this.idxC.push(c, b, a);
  }
}

/** a tower's frame: up, the grid axes on the tangent plane, and the chunk origin positions are relative to */
interface Frame {
  up: number[];
  eu: number[];
  ev: number[];
  o: number[];
  R: number;
}
function at(F: Frame, x: number, y: number, a: number): number[] {
  const r = F.R + a;
  return [0, 1, 2].map((k) => F.up[k] * r + F.eu[k] * x + F.ev[k] * y - F.o[k]);
}
function dir(F: Frame, x: number, y: number): number[] {
  return [0, 1, 2].map((k) => F.eu[k] * x + F.ev[k] * y);
}

/**
 * A ring of ROUND_SEG + 1 points (the last closes the seam) at radius s, altitude z, each with its
 * morph offsets (position, u) onto the point it merges with at 8 and at 4 sides.
 */
function ring(F: Frame, s: number, z: number, uOf: (k: number) => number) {
  const pts: number[][] = [];
  for (let k = 0; k <= ROUND_SEG; k++) {
    const t = (k / ROUND_SEG) * Math.PI * 2;
    pts.push(at(F, Math.cos(t) * s, Math.sin(t) * s, z));
  }
  const off = (k: number, j: number) => [pts[j][0] - pts[k][0], pts[j][1] - pts[k][1], pts[j][2] - pts[k][2], uOf(j) - uOf(k)];
  return pts.map((p, k) => ({ p, m1: off(k, k - (k % 2)), m2: off(k, k - (k % 4)) }));
}

/**
 * Vertical walls of a box (half size s) or a ring (radius s) between altitudes z0 and z1; aData.x is
 * the distance around the perimeter (facade patterns).
 */
function walls(b: Buf, F: Frame, s: number, round: boolean, z0: number, z1: number, mat: number, pal: number, seed: number) {
  if (round) {
    const uOf = (k: number) => (k / ROUND_SEG) * Math.PI * 2 * s;
    const rl = ring(F, s, z0, uOf);
    const rh = ring(F, s, z1, uOf);
    const lo: number[] = [];
    const hi: number[] = [];
    for (let k = 0; k <= ROUND_SEG; k++) {
      const t = (k / ROUND_SEG) * Math.PI * 2;
      const n = dir(F, Math.cos(t), Math.sin(t));
      lo.push(b.vert(rl[k].p, n, [uOf(k), mat, pal, seed], rl[k].m1, rl[k].m2));
      hi.push(b.vert(rh[k].p, n, [uOf(k), mat, pal, seed], rh[k].m1, rh[k].m2));
    }
    for (let k = 0; k < ROUND_SEG; k++) b.quad(lo[k], lo[k + 1], hi[k + 1], hi[k], 1);
    for (let k = 0; k < ROUND_SEG; k += 4) b.quad(lo[k], lo[k + 4], hi[k + 4], hi[k], 2);
    return;
  }
  const cs = [
    [s, -s],
    [s, s],
    [-s, s],
    [-s, -s],
  ];
  for (let f = 0; f < 4; f++) {
    const p = cs[f];
    const q = cs[(f + 1) % 4];
    const n = dir(F, f === 0 ? 1 : f === 2 ? -1 : 0, f === 1 ? 1 : f === 3 ? -1 : 0);
    const u0 = f * 2 * s;
    const u1 = u0 + 2 * s;
    const a = b.vert(at(F, p[0], p[1], z0), n, [u0, mat, pal, seed]);
    const c = b.vert(at(F, q[0], q[1], z0), n, [u1, mat, pal, seed]);
    const d = b.vert(at(F, q[0], q[1], z1), n, [u1, mat, pal, seed]);
    const e = b.vert(at(F, p[0], p[1], z1), n, [u0, mat, pal, seed]);
    b.quad(a, c, d, e);
  }
}

/** flat top of a box / disc at altitude z */
function top(b: Buf, F: Frame, s: number, round: boolean, z: number, mat: number, pal: number, seed: number) {
  const n = F.up;
  if (round) {
    const c = b.vert(at(F, 0, 0, z), n, [0, mat, pal, seed]);
    const rr = ring(F, s, z, () => 0);
    const ids = rr.map((v) => b.vert(v.p, n, [0, mat, pal, seed], v.m1, v.m2));
    for (let k = 0; k < ROUND_SEG; k++) b.fan(c, ids[k], ids[k + 1], 1);
    for (let k = 0; k < ROUND_SEG; k += 4) b.fan(c, ids[k], ids[k + 4], 2);
    return;
  }
  const a = b.vert(at(F, -s, -s, z), n, [0, mat, pal, seed]);
  const c = b.vert(at(F, s, -s, z), n, [0, mat, pal, seed]);
  const d = b.vert(at(F, s, s, z), n, [0, mat, pal, seed]);
  const e = b.vert(at(F, -s, s, z), n, [0, mat, pal, seed]);
  b.quad(a, c, d, e);
}

/** tapered spire from altitude z0 (half width w0) to z1; aData.x = base altitude, aData.w = base half width */
function spire(b: Buf, F: Frame, w0: number, z0: number, z1: number, round: boolean, pal: number) {
  const segs = round ? 6 : 4;
  const w1 = w0 * 0.18;
  const lo: number[] = [];
  const hi: number[] = [];
  for (let k = 0; k <= segs; k++) {
    const t = (k / segs) * Math.PI * 2 + (round ? 0 : Math.PI / 4);
    const c = Math.cos(t);
    const sn = Math.sin(t);
    const n = dir(F, c, sn);
    lo.push(b.vert(at(F, c * w0, sn * w0, z0), n, [z0, M_SPIRE, pal, w0]));
    hi.push(b.vert(at(F, c * w1, sn * w1, z1), n, [z0, M_SPIRE, pal, w0]));
  }
  for (let k = 0; k < segs; k++) b.quad(lo[k], lo[k + 1], hi[k + 1], hi[k]);
}

function buildTower(b: Buf, T: Tower, F: Frame) {
  const st = TOWER_STYLES[T.style];
  const base = at(F, 0, 0, 0);
  let z0 = -10;
  for (let tier = 0; tier < 3; tier++) {
    const s = T.hs * st[tier * 2];
    const z1 = (tier === 0 ? Math.max(st[1] * T.h, TIER0_MIN) : st[tier * 2 + 1] * T.h) + 2;
    const seed = (T.seed * 0.618 + tier * 0.37) % 1;
    b.cur = [base[0], base[1], base[2], z1];
    walls(b, F, s, T.round, z0, z1, M_WALL + 10 * tier, T.pal, seed);
    top(b, F, s, T.round, z1, M_ROOF + 10 * tier, T.pal, seed);
    z0 = z1;
  }
  spire(b, F, T.hs * st[7], z0, st[6] * T.h, T.round, T.pal);
}

export const TOWER_VERT = /* glsl */ `
uniform vec3 center;
uniform float viewH;
attribute vec4 aData;
attribute vec4 aAxis;
attribute vec4 aM1;
attribute vec4 aM2;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vData;
varying float vTop;
void main() {
  vec3 p = position;
  vec3 n = normal;
  vData = aData;
  vec3 up = normalize((modelMatrix * vec4(aAxis.xyz, 1.0)).xyz - center);
  // pixels per stud at this vertex
  float pxU = projectionMatrix[1][1] * 0.5 * viewH / max(length((modelMatrix * vec4(p, 1.0)).xyz - cameraPosition), 1.0);
  if (abs(aData.y - ${M_SPIRE}.0) < 0.5) {
    // spires sink onto their base once thinner than a pixel or two (no sub-pixel sparkle)
    float a = dot(p - aAxis.xyz, up);
    p -= up * (a - aData.x) * (1.0 - smoothstep(0.8, 2.2, 2.0 * aData.w * pxU));
  } else if (dot(aM2.xyz, aM2.xyz) > 0.0) {
    vec3 r = p - aAxis.xyz;
    float wPx = 2.0 * length(r - up * dot(r, up)) * pxU;
    vec4 m = mix(aM1 * (1.0 - smoothstep(14.0, 22.0, wPx)), aM2, 1.0 - smoothstep(5.0, 8.0, wPx));
    p += m.xyz;
    vData.x += m.w;
    if (mod(aData.y + 0.5, 10.0) < 1.0) {
      // wall normals stay radial wherever the vertex slides
      r = p - aAxis.xyz;
      n = normalize(r - up * dot(r, up));
    }
  }
  // towers sink into the city as the view ray grazes the ground (whole towers, by their base), so the limb
  // stays a clean curve instead of a row of needles at any camera altitude
  float mu = dot(normalize((modelMatrix * vec4(aAxis.xyz, 1.0)).xyz - cameraPosition), up);
  float sq = smoothstep(0.04, 0.2, -mu);
  p -= up * dot(p - aAxis.xyz, up) * (1.0 - sq);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(modelMatrix) * n;
  vTop = aAxis.w * sq;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const TOWER_FRAG = /* glsl */ `
${UNIFORMS_GLSL}
${COMMON_GLSL}
${ATMO_GLSL}
${PALETTE_GLSL}
${CITY_GLSL}
${SHADE_GLSL}
${LIGHT_GLSL}
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vData;
varying float vTop;

vec3 towerWall(int p) { return p == 0 ? C_WHITE : (p == 1 ? C_LBG : (p == 2 ? C_TAN : C_DBG)); }
vec3 towerTrim(int p) { return p == 0 ? C_LBG : (p == 1 ? C_DBG : (p == 2 ? C_WHITE : C_LBG)); }
vec3 towerRoof(int p) { return p == 0 ? C_LBG : (p == 1 ? C_DBG : (p == 2 ? C_DTAN : C_BLACK)); }

void main() {
  vec3 ro = cameraPosition;
  vec3 P = vWorld;
  vec3 rd = normalize(P - ro);
  float a = length(P - center) - R;
  vec3 up = (P - center) / (R + a);
  vec2 g = toGrid(P);
  vec2 gdx = dFdx(g), gdy = dFdy(g);
  float u = vData.x;
  float fwU = abs(dFdx(u)) + abs(dFdy(u));
  float fwA = abs(dFdx(a)) + abs(dFdy(a));
  float fy = floor(vData.y + 0.5);
  int tier = int(fy / 10.0);
  int mat = int(fy) - 10 * tier;
  int pal = int(vData.z + 0.5);
  float seed = vData.w;
  vec3 n = normalize(vNormal);
  // where the view ray crosses the cloud deck (most towers stand below it)
  vec2 hC = sphereHit(ro, rd, R + H_CLOUD);
  vec3 PC = ro + rd * max(hC.x, 0.0);
  vec2 gC = toGrid(PC);
  vec2 cdx = dFdx(gC), cdy = dFdy(gC);
  vec4 cl = vec4(0.0);
  if (hC.x > 0.0 && hC.x < length(P - ro)) cl = cloudDeck(rd, PC, gC, cdx, cdy);
  // nothing of the tower shows through a solid deck
  if (cl.a > 0.998) {
    gl_FragColor = vec4(cl.rgb, 1.0);
    return;
  }

  // the painted city in front of the tower's base hides it: trace from here toward the camera
  if (a < H_TOP - 0.5) {
    vec3 rv = -rd;
    float tx = sphereHit(P, rv, R + H_TOP).y;
    vec3 A = altQuad(a, altOf(P + rv * (0.5 * tx)), H_TOP);
    Hit oc = castCity(g, toGrid(P + rv * tx), A, 16);
    if (oc.kind < 2) discard;
  }

  float muS = dot(up, sunDir);
  vec3 sunC = SUN_E * sunTrans(max(a, 0.0) + 40.0, muS);
  vec3 sky = skyAmb(muS);
  float on = lightsOn(muS);
  vec2 LgH = sunGrid(up, 1.0, muS);
  float fp = max(length(gdx), length(gdy));
  float ndl = max(dot(n, sunDir), 0.0);
  float lit = 0.0;
  if (ndl > 0.0) {
    lit = towerLit(g, a, LgH, gdx, gdy, 25.0) * (1.0 - cloudShadow(g, a, LgH, gdx, gdy, fp));
    if (a < H_TOP) {
      vec2 nG = vec2(dot(n, axisU(up)), dot(n, axisV(up)));
      lit *= 1.0 - cityShadow(g + nG * 0.8, a, LgH, fp, fwA);
    }
  }
  // down among the painted roofs the walls see less sky
  float ao = 0.4 + 0.6 * smoothstep(0.0, 170.0, a);
  vec3 amb = sky * ao;
  vec3 col, emis = vec3(0.0);
  float h1 = hf(vec2(seed * 97.0, float(tier) + 3.0));
  if (mat == ${M_WALL}) {
    // brick-built curtain walls: floor bands of glass between pilasters, one of three styles per tier
    const float FL = 10.0;
    float style = floor(h1 * 2.999);
    float band = pulseF(a / FL - 0.3, style == 1.0 ? 0.7 : 0.5, fwA / FL);
    float pil = pulseF(u / 12.0 - 0.1, style == 2.0 ? 0.35 : 0.18, fwU / 12.0);
    float glass = style == 2.0 ? (1.0 - pil) * 0.92 : band * (1.0 - pil);
    vec3 alb = towerWall(pal);
    vec3 diff = alb * (sunC * ndl * lit + amb * 0.5 + sunC * max(muS, 0.0) * 0.05);
    col = mix(diff, glassCol(rd, n, up, muS, sunC, lit), glass);
    // lit windows per floor and bay, fading to their mean while the cells are still a few pixels big
    float litP = mix(0.25, 0.8, hf(vec2(seed * 31.0, float(tier)))) * on;
    float rw = hf(vec2(floor(a / FL) + seed * 911.0, floor(u / 12.0) + float(tier) * 57.0));
    float lw = mix(litP, step(rw, litP), smoothstep(3.0, 6.0, FL / fwA) * smoothstep(3.0, 6.0, 12.0 / fwU));
    emis = glass * lw * (pal == 3 ? WIN_WARM : mix(WIN_COOL, WIN_WARM, step(0.5, h1))) * WIN_I * 1.1;
    // the plate ledge capping the tier, with a strip of light tiles along it (both box-filtered in
    // altitude, so a thin bright line never breaks up into crawling dashes)
    float lk = boxF(a - vTop + ${LEDGE_H / 2}.0, ${LEDGE_H / 2}.0, fwA);
    float sk = boxF(a - vTop + ${LEDGE_H / 2}.0, 1.0, fwA);
    vec3 trim = towerTrim(pal) * (sunC * ndl * lit + amb * 0.55 + sunC * max(muS, 0.0) * 0.05);
    col = mix(col, trim, lk);
    emis = emis * (1.0 - lk) + on * WIN_WARM * 2.2 * sk;
  } else if (mat == ${M_ROOF}) {
    col = towerRoof(pal) * (sunC * ndl * lit + sky);
  } else {
    col = C_LBG * (sunC * ndl * lit + sky * 0.6);
  }
  col = mix(haze(col + emis, P, rd), cl.rgb, cl.a);
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Merge the towers into chunk meshes (8×8 superblocks each, frustum-culled) placed on the sphere and
 * sharing the planet's uniforms. Positions are relative to each chunk's centre for float precision.
 * Each chunk's index buffer holds the full mesh followed by the coarse one; a chunk switches to the
 * coarse range once its nearest point is so far away that every round tier has fully morphed to 4
 * sides, where both are the same surface.
 */
export function makeTowers(towers: Tower[], R: number, uniforms: Record<string, IUniform>): { group: Group; material: ShaderMaterial; triangles: number } {
  const viewH = { value: 900 };
  const material = new ShaderMaterial({ uniforms: { ...uniforms, viewH }, vertexShader: TOWER_VERT, fragmentShader: TOWER_FRAG });
  const vp = new Vector4();
  const cam = new Vector3();
  const ctr = new Vector3();
  const group = new Group();
  group.name = 'coruscant-towers';
  const GU = [Math.cos(GRID_ANGLE), Math.sin(GRID_ANGLE)];
  const GV = [-Math.sin(GRID_ANGLE), Math.cos(GRID_ANGLE)];
  const CH = 8;
  const NC = Math.ceil(TOWER_N / CH);
  const chunks = new Map<number, Tower[]>();
  for (const T of towers) {
    const i = Math.min(NC - 1, Math.max(0, Math.floor((Math.floor(T.cx / SUPERW) + SB_OFF) / CH)));
    const j = Math.min(NC - 1, Math.max(0, Math.floor((Math.floor(T.cy / SUPERW) + SB_OFF) / CH)));
    const list = chunks.get(j * NC + i) ?? [];
    list.push(T);
    chunks.set(j * NC + i, list);
  }
  const upOf = (cx: number, cy: number) => {
    const x = (cx * GU[0] + cy * GV[0]) / R;
    const z = (cx * GU[1] + cy * GV[1]) / R;
    return [x, Math.sqrt(Math.max(0, 1 - x * x - z * z)), z];
  };
  const tangent = (up: number[], e: number[]) => {
    const d = e[0] * up[0] + e[1] * up[1] + e[2] * up[2];
    const t = [e[0] - up[0] * d, e[1] - up[1] * d, e[2] - up[2] * d];
    const l = Math.hypot(t[0], t[1], t[2]);
    return t.map((v) => v / l);
  };
  let triangles = 0;
  for (const list of chunks.values()) {
    let mx = 0;
    let my = 0;
    for (const T of list) {
      mx += T.cx / list.length;
      my += T.cy / list.length;
    }
    const o = upOf(mx, my).map((v) => v * R);
    const b = new Buf();
    for (const T of list) {
      const up = upOf(T.cx, T.cy);
      buildTower(b, T, { up, eu: tangent(up, [GU[0], 0, GU[1]]), ev: tangent(up, [GV[0], 0, GV[1]]), o, R });
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(b.nrm, 3));
    geo.setAttribute('aData', new Float32BufferAttribute(b.dat, 4));
    geo.setAttribute('aAxis', new Float32BufferAttribute(b.axis, 4));
    geo.setAttribute('aM1', new Float32BufferAttribute(b.m1, 4));
    geo.setAttribute('aM2', new Float32BufferAttribute(b.m2, 4));
    const nFull = b.idx.length;
    const nCoarse = b.idxC.length;
    geo.setIndex(new Uint32BufferAttribute(b.idx.concat(b.idxC), 1));
    geo.setDrawRange(0, nFull);
    // the geomorphs only ever pull vertices inward, so the static bounds stay valid
    geo.computeBoundingSphere();
    triangles += nFull / 3;
    let sMax = 0;
    for (const T of list) if (T.round) sMax = Math.max(sMax, T.hs * TOWER_STYLES[T.style][0]);
    const mesh = new Mesh(geo, material);
    mesh.position.set(o[0], o[1], o[2]);
    // after the fleet, before the ground cap (renderOrder 10) so early depth rejects the city behind
    mesh.renderOrder = 9;
    mesh.onBeforeRender = (renderer, _scene, camera) => {
      // the geomorph thresholds are in pixels: track the height of whatever this is rendered into
      renderer.getCurrentViewport(vp);
      if (vp.w > 0 && vp.w !== viewH.value) {
        viewH.value = vp.w;
        material.uniformsNeedUpdate = true;
      }
      const bs = geo.boundingSphere!;
      cam.setFromMatrixPosition(camera.matrixWorld);
      ctr.copy(bs.center).applyMatrix4(mesh.matrixWorld);
      const dMin = Math.max(ctr.distanceTo(cam) - bs.radius, 1);
      // widest round tier on screen, as the vertex shader measures it (fully 4-sided below 5 px)
      const wPx = (2 * sMax * camera.projectionMatrix.elements[5] * 0.5 * viewH.value) / dMin;
      if (wPx < 5) geo.setDrawRange(nFull, nCoarse);
      else geo.setDrawRange(0, nFull);
    };
    group.add(mesh);
  }
  return { group, material, triangles };
}
