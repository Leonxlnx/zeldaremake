# Owner review, 2026-09-23 23:00 UTC — his words and his four screenshots

He is recording a video in **two hours**. Everything below is his, transcribed; the diagnosis under
each item is mine (fable-squad4) from his screenshot and the code, so a lane can start from a file
rather than from a guess.

## His words

> whenever I walk up or down the stairs, it glitches the frames like up and forth every each step,
> which is annoying and that keeps like cutting … good job for expanding the back, but I need you to
> start adding some more stuff quickly, like that you saw in the other videos … the trees look good
> with the green spot around them, but the foliage in the beginning looks great, and when you go
> outward the foliage — something's wrong, you'll see in the screenshots where I look up … the trees,
> there's a glow that kind of cuts in half, the top looks a little bit blurry and the bottom looks
> alright, I don't know if that's from the fog … the main tree branch that sticks out when I first go
> into the game — why did those stop glowing? … it just looks like a dead branch … I wish you could
> make the other characters look a bit better … the trees show the brown, but they only get detailed
> when I come up close to it, I wish you could stop that … a lot of the trees just look fake, it's a
> weird art style direction … the stairs, I don't know if they look that good or not … the music kind
> of still shakes whenever I run with the characters, the music needs to stop shaking

Reference for the stairs: the first-look clip he keeps pointing at,
<https://x.com/DiscussingFilm/status/2097327973351272627> (our frames: `reference/frames-dense/demo61/`,
`reference/frames-dense/review46/`).

## The screenshots

| file | what he circled | first read |
| --- | --- | --- |
| `owner-2300-trunk-seam.png` | a band across the giant bole at mid height | a **hard horizontal seam**: below it the bark is saturated brown with relief, above it the trunk is flat grey-brown under a milky veil. A band boundary, not a gradient — an LOD/material band on the bole or a height-fog term applied per-vertex. |
| `owner-2300-lantern-bough.png` | the opening lantern bough overhead | the bough reads as a **flat grey slab with no foliage and no glow**, and the pods hanging from it are **grey / unlit** while the standing lamp post at the right of the same frame is lit orange. The pods' emissive is off or washed out; the bough's leaves are missing at that range. |
| `owner-2300-foliage-lookup.png` | the whole canopy band, looking up and out | at distance the foliage is **flat dark cut-out cards with hard edges** over a pale grey wash, while the near foliage (bottom left) is fine. Card silhouettes + veil, not layered crowns. |
| `owner-2300-reference-stairs.png` | the real game's long stone stairway | what our main flight is measured against. |

## Who is on what (fable-squad4's split, 23:05)

1. the stair frame hitch — **fable-squad4** (this agent)
2. the stairs' look against the reference — hardscape lane
3. tree LOD pop ("only detailed when I come close") and "the trees look fake" — trees lane
4. the trunk's horizontal seam and the milky veil — atmosphere lane with the trees lane
5. the lantern bough: dead slab, pods not glowing — structures lane
6. the canopy when looking up / outward — distant-trees lane with atmosphere
7. the Kokiri — character lane
8. the music shaking while running — audio lane
9. more of the video's content in the world — integration
