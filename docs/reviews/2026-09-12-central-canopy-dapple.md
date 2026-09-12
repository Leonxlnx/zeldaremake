# A bounded central-canopy shadow study

Independent source after lawn9eb9debc31c3b8dec579d75e9315ec6322c217bd. Root fetched the latest
partner state and announced trees/corridors.ts scope in PR2 comment5647405366; Fable's active
structures and shared-sprout RNG work remain separate. This is a canopy composition experiment
for owner boards01/02, not a demonstrated PCSS/AO bug or a global lighting adjustment.

The central opening at (2.7,3.0), radius2.2, clears a broad sun pool on A/F paving. Its existing
radius, height band10-30m, collar, geometry generator and positional survival hash stay fixed.
Only leaf/card survival becomes .35. Link's separately cleared rays/pool, every other opening,
wood, low hero foliage, lights, atmosphere, wind and postfx remain unchanged. The restored
foliage is real visible geometry using ordinary alpha-tested color/shadow materials.

## Evidence and cost

A pinned CPU tree build restores99 leaves and32 existing cards:623 vertices,460 scene triangles,
zero new meshes/materials/textures/programs/calls. Only existing lantern-tree and north-west-near
leaf/card meshes grow. Every original vertex/attribute/triangle is retained as an exact ordered
subsequence after index remapping; all instanced geometry/payloads and wood/contacts remain exact.

All7,323,342 draws over107 observed geometry streams and the evaluated world RNG tail match.
Material construction was stubbed, so this does not claim execution of full-world texture RNG.
Material/texture sources are unchanged. CPU frustum estimates show +460 color triangles per
camera and at most +460 shadow triangles before shadow-frustum clipping; actual multi-pass
counts and GPU timing still require the capture. No exact +920 renderer total is assumed.

An opaque-triangle upper bound on a5cm sun-plane grid covers37.95% of the opening and36.51%
of its .8-1.6m middle band. Two outer angular sectors are fully clear. This reaches inward
without a continuous ring, but a large connected footprint remains a broad-dark-lobe risk.
Real alpha, wind, existing occlusion and PCSS were not evaluated by that geometric grid; its
percentages are not predicted shadow coverage. Cards use existing ragged leaf-cluster alpha.

A12% source-only probe was too edge-heavy; a100% diagnostic ceiling established that interior
casters exist. Only the35% candidate is proposed. No random seed/positions were changed to
choose favorable foliage, and the ceiling must not be applied automatically.

## Prior work and actual decision

Original source documents larger roof cuts rejected against footage: five large lobes cost
F .0044/C .0016 SSIM; another western/northern arrangement cost F .0030/C .0021. Those are
partner's historical measurements, not new reruns. We preserve that reasoning while testing a
narrow change against the owner's later boards with irregular leaf shade. Scoring targets,
reference files, cameras and locked rubric are unchanged.

Typecheck/build (109 modules), exact one-file production boundary and existing real-opening shaft contracts pass. Actual historical matching
variants against9eb decide retention: inspect A/F paving, C lookback, Link/roof visibility and
all world budgets. Keep useful broken leaf shade with clear warm paving; reject a broad dim
lobe, circle, noisy streaks or loss of the character's clear pool. Revert the single entry if
it fails; do not compensate with global exposure/fill or increase automatically to the ceiling.

The frozen one-line source proposal SHA256 is
a247a11d8f0a7b59b4eb3a5a9c2f356118c348e96de349d072fb719dd4f608a1.
Applied source adds only a clarifying historical-footage/current-board comment beyond it.
No visual acceptance or moving-camera stability claim is made before actual review.

Applied corridors SHA256: fc99f3ad328409b70b28e19d5b5cf0d7071e9ca2924551f00d0f0a16c513fd05.
