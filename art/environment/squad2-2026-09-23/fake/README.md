# squad2 — "a lot of the trees just look fake": two hypotheses measured, one refuted, one large

Taking the last unanswered half of the owner's job 3 (23:00): *"the trees show the brown, but they only get
detailed when I come up close … a lot of the trees just look fake, it's a weird art style direction."* The
first clause was this lane's LOD work (5.57 % of the frame at the 20 m rung when it started, 1.70 % on the
head now). This is the rest of the sentence, and it is **measurement only** — no production code changed,
because what the numbers say to do next is not what I would have guessed, and it needs attribution first.

Both tools are new and committed: `skyline.mjs` and `barkshare.mjs`. Frames: the owner's two walking poses
on the head (`owner-0650-north`, `owner-0650-west`) against `review46/r_024`, `r_025` and `demo61/d_108`.

## Refuted: our forest is not too uniform

The obvious reading of "fake" is repetition — the same tree over and over, drawing a regular tree line. So
`skyline.mjs` takes the topmost foliage pixel per column and measures that line's structure:

| frame | rise (% of height) | sd | crown tops / 100 px | spacing cv | jag |
| --- | --- | --- | --- | --- | --- |
| ours, north | 39.4 | 15.6 | 4.0 | 1.49 | 3.70 |
| ours, west | 42.8 | 13.6 | 3.2 | 1.18 | 1.11 |
| `r_024` | 20.5 | 10.6 | 2.4 | 0.96 | 2.02 |
| `r_025` | 18.7 | 9.3 | 3.1 | 1.16 | 3.27 |
| `d_108` | 33.6 | 14.5 | 2.9 | 1.41 | 1.69 |

**Our tree line is at least as irregular as his, and rises and falls twice as much.** Whatever "fake" is,
it is not a repeated forest with an even skyline, so the variety knobs (`MID_SPECS`' heights, the distant
variants' spread) are not where the next hour should go.

## Large: we show three to ten times as much bark

His other clause is literal, and it measures. `barkshare.mjs` classifies the upper band (y 0.05–0.45, which
keeps a level view's paving out of the count) by hue at moderate saturation:

| frame | bark share of the band | bark lightness | foliage share's lightness |
| --- | --- | --- | --- |
| ours, north | **21.5 %** | 0.227 | 0.245 |
| ours, west | **19.3 %** | 0.193 | 0.337 |
| `r_024` | **2.5 %** | 0.535 | 0.230 |
| `r_025` | **1.8 %** | 0.515 | 0.274 |
| `d_108` | 10.2 % | 0.370 | 0.271 |

A fifth of our mid-distance band is wood; between a fiftieth and a tenth of his is. That is "the trees show
the brown" as a number, and it is the biggest measured gap this lane has found against the reference.

**The lightness column is weaker evidence than the share.** His bark pixels are pale (0.52–0.54) and ours
dark (0.19–0.23), but those are not the same population: where his trunks are mostly screened, what the
classifier catches is the lit bark of a few near boles, while ours catches whole dark boles at every depth.
The share is the robust half.

## What it does not yet say: whose wood

Before anything is tuned, the brown has to be attributed, and it cannot be from these frames alone: the
candidates are the giants' trunks (huge, near, lane 3's), the white-barks (lane 3), and this lane's distant
and mid boles. A probe would settle it in one render, except that **the trees' wood materials are anonymous**
— `probe-look.mjs` marks by material name, and only `giant-canopy` carries one (this lane named it in the
crowntone round for exactly this reason). Naming the wood materials is a one-line-each touch in
`materials.ts` and the first thing for the next hour.

Then the two fixes the share points at, in the order their cost allows:

1. **Crown coverage over the boles** in the 15–60 m band — the mid layer's crowns sitting lower on their
   trunks (`MID_SPECS`' crown Y shares, now 0.54–0.59 of height) or reaching wider, which screens bole
   without adding a card. This lane's file, no triangles.
2. **Density** — more mid trees so crowns overlap and hide the boles behind them. Also this lane's file, but
   it buys triangles at camera A, which has 89 k of headroom under the 9 M cap, so it needs pricing first.
