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
 * Animation is a pure function of the simulation time (animation.ts), feet are planted on the
 * heightfield every frame, and the audit reports the planted sole positions (`samplePositions.feet`).
 */
import { Group, MathUtils, Mesh, Object3D, PerspectiveCamera, Vector3, type Camera } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { applyPose, GAIT_SPEED, GAITS, HERO_PHASE, plantFeet, type Gait } from './animation';
import { createGround } from './ground';
import { createLocomotion } from './locomotion';
import { createPlayPose } from './play-pose';
import { createKokiri } from './kokiri';
import { createLink, type Character } from './link';
import { createNavi, TRAIL_COUNT } from './navi';
import { headingOf, marchToGround, matchViewpoint, pointAtDepth, projectPoint, VIEW_TABLE, type CamPose, type V3 } from './placement';
import { PLAYER_KEY, type PlayerHandle, type PlayerInput } from './player';
import { createContactShadow } from './shadow';

type Mode = 'view' | 'free' | 'play';

interface Actor {
  char: Character;
  pos: Vector3;
  yaw: number;
  gait: Gait;
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

export function create(ctx: WorldContext): WorldSystem {
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

  const link: Actor = { char: createLink(), pos: new Vector3(spawn[0], 0, spawn[2]), yaw: Math.PI, gait: 'idle', phase: 0, idleTurn: 0, look: 0.5, contact: new Vector3(), shadow: createContactShadow(0.36, 0.6), shadowRadius: 0.36 };
  group.add(link.char.group, link.shadow);

  // kid default spots: kokiri-a (stair-foot verge), kokiri-b (plaza west), kokiri-c beside the house door
  const house = ctx.layout.houses[0];
  const fl = Math.hypot(house.facing[0], house.facing[1]);
  const fx = house.facing[0] / fl;
  const fz = house.facing[1] / fl;
  const doorKid: V3 = [house.position[0] + fx * (house.trunkRadius + 1.0) + fz * 1.3, 0, house.position[2] + fz * (house.trunkRadius + 1.0) - fx * 1.3];
  const kidSpots: V3[] = [spot('kokiri-a'), spot('kokiri-b'), doorKid];
  const kids: Actor[] = [];
  for (let i = 0; i < KID_COUNT; i++) {
    const char = createKokiri(i);
    const shadow = createContactShadow(0.3, 0.6);
    group.add(char.group, shadow);
    kids.push({ char, pos: new Vector3(kidSpots[i][0], 0, kidSpots[i][2]), yaw: 0, gait: 'idle', phase: 1.3 + i * 2.1, idleTurn: 0.28, look: 0, contact: new Vector3(), shadow, shadowRadius: 0.32 });
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
    link.gait = 'idle';
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
    link.gait = vp.gait;
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
  const motion = createLocomotion(ground, link.pos.x, link.pos.z, link.yaw);
  const playPose = createPlayPose(link.char.rig, ground.height);
  // Only Link fades in flight; NPC contact shadows retain their shared material.
  link.shadow.material = (link.shadow.material as import('three').Material).clone();
  const player: PlayerHandle = {
    position: link.pos,
    heading: () => link.yaw,
    setPlayMode(on) {
      input.moveX = input.moveZ = 0; input.run = false; input.jump = false;
      motion.clearInput();
      if (on) {
        // start the walk at the spawn with the kids on their layout spots
        placeFree();
        mode = 'play';
        view = null;
        camPose = null;
        velocity.set(0, 0, 0);
        motion.reset(link.pos.x, link.pos.z, link.yaw);
        link.pos.y = motion.state.y;
        playPose.reset();
        playPose.update(motion.state, 0, 0);
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
  };
  ctx.scene.userData[PLAYER_KEY] = player;

  const stepPlayer = (dt: number, t: number) => {
    const state = motion.update(dt, input, (s, step) => playPose.update(s, s.time, step));
    link.pos.set(state.x, state.y, state.z);
    link.yaw = state.yaw;
    link.gait = state.speed < 0.05 ? 'idle' : state.stairWeight > 0.5 ? 'stairs' : state.runWeight > 0.5 ? 'run' : 'walk';
    velocity.set(state.vx, state.vy, state.vz);
    // Navi orbits the head, leading when Link moves
    const lead = velocity.length() > 0.2 ? 0.7 : 0;
    naviAnchor.set(
      link.pos.x + 0.45 * Math.sin(t * 0.5) + Math.sin(link.yaw) * lead,
      link.pos.y + 1.4 + 0.05 * Math.sin(t * 0.8),
      link.pos.z + 0.45 * Math.cos(t * 0.5) + Math.cos(link.yaw) * lead,
    );
  };

  const poseActor = (a: Actor, t: number, look: Vector3 | null) => {
    const r = a.char.rig;
    if (a === link && mode === 'play') {
      // Contact state advances with the fixed simulation, never once per rendered frame.
      // Report an actual sole point in flight as well as on the ground.
      a.contact.copy(r.sole);
      r.ankleL.localToWorld(a.contact);
    } else {
      r.root.position.set(a.pos.x, ground.height(a.pos.x, a.pos.z), a.pos.z);
      r.root.rotation.y = a.yaw;
      applyPose(r, { gait: a.gait, t, phase: a.phase, look, lookWeight: a.look, idleTurn: a.idleTurn });
      plantFeet(r, ground.height, a.contact);
    }
    a.char.syncGeometry?.();
    if (a === link) {
      const altitude = mode === 'play' ? Math.max(0, motion.state.y - ground.height(a.pos.x, a.pos.z)) : 0;
      (a.shadow.material as import('three').Material).opacity = 0.6 / (1 + altitude * 2.5);
      a.shadow.scale.setScalar(1 + altitude * 0.25);
    }
    // contact shadow just above the ground under the body centre
    a.shadow.position.set(a.pos.x, ground.decalHeight(a.pos.x, a.pos.z, a.shadowRadius), a.pos.z);
  };

  const feetOf = (a: Actor): V3 => [a.contact.x, a.contact.y, a.contact.z];
  const headOf = (a: Actor): V3 => {
    a.char.rig.head.getWorldPosition(tmpV);
    return [tmpV.x, tmpV.y + a.char.rig.props.headRadius * 1.05, tmpV.z];
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
      animations: GAITS.length + 3,
      animationNames: [...GAITS, 'jump', 'fall', 'land'],
      fairy: true,
      fairyTrail: TRAIL_COUNT,
      npcs: kids.length,
      geometry: 'procedural-v1',
      triangles: countTriangles(),
      linkTriangles: link.char.triangles,
      mode,
      view,
      linkGait: mode === 'play' && !motion.state.grounded ? (motion.state.vy > 0 ? 'jump' : 'fall') : link.gait,
      locomotion: mode === 'play' ? { ...motion.state } : null,
      samplePositions: { feet: [feetOf(link), ...kids.map(feetOf)] },
      contactShadows: 1 + kids.length,
      pavingSurface: ground.surfaceInfo(),      world: { link: feetOf(link), navi: [naviAnchor.x, naviAnchor.y, naviAnchor.z], kids: kids.map(feetOf) },
      screen: {
        linkFeet: proj(feetOf(link)),
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
      if (mode === 'play') stepPlayer(dt, t);
      else {
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
