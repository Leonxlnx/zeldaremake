# The step detector was over-counting two surfaces, and I published the wrong numbers

Branch `agent/squad5-detector`, off `b306d6a9`. **No sound changes** — this is a fix to lane 5's own
measurement tool, and a correction to figures already in the repo.

## What was wrong

Since the first session, `spectra.py steps` has reported a step-to-step level spread of 7–12 dB on
the hollow log and the rope bridge, where every other surface sits near 1 dB. I noted it twice and
waved it off as "a measurement artefact of the long ring" without checking. It is an artefact — but
of the **detector**, not of the window, and it was also inflating the step counts.

Checked properly this time. The spread is identical at 2 ms, 10 ms and 25 ms analysis windows
(11.4 / 11.3 / 11.2 dB for the log), so it is not a short-window phase effect on a low body. What it
is: the log's bore and the bridge's unsupported plank each ring on **several modes at once**, and as
those modes drift apart the envelope climbs again part way through the decay. The onset test — a
6 dB rise over 10 ms — cannot tell that from a new boot.

Clustering the detections and keeping the loudest of each collapses it, and the surviving gaps are a
clean walking cadence:

| leg | real steps | old count | new count | old spread | new spread |
| --- | --- | --- | --- | --- | --- |
| grass | 10 | 10 | 10 | 0.77 dB | 0.77 dB |
| dirt | 9 | 9 | 9 | 0.87 dB | 0.87 dB |
| stone | 9 | 9 | 9 | 0.55 dB | 0.55 dB |
| stairs | 10 | 10 | 10 | 1.45 dB | 1.45 dB |
| wood | 7 | 7 | 7 | 1.07 dB | 1.07 dB |
| **hollow** | 8 | **11** | **8** | **8.79 dB** | **0.44 dB** |
| leaves | 9 | 9 | 9 | 0.78 dB | 0.78 dB |
| run stone | 14 | 13 | 13 | 1.29 dB | 1.29 dB |
| **bridge** | 10 | **19** | **10** | **12.32 dB** | **2.22 dB** |

Gaps after the fix: 0.50–0.55 s walking, 0.35–0.40 s running — the cadences the design asks for.

## Correcting the record

Two published tables on this lane carried the inflated figures. The sound was never wrong; the
counts were.

| where | said | should have said |
| --- | --- | --- |
| `2026-09-23-lane5/README.md`, the steps table | hollow `9 → 12` steps / 5 s, spread `2.0 → 7.7 dB` | 8 steps, spread ≈ 0.4 dB |
| `2026-09-24-south-exit/README.md` | the bridge leg read 19 detections | 10 — which is the cadence, and matches the 32 the play probe counted across the span |

The play-mode counts in those reports are unaffected: they come from `__ZR_AUDIO__.stats().steps`,
which the audio system increments itself, and they were right all along. It is only the offline
onset detector that miscounted — which is worth knowing, because the two disagreed and I did not
notice.

## A level test tried and removed

The first version also dropped any detection far below the median peak, on the reasoning that a
re-trigger is quieter than its parent. It removed **the entire run leg**: at a run the detector's
onsets land differently and their measured peaks fall well below a walk's, even though that leg is
the loudest in the stem (rms −40.4 dBFS against the stone walk's −44.0). The cluster test alone is
well-founded and validated on all nine legs, so the level test is gone rather than tuned until it
stopped doing visible harm.

## Reproduce

```bash
node art/audio/2026-09-23-lane5/render-mix.mjs --dist dist --out /tmp/after --seconds 50 --stems steps
python3 art/audio/2026-09-23-lane5/spectra.py steps --before /tmp/after --after /tmp/after --out steps.jpg
```
