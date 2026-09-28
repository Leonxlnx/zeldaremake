# Module contracts (frozen)

Eight people are building this at the same time. It only works because these boundaries do not
move. If you need a contract changed, say so in your final report - do not change it
unilaterally.

- Timing: `app/core/beats.js` (24 fps, 240 frames, 1920x803 delivery, 2.39:1).
- Placement: `app/core/layout.js` (millimetres, +Y up, tabletop is `y = 0`, action runs +X).
- Randomness: `app/core/prng.js` only. **No `Math.random`, no `Date.now`, no
  `performance.now` in anything that affects pixels.** Every frame must be reproducible.
- three.js r186, loaded as an ES module from `/node_modules/three/build/three.module.js`
  (the static server maps the repo root, so `import * as THREE from '/node_modules/three/build/three.module.js'`
  works in the browser). Use an import map in HTML: `"three": "/node_modules/three/build/three.module.js"`
  so modules can `import * as THREE from 'three'`.
- No bundler. Plain browser ES modules under `spiderverse/app/`.

## File ownership

| Owner | Files |
| --- | --- |
| director (integration) | `app/index.html`, `app/main.js`, `app/core/beats.js`, `app/core/layout.js`, `tools/serve.mjs`, `tools/render.mjs`, `tools/assemble.mjs`, `docs/*` except your own report |
| LOOK | `app/core/materials.js`, `app/core/renderer.js`, `app/core/shaders/**`, `app/scene/lookdev.js`, `tools/preview-look.mjs`, `app/preview-look.html` |
| ANT | `app/scene/ant.js`, `app/scene/ant/**`, `tools/preview-ant.mjs`, `app/preview-ant.html` |
| SET | `app/scene/set.js`, `app/scene/set/**`, `tools/preview-set.mjs`, `app/preview-set.html` (tabletop, monuments, window/city/neon, pendant lamp; composes PROPS) |
| PROPS | `app/scene/props/**`, `tools/preview-props.mjs`, `app/preview-props.html` (mug, crumb, sugar packet, sugar grains) |
| PERFORM | `app/scene/perform.js`, `app/scene/cameras.js`, `tools/previs.mjs`, `app/previs.html` |
| FX2D | `app/scene/fx2d.js`, `app/scene/fx2d/**`, `tools/preview-fx2d.mjs`, `app/preview-fx2d.html` |
| UNIVERSE | `app/core/universes.js`, `app/core/glitch.js`, `tools/preview-universe.mjs`, `app/preview-universe.html` |
| SOUND | `tools/audio/**`, `audio/**` |
| RUBRIC | `rubric/**`, `tools/score.mjs`, `tools/score/**`, `docs/RUBRIC.md` |
| (done) | `app/scene/letters.js` - hand-lettered vector comic faces, already authored |

Outputs go under `spiderverse/out/<owner>/` (gitignored). Nobody runs git - the director commits.

## `app/core/materials.js` (LOOK)

```js
export const LIGHTS;                  // shared uniform objects; every look material references
                                      // the SAME objects, so setLightRig() updates all of them
export function setLightRig(rig);     // rig: see lookdev.js
export function makeLookMaterial(p) -> THREE.ShaderMaterial   // writes the 4-target G-buffer
```

`p` (all optional except `color`):

| Field | Meaning |
| --- | --- |
| `color` | albedo, hex or `THREE.Color` |
| `map` | albedo texture (multiplied), e.g. a procedurally generated `DataTexture`/`CanvasTexture` |
| `vertexColors` | multiply albedo by the `color` attribute |
| `matId` | integer 0..15, selects the per-material look row (band edges, screen, ink) |
| `shadowTint` | hue-shifted shadow colour (Spider-Verse shadows are never grey) |
| `rim` / `rimColor` | rim-light strength and colour (neon rims) |
| `gloss` | 0..1 size of the designed hard specular shape |
| `inkWeight` / `inkColor` | how strongly this surface draws ink lines, and their colour (never pure black) |
| `normalQuant` | 0..1 quantise normals so terminators snap to designed facets |
| `bandShift` | -0.5..0.5 nudges the Thresher band edges for this material (designed shadow shapes) |
| `screen` | `'object'` (default for props/characters), `'screen'`, `'triplanar'`, `'uv'` |
| `screenScale` | multiplies the dot/hatch pitch for this material |
| `glow` | emissive amount; also feeds the screen-locked highlight/glow screen |
| `side` | `THREE.FrontSide` (default) / `THREE.DoubleSide` |
| `flatSilhouette` | colour used for this object in flash frames (default deep shadow) |

Motion vectors: every mesh using a look material stores its previous-frame world matrix; the
material writes screen-space motion into the G-buffer. Rigid hierarchies only (the ant is an
exoskeleton - no skinning anywhere in this production). Call
`lookRenderer.beginFrame(frame)` before posing so previous matrices roll over correctly, and
**do not roll previous matrices over on held frames** (a held pose has zero motion).

### G-buffer layout

| Target | Format | Contents |
| --- | --- | --- |
| `g0` | RGBA16F | `beauty.rgb` (smooth lit colour, linear), `matId / 16` |
| `g1` | RGBA16F | `lumaLighting` (lighting term WITHOUT albedo), `glow`, `motion.xy` (px) |
| `g2` | RGBA32F | `screenCoord.xy` for the chosen screen projection (object/triplanar/uv/screen), `viewDepth`, `objectId` |
| `g3` | RGBA16F | `viewNormal.xyz`, `inkWeight` |

## `app/core/renderer.js` (LOOK)

```js
export function createLookRenderer({ canvas, width = 1920, height = 803, supersample = 1 }) -> {
  renderer,                                   // THREE.WebGLRenderer (WebGL2)
  beginFrame(frame, { held }),                // roll previous matrices unless held
  renderView({ scene, camera, look, frame, rect = [0,0,1,1] }),
      // full look chain (G-buffer -> Thresher/Hatcher -> ink -> misregistration -> motion trail
      // -> glow screen) into `rect` (normalised x, y, w, h, origin bottom-left) of the
      // internal composite target. Camera aspect must match the rect aspect (caller's job).
  compositeTexture(),                         // -> THREE.Texture of the composite so far
  applyPass(fn),                              // fn(inputTexture, outputTarget) - lets the
                                              // universe/glitch passes run in place
  drawOverlay(scene, camera),                 // renders the 2D FX layer over the composite
  finish({ frame, look }),                    // print pass: paper grain (frame-locked),
                                              // vignette, final grade, supersample resolve
  readPixels(),                               // Uint8Array RGBA OUT_WIDTH x OUT_HEIGHT, top row first
  setSupersample(n),
}
```

`look` comes from `lookdev.js`:

```js
export function lookForFrame(frame) -> {
  world,                 // 'tabletop' | 'eclipse' | 'impact' | 'payoff' ...
  lights,                // rig passed to setLightRig
  bands,                 // Thresher: edge positions, transition widths, multipliers
  screen,                // pitch (output px), angle, dot/hatch assignment per band
  ink,                   // width px, boil step, overshoot, colour
  misreg,                // focus distance (mm), floor px, gain, max px, direction
  motionTrail,           // gain, max px
  palette,               // per-shot grade / palette remap
  background,            // clear colour / sky treatment
  flash,                 // null or { field, silhouette, lineScreen } for graphical flash frames
  grain,                 // amplitude
}
```

## `app/scene/ant.js` (ANT)

```js
export function createAnt({ THREE, makeLookMaterial }) -> {
  root,                  // THREE.Group; local +X forward, +Y up, origin on the ground under the thorax
  setPose(state),
  parts,                 // named Object3Ds: head, mandibleL/R, thorax, petiole, gaster,
                         // antennaL/R (scape, funiculus[]), legs[6] (coxa, femur, tibia, tarsus[])
  multiples,             // extra leg/antenna copies used for smear frames (hidden by default)
  audit(),               // -> { triangles, meshes, segments, setae }
}
```

`state` (every field optional, defaults = neutral standing pose):

```js
{
  position: [x, y, z],   // world mm, the ground contact point under the thorax
  heading: 0,            // yaw radians about +Y; 0 faces +X
  up: [0, 1, 0],         // surface normal the ant stands on (wall-run on the mug!)
  pitch: 0, roll: 0,     // body lean, radians
  bob: 0,                // mm, vertical body bounce
  gait: { phase: 0, speed: 0, stride: 2.2 },  // phase 0..1 alternating tripod; speed 0..1
  legs: null,            // optional array of 6 world-space foot targets (overrides gait)
  headYaw: 0, headPitch: 0,
  antennae: { L: { yaw, pitch, curl }, R: { yaw, pitch, curl } },
  mandibles: 0,          // 0 closed .. 1 wide
  gasterLift: 0,         // radians
  stretch: 1,            // squash/stretch along heading (volume-preserving)
  smear: 0,              // 0..1 enables leg multiples / stretched smear geometry
  eyes: { widen: 0, squint: 0, lookX: 0, lookY: 0 },
  carry: null,           // null or a THREE.Object3D to hold in the mandibles (the crumb)
}
```

## `app/scene/set.js` (SET)

```js
export function createSet({ THREE, makeLookMaterial }) -> {
  root,
  mug: { root, setState({ y, tilt: [x, z], squash, coffeeSlosh }) },   // root origin = foot-ring centre
  crumb: { root, setState({ attachedTo: null | Object3D, sparkle }) },
  sugarGrains,           // InstancedMesh(es); setState({ jump }) for the slam hop
  update(frame),         // neon flicker, grain hop, coffee - driven by frame only
  audit(),               // -> { triangles, meshes, instances, props }
}
```

## `app/scene/props/*.js` (PROPS) - consumed by `set.js`

```js
// mug.js    - root origin = foot-ring centre on the table, +Y up
export function createMug({ THREE, makeLookMaterial }) -> { root, setState({ y, tilt: [x, z], squash, coffeeSlosh }), audit() }
// crumb.js  - root origin = centre of the crumb's footprint on the table
export function createCrumb({ THREE, makeLookMaterial }) -> { root, setState({ attachedTo, sparkle }), audit() }
// packet.js - root origin = packet centre on the table; ridge top reported in local space
export function createSugarPacket({ THREE, makeLookMaterial }) -> { root, ridgeTopLocal: [x, y, z], audit() }
// grains.js - positioned in WORLD space from layout.js (clusters around packet, path, mug landing)
export function createSugarGrains({ THREE, makeLookMaterial }) -> { root, setState({ jump, frame }), audit() }
```

`set.js` places packet/crumb/mug at the `layout.js` positions and re-exposes them as `set.mug`,
`set.crumb`, `set.sugarGrains`.

## `app/scene/perform.js` + `app/scene/cameras.js` (PERFORM)

```js
// perform.js
export function performanceAt(frame) -> {
  ant,                   // ant state (above), ALREADY step-quantised (2s/1s/3s per beats.js)
  mug,                   // mug state
  crumb,                 // crumb state
  grains,                // { jump }
  held,                  // true if this frame repeats the previous pose (for motion vectors)
}
// cameras.js
export function cameraAt(frame, aspect) -> {
  position, target, up, fovY,     // on 1s, never stepped
  shake: [x, y],                   // screen-space shake already applied into position/target
}
export function panelCamerasAt(frame) -> Array<{ rect, position, target, up, fovY }>  // split panels
```

## `app/scene/fx2d.js` (FX2D)

```js
export function createFx2D({ THREE }) -> {
  scene, camera,         // orthographic, drawn over the composite by renderer.drawOverlay()
  update(frame, refs),   // refs: { ant: {x, y, vx, vy}, mug: {x, y, r}, crumb: {x, y}, impact: {x, y} }
                         // screen positions normalised 0..1, origin bottom-left
  audit(),
}
```

All FX update on 2s. Uses `app/scene/letters.js` for onomatopoeia and captions.

## `app/core/universes.js` + `app/core/glitch.js` (UNIVERSE)

```js
export function createUniversePass({ THREE, renderer }) -> {
  apply(inputTexture, outputTarget, { style, amount, frame }),  // 'punk' | 'graphite' | 'watercolor'
}
export function createGlitchPass({ THREE, renderer }) -> {
  apply(inputTexture, outputTarget, { amount, frame, seed }),   // layer tearing, channel split, pixel shift
}
```

## Sound (SOUND)

`python3 spiderverse/tools/audio/build.py` reads the cue sheet from `app/core/beats.js`
(`AUDIO_CUES`, parsed with a regex or via `node -e`) and writes
`spiderverse/out/audio/mix.wav` (48 kHz, 24-bit, stereo) plus stems. Pure synthesis.

## Rubric (RUBRIC)

`node spiderverse/tools/score.mjs [--frames dir]` reads `spiderverse/out/frames/frame_0000.png`
... and writes `spiderverse/out/score/score.json` + `score.md`.
