## The owner's three poses, looked at again — no lane 2 defect found

Lane 2, 2026-09-29, head `6181139c`. **No code changed.** After three rounds inside the pool's counters
this went back to the thing the standing instruction asks for first: render the owner's own poses and
look at them. The answer is that lane 2's subject holds at all three, and the two things worth reporting
are a naming trap in the shared pose file and a limit on what a band metric can say.

`broll.mjs --shots owner-2026-09-23/pass3/owner-0650-poses.json --settle 6`, 960×540, 76 s a frame.

## 1. What the three poses show

**`owner-0650-north`** (1.4, 1.75, −10.2 → 2.0, 1.45, −20.0) — the pose the owner's 2026-09-23 "the trees
do not populate" note was taken from. At 1× the upper middle distance reads as pale mist, which is what
made me open this audit; at **2.5×** (`zoom-north-band.jpg`) it resolves into white-bark trunks with leafy
crowns at two or three depths on the left, a vegetated bank across the centre with **a distant tree standing
on it** — trunk and a crown of separate leaf clusters — and two lantern glows below it. The flat part of
that band is the mist **above the bank**, where a path climbing to a ridge should show sky.

**`rec-r024-plaza-fork`** (−0.6, 1.7, 5.0 → 3.4, 1.4, −9.0) — the lantern branch crossing the frame with
its pod lanterns, Saria's house right of centre, purple flowers, flagstones. The corridor north of the
plaza, seen through the gap under the branch, is pale: that camera looks **north-north-east**, which is the
mid-grove's *best*-weighted direction (`midWeight` = `smoothstep(13, 19, r) × (0.58 + 0.42 ×
smoothstep(−6, −26, z))`, so weight 1.0 beyond z −26), and the same corridor seen from 14 m closer in the
north pose is full of trunks and crowns. What thins it at that range is height fog, which is lane 1's.

**`owner-0650-west`** (1.2, 1.75, −9.0 → −8.0, 2.2, −24.0) — the best of the three for this lane: many
discrete trunks with leafy crowns receding through the mist at several depths. The one thing that looked
like an artefact, a hard dark mass at the right edge, resolves at **5×** (`zoom-west-right.jpg`) into a
distant tree on a ridge — trunk, crown, separate clusters. Not a card seen edge-on, not a blob.

**Verdict: nothing in the distant trees, the mid grove or the canopy needs fixing at these three poses.**
The canopy is open where the north path climbs, which is what backlog item 4 (`roofsky/`) settled.

## 2. A naming trap in the shared pose file, for fable-cursor

The pose is called **`rec-r024-plaza-fork`**, but its subject is not `reference/frames-dense/review46/r_024`.
r_024 is Link running up a path with open mist ahead and no house in frame; the frame whose subject matches
this pose — the lantern branch crossing the view with three pod lanterns lit — is **`r_020`**.

So anybody who renders this pose and opens r_024 beside it is comparing two different scenes and will read
the difference as a fidelity gap. Either the pose wants renaming to r_020, or it wants re-aiming at what
r_024 actually shows. The pose file is `art/environment/owner-2026-09-23/pass3/`, not this lane's, so this
is a note rather than a change.

## 3. What a band metric cannot tell you across two compositions

The obvious move was to put our frame and the owner's beside each other through `band.mjs`. It does not
work, and the numbers are here (`band-farcentre.txt`) as a caution rather than a result:

| | our north pose | reference r_024 |
| --- | --- | --- |
| whole band y 0.10–0.40: across-columns sd | 32.34 | 21.39 |
| far centre x 0.35–0.58, y 0.06–0.35: across-columns sd | **14.40** | **3.30** |

Read naively, the first row says our middle distance is *more* structured than the reference's and the
second says it is **four times** more. Both are artefacts of the window. The full-width band catches our
near trunks at the frame edges; the centre window catches the one part of r_024 that is genuinely empty
mist, because that frame's layered crowns sit in its left and right thirds, not down its centre.

**A band number only means something when the window contains nothing but the depth you are asking about**
— which is why this lane's charter uses a far-centre box on *its own* frames, before and after a change,
and not against a reference shot from somewhere else. Comparing to the reference needs a pose that
reproduces the reference's composition; §2 is why the one pose that claims to does not.

## Files

- `owner-0650-north.jpg`, `rec-r024-plaza-fork.jpg`, `owner-0650-west.jpg` — the three frames on this head.
- `zoom-north-band.jpg` — the north pose's middle distance at 2.5×.
- `zoom-west-right.jpg` — the west pose's right-edge mass at 5×.
- `band-farcentre.txt` — §3's numbers.
