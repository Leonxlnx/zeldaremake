# Prop contact integration review — 2026-09-21

The character hook consumes Fable-3's `ctx.shared.propBlockers` from commit `e9a9fcdb333b79c0dfe5f32fda28e9655738f6f9`. It adds the player's 0.12 m radius to each published solid disc and checks those discs before `ground.blocked()` returns early for a walkable platform. Props therefore block movement on decks as well as terrain. Existing walls, structure masks, the log tunnel and NPC callers keep their existing paths.

The root agent imported Fable's four producer/type files unchanged and committed the integration locally as `e5f9365c`, with Cursor Agent attribution. The hook changes **only `src/world/character/ground.ts`** relative to `ec79e4ed`; it adds no movement or landing framework and leaves `character/index.ts` unchanged. The raw-production regression, `props/geometry.test.mjs`, project typecheck and build all pass. Push is pending at this review checkpoint. The world already builds props before character, so its published array is available when `createGround` captures it.

## Deliberate height policy

Solid props use the existing two-dimensional wall policy at every height. Link cannot jump over them or stand on their tops with this hook. Published `top` values remain unused until landing support is implemented. The source marks this limit with `ponytail:`. This also means a future low prop beneath a walkable deck needs a broader support policy before being placed there.

An optional height bypass was tested and rejected. The actual extracted `stepPlayer` entered a prop while its ballistic base was at 3.8/3.54 m, stopped horizontal motion while descending at 3.02 m, then landed at the underlying 3.0 m ground while still inside the prop's body (top 3.5 m). Merely passing `j.y` to `blocked()` cannot handle that vertical landing. The final disc policy stops entry on the first frame; the same counterexample is retained as a regression. The rejected trial remains local in `height-bypass-*` and `*.height-bypass.ts`.

## Runnable CPU check

Run the applied local source from the repository root:

```text
node art/characters/link/progress/2026-09-21-prop-contact/check.mjs
```

The default loads raw production source and builds the actual prop publisher with deterministic terrain and texture stubs. It uses the existing tests' in-memory TypeScript loader pattern; it requires neither a browser, a renderer, a GLB, historical Git objects nor source snapshots. The real `moveRoot` and `stepPlayer` closures are extracted with the TypeScript AST and executed against controlled ground/actor state, so the player call sites are tested rather than reimplemented.

The root agent ran this default command against the applied source: **10 checks passed, zero failures**. The exact result is [`check-production.json`](check-production.json), SHA-256 `f7bf88f7bcc8df02a1d218b770e7ba47f319c2908292dfe6073ed5831622f2b3`. In the descent counterexample the player remains at x = 500.35 m on every frame and lands outside the prop (`bodyInside: false`). The report records these raw input hashes; line-ending changes can change them without changing TypeScript behavior:

| Raw production source | SHA-256 |
| --- | --- |
| `src/world/character/ground.ts` | `2e61839bc6314039e3679e10961751ca1cb89bb2b1ee81f10d1062482505c4be` |
| `src/world/character/index.ts` | `2cc06a0e01b0dcded198f1446ba6b7365a48fd9b765887d021c2111a9910d4de` |
| `src/world/props/index.ts` | `07365939eff71eee15a43dac28f46e5226fb75fabd0328f05d020d1d4b93cfd1` |

For the preceding isolated review, `--candidate` explicitly selected prepared character/producer snapshots and passed all ten checks. `--before` explicitly selected the unmodified character snapshots with Fable's producer and failed seven relevant contact checks. These optional historical modes require local review snapshots; the default command does not. Candidate TypeScript validation against Fable's producer and type source completed with no diagnostics. The root agent also completed the production props test, project typecheck and build successfully (build bundle `index-_T_gIcCc.js`). Production edits were owned by the root agent; this review modified only its isolated evidence files.

The checks cover expanded-disc boundaries, props on raised platforms, preserved wall/structure blocking, grounded movement, airborne blocking and the descent counterexample, existing NPC default calls, authored routes, and the real west-deck pot. The west walk-surface fixture uses the same published formula as `props/geometry.test.mjs` and `distantHouse.ts`; it is not a new rendering fixture.

## Route findings with the expanded radius

The Fable publisher creates 46 blockers. Six authored path centrelines remain clear; the smallest margin is **361.49 mm** on `pathToHouse`. All five flights retain clearance across their authored full tread widths and hardscape `landingLength`:

| Flight | Minimum expanded-disc margin |
| --- | ---: |
| Main | 342.00 mm |
| House-west / Saria | 62.96 mm |
| Ledge | 4,550.49 mm |
| South-bank | 7,468.12 mm |
| West-house | 93.54 mm |

The NPC loop's minimum disc margin is **557.71 mm**, and its existing 0.25 m default `blocked(x,z)` samples are unchanged. This caller audits the authored NPC loop; it does not dynamically redirect the NPC.

The west-door pot does obstruct the deck centreline by **92.85 mm**. A route 0.20 m toward the opposite side has **107.15 mm** additional disc clearance, with the player's radius still inside the 0.95 m deck. Its turn from the flight/deck junction has 611.74 mm disc clearance; 199 actual `ground.blocked` samples across that entry and corridor remain open. The player must steer around the pot; this hook does not add sliding or automatic avoidance.

Three expanded rims reach the soft terrain masks: Saria's bucket and crate touch the path mask, and the west-landing crate touches the stair mask. Thus Fable's original body-radius-only statement that no disc reaches a path should not be repeated for the expanded discs. The authored paths and flight widths above remain open. These are route checks against the declared layout and collision discs, not proof of exact triangle/capsule collision everywhere.

## Integration allowlist

Already imported unchanged from Fable's commit, preserving attribution; include these four files in the integration:

- `src/world/props/index.ts`
- `src/world/props/geometry.test.mjs`
- `src/world/props/README.md`
- `src/world/system.ts`

Include the integrated hook, standalone regression, documentation and exact raw-production evidence:

- `src/world/character/ground.ts`
- `art/characters/link/progress/2026-09-21-prop-contact/check.mjs`
- `art/characters/link/progress/2026-09-21-prop-contact/README.md`
- `art/characters/link/progress/2026-09-21-prop-contact/check-production.json`

These eight files are the integration allowlist. `prepare.mjs`, patches, source snapshots, candidate/before reports, input manifests and rejected height-bypass files are local review material; the default regression does not depend on them. No change to `character/index.ts` belongs in this integration.
