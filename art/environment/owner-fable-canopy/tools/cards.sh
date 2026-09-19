#!/usr/bin/env bash
# Decision-card renders (owner-fable): the same world with one SSIM-compensation dial released,
# rendered natively — six views + the poses where the defect is seen. Runs in the scratch
# worktree E:/zeldaremake-wt-cards (detached at my branch head); nothing here is committed.
set -euo pipefail
WT=E:/zeldaremake-wt-cards
POSES=E:/zeldaremake-my-fable/art/environment/owner-fable-canopy/tools/owner-fable-poses.json
cd "$WT"
export ZR_NATIVE_GPU=1

run() { # name
  local name=$1
  npm run build 2>&1 | tail -1
  node gauntlet/scripts/capture.mjs --out "gauntlet/out/card-$name" --settle 90 2>&1 | tail -2
  node gauntlet/scripts/broll.mjs --dist dist --out "gauntlet/tmp/card-$name-poses" --size 1280x720 --fps 12 --shots "$POSES" --test --settle 12 2>&1 | tail -1
  node gauntlet/scripts/compare.mjs --in "gauntlet/out/card-$name" 2>&1 | grep -E "A_stairs|B_house|C_lookback|D_log|E_ground|F_canopy" | grep ssim
}

# card A — the hero-framed flat lobes swap to their layered near version at 14 / 17 m
git checkout -- src
sed -i "s|export const NEAR_CANOPY_FLAT_SWAP_M: \[number, number\] \| null = null;|export const NEAR_CANOPY_FLAT_SWAP_M: [number, number] \| null = [14, 17];|" src/world/trees/nearCanopy.ts
grep -n "NEAR_CANOPY_FLAT_SWAP_M: \[number, number\] | null = " src/world/trees/nearCanopy.ts
run flatlobes

# card B — the shade floors keep their NEAR presets (more of the bark's / leaves' own texture) at every distance
git checkout -- src
sed -i "s|export const TREE_FLOOR_FADE_M: \[number, number\] = \[5, 10\];|export const TREE_FLOOR_FADE_M: [number, number] = [80, 120];|" src/world/trees/materials.ts
sed -i "s|export const COLUMN_FLOOR_FADE_M: \[number, number\] = \[20, 32\];|export const COLUMN_FLOOR_FADE_M: [number, number] = [80, 120];|" src/world/trees/materials.ts
grep -n "FLOOR_FADE_M: \[number, number\] = " src/world/trees/materials.ts
run shadefloors

git checkout -- src
echo "cards done"
