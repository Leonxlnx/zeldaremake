# Character checkpoint review — d181ef9

Internal read-only visual review, 2026-09-11. This is a working note, not a scored
cross-review, C01/C02 approval, or similarity percentage.

Evidence: actual renderer `01-idle.jpg`, `02-walk.jpg`, `03-run.jpg`, `04-jump.jpg`
from source `d181ef9c1e9628fcabbcc7ab1e3d7100b6a5255d`, captured 04:06:48 UTC,
[generated commit d22dc73](https://github.com/Leonxlnx/zeldaremake/tree/d22dc736fca64ba0085ac6f8166bf39bb639930d).
The four `73b5e78` poses, captured 04:09:46 UTC, have identical PNG hashes.
References: `reference/frames/UI_inventory.jpg` and `reference/frames/B_house.jpg`.

## Confirmed improvement

Correcting `geometry.sweep()` winding restores the visible exterior of the fringe
and cap tail. The four tiny disconnected curls become solid locks; the large dark
cap opening is gone. No obvious hair piercing the brim remains in these views.

## Next three priorities

1. **Face and ears.** Idle/run still read as a round doll face: small circular irises
   surrounded by bright white, a button nose and thin spike-like ears. The inventory
   reference has stronger eyelids, shaped nose/cheeks and broad pointed ears. Refine
   those local surfaces while keeping the pivot and body dimensions; place the blue
   iris within an eyelid-defined aperture.
2. **Hair and cap join.** The restored fringe forms four short, evenly spaced petals.
   The reference has longer overlapping locks swept across the forehead. Vary lengths
   and directions, keeping the outer surface clear of the skull and the tips clear
   of the eyes. A raised ridge and small dark triangular notch remain at the cap
   crown-to-tail junction in the jump view; smooth that root path/section overlap.
3. **Clothing layers.** Idle/run still show a jagged collar/strap boundary with
   triangular interruptions beside the neck. The stills alone do not prove every
   notch is penetration: inspect actual surface clearance and establish a consistent
   overlap order. Then add restrained larger cloth folds and leather edge definition.
   The current tunic is a smooth green surface under a dominant dark X.

## Motion evidence limits

The 42-frame, 12 fps rear-view clip contains one jump, a landing and a complete stop,
with no blank frames or page errors. Its scripted camera passes through a hanging
pod for part of the jump, so it cannot establish a visually continuous unobstructed
transition. `143eb54` changes the supplementary recording to front three-quarter;
inspect that replacement before reporting its result. This camera is not a recording
of manual gameplay input or the interactive follow-camera collision behavior.

Follow-up: `143eb54` CI 34561370724 passed; 42 frames captured at 04:21:46 UTC,
generated commit `2bf9c44`. Extracted frame review confirms the new front three-quarter
view keeps the jump and landing visible. Body/model code is unchanged from `73b5e78`.

More owner reference images are pending. These observations identify useful work,
not a claim that the current model matches the final target.
