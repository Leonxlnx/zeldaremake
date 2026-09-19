# Dense reference frames — comparison only, never scenery

Requested by the owner on 2026-09-19 ("video encode the demo I sent you for the screenshots"):
every lane works from the whole demo, not six hero frames. Same rules as `reference/frames/`
(GAUNTLET.md C2): these images never load into the runtime; anti-cheat checks the scene for them.

## `demo61/` — the 61 s Kokiri Forest gameplay demo (`reference/video/reference.mp4`)

122 frames at 2 fps (`d_001.jpg` = 0.0 s … `d_122.jpg` = 60.5 s), 960 px wide. Frame `d_NNN` is at
`(NNN − 1) × 0.5` s. Contact sheet: `demo61-contact.jpg`.

| frames | seconds | what is on screen | lanes |
| --- | --- | --- | --- |
| d_001–d_010 | 0–4.5 | Link at the hero stairs' foot, stair block and bank, lantern bough overhead (shot A family) | hardscape, trees-30, vegetation-25 |
| d_011–d_022 | 5–10.5 | climbing the stairs; treads' wear, nosing shapes, moss in the joints; the plaza opens | hardscape, vegetation-25 |
| d_023–d_036 | 11–17.5 | the plaza toward Saria's house: flagstone scale, joints, the house's hollow doorway and pod cluster, the signpost, the Kokiri girl with her fairy, mist across the middle ground (shot B family) | structures-30, npc-1, props, fable-3 |
| d_037–d_056 | 18–27.5 | look-back across the plaza and the lawn; white-bark trees, column trunks, distant layers (shots C/E) | fable-4, distant-1, vegetation-25 |
| d_057–d_088 | 28–43.5 | **the equipment / bag screen**: dark wood-panel frame, Link turntable at left, item grid at right, item names — the direct reference for the bag on right-click / ZR | shell-1 |
| d_089–d_100 | 44–49.5 | back in the world: the north path and the raised right bank, ferns and shrubs at the verge | expansion-1, vegetation-25, fable-2 |
| d_101–d_116 | 50–57.5 | toward and under the giant hollow log arch; the misty world beyond it; god rays (shot D family) | structures-30, expansion-1, distant-1, atmosphere (Astra) |
| d_117–d_122 | 58–60.5 | fade to the title/UI card | — |

## `review46/` — the owner's 46.5 s recording (`art/environment/owner-video-review/reference-review.mp4`)

46 frames at 1 fps (`r_001.jpg` = 0 s … `r_046.jpg` = 45 s), 960 px wide. Riverside path,
character close-up, the shaded forest lane (~14–30 s — the frames that matter for us), town,
desert. Lighting reads come from the forest frames only (see the README beside the video).
Contact sheet: `review46-contact.jpg`.

## Owner screenshots from the Nintendo 15-minute video

`art/environment/owner-review-2026-09-19/ref-0[1-4]*.png` (plaza + girl, the bag's item card,
the marked arch + raised right steps, the raised ledge with pods). Their frame-by-frame analysis
is `fable-5`'s lane (`reference/ANALYSIS_VIDEO2.md`).
