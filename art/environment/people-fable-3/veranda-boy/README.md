# The grove's second person — a boy at the stilt house's veranda rail (lane 7, fable-3, 2026-09-25 11:30–12:30 UTC)

**Branch** `agent/fable-3-veranda-boy` on the head `905d55ea` (PR #122); `placement.ts` (`NPC_GROVE_VERANDA`), `npc.ts`
(`VERANDA_SLOT`, his keys and drive), `kokiri.ts` (variant 6 is a boy; the boys share materials), `index.ts` (KID_COUNT 7,
the grove cull covers both grove kids).

## Where and why

Offered in the INBOX since 23:05 yesterday as "the obvious next" after the grove girl; held on the `g-back` draw budget,
which #101 (the near-canopy batch, −28 … −56 draws at every look-back) settled. He stands at `NPC_GROVE_VERANDA`
(9.68, −91.7): 0.32 m inside the deck's rim (`VERANDA_R` 2.65 about the host (12, −91.5)) at azimuth −95° — on the arc
the `north-grove` play route never walks (door −118.6° → ±180° → the rope walk at 37°), clear of the door, the ladder
head (−18°) and the rope stub — turned along the rail toward the yard, watching the girl at the washing line 12 m
below and away. The stand pattern of the ledge / bank / grove girls: `poseLedgeIdle` with his own look-around (down at
her; up along the trail's arrival; out over the shelf; once back toward the door), `plantFeet`, the notice-Link turn,
a contact decal; his rng a fork drawn after the grove's, so no other kid's numbers move. The deck is a published walk
surface (`grove-stilt`, `ctx.shared.walkSurfaces`), so `ground.height` puts his soles on the boards — 11.6 m up — and
the decal on them, with no special case.

Kept constant: **no fairy** (a light would recompile every lit program); the door boy's look — the boys now share one
hair canvas, one cloth canvas and one band material (the cache keys drop the variant; his tunic hem keeps its own seed),
so no material or texture is added; the grove's 60 m cull hides both grove kids together (`GROVE_KIDS`).

## Evidence (broll, `--character`, the cameras in `shots.json`)

- `along-the-rail-2.4m.jpg` — on the deck behind him: the boards, the rail, the trunk house and the line below.
- `from-the-yard-8m.jpg`, `from-the-yard-8m-crop.jpg` — from the yard, 8 m below: at the rail right of the door.
- `over-her-shoulder-17m-before-after.jpg`, `over-her-shoulder-full.jpg` — over the girl's shoulder from the line, the
  rail 17 m off: empty (head) / the boy (branch).
- `look-back-over-the-hamlet.jpg` — a look back over the hamlet from the bank north-west of the trunk house (my
  approximation of fable-cursor's `g-back`; their camera is not in the repo).

A first "from the trail's arrival" camera put a foreground trunk exactly between the camera and the rail (88 changed
pixels) — replaced by the yard camera; noted so the shots file is not read as a miss.

## Cost (`pose-counts.mjs`, head `905d55ea` → branch, the same box)

| pose | draws | triangles |
| --- | --- | --- |
| D_log (fixed view) | 523 → 523 | 8.74 → 8.74 M |
| over her shoulder to the rail | 631 → 652 | 9.12 → 9.13 M |
| along the rail, 2.4 m | 216 → 237 | 1.89 → 1.90 M |
| from the yard, 8 m | 570 → 591 | 8.21 → 8.22 M |
| look back over the hamlet | 631 → 652 | 8.82 → 8.84 M |

+21 at every grove pose: his 14 colour meshes, 6 shadow-pass submissions and the decal at full detail; beyond 25 m
he drops to 5 meshes and no sun shadow like every kid. The fixed frames cannot see him (100 m north, behind the 60 m
cull). Typecheck, build, 206 / 206 tests.
