# The held sign (T), 2026-09-27

The owner (01:24): Link holds the X "Readers added context" note — "a short non-interactive AI-generated demo" —
up over his head, and runs with it, on a key press.

- **T** (gamepad **Y**) raises the sign in play mode; T again lowers it. The arms and the sign move on one eased
  weight over 0.35 s (`SIGN_RAISE_S`).
- A picket sign: Link's arms are too short (upper arm 0.165 m, forearm 0.112 m, shoulders 0.80 m up) to hold a
  board over the cap (he stands 1.20 m), so both fists grip a pole in front of the chest and the board sits on top
  of it, its bottom edge 1.30 m over the feet. The board is 1.4 m wide at the screenshot's aspect so the note's body
  text reads from the follow camera 4.3 m behind; the note is on both faces (each reads the right way round from
  its side) and lit a little from within so it stays legible in the canopy's shade.
- `src/world/character/signPose.ts`: the layout (chest-bone frame) and the two-bone arm reach, dependency-free and
  unit-tested (`signPose.test.mjs`: reach / clamp / degenerate pole, grips on the pole inside each arm's reach, the
  board clear of the cap and behind the pole, the raise easing, the texture shipped and credited).
  `src/world/character/sign.ts` builds the meshes; `glbLink.ts` (`applySign`, after the arm overlay) eases the raise,
  lifts the sign up the spine into place and aims each shoulder at the solved elbow and each forearm at its grip.
  The sign is parented to the chest bone and built on the first raise — play mode only, so the six fixed captures
  never contain it. The character audit reports `linkSign: { up, raise }`.
- The face: `public/textures/sign/readers-note.jpg`, the owner's screenshot re-encoded (metadata stripped), credited
  in `public/textures/CREDITS.md`. Anti-cheat source checks green (C1, C2, C4, C5).

`sheet.jpg`: from behind and from the front standing with it up, and two frames of the run (1280 × 720 play mode,
`sign-shots.mjs`, a real `KeyT` press through the play-test hook; the audit read `{"up":false,"raise":0}` before
the press and `{"up":true,"raise":1}` after).

```
node art/environment/sign-2026-09-27/sign-shots.mjs --dist dist --out <dir>          # stills
node art/environment/sign-2026-09-27/sign-shots.mjs --dist dist --out <dir> --take   # the running take (frames)
```
