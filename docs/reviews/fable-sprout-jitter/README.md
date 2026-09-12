# Fable sprout stream correction — integration review

Reviewed `c4b95781a19fe282f3f3bfbc7d61bd9b93854ec3` and flower follow-up `cee9888d735dfa957007a13af2bc267e6457d452`, with pinned full-world CPU fixtures at quality density 1. No production edits, no GPU appearance verdict.

**The RNG correction is safe to adopt within its documented scope.** It restores 4,225 existing matrix/color pairs exactly against `77dd6657a38678c6b09bfe56d027eb0995cf36bc`. All 4,275 old placements remain. Exactly 50 old tall TUFT_B entries deliberately become TUFT_A and use the new `pocket-scatter-capped` stream; these are the only old matrix/color exceptions. Eight other clamped sizes stay within TUFT_A and therefore retain their matrices/colors. The 1,467 new lawn instances have their own streams.

The pre-lawn reference `0f9426c7267d06f13cc96be4591821fce795cb84` is contextual: its hardscape index/shared sprouts source is unchanged from 77dd665; its flagstone/geometry contact corrections are intentionally retained in the 612→cee comparisons. This review does not roll back those fixes.

## Reproduction

From the repo root:

```sh
node docs/reviews/fable-sprout-jitter/check.mjs
```

Uses the included `fixture.mjs` pinned-source TS loader, installed Three/TypeScript, and inert cached texture stubs. Reads committed source with `git show`, including when production is dirty. It writes reproduction evidence only to `gauntlet/tmp/fable-sprout-jitter-reproduction/evidence.json`; the frozen committed evidence remains unchanged. No renderer is created; the old 612 flower emits its inherited `toNonIndexed` warning.

## What passed

- Instrumented the real PRNG: the original shared sprout stream consumes exactly **86,903 sowing draws** before instance variation. All **25 source/variant block counts and order** match the frozen offset table exactly.
- Candidate vs 612: all **5,742 input spots** match after removing only `source` metadata. All original hardscape geometry buffers match except the explicitly corrected flower normal buffer; all eight stepping discs and all flagstone records match. All audit fields match except additive `sproutJitter`. A complete rebuild produces exact instance matrices/colors.
- Removed each of **13 whole sources** individually: every retained instance kept its matrix/color. Appended a spot to each of **32 populated source/variant pairs**: every earlier instance kept its matrix/color. Prepending an entirely new source and reversing the pack/variant order also preserve all existing instance matrices/colors.
- Default caller compatibility: all **30 boulder plants** retain exact spots, matrices, colors and packed geometry vs 612 when the new `jitter` option is omitted.
- `cee9888` flower source SHA256 is `5945e0b6055afd41927001ea17c9d4228e8b4971609f5b32c5abdc7978bf7f93`, identical to Astra's reviewed flower proposal. Calling its owned disposer twice emits exactly one geometry and one material disposal; no borrowed texture disposal.

## Integration detail and limits

**Retain Astra's hardscape `dispose() { flowers.dispose(); }` hook.** Fable's cee index still returns only `{name, group}`: invoking the system disposer frees nothing because none is supplied. The flower helper itself is correct and guarded, and disposes its temporary sphere. The commits do not add the previously discussed broader hardscape teardown; no existing older material/map ownership changes here.

These streams isolate **source/variant state**, not arbitrary point identity. Removing the first joints/TUFT_A instance shifts 417 later members of that pair, while zero other pairs change. The API comment accurately promises isolation from other scatters. Keep source names stable.

The frozen starts preserve the recorded density-1 seed/layout build. Other densities, seeds or future changed placement loops remain deterministic; they are not guaranteed to reproduce the historical traversal appearance. Starts are independently consumed RNG objects replaying ranges of one original sequence, so sufficiently expanded blocks can share numeric draws; they are not statistically independent random sequences. This is not state leakage.

No draw, triangle, material program or wind change is introduced by c4. Replaying legacy offsets adds one-time CPU RNG work during construction; the exact total for the active blocks is included in `evidence.json`. No per-frame RNG work is added. Actual image evaluation of restored old jitter and the separate tuft-lighting correction belongs to the ensuing capture.
