# LEGO ROTS opening — quality rubric and defect log

Scored strictly against the owner's LEGO Star Wars references (attachment 6: Anakin cockpit close-up;
attachment 8: Obi-Wan "Hello, there!"; attachment 3: Han and company, quality only). A good total does
not excuse a broken shot. **Unverified** means not inspected yet, and it scores as if it were failing.

Builds referred to:

| Label | SHA | What |
| --- | --- | --- |
| v2 frozen | `6b37eaf1` | the baseline cut rendering now at 1280×720, 4 jittered shutter samples (6 in the long take) |
| QA pass 1 | `645c2629` | cockpit close-ups restaged, key light, yokes |
| QA pass 1b | `f00aeeac` | face prints and clearcoat toward the references |
| QA pass 1c | `290c2c32` | buzz-droid deployment |
| QA pass 2a | `e88d5d8f` | Obi-Wan's worried line, per-shot key moods, softer hair grooves |
| QA pass 2b | `044d501f` | likeness pass at matched head size (brows, catchlight, grin, hair colour) |
| QA pass 2c | `efb1801e` | head probe: close-up headroom validated on every frame; almond eyes for Anakin |
| QA pass 2d | `48cea4d9` | flat pad-printed beard, plain outlined tooth band |
| QA pass 2e | `9d4df342` | contact probe: hangar hull, wreck parts and touchdown on the deck; landing→jump-out continuity |

QA tooling (no rendering needed, every 24 fps frame): `legosw/scripts/probe-heads.mjs` (where each hero's
head + hair lands in the 2.39:1 picture) and `legosw/scripts/probe-contact.mjs` (lowest point of every hero,
ship, droid and wreck part against the hangar deck).

## Rubric (pass 2, 2026-09-26 06:15 UTC)

| # | Area | Max | Score | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Minifig proportions, face prints, hair, C-hands | 15 | 12 | `qa-pass1-face-reference-compare-044d501f.png`, `…-48cea4d9.png` | Judged against att. 6/8 at matched head size: heavy flat bar brows, one printed catchlight, almond eyes for Anakin, under-eye lines instead of lash-like crow's feet, flat printed beard, plain tooth band, warmer reddish-brown hair for Anakin, moulded hair masses. Still simpler than the licensed art (no cheek-line design for Anakin's smirk); Obi-Wan's beard now a darker brown than att. 8. |
| 2 | Brick dimensions, seams, bevels, ship silhouettes | 15 | 11 | v2 contact sheet (20.2–77 s) | Unchanged. Hangar, landing and droid line: geometry contact now measured (see 5), brick detail **unverified** in motion until the gate clip is reviewed. |
| 3 | ABS plastic, transparent canopy, light response | 15 | 11 | `/tmp/lsw-qa/pass2-sheet.png` | Each close-up has its own key: warm heroic (Anakin's opener), cool and dimmer (Obi-Wan worried), spark-red (Obi-Wan urgent), warm moody reverse. Hangar interior lighting **unverified**. |
| 4 | Framing, lens language, scale, depth | 15 | 12 | probe output (305 close-up frames), `qa-pass1-headroom-worstcase-efb1801e-part1.png` | Every close-up frame keeps the hair inside the frame (minima 37/37/41/29 px of 536) with heads 373–462 px tall; worst cases 44.46 s and 57.46 s visually confirmed; 68.58 s / 71.04 s pending the clip. Shots after 77 s: framing **unverified** in motion. |
| 5 | Choreography, acting, temporal stability | 15 | 10 | stills 54.1–57.4 s; contact probe 79.2–92.8 s; cut-continuity measurement | Obi-Wan worries instead of smiling. Hangar aftermath: nothing sinks into or floats above the deck on any frame (was up to 8.8 into / 1.16 above), and the wreck no longer teleports at the 84.2 s cut. Missile→crawl→rescue in motion: **pending** the 24 fps gate clip. Flicker metric: **unverified**. |
| 6 | Readable combat, effects, destruction | 10 | 7 | `qa-pass1-missile-deploy-before-after-sheet.png` | Unchanged; motion of release→contact→crawl→rescue **pending** the gate clip. |
| 7 | Subtitles | 5 | 4 | cockpit clips | Timed to the lines in the moving close-ups. Full-film timing pass **unverified**. |
| 8 | Sound | 5 | 3 | loudness -14.0 LUFS / -1.4 dBTP (v2 analysis) | Measured only; **listening unverified** (no audio output here). The missile/buzz effects schedule changed, so the final soundtrack must be re-rendered. |
| 9 | Performance, reliable delivery | 5 | 3 | render logs, warm benchmark | Pushes work again (since 05:12). Viewer transport, loading and error states implemented, headless test pending. v2 baseline ETA ~07:50 UTC; corrected v3 export not rendered yet. |
|  | **Total** | **100** | **73** |  |  |

## Defect log (highest first)

| ID | Sev | Shot / time | Observed | Fix | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| D9 | High | all four close-ups | push-ins cut the hair at the frame top (director: 43.29–44.33 s; probe on `f00aeeac`: 42.21–44.46 s, and all four close-ups cropped for most of their length) | aims raised per shot; `probeHeads` sweep of all 305 frames | fixed `efb1801e`: minima 37/37/41/29 px | probe tables in the PR / checkpoint; `qa-pass1-headroom-worstcase-efb1801e-part1.png` |
| D11 | High | landing → droids 80.0–92.8 s | shed wing parts sink up to 8.8 into the deck while sliding, rest 2.4 into it or float 0.66–1.16 above it, slide without friction, and teleport 15–30 units at the 84.2 s cut; the wreck's orientation snaps ~6° there | one shared `wreckPose` (hop, friction slide, tumble to rest, deck contact) keyed to the time since each part tore off; same `obiWreckQuat` in the landing and the parked shots | fixed `9d4df342`: gap 0.000 on every frame; cut jump 0.002–0.008 (= an ordinary frame step) | `probe-contact.mjs` and cut-continuity output, before/after |
| D12 | High | landing → droids | crashed hull 1.81 into the deck at the slam-down, 0.53 into it at rest | `hullOnDeck`: underside vertices cached once, the belly rides the deck from the slam-down | fixed `9d4df342`: gap 0.000 | probe output |
| D10 | High | obiwan-cockpit 55.2 s | Obi-Wan smiles through "I have a bad feeling about this" | `worry` mouth (corners down, lip arched) mixed with the frown, brows fully up, a nervous glance | fixed `e88d5d8f` (stills); moving beat in the cockpit clip | `pass2-e88d5d8f/film-055.20.png` |
| D1 | High | cockpit close-ups | struts across faces, flat light, centred heads, floating hands | camera inside the canopy nose, thirds, short-side key, matched eyelines, yokes at the grips | fixed `645c2629`; motion verified 40.0–45.0 s | `qa-pass1-cockpit-motion-anakin-f00aeeac-t40.0-45.0.mp4` |
| D2 | High | missiles 59.3–60.3 s | fireballs hid the release; droids slid back then snapped | staggered releases, arcing hops, casing pop after the payload is out | fixed in stills `290c2c32`; **motion pending** (gate clip) | `qa-pass1-missile-deploy-before-after-sheet.png` |
| D13 | Med | jump-out 85.50–85.67 / 85.96–86.13 s | touchdown squash sinks both heroes' feet 0.22 into the deck for 5 frames | feet planted from the first touchdown frame | fixed `9d4df342` | probe output |
| D14 | Med | close-ups | Obi-Wan's beard dense orange strands (att. 8 is a flat printed silhouette); Anakin's gritted teeth a braces-like grid (att. 6 a plain band) | flat beard, bare cheeks and lip; outlined band split by one line | fixed `48cea4d9` | `qa-pass1-face-reference-compare-48cea4d9.png` |
| D3 | Med | all close-ups | prints generic/cute next to att. 6/8 | matched-size likeness pass: brows, eyes, catchlight, lines, grin, hair colour | closed for this pass (`044d501f` → `48cea4d9`) | both face comparison sheets |
| D4 | Med | rescue 72.8–73.3 s | camera races in beside Anakin; framing jumped between 12 fps draft frames | — | open: 24 fps check in the gate clip | `/tmp/lsw-qa/sheets/rescue-detail-a.png` |
| D15 | Med | rescue 71.2 s | droid #0 (the one that cut R4) is not shown after the buzz close-up; droid #4 is already on Anakin's ship when the rescue opens, without a visible hop | — | open: confirm in the gate clip | code reading (`shots.ts` rescue) |
| D6 | Med | delivery | v2 baseline render is long; the corrected cut needs its own frames | warm per-shot benchmark; v3 = v2 frames + targeted re-render of every shot whose pixels changed, same settings | planned: v2 ~07:50, v3 ~09:00–09:30 UTC | benchmark log |
| D7 | Low | realtime viewer | no play/seek/restart, unexplained black while loading, no error state | `controls.ts`: loading panel, error panel with Reload, transport bar (restart, play/pause, time, scrubber with a tick per cut, shot name), keys | implemented; headless test pending | — |
| D8 | Low | delivery | GitHub push auth failing since 04:58 UTC | retry loop | resolved 05:12 UTC | `/tmp/lsw/push-retry.log` |
