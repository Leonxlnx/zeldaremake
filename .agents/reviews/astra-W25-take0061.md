# Astra — W25 visual review, take-0061

Source aff169daa8374d962c81cd1e07221d8f9d574e83; monitor 5247e1cb8ee7723d1f359a8fb57eccef5799c777; captured 2026-09-12T03:48:56.007Z. Viewed the unedited B_house reference, take-0060 actual and take-0061 actual. The B camera is identical across the two takes. Root Astra independently inspected the actual and reference and approved this fail verdict. This artifact accompanies the official CLI review record; it does not modify the sealed take or older evidence.

## Verdict: fail, with material improvements acknowledged

The locked W25 visual criterion is: “The house on the right of shot B matches the reference: proportions, dome roof, glowing doorway.” The automatic two-house, geometry, moss roof and door-light gates pass, but visual matching is still incomplete.

The warmer brown trunk and amber interior improve the earlier pale grey house and isolated warm point. The new interior lights and roof vines are visible, the porch/eave is slimmer, and the house reads more inhabited. These are meaningful improvements to keep.

Three remaining mismatches are still clear at the same B view:

1. The roof still forms a steep, bright straw mound. The reference reads as a lower, broader, irregular mossy canopy connected to surrounding growth, with more subdued thatch and thicker moss. Leaf clusters help but do not yet change that dominant silhouette and material reading.
2. The opening is relatively narrow and upright, with a visibly manufactured rounded rectangular border; the reference has a wider dark arch that occupies more of the trunk front. The slimmer porch bough still forms a strong horizontal bar across the front, instead of the reference's more irregular branch-supported lip.
3. The interior now glows amber, but its fairly uniform brown fill and three prominent isolated light spots flatten the depth. The reference retains a dark central recess with localized warmer illumination and a more irregular threshold. This is now a refinement of a real warm interior, not the former absence of it.

The large foreground overhead bough/pod row remains a broader shot-composition mismatch, but it is not the deciding reason for this scoped W25 verdict. Likewise Link's outdated model in Fable's branch is excluded from this house verdict.

## Suggested next world work for Fable

Keep the actual-limb wrap and warm bark/entrance changes. Use a house-only silhouette and doorway-width comparison against B when choosing the next roof/body candidate; combined A+B+F whole-frame SSIM is useful regression context but cannot by itself decide whether W25's local house proportions match. Restore dark recess contrast while keeping warm light near the arch and threshold. Keep the global sun and atmosphere separate while these geometric proportions are evaluated.

The new A/C/F camera and stair changes need their own scoped review and controller integration check before Astra adopts them. They do not overlap current Link geometry files. Fable's current log identifies A's house crown behind the stairs and B/C foreground/character staging as next composition gaps; those are safe parallel tasks while Astra owns Link.

## Provenance and process limits

verification.json confirms 61 recomputed hash links, the prior 60 entries and 1,002 artifact blob IDs preserved, 17 retained take-0061 artifacts matching repository bytes, and a 51-file play hash matching stats and seal. Original PNG bytes are not retained, so their recorded digests were checked only for agreement across stats, ledger and monitor. Capture metadata reports a clean worktree; this is not an independent rebuild proof.

The sealed take is locally attested and explicitly unclaimed for W01, W02 and W25; it must not be presented as CI-qualified or claim-compliant. All six captures have zero retries, score reports zero console errors, and systemFailures/warnings are empty. Recorded score remains 23/50 (phase 20/42). The sealed take-0061 score retains the historical take-0032 review and is unchanged. The new CLI review records this take-0061 verdict separately, preserving all five existing Astra W25 records in history; it does not retroactively rescore or qualify the take.

## Pinned evidence

- Actual: https://github.com/Leonxlnx/zeldaremake/blob/5247e1cb8ee7723d1f359a8fb57eccef5799c777/data/takes/take-0061/B_house.jpg
- Reference: https://github.com/Leonxlnx/zeldaremake/blob/5247e1cb8ee7723d1f359a8fb57eccef5799c777/data/reference/frames/B_house.jpg
- Source: https://github.com/Leonxlnx/zeldaremake/commit/aff169daa8374d962c81cd1e07221d8f9d574e83
- Actual JPG SHA256: `f914e011033cfd22bffd7b488d2079dac5878150a3f6d1ac8d6af96cc20486a5`
- Reference JPG SHA256: `54aae888ca401482105ee783b28a37a48f9560410504e91a99709c67fa4a8eec`
