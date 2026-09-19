# opus-verify — round-47 intake verification (2026-09-19)

Independent re-run of five lanes' own acceptance, from a clean clone, on the owner's Windows
laptop (native D3D11, Radeon 780M). Every frame here is my own render of source I built myself.
No lane's shipped JPEG was used as evidence for that lane.

## Method

Clean clone at `E:\zeldaremake-opus-verify`; detached build worktree so each head is built in
isolation. Per PR:

```
npm ci
npm run typecheck && npm run build
node --test <the PR's own src/world/**/*.test.mjs>
node --test src/world/*/*.test.mjs          # whole sweep, for regressions
npm run anticheat                            # source-only (86 checks)
ZR_NATIVE_GPU=1 node gauntlet/scripts/capture.mjs --out gauntlet/out/<pr> --settle 90
node gauntlet/scripts/compare.mjs --in gauntlet/out/<pr>
cp -r gauntlet/out/<pr> gauntlet/out/last && npm run anticheat   # full 93 checks
ZR_NATIVE_GPU=1 node gauntlet/scripts/broll.mjs --dist dist --out <dir> \
  --size 1280x720 --fps 12 --shots <the PR's own poses> --test --settle 12
```

BEFORE is always built by me from that PR's own merge-base with the identical command line, so
the pair differs only by the lane's code.

## Reading the numbers

These are **native D3D11**, not SwiftShader. They are not comparable to the SSIM figures in the
PR bodies, which were taken on the cloud VM. Each PR is compared against a baseline I captured
on this GPU at that PR's own merge-base.

**Measured renderer noise floor:** PR #17's first head (`7dfab7ca`) builds a `dist/` whose
`distHash` is byte-identical to its base `50aac29e`, and its six views still differ by up to
1/255 on a few subpixels. A per-view maximum channel delta of 1 is noise. Anything above it is
real.

My baseline at `d06e2753` reproduces owner-fable's published native baseline at `50aac29e`
exactly (A 0.2206 / B 0.2064 / C 0.2416 / D 0.2768 / E 0.2113 / F 0.2701), which is the
cross-check that this machine's captures are comparable with theirs.

## Files

- `measurements.txt` — every six-view table, per-view pixel diff and pose diff, raw.
- `pairs/*.jpg` — BEFORE | AFTER crops at the poses each lane claimed. Left is before.

## Caveat on the tooling

`broll.mjs` takes no extra query parameters, so PR #12's `?rockLedgePreview=1` poses are not
reachable through it. The ledge was verified instead by merging #12 onto the live base head,
where `layout.rockLedges` exists and the ledge builds for real.

The capture browser died with "Navigating frame was detached" on 4 of 22 launches on this
machine and succeeded on immediate retry with identical results.
