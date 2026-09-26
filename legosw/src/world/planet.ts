import {
  AddEquation,
  BackSide,
  BufferGeometry,
  type Camera,
  CustomBlending,
  Float32BufferAttribute,
  Group,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three';
import { bakePlanet } from './planet-data';
import { ATMO_GLSL, ATMO_TOP, COMMON_GLSL, LOT, UNIFORMS_GLSL } from './planet-glsl';
import { CAP_VERT, NEAR_PX, SURFACE_FRAG, SURFACE_VERT } from './planet-surface';
import { makeTowers } from './planet-towers';

/** Largest angular radius (radians from the camera's nadir) the proxy cap may need: its horizon from afar. */
const CAP_MAX = 1.5;
/** The silhouette band: from this far inside the horizon to this far past it (radians). */
const SIL_IN = 0.06;
const SIL_OUT = 0.03;
/** Longitudes round the cap: chords at the horizon sag under the proxy's 8-stud lift for every camera over the fleet. */
const CAP_LON = 192;

/**
 * Grids for CAP_VERT, one per [zone, latitude steps]; triangles face away from the planet. The proxy is only
 * a carrier for per-pixel ray casts, and a CPU rasteriser shades every 2×2 quad a triangle edge crosses once
 * per triangle, so the steps are as coarse as the silhouette band's sag allows: thin screen-space slivers
 * would shade much of the ground twice.
 */
function capGrid(zones: [number, number][]): BufferGeometry {
  const p: number[] = [];
  const idx: number[] = [];
  for (const [zone, nLat] of zones) {
    const v0 = p.length / 3;
    for (let i = 0; i <= nLat; i++) for (let j = 0; j <= CAP_LON; j++) p.push(i / nLat, (j / CAP_LON) * Math.PI * 2, zone);
    for (let i = 0; i < nLat; i++) {
      for (let j = 0; j < CAP_LON; j++) {
        const a = v0 + i * (CAP_LON + 1) + j;
        const c = a + CAP_LON + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  return g;
}

const FIT_NX = 48;
const FIT_NY = 28;
const fitTh = new Float64Array(FIT_NX * FIT_NY);
const fitFp = new Float64Array(FIT_NX * FIT_NY);

/**
 * The near field's zones for this frame, as angular radii from the camera's nadir: out.x, inside which
 * every pixel's near-field weight is ~1 (the far field is not needed), and out.y, outside which it is 0.
 * The shader's footprint max(|dg/dx|, |dg/dy|) is evaluated exactly on a grid of screen samples (edges
 * and corners included), and each radius is pushed past the neighbours of every sample near its threshold,
 * so nothing between the samples can land on the wrong side. A footprint only changes slowly across a
 * sample spacing.
 */
function fitZones(R: number, C: Vector3, camera: Camera, vw: number, vh: number, out: Vector2): void {
  const P = camera.projectionMatrix.elements;
  const M = camera.matrixWorld.elements;
  const ox = M[12] - C.x;
  const oy = M[13] - C.y;
  const oz = M[14] - C.z;
  const oo = ox * ox + oy * oy + oz * oz;
  if (P[11] === 0 || oo <= R * R) {
    out.set(0, CAP_MAX);
    return;
  }
  const ol = Math.sqrt(oo);
  const cc = oo - R * R;
  const sx = Math.hypot(M[0], M[1], M[2]);
  const sy = Math.hypot(M[4], M[5], M[6]);
  const sz = Math.hypot(M[8], M[9], M[10]);
  // ground point of the ray through NDC (x, y): its grid position (u, v) and angle from the nadir, or false
  let u = 0;
  let v = 0;
  let th = 0;
  const hit = (x: number, y: number): boolean => {
    const cx = (x + P[8]) / P[0];
    const cy = (y + P[9]) / P[5];
    let dx = (M[0] / sx) * cx + (M[4] / sy) * cy - M[8] / sz;
    let dy = (M[1] / sx) * cx + (M[5] / sy) * cy - M[9] / sz;
    let dz = (M[2] / sx) * cx + (M[6] / sy) * cy - M[10] / sz;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl;
    dy /= dl;
    dz /= dl;
    const b = ox * dx + oy * dy + oz * dz;
    const disc = b * b - cc;
    if (b >= 0 || disc < 0) return false;
    const t = -b - Math.sqrt(disc);
    const nx = (ox + dx * t) / R;
    const ny = (oy + dy * t) / R;
    const nz = (oz + dz * t) / R;
    u = nx * R;
    v = nz * R;
    th = Math.acos(Math.min(1, (nx * ox + ny * oy + nz * oz) / ol));
    return true;
  };
  const px = 2 / vw;
  const py = 2 / vh;
  for (let j = 0; j < FIT_NY; j++) {
    for (let i = 0; i < FIT_NX; i++) {
      const k = j * FIT_NX + i;
      const x = -1 + (2 * i) / (FIT_NX - 1);
      const y = -1 + (2 * j) / (FIT_NY - 1);
      fitTh[k] = NaN;
      fitFp[k] = Infinity;
      if (!hit(x, y)) continue;
      const u0 = u;
      const v0 = v;
      fitTh[k] = th;
      if (!hit(x + px, y)) continue;
      const fx = Math.hypot(u - u0, v - v0);
      if (!hit(x, y + py)) continue;
      fitFp[k] = Math.max(fx, Math.hypot(u - u0, v - v0));
    }
  }
  // kDet = smoothstep(NEAR_PX / 2, NEAR_PX, LOT / footprint): > 0 below limOut, > 0.995 below LOT / 7.84
  const limOut = (LOT / (NEAR_PX / 2)) * 1.2;
  const limIn = (LOT / NEAR_PX) * 0.88;
  let outer = 0;
  let inner = Infinity;
  for (let j = 0; j < FIT_NY; j++) {
    for (let i = 0; i < FIT_NX; i++) {
      const k = j * FIT_NX + i;
      if (Number.isNaN(fitTh[k])) continue;
      const isOut = fitFp[k] < limOut;
      const isIn = fitFp[k] > limIn;
      if (!isOut && !isIn) continue;
      for (let b = Math.max(0, j - 1); b <= Math.min(FIT_NY - 1, j + 1); b++) {
        for (let a = Math.max(0, i - 1); a <= Math.min(FIT_NX - 1, i + 1); a++) {
          const t = fitTh[b * FIT_NX + a];
          if (Number.isNaN(t)) {
            // the near field reaches the horizon
            if (isOut) outer = Infinity;
            continue;
          }
          if (isOut) outer = Math.max(outer, t);
          if (isIn) inner = Math.min(inner, t);
        }
      }
    }
  }
  outer = Math.min(CAP_MAX, outer * 1.02 + 1e-4);
  out.set(Math.min(inner * 0.98, outer), outer);
}

/**
 * Coruscant from low orbit: a planet-wide LEGO city at dusk.
 *
 * - `surface`: a proxy cap just outside the planet sphere whose fragments trace the exact view ray
 *   through a painted city (lots with facades, roofs, streets, canyon shadows) near the camera and
 *   a filtered statistical average of the same city further out, with baked mega-tower and cloud
 *   shadows, air-traffic lanes, city lights that come on through the terminator, a parallax cloud
 *   deck and Chapman-function aerial perspective.
 * - `towers`: brick-built mega-towers as real geometry rising out of the painted city, lit, shadowed
 *   and hazed like the ground.
 * - `atmo`: a back-facing shell that paints the limb and sky glow with the same atmosphere model,
 *   so the horizon is seamless (no floating ring).
 *
 * Every detail scale is filtered by its pixel footprint, so nothing shimmers under camera motion.
 * Mega-tower shadows are baked for the construction-time sun; `setSun` only relights.
 */
export interface PlanetHandle {
  group: Group;
  /** the ground where the ray-cast city blends into the far field */
  surface: ShaderMaterial;
  /** the ground under the camera, all ray-cast city */
  surfaceNear: ShaderMaterial;
  /** the ground beyond the ray-cast city (far field only) */
  surfaceFar: ShaderMaterial;
  atmo: ShaderMaterial;
  towers: ShaderMaterial;
  setSun(dir: Vector3): void;
}

export function makeCoruscant(o: { radius: number; center: Vector3; sunDir: Vector3 }): PlanetHandle {
  const R = o.radius;
  const group = new Group();
  group.name = 'coruscant';
  group.position.copy(o.center);
  const sun = o.sunDir.clone().normalize();
  const data = bakePlanet(R, sun);
  const shared = {
    center: { value: o.center.clone() },
    R: { value: R },
    sunDir: { value: sun },
    districtTex: { value: data.district },
    paletteTex: { value: data.palette },
    farWall: { value: data.farWall },
    farRoof: { value: data.farRoof },
    shadeTex: { value: data.shade },
    cloudTex: { value: data.cloud },
  };

  // The ground is a proxy cap centred under the camera, in zones: a disc where the ray-cast near field covers
  // every pixel, a ring where it blends into the far field, and beyond that the far field alone (its last
  // band, round the horizon, finer so the cap's silhouette stays outside the planet's). Each field runs its own
  // build of the same shader (a CPU rasteriser pays for every branch on every pixel); at each common edge the
  // dropped field's weight is zero (to 0.5%), so the zones meet without a seam.
  const capTh = { value: new Vector4(0.1, 0.2, 0.3, 0.4) };
  const zone = (defines: Record<string, number>) =>
    new ShaderMaterial({ defines, uniforms: { ...shared, capTh }, vertexShader: CAP_VERT, fragmentShader: SURFACE_FRAG });
  const surfaceNear = zone({ NEAR_ONLY: 1 });
  const surface = zone({});
  const surfaceFar = zone({ FAR_ONLY: 1 });
  const vp = new Vector4();
  const th = new Vector2();
  const cam = new Vector3();
  const edges = new Vector4();
  const fitCap = (renderer: WebGLRenderer, camera: Camera) => {
    renderer.getCurrentViewport(vp);
    fitZones(R, o.center, camera, Math.max(vp.z, 1), Math.max(vp.w, 1), th);
    const d = cam.setFromMatrixPosition(camera.matrixWorld).distanceTo(o.center);
    const hor = d > R ? Math.acos(R / d) : CAP_MAX;
    const end = Math.min(CAP_MAX, hor + SIL_OUT);
    const far = Math.min(end, th.y);
    edges.set(Math.min(th.x, far), far, Math.min(end, Math.max(far, hor - SIL_IN)), end);
    if (!edges.equals(capTh.value)) {
      capTh.value.copy(edges);
      for (const m of [surfaceNear, surface, surfaceFar]) m.uniformsNeedUpdate = true;
    }
  };
  const meshes: [ShaderMaterial, [number, number][]][] = [
    [surfaceNear, [[0, 3]]],
    [surface, [[1, 4]]],
    [surfaceFar, [[2, 5], [3, 6]]],
  ];
  for (const [mat, zones] of meshes) {
    const m = new Mesh(capGrid(zones), mat);
    m.frustumCulled = false;
    // drawn after the ships and towers so early depth rejects the expensive city pixels they cover
    m.renderOrder = 10;
    m.onBeforeRender = (renderer, _scene, camera) => fitCap(renderer, camera);
    group.add(m);
  }
  const towers = makeTowers(data.towers, R, shared);
  group.add(towers.group);

  const atmo = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: BackSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: shared,
    vertexShader: SURFACE_VERT,
    fragmentShader: /* glsl */ `
      ${UNIFORMS_GLSL}
      ${COMMON_GLSL}
      ${ATMO_GLSL}
      varying vec3 vWorld;
      void main() {
        gl_FragColor = limb(cameraPosition, normalize(vWorld - cameraPosition));
      }`,
  });
  const shell = new Mesh(new SphereGeometry(R + ATMO_TOP, 160, 80), atmo);
  shell.frustumCulled = false;
  // before the other transparents: it composites over the backdrop, effects stay on top of it
  shell.renderOrder = -1;
  group.add(shell);

  return {
    group,
    surface,
    surfaceNear,
    surfaceFar,
    atmo,
    towers: towers.material,
    setSun(dir: Vector3) {
      sun.copy(dir).normalize();
    },
  };
}
