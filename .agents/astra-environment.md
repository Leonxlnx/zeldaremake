# Astra — environment priority

Agent: Astra, Codex / ChatGPT Work. Root is implementing environment lighting and art direction.
Branch: `agent/astra-environment-lighting`, based deliberately on Fable `e17f310`.

## Current task

Owner explicitly paused character/model work and requests full environment, light, shadows and
detail. Publish the ten exact owner references, then capture controlled light/color variants
before adopting production settings. Character attempts remain parked in the separate character
worktree; relaxed-hand thumb crossings and unverified garment fit are not released.

## Files / systems

`reference/owner-concepts/`, `src/world/lighting/`, `src/world/postfx/`, initially read-only
`src/world/atmosphere/`. A separate helper is preparing environment-only capture/publication files.
No Astra geometry rewrite. Upstream e17f310 is deliberately applied byte-for-byte: Fable south bank, terrain material blend, vegetation hedge and KID placement. Astra does not edit their geometry beyond that integration.

## Coordination

Fable explicitly agreed in PR2 comment5644519204: Astra owns lighting/postfx/atmosphere and related config; Fable retains environment geometry, with structures and vegetation editors active. Hardscape proposal is held until both agents review all ten owner boards.
PR2 comment5644445067 announces this before edits. Fresh source and claims inspected; latest
published Fable head remains501b350, all their published lighting claims are expired. This does
not establish whether their external process is currently running. Reply received at07:40 UTC; no Fable lighting/postfx editor is active. Stop overlapping work if a new active file/branch is identified. Never overwrite Fable's branch,
merge their PR, rewrite their logs or change the locked rubric/history. This independent branch
uses their newer world as its starting point; it does not replace the character branch.

## Decisions

Owner's latest request explicitly authorizes reference publication, superseding the earlier
private-reference restriction. Original images stay byte-exact and comparison-only. The newer
concepts guide the desired warm/cool and form contrast; maintain the footage rubric honestly,
without treating a score or guessed parameter as visual acceptance. No schedules.

## Completed

Ten unique original PNGs recovered (duplicate reuploads have identical SHA256). Root personally
reviewed all ten. Source baseline and latest Fable comments/claims read. W30/W31/W32/W34/W35/W36
claimed through the unchanged CLI. Reference checkpoint195371c passes typecheck/build; The first5 MB base64 GitData blob upload hung and returned no object (expected blob404); no approval rejection. Exact reference publication is decoupled to a temporary transport branch and verified CI reconstruction. The final reference-only branch will be deliberately integrated once available; source/capture work continues now.

## Known issues

World still reads olive/beige and flat against the concepts. Current generous fill and grade,
close haze and distant uniform veil need controlled actual-render review. First six-view comparison is prepared: baseline Fable controls versus golden key3.6, hemi0.60, IBL0.30, cool fill, less green warming and no video softness. It is an unaccepted hypothesis. No new environment appearance claim yet. Local preview access was rejected earlier; use real CI game renders.

## Current checkpoint

This source branch is a direct descendant of Fable e17f310, with no local edits to its geometry files. Twelve matched environment renders
are prepared by new isolated capture/publication scripts and a push-triggered workflow. Actual
light-object values and last-render composer settings are audited; source/time/camera/depth are
retained. Publisher concurrency/history and input validation checks pass. Combined typecheck and
build pass (103 modules). Capture results are still pending; no production lighting defaults or
fog changes have been adopted.

Root has a held atmosphere study: thinner close/middle air, postponed far extinction and cool
ambient air against golden key/shafts. It stays in ignored scratch until the first light-only
comparison is rendered. Numerical optical depth is not visual acceptance. Geometry stays Fable's.

## Suggested parallel work

Fable: house/arch/canopy and terrain/vegetation geometry, with original-source captures. Astra's
capture helper: named actual environment comparisons with source/audit/history preservation.

## Last updated
2026-09-12T07:46:34.630991+00:00
