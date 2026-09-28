# Module contracts and file ownership (frozen)

Fifteen specialists build this film at the same time in one working tree. It only works because
these boundaries do not move. If a contract is insufficient, work around it inside your own
files and state the needed change in your final report - never edit a file you do not own.

- Timing: `app/core/edit.js` (24 fps, 2880 frames, 1920x804). Shots read their duration from it.
- Placement: `app/core/layout.js` (millimetres, +Y up, counter `y = 0`, -Z toward the wall,
  outbound = +X = screen right).
- Randomness: `app/core/prng.js` only (`rng`, `hash2`, `hash3`, `noise1`, `noise2`, `fbm1`,
  `fbm2`, `ease`, `clamp`, `smoothstep`, `mix`). **No `Math.random`, `Date.now` or
  `performance.now` in anything that affects pixels.** Every frame must be reproducible.
- three.js r186, plain browser ES modules, no bundler. HTML import map:
  `{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}`.
  The static server roots at `/workspace`, so pages are `/spiderverse/app/<page>.html`.
- Headless rendering only through `tools/lib/headless.mjs` (`startServer`, `withPage`,
  `grabPNG`). It enforces a machine-wide limit on concurrent browsers (the VM has 4 cores and
  ~6 GB free shared by everyone) - **one browser per agent at a time, iterate at 960x402.**
- Nobody runs git. The director commits.
- Scratch output: `spiderverse/out/<your-owner-id>/` (gitignored).

## File ownership

| Owner | Exclusive files |
| --- | --- |
| DIRECTOR | `app/index.html`, `app/main.js`, `app/core/layout.js`, `app/core/registry.js`, `app/assets/proxy.js`, `tools/render.mjs`, `tools/assemble.mjs`, `tools/lib/**`, `docs/BRIEF.md`, `docs/GOAL.md`, `docs/INTERFACES.md`, `checkpoints/**` |
| EDIT | `app/core/edit.js`, `docs/STORY.md`, `docs/SHOTLIST.md`, `app/animatic/**`, `tools/animatic.mjs` |
| CHAR | `app/assets/characters/**`, `tools/preview-char.mjs`, `app/preview-char.html` |
| KITCHEN | `app/assets/sets/kitchen.js`, `app/assets/sets/kitchen/**`, `tools/preview-kitchen.mjs`, `app/preview-kitchen.html` |
| NEST | `app/assets/sets/nest.js`, `app/assets/sets/nest/**`, `tools/preview-nest.mjs`, `app/preview-nest.html` |
| PROPS | `app/assets/props/**`, `tools/preview-props.mjs`, `app/preview-props.html` |
| LOOK | `app/core/materials.js`, `app/core/renderer.js`, `app/core/shaders/**`, `app/core/lookdev.js`, `tools/preview-look.mjs`, `app/preview-look.html` |
| WATER | `app/assets/water/**`, `tools/preview-water.mjs`, `app/preview-water.html` |
| FX2D | `app/fx/fx2d.js`, `app/fx/fx2d/**`, `tools/preview-fx2d.mjs`, `app/preview-fx2d.html` (uses `app/scene/letters.js`, read-only) |
| FXPOST | `app/fx/post.js`, `app/fx/post/**`, `tools/preview-post.mjs`, `app/preview-post.html` |
| ANIM1 | `app/shots/s01.js` ... `app/shots/s06.js`, `app/shots/lib1/**` |
| ANIM2 | `app/shots/s07.js` ... `app/shots/s12.js`, `app/shots/lib2/**` |
| ANIM3 | `app/shots/s13.js` ... `app/shots/s19.js`, `app/shots/lib3/**` |
| MUSIC | `tools/audio/music/**`, `audio/music/**` |
| SFX | `tools/audio/sfx/**`, `tools/audio/mix/**`, `audio/sfx/**` (owns the final mix) |
| REVIEW | `rubric/**`, `tools/score.mjs`, `tools/score/**`, `docs/RUBRIC.md`, `docs/reviews/**` |

Shared read-only helpers that anyone may import: `app/core/prng.js`, `app/core/edit.js`,
`app/core/layout.js`, `app/scene/letters.js`, `app/shots/common.js` (director; small helpers:
lens-to-FOV, look-at, held-frame sampling, spline evaluation).

## The shot module (ANIM1-3 write these; the director's harness runs them)

```js
// app/shots/s08.js
export default {
  id: 'S08',
  needs: {                                 // what the harness must build for this shot
    sets: ['kitchen'],                     // 'kitchen' | 'nest'
    characters: [{ key: 'courier', variant: 'courier', lod: 0 }],
    props: ['mug', 'crumb', 'sugarGrains'],
    water: false,
  },
  setup(ctx) { return {}; },               // once per shot; ctx described below; returns shot-local memo
  frame(f, ctx, memo) {                    // LOCAL frame 0..n-1 (n from edit.js); pure in f
    return {
      camera: { position: [x,y,z], target: [x,y,z], up: [0,1,0], fovY },   // on 1s
      // or cameras: [{ rect: [x,y,w,h], position, target, up, fovY }] for split panels
      held: false,                         // true if ALL character poses repeat f-1 (motion = 0)
      characters: { courier: antState },   // already cadence-quantised
      props: { mug: {...}, crumb: {...} }, // per-prop state (contracts below)
      sets: { kitchen: { clock: '11:58', lights: 1 } },
      water: null,                         // or water state (below)
      fx: [ { kind: 'speedLines', ... } ],  // 2D FX cues (FX2D contract)
      lettering: [ { text, anchor, rot, scale, style, color, t } ],
      panels: null,                        // or { kind, rects, captions: [{ text, rect }], t }
      post: { flash: null, glitch: 0, universe: null, transition: null },
      look: {},                            // per-frame overrides merged over lookdev's shot look
    };
  },
};
```

`ctx` = `{ THREE, edit, layout, prng, common, assets, shot, n }` where `assets` holds the
built objects (`assets.characters.courier`, `assets.props.mug`, `assets.sets.kitchen`, ...).
Shot modules must NOT create scene objects except shot-specific rigging helpers; they return
state and the harness applies it via each asset's `setPose` / `setState` / `update`.

Screen anchors for FX: if a cue needs a character's screen position, give its world position
as `anchorWorld: [x,y,z]` (optionally `anchorOffset: [dx,dy,dz]`) or name the subject with
`anchorOf: 'courier' | '<prop name>'` and the harness projects it into `anchor: [u,v]`;
`pathWorld: [[x,y,z], ...]` becomes `path: [[u,v], ...]` (ribbons, arcs). Or give `anchor`
directly in normalised screen space (origin bottom-left).

Harness extensions (implemented in `app/main.js`):

- Crowd: `needs.colony = { count, seed, lod }` builds `createColony(...)`; return
  `colony: [antState | null, ...]` from `frame()` (null hides that member). Individually named
  extra ants also work: list them in `needs.characters` with their own `key`/`variant`.
- Carry: a character state with `carry: '<prop>'`, or a prop state with `attachedTo: '<character key>'`,
  parents the prop to that character's `parts.carryHook`; optional prop `carryOffset: [x,y,z]`.
- Camera extras: `near`, `far`, `roll` (radians) are honoured.
- Transitions come from `edit.js` `transitionIn` (whip 6 f, inkWipe 10 f, panelWipe 10 f,
  fadeIn 14 f); the outgoing shot is held on its last frame underneath. `post.transitionDir`
  sets the whip direction.
- `frame(f)` may be called with any f in `0..n-1` in any order (pre-roll, cue export), so it
  must be pure.
- Sound: `sfx: [{ cue: 'footstep', pan: -0.3, gain: 0.8, material: 'formica' }, ...]` - exported to
  `out/cues/sfx_cues.json` by `tools/export-cues.mjs` with global frame numbers.

## Characters (CHAR): `app/assets/characters/ant.js`

```js
export function createAnt({ THREE, look, variant, lod = 0, seed = 0 }) -> {
  root,            // local +X forward, +Y up, origin on the ground under the thorax
  setPose(state),
  parts,           // head, mandibleL/R, thorax, petiole, gaster, antennaL/R, legs[6], eyes
  audit(),         // { triangles, meshes, setae }
}
// variant: 'courier' | 'little' | 'sibTall' | 'sibRound' | 'worker'
// lod: 0 hero (<= ~80k tris), 1 mid (<= ~15k), 2 crowd (<= ~3k)
export function createColony({ THREE, look, count, seed }) -> { root, members: [ant...], setPoses(states[]) }
export const POSES;                  // named presets (idle, alert, sprint, climb, heave, hoist, skid,
                                     // leap, land, paddle, dangle, chainLink, eat, antennaTouch, ...)
export function gait(phase, speed);  // helper returning leg targets for an alternating tripod
```

`antState` (every field optional):

```js
{ position: [x,y,z],   // world mm, ground contact under the thorax
  heading: 0,          // yaw about the surface normal; 0 faces +X
  up: [0,1,0],         // surface normal (wall-runs, climbing the board, dangling)
  pitch: 0, roll: 0, bob: 0,
  gait: { phase: 0, speed: 0, stride: 2.2 },
  legs: null,          // optional [6] world-space foot targets (overrides gait) or null
  legPose: null,       // optional named per-leg pose ('tuck', 'reach', 'brace', 'flail')
  headYaw: 0, headPitch: 0,
  antennae: { L: { yaw, pitch, curl }, R: { yaw, pitch, curl } },
  mandibles: 0,        // 0 closed .. 1 wide
  gasterLift: 0,
  stretch: 1,          // volume-preserving squash/stretch along heading
  smear: 0,            // 0..1 leg/antenna multiples for smear frames
  eyes: { widen: 0, squint: 0, lookX: 0, lookY: 0, blink: 0 },
  carry: null,         // name of a prop to hold in the mandibles ('crumb'); harness parents it
  contactShadow: 1 }   // 0..1 strength of the designed contact shadow
```

## Sets

```js
// KITCHEN: app/assets/sets/kitchen.js
export function createKitchen({ THREE, look }) -> { root, update(frame, state), audit() }
// state: { clock: '11:58', lights: 0..1, moon: 0..1, wet: 0..1 (counter wetness), windowNeon: 0..1 }
// NEST: app/assets/sets/nest.js
export function createNest({ THREE, look }) -> { root, update(frame, state), anchors, audit() }
// root is placed at layout.NEST.interiorOrigin; anchors = { larder, nursery, entranceInside, ... } in world mm
```

## Props (PROPS): `app/assets/props/index.js`

```js
export function createProp(name, { THREE, look }) -> { root, setState(state), audit() }
// 'crumb'       { position, rotation: [x,y,z], attachedTo: null | 'courier', squash, sparkle }
// 'mug'         { position, y, tilt: [x,z], squash, coffeeSlosh }        origin = foot-ring centre
// 'sponge'      { position, rotation, squash, wet }                      origin = bottom centre
// 'cap'         { position, rotation, bob, spin, wet }                   origin = bottom centre
// 'toothpick'   { position, rotation, heldBy: null | 'courier' }         origin = one tip
// 'cuttingBoard'{ }                                                     static, at layout position
// 'sugarGrains' { jump, frame, scatter }                                  instanced, world space
// 'hand'        { position, rotation, grip, visible }                    big stylised graphic hand
// 'spoon'       { }                                                      landmark on the counter
```

## Water (WATER): `app/assets/water/water.js`

```js
export function createWater({ THREE, look }) -> { root, setState(frame, state), audit() }
// state: { level: 0..1 (flood extent), flow: 0..1, torrent: 0..1 (the pour from the sponge),
//          dropFall: 0..1 (waterfall at the sink edge), ripples: [{x,z,t}], capWake: [x,z] | null }
```

Stylised, never photographic: flat colour bands, hard graphic highlight shapes, ink ripple
lines, drawn foam shapes, halftone in depth. Built with `look.makeLookMaterial` (plus any
water-specific material LOOK exposes).

## Look (LOOK): `app/core/materials.js`, `app/core/renderer.js`, `app/core/lookdev.js`

```js
// materials.js
export const LIGHTS;                 // shared uniforms; setLightRig() updates every material at once
export function setLightRig(rig);
export function makeLookMaterial(p) -> THREE.ShaderMaterial    // writes the G-buffer
// p: { color, map, vertexColors, matId (0..15), shadowTint, rim, rimColor, gloss, inkWeight,
//      inkColor, normalQuant, bandShift, screen ('object'|'screen'|'triplanar'|'uv'),
//      screenScale, halftone (0..1 selective halftone amount), brush (0..1 painterly breakup),
//      glow, side, transparent, opacity, flatSilhouette }

// renderer.js
export function createLookRenderer({ width = 1920, height = 804, supersample = 1 }) -> {
  renderer,
  beginFrame(frame, { held }),       // rolls previous matrices unless held
  renderView({ scene, camera, look, rect = [0,0,1,1] }),
  compositeTexture(),
  applyPass(fn),                     // fn(inputTexture, outputTarget)
  drawOverlay(scene, camera),        // 2D FX layer
  finish({ frame, look }),           // print pass: frame-locked grain, vignette, resolve
  readPixels(),                      // Uint8Array RGBA WIDTH x HEIGHT, top row first
}

// lookdev.js
export function lookForShot(shotId, f, globalFrame) -> look   // the colour script per shot
```

## Effects

```js
// FX2D: app/fx/fx2d.js - orthographic overlay drawn over the composite, everything on 2s
export function createFx2D({ THREE }) -> { scene, camera, update(globalFrame, { fx, lettering, panels }), audit() }
// fx kinds: speedLines, radialBurst, zipRibbon, arcRibbon, crackle (Kirby), impactFlash,
//   shockRing, debrisSpray, splash (coffee|water), sparkle, idea, growl, sweat, motionArc,
//   dustPuff, tears, heartPop, caption
// FXPOST: app/fx/post.js - full-screen passes run through renderer.applyPass
export function createPost({ THREE, renderer }) -> {
  glitch(input, output, { amount, frame, seed }),
  universe(input, output, { style: 'punk' | 'watercolor' | 'graphite', amount, frame }),
  flash(input, output, { field, silhouette, accent, frame }),     // graphical flash frames
  transition(inputA, inputB, output, { kind: 'whip' | 'inkWipe' | 'panelWipe' | 'fadeIn', t, dir }),
}
```

## Sound (MUSIC + SFX)

- MUSIC: `python3 spiderverse/tools/audio/music/build.py` -> `spiderverse/out/audio/music/score.wav`
  + stems, keyed to `edit.js` (`SYNC`, `SHOTS`). Parse with
  `node -e "import('/workspace/spiderverse/app/core/edit.js').then(m=>console.log(JSON.stringify(m)))"`.
- SFX: `python3 spiderverse/tools/audio/sfx/build.py` -> `out/audio/sfx/*.wav`, and
  `python3 spiderverse/tools/audio/mix/build.py` -> `spiderverse/out/audio/mix.wav`
  (48 kHz, 24-bit stereo, exactly `DURATION_SECONDS`, -16..-14 LUFS integrated, true peak
  <= -1 dBTP). Shot modules may export extra sound cues via `frame().sfx = [...]`; the harness
  writes them to `out/cues/sfx_cues.json` for SFX to consume.

## Review (REVIEW)

`node spiderverse/tools/score.mjs --frames <dir>` -> `out/score/score.json` + `score.md`.
Written reviews go to `docs/reviews/<date>-<subject>.md`.
