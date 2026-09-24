# One bug explains three of his four screenshots: the near veil eats the material (squad4, 00:35)

Reproduced on `origin/cursor/kokiri-world-phase1-f65e` @ `81430baf`, the build behind the play link.

## The measurement

The lantern bough rendered from two distances on the same build:

- `pods-at-5m-current-head.png` — at **5 m** the bough is brown bark with visible relief, the leaves
  are green, the pods have clear orange cores.
- `bough-at-12m.png` — at **12 m** the same bough is a flat pale grey-green slab. No bark, no relief,
  the leaves desaturated, and everything behind it a milky wash.

`bark-5m-vs-12m.jpg` puts the two crops one above the other. It is the same geometry and the same
material, seven metres apart.

## What that means for his words

- *"the main tree branch that sticks out when I first go into the game … it just looks like a dead
  branch"* — it does, at 12 m. The bough has lost its wood.
- *"why did those stop glowing?"* — **the pods have not stopped.** They are lit at 5 m and lit at
  12 m; they read as dead because the bough around them has been lifted to the same grey, so there
  is no contrast left for a small warm light to win. Fixing the pods would be fixing the wrong thing.
- *"the trees, there's a glow that kind of cuts in half, the top looks blurry and the bottom looks
  alright"* — the veil is height-dependent, so a tall bole wears little of it at the root and a lot
  at the crown. A hard-edged band across a trunk is what a per-vertex fog term does on a bole whose
  rings are far apart (`owner-2300-trunk-seam.png`).
- *"the foliage when I look up … something's wrong"* — an up-ray carries the most veil of any ray in
  the scene, so the canopy gets the worst of it (`owner-2300-foliage-lookup.png`).

Three of his four screenshots are the same defect seen from three angles. The fourth is the stairs,
which is fixed on `agent/squad4-owner-2300-stairs`.

## Where it came from

Four atmosphere commits landed today raising the lit air, all answering fable-5's 10:28 read that
"the corridor is darker than before the squad": `bca84c5a`, `f040df27`, `b9c07ac6` ("the corridor's
5–25 m band reads as air again") and `15b59529` ("the lit air reaches the corridor's upper band").
Each was measured on the **far** bands at the owner's north pose and each moved them toward his
recording. Nothing in that loop measured what the near field was doing, and the near field is where
he is standing.

`heightfog.ts`'s own comment for the current density says "the foreground to 8 m still wears under
4 % and stays crisp" — that is the *distance* haze only. What is washing 12 m is the sum of the
height term, the near-field airlight and the mist tiers on top of it.

## What I did NOT do

I did not touch `src/world/atmosphere/`. The squad-1 chat is live in that file right now
(`agent/squad1-corridor-light`, merged at 23:05 and still pushing), and a second hand in it an hour
before a recording is how both passes get lost. This is a hand-off, with the reproduction already
done.

## The aim for whoever takes it

Keep every far-band number squad 1 has won — they match his recording now — and put the near field
back. Concretely: the veil fraction a surface wears at 5, 10, 15 and 20 m, plotted before and after,
with the 25–60 m bands held where they are. The bough at 12 m should read as wood.
