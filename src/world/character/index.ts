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
import { GAIT_SPEED, GAITS, HERO_PHASE, type Gait } from './animation';
import { createGround } from './ground';
import { createKokiri } from './kokiri';
import { createLink } from './link';
import { createNavi, TRAIL_COUNT } from './navi';
import { headingOf, marchToGround, matchViewpoint, pointAtDepth, projectPoint, VIEW_TABLE, type CamPose, type V3 } from './placement';
import { PLAYER_KEY, type PlayerHandle, type PlayerInput } from './player';
import { createContactShadow } from './shadow';
import { consolidateRigParts } from './consolidate';
import { proceduralPuppet, type Puppet } from './puppet';
import { hardChain, switchGait, type GaitChain, type SwitchHooks } from './gaitChain';
import { LINK_GLB_FILE, loadGlbLink, type LinkAssetInfo } from './glbLink';

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

const KID_COUNT = 3;

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
  const ground = createGround(ctx.terrain, ctx.layout);
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

  // kid default spots: kokiri-a (stair-foot verge), kokiri-b (plaza west), kokiri-c beside the house door
  const house = ctx.layout.houses[0];
  const fl = Math.hypot(house.facing[0], house.facing[1]);
  const fx = house.facing[0] / fl;
  const fz = house.facing[1] / fl;
  const doorKid: V3 = [house.position[0] + fx * (house.trunkRadius + 1.0) + fz * 1.3, 0, house.position[2] + fz * (house.trunkRadius + 1.0) - fx * 1.3];
  const kidSpots: V3[] = [spot('kokiri-a'), spot('kokiri-b'), doorKid];
  const kids: Actor[] = [];
  for (let i = 0; i < KID_COUNT; i++) {
    const puppet = proceduralPuppet(createKokiri(i), GAITS);
    const shadow = createContactShadow(0.3, 0.6);
    group.add(puppet.group, shadow);
    kids.push({ ...hardChain('idle'), puppet, pos: new Vector3(kidSpots[i][0], 0, kidSpots[i][2]), yaw: 0, phase: 1.3 + i * 2.1, idleTurn: 0.28, look: 0, contact: new Vector3(), shadow, shadowRadius: 0.32 });
  }

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
   * left anchored where its soles are now (Puppet.anchor at this actor's position and facing).
   */
  const hooksOf = (a: Actor): SwitchHooks => ({
    align: (from, fromShift, to, t) => a.puppet.alignClip?.(from, fromShift, to, t) ?? 0,
    anchor: (gait, clipShift, t) => a.puppet.anchor?.(a.pos.x, a.pos.z, a.yaw, gait, clipShift, t) ?? null,
    hasPhase: (gait) => GAIT_SPEED[gait] > 0,
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
    naviAnchor.set(link.pos.x + 0.35 * Math.sin(link.yaw + 1.2), 1.35, link.pos.z + 0.35 * Math.cos(link.yaw + 1.2));
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
  const input: PlayerInput = { moveX: 0, moveZ: 0, run: false };
  const velocity = new Vector3();
  const player: PlayerHandle = {
    position: link.pos,
    heading: () => link.yaw,
    setPlayMode(on) {
      if (on) {
        // start the walk at the spawn with the kids on their layout spots
        placeFree();
        mode = 'play';
        view = null;
        camPose = null;
        velocity.set(0, 0, 0);
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
    },
  };
  ctx.scene.userData[PLAYER_KEY] = player;

  const stepPlayer = (dt: number, t: number) => {
    const mag = Math.min(1, Math.hypot(input.moveX, input.moveZ));
    const onStairs = ground.onStairs(link.pos.x, link.pos.z);
    if (mag > 0.05) {
      const target = Math.atan2(input.moveX, input.moveZ);
      let d = target - link.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      link.yaw += MathUtils.clamp(d, -dt * 9, dt * 9);
      setGait(link, onStairs ? 'stairs' : input.run ? 'run' : 'walk', t);
      const speed = GAIT_SPEED[link.gait] * mag;
      const nx = link.pos.x + (input.moveX / mag) * speed * dt;
      const nz = link.pos.z + (input.moveZ / mag) * speed * dt;
      const h0 = ground.height(link.pos.x, link.pos.z);
      const h1 = ground.height(nx, nz);
      if (h1 - h0 < 0.55 && !ground.blocked(nx, nz)) {
        velocity.set((nx - link.pos.x) / Math.max(dt, 1e-4), 0, (nz - link.pos.z) / Math.max(dt, 1e-4));
        link.pos.set(nx, 0, nz);
      } else velocity.set(0, 0, 0);
    } else {
      setGait(link, 'idle', t);
      velocity.set(0, 0, 0);
    }
    // Navi orbits the head, leading when Link moves
    const lead = velocity.length() > 0.2 ? 0.7 : 0;
    naviAnchor.set(
      link.pos.x + 0.45 * Math.sin(t * 0.5) + Math.sin(link.yaw) * lead,
      ground.height(link.pos.x, link.pos.z) + 1.4 + 0.05 * Math.sin(t * 0.8),
      link.pos.z + 0.45 * Math.cos(t * 0.5) + Math.cos(link.yaw) * lead,
    );
  };

  const poseActor = (a: Actor, t: number, look: Vector3 | null) => {
    a.puppet.pose(a.pos.x, a.pos.z, a.yaw, { t, phase: a.phase, look, lookWeight: a.look, idleTurn: a.idleTurn, gait: a.gait, gaitFrom: a.gaitFrom, gaitSwitchT: a.gaitSwitchT, clipShift: a.clipShift, clipShiftFrom: a.clipShiftFrom, gaitFrom2: a.gaitFrom2, gaitSwitchT2: a.gaitSwitchT2, clipShiftFrom2: a.clipShiftFrom2, anchorFrom: a.anchorFrom, anchorFrom2: a.anchorFrom2 }, ground.height, a.contact, ground.surface);
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
       * `pinM` the along-facing pin holding a fading idle clip's foot where it stood, `holdM` the raise keeping the sole's lowest point on its support
       */
      linkFeetContact: link.puppet.feetContact().map((f) => ({ foot: f.foot, soleY: Number(f.soleY.toFixed(4)), groundY: Number(f.groundY.toFixed(4)), gapM: Number(f.gapM.toFixed(4)), supportY: Number(f.supportY.toFixed(4)), minShoeGapM: Number(f.minShoeGapM.toFixed(4)), shiftM: Number(f.shiftM.toFixed(4)), pitchRad: Number(f.pitchRad.toFixed(4)), correctionM: Number(f.correctionM.toFixed(4)), pinM: Number(f.pinM.toFixed(4)), holdM: Number(f.holdM.toFixed(4)) })),
      /** how the feet were planted: 'two-bone' leg IK (GLB) or the whole-rig 'root-drop' (procedural); the along-facing shift given a foot to clear a nosing lip; a leg clamped at its reach and by how much; the clips with weight in the gait blend */
      linkIk: (() => {
        const i = link.puppet.plantInfo();
        return { mode: i.mode, maxCorrectionM: Number(i.maxCorrectionM.toFixed(4)), rootShiftM: Number(i.rootShiftM.toFixed(4)), maxShiftM: Number(i.maxShiftM.toFixed(4)), planted: i.planted, reachClamped: i.reachClamped, reachClampedLeg: i.reachClampedLeg, reachExcessM: Number(i.reachExcessM.toFixed(4)), extraDropM: Number(i.extraDropM.toFixed(4)), attackDropM: Number(i.attackDropM.toFixed(4)), maxPinM: Number(i.maxPinM.toFixed(4)), maxHoldM: Number(i.maxHoldM.toFixed(4)), blendClips: i.blendClips };
      })(),
      /** the play-mode gait chain: the gait, the one it is fading from and the one before that (puppet.ts PuppetPose) */
      linkGaitChain: [link.gait, link.gaitFrom, link.gaitFrom2],
      /**
       * the blink (blink.ts, Astra's morph contract): meshes carrying the `blink` / `blinkHalf` morphs (0 = inert drive),
       * the closure phase p of this pose and the weights set from it, the weights read back from the first morph mesh,
       * the start of the next scheduled blink (sim s) and the schedule's seed / hash / slot parameters
       */
      ...(() => {
        const b = link.puppet.blink?.() ?? null;
        return {
          blinkMorphs: b?.morphMeshes ?? 0,
          blinkPhase: b ? Number(b.phase.toFixed(4)) : 0,
          blinkWeights: b ? { blink: Number(b.weights.blink.toFixed(4)), blinkHalf: Number(b.weights.blinkHalf.toFixed(4)) } : null,
          blinkApplied: b?.applied ? { blink: Number(b.applied.blink.toFixed(4)), blinkHalf: Number(b.applied.blinkHalf.toFixed(4)) } : null,
          blinkNextT: b ? Number(b.nextT.toFixed(4)) : null,
          blinkSchedule: b ? { ...b.schedule } : null,
        };
      })(),
      samplePositions: { feet: [feetOf(link), ...kids.map(feetOf)] },
      contactShadows: 1 + kids.length,
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
      // a frame early — the play state is a function of the positive steps alone
      if (mode === 'play') {
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
      for (const k of kids) poseActor(k, t, null);
      navi.update(t, c.renderer.getPixelRatio());
    },
  };
}
