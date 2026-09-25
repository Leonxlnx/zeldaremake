/**
 * Audio system (round 47, lane shell-1, owner item 19). WebAudio, created on the first user
 * gesture (browser autoplay rules — nothing plays in a headless capture, which has no gesture),
 * with master / music / ambience / sfx buses, the M key and the HUD's speaker glyph for mute.
 *
 *   ambience.ts  — wind bed following the world's gust, leaf rustle, four synthesised bird calls
 *                  on a seeded schedule, the pod lanterns' hum attenuated by distance
 *   footsteps.ts — stone / grass / dirt / wood / hollow steps from the player's speed and the ground under him
 *   music.ts     — the music slot: `public/audio/music.ogg|mp3` if present, else the original
 *                  placeholder loop; −12 dB under the ambience
 *
 * The per-frame update runs on its own requestAnimationFrame — the world's render loop and the
 * capture API are untouched. `renderOffline(seconds)` builds the same graph in an
 * OfflineAudioContext (a scripted walk for the footsteps) and returns a WAV — the evidence path.
 */
import type { Object3D, Scene, Vector3 } from 'three';
import type { Wind } from '../world/wind/wind';
import type { PlayerHandle } from '../world/character/player';
import { surfaceMask } from '../world/terrain/heightfield';
import { forestFloorZone } from '../world/terrain/material';
import { EXPANSION, EXPANSION_NORTH, EXPANSION_SOUTH, LAYOUT, northGangway } from '../world/layout';
import { createBuses, createRng, voices as liveVoices, MASTER_LEVEL, type Buses } from './graph';
import { createAmbience, type Ambience, type AmbienceStats, type Vec3 } from './ambience';
import { createFootsteps, RUN_GROUND_SPEED, WALK_SPEED, type Footsteps, type FootstepStats, type Surface } from './footsteps';
import { createMusic, type Music, type MusicSource } from './music';

export type AudioState = 'idle' | 'on' | 'muted';

export interface AudioHandle {
  readonly started: boolean;
  readonly muted: boolean;
  /** create the context now (must be called from a user gesture to be audible) */
  start(): Promise<void>;
  toggleMute(): void;
  setMuted(muted: boolean): void;
  music(): MusicSource;
  /** what the system has done so far — the play-mode evidence path (`__ZR_AUDIO__.stats()`) */
  stats(): AudioStats;
  /** render `seconds` of the mix offline: 16-bit stereo WAV bytes + the music source it used */
  renderOffline(seconds: number, sampleRate?: number, options?: OfflineOptions): Promise<OfflineRender>;
  /**
   * Record `seconds` of the LIVE graph — what the player is actually hearing, in real time, with
   * the gust the world is really running, the boots the gait is really planting and the parameter
   * automation the frame loop is really driving. Every other measurement on this lane comes from
   * `renderOffline`, which builds the same graph against a perfect clock and a scripted walk; this
   * is the only way to check that the twin tells the truth. Resolves with WebM/Opus bytes.
   */
  record(seconds: number): Promise<Uint8Array>;
  dispose(): void;
}

export interface AudioStats extends FootstepStats, AmbienceStats {
  state: AudioState;
  music: MusicSource;
  /** pod lanterns found in the scene (the flame's distance sources) */
  pods: number;
  /** true while the character system is reporting the gait's boot plants */
  gaitDriven: boolean;
  /** how closed the space over the listener is — 1 inside the log tunnel's bore, 0 in the open */
  enclosure: number;
  /** the world's wind gust as the bed last saw it, and the context clock — for start-up diagnosis */
  gust: number;
  contextTime: number;
  /** how closed the canopy over the listener is — 1 deep under the crowns, 0 under open sky */
  canopy: number;
  /** how much of the space is the ravine — 1 out over it on the bridge, 0 well back from it */
  gorge: number;
  /** where the audio thinks the fairies are (world), so a harness can stand beside one */
  fairySpots: [number, number, number][];
  /**
   * How hard the audio thread is working, from Chrome's render-capacity monitor: the share of each
   * render quantum used on average and at its worst, and the share of quanta that MISSED. An
   * underrun is a gap in the output — which is what "the music shakes" sounds like. null where the
   * browser does not report it.
   */
  load: RenderLoad | null;
  /** scheduled voices alive in the graph (every event — step, leaf, bird, note — builds its own) */
  voices: number;
}

export interface RenderLoad {
  average: number;
  peak: number;
  underrun: number;
}

export interface OfflineRender {
  wav: Uint8Array;
  music: MusicSource;
}

/** what an offline render contains — the evidence path renders the parts separately */
export interface OfflineOptions {
  /** `mix` = what the player hears; the others isolate one part of it */
  stem?: 'mix' | 'bed' | 'steps' | 'music';
  /** include the music bus (default: only in `mix`) */
  music?: boolean;
  /** mute the shared hall's return and the room's — the same stem dry, so a tail can be measured alone */
  reverb?: boolean;
  /** force the canopy over the whole render (0 open sky, 1 closed crowns) instead of the walk's own */
  canopy?: number;
  /** force the ravine over the whole render (0 well back from it, 1 out over it) */
  gorge?: number;
  /**
   * Switch off the world's occluders, so the same take can be rendered with and without the wood
   * between him and the birds. `false` is the "before" this change is measured against.
   */
  occlusion?: boolean;
  /**
   * Force the space over the whole render (0 outdoors, 0.7 inside a hut, 1 inside the log bore),
   * for the bed and for the boots both.
   *
   * The scripted walk crosses surfaces, not places, so there is no leg of it that is indoors and no
   * way to ask "what does this step sound like in a room" by walking. Forcing the term is not a
   * journey anyone takes — he would be walking on grass inside a hut — but it is the only way to
   * hold every other variable still, which is what a measurement needs. Two takes at 0 and 0.7
   * differ in exactly one input.
   */
  enclosure?: number;
  /**
   * Stand still at (x, z) for the whole render instead of walking the scripted route.
   *
   * Every measurement on this lane so far has come from one fixed walk through the village, which
   * answers "what does the game sound like" and cannot answer "what does **this place** sound
   * like". That second question is the one that matters for the owner's standing complaint, because
   * the metric for it — the level present in nine frames out of ten — is a property of a place and
   * a listener who is not doing anything. It also needs no footsteps and no browser recording: with
   * `stem: 'bed'` this is the world's own sound at a spot, rendered deterministically in a second.
   *
   * The space terms come from `surfaceAt(x, z)` unless `canopy` / `gorge` override them, so a spot
   * under the crowns or out over the ravine carries its own. The wind still moves — a place with no
   * weather in it is not a place.
   */
  at?: { x: number; z: number; y?: number; facing?: number };
}

/** one leg of the offline walk: seconds, ground speed (m/s) and what is underfoot */
export interface WalkLeg {
  until: number;
  speed: number;
  surface: Surface;
  stairs?: boolean;
}

/**
 * The scripted walk the offline render uses, so a before / after pair is the same journey and the
 * analysis can label each surface's steps: stand, walk every surface in turn, run, stand.
 */
/**
 * The walk speeds are the **player controller's own** (`footsteps.ts` `WALK_SPEED` /
 * `RUN_GROUND_SPEED`, which are `animation.ts` `PLAYER_SPEED`), not numbers chosen here. They were
 * 1.5 and 4.2 against a game that walks at 1.6 and runs at 4.6 — close enough to look right and
 * enough to put the render's step rate 5 % under the game's, which is the same class of mistake as
 * the cadence model being an adult's. The twin should travel at the speed the player travels at.
 */
export const OFFLINE_WALK: readonly WalkLeg[] = [
  { until: 3, speed: 0, surface: 'grass' },
  { until: 8, speed: WALK_SPEED, surface: 'grass' },
  { until: 13, speed: WALK_SPEED, surface: 'dirt' },
  { until: 18, speed: WALK_SPEED, surface: 'stone' },
  { until: 23, speed: 1.1, surface: 'stone', stairs: true },
  { until: 27, speed: WALK_SPEED, surface: 'wood' },
  { until: 31, speed: WALK_SPEED, surface: 'hollow' },
  { until: 36, speed: WALK_SPEED, surface: 'leaf' },
  { until: 41, speed: RUN_GROUND_SPEED, surface: 'stone' },
  { until: 45, speed: 0, surface: 'grass' },
  // appended 2026-09-24 with the south exit, AFTER the closing stand so every earlier leg keeps its
  // times and older before/after renders stay comparable
  { until: 50, speed: WALK_SPEED, surface: 'bridge' },
];

export interface AudioOptions {
  scene: Scene;
  wind: Wind | null;
  onState?: (s: AudioState) => void;
  /** seed for every schedule (fixed so two sessions hear the same forest) */
  seed?: string;
}

interface Live {
  ctx: AudioContext;
  buses: Buses;
  ambience: Ambience;
  footsteps: Footsteps;
  music: Music;
}

/**
 * Every fairy in the scene (`navi.ts` names its root from `FairyOptions.name`: the Kokiri kids'
 * are `kokiri-fairy-<slot>`). Unlike the pod lanterns these MOVE — they hover, and the girl walks —
 * so the objects are kept and their world position read each frame rather than sampled once.
 */
function gatherFairies(scene: Scene): FairyRef[] {
  const roots = new Map<string, Object3D>();
  const lights = new Map<string, Object3D>();
  scene.updateMatrixWorld(true);
  // the ROOT only: createFairy names every child from the same prefix (`-body`, `-core`, `-halo`,
  // `-sparkle`…), so a prefix match collects fifteen objects per fairy
  scene.traverse((o: Object3D) => {
    if (FAIRY_ROOT.test(o.name)) roots.set(o.name, o);
    else if (FAIRY_LIGHT.test(o.name)) lights.set(o.name.slice(0, -6), o);
  });
  // The root itself never moves. `npc.ts` reparents the fairy's point light onto the NPC group (a
  // light joining or leaving the scene changes the light count every lit program is keyed on, and
  // recompiles them all) and writes `anchor + offset(t)` to THAT every frame — so the light is
  // where she is, and the root only says whether she is shown.
  return [...roots].map(([name, root]) => ({ root, at: lights.get(name) ?? root }));
}

interface FairyRef {
  /** the fairy's group: carries her visibility */
  root: Object3D;
  /** the object that is actually at her hover point */
  at: Object3D;
}

const FAIRY_ROOT = /^(navi|kokiri-fairy-\d+)$/;
const FAIRY_LIGHT = /^(navi|kokiri-fairy-\d+)-light$/;

/**
 * A fairy's world position, or null while it or anything above it is hidden. The matrix is brought
 * up to date here rather than trusted: the audio runs on its own animation frame, and the world's
 * matrices are only refreshed when it draws — with the bag open, or under a harness that steps the
 * simulation without rendering, a trusted `matrixWorld` is whatever it was when the context started.
 */
function fairyAt(f: FairyRef, out: Vec3): Vec3 | null {
  for (let n: Object3D | null = f.root; n; n = n.parent) if (!n.visible) return null;
  f.at.updateWorldMatrix(true, false);
  const e = f.at.matrixWorld.elements;
  out.x = e[12];
  out.y = e[13];
  out.z = e[14];
  return out;
}

/** world-space centres of every `pod-lantern` mesh (structures/lantern.ts) */
function gatherPods(scene: Scene): Vec3[] {
  const pods: Vec3[] = [];
  const tmp = { x: 0, y: 0, z: 0 };
  scene.updateMatrixWorld(true);
  scene.traverse((o: Object3D) => {
    if (o.name !== 'pod-lantern') return;
    const e = o.matrixWorld.elements;
    tmp.x = e[12];
    tmp.y = e[13];
    tmp.z = e[14];
    // the mesh origin is the cord's hook; the pod hangs ~0.5 m below it
    pods.push({ x: tmp.x, y: tmp.y - 0.5, z: tmp.z });
  });
  return pods;
}

/**
 * What Link's boot lands on (owner, 2026-09-22: "his footsteps should correlate where he's
 * walking — gentle stone, grass, etc."). Analytic, from the layout and the live terrain masks the
 * paving is built from — no raycasts:
 *  - hollow: inside the log tunnel's bore (LAYOUT.logArch axis where the path passes through, within 0.8 of its radius)
 *  - wood:   the west house's platform disc and its walkway deck (EXPANSION.westHouse); the north
 *            grove's planking — the stilt house's veranda, the gangway up to it, the rope walk
 *            with its stubs and the tree hut's platform (EXPANSION_NORTH; character/ground.ts
 *            stands him on these wherever he is over them, so the test is XZ like the ground's)
 *  - stone:  the flagstone paths and the stair treads (surfaceMask path / stairs, live view — the
 *            expansion's stepping discs count)
 *  - dirt:   the trodden shoulders beside the paving (path influence 0.12–0.5) and the stair aprons
 *  - leaf:   the north forest floor (the terrain's own `forestFloorZone` — the ground the litter
 *            and humus patch covers, north of the log arch and off the path past the hollow's
 *            mouth). The owner's 09-23 list names leaves as one of the four surfaces.
 *  - grass:  everything else
 */
const GROVE_PLANKS = (() => {
  const N = EXPANSION_NORTH;
  const g = northGangway();
  const gl = Math.hypot(g.head[0] - g.foot[0], g.head[2] - g.foot[2]);
  // the gangway's walk span starts 0.35 m before its foot (structures/expansionNorth.ts)
  const lead = 0.35 / gl;
  return {
    discs: [
      { x: N.stilt.host[0], z: N.stilt.host[1], r: N.stilt.radius + N.stilt.veranda },
      { x: N.hut.host[0], z: N.hut.host[1], r: N.hut.radius + 0.22 },
    ],
    segs: [
      { ax: g.foot[0] - (g.head[0] - g.foot[0]) * lead, az: g.foot[2] - (g.head[2] - g.foot[2]) * lead, bx: g.head[0], bz: g.head[2], hw: N.gangway.halfWidth, surface: 'wood' as Surface },
      // the stubs and the rope walk between them lie on the line joining the two huts
      { ax: N.stilt.host[0], az: N.stilt.host[1], bx: N.hut.host[0], bz: N.hut.host[1], hw: N.ropeWalk.halfWidth, surface: 'bridge' as Surface },
    ],
  };
})();

/**
 * What the north grove's planking is underfoot, or null off it.
 *
 * The decks and the gangway are `wood`; **the rope walk is a `bridge`**. This lane split those two
 * apart for the south exit and the reason holds here more strongly than it did there: a `bridge`
 * knocks hollow with a deep body and the ropes and lashings answering, because a plank with nothing
 * under it is not a plank on a joist. The ravine's bridge hangs over 8 m of air; the grove's
 * walkway runs between two floors at **11.6 and 11.3 m** with a 0.12 m sag in it
 * (`EXPANSION_NORTH.ropeWalk`), which is the same object higher up.
 *
 * The stubs go with the walkway rather than the decks — they are its first 0.7 m, cantilevered out
 * past each rim — and the discs are tested first, so a plank still over its own veranda stays wood.
 * exp-north scored its own check 45 at 3 of 4 for calling all of it wood; this is that point.
 */
export function onGrovePlanks(x: number, z: number): Surface | null {
  for (const d of GROVE_PLANKS.discs) if (Math.hypot(x - d.x, z - d.z) < d.r) return 'wood';
  for (const s of GROVE_PLANKS.segs) {
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const t = ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz);
    if (t < 0 || t > 1) continue;
    if (Math.hypot(x - s.ax - dx * t, z - s.az - dz * t) < s.hw) return s.surface;
  }
  return null;
}

/**
 * The fraction of a hut's radius its wall ring stands at, and how far in the doorway's fade runs.
 *
 * `distantHouse.ts` builds every hut — the west house, the grove's stilt house and tree hut — as a
 * platform disc with a wall ring at `radius × WALL_TAPER` (0.96) and a gap in it for the door, and
 * publishes exactly that to `ctx.shared.walkSurfaces` for the character ground. So the player can
 * walk into all three of them, and until now doing so changed nothing at all: the forest arrived
 * through the walls at full level and full brightness, which is the same fault the log arch's bore
 * had before this lane closed it.
 *
 * A hut is not a tunnel, though. Its walls are planks and its door stands open, so it takes the top
 * off the wood rather than shutting it out — `INDOORS_CLOSE` is 0.7 of the bore's full enclosure,
 * which lands the bed's filter at 2.2 kHz against the bore's 900 Hz. Faded across the doorway
 * rather than switched, like the bore's: 0 at the wall, all of it by `INDOORS_FULL` of the radius.
 */
export const WALL_AT = 0.96;
export const INDOORS_FULL = 0.55;
export const INDOORS_CLOSE = 0.7;

/** how far inside a hut the listener is, 0 at its wall and 1 well in; 0 anywhere else */
function indoors(x: number, z: number, cx: number, cz: number, radius: number): number {
  const d = Math.hypot(x - cx, z - cz) / radius;
  return INDOORS_CLOSE * (1 - smoothstep01(INDOORS_FULL, WALL_AT, d));
}

export function surfaceAt(x: number, z: number): { surface: Surface; stairs: boolean; enclosure: number; canopy: number; gorge: number } {
  const m = surfaceMask(x, z, 'live');
  const gorge = gorgeAt(x, z);
  // how much wood is overhead: the terrain's own forest-floor zone, less the openings cut in it.
  // The litter is there BECAUSE the crowns are, so the same field that decides what is underfoot
  // also says how closed the sky is — the plaza and the village are open, the north corridor past
  // the arch is roofed — but the field does not know where the forest STOPS (see `skyOpening`).
  const canopy = forestFloorZone(x, z) * (1 - skyOpening(x, z));
  if (m.stairs > 0.5) return { surface: 'stone', stairs: true, enclosure: 0, canopy, gorge };
  // the log tunnel: distance from the log's axis in its own frame
  const la = LAYOUT.logArch;
  {
    const yaw = (la.yawDeg * Math.PI) / 180;
    const dx = x - la.position[0];
    const dz = z - la.position[2];
    const u = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    // the bore is where the north path passes through the log's west half (layout: the path spine
    // crosses at lu −3.4 … −4.8); elsewhere along the log the walker is on the ground beside it
    if (u > -8.5 && u < -0.5 && Math.abs(v) < la.radius * 0.8) {
      // how far in he is: the wood closes over the forest across the first 1.6 m of the bore
      const fromMouth = Math.min(u + 8.5, -0.5 - u) / 1.6;
      const fromWall = (la.radius * 0.8 - Math.abs(v)) / 0.5;
      return { surface: 'hollow', stairs: false, enclosure: Math.max(0, Math.min(1, Math.min(fromMouth, fromWall))), canopy, gorge };
    }
  }
  // the south expansion (EXPANSION_SOUTH): the rope-and-plank bridge over the ravine, and the
  // hollow log burrowing into the far bank. Both are walked and both used to sound like lawn.
  {
    const s = southSurfaceAt(x, z, canopy, gorge);
    if (s) return s;
  }
  // the plateau lookout's dais (LAYOUT.lookout): a 2.2 × 1.6 m slab on the east plateau's
  // south-west lip, standing 0.35–0.9 m proud of the turf, that the player steps up onto to look
  // west over the plaza. Hardscape merges it into the `flagstones` mesh and the character ground
  // stands on its top, so it is paving — the rope railing the props lane sets into it is the only
  // timber, deliberately not a deck ("wood over the stone would swallow the player's feet").
  {
    const lk = LAYOUT.lookout;
    const yaw = (lk.yawDeg * Math.PI) / 180;
    const dx = x - lk.x;
    const dz = z - lk.z;
    const u = dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const v = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
    // the step block on the fence side is walked onto as well, so the footprint carries a margin
    if (Math.abs(u) < lk.halfLength + 0.2 && Math.abs(v) < lk.halfDepth + 0.2) return { surface: 'stone', stairs: false, enclosure: 0, canopy, gorge };
  }
  // the west house's platform and deck
  {
    const wh = EXPANSION.westHouse;
    const hx = wh.host[0];
    const hz = wh.host[1];
    if (Math.hypot(x - hx, z - hz) < wh.radius) return { surface: 'wood', stairs: false, enclosure: indoors(x, z, hx, hz, wh.radius), canopy, gorge };
    const ex = wh.deckEnd[0];
    const ez = wh.deckEnd[2];
    const ax = ex - hx;
    const az = ez - hz;
    const len = Math.hypot(ax, az) || 1;
    const t = ((x - hx) * ax + (z - hz) * az) / (len * len);
    if (t > 0 && t < 1) {
      const px = hx + ax * t;
      const pz = hz + az * t;
      if (Math.hypot(x - px, z - pz) < 0.475) return { surface: 'wood', stairs: false, enclosure: 0, canopy, gorge };
    }
  }
  {
    const plank = onGrovePlanks(x, z);
    // the two huts are rooms with plank floors; their verandas and the walkway are outdoors
    if (plank) {
      const N = EXPANSION_NORTH;
      const enc = Math.max(indoors(x, z, N.stilt.host[0], N.stilt.host[1], N.stilt.radius), indoors(x, z, N.hut.host[0], N.hut.host[1], N.hut.radius));
      return { surface: plank, stairs: false, enclosure: enc, canopy, gorge };
    }
  }
  if (m.path > 0.5) return { surface: 'stone', stairs: false, enclosure: 0, canopy, gorge };
  if (m.path > 0.12) return { surface: 'dirt', stairs: false, enclosure: 0, canopy, gorge };
  if (canopy > 0.5) return { surface: 'leaf', stairs: false, enclosure: 0, canopy, gorge };
  return { surface: 'grass', stairs: false, enclosure: 0, canopy, gorge };
}

/**
 * The south exit's two walked structures (`EXPANSION_SOUTH`), neither of which the surface map knew
 * about — the owner has been asking for the world to grow and both were sounding like the lawn.
 *
 *  - the rope-and-plank bridge: planks over 8 m of empty air, so they knock hollow and the ropes
 *    and lashings answer. Its own surface, not `wood`: a deck on the ground and a deck over a
 *    ravine are not the same sound.
 *  - the hollow log at the far bank: the same bore sound as the arch by the plaza, with the same
 *    smooth enclosure as the wood closes over the listener.
 */
function southSurfaceAt(x: number, z: number, canopy: number, gorge: number): { surface: Surface; stairs: boolean; enclosure: number; canopy: number; gorge: number } | null {
  const b = EXPANSION_SOUTH.bridge;
  {
    const ax = b.south[0] - b.north[0];
    const az = b.south[1] - b.north[1];
    const len2 = ax * ax + az * az;
    const t = ((x - b.north[0]) * ax + (z - b.north[1]) * az) / len2;
    if (t > -0.02 && t < 1.02) {
      const px = b.north[0] + ax * t;
      const pz = b.north[1] + az * t;
      if (Math.hypot(x - px, z - pz) < b.walkHalfWidth + 0.12) return { surface: 'bridge', stairs: false, enclosure: 0, canopy: 0, gorge };
    }
  }
  const tn = EXPANSION_SOUTH.tunnel;
  {
    const dl = Math.hypot(tn.dir[0], tn.dir[1]) || 1;
    const dx = tn.dir[0] / dl;
    const dz = tn.dir[1] / dl;
    // along the bore from the mouth, and across it
    const u = (x - tn.mouth[0]) * dx + (z - tn.mouth[1]) * dz;
    const v = Math.abs(-(x - tn.mouth[0]) * dz + (z - tn.mouth[1]) * dx);
    if (u > -0.3 && u < tn.deadEnd && v < tn.innerRadius * 0.8) {
      return { surface: 'hollow', stairs: false, enclosure: Math.max(0, Math.min(1, Math.min(u / 1.6, (tn.innerRadius * 0.8 - v) / 0.5))), canopy, gorge };
    }
  }
  return null;
}

/**
 * How open the sky is where the forest stops — 1 in the middle of a clearing, 0 back under the
 * crowns.
 *
 * `forestFloorZone` is the terrain's litter field, and litter lies in a clearing exactly as it lies
 * under the trees, so the field reads **1.00 at the centre of the north clearing**. The bed took
 * that as a closed roof: the paved disc the layout describes as "banks rising on every side", with
 * a stone circle on it and the sky over it, sounded like the inside of the corridor that leads to
 * it — lowpassed by `CANOPY_CLOSE`, 1.8× the hall, 1.7× the leaf flutters.
 *
 * The cost is not one wrong number. It is that walking the north corridor and stepping out into
 * the clearing — the one arrival in the north half of the world, the thing the owner asked for
 * when he said he wanted "more to do afterwards" up the steps — made no change at all. A roof
 * lifting is something you hear.
 *
 * Faded across the rim rather than switched, so the walk in is the sound of it opening, and never
 * quite to nothing: a clearing nine metres across is ringed by trees that lean over it.
 */
export const CLEARING_OPEN_MAX = 0.85;
export function skyOpening(x: number, z: number): number {
  const c = LAYOUT.northClearing;
  const d = Math.hypot(x - c.x, z - c.z);
  return CLEARING_OPEN_MAX * (1 - smoothstep01(c.radius * 0.55, c.radius * 1.5, d));
}

/** how often the audio system updates its parameters and tops up its schedulers (ms) */
export const TICK_MS = 1000 / 30;

/**
 * How much of the space around the listener is the ravine (0 well back from it, 1 out over it on
 * the bridge). `EXPANSION_SOUTH.ravine.line` is (x, z, top half width, depth) west → east; the
 * depth term means the shallow ends where the gorge closes to nothing do not open the sound.
 *
 * Every space term the bed had until now CLOSED it — the log tunnel's bore and the canopy overhead.
 * A gorge is the other direction: eight metres of open air with rock either side, the one place in
 * the world where the forest should sound bigger than the village rather than smaller.
 */
/**
 * The solid things a player can put between himself and a sound: the thirteen giant boles and the
 * three huts. Circles in xz — every one of them is a barrel, and none is short enough for height to
 * matter (the boles stand 21–28 m and the huts' walls reach 6–14 m, against sources at head height
 * or in a crown eight metres up).
 */
const OCCLUDERS: readonly { x: number; z: number; r: number }[] = (() => {
  const all = [
    ...LAYOUT.giantTrees.map((t) => ({ x: t.position[0], z: t.position[2], r: t.trunkRadius })),
    { x: EXPANSION.westHouse.host[0], z: EXPANSION.westHouse.host[1], r: EXPANSION.westHouse.radius },
    { x: EXPANSION_NORTH.stilt.host[0], z: EXPANSION_NORTH.stilt.host[1], r: EXPANSION_NORTH.stilt.radius },
    { x: EXPANSION_NORTH.hut.host[0], z: EXPANSION_NORTH.hut.host[1], r: EXPANSION_NORTH.hut.radius },
  ];
  // A hut is built AROUND its host trunk — the west house and `southwest-giant` are at the same
  // point to the centimetre — so the naive list counts one obstacle twice and hands the line 10.6 m
  // of wood where the world has 6.8. Swallow anything whose centre lies inside something larger.
  return all.filter((a) => !all.some((b) => b !== a && b.r > a.r && Math.hypot(b.x - a.x, b.z - a.z) <= b.r));
})();

/**
 * Metres of wood that count as fully shadowed.
 *
 * An obstacle only shadows a source when it spans several wavelengths of it, which is why this is
 * a distance and not a flag. Measured against the world's real geometry
 * (`art/audio/2026-09-25-occlusion/`), the wood a player can actually get between himself and a
 * source runs 2.2 m to 6.8 m with a median of 3.1 — so the scale is set at the top of that, and a
 * bole's 3 m is a bit over half of it rather than all of it.
 */
export const OCCLUSION_FULL_M = 6;

/**
 * How much solid wood stands on the straight line from (ax, az) to (bx, bz), as 0 … 1.
 *
 * Only worth applying to sources with a top end. Through the median 3.1 m of wood the Fresnel
 * number is 2.4 at the pod flame's husk and 5.8 at its body — it bends round — but 32 for a distant
 * bird and 126 for a near one. The birds are what this is for; the wind and the leaves are diffuse
 * and have no position to shadow at all.
 */
export function occlusionAt(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 1e-3) return 0;
  const ux = dx / len;
  const uz = dz / len;
  let wood = 0;
  for (const o of OCCLUDERS) {
    // the nearest point of the LINE to the circle, clamped to the segment: a bole behind the
    // listener or past the source blocks nothing
    const t = Math.max(0, Math.min(len, (o.x - ax) * ux + (o.z - az) * uz));
    const perp = Math.hypot(ax + ux * t - o.x, az + uz * t - o.z);
    if (perp >= o.r) continue;
    wood += 2 * Math.sqrt(o.r * o.r - perp * perp);
  }
  return Math.min(1, wood / OCCLUSION_FULL_M);
}

export function gorgeAt(x: number, z: number): number {
  const line = EXPANSION_SOUTH.ravine.line;
  let best = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az, aw, ad] = line[i];
    const [bx, bz, bw, bd] = line[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    const w = aw + (bw - aw) * t;
    const depth = ad + (bd - ad) * t;
    // full out over the cut, gone by a little over twice its width; scaled by how deep it is there
    const near = 1 - smoothstep01(w, w * 2.2 + 3, d);
    best = Math.max(best, near * smoothstep01(1.5, 6, depth));
  }
  return best;
}

const smoothstep01 = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a || 1)));
  return t * t * (3 - 2 * t);
};

export const AUDIO_SEED = 'kokiri-audio-r47';

export function mountAudio(o: AudioOptions): AudioHandle {
  const seed = o.seed ?? AUDIO_SEED;
  let live: Live | null = null;
  let musicSource: MusicSource = 'none';
  let muted = false;
  let starting: Promise<void> | null = null;
  let raf = 0;
  let pods: Vec3[] = [];
  let fairyObjects: FairyRef[] = [];
  /** reused per-fairy vectors so the per-frame read allocates nothing */
  const fairySlots: Vec3[] = [];
  const fairyBuf: Vec3[] = [];
  let gaitDriven = false;
  let lastGust = 0;
  let load: RenderLoad | null = null;
  let enclosure = 0;
  let canopy = 0;
  let gorge = 0;
  /** the highest point of the jump or drop in progress (m above the ground under him) */
  let peakAir = 0;
  /**
   * The flames' world positions, gathered once.
   *
   * `stats()` is a diagnostic a harness polls every frame, and this used to traverse the whole
   * scene on every call — 0.33 ms against a 2.6 ms simulation frame, for an answer that cannot
   * change: a pod lantern is a fixture. Cached on first ask.
   */
  let podSpotCache: [number, number, number][] | null = null;
  const podSpots = (): [number, number, number][] => (podSpotCache ??= gatherPods(o.scene).map((p) => [Number(p.x.toFixed(2)), Number(p.y.toFixed(2)), Number(p.z.toFixed(2))] as [number, number, number]));

  const emit = () => o.onState?.(!live ? 'idle' : muted ? 'muted' : 'on');
  emit();

  const lastPos = { x: NaN, z: NaN };
  let lastT = 0;
  /**
   * The audio's own clock.
   *
   * 2026-09-24: this ran on `requestAnimationFrame`, which ties the whole audio system to the
   * health of the render loop. Measured on a cold start with Link standing still, rAF managed about
   * TEN callbacks in the first 6.7 seconds while the world compiled its shaders and built its LODs —
   * so the bed's levels never reached their targets and the music scheduler barely ran, and the
   * master sat at −92 dBFS until the frame rate recovered. A player who loads the game and stands
   * still hears nothing for several seconds.
   *
   * A timer does not care what the renderer is doing. It also keeps running when the tab is in the
   * background (throttled to 1 Hz, which the 4 s ambience and 6 s music lookaheads absorb) where
   * rAF stops dead.
   */
  const tick = (now: number) => {
    if (!live) return;
    const { ctx, ambience, footsteps, music } = live;
    const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
    lastT = now;
    const t = ctx.currentTime + 0.03;
    // listener: Link's sole when the character system published him, the camera otherwise
    const player = o.scene.userData.player as PlayerHandle | undefined;
    const pose = window.__ZR__?.cameraPose?.();
    const cam = pose?.position ?? [0, 2, 0];
    const p: Vector3 | null = player?.position ?? null;
    const listener: Vec3 = p ? { x: p.x, y: p.y + 1.2, z: p.z } : { x: cam[0], y: cam[1], z: cam[2] };
    // Which way the listener faces. In play mode that is Link, and his heading is a plain number
    // the character system maintains — `cameraPose()` reads the camera's world MATRIX, which is
    // only refreshed when the world draws, so with the bag open or under a harness that steps the
    // simulation without rendering it hands back whichever way the camera was pointing at start-up.
    const heading = player?.playMode?.() ? player.heading() : null;
    const fwd = heading === null ? (pose?.direction ?? [0, 0, -1]) : [Math.sin(heading), 0, Math.cos(heading)];
    const fl = Math.hypot(fwd[0], fwd[2]) || 1;
    // one ground lookup a frame, shared by the bed's enclosure and the boots' surface
    const s = surfaceAt(listener.x, listener.z);
    enclosure = s.enclosure;
    canopy = s.canopy;
    gorge = s.gorge;
    // the fairies hover and their owners walk, so their positions are read fresh (and skipped
    // while the background cast is hidden)
    fairyBuf.length = 0;
    for (let i = 0; i < fairyObjects.length; i++) {
      const at = fairyAt(fairyObjects[i], fairySlots[i]);
      if (at) fairyBuf.push(at);
    }
    lastGust = o.wind?.uniforms.uGust.value ?? 0.4;
    ambience.update(t, { gust: lastGust, listener, forward: { x: fwd[0] / fl, z: fwd[2] / fl }, pods, fairies: fairyBuf, enclosure: s.enclosure, canopy: s.canopy, gorge: s.gorge, occlude: (ox, oz) => occlusionAt(listener.x, listener.z, ox, oz), windDir: o.wind ? { x: o.wind.direction.x, z: o.wind.direction.y } : undefined });
    ambience.scheduleUntil(ctx.currentTime + 4);
    music.scheduleUntil(ctx.currentTime + 6);
    // footsteps: the gait's own boot plants when the character system reports them, the ground
    // speed otherwise (see footsteps.ts — a step is heard when a boot lands, not on a stride timer)
    if (p && player?.playMode?.()) {
      if (Number.isFinite(lastPos.x)) {
        const speed = Math.hypot(p.x - lastPos.x, p.z - lastPos.z) / Math.max(dt, 1e-3);
        const stance = player.feetContact?.()?.map((f) => f.stance);
        gaitDriven = !!stance;
        // the jump's arc (`airHeight` is 0 whenever a boot is down): the drop's highest point is
        // how hard he comes back onto whatever is under him
        const air = player.airHeight?.() ?? 0;
        if (air > 0.02) {
          // the rising edge is the shove: he is leaving the ground here, and until now that was
          // the one contact in the game that made no sound (art/audio/2026-09-24-jump/)
          if (peakAir === 0) footsteps.pushOff(t, s.stairs ? 'stair' : s.surface, speed, s.enclosure);
          peakAir = Math.max(peakAir, air);
        } else if (peakAir > 0.05) {
          footsteps.land(t, s.stairs ? 'stair' : s.surface, peakAir, s.enclosure);
          peakAir = 0;
        } else peakAir = 0;
        footsteps.drive(t, dt, { speed, surface: s.surface, onStairs: s.stairs, stance, enclosure: s.enclosure });
      }
      lastPos.x = p.x;
      lastPos.z = p.z;
    } else {
      lastPos.x = NaN;
      footsteps.drive(t, dt, { speed: 0, surface: 'grass', onStairs: false });
    }
  };

  const start = async () => {
    if (live) return;
    if (starting) return starting;
    starting = (async () => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('WebAudio unavailable');
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const rng = createRng(seed);
      const buses = createBuses(ctx, rng.fork('buses'));
      buses.master.gain.value = muted ? 0 : MASTER_LEVEL;
      const ambience = createAmbience(ctx, buses.ambience, buses.reverb, rng.fork('ambience'), ctx.currentTime);
      const footsteps = createFootsteps(ctx, buses.sfx, buses.reverb, buses.room, rng.fork('footsteps'), ctx.currentTime);
      const music = createMusic(ctx, buses.music, buses.reverb, rng.fork('music'), ctx.currentTime + 0.5);
      live = { ctx, buses, ambience, footsteps, music };
      music.ready.then((s) => (musicSource = s)).catch(() => undefined);
      pods = gatherPods(o.scene);
      fairyObjects = gatherFairies(o.scene);
      fairySlots.length = 0;
      for (let i = 0; i < fairyObjects.length; i++) fairySlots.push({ x: 0, y: 0, z: 0 });
      // Chrome's render-capacity monitor (AudioContext.renderCapacity): the only direct read on
      // whether the audio thread is missing its deadline, which is what a listener hears as the
      // music shaking. Absent elsewhere; the diagnostic just reports null then.
      const cap = (ctx as unknown as { renderCapacity?: { start(o: { updateInterval: number }): void; addEventListener(t: string, f: (e: RenderCapacityEvent) => void): void } }).renderCapacity;
      if (cap) {
        cap.addEventListener('update', (e: RenderCapacityEvent) => {
          load = { average: e.averageLoad, peak: e.peakLoad, underrun: e.underrunRatio };
        });
        cap.start({ updateInterval: 0.25 });
      }
      await ctx.resume().catch(() => undefined);
      console.info(`[audio] started (${ctx.sampleRate} Hz, ${pods.length} pod lanterns, ${fairyObjects.length} fairies)`);
      emit();
      lastT = 0;
      raf = window.setInterval(() => tick(performance.now()), TICK_MS);
    })();
    try {
      await starting;
    } finally {
      starting = null;
    }
  };

  // first gesture starts the context (pointer or key, once)
  const onGesture = () => {
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    start().catch((e) => console.warn('[audio] start failed:', e));
  };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);

  const setMuted = (m: boolean) => {
    muted = m;
    if (live) live.buses.master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, live.ctx.currentTime, 0.03);
    emit();
  };

  return {
    get started() {
      return !!live;
    },
    get muted() {
      return muted;
    },
    start,
    toggleMute: () => setMuted(!muted),
    setMuted,
    music: () => musicSource,
    stats: () => ({
      state: !live ? 'idle' : muted ? 'muted' : 'on',
      music: musicSource,
      pods: pods.length,
      gaitDriven,
      enclosure,
      gust: lastGust,
      contextTime: live?.ctx.currentTime ?? 0,
      canopy,
      gorge,
      fairySpots: fairyBuf.map((f) => [Number(f.x.toFixed(2)), Number(f.y.toFixed(2)), Number(f.z.toFixed(2))] as [number, number, number]),
      // the flames' world positions, as the fairies' already were. A harness cannot ask "is there
      // anything in this world you could stand behind" without knowing where the sources are, and
      // `pods` was only ever a count.
      podSpots: podSpots(),
      load,
      voices: liveVoices(),
      ...(live?.footsteps.stats() ?? { steps: 0, gaitSteps: 0, surfaces: {}, lastSurface: null, landings: 0, pushOffs: 0, scheduledAt: 0 }),
      ...(live?.ambience.stats() ?? { birds: 0, flutters: 0, glints: 0, fairiesNear: 0, windLean: 0, birdSpots: [], birdShadow: 0 }),
    }),
    renderOffline: (seconds, sampleRate = 44100, options) => renderOffline(o, seed, seconds, sampleRate, options),
    record: (seconds) => recordLive(live, seconds),
    dispose() {
      clearInterval(raf);
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      if (live) {
        live.ambience.dispose();
        live.footsteps.dispose();
        live.music.dispose();
        live.ctx.close().catch(() => undefined);
        live = null;
      }
    },
  };
}

/**
 * Tap the live master into a MediaStreamDestination and record it. The tap is additive — the
 * player's own output is untouched — and it is torn down afterwards, so nothing is left hanging off
 * the master between captures.
 */
async function recordLive(live: Live | null, seconds: number): Promise<Uint8Array> {
  if (!live) throw new Error('audio has not started (it needs a user gesture first)');
  const Rec = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!Rec) throw new Error('MediaRecorder unavailable');
  const dest = live.ctx.createMediaStreamDestination();
  live.buses.master.connect(dest);
  const chunks: Blob[] = [];
  const rec = new Rec(dest.stream, { mimeType: 'audio/webm' });
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
  rec.start();
  await new Promise((r) => setTimeout(r, seconds * 1000));
  rec.stop();
  await done;
  live.buses.master.disconnect(dest);
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

/**
 * Offline evidence render: the same graph in an OfflineAudioContext with the wind's gust
 * envelope (wind.ts) evaluated from time, the pods gathered from the scene, and the scripted walk
 * in `OFFLINE_WALK` — Link stands, crosses grass, trodden earth, flagstones, deck planks and the
 * log tunnel at a walk, runs on stone, stops. Exposed as
 * `window.__ZR_AUDIO__.renderOffline(seconds, rate, options)` by the shell so a headless page
 * (no gesture, no output device) can still produce the WAV; `options.stem` renders the ambience
 * bed or the footsteps alone so each can be measured without the other masking it.
 */
export async function renderOffline(o: AudioOptions, seed: string, seconds: number, sampleRate: number, options: OfflineOptions = {}): Promise<OfflineRender> {
  const stem = options.stem ?? 'mix';
  const withMusic = options.music ?? (stem === 'mix' || stem === 'music');
  const Ctor = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) throw new Error('OfflineAudioContext unavailable');
  const ctx = new Ctor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const rng = createRng(seed);
  const buses = createBuses(ctx, rng.fork('buses'));
  if (options.reverb === false) {
    buses.reverbReturn.gain.value = 0;
    buses.roomReturn.gain.value = 0;
  }
  // every fork is drawn whatever the stem, so one part's stream never depends on another's presence
  const ambienceRng = rng.fork('ambience');
  const footstepsRng = rng.fork('footsteps');
  const musicRng = rng.fork('music');
  const ambience = stem === 'steps' || stem === 'music' ? null : createAmbience(ctx, buses.ambience, buses.reverb, ambienceRng, 0);
  const footsteps = stem === 'bed' || stem === 'music' ? null : createFootsteps(ctx, buses.sfx, buses.reverb, buses.room, footstepsRng, 0);
  const music = withMusic ? createMusic(ctx, buses.music, buses.reverb, musicRng, 0.5) : null;
  const musicSource = music ? await music.ready : 'none';
  const pods = gatherPods(o.scene);
  // the fairies do not move in an offline render (nothing steps the character system), so one
  // sample of each is enough; the walk's last leg stands beside the nearest one so the glints are
  // in the evidence WAV — in play they are wherever their Kokiri is
  const fairies = gatherFairies(o.scene)
    .map((f) => fairyAt(f, { x: 0, y: 0, z: 0 }))
    .filter((v): v is Vec3 => !!v);
  // listener path: starts under the lantern bough (the plaza) and walks north-east
  const gust = (t: number) => {
    const g = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1.3);
    const push = Math.max(0, Math.sin(t * 0.23 + 0.4)) ** 3;
    return Math.min(1, g * 0.8 + push * 0.6);
  };
  const step = 1 / 20;
  let x = 0;
  let z = 2;
  const lastLeg = OFFLINE_WALK[OFFLINE_WALK.length - 1];
  const standsBesideFairy = OFFLINE_WALK[OFFLINE_WALK.length - 2].until;
  // standing somewhere: the place's own space terms, and nothing underfoot
  const spot = options.at ? surfaceAt(options.at.x, options.at.z) : null;
  const facing = options.at?.facing ?? 0;
  for (let t = 0; t < seconds; t += step) {
    if (options.at && spot) {
      ambience?.update(t, {
        gust: gust(t),
        listener: { x: options.at.x, y: options.at.y ?? 1.2, z: options.at.z },
        forward: { x: Math.sin(facing), z: Math.cos(facing) },
        pods,
        fairies,
        enclosure: options.enclosure ?? spot.enclosure,
        occlude: options.occlusion === false ? undefined : (ox, oz) => occlusionAt(options.at!.x, options.at!.z, ox, oz),
        canopy: options.canopy ?? spot.canopy,
        gorge: options.gorge ?? spot.gorge,
        windDir: o.wind ? { x: o.wind.direction.x, z: o.wind.direction.y } : undefined,
      });
      continue;
    }
    const leg = OFFLINE_WALK.find((l) => t < l.until) ?? lastLeg;
    x += leg.speed * step * 0.6;
    z -= leg.speed * step * 0.8;
    // the closing stand is beside a fairy, so its glints are in the evidence WAV
    const beside = t >= standsBesideFairy && fairies.length ? fairies[0] : null;
    const listener: Vec3 = beside ? { x: beside.x + 0.9, y: beside.y, z: beside.z + 0.5 } : { x, y: 1.2, z };
    // the walk's `leaf` leg IS the north forest floor, so it carries its closed canopy with it
    ambience?.update(t, { gust: gust(t), listener, forward: { x: 0.6, z: -0.8 }, pods, fairies, enclosure: options.enclosure, occlude: options.occlusion === false ? undefined : (ox, oz) => occlusionAt(listener.x, listener.z, ox, oz), canopy: options.canopy ?? (leg.surface === 'leaf' ? 1 : 0), gorge: options.gorge ?? (leg.surface === 'bridge' ? 1 : 0), windDir: o.wind ? { x: o.wind.direction.x, z: o.wind.direction.y } : undefined });
    footsteps?.drive(t, step, { speed: leg.speed, surface: leg.surface, onStairs: !!leg.stairs, enclosure: options.enclosure });
  }
  ambience?.scheduleUntil(seconds);
  music?.scheduleUntil(seconds);
  const buffer = await ctx.startRendering();
  return { wav: encodeWav(buffer), music: musicSource };
}

/** 16-bit PCM WAV. */
export function encodeWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = 44 + frames * channels * 2;
  const out = new ArrayBuffer(bytes);
  const v = new DataView(out);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, bytes - 8, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      v.setInt16(off, s < 0 ? s * 32768 : s * 32767, true);
      off += 2;
    }
  }
  return new Uint8Array(out);
}

interface RenderCapacityEvent {
  averageLoad: number;
  peakLoad: number;
  underrunRatio: number;
}
