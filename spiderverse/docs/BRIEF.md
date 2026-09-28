# INTO THE ANT-VERSE - production brief

120 seconds, 24 fps, 1920x804 (2.39:1), no dialogue. Technique bible:
`/workspace/docs/research/SPIDERVERSE_STYLE.md` (measured, sourced). Timing: `app/core/edit.js`.
Placement: `app/core/layout.js`. Contracts and file ownership: `docs/INTERFACES.md`.

## Logline

At midnight, a tiny ant courier promises a hungry little one she'll bring food home. She
crosses a vast kitchen counter, wrestles a heroic cookie crumb free, survives a slamming mug
and a sweeping sponge by running up a wall - then the cleanup floods the only road home. She
saves the crumb with the bottle cap she stood on at the start, and the whole colony links into
a living chain to pull her in. The promise is kept.

## Characters

| Character | Design | Acting notes |
| --- | --- | --- |
| **The Courier** (hero, "she") | Young adult worker ant ~7 mm. Glossy black exoskeleton with **Miles-red** markings: a red stripe down the thorax, red gaster bands, red mandible tips. A **notch in her left antenna** (her silhouette tell). Oversized head for appeal; big compound eyes styled like **Spider-Man mask lenses** - a white graphic highlight shape that squints and widens. | Determined, scrappy, funny under pressure. Big clear poses. Thinks with her antennae. |
| **Little One** (the heart) | A young ant ~4 mm, very big head and eyes, round soft forms, **caramel/amber** colour, one **bent antenna**. | Hungry, hopeful, brave at the end - she is the tip of the living chain who catches the Courier. |
| **Two siblings** | Young ants ~4-4.5 mm: one taller and skinny (ochre), one tiny and round (rust). | Reaction and comedy in the nest; part of the chain. |
| **The Colony** | 20-40 adult workers, dark brown to black with small variations in size, gloss and markings. LOD for crowds. | Hungry, then the living chain: they link mandible-to-leg into a bridge. |
| **The Kitchen** (antagonist) | Humans are never shown in full - only a mug descending from frame top, a sponge sweeping, and one big graphic hand wringing the sponge. | Indifferent, huge, fast. |

## World geography (top view - keep it readable in every shot)

```
        -Z (north)            BACKSPLASH TILE WALL  (z = -600)
   x=-560 ...   [NEST crack x=-300]   [bottle cap x=-240]          [microwave clock]
  SINK |~~~~~~~~ flood river along the wall base (acts 4-5), flows WEST ~~~~~~~~>
  drop |                                   [MUG lands x=150]   [CUTTING BOARD x 200..500, crumb on it]
  x<-460         teal Formica counter  (y = 0)
                                                                  +X (east) ->
        +Z (south, counter front edge z = 0)
```

- **Outbound (home -> crumb) moves screen RIGHT. Homebound moves screen LEFT.** Break this only
  with a motivating camera move the audience can follow.
- The nest is a crack in the grout at the base of the backsplash at `x = -300`; its lip sits
  ~6 mm above the counter, so water flows past it without flooding it.
- The **bottle cap** (red, crimped, open side up) with a **toothpick** leaning against it sits
  near the nest (`x = -240`). The Courier stands on it as her lookout in S03 - both objects are
  deliberately established there so their return in S14 is fair.
- The **cutting board** (wood, 18 mm thick) is far east (`x = 200..500`); the crumb is wedged in
  its juice groove.
- The **mug** lands at `x = 150`, just west of the board - squarely on the road home.
- The **sponge** sweeps west to east; the **hand** later wrings it over the wall base near
  `x = -120`, and the water runs west along the wall base to the **sink drop** at `x = -460`.

## Shot list (19 shots) - frames in `app/core/edit.js` are authoritative

| # | Time | Shot | Content |
| --- | --- | --- | --- |
| S01 | 0.0-5.0 | ESTABLISH | Ant-height extreme wide of the midnight kitchen: vast teal counter, the tile wall rising like a cliff, microwave clock `11:58` glowing green, moonlit window. The camera cranes down and pushes toward a warm glow at the base of the wall: the nest crack. |
| S02 | 5.0-11.0 | THE PROMISE | Inside the nest: an empty larder chamber. Three hungry young ants. Little One's tummy rumbles (visual: a comic growl line). The Courier kneels, touches antennae with Little One - a promise - and turns to go. |
| S03 | 11.0-18.0 | LOOKOUT | Out on the counter, she climbs the bottle cap (toothpick leaning against it), stands on the rim and scans. POV reveal across the counter: a golden cookie crumb glowing under the range-hood light on the cutting board. Freeze frame + caption box `ONE CRUMB.` + radial burst. |
| S04 | 18.0-23.0 | THE RUN | Side-on truck, low, screen right: she sprints across the Formica through sugar grains, on 2s with smears, speed lines, `SKITT`. Landmarks pass: the spoon, a sugar spill. |
| S05 | 23.0-29.0 | THE CLIMB | Up the cutting board's end grain - a wooden cliff. Hand-over-hand climb, a slip, recovery, over the top. The crumb, wedged in the juice groove, bigger than she thought. |
| S06 | 29.0-37.5 | EXTRACTION | Physical comedy: she pulls - nothing. Braces all six legs - nothing. Plants on the crumb and heaves - POP - it flies free, she tumbles backwards, it lands on her (squash). She wriggles out, hoists it overhead, wobbling under the weight, grins. |
| S07 | 37.5-42.0 | SHADOW | She climbs down the board with the crumb. A hard-edged shadow sweeps over her. She looks up: up-angle on the mug's foot ring descending, eclipsing the light, cyan crackle rim. |
| S08 | 42.0-47.0 | SLAM | Contact. Two graphical flash frames (flat colour field, black silhouettes, line screens), `KRAKOOM`, a 3-panel split (foot ring hits / coffee leaps / her eyes wide), shockwave, sugar debris - the crumb is knocked flying out of her grip. |
| S09 | 47.0-54.0 | CHASE | The crumb bounces and rolls across the counter through falling debris; she chases, dodging grains, and dives to catch it at the last moment. |
| S10 | 54.0-60.0 | SPONGE | A giant yellow sponge sweeps in from screen left - cleanup - between her and home. Trapped against the mug wall. She looks up the wall. Decision. |
| S11 | 60.0-72.0 | WALL-RUN | She runs straight up the mug and around it (camera orbiting), over the handle, and launches off as the sponge wipes the spot below - a brief punk-universe style break mid-leap - and lands on the home side. `VWOOP`. |
| S12 | 72.0-78.0 | TORRENT | Running home (screen left). The big graphic hand wrings the sponge above the wall: a torrent pours down and floods the wall base into a river flowing west. The road home is cut. |
| S13 | 78.0-84.0 | LOST | At the river's edge she slips; the crumb tumbles in and floats away. The music drops out. The palette drains to blue as the world shifts into a watercolour emotional register (Gwen's-world technique). She is alone. |
| S14 | 84.0-90.0 | THE IDEA | The red bottle cap drifts past, the toothpick with it. Match to S03. Idea beat (graphic flash, sparkle). She shoves the cap into the current, jumps in, grabs the toothpick as a paddle. |
| S15 | 90.0-96.0 | THE BOAT | Paddling hard through graphic rapids; she catches the crumb and hauls it aboard. |
| S16 | 96.0-101.0 | THE DROP | The current accelerates toward the sink edge - a waterfall. At the nest crack above the water, the colony sees her pass. |
| S17 | 101.0-110.0 | THE CHAIN | The colony links into a living chain, first down the wall, then racing along it after the cap - escalating from three ants to dozens. Little One is the tip. The cap reaches the brink; Little One stretches - catches the Courier's foreleg as the cap goes over. |
| S18 | 110.0-114.0 | HAUL | The colony hauls them up into the crack; the cap tumbles into the sink below. The crumb is still in her mandibles. |
| S19 | 114.0-120.0 | HOME | Warm nest. The crumb shared; Little One eats. Courier and Little One touch antennae - the promise kept. Freeze into a printed comic panel; title `INTO THE ANT-VERSE`. |

## Colour script

| Act | Shots | Palette | Why |
| --- | --- | --- | --- |
| Promise | S01-S03 | Midnight indigo `#1B1242` and teal `#1F8A8F` outside; **amber `#FFB21E` inside the nest**; the crumb is gold `#FFC83D` | Warm = home and food; the crumb is the only warm thing outside |
| The crumb | S04-S07 | Teal counter, magenta `#FF2E88` / cyan `#35E0FF` rim lights, warm wood `#C8864A` | Adventure, saturation up |
| The mug | S08-S11 | Flash frames hot coral `#FF6B5A` / yellow `#FFE033` with black silhouettes; chase in magenta/cyan; wall-run white mug, yellow accents; punk break black/pink/acid yellow | Threat, maximum graphic energy |
| The water | S12-S15 | Cold blue `#2A4BD7` water, indigo shadows; S13 drains to near-monochrome watercolour; S14 one warm yellow idea flash, then red cap `#E8202A` | Loss, then hope |
| Rescue | S16-S18 | Blue water vs **amber colony light** spilling from the crack; red cap; high saturation | Home reaches out |
| Payoff | S19 | Warm amber and gold, soft magenta accents; paper cream `#F5EFE6` panel | Warmth |

## Look rules (from the research - these are not optional)

1. **Painterly 3D forms**: shading is stepped into 3-5 designed bands per material and broken up
   with brush-stroke texture (Dimian: "quantized using brush strokes"). No smooth gradients.
2. **Ink accents, not uniform outlines**: coloured lines (deep indigo `#1A0B2E`, never black) on
   silhouettes and plate seams, thick-thin, hand-wobbled, redrawn on 2s, overshooting at times.
   Heavier on characters, lighter and sparser on the environment.
3. **Selective halftones**: dots live in the transitions between bands (Thresher), applied as a
   multiply; 8 px pitch at 804 px picture height, 45 degrees, one screen for all inks. Line
   hatching in shadow bands. Screen-locked on light and glows, object-locked on surfaces.
   Selective: characters and key props get them; broad flat areas often stay clean.
4. **Defocus = misregistration, motion = chromatic trail.** Never a blur.
5. **Mixed cadence**: characters on 2s (1s for the fastest action), antennae on 3s, the colony
   on 2s/3s offset, 2D FX on 2s, the **camera always on 1s**.
6. **Comic devices where they earn it**: freeze frames with caption boxes (S03, S19), flash
   frames (S08), split panels (S08), onomatopoeia, speed lines, Kirby crackle, an idea burst
   (S14), a punk style break (S11), a watercolour emotional register (S13).
7. **Contact and weight**: every foot plants; contact shadows are hard designed shapes under
   every character and prop; heavy things (the crumb, the mug) move with weight.
8. **Staging**: one idea per shot, strong silhouettes, the Courier always readable, screen
   direction respected.
