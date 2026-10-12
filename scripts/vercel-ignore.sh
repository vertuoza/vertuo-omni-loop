#!/usr/bin/env bash
# The Vercel ignore step of both projects here (PRD 1646, after PRD 675): each project builds only
# when a change can reach what it deploys. `bash scripts/vercel-ignore.sh <galaxy|omni-app>`, run from
# the repository root (each vercel.json's `ignoreCommand` does `cd ../..` first). Vercel's contract:
# exit 0 skips the build, exit 1 builds. It prints one `vercel-ignore: <project>: <reason>` line.
#
# In order:
# 1. VERCEL_FORCE_BUILD=1 on the project builds everything: the switch that stops skipping at once.
# 2. On main (VERCEL_IGNORE_PRODUCTION_BRANCH, default main):
#    - a commit carrying the check run vercel/production-fallback = success builds: the release
#      workflow failed and called the project's Deploy Hook (.github/workflows/release-fallback.yml);
#    - a commit whose message does not start `chore(release): ` is a merge, skipped: the release
#      commit the release workflow pushes a minute later carries it;
#    - a release commit builds when scripts/vercel-inputs.ts says the diff since the project's last
#      production deploy (VERCEL_GIT_PREVIOUS_SHA) can change it. Whenever it is unsure (no previous
#      SHA, one the shallow clone lacks after one deepen, a diff that fails) it builds.
# 3. On any other branch it builds only a commit carrying the check run vercel/preview/<project> =
#    success, which .github/workflows/preview-debounce.yml adds on a ready pull request into main
#    once its pushes settle. No App credentials, no answer from GitHub, or no such check: it skips.
#
# GitHub is read as the omni-loop GitHub App, whose GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY both
# projects already hold (scripts/vercel-github-token.ts), at VERCEL_IGNORE_GITHUB_API (default
# https://api.github.com), with a 5-second limit per call. The step runs before any install: bash,
# git, curl and node only.
set -uo pipefail

project="${1:-}"

build() {
  echo "vercel-ignore: ${project:-?}: $1, building"
  exit 1
}

skip() {
  echo "vercel-ignore: ${project:-?}: $1, skipping"
  exit 0
}

case "$project" in
  galaxy | omni-app) ;;
  *) build "no project named (galaxy or omni-app)" ;;
esac

[ "${VERCEL_FORCE_BUILD:-}" = "1" ] && build "VERCEL_FORCE_BUILD=1"

branch="${VERCEL_GIT_COMMIT_REF:-}"
[ -n "$branch" ] || build "no branch name"
sha="${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null)}"
[ -n "$sha" ] || build "no commit SHA"

# The omni-loop GitHub App's installation token, minted once from GITHUB_APP_ID and
# GITHUB_APP_PRIVATE_KEY (scripts/vercel-github-token.ts); empty when it cannot be had.
token=""
token_tried=""
github_token() {
  if [ -z "$token_tried" ]; then
    token_tried=1
    local owner="${VERCEL_GIT_REPO_OWNER:-}" repo="${VERCEL_GIT_REPO_SLUG:-}"
    if [ -n "$owner" ] && [ -n "$repo" ] && [ -n "${GITHUB_APP_ID:-}" ] && [ -n "${GITHUB_APP_PRIVATE_KEY:-}" ]; then
      token="$(printf '%s\n%s/%s\n%s\n%s\n' "$GITHUB_APP_ID" "$owner" "$repo" "$api" "$GITHUB_APP_PRIVATE_KEY" \
        | node scripts/vercel-github-token.ts 2>/dev/null)" || token=""
    fi
  fi
  printf '%s' "$token"
}

# Prints `yes` when the commit carries a check run <name> concluded success, `no` when it does not,
# and nothing when GitHub cannot be asked.
check_of() {
  local name="$1" owner="${VERCEL_GIT_REPO_OWNER:-}" repo="${VERCEL_GIT_REPO_SLUG:-}" auth
  auth="$(github_token)"
  [ -n "$auth" ] || return 0
  curl -sf --max-time 5 -G \
    -H "Authorization: Bearer $auth" -H "Accept: application/vnd.github+json" \
    --data-urlencode "check_name=$name" \
    "$api/repos/$owner/$repo/commits/$sha/check-runs" 2>/dev/null \
    | node -e '
        let text = "";
        process.stdin.on("data", (d) => { text += d; });
        process.stdin.on("end", () => {
          try {
            const runs = JSON.parse(text).check_runs ?? [];
            const hit = runs.some((r) => r.name === process.argv[1] && r.conclusion === "success");
            console.log(hit ? "yes" : "no");
          } catch {}
        });
      ' "$name"
}

api="${VERCEL_IGNORE_GITHUB_API:-https://api.github.com}"

if [ "$branch" != "${VERCEL_IGNORE_PRODUCTION_BRANCH:-main}" ]; then
  [ -n "${GITHUB_APP_ID:-}" ] && [ -n "${GITHUB_APP_PRIVATE_KEY:-}" ] \
    || skip "$branch: no GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY to read its preview check"
  case "$(check_of "vercel/preview/$project")" in
    yes) build "$branch: vercel/preview/$project passed on ${sha:0:7}" ;;
    no) skip "$branch: no vercel/preview/$project on ${sha:0:7} (only a ready pull request into main previews)" ;;
    *) skip "$branch: could not read its checks from GitHub" ;;
  esac
fi

[ "$(check_of vercel/production-fallback)" = "yes" ] && build "the release-fallback workflow deploys ${sha:0:7}"

message="${VERCEL_GIT_COMMIT_MESSAGE-}"
if [ -z "${VERCEL_GIT_COMMIT_MESSAGE+set}" ]; then
  message="$(git log -1 --format=%s "$sha" 2>/dev/null)" || build "cannot read the commit message"
fi
[ -n "$message" ] || build "an empty commit message"
case "$message" in
  'chore(release): '*) ;;
  *) skip "${sha:0:7} is a merge; the release commit that follows carries it" ;;
esac

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$previous" ] || build "no previous production deploy to compare with"
if ! git cat-file -e "$previous^{commit}" 2>/dev/null; then
  git fetch -q --deepen=200 2>/dev/null
  git cat-file -e "$previous^{commit}" 2>/dev/null || build "${previous:0:7} is not in the clone"
fi

paths="$(git diff --name-only "$previous" "$sha" 2>/dev/null)" || build "cannot diff ${previous:0:7}..${sha:0:7}"
pkg_diff="$(mktemp)"
git diff "$previous" "$sha" -- package.json >"$pkg_diff" 2>/dev/null || build "cannot diff package.json"
answer="$(printf '%s\n' "$paths" | node scripts/vercel-inputs.ts "$project" main --package-json-diff "$pkg_diff")"
code=$?
rm -f "$pkg_diff"
case "$code" in
  0) build "release ${sha:0:7}: ${answer#vercel-inputs: }" ;;
  1) skip "release ${sha:0:7}: nothing since ${previous:0:7} reaches $project" ;;
  *) build "release ${sha:0:7}: vercel-inputs failed (${answer:-no answer})" ;;
esac
