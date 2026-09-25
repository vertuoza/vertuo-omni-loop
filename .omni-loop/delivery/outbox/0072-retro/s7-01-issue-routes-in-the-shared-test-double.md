---
id: s7-01-issue-routes-in-the-shared-test-double
prd: 72
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Opening retro issues for real made two tests owned by other parts of this work fail, because the stand-in for GitHub they share knew nothing of issues. Should those two files change here?

## The decision, in plain words

The stand-in for GitHub now answers the requests for issues, and one test of the retro as a whole now expects the one issue its example earns. Nothing else in either file changed.

## The intro, for fun

The stand-in for GitHub had a drawer marked issues, but no handle to open it.

## The punchline, for fun

It has a handle now, and the drawer finally holds something.

## The options, in plain words

A. Extend the shared stand-in for GitHub with the three issue requests, and update the one count in the retro's own test, the option built.
B. Keep the issue requests in a stand-in of this slice's own, and point the retro's own test at it, so the shared stand-in is never touched.
C. Open no issue when GitHub cannot list issues, so the shared stand-in stays as it was, at the price of hiding a real failure.

## What I had to decide

Whether to edit `apps/omni-app/test/github-replay.mjs` (s2's ground, `apps/omni-app/test/`) and `apps/omni-app/src/retro/retro.test.mjs` (the function file's prefix, `apps/omni-app/src/retro/retro.`, s8's in wave 4), both outside s7's territory `apps/omni-app/src/retro/issues`. The double kept `state.issues` and could label an issue, but answered no issue route, so any finding made the `publish-issues` step fail with a 404; and `retro.test.mjs` asserted `issues: 0` for the widget scenario, whose slow slice now gets its issue.

## What I did meanwhile

The double answers `GET /repos/{owner}/{repo}/issues` (by label and state, pull requests included and marked `pull_request`, as GitHub lists them), `POST /repos/{owner}/{repo}/issues` and `PATCH /repos/{owner}/{repo}/issues/{issue_number}`, sharing its number counter with pull requests. `retro.test.mjs` expects `issues: 1` instead of `0`. Its other tests and the PRD 50 recording test pass unchanged.

## What it costs to change later

A constant: twenty lines of test support and one number in one test. Keeping the issue routes in a wrapper under `issues.fixtures/` instead would still change `retro.test.mjs`, since it builds its double through `widgetScenario`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the shared double to be extended by whichever wave-3 slice first needs a route, or to stay s2's alone; s3 to s5 may add routes to the same file, and the wave merges their additions.
