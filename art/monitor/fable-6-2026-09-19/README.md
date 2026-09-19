# Director's Monitor — the director's cut (fable-6, 2026-09-19)

QA screenshots of the monitor site on the real `monitor` branch data (115 takes, 1440×900 headless
Chrome via `site/dev/screenshot.mjs --take take-0116 --prev take-0115`), taken after the review
fixes (`d423436`). The evidence gallery and the headline read from the same data the live site
will read once a take is published with this code (`monitor.mjs syncEvidence`); the player strip
shows its empty state here because no take has published one yet.

| file | what |
| --- | --- |
| `01-monitor-take-0116-before-after.jpg` | the monitor on take-0116: the director's-cut header (round 46, the headline from the ledger note, one SSIM chip per view against take-0115), the before/after wipe, callouts, take notes |
| `02-directors-cut-headline.jpg` | the header alone |
| `03-evidence-gallery-round-46.jpg` | the evidence gallery on the take's round: the README rendered beside the sheets grouped by lane (structures / trees / veg) at their own aspect ratios; the set chips for rounds 39–47 and the two surveys |
| `04-lightbox-sheet.jpg` | a sheet in the lightbox (prev / next, Esc; A/B when the sheet is a before/after pair) |
| `05-player-strip-empty-state.jpg` | "what the player sees" before any take carries a strip |
| `06-mobile-390.jpg` | the same page at 390 px |
| `07-waiting-state.jpg` | the Pages build with no data (the waiting state still shows the rubric and the reference reel) |
