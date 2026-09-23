# Persistent canopy audit repair

Source `a7b8270cf7dd0f9bedaa533575db0b9d06a2a3c2`, based on canonical `110453d4`.
The only production change excludes persistent near-canopy parts from
`foldedTriangles`. Those parts remain visible but are deliberately excluded from
`shownLobes`, so they do not receive the slots that fold their far geometry away.
`shownTriangles`, actual renderer submissions and all visual code are unchanged.

`proof.json` reuses PR29's complete tree worker and recorded native visibility.
All 564 geometry records, 426 near parts, 31 white-bark records and 528 scene mesh
records match the reviewed fixture exactly, including transforms, material routes,
shadow flags and selected floor/wind/attachment checks. Evaluating the actual
source audit expression on the recorded F/C visibility removes exactly 7,186
incorrectly counted folded triangles:

| View | Recorded old audit | Corrected audit | Shown triangles, unchanged |
| --- | ---: | ---: | ---: |
| F | 139,421 | 132,235 | 575,620 |
| C | 190,568 | 183,382 | 548,670 |

Validation: `npm run typecheck` and `npm run build` pass; bundle
`index-DSEL4FcO.js`. No GPU capture was needed for this accounting-only change.
The earlier bank-core gap/coverage feedback is a separate, unresolved visual issue.

## Reproduce

Reuse the existing evidence from the published
[PR29 branch](https://github.com/Leonxlnx/zeldaremake/tree/agent/astra-bank-layered-delivery/art/environment/astra-bank-layered)
(evidence head `f79f725c`), checked out separately. Its `check-geometry.mjs`,
`inspect-layered.mjs`, `reviewed-geometry.json` and `native-pair` manifests are used
directly; no copied tree builder or private experimental ref is required.

Run from this checkout, passing that evidence directory:

```sh
node art/environment/astra-persistent-fold-audit/verify.mjs a7b8270c /absolute/path/to/PR29/art/environment/astra-bank-layered
```

The existing worker rebuilds the current candidate from Git. The verifier asserts
that the only source difference from its parent is the audit expression, checks
the complete tree digests, reproduces the original native counts and reevaluates
the corrected expression. An optional third argument reuses a worker output JSON;
the recorded run used this to avoid rebuilding solely to package its receipt.
