/**
 * Skinned GLB Link — Astra's textured, rigged runtime candidate (public/models/link/link-runtime.glb,
 * provenance in SOURCE.md next to it) behind the procedural fallback. The character ART is hers;
 * this file is the runtime: load, validate (bones / clips), pose deterministically, plant, look.
 *
 * Determinism (W41): the pose is a pure function of the simulation time `t`. Every clip action is
 * kept active and its `time` is SET each frame (clip time = (t · rate + heroOffset) mod duration),
 * then `mixer.update(0)` evaluates the blend — no wall-clock dt accumulation, so `setTime()` jumps
 * and the determinism re-capture reproduce the frame byte for byte. Gait crossfades (play mode)
 * are weights computed from `t − gaitSwitchT`, hard when that is −Infinity (captures).
 *
 * Playback rate per gait = GAIT_SPEED / (stride / cycle) from her pipeline.json — 1.0 for every
 * clip as delivered; the formula stays so a future clip with a different stride does not slide.
 *
 * The head look-at rotates two pivots inserted above the `neck` and `head` bones rather than the
 * bones themselves: the mixer only rewrites a bound property when its blended value changed, so a
 * rotation added to a bone would survive into a frame rendered at the same `t` and double up.
 */
import { AnimationAction, AnimationMixer, Bone, Box3, Group, LoopRepeat, Material, MathUtils, Object3D, Quaternion, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAIT_SPEED, GAITS, type Gait, type GroundSampler } from './animation';
import type { Puppet, PuppetPose } from './puppet';

/** served by Vite from public/ */
export const LINK_GLB_FILE = 'models/link/link-runtime.glb';
/** the delivered file's hash, recorded in public/models/link/SOURCE.md — reported, never recomputed at runtime */
export const LINK_GLB_SHA256 = '9189538d7a54b0e1b5213215c5fc9b1174dad85c11e74f7308bec84b3e78c71a';

/**
 * Clip contract from Astra's pipeline.json (rig.clips): stride and cycle per gait, plus the clip
 * time of the hero pose. The harness samples t = 12.5 + settle/60 s (settle 6 → 12.6 s); like
 * HERO_PHASE for the procedural rig, the offset puts the walk / run / stairs clips at a right-foot-
 * forward mid-stride there (sampled from her ankle contact paths: walk frame 16/33 — L toe-off, R
 * heel-strike, soles 0.43 m apart; run frame 15/34 — R about to land, L trailing 0.09 m up; stairs
 * frame 22/44 — R heel-strike).
 */
interface ClipSpec {
  strideM: number;
  cycleS: number;
  heroClipTime: number;
}
export const CLIP_SPEC: Record<Gait, ClipSpec> = {
  idle: { strideM: 0, cycleS: 3.0, heroClipTime: 0 },
  walk: { strideM: 0.88, cycleS: 0.55, heroClipTime: 16 / 60 },
  run: { strideM: 2.21, cycleS: 0.5666667, heroClipTime: 15 / 60 },
  stairs: { strideM: 0.8066667, cycleS: 0.7333333, heroClipTime: 22 / 60 },
};
/** simulation time of the hero captures (capture.mjs DEFAULT_SIM_TIME 12.5 + 6 settle frames) */
export const HERO_T = 12.6;
/** play-mode gait crossfade length (s) */
const BLEND_S = 0.18;

const REQUIRED_BONES = ['hips', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'thighL', 'thighR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'] as const;

/** ankle-local sole contact markers (three.js axes) from her runtime capture manifest */
const SOLE_L = new Vector3(-0.000000016, 0.05900068, 0.08564404);
const SOLE_R = new Vector3(0.000000016, 0.05900068, 0.08564404);

export interface LinkClipInfo {
  name: string;
  durationS: number;
  strideM: number;
  rate: number;
}

export interface LinkAssetInfo {
  file: string;
  sha256: string;
  triangles: number;
  materials: number;
  bones: number;
  clips: LinkClipInfo[];
  loadMs: number;
}

export interface GlbLink extends Puppet {
  kind: 'glb';
  asset: LinkAssetInfo;
}

/** playback rate that makes the clip's stride cover GAIT_SPEED on the ground */
export function clipRate(gait: Gait, durationS: number): number {
  const spec = CLIP_SPEC[gait];
  if (spec.strideM <= 0 || GAIT_SPEED[gait] <= 0) return 1;
  const cycle = durationS > 0 ? durationS : spec.cycleS;
  return Math.round((GAIT_SPEED[gait] / (spec.strideM / cycle)) * 1e6) / 1e6;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

const _target = new Vector3();
const _soleL = new Vector3();
const _soleR = new Vector3();
const _q = new Quaternion();
const _axisY = new Vector3(0, 1, 0);
const _axisX = new Vector3(1, 0, 0);

/**
 * Insert a rotation pivot between `bone` and its parent that turns about the bone's rest origin:
 * parent → pivot (at the rest translation, carries the look rotation) → inner (−rest translation)
 * → bone (its own clip-driven translation / rotation, untouched, so the mixer keeps binding it).
 */
function insertPivot(bone: Object3D, name: string): Object3D {
  const parent = bone.parent;
  if (!parent) throw new Error(`bone ${bone.name} has no parent`);
  const pivot = new Object3D();
  pivot.name = name;
  pivot.position.copy(bone.position);
  const inner = new Object3D();
  inner.name = `${name}-inner`;
  inner.position.copy(bone.position).negate();
  parent.remove(bone);
  parent.add(pivot);
  pivot.add(inner);
  inner.add(bone);
  return pivot;
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const ev = e as { message?: string; type?: string; target?: { status?: number; responseURL?: string } };
    if (ev.message) return ev.message;
    if (ev.type) return `${ev.type}${ev.target?.status ? ` ${ev.target.status}` : ''}`;
  }
  return String(e);
}

/**
 * Load and validate the GLB. Rejects (with a plain-text reason) on 404, parse errors, missing
 * bones or missing clips — the caller falls back to the procedural Link.
 */
export async function loadGlbLink(url: string): Promise<GlbLink> {
  const t0 = performance.now();
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch (e) {
    throw new Error(`load failed: ${describe(e)}`);
  }
  const model = gltf.scene;

  const skinned: SkinnedMesh[] = [];
  const materials = new Set<Material>();
  const bones: Bone[] = [];
  model.traverse((o: Object3D) => {
    if ((o as SkinnedMesh).isSkinnedMesh) skinned.push(o as SkinnedMesh);
    if ((o as Bone).isBone) bones.push(o as Bone);
  });
  if (!skinned.length) throw new Error('no skinned meshes in the GLB');
  let triangles = 0;
  const bounds = new Box3();
  for (const m of skinned) {
    m.castShadow = true;
    m.receiveShadow = true;
    const g = m.geometry;
    triangles += Math.floor((g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3);
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat) materials.add(mat);
    g.computeBoundingBox();
    if (g.boundingBox) bounds.union(g.boundingBox);
  }

  const bone = (name: string): Object3D => {
    const b = model.getObjectByName(name);
    if (!b) throw new Error(`bone "${name}" missing`);
    return b;
  };
  const missing = REQUIRED_BONES.filter((n) => !model.getObjectByName(n));
  if (missing.length) throw new Error(`bones missing: ${missing.join(', ')}`);
  const neck = bone('neck');
  const head = bone('head');
  const ankleL = bone('ankleL');
  const ankleR = bone('ankleR');

  const clips = GAITS.map((g) => ({ gait: g, clip: gltf.animations.find((c) => c.name === g) ?? null }));
  const noClip = clips.filter((c) => !c.clip).map((c) => c.gait);
  if (noClip.length) throw new Error(`clips missing: ${noClip.join(', ')} (have ${gltf.animations.map((a) => a.name).join(', ') || 'none'})`);

  // rest-pose measurements before anything animates: skull top above the head bone (skin mesh only,
  // no hair / cap) for the audit's head projection, and the total height with the cap
  model.updateMatrixWorld(true);
  const skin = skinned.find((m) => /skin/i.test(m.name)) ?? skinned[0];
  skin.geometry.computeBoundingBox();
  const headRest = head.getWorldPosition(new Vector3());
  const headTopOffset = (skin.geometry.boundingBox?.max.y ?? headRest.y + 0.28) - headRest.y;
  const height = bounds.max.y - Math.min(0, bounds.min.y);

  // look pivots (see the header) — inserted before the actions bind so the search stays valid
  const neckPivot = insertPivot(neck, 'neck-look');
  const headPivot = insertPivot(head, 'head-look');

  const root = new Group();
  root.name = 'link';
  root.userData.character = 'link';
  root.add(model);

  const mixer = new AnimationMixer(model);
  const actions = new Map<Gait, { action: AnimationAction; duration: number; rate: number; offset: number }>();
  for (const { gait, clip } of clips) {
    if (!clip) continue;
    const action = mixer.clipAction(clip);
    action.setLoop(LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.weight = gait === 'idle' ? 1 : 0;
    action.play();
    const duration = clip.duration;
    const rate = clipRate(gait, duration);
    // clip time at the hero t lands on the hero pose: (HERO_T · rate + offset) mod duration = heroClipTime
    const offset = mod(CLIP_SPEC[gait].heroClipTime - mod(HERO_T * rate, duration), duration);
    actions.set(gait, { action, duration, rate, offset });
  }

  const asset: LinkAssetInfo = {
    file: LINK_GLB_FILE,
    sha256: LINK_GLB_SHA256,
    triangles,
    materials: materials.size,
    bones: bones.length,
    clips: GAITS.map((g) => {
      const a = actions.get(g)!;
      return { name: g, durationS: Number(a.duration.toFixed(6)), strideM: CLIP_SPEC[g].strideM, rate: a.rate };
    }),
    loadMs: Math.round(performance.now() - t0),
  };

  const clipTimeOf = (gait: Gait, t: number) => {
    const a = actions.get(gait)!;
    return mod(t * a.rate + a.offset, a.duration);
  };

  /** 1 = fully in `p.gait`; a smoothstep from the previous gait over BLEND_S after a switch */
  const blendWeight = (p: PuppetPose) => {
    if (p.gaitFrom === p.gait || !actions.has(p.gaitFrom)) return 1;
    const dt = p.t - p.gaitSwitchT;
    if (!(dt >= 0 && dt < BLEND_S)) return 1;
    return MathUtils.smoothstep(dt / BLEND_S, 0, 1);
  };

  /**
   * Turn the neck (35 %) and head (65 %) pivots toward a world point, clamped, scaled by `weight`.
   * Angles are measured once in the neck pivot's frame (the chest frame at the neck's rest origin:
   * +Z forward, +Y up at rest) and split; for these small angles the two rotations add up.
   */
  const lookAt = (target: Vector3, weight: number) => {
    root.updateMatrixWorld(true);
    _target.copy(target);
    neckPivot.worldToLocal(_target);
    const yaw = MathUtils.clamp(Math.atan2(_target.x, _target.z), -0.8, 0.8) * weight;
    const pitch = MathUtils.clamp(Math.atan2(_target.y, Math.hypot(_target.x, _target.z)), -0.4, 0.45) * weight;
    const apply = (pivot: Object3D, k: number) => {
      pivot.quaternion.setFromAxisAngle(_axisY, yaw * k);
      _q.setFromAxisAngle(_axisX, -pitch * k);
      pivot.quaternion.multiply(_q);
    };
    apply(neckPivot, 0.35);
    apply(headPivot, 0.65);
  };

  const puppet: GlbLink = {
    kind: 'glb',
    group: root,
    triangles,
    height: Number(height.toFixed(4)),
    animations: GAITS.filter((g) => actions.has(g)),
    asset,
    pose(x, z, yaw, p, ground: GroundSampler, contact) {
      root.position.set(x, ground(x, z), z);
      root.rotation.y = yaw;
      const w = blendWeight(p);
      for (const [gait, a] of actions) {
        let weight = 0;
        if (gait === p.gait) weight += w;
        if (gait === p.gaitFrom && w < 1) weight += 1 - w;
        a.action.weight = weight;
        a.action.time = clipTimeOf(gait, p.t);
      }
      mixer.update(0);
      neckPivot.quaternion.identity();
      headPivot.quaternion.identity();
      if (p.look && p.lookWeight > 0) lookAt(p.look, p.lookWeight);
      // plant: drop the whole character so the lower sole touches the ground (stance soles sit
      // 6 mm above the origin in the clips, so on flat ground this is that 6 mm)
      root.updateMatrixWorld(true);
      _soleL.copy(SOLE_L).applyMatrix4(ankleL.matrixWorld);
      _soleR.copy(SOLE_R).applyMatrix4(ankleR.matrixWorld);
      const gL = ground(_soleL.x, _soleL.z);
      const gR = ground(_soleR.x, _soleR.z);
      const gapL = _soleL.y - gL;
      const gapR = _soleR.y - gR;
      if (gapL <= gapR) {
        root.position.y -= gapL;
        contact.set(_soleL.x, gL, _soleL.z);
      } else {
        root.position.y -= gapR;
        contact.set(_soleR.x, gR, _soleR.z);
      }
      root.updateMatrixWorld(true);
    },
    headTop(out) {
      return head.localToWorld(out.set(0, headTopOffset, 0));
    },
  };
  return puppet;
}
