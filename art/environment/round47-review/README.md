# Round 47 — the owner's 2026-09-19 fix list, first pass

World `61b428a` on `cursor/kokiri-world-phase1-f65e`: eight lanes merged on `bb8fdf5` (take-0116's
world + Astra's PR #16 halo fix + fable-5's verdicts). Before = `bb8fdf5`, after = each lane's
final build, at identical poses. Videos referenced here live in `/opt/cursor/artifacts/` on the
integrator's VM and are attached to the monitor's take when it seals.

## What the owner asked → what landed

| owner's words | lane | result |
| --- | --- | --- |
| "he's moonwalking; legs unnatural" | character-9 | clip phase now driven by the root's actual ground speed; stance foot pinned in the clip's planted window (drift ≤ 5 mm/step at walk, 0 at run steady); one remaining 32 cm skate at the walk→run crossfade (clip limits — Astra) |
| "arms slow on the walk, faster on the run" | character-9 | walk arm swing ×0.69, run ×1.10 (post-clip modifier) |
| "the run should be faster" | character-9 | 3.9 → 4.6 m/s, rate follows |
| "on the stairs his legs go into his body" | character-9 | thigh no longer enters the torso (hip clamp + knee-out swivel), toe clearance 12 → 6 cm, shoe penetration 17 → 0 mm; flexion still 138–142° (needs an authored stairs clip) |
| "run faster and even jump" | character-9 | jump on Space / gamepad A (crouch, 0.93 m apex at run, landing gather) |
| "the girl should be walking around" | npc-1 | kokiri-a wanders a seeded plaza loop with idle stops; kokiri-b sits on the main flight; each has a green fairy; girls re-matched to demo d_023–d_036 (sleeveless tunic, headband, wristbands) |
| "patches in the grass where it's not full" | vegetation-25 | coverage audit: bare lawn 3.21 % → 0.20 % (r 45 m); seed stalks + broad blades |
| "tree shrubs look really low quality" | vegetation-25 | shrub crowns are layered leaf clusters with dark cores and lit rims; big-leaf mounds at the house doors; north-verge fern band (east bank) |
| "the nook of the tree — a lot higher detail" | structures-30 | Saria's hollow: callus door roll, floorboards with wear, bed, rug, table, hearth, herbs, plants; still dark from the plaza |
| "walk past the arch; it needs to look better" | expansion-1 + structures-30 | the tunnel is walkable (`ground.blocked` carve); root curtains, fungi, daylight slivers, vines clamped over the walk line |
| "more to do after the steps"; "it should be raised" | expansion-1 | north path through the arch to a second clearing with a stone circle; raised right-bank 6-step flight + terrace (ref-03/04) with a Kokiri spot; plateau lookout dais |
| "reach into my bag — right-click or ZR" | shell-1 | equipment screen on RMB / ZR / Tab with 3-D item cards (unverified visually this round — the lane timed out before its screenshots; verify at the next tick) |
| "the actual Zelda music" | shell-1 | audio system with a music slot (`public/audio/music.ogg`, local only) and an original placeholder; Nintendo's music cannot ship |
| lantern limb at 2 m, columns in haze, cushion disc | trees-30 | deep bark cords + moss beards on the bough, 16-side lobed cushions with camera fade, arm's-length moss relief, 30-side buttress fins — the lane never got a capture slot; verified only in the integrated capture |
| cardboard far trees | distant-1 | crossed soft-alpha far crowns from an atlas, disc-crown variant gone (`distant1-w25-stairs-f.jpg`) |

## Sheets

`character9-{walk,accel,stairs,jump}-{before,after}.jpg`, `character9-stairs-peak-{before,after}.jpg`
· `npc1-walk.jpg`, `npc1-walk-closeup.png` · `veg25-*.jpg` (six walk poses, shrub crops, view A/B/D)
· `structures30-*.jpg` (doorway, room, arch inside/lookout, signpost, house-bough pods)
· `expansion1-*.jpg` (arch north mouth, clearing, stone circle, ledge stair/terrace, lookout)
· `distant1-w25-stairs-f.jpg`.

## Per-lane six-view deltas (each lane alone vs take-0116)

expansion-1 A +0.0003 B −0.0003 C −0.0001 D −0.0012 E −0.0002 F +0.0003 · vegetation-25 A +0.0009
B −0.0002 C +0.0004 D −0.0009 E −0.0018 F −0.0020 · structures-30 A −0.0001 B −0.0010 C 0 D −0.0001
E −0.0005 F −0.0013 · character-9 byte-identical · npc-1 / trees-30 / distant-1 / shell-1 not
measured alone (capture slots) — the integrated capture is the measurement. Integrated numbers are
in the take-0118 ledger note.

## Handoffs out of this round

- Astra (clips): the walk's heel strike lands at full extension and settles 5–8 cm; the run has
  only 0.083 s planted per 0.21 s contact (30–40 cm drag at 4.6 m/s); stairs need knee abduction
  25–35°, thigh ≤ 110°, 1.08 m stride; walk arms ≈ 25°, run ≈ 45–55°; jump_start/air/land clips.
  The girl's model: rig joints as `rig.ts`, clips idle / walk (0.76 m stride) / turn / sit-idle /
  sit-look / blink.
- fable-2 (rocks): dress `LAYOUT.rockLedges.north-terrace` (the terrace's south face), scree at
  the ledge flight's flanks, boulder pair on the clearing's west bank; make `pathEdgePebble`'s
  draws per-candidate so path edits stop moving pebbles world-wide (the whole D delta).
- fable-3 (props): platform at `LAYOUT.plateauLookout`; publish `ctx.shared.propFootprints`.
- vegetation: ferns/grass on the clearing's banks and terrace pad; moss at the standing stones;
  read `propFootprints`.
- trees: young white-barks on the clearing's banks; keep the far line open toward (−8, −88);
  add `northPath` to `placement.ts blocked()`.
- structures: pod posts at the clearing entrance and the flight's foot; a signpost at the arch's
  north mouth; the tunnel floor's north seam.
