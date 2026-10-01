# The roof from under it, in the plaza — it reads, and the one jarring thing is not the canopy

Lane 2, 2026-09-28. Branch `cursor/squad2-treephases-682b`, PR #210.

The canopy roof is the third part of this lane's charter and the one that had gone longest without a
fresh look: earlier rounds checked the open north (`roofsky/`, `upring/`), the log arch and bridge
(`uplooks/`), the grove shelf and the hero tops (`roofcover/`, `headcheck/`) — but **not the straight-up
view from the middle of the plaza**, where the player stands most. Two poses from the plaza centre
(0.5, 1.75, 1.0), 960×540, `--settle 6`: straight up, and 45° up toward the north.

## What it looks like

`plaza-straight-up.jpg` — layered crowns with real sky gaps all the way across, boughs crossing at two
depths, no dark flat mass and no bald patch. By horizontal strip (`strips-straight-up.txt`), leaf
coverage runs 47–61 % with mist (the sky through the gaps) 6–25 %, so the ceiling is foliage with light
between it rather than a lid: the complaint that started `roofsky/` (98.5 % of the roof's pixels under
level 30 in the open north) has no counterpart here.

`plaza-up-45.jpg` — the same canopy read obliquely: dappled layers, the giants' boughs, the mist behind
them, a lantern-lit hut at the lower right. Nothing flat, nothing bald.

## The one thing that jars, and whose it is

On the right of the straight-up frame sits a cluster of **large, smooth, glossy leaves** in a completely
different visual register from the stippled canopy around them — perhaps ten times the leaf scale, much
more saturated, lit with a smooth gradient where their neighbours are speckled.

`big-leaves-attribution.jpg` settles whose they are: base | trees hidden | vegetation hidden |
structures hidden. They survive hiding the **trees** (42 meshes) and the **vegetation** (65), and vanish
only when **structures** (185) goes. They are that system's climbing foliage (`structures/foliage.ts`),
and the mismatch is its leaf scale and gloss against the canopy it grows into — not the roof.

This is the third time this week that something which looked like a tree defect turned out not to be
(the bald pole at ~55 m was the north grove's trunk house; the pale quad in the north corridor was
understory in mist). The method that settles it every time is hide-and-screenshot, never
`__ZR__.isolate()`, which restores visibility before it returns.

## Files

- `plaza-straight-up.jpg`, `plaza-up-45.jpg` — the two frames.
- `poses.json` — the poses, for re-rendering.
- `strips-straight-up.txt` — leaf / mist / dark shares by horizontal strip, both frames.
- `big-leaves-attribution.jpg` — the region with each system hidden in turn.
- `strips.py` — the strip metric (fable-5's `hls` with the same thresholds).
