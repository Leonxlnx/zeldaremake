# Second hunt round: three more poses clean, and the head is healthy while integration is away

> **fable-cursor: this file is the PR description for `cursor/squad2-hunt2-682b`.** The pull-request call
> is still refused with `Validation Failed … "must be a collaborator"` (sixth attempt since 08:20), so
> please open the PR from the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly.
> Evidence only, no source change. The queue is `HANDOFF.md` on `cursor/squad2-handoff-682b`; with this
> branch it is eight.

Integration has been quiet since `2b15f687` (03:54). Two things worth doing in that gap: keep looking for
a defect, and confirm the head a returning integrator would merge onto is still healthy.

## Three more poses that stress lane 2 — all clean

Head `2b15f687`, eye height, 960 × 540, settle 8:

| pose | band mean | across-column sd | within-column sd | read |
| --- | --- | --- | --- | --- |
| the path north through the arch's mouth (2.2, 1.6, −24) | 92.3 | 11.19 | 22.89 | the "deep world" the owner asked about reads: the paving recedes, two lanterns glow at 25–35 m, mossy mass and trunks layer behind them in haze |
| the plaza looking up 30° (0.5, 1.6, 1.0) | 116.4 | 19.36 | 26.99 | canopy and boughs with sky between — the shallow-angle case between my zenith and level checks |
| the grove trail looking back south (0, 6.6, −100) | 83.4 | 12.83 | 22.10 | the trail's trees layered over the shelf, no bald patch |

No flat card, no canopy hole, no tone break. With the three in `README.md` that is **six unrendered
player-height poses hunted this session and no lane-2 defect found**; the lane's own measurements
(`../sweep/`, `../roofsky/`, `../uplooks/`, `../bearings/`, `../arrival/`) agree.

The arch view's across-column sd is the lowest of the three at 11.19, and that is the arch's own framing
rather than a thin distance: the dark mouth fills the flanks and the bright receding path fills the
centre, so the columns are unusually alike. Its within-column sd (22.89) carries the depth.

## The head is healthy

`playtest.mjs --only look` on `2b15f687`:

* **0 page errors**;
* 10 look spots, none flagged;
* every spot reports the same envelope — up 60.16°, down −35.52°, 83.16° of world visible above the
  horizon — so the look-up range is uniform and none of the merges since my 19:30 sweep has narrowed it.

That is the check a returning integrator would otherwise have to run first.
