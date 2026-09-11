/**
 * Kokiri tree-trunk house (reference B, 14 s; concept sheet 04 "Tree-house exterior"): a hollow
 * living stump under a BROAD mushroom-cap roof — a tall sunlit moss mound whose rolled eave
 * overhangs the trunk by a third of its radius, with a dark soffit that shades a deep porch cut
 * into the front of the trunk. Two thick bark pillars (bulges of the trunk wall) flank the porch;
 * the actual doorway — a wide, low opening with a wooden frame over a stone threshold slab —
 * nearly fills the porch's back wall and opens on a dark, neutral grey-brown, hazed room (a
 * hanging lamp, a candle on a low table, embers glowing pink-amber low on the right). The cap is a
 * mossy shell in the roof material sitting on a rolled bark rim in the bark material (reference:
 * a heavy dark-brown eave under the moss), and it is held by the house's own living branches in
 * the trunk's bark: one gnarled bough rises from the roots on the left, climbs the left shoulder
 * and arches over the FRONT of the cap well clear of the moss (frame B looks up at it, so it runs
 * as a thick dark limb across the top band above the dome, like the reference's near limb) before
 * sinking back into the moss behind the right shoulder; a second, dark under the moss's shadow,
 * runs along the front eave above the door with the pod lanterns hanging from it on short cords
 * (sheet 04 "Natural wooden supports (branches)"). Buttress roots seat the trunk on the terrain,
 * pale limbs drape over the cap, moss, leaf clumps, ferns, broad-leaf plants and heart-leaf vines
 * shroud the cap, and a small round window glows on the left flank.
 *
 * Every dimension is expressed in terms of `trunkRadius` / `roofHeight`, so the same builder
 * produces Saria's hero house and the small upper house.
 */
import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  type Material,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
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
  /** materials created for this house (disposed by the system) */
  materials: Material[];
  roots: number;
  branches: number;
  leaves: number;
}

/**
 * Materials that every house can share (identical parameters, no per-house uniforms), so their
 * parts fold into one draw call across houses. The first house creates them and owns disposal.
 */
export interface HouseSharedMaterials {
  stone?: MeshStandardMaterial;
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
  /**
   * 'bough' hangs from the underside of the eave bough that runs across the front, 'eave' from
   * the soffit under the roof lip, 'peg' from a short stub branch at height y
   */
  hook: 'bough' | 'eave' | 'peg';
  y?: number;
  /** glow colour (default orange) */
  tint?: LanternKind;
}

// Reference B: three pods in a loose row under the eave just left of / over the door (frame
// x 0.736 / 0.763 / 0.794, y 0.29–0.32, i.e. hanging right below the soffit); lime / orange /
// lime from left to right, the orange one lowest. Sheet 04 hangs four from the eave bough, the
// fourth right of the door on a longer cord — here it is moved round to the right flank.
const LANTERNS: Record<string, LanternSpec[]> = {
  saria: [
    // three pods cluster left of the door on the eave bough (reference B: pod centres at frame
    // x ≈ 0.728 / 0.758 / 0.79, y 0.32–0.36, hanging close under the branch); the sheet's fourth pod hangs under the soffit on the
    // right flank, where in B the reference shows only the dark trunk
    { a: -0.18, cord: 0.03, hook: 'bough', tint: 'lime' },
    { a: -0.04, cord: 0.14, hook: 'bough', tint: 'orange' },
    { a: 0.08, cord: 0.06, hook: 'bough', tint: 'lime' },
    { a: 1.2, cord: 0.3, hook: 'eave', tint: 'orange' },
  ],
  // the upper house's pods hang on its plateau-side flanks: with Saria's cap lowered its front
  // shows above her roof in B, where the reference has only dark canopy (no lit pods there)
  upper: [
    { a: -1.9, cord: 0.3, hook: 'eave' },
    { a: 2.0, cord: 0.4, hook: 'eave' },
  ],
};

/** Blend a moss tint into a swept branch's vertex colours on its upward-facing side. */
function mossOnTop(geo: BufferGeometry, tint: [number, number, number], amount: number, noise: Noise2D): BufferGeometry {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const col = geo.attributes.color;
  if (!col) return geo;
  for (let i = 0; i < pos.count; i++) {
    const up = nrm.getY(i);
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const patch = 0.45 + 0.55 * noise.fbm(x * 1.7 + 3, z * 1.7 + y * 0.6, 2);
    const w = clamp(smoothstep(0.25, 0.85, up) * patch * amount, 0, 1);
    col.setXYZ(i, lerp(col.getX(i), tint[0], w), lerp(col.getY(i), tint[1], w), lerp(col.getZ(i), tint[2], w));
  }
  return geo;
}

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
 * The room seen through the doorway. Reference B: the opening is NOT black — a hazed dark cavity
 * (lum ≈ 0.30, sat ≈ 0.1, hue ≈ 40°) with a warm lamp glint and a pink-amber glow low on the
 * right. The airlight between the camera and the door supplies most of the luminance, so the
 * room itself is dark warm wood whose vertex colours carry the two glow gradients; the bark
 * normal map gives it some grain. Double-sided so the flat room planes need no winding.
 */
function roomMaterial(mats: StructureMaterials): MeshStandardMaterial {
  // no colour map (the bark albedo's own pattern would fight the glow gradients); a dark
  // blue-grey (the reference room reads grey-teal) — the warm airlight in front of the door
  // pulls it back to the doorway's (84, 81, 76)-class neutral, and the lamp alone supplies the
  // warmth
  return new MeshStandardMaterial({
    normalMap: mats.interior.normalMap,
    normalScale: new Vector2(0.3, 0.3),
    roughness: 1,
    color: new Color(0x64656e),
    emissive: new Color(0x000000),
    vertexColors: true,
    side: DoubleSide,
  });
}

export function buildHouse(def: HouseDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng, shared: HouseSharedMaterials = {}): HouseBuild {
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
  /** cap crown of the bare shell (moss lumps and leaf clumps add ~0.4 m on top); reference B's
   *  dome is a tall mound — at frame x 0.72–0.80 its sunlit moss runs from the eave (y 0.26) up to
   *  y 0.13, twice the height of a 0.83 crown; header estimate crown ≈ 6–6.5 m */
  const crownY = def.roofHeight * 0.97;
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
  // small round window high on the lit left flank (sheet 04, upper left of the trunk): left of
  // the porch pillar, below the eave bough's left leg — in B at ≈ (0.67, 0.40), clear of the roof
  const winA = -0.72;
  const winY = 0.62 * eaveY;
  const winR = 0.24 * sk;

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
        // grey-brown in the recess: the warm bark map is pulled toward neutral (reference porch
        // flanks/frame ≈ (72, 78, 76))
        const dark = lerp(0.6, 0.3, Math.pow(q, 0.7));
        out.color = [dark * 0.8, dark * 0.92, dark * 1.12];
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
        out.color = [shade * 0.8, shade * 0.92, shade * 1.12];
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
        out.color = [shade * 0.88, shade * 0.96, shade * 1.06];
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
        out.color = [dark * 0.8, dark * 0.92, dark * 1.12];
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
  const materials: Material[] = [roomMat];
  // the room's two light sources (reference B: a lamp glint at frame (0.78, 0.44) ≈ 1.3 m up
  // left of centre, and a pink-amber glow low on the right of the opening)
  const lampW = doorW0 + 0.85 * k;
  const lampY = 0.6 * doorTop;
  const lampPos = frame.door(lampW, lampY, roomFront - 0.5 * k);
  const hearthPos = frame.door(doorW1 - 0.5 * k, sill + 0.32 * k, roomFront - 0.26 * k);
  const roomParts = [];
  {
    // room shading: dark warm wood everywhere (the airlight in front of the door supplies the
    // reference's ≈ 0.30 luminance), a little lighter low down and toward the middle so the
    // opening reads as a cavity, plus two glow gradients painted into the vertex colours — warm
    // amber around the lamp, pink-amber round the embers — that the point lights then reinforce
    const roomWc = (roomW0 + roomW1) / 2;
    const roomHw = (roomW1 - roomW0) / 2;
    const _p = new Vector3();
    const glowAt = (p: Vector3): [number, number, number] => {
      // small pools of warmth: the lamp's glow reaches ≈ 0.9 m, the embers' ≈ 0.7 m
      const dl = p.distanceTo(lampPos) / (0.9 * k);
      const gl = Math.exp(-dl * dl * 1.8) * 0.34;
      const dh = p.distanceTo(hearthPos) / (0.7 * k);
      const gh = Math.exp(-dh * dh * 1.8) * 0.26;
      // amber round the lamp, pink-amber round the embers — low-chroma: the reference's doorway
      // pixels measure hue ≈ 37° at saturation ≈ 0.1 once the airlight is on them
      return [gl * 0.8 + gh * 0.8, gl * 0.77 + gh * 0.7, gl * 0.72 + gh * 0.68];
    };
    const wallShade = (w: number, y: number, depth: number, p: Vector3): [number, number, number] => {
      const lat = 1 - 0.3 * smoothstep(0.45, 1, Math.abs(w - roomWc) / roomHw);
      // darkest under the ceiling (reference: 0.27–0.30 under the lintel, 0.34–0.36 low down)
      const s = lerp(0.5, 0.05, Math.pow(smoothstep(roomFloorY, roomCeilY, y), 0.8)) * lerp(1, 0.75, depth) * lat;
      const g = glowAt(p);
      return [s * 1.0 + g[0], s * 0.97 + g[1], s * 1.05 + g[2]];
    };
    // room's front plane (inside face of the back wall) around the doorway
    roomParts.push(
      gridSurface(
        (u, v, out) => {
          const w = lerp(roomW0 - 0.05, roomW1 + 0.05, u);
          const y = lerp(roomFloorY - 0.06, roomCeilY + 0.06, v);
          frame.door(w, y, roomFront + 0.01, out.position);
          out.uv = [w / 2.2, y / 2.2];
          out.color = wallShade(w, y, 0.3, out.position);
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
          out.color = wallShade(w, y, 1 - u, out.position);
        },
        { cols: 24, rows: 12 },
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
            out.color = wallShade(w, y, 0.5 * (1 - u), out.position);
          },
          { cols: 6, rows: 8 },
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
            let s = y === roomFloorY ? 0.55 : 0.05;
            if (y === roomFloorY) {
              const th = terrain.height(out.position.x, out.position.z) + 0.05;
              if (th > out.position.y) {
                // where the plateau slope rises through the floor (right rear) it stays in shadow
                s *= lerp(1, 0.35, clamp((th - out.position.y) / 0.25, 0, 1));
                out.position.y = th;
              }
            }
            out.uv = [w / 2.2, d / 2.2];
            const g = glowAt(_p.copy(out.position));
            out.color = [s * 1.0 + g[0] * 0.5, s * 0.97 + g[1] * 0.5, s * 1.05 + g[2] * 0.5];
          },
          { cols: 16, rows: 10 },
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
    // grey-brown, weathered: the frame reads neutral in the reference (≈ (72, 78, 76)), so the
    // plank map's warmth is countered by a cool vertex tint
    setColorAttribute(sillBeam, [0.6, 0.62, 0.62]);
    woodParts.push(sillBeam);
    const frameR = 0.085 * sk;
    for (const side of [-1, 1]) {
      const w = (side < 0 ? doorW0 : doorW1) + side * frameR * 0.8;
      const pts = [frame.door(w, sill - 0.1, dBack + 0.02), frame.door(w, lerp(sill, doorTop - doorRc, 0.5), dBack + 0.04), frame.door(w, doorTop - doorRc + 0.05, dBack + 0.04)];
      const post = sweepTube(new CatmullRomCurve3(pts), { radius: (t) => frameR * (1 - 0.12 * t), tubularSegments: 6, radialSegments: 9, uvMetres: 0.6 });
      setColorAttribute(post, [0.34, 0.34, 0.35]);
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
    setColorAttribute(lintel, [0.32, 0.32, 0.33]);
    woodParts.push(lintel);
  }
  const woodMesh = new Mesh(merge(woodParts), mats.wood);
  woodMesh.name = 'door-frame';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // ---- stone threshold slab at path level in front of the sill (sheet 04: the door opens on
  // the flagstones) — an irregular worn slab, grey-brown like the path stones ----
  {
    let stone = shared.stone;
    if (!stone) {
      stone = shared.stone = new MeshStandardMaterial({ color: new Color(0x9e9a8e), roughness: 1, vertexColors: true, normalMap: mats.moss.normalMap, normalScale: new Vector2(0.25, 0.25) });
      materials.push(stone);
    }
    const slabW = (doorW1 - doorW0) * 0.5 + 0.35 * k;
    const slabD = 0.42 * k;
    const slabC = frame.door((doorW0 + doorW1) / 2 + 0.05 * k, 0, dBack + 0.42 * k);
    const slabTop = Math.max(sill - 0.035, terrain.height(slabC.x, slabC.z) - yFloor + 0.07);
    const slab = new CylinderGeometry(1, 1.06, 0.12 * k, 9, 1, false);
    slab.scale(slabW, 1, slabD);
    // irregular outline: nudge the rim vertices in and out
    {
      const pos = slab.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const rr = Math.hypot(x / slabW, z / slabD);
        if (rr > 0.5) {
          const f = 1 + 0.12 * noise.noise(x * 3.1 + 7, z * 3.1 + pos.getY(i) * 4);
          pos.setXYZ(i, x * f, pos.getY(i), z * f);
        }
      }
      slab.computeVertexNormals();
    }
    slab.applyMatrix4(basisMatrix(frame.door((doorW0 + doorW1) / 2 + 0.05 * k, slabTop - 0.06 * k, dBack + 0.42 * k), F));
    // worn pale top, damp dark sides
    const col: [number, number, number][] = [];
    const pos = slab.attributes.position;
    const nrm = slab.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const up = Math.max(0, nrm.getY(i));
      const d = lerp(0.42, 0.7, up) * (0.92 + 0.16 * noise.noise(pos.getX(i) * 4, pos.getZ(i) * 4 + 2));
      col.push([d, d, d * 0.97]);
    }
    setColorAttribute(slab, (i) => col[i]);
    const slabMesh = new Mesh(slab, stone);
    slabMesh.name = 'threshold';
    slabMesh.castShadow = slabMesh.receiveShadow = true;
    group.add(slabMesh);
  }

  // ---- lamp + embers inside the room (reference glints at frame (0.78, 0.44) ≈ 1.3 m up and a
  // fainter one at (0.775, 0.49) ≈ 0.7 m up: a candle on a low table; the pink-amber glow low
  // right is a bed of embers in a stone ring) ----
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
    setColorAttribute(cord, [0.18, 0.16, 0.14]);
    // low table under the candle: a slab on a block, dark silhouettes that give the room depth
    const slab = new BoxGeometry(0.7 * k, 0.05 * k, 0.45 * k);
    slab.applyMatrix4(basisMatrix(frame.door(doorW0 + 0.7 * k, sill + 0.5 * k, roomFront - 0.85 * k), F));
    setColorAttribute(slab, [0.27, 0.26, 0.25]);
    const block = new BoxGeometry(0.22 * k, 0.5 * k, 0.22 * k);
    block.applyMatrix4(basisMatrix(frame.door(doorW0 + 0.7 * k, sill + 0.25 * k, roomFront - 0.85 * k), F));
    setColorAttribute(block, [0.2, 0.19, 0.18]);
    // ember ring: a low stone kerb round the glow
    const kerb = new TorusGeometry(0.2 * k, 0.05 * k, 6, 12);
    kerb.rotateX(Math.PI / 2);
    kerb.translate(hearthPos.x, hearthPos.y - 0.14 * k, hearthPos.z);
    setColorAttribute(kerb, [0.18, 0.18, 0.18]);
    const furnitureMesh = new Mesh(merge([cord, slab, block, kerb]), mats.woodDark);
    furnitureMesh.name = 'door-lamp-cord';
    group.add(furnitureMesh);
    // the embers themselves (dim orange) and a small soft pink-amber halo facing the door — kept
    // small so the doorway as a whole stays neutral (reference box saturation ≈ 0.1)
    const embers = new SphereGeometry(0.045 * k, 10, 6);
    embers.scale(1, 0.35, 1);
    embers.translate(hearthPos.x, hearthPos.y - 0.12 * k, hearthPos.z);
    const emberMesh = new Mesh(embers, mats.hearth);
    emberMesh.name = 'door-embers';
    group.add(emberMesh);
    const halo = new PlaneGeometry(0.22 * k, 0.16 * k);
    halo.applyMatrix4(basisMatrix(hearthPos.clone().addScaledVector(F, 0.05), F));
    const haloMesh = new Mesh(halo, mats.ember);
    haloMesh.name = 'door-ember-glow';
    group.add(haloMesh);
  }
  const lights: PointLight[] = [];
  // warm lamp, kept small and pale: it shapes the glow on the wall around it (the reference
  // glint lifts the wall by ≈ 0.05 luminance) without painting the room orange — the doorway
  // as a whole must stay a neutral grey-brown (reference box saturation ≈ 0.1)
  const doorLight = new PointLight(0xfaeee2, 0.2 * k, 1.9 * k, 2);
  doorLight.position.copy(lampPos).addScaledVector(F, -0.1);
  doorLight.name = 'door-light';
  group.add(doorLight);
  lights.push(doorLight);
  // pink-amber ember glow low right (reference doorway crop): short range, low on the floor
  const emberLight = new PointLight(0xf5cfc0, 0.08 * k, 1.2 * k, 2);
  emberLight.position.copy(hearthPos);
  emberLight.name = 'ember-light';
  group.add(emberLight);
  lights.push(emberLight);

  // ---- round window: socket + glow + wooden ring ----
  {
    const O = frame.dir(winA);
    const surf = frame.at(winA, rSmooth(winA, winY) + 0.02, winY);
    // shallow socket: B and A look at this flank at 50–60° off its normal, so a deep socket
    // would hide the glow behind its near rim
    const socketD = 0.08 * k;
    const socket = new CylinderGeometry(winR, winR, socketD + 0.1, 24, 1, true);
    socket.rotateX(Math.PI / 2);
    socket.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -(socketD + 0.1) / 2 + 0.02), O));
    const socketMesh = new Mesh(socket, mats.interior);
    socketMesh.name = 'window-socket';
    group.add(socketMesh);
    const glass = new CircleGeometry(winR, 24);
    glass.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -socketD), O));
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
      // bark roll: in the moss overhang's shadow on top (reference B: a dark line, lum ≈ 0.28–0.31,
      // between the sunlit moss and the eave branch), darker still on the underside
      const under = smoothstep(0.84, 0.97, v);
      const grain = 0.9 + 0.2 * noise.noise(p.x * 2.5, p.y * 2.5 + 4);
      const c = lerp(0.62, 0.4, under) * grain;
      out.color = [c, c * 0.95, c * 0.9];
      return;
    }
    const patches = noise.fbm(p.x * 0.8 + 11, p.z * 0.8, 2);
    // moss covers the cap almost entirely (sheet 04 "moss-covered roof"); a little straw shows
    // through in patches toward the rim
    const rim = smoothstep(0.55, V_ROLL, v);
    const m = clamp(0.8 + 0.2 * (0.5 + 0.5 * patches) + 0.2 * smoothstep(0.3, 0.7, noise.noise(p.x * 1.5 + 3, p.z * 1.5)) - 0.22 * rim * smoothstep(0.4, 0.7, patches), 0, 1);
    const upness = smoothstep(0.05, 0.9, _n.y);
    // lit crowns of the clumps vs shaded hollows and flanks: a steep curve so the cap reads
    // as many small lit/dark leaf clusters rather than a smooth skin
    const bright = clamp(Math.pow(upness, 1.4) * (0.35 + 0.65 * (0.5 + 0.5 * noise.noise(p.x * 1.3, p.z * 1.3 + 9))) + 0.6 * (disp / (0.25 * k)), 0, 1);
    const mottle = 0.62 + 0.45 * noise.fbm(p.x * 0.38 + 5, p.z * 0.38 - 2, 2) + 0.14 * noise.noise(p.x * 3.1, p.z * 3.1 + 1);
    // vertex colours multiply the light straw map: deep green in the hollows and down the
    // flanks, yellow-olive (reference `#8b8948`, hue ≈ 50–55°) on the lit clumps — the chroma
    // is carried by the green/blue gap so the cap reads as a mossy mass, not a lime lawn
    const strawTone = 0.9 + 0.2 * noise.noise(p.x * 2.5, p.y * 2.5 + 4);
    const straw: [number, number, number] = [0.48 * strawTone, 0.4 * strawTone, 0.2 * strawTone];
    const deep: [number, number, number] = [0.22, 0.3, 0.07];
    const sun: [number, number, number] = [1.4, 1.34, 0.3];
    // reference B: the cap's shoulder right above the lip is its brightest band (lum 0.45–0.7,
    // sun on the moss; box p90 ≈ 0.55), the crown under the canopy is darker (box p10 ≈ 0.20);
    // the front face over the porch — the dome frame B looks at — is sunlit moss (roof-only box
    // p50 ≈ 0.48), so it carries an extra lift
    const frontFace = smoothstep(1.5, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.15, 0.4, v);
    const shoulder = lerp(0.7, 1.6, smoothstep(0.2, 0.62, v)) * (1 + 0.85 * frontFace);
    const flank = lerp(0.4, 1, smoothstep(-0.2, 0.8, _n.y)) * shoulder;
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
  // (angle around the house, cap parameter v) waypoints for the pale draped limbs: one comes over
  // the right shoulder and stops on the crown; two shorter side branches curl up into leafy tips.
  // (The big arc over the crown is the living support bough below, in the trunk's bark.)
  const branchDefs: BranchDef[] = [
    { path: [[2.7, 0.75], [2.35, 0.55], [1.95, 0.42], [1.5, 0.33], [1.15, 0.29], [0.95, 0.23]], r0: 0.34, r1: 0.12, leavesAt: [1] },
    { path: [[-1.75, 0.44], [-1.4, 0.5], [-1.05, 0.6], [-0.85, 0.68], [-0.8, 0.7]], r0: 0.24, r1: 0.08, leavesAt: [1] },
    { path: [[3.1, 0.67], [2.85, 0.48], [2.55, 0.32], [2.2, 0.23], [2.0, 0.25]], r0: 0.3, r1: 0.1, leavesAt: [1] },
  ];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/house/${def.id}`);
  const branchParts = [];
  const leafTint: [number, number, number] = [0.62, 0.7, 0.36];
  // dark grey-brown limb bark (willow set, darkened): the reference limbs are as dark as the
  // shaded trunk but cooler/greyer than its warm bark — dark branches lying on a bright dome
  const limbColor = (t: number, ang: number): [number, number, number] => {
    const d = lerp(0.36, 0.44, t) * (0.8 + 0.35 * Math.max(0, Math.sin(ang)));
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
  // ---- living support boughs in the trunk's own bark (sheet 04 "Natural wooden supports
  // (branches)"; reference B: a thick dark branch rises up the left of the frame and runs across
  // the TOP band above the moss dome, while the dome itself is a smooth sunlit cap) ----
  // Two gnarled boughs grow out of the roots: the ARC rises up the left flank to the eave, climbs
  // the left shoulder and arches over the front of the cap, well clear of the moss — in B a thick
  // dark limb from the lip's left edge (0.61, 0.3) up and across the top band above the dome's
  // silhouette — and sinks back into the cap behind the right shoulder; the EAVE BOUGH runs along
  // the front lip above the porch, its ends sinking into the lip roll, and the pod lanterns hang
  // from its underside. Both are half-buried in moss on top.
  const supportParts: BufferGeometry[] = [];
  const supportColor = (t: number, ang: number): [number, number, number] => {
    // the trunk's bark, a shade darker than the wall (the boughs are always in the eave's or
    // the canopy's shade), lit along the top
    const d = 0.74 * (0.82 + 0.3 * Math.max(0, Math.sin(ang)));
    return [d, d * 0.95, d * 0.88];
  };
  /** the limbs above the eave sit in the canopy's shade: reference B reads them at lum
   *  0.27–0.35 against the hazed canopy (0.45–0.5), so their bark is held well below the sunlit
   *  legs' — `shade` 0 = sunlit, 1 = fully shaded */
  const shadedColor = (t: number, ang: number, shade: number): [number, number, number] => supportColor(t, ang).map((c) => c * lerp(1, 0.42, shade)) as [number, number, number];
  const mossTint: [number, number, number] = [0.5, 1.12, 0.34];
  /** ground contact of a leg at angle a, just outside the flared trunk foot */
  const legFoot = (a: number, out = 0.35) => {
    const p = frame.at(a, rSmooth(a, 0) + out * k, 0);
    p.y = terrain.height(p.x, p.z);
    return p;
  };
  const jit = (s: number) => new Vector3((branchRng() - 0.5) * s, (branchRng() - 0.5) * s * 0.5, (branchRng() - 0.5) * s);
  /** where the arc's left leg passes the eave (the eave bough's left end meets it here) */
  const arcEavePoint = frame.at(-1.2, capR(-1.2) + 0.3 * k, eaveY - 0.1 * k);
  {
    const aL = -1.32;
    const footL = legFoot(aL);
    const arcPts = [
      footL.clone().setY(footL.y - 0.4),
      footL,
      frame.at(aL + 0.04, rSmooth(aL, 0.4 * eaveY) + 0.22 * k, 0.4 * eaveY).add(jit(0.12)),
      arcEavePoint.clone(),
      // climbing the left shoulder, then arching over the FRONT of the cap 1.5 m clear of the
      // moss: frame B looks up at it, so it runs as a thick dark limb across the top band —
      // (0.61, 0.25) → (0.66, 0.10) → (0.76, 0.05) → (0.86, 0.06) → (0.92, 0.11) — above the
      // dome's silhouette, like the reference's near limb, and from the stairs (A) it arches
      // over the crown the same way
      frame.at(-1.45, capR(-1.45) + 0.2 * k, lipTop + 1.1 * k).add(jit(0.1)),
      frame.at(-1.25, capR(-1.25) + 0.1 * k, crownY - 0.5 * k).add(jit(0.1)),
      frame.at(-0.7, 0.9 * capR(-0.7), crownY - 0.45 * k).add(jit(0.1)),
      frame.at(-0.1, 0.8 * capR(-0.1), crownY - 0.5 * k).add(jit(0.08)),
      frame.at(0.45, 0.82 * capR(0.45), crownY - 0.7 * k).add(jit(0.08)),
      // ...and sinks back into the moss behind the right shoulder (in B behind the HUD box; in A
      // a short drop onto the dome's right, where the reference has only bright haze above)
      frame.at(0.7, 0.92 * capR(0.7), crownY - 1.3 * k).add(jit(0.08)),
      frame.at(0.85, capR(0.85) - 0.35 * k, lipTop + 0.45 * k),
    ];
    const arcCurve = new CatmullRomCurve3(arcPts, false, 'catmullrom', 0.5);
    // thick at the roots (0.46 m), tapering only to 0.36 m where it re-enters the cap, knuckled;
    // it clears the moss by well over its own diameter, so it can stay a heavy limb
    const arcR = (t: number) => (0.46 - 0.1 * t) * k * (1 + 0.1 * Math.sin(t * 17 + 1) + 0.06 * Math.sin(t * 41));
    // sunlit up the leg, shaded by the canopy from the eave upward
    const arcShade = (t: number) => 0.8 * smoothstep(0.28, 0.42, t);
    const arc = sweepTube(arcCurve, {
      radius: arcR,
      tubularSegments: 96,
      radialSegments: 13,
      uvMetres: 1.4,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.5 + t * 6, pos.y * 1.3 + 2, 2) - 0.5) * 0.09 * k,
      color: (t, ang) => shadedColor(t, ang, arcShade(t)),
      capEnd: true,
    });
    supportParts.push(mossOnTop(arc, mossTint, 0.85, noise));
    // no leaf sprigs on the arch (their drooping leaves would hang as dark specks in front of the
    // sunlit moss in B); vines trail only from the leg beside the lip
    for (const t of [0.3, 0.38]) {
      const p = arcCurve.getPointAt(t);
      p.y -= arcR(t) * 0.8;
      foliage.addHangingVine(p.add(jit(0.15)), (0.5 + branchRng() * 0.6) * k, { amount: 0.1 });
    }
    bases.push([footL.x, footL.y, footL.z]);
  }
  // eave bough across the front, following the lip's droop; its left end meets the arc's leg at
  // the eave and both ends sink into the lip roll as if grown out of it
  const boughA0 = -1.1;
  const boughA1 = 0.92;
  const boughAt = (a: number, out = new Vector3()) => {
    const u = (a - boughA0) / (boughA1 - boughA0);
    const ends = smoothstep(0.7, 1, Math.abs(u - 0.5) * 2);
    const r = capR(a) + 0.1 * k + 0.05 * k * Math.cos(a * 3 + 1) - 0.3 * k * ends;
    // hugging the lip roll's underside: reference B has the moss, a dark shadow line, then the
    // branch (frame y 0.28–0.32 at x 0.72–0.80), the pods hanging below it into the porch
    const y = eaveY + lipR - 0.09 * k - 0.07 * k * Math.sin(u * Math.PI) + 0.2 * k * ends - (0.1 + 0.12 * Math.sin(a + 2.2)) * k;
    return frame.at(a, r, y, out);
  };
  const boughR = (a: number) => {
    const u = (a - boughA0) / (boughA1 - boughA0);
    return (0.24 + 0.07 * Math.abs(u - 0.5) * 2) * k * (1 + 0.08 * Math.sin(a * 11 + 3));
  };
  {
    const n = 14;
    const pts: Vector3[] = [];
    for (let i = 0; i <= n; i++) pts.push(boughAt(lerp(boughA0, boughA1, i / n)).add(i === 0 || i === n ? new Vector3() : jit(0.05)));
    const boughCurve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const bough = sweepTube(boughCurve, {
      radius: (t) => boughR(lerp(boughA0, boughA1, t)),
      tubularSegments: 56,
      radialSegments: 12,
      uvMetres: 1.4,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.5 + t * 8 + 4, pos.y * 1.3, 2) - 0.5) * 0.07 * k,
      // reference B: the branch the pods hang from is dark bark under the moss's shadow — the
      // band at frame y 0.31–0.36 reads 0.34–0.39 WITH the pods in it, so the bark itself sits
      // near 0.3; it is the pods, not the bough, that light the band
      color: (t, ang) => shadedColor(t, ang, 0.75),
      capEnd: true,
      capStart: true,
    });
    supportParts.push(mossOnTop(bough, [0.42, 0.9, 0.3], 0.45, noise));
    // small ferns and a leaf sprig ride on the bough, vines trail from it beside the pods
    for (const t of [0.18, 0.5, 0.82]) {
      const p = boughCurve.getPointAt(t);
      const nrm = new Vector3(0, 1, 0);
      p.y += boughR(lerp(boughA0, boughA1, t)) * 0.8;
      foliage.addTuft(p, nrm, 0.3 * sk, 1, 0.06, [0.6, 0.62, 0.4]);
    }
    for (const t of [0.08, 0.36, 0.64, 0.9]) {
      const p = boughCurve.getPointAt(t);
      p.y -= boughR(lerp(boughA0, boughA1, t)) * 0.8;
      foliage.addHangingVine(p.add(jit(0.1)), (0.35 + branchRng() * 0.5) * k, { amount: 0.1 });
    }
  }
  // broken stub: a splintered limb of the old trunk poking out through the moss on the cap's
  // left shoulder and leaning left-down over the eave (reference B: the sunlit limb at
  // (0.60–0.68, 0.20–0.32) beside the dome's left edge, splintered end)
  {
    const stubPts = [
      frame.at(-1.4, 2.9 * k, lipTop + 1.3 * k),
      frame.at(-1.5, 4.3 * k, lipTop + 0.7 * k).add(jit(0.1)),
      frame.at(-1.55, 5.3 * k, eaveY + 0.6 * k).add(jit(0.1)),
    ];
    const stubCurve = new CatmullRomCurve3(stubPts, false, 'catmullrom', 0.5);
    const stubR = (t: number) => (0.34 - 0.12 * t) * k * (1 + 0.08 * Math.sin(t * 9 + 2));
    const stub = sweepTube(stubCurve, {
      radius: stubR,
      tubularSegments: 14,
      radialSegments: 11,
      uvMetres: 1.2,
      // deep longitudinal ridges; the broken end flares a little and is jagged
      displace: (t, ang, pos) => (noise.ridged(ang * 1.6 + 7, pos.y * 1.5 + t * 2, 2) - 0.5) * 0.09 * k + smoothstep(0.85, 1, t) * (0.05 + 0.08 * Math.abs(Math.sin(ang * 5 + 1))) * k,
      color: (t, ang) => (t > 0.985 ? [0.2, 0.16, 0.12] : supportColor(t, ang)),
      capEnd: true,
    });
    supportParts.push(mossOnTop(stub, mossTint, 0.6, noise));
    for (let i = 0; i < 2; i++) {
      const t = 0.35 + i * 0.35;
      const p = stubCurve.getPointAt(t);
      p.y -= stubR(t) * 0.85;
      foliage.addHangingVine(p.add(jit(0.15)), (0.5 + branchRng() * 0.6) * k, { amount: 0.1 });
    }
  }
  // ---- right limb: the stump's surviving bough in pale bark, rising off the right shoulder and
  // leaning out to the right (frame B: it climbs behind the HUD box toward the top-right corner;
  // from the stairs (A) it stands against bright haze, so it stays lit and stops short of the
  // top of that frame) ----
  const rightPts = [
    frame.at(0.6, capR(0.6) - 1.0 * k, lipTop - 0.1 * k),
    frame.at(0.72, capR(0.72) + 0.1 * k, lipTop + 0.9 * k),
    frame.at(0.85, capR(0.85) + 0.75 * k, lipTop + 1.9 * k),
    frame.at(0.95, capR(0.95) + 1.3 * k, lipTop + 2.6 * k),
  ];
  for (let i = 1; i < rightPts.length; i++) rightPts[i].add(new Vector3((branchRng() - 0.5) * 0.16, (branchRng() - 0.5) * 0.1, (branchRng() - 0.5) * 0.16));
  const rightCurve = new CatmullRomCurve3(rightPts, false, 'catmullrom', 0.5);
  branchParts.push(
    sweepTube(rightCurve, {
      radius: (t) => (0.42 - 0.2 * t) * k * (1 + 0.08 * Math.sin(t * 8 + 1) + 0.05 * Math.sin(t * 21)),
      tubularSegments: 28,
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
    const mid = rightCurve.getPointAt(0.4);
    mid.y -= 0.3 * k;
    foliage.addHangingVine(mid, (0.6 + branchRng() * 0.6) * k, { amount: 0.1 });
  }
  const supportMesh = new Mesh(merge(supportParts), mats.bark);
  supportMesh.name = 'support-boughs';
  supportMesh.castShadow = supportMesh.receiveShadow = true;
  group.add(supportMesh);
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
    // the front face stays a clean moss dome (see the clump shroud below)
    if (vineRng() < 0.85 * smoothstep(1.3, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.18, 0.32, v)) continue;
    const p = surfacePoint(a, v, -0.03);
    const n = domeNormal(a, v);
    const fern = vineRng() < 0.35;
    const low = lerp(0.6, 1, smoothstep(0.1, 0.4, v));
    foliage.addTuft(p, n, (fern ? 0.5 : 0.34) * (0.8 + vineRng() * 0.5) * sk * low, fern ? 1 : 0, 0.05, roofShade);
  }
  // ---- leaf-cluster shroud: the cap is a mass of overlapping leaf clumps (reference B: lit
  // yellow-olive tops, dark shaded undersides), so the moss shell only shows through between
  // them. Tints run from deep grey-olive in the hollows to yellow-olive on the lit clumps; the
  // front face over the porch is thinned hard — frame B sees it as a smooth, sunlit moss dome
  // (reference 14 s), so the clumps mass on the crown, the shoulders and the back.
  const clumpRng = rng.fork('clumps');
  const clumpCount = Math.round(140 * k * k);
  // olive greens, deeper in the hollows (reference roof hue ≈ 50°, sat ≈ 0.33)
  const tints: [number, number, number][] = [
    [0.24, 0.32, 0.09],
    [0.44, 0.52, 0.14],
    [0.72, 0.72, 0.2],
    [1.0, 0.94, 0.3],
  ];
  for (let i = 0; i < clumpCount; i++) {
    const a = clumpRng() * TAU;
    const v = 0.04 + Math.pow(clumpRng(), 0.8) * 0.74;
    const frontFace = smoothstep(1.3, 0.6, Math.abs(angleDiff(a, 0))) * smoothstep(0.18, 0.32, v);
    if (clumpRng() < 0.9 * frontFace) continue;
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
  // ---- small plants growing in the moss (sheet 04 "moss-covered roof with plants"): broad
  // upright leaves in little rosettes and young fern fronds scattered over the shoulders and
  // crown — kept off the front lip so the eave line and the doorway stay clear ----
  const plantRng = rng.fork('plants');
  const plantCount = def.id === 'saria' ? 16 : 9;
  for (let i = 0; i < plantCount; i++) {
    const a = plantRng() * TAU;
    const v = 0.08 + plantRng() * 0.62;
    if (Math.abs(angleDiff(a, 0)) < 0.5 && v > 0.45) continue;
    const p = surfacePoint(a, v, 0.02);
    const n = domeNormal(a, v);
    if (plantRng() < 0.55) {
      // rosette of 5–8 broad leaves standing up and fanning out
      const leaves = 5 + Math.floor(plantRng() * 4);
      const size = (0.3 + plantRng() * 0.16) * sk;
      const yaw0 = plantRng() * TAU;
      const tint: [number, number, number] = [0.42 + plantRng() * 0.1, 0.58 + plantRng() * 0.1, 0.24];
      for (let j = 0; j < leaves; j++) {
        const yaw = yaw0 + (j / leaves) * TAU + (plantRng() - 0.5) * 0.5;
        const dir = new Vector3(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(0.55).addScaledVector(n, 0.9).normalize();
        foliage.addLeaf(p.clone().addScaledVector(n, 0.02), dir, size * (0.85 + plantRng() * 0.3), plantRng() * Math.PI * 2, 0.06, tint);
      }
    } else {
      n.y += 0.7;
      n.normalize();
      foliage.addTuft(p, n, (0.45 + plantRng() * 0.25) * sk, 1, 0.06, [0.62, 0.7, 0.42]);
    }
  }

  // ---- pod lanterns on cords under the eave ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('lanterns');
  const specs = LANTERNS[def.id] ?? LANTERNS.upper;
  const podPositions: Vector3[] = [];
  let limeCount = 0;
  for (const spec of specs.slice(0, Math.max(def.lanterns, specs.length))) {
    let hook: Vector3;
    if (spec.hook === 'bough') {
      // tied round the eave bough: the cord knot sits on its underside
      hook = boughAt(spec.a);
      hook.y -= boughR(spec.a) * 0.9;
      hook.addScaledVector(frame.dir(spec.a), -0.04 * k);
    } else if (spec.hook === 'eave') {
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
    // sit the shared glow below the pods' bellies (they light downward: the reference spills
    // warm light on the threshold and sign, and the branch they hang from stays dark)
    c.y -= 0.28 * k;
    // the shared glow takes on the mix of pod colours
    const glow = new Color(ctx.config.palette.lanternGlow).lerp(new Color(0xd2ee48), limeCount / podPositions.length);
    const lanternLight = new PointLight(glow, 6.5, 6, 2);
    lanternLight.position.copy(c);
    lanternLight.name = 'lantern-light';
    group.add(lanternLight);
    lights.push(lanternLight);
  }

  for (const m of foliage.build(mats, `house-${def.id}`)) group.add(m);

  // draped limbs + arc bough + eave bough + broken stub + right limb + chimney
  return { group, bases, lanterns, lights, materials, roots: rootCount, branches: branchDefs.length + 5, leaves: foliage.leafCount };
}
