# PHASE 1 — REFERENCE-DRIVEN AAA THREE.JS WORLD RECREATION — ULTRA LONG BUILD

First search for the `/unlazy` skill, read it completely, and use it throughout the entire task.

## CONTEXT

This is **PHASE 1** of a larger browser game project.

The final project will later include:
- player character
- movement and animation
- combat/game systems
- enemies
- UI
- content and progression

**For this phase, build ONLY THE WORLD.**

Do not spend meaningful time on the final player, combat, enemies, HUD, menus, inventory, quests, or progression yet.

The entire goal of this run is to create an exceptionally detailed, polished, real-time **Three.js world** that can become the foundation of the full game later.

This task will run inside **Cursor** using an Anthropic/Claude coding agent. Treat it like a serious overnight production run, not a quick prototype.

I will also sometimes run another coding agent against the same project in parallel, so the repository must be organized for safe multi-agent collaboration. Follow the collaboration protocol below carefully.

---

# PRIMARY VISUAL REFERENCE

I have attached a gameplay/reference video from the new Zelda game.

Treat the attached video as the **primary visual reference**.

Before building, study it carefully.

Watch it several times and inspect individual frames.

Analyze:
- terrain composition
- world scale
- hills, cliffs, valleys and paths
- tree silhouettes
- white-bark trees
- vegetation density
- grass coverage
- rocks
- ground materials
- foreground / midground / background layering
- distant horizons
- lighting direction
- shadow softness
- atmospheric perspective
- sky
- color palette
- rendering clarity
- camera height
- environmental detail
- how dense the world feels without becoming visually noisy

Do not merely identify it as “Zelda-like” and then generate a generic fantasy forest.

Recreate the **specific environmental character and composition language** shown in the supplied footage.

The target is the same beautiful stylized-natural visual direction, but with:
- substantially more fine detail
- denser vegetation
- stronger close-range geometry
- richer materials
- cleaner rendering
- less excessive blur
- better ground coverage
- better contact between assets and terrain
- more environmental micro-detail

Do not turn it into gritty photorealism.

Preserve the clean, colorful, readable, stylized-realistic art direction of the reference while pushing detail and polish beyond it where technically possible.

Use original or legally reusable assets. Do not extract or reuse proprietary Nintendo/Zelda assets.

---

# EXISTING THREE.JS FOREST — IMPORTANT

Use this existing repository as a major starting point:

https://github.com/Leonxlnx/verdant-forest

Clone it and inspect it before rebuilding forest systems from scratch.

This is an existing Three.js forest project and contains useful code, assets, vegetation systems, materials and environment work.

**The white-bark / white-trunk trees in this repository are especially important.**

I like their visual language and want them to be a major foundation for the new world.

Do not replace them with worse generic procedural trees.

Study how they are built and then:
- reuse them where appropriate
- improve their geometry
- improve their bark
- improve branching
- improve foliage
- add more variants
- improve silhouette diversity
- integrate them naturally into the reference-driven world

Also inspect Verdant Forest for reusable systems involving:
- grass
- foliage
- bushes
- ground vegetation
- tree placement
- wind
- instancing
- shaders
- terrain
- atmosphere
- fog
- lighting
- materials
- performance optimization

Do not blindly copy the old scene.

Treat Verdant Forest as a **technical and asset foundation**.

The attached gameplay video remains the final authority for:
- composition
- density
- color
- visual direction
- world identity

If Verdant Forest and the attached reference disagree visually, adapt Verdant Forest to the reference.

---

# LONG-HORIZON REQUIREMENT

This is an **ULTRA LONG BUILD**.

Spend **at least 10 hours** actively improving the project.

10 hours is the minimum, not the target.

Prefer **12–20 hours** if useful.

Do not stop when:
- the scene first renders
- the basic terrain exists
- trees have been placed
- it looks good from one camera
- a first playable preview exists
- the build passes
- one screenshot looks impressive

The first functional version should be considered an early checkpoint.

The majority of the run should be spent on:
- implementation
- visual comparison
- asset work
- geometry refinement
- shader/material refinement
- vegetation refinement
- optimization
- screenshot inspection
- fixing weak details
- repeated revision

If the scene still clearly looks like a procedural browser demo beside the reference, keep working.

---

# QUALITY TARGET

Treat this like an **AAA environment-art project that happens to run in a browser**.

The target is not:

> “Very good for Three.js.”

The target is:

> “This looks like a polished scene from a modern high-budget stylized game, and somehow it is running in Three.js.”

It must survive:
- wide cinematic shots
- normal gameplay distance
- slow camera movement
- ground-level exploration
- tree closeups
- rock closeups
- grass closeups
- high-resolution screenshots

Avoid the common procedural/browser look:
- low-poly terrain
- smooth noise blobs
- obvious Perlin displacement
- generic generated textures
- flat vegetation cards everywhere
- repeated tree clones
- repeated rock clones
- empty ground
- floating plants
- visibly intersecting assets
- plastic foliage
- bad tree roots
- stretched textures
- obvious texture tiling
- blurry image quality
- excessive bloom
- excessive fog
- haze hiding missing detail

---

# WORLD COMPOSITION

Reconstruct the broad environment structure shown in the attached reference.

Pay attention to:
- major elevation changes
- distant mountains/hills
- valleys
- paths
- ridges
- cliffs
- clearings
- tree masses
- open areas
- dense vegetation areas
- landmarks
- foreground framing
- background silhouettes
- horizon layering

Do not create one random procedural terrain and scatter assets over it.

The world should feel **authored and composed**.

Build enough surrounding environment that future player movement will not immediately expose an empty set, but concentrate maximum detail where it actually matters.

---

# TERRAIN

Build terrain detail at several scales.

## Macro scale
- hills
- valleys
- major slopes
- cliffs
- ridges
- plateaus
- distant landforms

## Medium scale
- erosion
- secondary ridges
- ledges
- natural terraces
- rock formations
- terrain channels
- path transitions
- slope breakup

## Small scale
- stones
- exposed roots
- dirt patches
- minor rocks
- cracks
- grass clumps
- fallen branches
- subtle depressions
- tiny elevation variation

## Micro scale
- soil roughness
- moss
- leaf litter
- tiny plants
- pebbles
- material breakup
- color variation
- contact detail

Do not let the terrain read as a displaced plane.

---

# WHITE TREES + FOREST SYSTEM

The trees should be one of the strongest visual signatures of the world.

Use the Verdant Forest white trees as the starting point.

Push them much further.

Pay obsessive attention to:
- trunk taper
- trunk irregularity
- bark breakup
- white/gray bark variation
- subtle scars and dark markings
- branching hierarchy
- branch thickness
- branch angles
- asymmetric growth
- crown shape
- leaf clustering
- tree age
- silhouette variety
- roots entering terrain
- contact shadows
- dead branches
- young trees
- mature trees

Create many believable variants rather than rotating the same model.

Avoid:
- cylinder trunks
- spherical leaf clusters
- obvious tree clones
- perfectly vertical trees
- identical crown shapes

The white trees should feel recognizable as part of the existing Verdant visual language while being substantially better than the original versions.

---

# VEGETATION DENSITY

Push vegetation density extremely hard.

Create:
- dense grass
- short grass
- tall grass
- weeds
- flowers
- ferns
- bushes
- shrubs
- moss
- saplings
- tiny plants
- ground cover
- roots
- fallen branches
- dead leaves
- natural debris

Empty ground should be rare unless the reference intentionally has open terrain.

Grass should exist in very large quantities using efficient rendering.

Use:
- GPU instancing
- optimized geometry
- procedural placement
- LOD
- culling
- shader-based movement

Grass needs believable variation in:
- height
- width
- orientation
- color
- density
- clustering
- species/type
- wind response

Do not make every blade move with one synchronized sine wave.

---

# GROUND DETAIL

Ground quality matters enormously.

Do not allow beautiful trees to sit on a flat green/brown surface.

Layer:
- dirt
- soil
- moss
- roots
- rocks
- tiny stones
- dead foliage
- twigs
- leaves
- weeds
- low plants
- erosion
- material transitions
- color transitions
- damp/dry variation where appropriate

Every major asset should feel physically connected to the terrain.

Use contact shadows, local material variation, root integration, small debris and terrain deformation to prevent the “objects placed on a plane” look.

---

# ROCKS + GEOLOGY

Avoid random smooth blobs.

Create convincing stylized geology using:
- fractured silhouettes
- cracks
- ledges
- layering
- erosion
- rubble
- scree
- moss
- embedded stones
- plants growing around/through rock
- different rock scales

Large rocks should contain secondary and tertiary detail.

Use original/legally reusable assets or generated geometry, but keep them coherent with the reference.

---

# MATERIALS

Do not rely on random texture generation.

Materials should correspond to physical structure.

Use layered materials with:
- macro color variation
- fine roughness variation
- normal/detail maps
- local dirt
- moss
- edge variation
- slope-dependent blending
- subtle AO/contact darkening
- weathering
- surface imperfections

Keep rendering clean and crisp.

The reference has a soft stylized quality, but do not confuse that with blur.

I specifically want **less muddy/blurry rendering** and stronger material definition.

---

# LIGHTING

Study the reference and match its lighting before trying to “improve” it.

Analyze:
- sun direction
- sun elevation
- shadow length
- shadow softness
- sky contribution
- bounced light
- exposure
- color temperature
- contrast

Then refine it.

Lighting should:
- reveal tree silhouettes
- separate foreground/midground/background
- create believable contact with the terrain
- give grass and foliage depth
- preserve readable colors
- maintain atmospheric scale

Avoid excessive bloom and generic orange/teal grading.

---

# ATMOSPHERE + DISTANCE

Create deep environmental layering.

Use:
- atmospheric perspective
- subtle haze
- distant fog where justified
- layered distant terrain
- distant trees
- clouds
- soft sunlight interaction
- subtle particles only where useful

Do not use fog to hide unfinished terrain.

Foreground and midground should remain crisp.

The distant world should not end in a cheap fog wall.

---

# WIND + WORLD MOTION

The environment should feel alive.

Create layered wind behavior:
- grass responds quickly
- flowers and small plants react lightly
- leaves flutter
- small branches move
- larger branches bend slowly
- trunks barely move
- bushes move differently from trees

Use gust variation and spatial variation.

Avoid one global synchronized animation.

---

# REFERENCE COMPARISON LOOP — REQUIRED

This is one of the most important parts of the task.

Repeatedly perform this loop:

1. Inspect the attached gameplay reference.
2. Capture the current Three.js build from a similar viewpoint.
3. Compare them side-by-side.
4. Identify the biggest differences.
5. Fix those differences.
6. Capture again.
7. Repeat.

Do this throughout the full overnight run.

Do not rely on memory.

Ask repeatedly:

- Why does the reference look more expensive?
- Why does our version still look procedural?
- Where is ours emptier?
- Are the white-tree silhouettes good enough?
- Is the ground detailed enough?
- Are the rocks too simple?
- Is the image blurrier than the reference?
- Are materials too flat?
- Are distant layers weak?
- Does anything visibly repeat?
- Which single change would most improve the next screenshot?

Attack the largest quality gaps first.

If a system is fundamentally weak, rebuild it instead of endlessly parameter-tuning it.

---

# MAJOR ITERATION PASSES

After the initial world exists, perform substantial dedicated passes for:

1. reference composition
2. terrain macro forms
3. terrain medium detail
4. white-tree geometry
5. tree diversity
6. foliage quality
7. grass density
8. small vegetation
9. ground detail
10. rock/geology quality
11. material realism
12. lighting
13. contact shadows
14. wind
15. atmosphere
16. distant-world quality
17. close-range detail
18. rendering clarity / blur reduction
19. natural imperfection
20. performance
21. final reference matching

These are not a checklist to speedrun.

Each pass should materially improve the final result.

---

# PERFORMANCE

This must remain a real-time Three.js environment.

Engineer around browser constraints using techniques such as:
- instancing
- GPU vegetation
- LOD
- frustum culling
- distance culling
- spatial chunking
- optimized shadows
- texture atlases
- detail textures
- shader optimization
- adaptive quality
- selective high-detail zones

Do not solve performance by making the world empty.

Prefer intelligent optimization.

---

# DEVELOPMENT CAMERA

For Phase 1, implement only what is useful for world development:

- smooth free-camera exploration
- a few saved/reference camera viewpoints
- optional debug quality controls if useful

Do not spend time on final player movement or gameplay camera systems yet.

---

# MULTI-AGENT / GIT COLLABORATION PROTOCOL

Two coding agents may work on this repository in parallel.

One will be running from this Cursor session, while another agent may be started by me separately.

You MUST structure the repository so both agents can safely understand each other's work and avoid overwriting it.

## Git workflow

Never do long-running work directly on `main`.

For each substantial work session:

1. Fetch/pull the latest repository state.
2. Inspect recent commits and open PRs before editing.
3. Create or continue a clearly named branch.
4. Make coherent commits throughout the work.
5. Push the branch.
6. Open or update a PR back toward the shared integration branch / main as appropriate.
7. Before merging or doing large refactors, check whether the other agent has touched the same systems.

Prefer small, understandable commits over one enormous final commit.

Example branches:

`agent/fable-world-terrain`
`agent/fable-vegetation-pass`
`agent/leon-materials`
`agent/leon-lighting`

Use descriptive names rather than exactly these examples when another name is clearer.

## Shared agent communication files

Create an `AGENTS.md` file at the repository root if it does not already exist.

`AGENTS.md` is the persistent collaboration protocol and must explain:
- project goal
- current phase
- important architectural rules
- branch/PR workflow
- directories/systems that should not be casually rewritten
- how agents communicate
- how to check what another agent recently changed

Also create:

`.agents/`

Each agent should maintain its OWN file instead of constantly editing one shared log.

For example:

`.agents/fable-cursor.md`
`.agents/leon-agent.md`

Do not assume these exact names if a better stable agent identifier is available.

Each agent log should contain:

### Current task
What this agent is currently working on.

### Files/systems being touched
Enough detail that the other agent can avoid colliding with the same system.

### Completed work
Short summaries with relevant commit hashes / PR links when available.

### Important decisions
Architecture, rendering, asset, performance or visual decisions the other agent needs to know.

### Known issues
Current bugs, weaknesses or unfinished work.

### Recommended next work
Useful tasks the other agent can safely pick up.

### Last updated
Timestamp.

Update your OWN agent log:
- before beginning a major task
- after completing a meaningful subsystem
- before finishing the session

Before starting a new large task, read:
- `AGENTS.md`
- all files in `.agents/`
- recent commits
- currently open relevant PRs

This is required.

## Avoiding conflicts

If another agent is clearly working on the same system:
- do not blindly overwrite their work
- inspect their branch/PR if available
- choose another useful subsystem when possible
- otherwise integrate/rebase carefully and document the overlap

Prefer parallel work on separable systems such as:
- terrain
- vegetation
- materials
- atmosphere
- optimization
- reference capture tooling

Do not create needless merge conflicts by having both agents rewrite the same central file if the system can be modularized.

Refactor the codebase into sensible modules when doing so materially helps parallel work.

## Handoff state

Maintain a concise `PROJECT_STATE.md` at repository root.

This should describe only the current shared state:
- current phase
- latest integrated milestone
- what already works
- biggest visual weaknesses
- current performance situation
- next major priorities

Keep this concise.

Unlike individual `.agents/*.md` logs, `PROJECT_STATE.md` should only be updated when a meaningful shared milestone changes.

If editing it would conflict with another active branch, prioritize your own `.agents/<agent>.md` log and update shared state after integration.

---

# DO NOT CHEAT

Do not:
- use the reference gameplay video as scenery
- use a prerendered video instead of the real world
- rip Nintendo/Zelda assets
- extract proprietary textures/models
- use a single AI-generated image as the environment
- fake close-range detail with a flat background
- hide unfinished areas behind excessive fog

The environment itself must genuinely exist in real-time Three.js.

---

# FINAL REVIEW

When you think the world is finished:

Do not stop immediately.

Spend additional time slowly inspecting it.

Check:
- grass at close range
- white-tree bark
- tree branches against sky
- foliage clusters
- roots touching ground
- rocks
- ground transitions
- material tiling
- distant scenery
- atmosphere
- LOD transitions
- repeated assets
- lighting
- rendering clarity

Then improve the weakest areas again.

The world should survive slow camera inspection, not only one hero screenshot.

---

# SUCCESS STANDARD

When compared with the attached gameplay reference, the Three.js version should preserve:
- environmental identity
- world composition
- vegetation character
- white-tree language
- color palette
- lighting feeling
- atmosphere
- scale
- stylized readability

while ideally improving:
- fine geometric detail
- rendering clarity
- grass density
- ground density
- close-range vegetation
- material definition
- environmental micro-detail

The final reaction should not be:

> “Pretty impressive for a browser.”

It should be:

> “wtf, this looks like an actual modern game world running in Three.js.”

---

# PHASE BOUNDARY

This task is **WORLD ONLY**.

Do not start the final:
- player
- enemies
- combat
- UI
- inventory
- quests
- progression

Those will be separate phases after the environment is strong enough.

At the end of the session:

1. Push all useful work to your branch.
2. Open/update the appropriate PR.
3. Update your `.agents/<agent>.md` log.
4. Update `PROJECT_STATE.md` if a major shared milestone changed.
5. Leave the repository in a buildable state.
6. Provide a concise final report including:
   - branch
   - latest commit
   - PR
   - systems completed
   - important files changed
   - current visual weaknesses
   - recommended next task for the other agent.

Do not prematurely merge unrelated parallel work without checking the other agent's state.

Use the full overnight runtime and keep iterating on the world.
