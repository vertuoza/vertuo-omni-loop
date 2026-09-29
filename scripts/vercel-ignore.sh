#!/usr/bin/env bash
# The Vercel ignore step of both projects here (PRD 675): a phase-0 pull request carries only a PRD's
# spec, plan and before/after page, which cannot change either app, so its branch builds no preview.
#
# Run from the repository root (each vercel.json's `ignoreCommand` does `cd ../..` first). Reads
# VERCEL_GIT_COMMIT_REF and this checkout's `branches.phase0` from `omni config`. Vercel's contract:
# exit 0 skips the build, exit 1 builds. Whenever it is unsure (no branch name, a config it cannot
# read, a shape without `{topic}`) it builds.
#
# The ignore step runs before any install, and `.omni-loop/bin/omni.mjs` here is a shim onto the kit
# source, which needs node_modules; the self-contained bundle `kit/dist/omni.mjs` is the fallback.
set -uo pipefail

build() {
  echo "vercel-ignore: $1, building"
  exit 1
}

branch="${VERCEL_GIT_COMMIT_REF:-}"
[ -n "$branch" ] || build "no branch name"

shape=""
for omni in .omni-loop/bin/omni.mjs kit/dist/omni.mjs; do
  [ -f "$omni" ] || continue
  if shape="$(node "$omni" config branches.phase0 2>/dev/null)" && [ -n "$shape" ]; then break; fi
  shape=""
done
[ -n "$shape" ] || build "could not read branches.phase0"

case "$shape" in
  *'{topic}'*) ;;
  *) build "branches.phase0 ($shape) has no {topic}" ;;
esac
prefix="${shape%%\{topic\}*}"
suffix="${shape#*\{topic\}}"

if [[ "$branch" == "$prefix"* && "$branch" == *"$suffix" ]] && (( ${#branch} > ${#prefix} + ${#suffix} )); then
  echo "vercel-ignore: $branch is a phase-0 branch ($shape), skipping the build"
  exit 0
fi
build "$branch is not a phase-0 branch ($shape)"
