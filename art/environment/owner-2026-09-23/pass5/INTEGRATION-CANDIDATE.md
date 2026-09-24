# A verified integration candidate — `agent/squad4-integration-candidate` (squad4, 01:45)

## Why this exists

The integration branch has not moved since **23:05**. Everything the owner asked for at 23:00 was
built, pushed, and is sitting on branches nobody has merged — so the build he plays has none of it.
This branch is those branches merged together and put through every gate, so that landing them is
one action instead of seven. **It is a candidate, not a merge:** I did not push to
`cursor/kokiri-world-phase1-f65e` and I did not review anyone else's visual work.

## What is in it

Merged onto `cursor/kokiri-world-phase1-f65e` @ `81430baf`, in this order, **all six clean, no
conflicts**:

| branch | what it answers |
| --- | --- |
| `agent/squad4-owner-2300-stairs` | "it glitches the frames up and forth every each step" |
| `agent/stairs-look` | "the stairs, I don't know if they look that good or not" |
| `agent/squad2-treepop` | "they only get detailed when I come up close" / "a lot of the trees look fake" |
| `agent/squad5-music-rests` | "the music needs to stop shaking" |
| `agent/squad3-near-bark` | the bark at close range |
| `agent/squad1-corridor-light` | the corridor's air |

**Left out:** `agent/fable-3-kokiri-girl` (the Kokiri). It merges cleanly except for
`.agents/INBOX.md`, which is a coordination file, not code — whoever integrates should take both
sides of that hunk and include it. I left it out because the squad rule is that lanes do not edit
INBOX.md.

## Every gate, on the merged result

- `npm run typecheck` — green.
- `npm run build` — green.
- **41 of 41 test files pass, 0 fail** (`find src gauntlet -name '*.test.mjs'`, each under `node --test`).
- **Both budget caps met on all six hero views**, with room:

| view | draws (cap 700) | triangles (cap 9.0 M) |
| --- | --- | --- |
| A_stairs | 638 | 8.914 M |
| B_house | 627 | 8.321 M |
| C_lookback | 501 | 7.198 M |
| D_log | 561 | 8.601 M |
| E_ground | 627 | 8.321 M |
| F_canopy | 598 | 7.992 M |

  A came into the night at 695 draws / 8.95 M — five draws and 50 K under the cap. With six branches
  merged on top it is **638 / 8.914 M**, so the lanes' own perf work more than paid for what they
  added.
- **Play mode: nine walk routes reach every waypoint, zero stuck points.**
- The stair fix is live in the merged build: climbing the main flight the camera's vertical
  acceleration is **3.78 m/s²** against **23.66** before it, and the south bank 5.25 up / 5.26 down
  against 24.33 / 23.75. (`climb main down` reads 38.62 on every build — that scenario teleports to
  the top of the flight and measures the camera catching up, not a walk; see `STAIRS.md`.)

## What this does NOT tell you

I ran the gates, not the eyes. Whether squad 2's trees, squad 3's bark, squad 1's air and the new
stairs each *look* better is their evidence to show, and each branch carries its own. I checked that
they coexist: they compile, they pass, they stay inside the budget and the world is still walkable.

The near-field veil that eats the bough's material at 12 m (`VEIL.md`) is **not** fixed here.
`agent/squad1-corridor-light` predates that finding.
