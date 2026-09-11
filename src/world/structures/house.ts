/**
 * Kokiri tree-trunk house (reference B, 14 s): a hollow living stump under a LOW, BROAD
 * mushroom-cap roof whose rolled eave overhangs the trunk by a third of its radius, with a dark
 * soffit that shades a deep porch cut into the front of the trunk. Two thick bark pillars
 * (bulges of the trunk wall) flank the porch; the actual doorway — a wide, low opening with a
 * wooden frame over a low threshold — nearly fills the porch's back wall and opens on a dimly
 * lit, hazed grey room (a hanging lamp, a candle on a low table). The cap is a mossy shell in
 * the roof material sitting on a rolled bark rim in the bark material (reference: a heavy
 * dark-brown eave under the moss). Buttress roots seat the trunk on the terrain, pale living limbs drape over
 * the cap (one broken stub leans off the left shoulder, one rises past the right), moss, leaf
 * clumps, tufts, ferns and heart-leaf vines shroud the cap, and glowing pod lanterns hang from
 * the soffit just left of the door.
 *
 * Every dimension is expressed in terms of `trunkRadius` / `roofHeight`, so the same builder
 * produces Saria's hero house and the small upper house.
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { HouseDef } from '../layout';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import {
  TAU,
  angleDiff,
  basisMatrix,
  ensureColor,
  faceTowards,
  gridSurface,
  merge,
  offsetAlongSD,
  rrectOutline,
  rrectSD,
  setColorAttribute,
  sweepTube,
  type SurfaceSample,
} from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternKind, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface HouseBuild {
  group: Group;
  /** terrain contact points (root tips) */
  bases: [number, number, number][];
  lanterns: LanternRig[];
  lights: PointLight[];
  roots: number;
  branches: number;
  leaves: number;
}

/** Local frame: F = out of the door, Rt = viewer's right when facing the door. */
class Frame {
  constructor(
    public C: Vector3,
    public F: Vector3,
    public Rt: Vector3,
  ) {}
  dir(a: number, out = new Vector3()): Vector3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return out.set(this.F.x * c + this.Rt.x * s, 0, this.F.z * c + this.Rt.z * s);
  }
  at(a: number, r: number, y: number, out = new Vector3()): Vector3 {
    this.dir(a, out).multiplyScalar(r).add(this.C);
    out.y += y;
    return out;
  }
  /** door-space: lateral w (right +), height y, depth d along F from the centre */
  door(w: number, y: number, d: number, out = new Vector3()): Vector3 {
    out.copy(this.C).addScaledVector(this.F, d).addScaledVector(this.Rt, w);
    out.y += y;
    return out;
  }
}

interface LanternSpec {
  /** angle around the house (0 = door, + = viewer's right) */
  a: number;
  /** cord length (metres, scaled by k) */
  cord: number;
  /** 'eave' hangs from the soffit under the roof lip, 'peg' from a short stub branch at height y */
  hook: 'eave' | 'peg';
  y?: number;
  /** glow colour (default orange) */
  tint?: LanternKind;
}

// Reference B: three pods in a loose row under the eave just left of / over the door (frame
// x 0.736 / 0.763 / 0.794, y 0.29–0.32, i.e. hanging right below the soffit); lime / orange /
// lime from left to right, the orange one lowest.
const LANTERNS: Record<string, LanternSpec[]> = {
  saria: [
    { a: -0.32, cord: 0.1, hook: 'eave', tint: 'lime' },
    { a: -0.14, cord: 0.3, hook: 'eave', tint: 'orange' },
    { a: 0.06, cord: 0.18, hook: 'eave', tint: 'lime' },
  ],
  // the upper house's pods hang on its plateau-side flanks: with Saria's cap lowered its front
  // shows above her roof in B, where the reference has only dark canopy (no lit pods there)
  upper: [
    { a: -1.9, cord: 0.3, hook: 'eave' },
    { a: 2.0, cord: 0.4, hook: 'eave' },
  ],
};

// Clamps the fog sample position to the doorway plane along the view ray, so the haze that fills
// the world does not also fill the room: seen from outside, an interior behind the door picks up
// only the airlight between the camera and the door, exactly like the wall around it. Inside the
// house (camera behind the plane) nothing changes.
const INDOOR_FOG_GLSL = /* glsl */ `
#ifdef USE_FOG
{
	vec3 kfD = vFogWorldPos - cameraPosition;
	float kfL = max( length( kfD ), 1e-4 );
	vec3 kfDir = kfD / kfL;
	float kfDen = dot( kfDir, uDoorNormal );
	float kfNum = dot( uDoorPoint - cameraPosition, uDoorNormal );
	if ( kfDen < -1e-4 && kfNum < 0.0 ) {
		vFogWorldPos = cameraPosition + kfDir * min( kfL, kfNum / kfDen );
	}
}
#endif
`;

function indoorFog<M extends MeshStandardMaterial | MeshBasicMaterial>(base: M, doorPoint: Vector3, outward: Vector3): M {
  const m = base.clone() as M;
  const uDoorPoint = { value: doorPoint.clone() };
  const uDoorNormal = { value: outward.clone().normalize() };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDoorPoint = uDoorPoint;
    shader.uniforms.uDoorNormal = uDoorNormal;
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nuniform vec3 uDoorPoint;\nuniform vec3 uDoorNormal;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>\n${INDOOR_FOG_GLSL}`);
  };
  m.customProgramCacheKey = () => 'structures:indoor-fog';
  return m;
}

/**
 * The room seen through the doorway. Reference B: the opening is NOT black — a hazed grey-brown
 * interior (lum ≈ 0.31, sat ≈ 0.1) with one soft warm glint. A mid grey-brown albedo under the
 * hemisphere fill plus a faint constant emissive keeps the walls readable without any saturated
 * glow; the bark maps give it some grain. Double-sided so the flat room planes need no winding.
 */
function roomMaterial(mats: StructureMaterials): MeshStandardMaterial {
  // no colour map: the warm bark albedo would pull the room back toward orange. Vertex colours
  // shade the room (lit far wall high up, dark floor) so it does not read as a flat panel.
  return new MeshStandardMaterial({
    normalMap: mats.interior.normalMap,
    normalScale: new Vector2(0.3, 0.3),
    roughness: 1,
    // slightly cool: the fill, lamp and airlight are all warm already, and the reference's
    // interior pixels are a neutral-to-cool grey ((72, 78, 76), (92, 93, 88)) against the warm
    // bark around them (a warm albedo under the same light measured saturation 0.2)
    color: new Color(0x7a8798),
    emissive: new Color(0x000000),
    vertexColors: true,
    side: DoubleSide,
  });
}

export function buildHouse(def: HouseDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng): HouseBuild {
  const group = new Group();
  group.name = `house-${def.id}`;
  const noise = new Noise2D(`${ctx.config.seed}/structures/house/${def.id}`);
  const terrain = ctx.terrain;
  const R = def.trunkRadius;
  const k = R / 3.2; // detail scale relative to the hero house
  const sk = Math.sqrt(k);

  // ---- proportions (reference B at the fixed camera: lip underside at frame y ≈ 0.285 →
  // ≈ 3.1 m above the terrace, lip top ≈ 3.6 m, crown ≈ 6–6.5 m, cap ≈ 9 m wide) ----
  /** underside of the eave lip at its outer edge (reference B: frame y ≈ 0.30 → ≈ 3.0 m) */
  const eaveY = def.roofHeight * 0.46;
  /** rolled lip half-thickness */
  const lipR = 0.26 * k;
  const lipTop = eaveY + 2 * lipR;
  /** cap crown of the bare shell (moss lumps and leaf clumps add ~0.6 m on top) */
  const crownY = def.roofHeight * 0.83;
  /** outer radius of the lip: heavier overhang at the front (over the porch) than at the back */
  const capR = (a: number) => R * (1.3 + 0.13 * Math.cos(a));
  /** trunk wall top, hidden under the cap */
  const wallTop = eaveY + 0.3 * k;
  // porch: a wide recess cut into the front of the trunk under the eave, sitting a little right of
  // the axis like the reference's (its pillars at frame x ≈ 0.70 / 0.85 in B). The back wall
  // stays well forward because the plateau slope rises steeply inside the trunk on the right
  // (terrain +0.3 m at 1.2 m right of the axis, 2.2 m in; +0.8 m at 1.8 m in).
  const porchW0 = -0.5 * R;
  const porchW1 = 0.4 * R;
  const porchTop = eaveY - 0.2 * k;
  const porchRc = 0.22 * R;
  /** porch back wall depth from the centre */
  const dBack = 0.75 * R;
  /** pillar bulges of the wall at the porch edges: amplitude / gaussian width */
  const pillarA = 0.9 * k;
  const pillarS = 0.36 * k;
  // inner doorway in the porch back wall: it nearly fills the recess between the pillars (in the
  // reference the cavity runs from the soffit to the ground with no wall band showing; the dark
  // region ≈ 1.9 m wide at frame x 0.755–0.845 is its interior, the pillars' shaded inner faces
  // read only a little darker), over a low threshold rather than a stair
  const doorW0 = -0.3 * R;
  const doorW1 = 0.34 * R;
  const sill = 0.12 * k;
  const doorH = 2.28 * sk;
  const doorTop = sill + doorH;
  const doorRc = 0.42 * sk;
  const wallT = 0.32 * k;
  // room behind the doorway: deeper on the left where the ground inside the trunk stays low
  const roomW0 = doorW0 - 0.8 * k;
  const roomW1 = doorW1;
  const roomFloorY = sill + 0.15 * k;
  const roomCeilY = doorTop + 0.5 * k;
  const roomFront = dBack - wallT;
  // the back wall is the hollow's concave inside, swinging away from the doorway in the middle
  const roomBackD = (w: number) => {
    const t = clamp((w - roomW0) / (roomW1 - roomW0), 0, 1);
    return lerp(0.3 * R, 0.62 * R, t) - 0.3 * k * Math.sin(Math.PI * t);
  };

  const F = new Vector3(def.facing[0], 0, def.facing[1]).normalize();
  const Rt = new Vector3(F.z, 0, -F.x);
  const cx = def.position[0];
  const cz = def.position[2];
  // floor level = ground in front of the door (the terrain pad is flat-ish here)
  const yFloor = terrain.height(cx + F.x * (R * 1.15), cz + F.z * (R * 1.15));
  const frame = new Frame(new Vector3(cx, yFloor, cz), F, Rt);

  // ground ring under the trunk: sink the base below the lowest point so nothing floats
  let ringMin = Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const p = frame.at(a, R * 1.35, 0);
    ringMin = Math.min(ringMin, terrain.height(p.x, p.z) - yFloor);
  }
  const yBase = ringMin - 0.45;

  // ---- openings (door-space lateral metres × local height) ----
  const porchSD = (w: number, y: number) => rrectSD(w, y, porchW0, porchW1, yBase - 2, porchTop, porchRc);
  const doorSD = (w: number, y: number) => rrectSD(w, y, doorW0, doorW1, sill - 1.5, doorTop, doorRc);
  // small round window on the shaded left-back flank (the reference front shows none)
  const winA = -1.75;
  const winY = 2.2 * sk;
  const winR = 0.28 * sk;

  // ---- trunk radius model ----
  const rSmooth = (a: number, y: number) => {
    const flare = 0.42 * Math.exp(-(y + 0.2) / 1.15);
    const bulge = 0.04 * smoothstep(0.5 * wallTop, wallTop, y);
    const oval = 1 + 0.045 * noise.fbm(Math.cos(a) * 1.3 + 10, Math.sin(a) * 1.3, 2) + 0.025 * noise.noise(a * 0.5, y * 0.15);
    return R * (1 + flare + bulge) * oval;
  };
  /** true door-space lateral coordinate of a wall point (chord, not arc) */
  const wOf = (a: number, r: number) => {
    const d = angleDiff(a, 0);
    return Math.abs(d) < Math.PI / 2 ? r * Math.sin(d) : Math.sign(d) * (r + 10);
  };
  /** the two pillars flanking the porch: bulges of the wall pushed out along F */
  const pillarBulge = (w: number, y: number) => {
    const g0 = Math.exp(-(((w - porchW0) / pillarS) ** 2));
    const g1 = Math.exp(-(((w - porchW1) / pillarS) ** 2));
    return pillarA * (g0 + g1) * (1 + 0.18 * Math.exp(-(y + 0.2) / 1.2));
  };
  // rope-like vertical bark cords: dense ridged noise that twists slowly with height, deep
  // furrows between cord bundles, broad lumps and fine grain
  const cords = (a: number, y: number) => {
    const arc = a * R;
    return noise.ridged(arc * 1.9 + noise.noise(y * 0.15, arc * 0.1) * 1.6 + y * 0.12, y * 0.14, 3) - 0.5;
  };
  const detail = (a: number, y: number) => {
    const arc = a * R;
    const furrow = Math.pow(Math.max(0, noise.noise(arc * 0.7 + 21, y * 0.12)), 2);
    const lumps = noise.fbm(arc * 0.35, y * 0.4, 3);
    const fine = noise.noise(arc * 3.5, y * 3.5);
    return cords(a, y) * 0.36 * k - furrow * 0.16 * k + lumps * 0.12 * k + fine * 0.015;
  };
  const winW = (a: number, r: number) => angleDiff(a, winA) * r;

  // ---- outer shell ----
  const cols = Math.round(240 * sk);
  const rows = Math.round(72 * sk);
  const outer = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const y = lerp(yBase, wallTop, v);
      const rs = rSmooth(a, y);
      const w = wOf(a, rs);
      const psd = porchSD(w, y);
      const wsd = Math.hypot(winW(a, rs), y - winY) - winR;
      const fade = smoothstep(0.02, 0.3, Math.min(psd, wsd));
      const r = rs + detail(a, y) * fade;
      frame.at(a, r, y, out.position);
      out.position.addScaledVector(F, pillarBulge(w, y));
      out.uv = [(a * R) / 2.2, y / 2.2];
      // bark tint: darker + mossy toward the base, subtle warm variation; cord crests carry a
      // warm highlight and furrows a dark occlusion tint so the cords still read in shade
      const base = smoothstep(1.4, -0.3, y);
      const mossy = smoothstep(0.3, 0.8, noise.fbm(a * R * 0.5, y * 0.5, 2)) * smoothstep(2.6, 0.2, y);
      const vari = 0.9 + 0.2 * noise.noise(a * R * 0.8 + 5, y * 0.8);
      const crest = clamp(cords(a, y) * 2.2, -1, 1) * fade;
      const ao = 1 + 0.55 * crest;
      // the wall band under the soffit sits in the eave's shadow; the pillars' flanks (where the
      // bulge falls off) carry an occlusion tint so they read as columns standing off the wall
      const eaveShade = 1 - 0.3 * smoothstep(porchTop - 0.6, wallTop, y);
      const slope = Math.abs(pillarBulge(w + 0.05, y) - pillarBulge(w - 0.05, y)) / (0.1 * pillarA);
      const flankAO = 1 - 0.32 * clamp(slope * 0.9, 0, 1);
      // reference B: the wall right of the porch is deep in the eave's shadow (lum 0.20–0.25 down
      // to the ground) while the trunk's left flank catches the low sun (0.40–0.47)
      const front = smoothstep(-0.3, 0.2, Math.cos(a));
      const litPillar = front * smoothstep(porchW0 + 0.1, porchW0 - 0.5, w) * smoothstep(porchW0 - 1.8, porchW0 - 1.0, w) * smoothstep(wallTop, porchTop - 1.0, y);
      const sideShade = lerp(1, 0.76, front * smoothstep(porchW1 - 0.2, porchW1 + 0.7, w) * smoothstep(wallTop + 0.5, porchTop - 1.5, y)) * lerp(1, 1.4, litPillar);
      const shade = eaveShade * flankAO * sideShade;
      // slightly cooler than the material's warm tint: the reference bark is grey-brown, not orange
      const rr = lerp(0.96 * vari, 0.6, base * 0.7) * ao * (1 + 0.08 * Math.max(0, crest)) * shade;
      const gg = lerp(0.97 * vari, 0.62, base * 0.6) * ao * shade;
      const bb = lerp(1.0 * vari, 0.64, base * 0.6) * ao * (1 - 0.1 * Math.max(0, crest)) * shade;
      out.color = [lerp(rr, 0.55, mossy * 0.6), lerp(gg, 0.72, mossy * 0.6), lerp(bb, 0.4, mossy * 0.6)];
    },
    {
      cols,
      rows,
      closedU: true,
      // u runs clockwise (viewer's right) and v upward → dv × du points inward; flip to face out
      flip: true,
      hole: (u, v) => {
        const a = u * TAU;
        const y = lerp(yBase, wallTop, v);
        const rs = rSmooth(a, y);
        return porchSD(wOf(a, rs), y) < 0 || Math.hypot(winW(a, rs), y - winY) < winR;
      },
    },
  );
  const trunk = new Mesh(outer, mats.bark);
  trunk.name = 'trunk';
  trunk.castShadow = trunk.receiveShadow = true;
  group.add(trunk);

  // ---- porch: tunnel (side walls + ceiling), back wall with the doorway, floor ----
  /** depth of the outer wall surface at lateral w */
  const dOut = (w: number, y: number) => {
    const rs = rSmooth(Math.atan2(w, rSmooth(0, y)), y);
    return Math.sqrt(Math.max(0.01, rs * rs - w * w)) + pillarBulge(w, y);
  };
  const porchParts = [];
  {
    const outline = rrectOutline(porchW0, porchW1, yBase - 0.2, porchTop, porchRc);
    // the mouth flares 8 cm outside the cut and sits 10 cm proud of the shell, so the jagged
    // cell edge of the hole is hidden behind it; at the back it meets the back wall exactly
    const tunnel = gridSurface(
      (s, q, out) => {
        const [w0, y0] = outline.at(s);
        const [w, y] = offsetAlongSD(porchSD, w0, y0, lerp(0.08, 0, q));
        const d = lerp(dOut(w, y) + 0.1, dBack - 0.02, q);
        frame.door(w, y, d, out.position);
        out.uv = [(s * outline.length) / 2.2, d / 2.2];
        const dark = lerp(0.6, 0.3, Math.pow(q, 0.7));
        out.color = [dark, dark * 0.92, dark * 0.86];
      },
      { cols: 72, rows: 5 },
    );
    faceTowards(tunnel, (p, o) => frame.door((porchW0 + porchW1) / 2, Math.min(p.y - yFloor, porchTop - porchRc - 0.3), (dBack + R) / 2, o));
    porchParts.push(tunnel);
    // back wall (the doorway is cut out of it)
    const bw0 = porchW0 - 0.3;
    const bw1 = porchW1 + 0.3;
    const by0 = yBase - 0.2;
    const by1 = porchTop + 0.35;
    const back = gridSurface(
      (u, v, out) => {
        const w = lerp(bw0, bw1, u);
        const y = lerp(by0, by1, v);
        frame.door(w, y, dBack, out.position);
        out.uv = [w / 2.2, y / 2.2];
        // the recess is a dark cavity in the reference (lum 0.21–0.27 above the doorway)
        const shade = 0.3 + 0.08 * noise.noise(w * 1.3 + 4, y * 1.3) - 0.08 * smoothstep(doorTop - 0.3, porchTop, y);
        out.color = [shade, shade * 0.92, shade * 0.86];
      },
      {
        cols: 44,
        rows: 40,
        hole: (u, v) => doorSD(lerp(bw0, bw1, u), lerp(by0, by1, v)) < 0,
      },
    );
    faceTowards(back, (p, o) => o.copy(p).addScaledVector(F, 1));
    porchParts.push(back);
    // floor: packed earth rising gently to the sill; never below the terrain inside the trunk
    const floor = gridSurface(
      (u, v, out) => {
        const w = lerp(porchW0 - 0.35, porchW1 + 0.35, u);
        const d = lerp(dBack - 0.15, dOut(w, 0) + 0.45, v);
        const ramp = lerp(sill - 0.02, 0.03, smoothstep(dBack + 0.1, dBack + 1.25 * k, d));
        frame.door(w, ramp, d, out.position);
        const th = terrain.height(out.position.x, out.position.z) + 0.05;
        if (th > out.position.y) out.position.y = th;
        out.uv = [w / 1.6, d / 1.6];
        // packed earth in the eave's shade: a grey-brown (reference threshold band lum ≈ 0.30,
        // saturation ≈ 0.1), so the warm bark map is pulled toward neutral
        const shade = 0.58 + 0.08 * noise.noise(w * 2.1, d * 2.1 + 3);
        out.color = [shade, shade * 0.98, shade * 0.95];
      },
      { cols: 18, rows: 14 },
    );
    faceTowards(floor, (p, o) => o.set(p.x, p.y + 5, p.z));
    porchParts.push(floor);
    // doorway cut through the back wall: dark bark edges frame the lighter room behind. The
    // mouth flares outside the cut at the front and ends slightly inside it past the room's
    // front plane, hiding the jagged cell edges of both holes.
    const doorOutline = rrectOutline(doorW0, doorW1, sill - 0.4, doorTop, doorRc);
    const doorTunnel = gridSurface(
      (s, q, out) => {
        const [w0, y0] = doorOutline.at(s);
        const [w, y] = offsetAlongSD(doorSD, w0, y0, lerp(0.1, -0.06, q));
        const d = lerp(dBack + 0.04, roomFront - 0.06, q);
        frame.door(w, y, d, out.position);
        out.uv = [(s * doorOutline.length) / 2.2, d / 2.2];
        const dark = lerp(0.34, 0.2, q);
        out.color = [dark, dark * 0.92, dark * 0.86];
      },
      { cols: 40, rows: 3 },
    );
    faceTowards(doorTunnel, (p, o) => frame.door((doorW0 + doorW1) / 2, Math.min(p.y - yFloor, doorTop - doorRc - 0.2), (dBack + roomFront) / 2, o));
    porchParts.push(doorTunnel);
  }
  const porchMesh = new Mesh(merge(porchParts), mats.bark);
  porchMesh.name = 'porch';
  porchMesh.castShadow = porchMesh.receiveShadow = true;
  group.add(porchMesh);

  // ---- doorway through the back wall + room behind it ----
  const doorPlanePoint = frame.door((doorW0 + doorW1) / 2, doorTop * 0.5, dBack);
  const roomMat = indoorFog(roomMaterial(mats), doorPlanePoint, F);
  const roomParts = [];
  {
    // room shading: the reference's opening is an almost even hazed grey (luminance 0.26–0.36
    // across the whole doorway, its lower middle the lightest, only the lamp glint brighter), so
    // the walls are nearly uniform — a touch darker toward the ceiling and with depth
    const roomWc = (roomW0 + roomW1) / 2;
    const roomHw = (roomW1 - roomW0) / 2;
    const wallShade = (w: number, y: number, depth: number): [number, number, number] => {
      // soft vignette toward the side walls so the opening reads as a cavity, not a flat panel
      const lat = 1 - 0.3 * smoothstep(0.45, 1, Math.abs(w - roomWc) / roomHw);
      // Reference B: the doorway is darkest under its lintel (0.27–0.30) and lightest low down
      // (0.34–0.36). The lamp lights the upper wall, so the vertex colours run the other way —
      // nearly black under the ceiling, full albedo near the floor — and the two gradients
      // leave a soft top-dark / bottom-light cavity. (Measured with a uniform tint: 0.3 → 0.31
      // display, 1.0 → 0.43, 3.0 → 0.64 in the full pipeline, airlight included.)
      const s = lerp(0.72, 0.06, Math.pow(smoothstep(roomFloorY, roomCeilY, y), 0.8)) * lerp(1, 0.8, depth) * lat;
      return [s, s * 0.99, s * 0.98];
    };
    // room's front plane (inside face of the back wall) around the doorway
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0 - 0.05, roomW1 + 0.05, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          frame.door(w, y, roomFront + 0.01, out.position);
          out.uv = [w / 2.2, y / 2.2];
          out.color = wallShade(w, y, 0.3);
        },
        {
          cols: 30,
          rows: 24,
          hole: (u, v) => doorSD(lerp(roomW0 - 0.05, roomW1 + 0.05, u), lerp(roomFloorY - 0.06, roomCeilY + 0.06, v)) < 0,
        },
      ),
    );
    // back wall (diagonal: deep on the left, shallow on the right), side walls, floor, ceiling
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0, roomW1, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          frame.door(w, y, roomBackD(w), out.position);
          out.uv = [w / 2.2, y / 2.2];
          out.color = wallShade(w, y, 1 - u);
        },
        { cols: 12, rows: 6 },
      ),
    );
    for (const w of [roomW0, roomW1]) {
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, u);
            const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
            frame.door(w, y, d, out.position);
            out.uv = [d / 2.2, y / 2.2];
            out.color = wallShade(w, y, 0.5 * (1 - u));
          },
          { cols: 6, rows: 6 },
        ),
      );
    }
    for (const y of [roomFloorY, roomCeilY]) {
      roomParts.push(
        gridSurface(
          (u, v, out) => {
            const w = lerp(roomW0 - 0.02, roomW1 + 0.02, u);
            const d = lerp(roomBackD(w) - 0.02, roomFront + 0.06, v);
            frame.door(w, y, d, out.position);
            let s = y === roomFloorY ? 0.78 : 0.06;
            if (y === roomFloorY) {
              const th = terrain.height(out.position.x, out.position.z) + 0.05;
              if (th > out.position.y) {
                // where the plateau slope rises through the floor (right rear) it stays in shadow
                s *= lerp(1, 0.35, clamp((th - out.position.y) / 0.25, 0, 1));
                out.position.y = th;
              }
            }
            out.uv = [w / 2.2, d / 2.2];
            out.color = [s, s * 0.99, s * 0.97];
          },
          { cols: 12, rows: 8 },
        ),
      );
    }
  }
  const roomMesh = new Mesh(merge(roomParts), roomMat);
  roomMesh.name = 'interior';
  roomMesh.receiveShadow = true;
  group.add(roomMesh);

  // ---- door frame: sill beam, posts, lintel hugging the opening ----
  const woodParts = [];
  {
    const sillBeam = new BoxGeometry(doorW1 - doorW0 + 0.5 * k, 0.12 * k, 0.6 * k);
    sillBeam.applyMatrix4(basisMatrix(frame.door((doorW0 + doorW1) / 2, sill - 0.03, dBack + 0.02), F));
    setColorAttribute(sillBeam, [0.68, 0.64, 0.57]);
    woodParts.push(sillBeam);
    const frameR = 0.085 * sk;
    for (const side of [-1, 1]) {
      const w = (side < 0 ? doorW0 : doorW1) + side * frameR * 0.8;
      const pts = [frame.door(w, sill - 0.1, dBack + 0.02), frame.door(w, lerp(sill, doorTop - doorRc, 0.5), dBack + 0.04), frame.door(w, doorTop - doorRc + 0.05, dBack + 0.04)];
      const post = sweepTube(new CatmullRomCurve3(pts), { radius: (t) => frameR * (1 - 0.12 * t), tubularSegments: 6, radialSegments: 9, uvMetres: 0.6 });
      setColorAttribute(post, [0.4, 0.33, 0.25]);
      woodParts.push(post);
    }
    const outline = rrectOutline(doorW0 - frameR * 0.8, doorW1 + frameR * 0.8, sill, doorTop + frameR * 0.7, doorRc + frameR * 0.6);
    const s0 = (doorTop - doorRc - sill) / outline.length;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const [w, y] = outline.at(lerp(s0 - 0.02, 1 - s0 + 0.02, i / 16));
      pts.push(frame.door(w, y, dBack + 0.04));
    }
    const lintel = sweepTube(new CatmullRomCurve3(pts), { radius: (t) => frameR * (0.95 + 0.2 * Math.sin(t * Math.PI)), tubularSegments: 28, radialSegments: 9, uvMetres: 0.6 });
    setColorAttribute(lintel, [0.38, 0.31, 0.24]);
    woodParts.push(lintel);
  }
  const woodMesh = new Mesh(merge(woodParts), mats.wood);
  woodMesh.name = 'door-frame';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // ---- one small lamp hanging inside the room, left of centre (reference glints at frame
  // (0.78, 0.44) ≈ 1.3 m up and a fainter one at (0.775, 0.49) ≈ 0.7 m up: a candle on a low
  // table) ----
  const lampW = doorW0 + 0.85 * k;
  const lampY = 0.6 * doorTop;
  const lampPos = frame.door(lampW, lampY, roomFront - 0.5 * k);
  {
    const lamp = new SphereGeometry(0.04 * sk, 12, 8);
    lamp.scale(1, 1.35, 1);
    lamp.translate(lampPos.x, lampPos.y, lampPos.z);
    const candlePos = frame.door(doorW0 + 0.7 * k, sill + 0.55 * k, roomFront - 0.85 * k);
    const candle = new SphereGeometry(0.028 * sk, 10, 7);
    candle.translate(candlePos.x, candlePos.y, candlePos.z);
    const lampMesh = new Mesh(merge([lamp, candle]), mats.hearth);
    lampMesh.name = 'door-lamp';
    group.add(lampMesh);
    const cord = new CylinderGeometry(0.012, 0.012, roomCeilY - lampY, 6);
    cord.translate(lampPos.x, lampPos.y + (roomCeilY - lampY) / 2, lampPos.z);
    setColorAttribute(cord, [0.2, 0.15, 0.1]);
    // low table under the candle: a slab on a block, dark silhouettes that give the room depth
    const slab = new BoxGeometry(0.7 * k, 0.05 * k, 0.45 * k);
    slab.applyMatrix4(basisMatrix(frame.door(doorW0 + 0.7 * k, sill + 0.5 * k, roomFront - 0.85 * k), F));
    setColorAttribute(slab, [0.3, 0.26, 0.2]);
    const block = new BoxGeometry(0.22 * k, 0.5 * k, 0.22 * k);
    block.applyMatrix4(basisMatrix(frame.door(doorW0 + 0.7 * k, sill + 0.25 * k, roomFront - 0.85 * k), F));
    setColorAttribute(block, [0.22, 0.19, 0.15]);
    const furnitureMesh = new Mesh(merge([cord, slab, block]), mats.woodDark);
    furnitureMesh.name = 'door-lamp-cord';
    group.add(furnitureMesh);
  }
  const lights: PointLight[] = [];
  // soft and pale: it should warm the room a little, not paint it orange (the reference glint
  // lifts the wall around it by only ≈ 0.05 luminance)
  const doorLight = new PointLight(0xffd6a8, 0.15 * k, 2.6 * k, 2);
  doorLight.position.copy(lampPos).addScaledVector(F, -0.1);
  doorLight.name = 'door-light';
  group.add(doorLight);
  lights.push(doorLight);

  // ---- round window: socket + glow + wooden ring ----
  {
    const O = frame.dir(winA);
    const surf = frame.at(winA, rSmooth(winA, winY) + 0.02, winY);
    const socket = new CylinderGeometry(winR, winR, wallT + 0.1, 24, 1, true);
    socket.rotateX(Math.PI / 2);
    socket.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -(wallT + 0.1) / 2 + 0.02), O));
    const socketMesh = new Mesh(socket, mats.interior);
    socketMesh.name = 'window-socket';
    group.add(socketMesh);
    const glass = new CircleGeometry(winR, 24);
    glass.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -wallT + 0.04), O));
    const glassMesh = new Mesh(glass, mats.windowGlow);
    glassMesh.name = 'window-glow';
    group.add(glassMesh);
    const ring = new TorusGeometry(winR + 0.03, 0.065, 8, 28);
    ring.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, 0.02), O));
    const ringMesh = new Mesh(ring, mats.woodDark);
    ringMesh.name = 'window-frame';
    ringMesh.castShadow = ringMesh.receiveShadow = true;
    group.add(ringMesh);
  }

  // ---- buttress roots seated on the terrain ----
  const bases: [number, number, number][] = [];
  const rootParts = [];
  const rootCount = def.id === 'saria' ? 6 : 5;
  const rootRng = rng.fork('roots');
  for (let i = 0; i < rootCount; i++) {
    const a = 0.8 + (i / (rootCount - 1)) * (TAU - 1.6) + (rootRng() - 0.5) * 0.25;
    const y0 = 0.55 + rootRng() * 0.7;
    const r0 = (0.3 + rootRng() * 0.14) * k;
    const reach = R * (0.55 + rootRng() * 0.4);
    const rs0 = rSmooth(a, 0);
    const dir = frame.dir(a);
    const side = new Vector3(dir.z, 0, -dir.x).multiplyScalar((rootRng() - 0.5) * 0.7);
    const p0 = frame.at(a, rSmooth(a, y0) - 0.4, y0);
    const p1 = frame.at(a, rSmooth(a, y0 * 0.65) + 0.1, y0 * 0.66);
    const p2 = frame.at(a, rs0 + reach * 0.45, 0).addScaledVector(side, 0.5);
    p2.y = terrain.height(p2.x, p2.z) + 0.28 * k;
    const p3 = frame.at(a, rs0 + reach, 0).add(side);
    p3.y = terrain.height(p3.x, p3.z);
    const p4 = frame.at(a, rs0 + reach + 0.6, 0).addScaledVector(side, 1.3);
    p4.y = terrain.height(p4.x, p4.z) - 0.4;
    const curve = new CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'catmullrom', 0.5);
    const rootN = 4.5 + rootRng() * 3;
    const root = sweepTube(curve, {
      radius: (t) => r0 * (1 - 0.72 * t) * (0.9 + 0.2 * Math.abs(Math.sin(t * rootN))),
      tubularSegments: 22,
      radialSegments: 11,
      uvMetres: 1.4,
      displace: (t, ang) => (noise.ridged(ang * 1.2 + i * 3.1, t * 6, 2) - 0.5) * 0.05 * k * (1 - 0.5 * t),
      color: (t) => {
        const d = lerp(0.72, 0.58, t);
        return [d, d * 0.95, d * 0.85];
      },
      capEnd: true,
    });
    rootParts.push(root);
    bases.push([p3.x, p3.y, p3.z]);
  }
  const rootsMesh = new Mesh(merge(rootParts), mats.bark);
  rootsMesh.name = 'roots';
  rootsMesh.castShadow = rootsMesh.receiveShadow = true;
  group.add(rootsMesh);

  // ---- roof: low broad mushroom cap with a rolled lip and a dark soffit ----
  // v ∈ [0, V_CAP] is the cap top (q = v / V_CAP is the normalised radius: flat crown, rounded
  // shoulder — (1 − q³)^1.5), (V_CAP, 1] rolls round the lip from its top to its underside.
  const V_CAP = 0.72;
  const capHeight = crownY - lipTop;
  const domeBase = (a: number, v: number, out = new Vector3()) => {
    const rc = capR(a) - lipR;
    let r: number;
    let y: number;
    if (v <= V_CAP) {
      const q = v / V_CAP;
      const prof = Math.pow(Math.max(0, 1 - q * q * q), 1.5);
      r = rc * q;
      y = lipTop + capHeight * prof;
      frame.dir(a, out).multiplyScalar(r).add(frame.C);
      out.y += y;
      // the crown leans a little toward the back; the cap sags unevenly (back-left heavier)
      out.addScaledVector(F, -0.35 * k * prof);
      out.y -= (0.1 + 0.12 * Math.sin(a + 2.2)) * smoothstep(0.25, 1, q) * k;
    } else {
      const phi = ((v - V_CAP) / (1 - V_CAP)) * Math.PI;
      r = rc + lipR * Math.sin(phi);
      y = eaveY + lipR * (1 + Math.cos(phi));
      frame.dir(a, out).multiplyScalar(r).add(frame.C);
      out.y += y;
      out.y -= (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
    }
    return out;
  };
  const _da = new Vector3();
  const _db = new Vector3();
  const domeNormal = (a: number, v: number, out = new Vector3()) => {
    // outward normal of the undisplaced cap from finite differences
    const e = 0.008;
    domeBase(a + e, v, _da).sub(domeBase(a - e, v, _db));
    const v0 = Math.max(0.001, v - e);
    const v1 = Math.min(1, v + e);
    domeBase(a, v1, out).sub(domeBase(a, v0, _db));
    out.cross(_da);
    if (out.lengthSq() < 1e-10) return out.set(0, 1, 0); // crown pole
    out.normalize();
    // orient outward: compare with the coarse direction (up on the cap, out/down round the lip)
    const phi = v <= V_CAP ? (v / V_CAP) * 0.9 : Math.PI / 2 + ((v - V_CAP) / (1 - V_CAP)) * Math.PI * 0.5;
    if (out.dot(frame.dir(a, _db).multiplyScalar(Math.sin(phi)).setY(Math.cos(phi))) < 0) out.negate();
    return out;
  };
  const domeDisp = (p: Vector3, v: number) => {
    const onCap = smoothstep(1, 0.66, v);
    const lumps = noise.fbm(p.x * 0.5, p.z * 0.5 + p.y * 0.3, 3) * 0.22 * k * (0.35 + 0.65 * onCap);
    const cushions = (noise.ridged(p.x * 1.2 + 3, p.z * 1.2, 2) - 0.5) * 0.2 * k * smoothstep(0.85, 0.2, v);
    // small clumps: the crown is a mass of leaf clusters, so the surface itself is knobbly
    const clumps = (noise.ridged(p.x * 2.2 + 8, p.z * 2.2 + p.y * 0.5, 2) - 0.5) * 0.1 * k * onCap;
    const fine = noise.noise(p.x * 2.4, p.z * 2.4 + p.y) * 0.04;
    return lumps + cushions + clumps + fine;
  };
  const _n = new Vector3();
  const roofRes = Math.round(180 * sk);
  // The cap is two meshes sharing the boundary curve at V_ROLL: the mossy top in the roof
  // material, the rolled lip in the bark material — reference B's eave is a heavy dark-brown
  // bark rim under the moss, not a straw edge.
  const V_ROLL = 0.75;
  const domeVertex = (a: number, v: number, out: SurfaceSample) => {
    domeBase(a, v, out.position);
    domeNormal(a, v, _n);
    const disp = domeDisp(out.position, v);
    out.position.addScaledVector(_n, disp);
    // uneven droop of the lip
    const lip = smoothstep(V_CAP, 1, v);
    out.position.y -= lip * (0.06 + 0.1 * noise.noise(a * R * 1.1, 3.3) + 0.05 * noise.noise(a * R * 4, 7)) * k;
    out.uv = [(a * capR(a)) / 1.6, (v * (capHeight + 4 * lipR)) / 1.6];
    const p = out.position;
    if (v >= V_ROLL) {
      // bark roll: lit on top and its outer face, dark on the underside (the soffit's shadow)
      const under = smoothstep(0.84, 0.97, v);
      const grain = 0.9 + 0.2 * noise.noise(p.x * 2.5, p.y * 2.5 + 4);
      const c = lerp(0.95, 0.42, under) * grain;
      out.color = [c, c * 0.95, c * 0.9];
      return;
    }
    const patches = noise.fbm(p.x * 0.8 + 11, p.z * 0.8, 2);
    // moss covers the cap; the straw shows through in patches toward the rim
    const rim = smoothstep(0.55, V_ROLL, v);
    const m = clamp(0.72 + 0.28 * (0.5 + 0.5 * patches) + 0.2 * smoothstep(0.3, 0.7, noise.noise(p.x * 1.5 + 3, p.z * 1.5)) - 0.25 * rim * smoothstep(0.4, 0.7, patches), 0, 1);
    const upness = smoothstep(0.05, 0.9, _n.y);
    // lit crowns of the clumps vs shaded hollows and flanks: a steep curve so the cap reads
    // as many small lit/dark leaf clusters rather than a smooth skin
    const bright = clamp(Math.pow(upness, 1.4) * (0.35 + 0.65 * (0.5 + 0.5 * noise.noise(p.x * 1.3, p.z * 1.3 + 9))) + 0.6 * (disp / (0.25 * k)), 0, 1);
    const mottle = 0.62 + 0.42 * noise.fbm(p.x * 0.38 + 5, p.z * 0.38 - 2, 2) + 0.14 * noise.noise(p.x * 3.1, p.z * 3.1 + 1);
    // vertex colours multiply the light straw map: grey-olive in the hollows and down the
    // flanks, yellow-olive (reference `#8b8948`, hue ≈ 55°) on the lit clumps — deliberately
    // low chroma so the cap reads as a shaded mossy mass, not a lime lawn
    const strawTone = 0.9 + 0.2 * noise.noise(p.x * 2.5, p.y * 2.5 + 4);
    const straw: [number, number, number] = [0.5 * strawTone, 0.4 * strawTone, 0.24 * strawTone];
    const deep: [number, number, number] = [0.16, 0.18, 0.07];
    const sun: [number, number, number] = [1.0, 0.92, 0.32];
    // reference B: the cap's shoulder right above the lip is its brightest band (lum 0.45–0.7,
    // sun on the moss), the crown under the canopy is darker (0.35–0.45)
    const shoulder = lerp(0.8, 1.35, smoothstep(0.22, 0.6, v));
    const flank = lerp(0.45, 1, smoothstep(-0.2, 0.8, _n.y)) * shoulder;
    const mossC = [lerp(deep[0], sun[0], bright) * mottle * flank, lerp(deep[1], sun[1], bright) * mottle * flank, lerp(deep[2], sun[2], bright) * mottle * flank];
    out.color = [lerp(straw[0], mossC[0], m), lerp(straw[1], mossC[1], m), lerp(straw[2], mossC[2], m)];
  };
  const dome = gridSurface((u, v, out) => domeVertex(u * TAU, v * V_ROLL, out), { cols: roofRes, rows: Math.round(roofRes * 0.32), closedU: true });
  const roll = gridSurface((u, v, out) => domeVertex(u * TAU, lerp(V_ROLL, 1, v), out), { cols: roofRes, rows: Math.round(roofRes * 0.1), closedU: true });
  // soffit: the dark underside from the lip's inner bottom edge back to the trunk wall
  const soffitY = (a: number, r: number) => {
    const rc = capR(a) - lipR;
    const rw = rSmooth(a, eaveY) - 0.1;
    return eaveY + 0.12 * k * clamp((rc - r) / Math.max(0.1, rc - rw), 0, 1) - (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
  };
  const soffit = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rc = capR(a) - lipR;
      const rs = rSmooth(a, eaveY);
      const r = lerp(rc, rs - 0.1, v);
      frame.at(a, r, soffitY(a, r), out.position);
      out.position.addScaledVector(F, pillarBulge(wOf(a, rs), eaveY) * v);
      out.uv = [(a * rc) / 1.6, v * 2];
      out.color = [0.36, 0.33, 0.28];
    },
    { cols: 72, rows: 3, closedU: true },
  );
  faceTowards(soffit, (p, o) => o.set(p.x, p.y - 5, p.z));
  const roofMesh = new Mesh(dome, mats.roof);
  roofMesh.name = 'roof';
  roofMesh.castShadow = roofMesh.receiveShadow = true;
  group.add(roofMesh);
  const eaveMesh = new Mesh(merge([roll, soffit]), mats.bark);
  eaveMesh.name = 'roof-eave';
  eaveMesh.castShadow = eaveMesh.receiveShadow = true;
  group.add(eaveMesh);

  // ---- living branches curling over the cap (pale bark) + limbs + chimney branch ----
  const branchRng = rng.fork('branches');
  const surfacePoint = (a: number, v: number, lift: number) => {
    const p = domeBase(a, v);
    const n = domeNormal(a, v);
    return p.addScaledVector(n, domeDisp(p, v) * 0.6 + lift);
  };
  type BranchDef = { path: [number, number][]; r0: number; r1: number; leavesAt: number[] };
  // (angle around the house, cap parameter v) waypoints: one thick limb drapes diagonally from
  // the back-right over the crown and ends mid-left; a second comes over the right shoulder and
  // stops on the crown; two shorter side branches curl up into leafy tips. The front above the
  // porch stays mostly moss so the eave line reads.
  const branchDefs: BranchDef[] = [
    { path: [[2.5, 0.8], [2.1, 0.55], [1.6, 0.37], [1.0, 0.23], [0.3, 0.23], [-0.35, 0.37], [-0.75, 0.5], [-0.95, 0.58]], r0: 0.38, r1: 0.12, leavesAt: [1] },
    { path: [[2.7, 0.75], [2.35, 0.55], [1.95, 0.42], [1.5, 0.33], [1.15, 0.29], [0.95, 0.23]], r0: 0.34, r1: 0.12, leavesAt: [1] },
    { path: [[-1.75, 0.44], [-1.4, 0.5], [-1.05, 0.6], [-0.85, 0.68], [-0.8, 0.7]], r0: 0.24, r1: 0.08, leavesAt: [1] },
    { path: [[3.1, 0.67], [2.85, 0.48], [2.55, 0.32], [2.2, 0.23], [2.0, 0.25]], r0: 0.3, r1: 0.1, leavesAt: [1] },
  ];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/house/${def.id}`);
  const branchParts = [];
  const leafTint: [number, number, number] = [0.62, 0.7, 0.36];
  // dark grey-brown limb bark (willow set, darkened): the reference limbs are as dark as the
  // shaded trunk but cooler/greyer than its warm bark
  const limbColor = (t: number, ang: number): [number, number, number] => {
    const d = lerp(0.5, 0.6, t) * (0.8 + 0.35 * Math.max(0, Math.sin(ang)));
    return [d, d * 0.93, d * 0.86];
  };
  for (let bi = 0; bi < branchDefs.length; bi++) {
    const b = branchDefs[bi];
    const pts = b.path.map(([a, v], idx) => {
      const r = lerp(b.r0, b.r1, idx / (b.path.length - 1)) * k;
      // half-sunk into the moss, wandering sideways a little between waypoints
      const lift = r * 0.3 + (branchRng() - 0.5) * 0.08 + (idx % 2 ? 0.05 : 0) * k;
      return surfacePoint(a + (branchRng() - 0.5) * 0.16, clamp(v + (branchRng() - 0.5) * 0.03, 0.02, 0.98), lift);
    });
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const twist = branchRng() * 10;
    const geo = sweepTube(curve, {
      radius: (t) => lerp(b.r0, b.r1, t) * k * (1 + 0.14 * Math.sin(t * 9 + twist) + 0.08 * Math.sin(t * 23 + twist * 2)),
      tubularSegments: 48,
      radialSegments: 12,
      uvMetres: 1.2,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.4 + t * 4 + bi, pos.y * 1.5, 2) - 0.5) * 0.08 * k,
      color: limbColor,
      capEnd: true,
    });
    branchParts.push(geo);
    for (const at of b.leavesAt) {
      const p = curve.getPointAt(at);
      foliage.addLeafCluster(p, 0.55 * k, 44, { size: 0.13, amount: 0.06, droop: 0.55, tint: leafTint, tintSpread: 0.28 });
      // a couple of short vines trail from each leafy tip
      for (let s = 0; s < 2; s++) {
        const hook = p.clone().add(new Vector3((branchRng() - 0.5) * 0.4, -0.1, (branchRng() - 0.5) * 0.4));
        foliage.addHangingVine(hook, 0.45 + branchRng() * 0.55, { amount: 0.1 });
      }
    }
  }
  // ---- hero limb: a thick broken stub jutting off the cap's left shoulder and leaning
  // left-down (reference B: the limb at (0.62–0.72, 0.15–0.30), ~2 m long, splintered end) ----
  const limbPts = [
    frame.at(-0.7, capR(-0.7) - 0.9 * k, lipTop + 0.15 * k),
    frame.at(-0.85, capR(-0.85) + 0.2 * k, lipTop + 0.05 * k),
    frame.at(-1.0, capR(-1.0) + 1.0 * k, eaveY + 0.1 * k),
    frame.at(-1.12, capR(-1.12) + 1.75 * k, eaveY - 0.45 * k),
  ];
  for (let i = 1; i < limbPts.length; i++) limbPts[i].add(new Vector3((branchRng() - 0.5) * 0.16, (branchRng() - 0.5) * 0.1, (branchRng() - 0.5) * 0.16));
  const limbCurve = new CatmullRomCurve3(limbPts, false, 'catmullrom', 0.5);
  const limbR = (t: number) => (0.46 - 0.16 * t) * k * (1 + 0.08 * Math.sin(t * 9 + 2) + 0.05 * Math.sin(t * 23));
  branchParts.push(
    sweepTube(limbCurve, {
      radius: limbR,
      tubularSegments: 24,
      radialSegments: 12,
      uvMetres: 1.2,
      // deep longitudinal ridges; the broken end flares a little and is jagged
      displace: (t, ang, pos) => (noise.ridged(ang * 1.6 + 7, pos.y * 1.5 + t * 2, 2) - 0.5) * 0.11 * k + smoothstep(0.85, 1, t) * (0.06 + 0.1 * Math.abs(Math.sin(ang * 5 + 1))) * k,
      color: (t, ang) => (t > 0.985 ? [0.2, 0.16, 0.12] : limbColor(t, ang)),
      capEnd: true,
    }),
  );
  {
    // a couple of vines trail off the stub's underside; one small ivy tuft rides on top
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.25;
      const p = limbCurve.getPointAt(t);
      p.y -= limbR(t) * 0.85;
      p.x += (branchRng() - 0.5) * 0.2;
      p.z += (branchRng() - 0.5) * 0.2;
      foliage.addHangingVine(p, (0.5 + branchRng() * 0.7) * k, { amount: 0.1 });
    }
    const top = limbCurve.getPointAt(0.55);
    top.y += limbR(0.55) * 0.8;
    foliage.addLeafCluster(top, 0.3 * k, 22, { size: 0.12, amount: 0.05, droop: 0.4, tint: leafTint, tintSpread: 0.28, flatten: 0.4 });
  }
  // ---- right limb: the stump's surviving bough, rising off the right shoulder and leaning
  // out to the right (reference B: a thick limb climbs the right edge of the frame) ----
  const rightPts = [
    frame.at(0.85, capR(0.85) - 1.0 * k, lipTop - 0.1 * k),
    frame.at(0.95, capR(0.95) + 0.1 * k, lipTop + 0.9 * k),
    frame.at(1.05, capR(1.05) + 0.75 * k, lipTop + 1.9 * k),
    frame.at(1.15, capR(1.15) + 1.3 * k, lipTop + 2.6 * k),
  ];
  for (let i = 1; i < rightPts.length; i++) rightPts[i].add(new Vector3((branchRng() - 0.5) * 0.16, (branchRng() - 0.5) * 0.1, (branchRng() - 0.5) * 0.16));
  const rightCurve = new CatmullRomCurve3(rightPts, false, 'catmullrom', 0.5);
  branchParts.push(
    sweepTube(rightCurve, {
      radius: (t) => (0.42 - 0.2 * t) * k * (1 + 0.08 * Math.sin(t * 8 + 1) + 0.05 * Math.sin(t * 21)),
      tubularSegments: 24,
      radialSegments: 12,
      uvMetres: 1.2,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.6 + 3, pos.y * 1.5 + t * 2, 2) - 0.5) * 0.1 * k,
      color: limbColor,
      capEnd: true,
    }),
  );
  {
    const tip = rightCurve.getPointAt(1);
    foliage.addLeafCluster(tip, 0.5 * k, 40, { size: 0.13, amount: 0.06, droop: 0.5, tint: leafTint, tintSpread: 0.28 });
    const mid = rightCurve.getPointAt(0.55);
    mid.y -= 0.3 * k;
    foliage.addHangingVine(mid, (0.6 + branchRng() * 0.6) * k, { amount: 0.1 });
  }
  // chimney branch: stubby, hollow-looking, tilted
  {
    const a = 2.85;
    const v = 0.2;
    const base = surfacePoint(a, v, -0.25 * k);
    const up = domeNormal(a, v).add(new Vector3(0, 1.2, 0)).normalize();
    const tilt = frame.dir(a + 1.2).multiplyScalar(0.18);
    const pts = [base, base.clone().addScaledVector(up, 0.45 * k).add(tilt), base.clone().addScaledVector(up, 0.95 * k).addScaledVector(tilt, 2.2)];
    const chimney = sweepTube(new CatmullRomCurve3(pts), {
      radius: (t) => (0.26 - 0.06 * t) * k,
      tubularSegments: 10,
      radialSegments: 12,
      uvMetres: 1.0,
      displace: (t, ang) => (noise.ridged(ang * 1.6 + 2, t * 5, 2) - 0.5) * 0.05 * k,
      color: (t, ang) => (t > 0.985 ? [0.12, 0.1, 0.08] : limbColor(t, ang)),
      capEnd: true,
    });
    branchParts.push(chimney);
  }
  const branchMesh = new Mesh(merge(branchParts), mats.barkPale);
  branchMesh.name = 'roof-branches';
  branchMesh.castShadow = branchMesh.receiveShadow = true;
  group.add(branchMesh);

  // ---- heart-leaf vines hanging from the lip + draped over the cap, tufts and ferns on top ----
  const vineRng = rng.fork('vines');
  const hanging = def.id === 'saria' ? 20 : 14;
  for (let i = 0; i < hanging; i++) {
    // spread over the front 260°; strands right above the porch stay short so it is not veiled
    const a = -2.3 + (i / (hanging - 1)) * 4.6 + (vineRng() - 0.5) * 0.2;
    const hook = surfacePoint(a, 0.93, -0.04);
    hook.y -= 0.1 * k;
    const overDoor = smoothstep(0.7, 0.2, Math.abs(a));
    const len = (0.6 + vineRng() * 1.1) * (0.8 + 0.4 * Math.abs(Math.sin(a))) * (1 - 0.6 * overDoor);
    foliage.addHangingVine(hook, len * k, { amount: 0.1 });
  }
  const draped = def.id === 'saria' ? 6 : 4;
  for (let i = 0; i < draped; i++) {
    const a0 = (i / draped) * TAU + vineRng() * 0.6;
    const pts: Vector3[] = [];
    const nrms: Vector3[] = [];
    const n = 7;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const a = a0 + Math.sin(t * 2.2 + i) * 0.35;
      const v = lerp(0.15 + vineRng() * 0.1, 0.88, t);
      pts.push(surfacePoint(a, v, 0.03));
      nrms.push(domeNormal(a, v));
    }
    foliage.addSurfaceVine(pts, nrms, { amount: 0.02 });
  }
  const tuftCount = def.id === 'saria' ? 46 : 28;
  const roofShade: [number, number, number] = [0.6, 0.6, 0.38];
  for (let i = 0; i < tuftCount; i++) {
    const a = vineRng() * TAU;
    const v = 0.05 + vineRng() * 0.7;
    const p = surfacePoint(a, v, -0.03);
    const n = domeNormal(a, v);
    const fern = vineRng() < 0.35;
    const low = lerp(0.6, 1, smoothstep(0.1, 0.4, v));
    foliage.addTuft(p, n, (fern ? 0.5 : 0.34) * (0.8 + vineRng() * 0.5) * sk * low, fern ? 1 : 0, 0.05, roofShade);
  }
  // ---- leaf-cluster shroud: the cap is a mass of overlapping leaf clumps (reference B: lit
  // yellow-olive tops, dark shaded undersides), so the moss shell only shows through between
  // them. Tints run from deep grey-olive in the hollows to yellow-olive on the lit clumps; the
  // front over the porch is thinned so the eave line and the doorway stay clear.
  const clumpRng = rng.fork('clumps');
  const clumpCount = Math.round(140 * k * k);
  // yellow-olive rather than green (reference roof hue ≈ 50–59°)
  const tints: [number, number, number][] = [
    [0.34, 0.36, 0.18],
    [0.5, 0.5, 0.24],
    [0.7, 0.66, 0.3],
    [0.9, 0.82, 0.38],
  ];
  for (let i = 0; i < clumpCount; i++) {
    const a = clumpRng() * TAU;
    const v = 0.04 + Math.pow(clumpRng(), 0.8) * 0.74;
    if (Math.abs(angleDiff(a, 0)) < 0.55 && v > 0.5 && clumpRng() < 0.6) continue;
    const p = surfacePoint(a, v, 0.08 * k);
    const n = domeNormal(a, v);
    // lit side (upper faces) gets the yellower clumps, flanks the deep ones; the crown sits
    // under the canopy and stays in the darker tints
    const lit = clamp((n.y * 0.75 + 0.3 * clumpRng() + 0.15 * noise.noise(p.x * 1.5, p.z * 1.5)) * lerp(0.55, 1, smoothstep(0.15, 0.5, v)), 0, 0.999);
    const tint = tints[Math.floor(lit * tints.length)];
    // flatter, smaller clumps on the crown so the cap's top silhouette stays low
    const radius = (0.3 + clumpRng() * 0.26) * k * lerp(0.7, 1, smoothstep(0.1, 0.4, v));
    foliage.addLeafCluster(p, radius, 34, { size: 0.2 * sk, amount: 0.05, droop: 0.5, tint, tintSpread: 0.25, flatten: lerp(0.3, 0.5, smoothstep(0.1, 0.4, v)) });
  }
  // a few big ferns / grass clumps on the shoulders that break the cap silhouette (kept off
  // the crown so the top of the cap stays low)
  const heroTufts: { a: number; v: number; size: number; kind: 0 | 1 }[] = [
    { a: -1.45, v: 0.5, size: 0.8, kind: 1 },
    { a: -1.85, v: 0.6, size: 0.7, kind: 0 },
    { a: -0.95, v: 0.45, size: 0.65, kind: 1 },
    { a: 0.7, v: 0.42, size: 0.6, kind: 1 },
    { a: 2.1, v: 0.5, size: 0.7, kind: 0 },
  ];
  for (const ht of heroTufts) {
    const p = surfacePoint(ht.a, ht.v, -0.05);
    const n = domeNormal(ht.a, ht.v);
    // lean the clump a little toward vertical so it stands proud of the moss
    n.y += 0.6;
    n.normalize();
    foliage.addTuft(p, n, ht.size * sk, ht.kind, 0.06);
  }

  // ---- pod lanterns on cords under the eave ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('lanterns');
  const specs = LANTERNS[def.id] ?? LANTERNS.upper;
  const podPositions: Vector3[] = [];
  let limeCount = 0;
  for (const spec of specs.slice(0, Math.max(def.lanterns, specs.length))) {
    let hook: Vector3;
    if (spec.hook === 'eave') {
      // hooked to the soffit a little in from the lip; the cord is a vine
      const r = capR(spec.a) - lipR - 0.45 * k;
      hook = frame.at(spec.a, r, soffitY(spec.a, r) - 0.03);
      foliage.addHangingVine(hook.clone(), spec.cord * k * 0.85, { amount: 0.08, thickness: 0.012 });
    } else {
      const y = spec.y ?? 2.6;
      const start = frame.at(spec.a, rSmooth(spec.a, y) - 0.2, y);
      const end = frame.at(spec.a, rSmooth(spec.a, y) + 0.5 * k, y + 0.12);
      const peg = sweepTube(new CatmullRomCurve3([start, start.clone().lerp(end, 0.5).add(new Vector3(0, 0.04, 0)), end]), {
        radius: (t) => (0.075 - 0.03 * t) * k,
        tubularSegments: 6,
        radialSegments: 8,
        capEnd: true,
        color: () => [0.9, 0.85, 0.75],
      });
      const pegMesh = new Mesh(ensureColor(peg), mats.bark);
      pegMesh.name = 'lantern-peg';
      pegMesh.castShadow = true;
      group.add(pegMesh);
      hook = end.clone().addScaledVector(frame.dir(spec.a), -0.06);
      hook.y -= 0.04;
      // a hanging vine trails off the peg too
      foliage.addHangingVine(end.clone().add(new Vector3(0, 0.02, 0)), 0.5, { amount: 0.08 });
    }
    const rig = buildLantern(hook, spec.cord * k, mats, lanternRng, 1.0, spec.tint ?? 'orange');
    if (spec.tint === 'lime') limeCount++;
    group.add(rig.pivot);
    lanterns.push(rig);
    podPositions.push(rig.pod);
  }
  if (podPositions.length) {
    const c = new Vector3();
    for (const p of podPositions.slice(0, 2)) c.add(p);
    c.divideScalar(Math.min(2, podPositions.length));
    c.addScaledVector(F, 0.35);
    // the shared glow takes on the mix of pod colours
    const glow = new Color(ctx.config.palette.lanternGlow).lerp(new Color(0xd2ee48), limeCount / podPositions.length);
    const lanternLight = new PointLight(glow, 6.5, 6, 2);
    lanternLight.position.copy(c);
    lanternLight.name = 'lantern-light';
    group.add(lanternLight);
    lights.push(lanternLight);
  }

  for (const m of foliage.build(mats, `house-${def.id}`)) group.add(m);

  return { group, bases, lanterns, lights, roots: rootCount, branches: branchDefs.length + 3, leaves: foliage.leafCount };
}
