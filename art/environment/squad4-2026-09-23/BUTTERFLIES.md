# Butterflies over the flower verges — backlog item 5's missing third (lane 4, 2026-09-24 08:00)

Lane 4's own list was down to refinements, so I took the next unclaimed §Backlog item: **5. Falling
leaves, fireflies, butterflies: gentle life in the air, not spectacle.** Two of the three already
exist — `atmosphere/leaves.ts` (falling leaves) and `atmosphere/motes.ts` (drifting motes, audited
as `fireflies`). **Butterflies did not exist anywhere in the source.** This is them.

## Why they live in `vegetation/`

They are anchored to the **violet clumps the verge passes seat** (`plants.ts`): each butterfly
wanders a slow closed loop around one flower clump and rests on it at the end of the loop. Where the
flowers gather, so do they; a verge with no flowers has none. Tying them to the flower set rather
than scattering them over the disc is what keeps them from reading as decoration.

## How they are built

One `InstancedMesh`, four triangles a butterfly — two wings, two sides — and **one draw**. The flap
is done in the vertex shader from `uTime` and a per-instance rate, so the CPU writes only a matrix
per butterfly per frame. The rest angle is open rather than flat, so a resting butterfly holds its
wings up instead of reading as a card lying on the ground.

Deterministic like the leaves: every anchor, radius, period, phase and colour comes from
`ctx.rng.fork('butterflies')`, and the pose at time `t` is a closed-form function of `t` — a capture
at a fixed simulation time is identical run to run. Colours are six pale forest tones; nothing
saturated.

## Sized by measurement, not by eye

The first build used life size (a 5–8 cm wingspan). At the 5–12 m a walker sees the verge from,
that is a couple of pixels: hiding the mesh and differencing the frame gave **24 changed pixels in
a whole 960 × 540 frame** — invisible. They are now drawn at roughly twice life size (≈ 14 cm across
the pair), the same exaggeration the reference's leaves and pods use, which measures **109 pixels**
over two or three butterflies in frame — each about 35 px, a readable butterfly at that distance.

`butterflies-before-after.jpg` is the pair (hidden / shown) at the west verge: two pale flecks, one
over the green and one crossing the paving edge.

**Be honest about this one: it is subtle in a still.** Two or three in a frame is what "gentle life,
not spectacle" asks for, and the flap and the drift are what will actually sell it in motion — a
still frame is the worst case for this change, and it is the evidence I have.

## Cost

34 butterflies × 4 triangles = 136 triangles in 1 draw, no shadow cast, no per-frame allocation.
`npm run typecheck` and `npm run build` green; **43 of 43 test files pass** (including
`dispose.test.mjs`, which the new mesh has to satisfy).

## Something I noticed and did not touch

At the west verge (`bfly-verge` pose, around x 220–300 / y 250–290 of the 960 × 540 frame) there are
large pale-yellow blobby shapes among the foliage that read as flat stickers rather than plants.
**They are not the butterflies** — they are present with the butterfly mesh hidden. They look like a
bush or flower LOD card seen close. That belongs to whoever owns that set; I am flagging the
location rather than guessing at the mesh.
