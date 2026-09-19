# Owner review — 2026-09-19 07:56 UTC (after the round-46 update video)

Four screenshots from the Nintendo of America 15-minute gameplay video (comparison references
only — never scenery, see GAUNTLET.md). The owner's spoken fix list, transcribed into items with
the lane that owns each. This is the brief for rounds 47–48; the owner says more references
(the backside of the house area, the right side of the steps, the forest-temple area) follow.

## References

| file | what to read from it |
| --- | --- |
| `ref-01-plaza-house-signpost-kokiri-girl.png` (1:42) | plaza in front of Saria's house: the girl Kokiri stands at far left with a fairy over her; the signpost with carved lettering; the pod lanterns on the house's bough (8+ pods, warm, close together); mist across the middle ground; the flagstones' scale relative to Link |
| `ref-02-equipment-deku-shield.png` | the equipment/bag screen: item rendered in 3D on a dark vignette with its name ("Deku Shield") underneath |
| `ref-03-marked-arch-depth-and-right-steps.png` (0:56) | owner's red marks: (a) the log arch in the distance with a **deep, misty world visible through and beyond it**, tall dark trees rising over it; (b) a **raised stone stair on the right bank** climbing to a ledge — "it should be raised" |
| `ref-04-raised-ledge-pods-right-bank.png` (2:22) | the path north under a tall rock/root ledge on the right with pods hanging off a leaning trunk at left; dense dark ferns and shrubs at both edges; a Kokiri standing on the ledge above; fine leaf litter everywhere; two falling leaves in frame |

## Fix list (owner's words → item → lane)

### Character (Link) — lane `character-9` (fable-cursor) + Astra for clips/model
1. "The way he walks and moves his arms is a little unnatural. His arms should move slow, and when
   you run, a little bit faster." → arm swing amplitude/rate per gait; walk arms slower and smaller.
2. "The run should be a little bit faster." → `GAIT_SPEED.run` 3.9 → ~4.6 m/s with the clip rate
   following (no foot slide).
3. "His walking looks like he's moonwalking — his legs look unnatural." → stride/speed mismatch:
   the feet slide relative to the ground. Match playback rate to ground speed per frame, plant the
   stance foot.
4. "When he walks up the stairs, his legs look like they're going into his body." → stair gait
   IK: the swing leg over-lifts / the pelvis drops; keep knee/hip range, lift the root on the riser.
5. "Run faster and even jump, like Zelda." → jump (Space / gamepad A) with a landing.
6. "Reach into my bag — right-click or ZR." → lane `shell-1`: equipment screen on right mouse /
   gamepad ZR with 3D item cards (Deku Shield first), styled like `ref-02`.

### The Kokiri girl — lane `npc-1` (fable-cursor) + Astra for a 3D model
7. "The girl should be walking around." → NPC walk loop on the plaza/lawn with idle stops; a
   sitting pose on the steps; her fairy hovering in front of her ("a green fly in front of her").
8. "Have Astra make a 3D model for the girl as well." → asked on PR #2 / INBOX.

### Trees — lanes `trees-30` (running), `distant-1` (running), `lod-1` (next)
9. "The trees immediately spawn high quality around me — I have to get too close before they
   look good." → near-LOD swap distances out (near base 10 → 18 m, near canopy further), pool
   budget up, prewarm around the player.
10. "The tree shrubs look really low quality — exactly like Zelda. Get more references." → the
    bushes/hedges: layered dark leaf clusters with lit rims (ref-04 edges), not card fans.
11. "The detail inside the little nook of the tree needs to be a lot higher." → lane
    `structures-30`: the hollow/doorway of Saria's tree and the hollow-log interiors.

### Grass — lane `vegetation-25` (fable-cursor; owner asked for Astra, she is on the character)
12. "There are patches in the grass where it's not full. I want the grass to look even better,
    even more high quality." → coverage audit at player height (no bare patches where the mask
    says lawn), denser clump carpet, blade-level detail within 6 m.

### World / walkability — lane `expansion-1` (fable-cursor: layout, terrain, hardscape)
13. "When I walk past the tree arch it needs to look even better, and I need to be able to walk
    past it." → the arch footprint is a `structure` pad (blocked); open the tunnel floor, extend
    the walkable terrain and path beyond the arch.
14. "When I walk up the steps I want more to do afterwards, like in Zelda." → the upper plateau
    and beyond the arch get destinations: the raised stair + ledge of ref-03/04, a Kokiri on the
    ledge, pods, the fence line.
15. "It should be raised — this part of the game" (ref-03 right mark) → raised stone stair on the
    right bank to a ledge.
16. "Look at the backside — I want it more accurate to that" → pending the owner's screenshot.

### Atmosphere — Astra's area; small lane `atmosphere-16` for particles only
17. "Maybe some more leaves falling down." → leaf particle count/size up, more in the mid-ground.
18. "When he walks underneath the thing there's this deep world" (ref-03) → the view through the
    arch: haze, far trees, light beyond — coordinate with Astra (haze) and `distant-1`.

### Audio — lane `shell-1`
19. "The actual Zelda music in the background." → **cannot ship Nintendo's music** (AGENTS.md:
    original or CC0 only; it is copyrighted). Build the audio system (forest ambience, footsteps,
    pod hum) with a music slot that plays `public/audio/music.ogg` when present (owner drops any
    track in locally) and an original placeholder composition in the style.

### Process
20. "How many sub-agents — can you fan out 6 more?" → 2 running (trees-30, distant-1) + 6 new =
    8. "Four more Fable 5.1 chats" → `docs/ONBOARDING_FABLE_CHATS.md`.
