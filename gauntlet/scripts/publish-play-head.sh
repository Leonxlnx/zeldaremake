#!/bin/bash
# publish-play-head.sh — build the checked-out head and publish it as the walkable build the owner
# plays: https://raw.githack.com/Leonxlnx/zeldaremake/play-head/index.html
#
#   gauntlet/scripts/publish-play-head.sh [worktree dir (default /tmp/play-head-wt)]
#
# The build goes to an orphan branch `play-head` (one commit per publish, the build only), through
# a separate worktree so the working branch is never left. The textures and models are the repo's
# own blobs, so a publish pushes little more than the new bundle. monitor/play/ is untouched (it
# moves only when a gauntlet take seals).
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
wt=${1:-/tmp/play-head-wt}
cd "$repo"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "publish-play-head: the working tree has uncommitted changes — commit first so the build matches a SHA" >&2
  exit 1
fi
sha=$(git rev-parse --short HEAD)
branch=$(git rev-parse --abbrev-ref HEAD)
out=$(mktemp -d /tmp/play-head-dist.XXXXXX)
npx tsc --noEmit
npx vite build --outDir "$out" --emptyOutDir >/dev/null
echo "$sha" > "$out/BASELINE_SHA"
git fetch -q origin play-head || true
if [ ! -d "$wt/.git" ] && [ ! -f "$wt/.git" ]; then
  rm -rf "$wt"
  if git show-ref -q --verify refs/remotes/origin/play-head; then
    git worktree add -q -B play-head "$wt" origin/play-head
  else
    git worktree add -q --orphan -b play-head "$wt"
  fi
fi
cd "$wt"
# GitHub's raw cache can serve the previous index.html for a few minutes after a publish; it must
# still find its bundle, so the last KEEP bundles stay (bundles.txt, newest last) and older go
KEEP=6
cp -r "$out/." .
for b in "$out"/assets/index-*.js; do echo "assets/$(basename "$b")" >> bundles.txt; done
awk '!seen[$0]++' bundles.txt | tail -n "$KEEP" > bundles.keep && mv bundles.keep bundles.txt
for f in assets/index-*.js; do
  grep -qx "$f" bundles.txt || git rm -q --ignore-unmatch "$f" >/dev/null 2>&1 || rm -f "$f"
done
printf 'Walkable build of %s @ %s, published by gauntlet/scripts/publish-play-head.sh.\nOpen: https://raw.githack.com/Leonxlnx/zeldaremake/play-head/index.html\n' "$branch" "$sha" > README.txt
git add -A
if git diff --cached --quiet; then
  echo "publish-play-head: play-head already holds $sha"
else
  git commit -q -m "play build of $sha ($branch)"
  git push -q origin HEAD:play-head
  echo "publish-play-head: published $sha → https://raw.githack.com/Leonxlnx/zeldaremake/play-head/index.html"
fi
rm -rf "$out"
