# LEGO ROTS opening — quality rubric and defect log

Scored strictly against the owner's LEGO Star Wars references (attachment 6: Anakin cockpit close-up;
attachment 8: Obi-Wan "Hello, there!"; attachment 3: Han and company, quality only). A good total does
not excuse a broken shot. **Unverified** means not inspected yet, and it scores as if it were failing.

Builds referred to:

| Label | SHA | What |
| --- | --- | --- |
| v2 frozen | `6b37eaf1` | the cut rendering now at 1280×720, 4 jittered shutter samples (6 in the long take) |
| QA pass 1 | `645c2629` | cockpit close-ups restaged, key light, yokes |
| QA pass 1b | `f00aeeac` | face prints and clearcoat toward the references |
| QA pass 1c | `290c2c32` | buzz-droid deployment |

## Rubric (pass 1, 2026-09-26 05:15 UTC)

| # | Area | Max | Score | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Minifig proportions, face prints, hair, C-hands | 15 | 10 | `qa-pass1-cockpit-after-t*.png`, `/tmp/lsw-qa/print-film-compare.png` | Proportions and C-hands correct; hands now close on the yokes (were 0.47 studs above). Prints moved toward att. 6/8 (bar brows, bigger catchlights, wider eyes) but are still plainer than the licensed art; Anakin's brows are partly under his fringe. |
| 2 | Brick dimensions, seams, bevels, ship silhouettes | 15 | 11 | v2 contact sheet (20.2–77 s) | Chamfered bricks, studs and seams hold up in the long take and chase shots. Invisible Hand hangar, landing and droid line: **unverified** in v2. |
| 3 | ABS plastic, transparent canopy, light response | 15 | 10 | `qa-pass1-cockpit-after-t043.60.png` | Warm key now gives clearcoat sheen on faces and hair. Canopy glass seen from outside reads hazy (the restaged close-ups no longer look through it). Hangar interior lighting **unverified**. |
| 4 | Framing, lens language, scale, depth | 15 | 10 | `qa-pass1-cockpit-before-after-sheet.png`, long-take sheet | Close-ups on thirds with off-lens eyelines that face each other across the Obi-Wan/Anakin exchange. Start/middle/end of every shot: **unverified** for shots after 77 s. |
| 5 | Choreography, acting, temporal stability | 15 | 8 | draft sheets 57.5–77.4 s | Anakin smirks from frame one; buzz droids crawl. Rescue 72.8–73.3 s: very fast push, composition jumps at 12 fps (needs 24 fps check). Flicker metric for v2: **unverified** until the render ends. |
| 6 | Readable combat, effects, destruction | 10 | 7 | `qa-pass1-missile-deploy-before-after-sheet.png` | Every bolt has a target; kills explode into bricks. Missile deployment now reads (was hidden by fireballs). Rescue debris burst reads as Anakin's hit. |
| 7 | Subtitles | 5 | 4 | cockpit stills | Game-style gold speaker names in the lower bar, timed to the lines. Full-film timing pass **unverified**. |
| 8 | Sound | 5 | 3 | loudness -14.0 LUFS / -1.4 dBTP, 63% energy 300 Hz–5 kHz (v2 analysis) | Measured only; **listening unverified** (no audio output in this environment). |
| 9 | Performance, reliable delivery | 5 | 2 | render logs | v2 render ~4 frames/min in the long take; GitHub pushes failing on auth since 04:58 (commits held locally, retry loop running); realtime viewer has no seek/restart controls. |
|  | **Total** | **100** | **65** |  |  |

## Defect log (highest first)

| ID | Sev | Shot / time | Observed | Fix | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | High | cockpit close-ups 40.5–44.5, 54–57.5, 66–71.2 s | octagonal viewport spokes and struts across the faces; cold, flat front light; heads dead centre, eyes to the lens; hands floating above the yokes | camera inside the canopy nose, heads on thirds, short-side warm key with less fill, eyelines matched across the exchange, yokes moved to the grips | fixed in stills (`645c2629`); motion clip rendering | `qa-pass1-cockpit-before-after-sheet.png`, `qa-pass1-cockpit-{before,after}-t*.png` |
| D2 | High | missiles 59.3–60.3 s | two missile fireballs hide the buzz-droid release; droids start from a point left behind in world space, so they slide back then snap onto the hull | staggered releases, arcing hops, casing pop after the payload is out, start point rides with the missile | fixed in stills (`290c2c32`); motion check pending | `qa-pass1-missile-deploy-before-after-sheet.png` |
| D3 | Med | all close-ups | prints plainer than att. 6/8: thin tapering brows, small catchlights, tall narrow eyes, pin-point face highlights | bar brows, per-figure eye shapes, bigger catchlights, broader clearcoat | improved (`f00aeeac`); still short of the licensed art | `/tmp/lsw-qa/print-film-compare.png` |
| D4 | Med | rescue 72.8–73.3 s | camera races in beside Anakin; framing jumps between draft frames | — | open: check at 24 fps with motion blur | `/tmp/lsw-qa/sheets/rescue-detail-a.png` |
| D5 | Med | landing, jump-out, droids 79.2–92.8 s | not inspected in v2 | — | **unverified** | — |
| D6 | Med | delivery | v2 render slow (long take 6 samples); publication waits for it | none yet (no restart) | open | render logs |
| D7 | Low | realtime viewer | no play/seek/restart controls, black while loading, no error state | — | open (after the hero-shot fixes) | owner test |
| D8 | Low | delivery | GitHub push auth failing since 04:58 UTC | retry loop | blocked on token | `/tmp/lsw/push-retry.log` |
