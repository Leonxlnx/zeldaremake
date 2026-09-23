# squad3 — trees up close (`column.ts`, `bole.ts`, `giant.ts`, the white-barks)

Lane 3 of `docs/SQUAD_2026-09-23.md`. The owner's 09-23 items for this lane:

- red circle 1 — the column trunk left of the north path is "a smooth pale cylinder in grey haze":
  bark relief, moss, root flare, a colour that reads as wood;
- the giants' roots and limbs at player height;
- "the trees stay green — they need to render brown the second you step in" (09-21, still true on
  the 09-23 head).

`poses.json` is the lane's pose set for `gauntlet/scripts/broll.mjs`:

| pose | camera | what it judges |
| --- | --- | --- |
| `l3-owner-north` | (1.4, 1.75, −10.2) → (2.0, 1.45, −20.0), fov 46 | the owner's 06:50 north-path pose (fable-cursor's reconstruction) — the mid-distance trunks left of the path |
| `l3-column-6m` | (0.8, 1.75, −19.8) → (−3.5, 2.4, −24.7) | the column seat at (−3.5, −24.7) from 6.5 m — a walker beside a column |
| `l3-emergent-foot` | (0.2, 1.7, −6.3) → (−3.1, 2.0, −8.0) | the emergent's bole at 3.7 m — the bark a walker on the north path passes |
| `l3-giant-roots` | (−2.2, 1.7, −11.2) → (−6.0, 1.0, −12.8) | the north-west-near giant's roots at 4.1 m |

Render:

```bash
node gauntlet/scripts/broll.mjs --dist dist --out /tmp/after --size 960x540 \
  --shots art/environment/squad3-2026-09-23/poses.json --test --settle 6
node gauntlet/tmp/squad3-compare.mjs --before /tmp/before --after /tmp/after \
  --out /tmp/cmp --names l3-owner-north,l3-column-6m,l3-emergent-foot,l3-giant-roots \
  [--crops /tmp/crops.json]
```

A frame takes 60–75 s on this VM's SwiftShader, so a four-pose pass is ≈ 5 min.

## pass1 — the bark stops reading as camouflage; the columns get a silhouette

`pass1/` holds the before/after sheets. What changed and why is in the PR description and in the
code comments (`column.ts` `boleKnees`, `bole.ts` `LICHEN_TINT` / `FURROW_MOSS`, `materials.ts`
`COLUMN_BARK_FLOOR` and the `GIANT_BARK_COLOR` lichen / moss blocks).
