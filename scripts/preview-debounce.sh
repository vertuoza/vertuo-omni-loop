#!/usr/bin/env bash
# The preview gate of the `preview-debounce` workflow (PRD 1646): a ready pull request into main gets
# one Vercel preview per project its changes can reach, once its pushes settle. Vercel's own Git
# deployments of a branch are all skipped by scripts/vercel-ignore.sh, unless the commit carries the
# check run vercel/preview/<project> this script adds.
#
# 1. Stops (exit 0, one line why) on a draft, a base other than main, or a dependabot/ head.
# 2. Waits PREVIEW_DEBOUNCE_SECONDS (default 150): a newer push cancels this run while it waits (the
#    workflow's concurrency group), so a burst of agent pushes builds once.
# 3. Stops when the head moved or the pull request turned draft meanwhile: the newer push has its run.
# 4. For each project scripts/vercel-inputs.ts says the pull request's files reach (as a branch, so
#    .omni-loop/ never counts), adds the check run vercel/preview/<project> = success to the head
#    commit (which scripts/vercel-ignore.sh reads as the omni-loop App), then asks
#    Vercel for a deployment of that commit from Git (POST /v13/deployments with gitSource): Vercel
#    clones and builds it on its own machines, as for a push. Nothing is built here.
# 5. A GitHub or Vercel call that fails exits 1, so the run is red on the pull request.
#
# Reads GITHUB_REPOSITORY, DEBOUNCE_PR, GH_TOKEN (checks: write, pull-requests: read), VERCEL_TOKEN,
# VERCEL_TEAM_ID, VERCEL_PROJECT_ID_GALAXY, VERCEL_PROJECT_ID_OMNI_APP, VERCEL_GITHUB_REPO_ID,
# PREVIEW_DEBOUNCE_SECONDS and VERCEL_API (default https://api.vercel.com). Needs gh, curl and node.
set -uo pipefail

repo="${GITHUB_REPOSITORY:?}"
pr="${DEBOUNCE_PR:?}"
base_branch="${PREVIEW_BASE_BRANCH:-main}"

fail() {
  echo "::error::preview-debounce: $1"
  exit 1
}

stop() {
  echo "preview-debounce: #$pr: $1, no preview"
  exit 0
}

# Prints `<draft> <base> <head ref> <head sha>` of the pull request.
read_pr() {
  gh api "repos/$repo/pulls/$pr" --jq '"\(.draft) \(.base.ref) \(.head.ref) \(.head.sha)"'
}

state="$(read_pr)" || fail "could not read #$pr"
read -r draft base ref sha <<<"$state"
[ "$draft" = "false" ] || stop "a draft"
[ "$base" = "$base_branch" ] || stop "its base is $base, not $base_branch"
case "$ref" in dependabot/*) stop "a dependabot branch" ;; esac

wait_s="${PREVIEW_DEBOUNCE_SECONDS:-150}"
echo "preview-debounce: #$pr: waiting ${wait_s}s for $ref@${sha:0:7} to settle"
sleep "$wait_s"

state="$(read_pr)" || fail "could not read #$pr again"
read -r draft _ _ now <<<"$state"
[ "$now" = "$sha" ] || stop "$ref moved to ${now:0:7} while ${sha:0:7} waited; the newer push has its own run"
[ "$draft" = "false" ] || stop "turned draft while it waited"

files="$(gh api "repos/$repo/pulls/$pr/files" --paginate --jq '.[].filename')" || fail "could not read the files of #$pr"
pkg_diff="$(mktemp)"
gh api "repos/$repo/pulls/$pr/files" --paginate --jq '.[] | select(.filename == "package.json") | .patch // ""' >"$pkg_diff" \
  || fail "could not read the package.json change of #$pr"

project_id() {
  case "$1" in
    galaxy) echo "${VERCEL_PROJECT_ID_GALAXY:-}" ;;
    omni-app) echo "${VERCEL_PROJECT_ID_OMNI_APP:-}" ;;
  esac
}

deployed=0
for project in galaxy omni-app; do
  answer="$(printf '%s\n' "$files" | node scripts/vercel-inputs.ts "$project" branch --package-json-diff "$pkg_diff")"
  case $? in
    0) ;;
    1) echo "preview-debounce: #$pr: $project: nothing it deploys changed"; continue ;;
    *) fail "vercel-inputs failed for $project: ${answer:-no answer}" ;;
  esac
  id="$(project_id "$project")"
  [ -n "${VERCEL_TOKEN:-}" ] && [ -n "$id" ] && [ -n "${VERCEL_GITHUB_REPO_ID:-}" ] \
    || fail "$project needs a preview but VERCEL_TOKEN, its project id or VERCEL_GITHUB_REPO_ID is not set (PRD 1646, Dashboard steps)"

  gh api -X POST "repos/$repo/check-runs" -f "name=vercel/preview/$project" -f "head_sha=$sha" \
    -f status=completed -f conclusion=success -f "output[title]=Settled: Vercel may build this preview" \
    -f "output[summary]=No push for ${wait_s}s since this commit." >/dev/null \
    || fail "could not add vercel/preview/$project to ${sha:0:7}"

  body="$(printf '{"name":"%s","project":"%s","gitSource":{"type":"github","repoId":"%s","ref":"%s","sha":"%s"}}' \
    "$project" "$id" "$VERCEL_GITHUB_REPO_ID" "$ref" "$sha")"
  team="${VERCEL_TEAM_ID:+?teamId=$VERCEL_TEAM_ID}"
  url="$(curl -sf --max-time 30 -X POST "${VERCEL_API:-https://api.vercel.com}/v13/deployments$team" \
    -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" -d "$body" \
    | node -e 'let t="";process.stdin.on("data",(d)=>{t+=d;});process.stdin.on("end",()=>{try{console.log(JSON.parse(t).url??"")}catch{}});')" \
    || fail "Vercel refused the $project deployment of ${sha:0:7}"
  echo "preview-debounce: #$pr: $project: ${answer#vercel-inputs: } → deploying ${sha:0:7}${url:+ at https://$url}"
  deployed=$((deployed + 1))
done
rm -f "$pkg_diff"

[ "$deployed" -gt 0 ] || stop "its changes reach neither project"
