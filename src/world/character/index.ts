/**
 * CHARACTER SYSTEM (Phase 2) — Young Link, Navi and the Kokiri kids (rubric C01–C05).
 *
 * Registered last in `SYSTEMS` so it can read the terrain and the sun. Three modes:
 *   view  — under capture (or the free camera parked on a layout viewpoint) `onCameraMove`
 *           recognises the viewpoint and stands Link, Navi and the kids where the reference frame
 *           has them (placement.ts: ray through the reference feet position → terrain);
 *   free  — any other camera: Link idles at `npcSpots.link-spawn`, kids at their layout spots;
 *   play  — the follow camera (src/camera/follow.ts) drives Link through `scene.userData.player`.
 *
 * Link is Astra's skinned GLB (glbLink.ts) when it loads and validates — `create()` awaits the
 * load so `__ZR__.ready()` only resolves with the model in — and the procedural rig (link.ts)
 * otherwise or with `?link=proc`; the audit says which (`linkSource`). Kids and Navi stay
 * procedural. Every puppet's pose is a pure function of the simulation time (puppet.ts), feet are
 * planted on the heightfield every frame — per foot with a two-bone leg IK for the GLB (glbLink.ts),
 * a whole-rig drop for the procedural rigs — and the audit reports the planted sole positions
 * (`samplePositions.feet`), both soles' gaps (`linkFeetContact`), the planting (`linkIk`) and the
 * GLB's blink (`blink*`: blink.ts — inert, `blinkMorphs` 0, on an asset without the morphs).
 */
import { Group, MathUtils, Mesh, Object3D, PerspectiveCamera, Vector3, type Camera } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { GAIT_SPEED, GAITS, HERO_PHASE, PLAYER_ACCEL, PLAYER_DECEL, PLAYER_SPEED, type Gait } from './animation';
import { createGround } from './ground';
import { createKokiri } from './kokiri';
import { createNpcs } from './npc';
import { createLink } from './link';
import { createNavi, naviHoverAnchor, TRAIL_COUNT } from './navi';
import { headingOf, marchToGround, matchViewpoint, NPC_SOUTH_BANK, pointAtDepth, projectPoint, VIEW_TABLE, type CamPose, type V3 } from './placement';
import { PLAYER_KEY, type PlayerHandle, type PlayerInput } from './player';
import { createContactShadow } from './shadow';
import { consolidateRigParts } from './consolidate';
import { createLocomotion, proceduralPuppet, type Locomotion, type Puppet } from './puppet';
import { hardChain, switchGait, type GaitChain, type SwitchHooks } from './gaitChain';
import { JUMP_CROUCH_S, JUMP_LAND_S, LINK_GLB_FILE, loadGlbLink, type LinkAssetInfo } from './glbLink';

/**
 * The jump (round 47, the owner's "run faster and even jump, like Zelda"): a take-off crouch of
 * JUMP_CROUCH_S with the feet planted, then a ballistic arc under JUMP_G that peaks JUMP_APEX_WALK_M
 * above the ground from a walk and JUMP_APEX_RUN_M from a full run (≈ 0.55 s airborne; the apex
 * follows the take-off speed between them), carrying the take-off velocity — no steering in the
 * air, no crossing a `blocked()` pad, no landing on ground above the arc — and a landing
 * compression of JUMP_LAND_S. Touchdown is where the arc meets the walkable ground under the root.
 */
const JUMP_G = 26;
const JUMP_APEX_WALK_M = 0.6;
const JUMP_APEX_RUN_M = 1.0;
import { BLINK_S, isTimeJump } from './blink';

type Mode = 'view' | 'free' | 'play';

/** an actor carries its gait chain (gaitChain.ts: the gait, the ones fading out, switch times, clip shifts, idle anchors) */
interface Actor extends GaitChain {
  puppet: Puppet;
  pos: Vector3;
  yaw: number;
  phase: number;
  idleTurn: number;
  look: number;
  /** planted sole contact point (world), refreshed every frame */
  contact: Vector3;
  /** soft contact-shadow decal laid on the ground under the feet */
  shadow: Mesh;
  shadowRadius: number;
}

/** kokiri-a (wander), kokiri-b (seat), the boy at Saria's door, kokiri-ledge (round 48: the stand on the raised ledge), kokiri-south-bank (round 50: the stand on the south bank) */
const KID_COUNT = 5;

type LinkSource = 'glb' | 'procedural';

/** a `?link=<file>` override names a sibling of the runtime GLB in public/models/link/ (a plain file name, nothing else) */
const LINK_FILE_OVERRIDE = /^[\w-]+\.glb$/;

/**
 * Astra's GLB unless `?link=proc` or the load / validation fails (then the procedural rig, with
 * the reason). `?link=<name>.glb` loads that file from public/models/link/ instead of the runtime
 * asset — a local review hook for a candidate export (round 8: the blink morphs), never set by
 * the harness; the audit reports the file it loaded.
 */
async function createLinkPuppet(blinkSeed: string): Promise<{ puppet: Puppet; source: LinkSource; asset: LinkAssetInfo | null; reason: string | null }> {
  const param = new URLSearchParams(location.search).get('link');
  if (param !== 'proc') {
    const file = param && LINK_FILE_OVERRIDE.test(param) ? `${LINK_GLB_FILE.slice(0, LINK_GLB_FILE.lastIndexOf('/') + 1)}${param}` : LINK_GLB_FILE;
    try {
      const glb = await loadGlbLink(`${import.meta.env.BASE_URL}${file}`, { file, blinkSeed });
      return { puppet: glb, source: 'glb', asset: glb.asset, reason: null };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.info(`[character] GLB Link unavailable (${reason}) — procedural fallback`);
      return { puppet: proceduralPuppet(createLink(), GAITS), source: 'procedural', asset: null, reason };
    }
  }
  return { puppet: proceduralPuppet(createLink(), GAITS), source: 'procedural', asset: null, reason: 'forced by ?link=proc' };
}

export async function create(ctx: WorldContext): Promise<WorldSystem> {
  const group = new Group();
  group.name = 'character';
  const ground = createGround(ctx.terrain, ctx.layout, ctx.shared);
  // the hardscape is built before this system, so the rendered slab tops are available now
  ground.attachSurface(ctx.scene);
  const spot = (id: string): V3 => {
    const s = ctx.layout.npcSpots.find((n) => n.id === id)?.position ?? [0, 0, 0.5];
    return [s[0], s[1], s[2]];
  };
  const spawn = spot('link-spawn');

  const linkLoad = await createLinkPuppet(`${ctx.config.seed}/link-blink`);
  const link: Actor = { ...hardChain('idle'), puppet: linkLoad.puppet, pos: new Vector3(spawn[0], 0, spawn[2]), yaw: Math.PI, phase: 0, idleTurn: 0, look: 0.5, contact: new Vector3(), shadow: createContactShadow(0.36, 0.6), shadowRadius: 0.36 };
  group.add(link.puppet.group, link.shadow);

  // Owner review: keep the background cast hidden while Link's movement is refined.
  const backgroundCast = new Group();
  backgroundCast.name = 'background-characters';
  backgroundCast.visible = false;
  group.add(backgroundCast);

  // kid default spots: kokiri-a (stair-foot verge), kokiri-b (plaza west), kokiri-c beside the house door, kokiri-ledge on the raised ledge,
  // kokiri-south-bank on the south bank's terrace (round 50; placement.ts NPC_SOUTH_BANK — not a layout npcSpot, see layout.ts EXPANSION)
  const house = ctx.layout.houses[0];
  const fl = Math.hypot(house.facing[0], house.facing[1]);
  const fx = house.facing[0] / fl;
  const fz = house.facing[1] / fl;
  const doorKid: V3 = [house.position[0] + fx * (house.trunkRadius + 1.0) + fz * 1.3, 0, house.position[2] + fz * (house.trunkRadius + 1.0) - fx * 1.3];
  const kidSpots: V3[] = [spot('kokiri-a'), spot('kokiri-b'), doorKid, spot('kokiri-ledge'), [NPC_SOUTH_BANK.x, 0, NPC_SOUTH_BANK.z]];
  const kids: Actor[] = [];
  const kidChars: ReturnType<typeof createKokiri>[] = [];
  for (let i = 0; i < KID_COUNT; i++) {
    const char = createKokiri(i);
    kidChars.push(char);
    const puppet = proceduralPuppet(char, GAITS);
    const shadow = createContactShadow(0.3, 0.6);
    backgroundCast.add(puppet.group, shadow);
    kids.push({ ...hardChain('idle'), puppet, pos: new Vector3(kidSpots[i][0], 0, kidSpots[i][2]), yaw: 0, phase: 1.3 + i * 2.1, idleTurn: 0.28, look: 0, contact: new Vector3(), shadow, shadowRadius: 0.32 });
  }
  // NPC behaviour (npc.ts): in free / play mode kokiri-a wanders the plaza loop, kokiri-b sits on the stairs, kokiri-ledge
  // idles on the raised ledge and kokiri-south-bank idles on the bank's terrace, each with a fairy; under capture (view mode)
  // the per-view placement above stands for the first two (only their fairies are added), the ledge girl is posed but
  // hidden (round 48) and the bank girl stays shown (round 50: outside every fixed frustum)
  const npcs = createNpcs({ chars: kidChars, ground, layout: ctx.layout, seed: `${ctx.config.seed}/npc` });
  backgroundCast.add(npcs.group);

  // draw-call budget (W38): the parts riding on one joint merge into one mesh per material — the
  // procedural rigs otherwise cost 269–311 calls with the shadow pass (consolidate.ts). Skinned
  // meshes (the GLB) are never merged.
  const rigDraws = { before: 0, after: 0, merged: 0 };
  for (const p of [link.puppet, ...kids.map((k) => k.puppet)]) {
    if (p.kind !== 'procedural') continue;
    const r = consolidateRigParts(p.group);
    rigDraws.before += r.before;
    rigDraws.after += r.after;
    rigDraws.merged += r.merged;
  }

  const navi = createNavi();
  group.add(navi.group);
  const naviAnchor = new Vector3();
  const naviPos = new Vector3();

  let mode: Mode = 'free';
  let view: string | null = null;
  let camPose: CamPose | null = null;
  /** simulation time of the previous update — only compared against the next one to recognise a clock jump */
  let lastT = NaN;
  const lastCamPos = new Vector3(NaN, NaN, NaN);
  const lastCamDir = new Vector3();
  const tmpV = new Vector3();
  const tmpD = new Vector3();

  const faceToward = (a: Actor, x: number, z: number, extraDeg = 0) => {
    a.yaw = Math.atan2(x - a.pos.x, z - a.pos.z) + MathUtils.degToRad(extraDeg);
  };
  /**
   * Hard gait switch (placement: the clips at their hero alignment) or, with `t`, a crossfade from
   * the current gait starting at t (gaitChain.ts `switchGait`): the incoming clip shifted to the
   * outgoing one's gait phase (glbLink.ts `alignClip`) so the planted foot matches across the
   * blend, the gait being left kept fading if its own crossfade is still running, an idle being
   * left anchored where its soles are now (Puppet.anchor at this actor's position and facing),
   * and a crossfade into run recording the run-start blink event (blink.ts BLINK_S envelope).
   */
  const hooksOf = (a: Actor): SwitchHooks => ({
    align: (from, fromShift, to, t) => a.puppet.alignClip?.(from, fromShift, to, t) ?? 0,
    anchor: (gait, clipShift, t) => a.puppet.anchor?.(a.pos.x, a.pos.z, a.yaw, gait, clipShift, t) ?? null,
    hasPhase: (gait) => GAIT_SPEED[gait] > 0,
    blinkS: BLINK_S,
  });
  const setGait = (a: Actor, gait: Gait, t: number | null = null) => switchGait(a, gait, t, hooksOf(a));

  const poseOf = (camera: Camera): CamPose => {
    camera.getWorldPosition(tmpV);
    camera.getWorldDirection(tmpD);
    const pc = camera as PerspectiveCamera;
    return { position: [tmpV.x, tmpV.y, tmpV.z], forward: [tmpD.x, tmpD.y, tmpD.z], fov: pc.fov ?? 46, aspect: pc.aspect ?? 16 / 9 };
  };

  /** Free-camera defaults: Link at the spawn facing the house path, kids on their spots looking at the plaza. */
  const placeFree = () => {
    link.pos.set(spawn[0], 0, spawn[2]);
    link.yaw = Math.PI;
    setGait(link, 'idle');
    link.phase = 0;
    link.look = 0.5;
    for (let i = 0; i < kids.length; i++) {
      kids[i].pos.set(kidSpots[i][0], 0, kidSpots[i][2]);
      faceToward(kids[i], spawn[0], spawn[2]);
    }
    // round 50: above and to his left like the girls' fairies (navi.ts NAVI_HOVER); the head centre ≈ 1.05 m over the ground
    naviHoverAnchor(link.pos.x, ground.height(link.pos.x, link.pos.z) + 1.05, link.pos.z, link.yaw, naviAnchor);
  };

  /** Reference composition for a recognised viewpoint. */
  const placeView = (id: string, cam: CamPose) => {
    const vp = VIEW_TABLE[id];
    const heading = headingOf(cam.forward);
    const feet = marchToGround(cam, vp.feet[0], vp.feet[1], ground.height, { maxDist: 30 }) ?? pointAtDepth(cam, vp.feet[0], 0.5, 4.5);
    link.pos.set(feet[0], 0, feet[2]);
    link.yaw = (vp.facing === 'away' ? heading : heading + Math.PI) + MathUtils.degToRad(vp.yawDeg);
    setGait(link, vp.gait);
    link.phase = HERO_PHASE[vp.gait];
    link.look = vp.look;
    // Navi at Link's head depth on the ray through her reference screen spot
    const f = cam.forward;
    const headDepth = (feet[0] - cam.position[0]) * f[0] + (ground.height(feet[0], feet[2]) + 1.0 - cam.position[1]) * f[1] + (feet[2] - cam.position[2]) * f[2];
    const n = pointAtDepth(cam, vp.navi[0], vp.navi[1], headDepth);
    naviAnchor.set(n[0], n[1], n[2]);
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const kp = vp.kids.find((c) => c.slot === i);
      let p: V3 = kidSpots[i];
      if (kp?.screen) p = marchToGround(cam, kp.screen[0], kp.screen[1], ground.height, { maxDist: 30 }) ?? p;
      k.pos.set(p[0], 0, p[2]);
      faceToward(k, link.pos.x, link.pos.z, kp?.yawDeg ?? 0);
    }
  };

  const placeForCamera = (camera: Camera) => {
    if (mode === 'play') return;
    camPose = poseOf(camera);
    lastCamPos.set(camPose.position[0], camPose.position[1], camPose.position[2]);
    lastCamDir.set(camPose.forward[0], camPose.forward[1], camPose.forward[2]);
    view = matchViewpoint(camPose.position, camPose.forward, ctx.layout.viewpoints);
    if (view && VIEW_TABLE[view]) {
      mode = 'view';
      placeView(view, camPose);
    } else {
      mode = 'free';
      view = null;
      placeFree();
    }
  };

  // ---- play mode (walkable build) ----
  const input: PlayerInput = { moveX: 0, moveZ: 0, run: false, jump: false };
  const velocity = new Vector3();
  /**
   * Round 47 — the player's locomotion state (puppet.ts Locomotion): the ground speed the root
   * accelerates / brakes with (PLAYER_ACCEL / PLAYER_DECEL toward PLAYER_SPEED of the gait), the
   * direction it last moved in (a release brakes along it), the stance pins and the jump. The
   * clips are advanced by the ground actually covered each step (Puppet.advance), so the feet
   * never slide whatever the speed; the pose reads the pins and the jump through PuppetPose.loco.
   * Recreated when play mode is entered and on a simulation-clock jump.
   */
  let loco: Locomotion = createLocomotion();
  let speed = 0;
  const moveDir = new Vector3(0, 0, -1);
  let jumpHeld = false;
  /** Navi's eased lead (m) and whether her play-mode anchor has been placed since the last reset */
  let naviLead = 0;
  let naviInit = false;
  const naviGoal = new Vector3();
  const resetLocomotion = () => {
    loco = createLocomotion();
    speed = 0;
    jumpHeld = false;
    velocity.set(0, 0, 0);
    naviLead = 0;
    naviInit = false;
  };
  const player: PlayerHandle = {
    position: link.pos,
    heading: () => link.yaw,
    airHeight: () => (loco.jump?.phase === 'air' ? Math.max(0, loco.jump.y - ground.height(link.pos.x, link.pos.z)) : 0),
    setPlayMode(on) {
      if (on) {
        // start the walk at the spawn with the kids on their layout spots
        placeFree();
        mode = 'play';
        view = null;
        camPose = null;
        resetLocomotion();
      } else {
        mode = 'free';
        lastCamPos.set(NaN, NaN, NaN);
        placeForCamera(ctx.camera);
      }
    },
    playMode: () => mode === 'play',
    setInput(i) {
      input.moveX = i.moveX;
      input.moveZ = i.moveZ;
      input.run = i.run;
      input.jump = !!i.jump;
    },
    feetContact: () => link.puppet.feetContact().map((f) => ({ gapM: f.gapM, minShoeGapM: f.minShoeGapM, stance: f.stance })),
  };
  ctx.scene.userData[PLAYER_KEY] = player;

  /** move the root by (dx, dz) if the step is walkable (no structure pad, no riser above the 0.55 m step guard); returns the distance moved */
  const moveRoot = (dx: number, dz: number, dt: number): number => {
    const nx = link.pos.x + dx;
    const nz = link.pos.z + dz;
    const h0 = ground.height(link.pos.x, link.pos.z);
    const h1 = ground.height(nx, nz);
    if (h1 - h0 < 0.55 && !ground.blocked(nx, nz)) {
      velocity.set(dx / Math.max(dt, 1e-4), 0, dz / Math.max(dt, 1e-4));
      link.pos.set(nx, 0, nz);
      return Math.hypot(dx, dz);
    }
    velocity.set(0, 0, 0);
    return 0;
  };

  const stepPlayer = (dt: number, t: number) => {
    const mag = Math.min(1, Math.hypot(input.moveX, input.moveZ));
    const onStairs = ground.onStairs(link.pos.x, link.pos.z);
    const j = loco.jump;
    // a jump starts on the press (never repeats while held) from the ground, crouch first
    if (input.jump && !jumpHeld && !j) loco.jump = { phase: 'crouch', t0: t, y0: 0, y: 0, v0: 0, vx: 0, vz: 0, vLand: 0, flightS: 0, air: 0 };
    jumpHeld = !!input.jump;
    let ds = 0;
    if (j && j.phase === 'air') {
      // ballistic: the take-off velocity carried, gravity on the root; the arc meets the ground.
      // A pad, or ground above the arc, stops the horizontal motion; the arc goes on.
      j.v0 -= JUMP_G * dt;
      j.y += j.v0 * dt;
      if (j.vx !== 0 || j.vz !== 0) {
        const nx = link.pos.x + j.vx * dt;
        const nz = link.pos.z + j.vz * dt;
        if (!ground.blocked(nx, nz) && ground.height(nx, nz) <= j.y + 0.05) {
          link.pos.set(nx, 0, nz);
          velocity.set(j.vx, 0, j.vz);
        } else {
          j.vx = 0;
          j.vz = 0;
          velocity.set(0, 0, 0);
        }
      }
      const g = ground.height(link.pos.x, link.pos.z);
      j.air = MathUtils.clamp((t - j.t0) / Math.max(1e-3, j.flightS), 0, 1);
      if (j.y <= g && j.v0 < 0) {
        j.y = g;
        j.phase = 'land';
        j.t0 = t;
        j.vLand = -j.v0;
        j.air = 1;
      }
      // the gait is frozen in the air: nothing advances it (ds 0 cancels the clock)
    } else {
      if (j && j.phase === 'land' && t - j.t0 >= JUMP_LAND_S) loco.jump = null;
      if (mag > 0.05) {
        const target = Math.atan2(input.moveX, input.moveZ);
        let d = target - link.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        link.yaw += MathUtils.clamp(d, -dt * 9, dt * 9);
        setGait(link, onStairs ? 'stairs' : input.run ? 'run' : 'walk', t);
        moveDir.set(input.moveX / mag, 0, input.moveZ / mag);
        const want = PLAYER_SPEED[link.gait] * mag;
        speed += MathUtils.clamp(want - speed, -PLAYER_DECEL * dt, PLAYER_ACCEL * dt);
      } else {
        setGait(link, 'idle', t);
        // a release brakes along the last direction; the stance pins hold the feet meanwhile
        speed = Math.max(0, speed - PLAYER_DECEL * dt);
      }
      if (speed > 1e-4) {
        ds = moveRoot(moveDir.x * speed * dt, moveDir.z * speed * dt, dt);
        if (ds === 0) speed = 0;
      } else velocity.set(0, 0, 0);
      if (j && j.phase === 'crouch' && t - j.t0 >= JUMP_CROUCH_S) {
        // take-off: from the crouched root, to an apex that follows the take-off speed
        const g = ground.height(link.pos.x, link.pos.z);
        const rootY = link.puppet.group.position.y;
        const apex = MathUtils.lerp(JUMP_APEX_WALK_M, JUMP_APEX_RUN_M, MathUtils.clamp((speed - PLAYER_SPEED.walk) / (PLAYER_SPEED.run - PLAYER_SPEED.walk), 0, 1));
        const rise = Math.max(0.05, g + apex - rootY);
        j.phase = 'air';
        j.t0 = t;
        j.y0 = rootY;
        j.y = rootY;
        j.v0 = Math.sqrt(2 * JUMP_G * rise);
        j.vx = velocity.x;
        j.vz = velocity.z;
        // the expected flight time back to the take-off ground level, for the overlay's arc fraction
        j.flightS = (j.v0 + Math.sqrt(Math.max(0, j.v0 * j.v0 - 2 * JUMP_G * (g - rootY)))) / JUMP_G;
        j.air = 0;
        loco.pinX[0] = loco.pinX[1] = NaN;
        loco.pinZ[0] = loco.pinZ[1] = NaN;
        loco.pinFadeT[0] = loco.pinFadeT[1] = NaN;
      }
    }
    // the clips follow the ground covered (Puppet.advance), the pose reads the step
    link.puppet.advance?.(link, t, ds, dt);
    loco.speed = ds / Math.max(dt, 1e-4);
    // Navi hovers by the head, leading when Link moves. Opus 2026-09-25 (owner: his head turned
    // slowly right → left, then snapped to the right): her world-space orbit used to carry her
    // through his back every 12.6 s and the lead jumped 0.7 m at 0.2 m/s. The lead now eases with
    // the speed, the orbit swings about his front-left (never behind him) and the anchor is
    // low-passed, so the look target is continuous.
    const leadTarget = 0.7 * MathUtils.smoothstep(velocity.length(), 0.1, 0.8);
    naviLead += (leadTarget - naviLead) * (1 - Math.exp(-dt / 0.35));
    const orbit = link.yaw + 0.5 + 0.9 * Math.sin(t * 0.5);
    naviGoal.set(
      link.pos.x + 0.45 * Math.sin(orbit) + Math.sin(link.yaw) * naviLead,
      ground.height(link.pos.x, link.pos.z) + 1.4 + 0.05 * Math.sin(t * 0.8),
      link.pos.z + 0.45 * Math.cos(orbit) + Math.cos(link.yaw) * naviLead,
    );
    if (!naviInit) {
      naviAnchor.copy(naviGoal);
      naviInit = true;
    } else naviAnchor.lerp(naviGoal, 1 - Math.exp(-dt / 0.25));
  };

  const poseActor = (a: Actor, t: number, look: Vector3 | null) => {
    // the player's locomotion state reaches the puppet in play mode only (round 47) — never a capture's pose
    const l = a === link && mode === 'play' ? loco : null;
    a.puppet.pose(a.pos.x, a.pos.z, a.yaw, { t, phase: a.phase, look, lookWeight: a.look, idleTurn: a.idleTurn, gait: a.gait, gaitFrom: a.gaitFrom, gaitSwitchT: a.gaitSwitchT, clipShift: a.clipShift, clipShiftFrom: a.clipShiftFrom, gaitFrom2: a.gaitFrom2, gaitSwitchT2: a.gaitSwitchT2, clipShiftFrom2: a.clipShiftFrom2, anchorFrom: a.anchorFrom, anchorFrom2: a.anchorFrom2, runBlinkT: a.runBlinkT, loco: l }, ground.height, a.contact, ground.surface);
    // contact shadow just above the ground under the body centre
    a.shadow.position.set(a.pos.x, ground.decalHeight(a.pos.x, a.pos.z, a.shadowRadius), a.pos.z);
  };

  const feetOf = (a: Actor): V3 => [a.contact.x, a.contact.y, a.contact.z];
  /** the POSED root: the placement moved by the planting's root shift (the puppet group's position after `pose`) */
  const rootOf = (a: Actor): V3 => {
    const p = a.puppet.group.position;
    return [p.x, p.y, p.z];
  };
  /** the ground height the actor is placed at (the root before the planting's shift) */
  const placementYOf = (a: Actor): number => ground.height(a.pos.x, a.pos.z);
  const headOf = (a: Actor): V3 => {
    a.puppet.headTop(tmpV);
    return [tmpV.x, tmpV.y, tmpV.z];
  };
  const countTriangles = () => {
    let tris = 0;
    group.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const g = m.geometry;
      const idx = g.index ? g.index.count : g.attributes.position?.count ?? 0;
      tris += Math.floor(idx / 3);
    });
    return tris;
  };

  placeFree();
  ctx.audit('character', () => {
    const cam = mode !== 'play' && camPose ? camPose : poseOf(ctx.camera);
    const proj = (p: V3) => {
      const r = projectPoint(cam, p);
      return r ? [Number(r[0].toFixed(3)), Number(r[1].toFixed(3))] : null;
    };
    return {
      link: true,
      /** 'glb' = Astra's skinned candidate (public/models/link), 'procedural' = link.ts (with the reason) */
      linkSource: linkLoad.source,
      linkAsset: linkLoad.asset,
      linkFallbackReason: linkLoad.reason,
      animations: link.puppet.animations.length,
      animationNames: [...link.puppet.animations],
      fairy: true,
      fairyTrail: TRAIL_COUNT,
      npcs: kids.length,
      npcsVisible: backgroundCast.visible ? kids.length : 0,
      ...npcs.audit(),
      geometry: linkLoad.source === 'glb' ? 'glb-link+procedural-npcs-v1' : 'procedural-v1',
      triangles: countTriangles(),
      linkTriangles: link.puppet.triangles,
      linkHeight: link.puppet.height,
      /** rig meshes before / after the per-joint merge (consolidate.ts), and the merged meshes made */
      rigMeshesBeforeMerge: rigDraws.before,
      rigMeshes: rigDraws.after,
      rigMergedMeshes: rigDraws.merged,
      mode,
      view,
      linkGait: link.gait,
      /**
       * both soles of the current pose: world height, the exact ground under its contact point, signed gap (m), the support the IK
       * planted it on (differs from groundY only within a few cm of a tread nosing), and the smallest gap over the boot's real
       * footprint (heel / toe corners, measured on the mesh at load) to the rendered surface — negative = a shoe point inside the stone;
       * `pinM` the along-facing pin holding a fading idle clip's foot where it stood, `holdM` the raise keeping the sole's lowest point on its support;
       * round 47: `soleX/Z` the sole's world x/z, `stance` whether the clips' contact windows call the foot a stance foot, `pinLatM` the lateral part of a stance pin
       */
      linkFeetContact: link.puppet.feetContact().map((f) => ({ foot: f.foot, soleY: Number(f.soleY.toFixed(4)), groundY: Number(f.groundY.toFixed(4)), gapM: Number(f.gapM.toFixed(4)), supportY: Number(f.supportY.toFixed(4)), minShoeGapM: Number(f.minShoeGapM.toFixed(4)), shiftM: Number(f.shiftM.toFixed(4)), pitchRad: Number(f.pitchRad.toFixed(4)), correctionM: Number(f.correctionM.toFixed(4)), pinM: Number(f.pinM.toFixed(4)), holdM: Number(f.holdM.toFixed(4)), soleX: Number(f.soleX.toFixed(4)), soleZ: Number(f.soleZ.toFixed(4)), stance: f.stance, pinLatM: Number(f.pinLatM.toFixed(4)) })),
      /** how the feet were planted: 'two-bone' leg IK (GLB) or the whole-rig 'root-drop' (procedural); the along-facing shift given a foot to clear a nosing lip; a leg clamped at its reach and by how much; the clips with weight in the gait blend */
      linkIk: (() => {
        const i = link.puppet.plantInfo();
        return { mode: i.mode, maxCorrectionM: Number(i.maxCorrectionM.toFixed(4)), rootShiftM: Number(i.rootShiftM.toFixed(4)), maxShiftM: Number(i.maxShiftM.toFixed(4)), planted: i.planted, reachClamped: i.reachClamped, reachClampedLeg: i.reachClampedLeg, reachExcessM: Number(i.reachExcessM.toFixed(4)), extraDropM: Number(i.extraDropM.toFixed(4)), attackDropM: Number(i.attackDropM.toFixed(4)), maxPinM: Number(i.maxPinM.toFixed(4)), maxHoldM: Number(i.maxHoldM.toFixed(4)), blendClips: i.blendClips, hipClampRad: Number(i.hipClampRad.toFixed(4)), kneeOutRad: Number(i.kneeOutRad.toFixed(4)) };
      })(),
      /** the play-mode gait chain: the gait, the one it is fading from and the one before that (puppet.ts PuppetPose) */
      linkGaitChain: [link.gait, link.gaitFrom, link.gaitFrom2],
      /**
       * the play-mode locomotion (round 47; null outside play): the ground speed of the last step, the clip shifts the ground
       * distance drove, the stance pins (world x/z per foot, null = free) and the jump (phase, arc fraction, root height)
       */
      linkLocomotion:
        mode === 'play'
          ? {
              speed: Number(loco.speed.toFixed(3)),
              clipShift: [Number(link.clipShift.toFixed(4)), Number(link.clipShiftFrom.toFixed(4)), Number(link.clipShiftFrom2.toFixed(4))],
              pins: [0, 1].map((i) => (Number.isFinite(loco.pinX[i]) ? [Number(loco.pinX[i].toFixed(4)), Number(loco.pinZ[i].toFixed(4))] : null)),
              jump: loco.jump ? loco.jump.phase : 'ground',
              jumpAir: loco.jump ? Number(loco.jump.air.toFixed(3)) : 0,
              jumpY: loco.jump ? Number(loco.jump.y.toFixed(4)) : null,
              airHeight: Number(player.airHeight().toFixed(4)),
            }
          : null,
      /**
       * the blink (blink.ts, Astra's morph contract): meshes carrying the `blink` / `blinkHalf` morphs (0 = inert drive),
       * the closure phase p of this pose and the weights set from it, the weights read back from the first morph mesh,
       * the start of the next scheduled blink (sim s), the run-start event's start the pose read (null = none; gaitChain.ts
       * `runBlinkT`, one-shot, outlives the run) and the schedule's seed / hash / slot parameters
       */
      ...(() => {
        const b = link.puppet.blink?.() ?? null;
        return {
          blinkMorphs: b?.morphMeshes ?? 0,
          blinkPhase: b ? Number(b.phase.toFixed(4)) : 0,
          blinkWeights: b ? { blink: Number(b.weights.blink.toFixed(4)), blinkHalf: Number(b.weights.blinkHalf.toFixed(4)) } : null,
          blinkApplied: b?.applied ? { blink: Number(b.applied.blink.toFixed(4)), blinkHalf: Number(b.applied.blinkHalf.toFixed(4)) } : null,
          blinkNextT: b ? Number(b.nextT.toFixed(4)) : null,
          blinkRunT: b && Number.isFinite(b.runT) ? Number(b.runT.toFixed(4)) : null,
          blinkSchedule: b ? { ...b.schedule } : null,
        };
      })(),
      samplePositions: { feet: [feetOf(link), ...kids.map(feetOf)] },
      contactShadows: 1 + (backgroundCast.visible ? kids.length : 0),
      pavingSurface: ground.surfaceInfo(),
      /** `linkRoot` is the POSED root (placement + the planting's root shift, i.e. the rendered rig's origin); `linkPlacementY` the ground height it was placed at */
      world: { link: feetOf(link), linkRoot: rootOf(link), linkPlacementY: Number(placementYOf(link).toFixed(4)), navi: [naviAnchor.x, naviAnchor.y, naviAnchor.z], kids: kids.map(feetOf) },
      screen: {
        /** planted sole contact (the lower foot), the posed root and the skull top */
        linkFeet: proj(feetOf(link)),
        linkRoot: proj(rootOf(link)),
        linkHead: proj(headOf(link)),
        navi: proj([naviAnchor.x, naviAnchor.y, naviAnchor.z]),
        kids: kids.map((k) => ({ feet: proj(feetOf(k)), head: proj(headOf(k)) })),
      },
    };
  });

  return {
    name: 'character',
    group,
    onCameraMove(camera) {
      placeForCamera(camera);
    },
    update(dt, t, c) {
      // a zero-dt update is a re-render of the same moment (a capture's determinism pass, a
      // harness shot): nothing moves and the gait must not be re-decided from the moved position
      // a frame early — the play state is a function of the positive steps alone.
      // A simulation clock that JUMPED since the last update (a `setTime`: backwards, or more
      // than a second forward — never a step, never a zero-dt re-render) is a hard reset for the
      // run-start blink event: its envelope is anchored at a switch time and a rewound clock
      // must not replay it (blink.ts `isTimeJump`; the chain's other times are left alone — a
      // finished crossfade reads as finished at any later t, and the placement hard-switches).
      if (isTimeJump(lastT, t)) {
        for (const a of [link, ...kids]) a.runBlinkT = -Infinity;
        // the jump's timers and the arm filter are anchored in simulation time too
        if (mode === 'play') resetLocomotion();
      }
      lastT = t;
      if (mode === 'play') {
        loco.dt = dt;
        if (dt > 0) stepPlayer(dt, t);
      } else {
        // the free camera's viewpoint keys bypass onCameraMove: re-place when the camera jumps
        c.camera.getWorldPosition(tmpV);
        c.camera.getWorldDirection(tmpD);
        if (!Number.isFinite(lastCamPos.x) || tmpV.distanceToSquared(lastCamPos) > 1e-6 || tmpD.distanceToSquared(lastCamDir) > 1e-6) placeForCamera(c.camera);
      }
      navi.anchor.copy(naviAnchor);
      navi.velocity.copy(mode === 'play' ? velocity : tmpD.set(0, 0, 0));
      navi.position(t, naviPos);
      poseActor(link, t, naviPos);
      for (let i = 0; i < kids.length; i++) if (!npcs.drive(i, kids[i], t, mode === 'view')) poseActor(kids[i], t, null);
      npcs.updateFairies(t);
      navi.update(t, c.renderer.getPixelRatio());
    },
  };
}
