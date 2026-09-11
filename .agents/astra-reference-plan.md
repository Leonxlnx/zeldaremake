# Astra — owner reference implementation sequence

Updated 2026-09-11 06:31 UTC. The owner supplied ten concept sheets in this chat and asked
for outfit, walk/sprint, shadows/light and the depicted objects. Images were inspected locally;
their publication is not authorized. Do not upload them or put reference imagery into runtime.
The re-upload contains the same ten images. This document records implementation observations,
not a claim that the assets already exist or that their target fidelity has been reached.

## Character first
- Tunic: folded shirt collar, layered front skirt panels, subtle hem notches, visible restrained
  seams/stitches. The prominent leather diagonal should read as a continuous worn strap, with
  the secondary band less visually dominant; belt, small hip pouches, rounded metal hardware.
- Cap: close-fitting crown, long soft drape, thin leather band and an authored stitched seam.
- Hair/face: overlapping blond locks, shaped ears, softly shaded eyelids and cheeks, natural
  blue eyes. Avoid rigid floating eye discs or a featureless round mask.
- Boots: rounded toe, worn folded cuffs, lace/tongue details and sole contact preserved.
- Gear: original carved wooden shield, sheath and practical bag with visible leather joins.
- Motion: simple walk/sprint/jump; weight shift, planted feet, smooth starts/stops, stair ascent
  and descent. Assess actual continuous clips, not only still poses or numerical tests.

## Object inventory from the environment sheets
- Leaf-capped warm seed-pod lanterns, carved hanging brackets, rope wraps and knots.
- Wooden village sign, directional/multiple signboards and leaf-marked notice board.
- Mossy irregular steps and flagstones with dirt joints and ground plants.
- Living-tree houses: broad welcoming doorway, carved jambs, root base, moss/ivy roof,
  round crossed window, branch overhangs and a modest warm interior with domestic props.
- Natural branch bridge/log arch with hanging pods, vines and moss.
- Rope/wood railings; small rocks; layered fern, flower, ivy and leaf-litter clusters.
- Fairy wing detail and restrained glow/trail; background canopy and distant tree dwellings.

## Light and composition
Warm sun patches should contrast with cooler, readable canopy shade. Keep grounded object and
character shadows, controlled pod glow, hazy background depth and visible materials up close.
Place new detail through the existing layout/terrain contracts; do not silently move fixed
reference cameras or rewrite Fable's world. Preserve all locked rubric checks and existing
capture history. New concept proportions are additional visual guidance; no 95% claim yet.

## Current ownership / order
1. Finish and capture collar/strap intersection correction (Astra character files).
2. Refine the main outfit and cap against the hero sheet; capture walk/run/jump.
3. Isolated W26 lantern geometry/detail pass, preserving placement, count and light contract.
4. Apply concrete light/shadow fixes only after source review and a fresh Fable scope check.
5. Work through house/sign/ground/foliage details in coherent, independently captured passes.

Fable's source still has the pause note at `17f9217`, but its newly published take-0036 says work resumed; current subsystem scope awaits a fresh log/reply. C01/C02/C03/W26 are claimed by Astra until 07:53 UTC.
No scheduled work: the owner explicitly cancelled it; updates occur during foreground work.

Additional online visual reference: Nintendo's official Young Link fighter page,
https://www.smashbros.com/en_US/fighter/22.html (viewed 2026-09-11). Anatomy/gear reference only;
no game meshes or textures imported. The owner's concept sheets determine this project's style.

## Latest implementation checkpoint
Canonical take-0037 on2d22d24 includes the original shield/pack, outfit, carved sign, leafy
pods and structure wind-shadow parity;22/50, no integrity failures or item regressions.
Rounded open-cuff boots are separately captured on0fe7792. Connected frontal hair, seated
brows/eyes, non-emissive lantern UV correction and small swing-foot pitch are ready for a
new actual capture. Diagnostic lighting baseline/key/fill comparison is rendering; production
defaults are unchanged. Cap drape, face richness, broader house forms, additional sign/notice
variants, window/interior objects and canopy/light refinement remain unfinished.
