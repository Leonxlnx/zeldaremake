# `agent/fable-3-fingers` (PR #169) `8da5a612` — four fingers on the Kokiri hands — non-author read (fable-5, lane 10)

**Read 2026-09-25 23:46 – 26 00:15 UTC.** One commit, 33 lines in `character/kokiri.ts`: four `CapsuleGeometry(0.0072, 0.026–0.034, 2, 6)`
fingers hang from each mitten ball's lower front, splayed ±0.07 rad and curled −0.22 rad toward the palm, roots inside the ball, skin
material, merged under the elbow joint into the skin's skinned submission — no extra draw. About 60 triangles a finger, ≈ 480 a kid.

## The six views — pixel-identical

Against the head `bed93a19`: A B C D E F **1.0000 / 0.00 %** at all six (the reference column unchanged: 0.1732 / 0.1690 / 0.1791 /
0.2334 / 0.1899 / 0.2029). Capture passes no player, so no kid turns or waves in the fixed frames, and at 8–10 m the digits are under
a pixel.

## In play, at greeting distance

Link placed 1.4 m from the south-bank kid (−18.72, 17.10). Facing her straight on she is hidden behind him — the frame shows her fairy
beside Navi and nothing else changes (0.00 %). Turned so she stands beside his shoulder (Link (−17.6, 16.3) facing 272°, the follow
camera 5.5 m from her): **draws 422 on both builds, triangles +960 on the branch — two kids' fingers in frame**; the frames differ in
one tile (1.3 % of it), her hands. At 3× (`it143-fingers-southbank-hands-3x.jpg`, the head left, the branch right): the hands at rest
by the skirt read as hands with digits where the head's are balls with a thumb — a few pixels' worth at that distance, no seams, no
gaps at the wrist, the skin tone continuous.

**The wave I did not catch.** The commit's claim is for the raised hand at 1.7–2.6 m; my frames at 0.9 s and 1.5 s after placing Link
inside `GREET_NEAR_M` show her turned to him with both arms down. `standGreet` arms on `d < 1.7` from the first update, and the wave is
`WAVE_DELAY_S` 0.2 s after — so either the wave is the wandering girl's greeting only, or it wants an approach rather than a placement.
fable-3 will know which; it does not bear on the fingers, whose rest pose is what the player sees most.

## Verdict

**PASS for merge**: pixel-identical at the six views, no draws, ≈ 0.5 K triangles a kid, and the hands read as hands at the follow
camera's distance. The note for the author is only the one above — a frame of the wave with the fingers in it would close the claim.
