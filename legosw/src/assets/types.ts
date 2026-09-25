import type { Group, Mesh, Object3D } from 'three';

/**
 * Interfaces between the asset modules and the film. Conventions for every model:
 *   units = studs (1 = 8 mm; plate 0.4, brick 1.2; a minifig is ~4.75 tall)
 *   +Z = forward (nose), +Y = up, +X = PORT (left side when sitting in the cockpit), origin at the
 *   model's natural pivot (centre of mass for ships), unscaled; the film places and scales.
 * Anchors are empty Object3Ds parented inside the model so the film can attach things (pilots,
 * droids, laser muzzles) without knowing the internals.
 */

export interface Eta2 {
  group: Group;
  /** 0 = folded cruise wings, 1 = S-foils fully open (attack) */
  setFoils(open: number): void;
  /** 0..1 engine glow / exhaust intensity */
  setEngine(power: number): void;
  /** pilot minifig attaches here: seated origin = top of seat cushion centre, facing +Z */
  cockpitAnchor: Object3D;
  /** astromech socket: the droid's body-top centre sits here, head sticking up +Y */
  astromechAnchor: Object3D;
  /** canopy (can be hidden or lifted) */
  canopy: Object3D;
  /** laser muzzle points (world direction = +Z of each) */
  muzzles: Object3D[];
  /** engine nozzle centres (for trails), pointing -Z */
  engines: Object3D[];
  /** named sub-assemblies that can break off (wings, nose) for the crash-landing */
  breakables: Object3D[];
  length: number;
}

export interface Astromech {
  group: Group;
  /** dome pivot (rotate around local Y) */
  head: Object3D;
  setHeadYaw(rad: number): void;
  /** 0..1 blink of the holo-projector / logic lights */
  setLights(v: number): void;
  /** point where an electric zap arm extends from (R2 zapping the buzz droid) */
  zapAnchor: Object3D;
}

export interface CapitalShip {
  group: Group;
  length: number;
  /** turbolaser muzzle anchors (+Z of each = firing direction when turret faces forward) */
  turrets: Object3D[];
  /** engine glow meshes (so the film can pulse them) */
  engineGlows: Mesh[];
  /** named anchors (e.g. 'hangar', 'bridgeL', 'bridgeR') */
  anchors: Record<string, Object3D>;
}

export interface SmallCraft {
  group: Group;
  length: number;
  muzzles: Object3D[];
  engines: Object3D[];
  /** optional animation hook (wing flap, arm wiggle …) */
  animate?(t: number): void;
}

export interface VultureDroid extends SmallCraft {
  /** 0 = flight (wings out), 1 = walking stance (legs down, head forward) */
  setMode(walk: number): void;
  /** walking gait phase (radians) used when mode > 0 */
  setGait(phase: number): void;
}

export interface Missile extends SmallCraft {
  /** 0 = closed nose, 1 = petals fully open (buzz droids released) */
  setOpen(v: number): void;
  /** where the buzz droid payload sits (children can be re-parented out) */
  payloadAnchors: Object3D[];
}

export interface BuzzDroid {
  group: Group;
  /** 0 = closed ball, 1 = arms deployed */
  setDeploy(v: number): void;
  /** arm / saw animation */
  animate(t: number): void;
  /** the head (can be knocked off by R2) */
  head: Object3D;
}

export interface BattleDroid {
  group: Group;
  head: Object3D;
  torso: Object3D;
  armL: Object3D;
  armR: Object3D;
  legL: Object3D;
  legR: Object3D;
  blaster: Object3D;
  /** simple poses: 0 = stand, 1 = aim blaster; walk phase in radians */
  pose(o: { aim?: number; walk?: number; headTilt?: number; lookYaw?: number }): void;
  /** pieces that fly apart when cut down (head, arms, torso, legs) */
  parts: Object3D[];
}

export interface Hangar {
  group: Group;
  /** the blue ray shield across the mouth; 1 = on, 0 = off (animated flicker is up to the film) */
  setShield(v: number): void;
  /** named anchors: 'landingA', 'landingB' (fighter touchdown spots), 'mouth', 'droidLine' … */
  anchors: Record<string, Object3D>;
  /** half-extents of the interior (for camera placement) */
  size: [number, number, number];
}

export interface InvisibleHand extends CapitalShip {
  /** the hangar mouth rectangle (anchor at its centre, +Z pointing out of the ship) */
  setShield(v: number): void;
}
