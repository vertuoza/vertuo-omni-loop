#!/usr/bin/env bash
# The settle gate of the `checks` workflow (PRD 598), cut down from vertuoza/vnext's
# scripts/settle-head.sh: no staging, no sweep.
#
# A ready pull request into main WAITS before its test and fallow jobs start. A push in that window
# cancels this run while it is still one idle runner (the workflow's concurrency group does that);
# a branch tip that moved past this run's sha anyway makes the run stale, and every job behind the
# gate skips. vnext measured the cost this saves: 599 of 1000 of its CI runs were cancelled by a
# later push, and a cancelled run cost more than a green one.
#
# Here the wait is 30 seconds, not vnext's 180. Agents mark a pull request ready once its work is done,
# so pushes rarely come in bursts: from 2026-09-30 to 10-07, 58 runs settled, none went stale and 4 were
# cancelled while waiting, so 180 seconds (4 billed minutes a run) cost about 217 minutes to save about
# 37. 30 seconds bills one minute and still absorbs a push straight after another.
#
# A pull request that changes only docs (every file a `.md` or under `docs/`) has nothing for the
# checks to grade: it answers stale=true at once, without waiting, so every job behind the gate skips.
# The workflow runs on every pull request into main, never filtered by path, so that a docs-only one
# still reports its checks, skipped, which a required check on main counts as passed.
#
# Reads SETTLE_SECONDS (default 30), GITHUB_HEAD_REF, SETTLE_HEAD_SHA (else GITHUB_SHA),
# GITHUB_REPOSITORY and SETTLE_PR (the pull request's number; unset, the docs-only test is not made);
# writes stale=<true|false> to $GITHUB_OUTPUT. Needs GH_TOKEN with contents: read and
# pull-requests: read. If gh cannot read the tip or the files, it says so on one stderr line and runs
# the checks: a settle that cannot look never skips them.
set -euo pipefail

wait_s="${SETTLE_SECONDS:-30}"
branch="${GITHUB_HEAD_REF:-${GITHUB_REF_NAME:?}}"
sha="${SETTLE_HEAD_SHA:-${GITHUB_SHA:?}}"
out="${GITHUB_OUTPUT:?}"

if [ -n "${SETTLE_PR:-}" ]; then
  if ! files="$(gh api "repos/${GITHUB_REPOSITORY:?}/pulls/${SETTLE_PR}/files" --paginate --jq '.[].filename' 2>&1)"; then
    echo "settle: could not read the files of #${SETTLE_PR} ($(echo "$files" | tr '\n' ' ' | sed 's/ *$//')), running the checks anyway" >&2
  elif [ -n "$files" ] && ! grep -vqE '(\.md$|^docs/)' <<< "$files"; then
    echo "::notice::settle: #${SETTLE_PR} changes only docs: nothing to check, skipping the checks behind the gate."
    echo "stale=true" >> "$out"
    exit 0
  fi
fi

echo "settle: waiting ${wait_s}s before spending runners on ${branch}@${sha:0:7}"
sleep "$wait_s"

if ! tip="$(gh api "repos/${GITHUB_REPOSITORY:?}/git/ref/heads/${branch}" --jq .object.sha 2>&1)"; then
  echo "settle: could not read the tip of ${branch} ($(echo "$tip" | tr '\n' ' ' | sed 's/ *$//')), running the checks anyway" >&2
  echo "stale=false" >> "$out"
  exit 0
fi

if [ "$tip" != "$sha" ]; then
  echo "::notice::settle: ${branch} moved to ${tip:0:7} while this run (${sha:0:7}) waited: stale, skipping the checks behind the gate; the newer push has its own run."
  echo "stale=true" >> "$out"
else
  echo "settle: ${branch} still at ${sha:0:7}, proceeding."
  echo "stale=false" >> "$out"
fi
