---
id: s2-01-runner-wire-shapes
prd: 1830
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The terminal side and the web side of runners were built at the same time, so the exact words they use to talk to each other were not settled anywhere. Which words should they share?

## The decision, in plain words

The terminal side uses the words of the spec's data section: a job comes with its number, its line, its repository and who sent it, and the terminal reports back a status, the log's end, the pull request link, the exit code and a reason.

## The intro, for fun

Two teams built the two ends of one bridge on the same afternoon.

## The punchline, for fun

They agreed on the river, and mostly on the bolts.

## The options, in plain words

A. A. Keep the spec's field names on both sides, and align the route's contract to them when the wave merges.
B. B. Rename the runner's fields to whatever the route's contract chose.
C. C. Share one contract module between the kit and the app.

## What I had to decide

The names and shapes of what the runner sends to, and reads from, the six runner routes, written before the routes existed.

## What I did meanwhile

kit/lib/runner/api.ts reads and writes the spec's field names: register sends {name, slots, repos, version} and reads {id}; next is GET /api/runners/next?runner=<id>, a 204 for none, else {id, line, repo, sent_by}; a job update POSTs {status, log_tail, pr_url, exit_code, reason} to /api/runners/jobs/<id> and reads {cancel}. The runner reports running every 5 s and its last status once.

## What it costs to change later

A field renamed on either side is a one-line change in the runner's schema or the route's contract, plus its test, before the feature merges.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s1's contract was not pushed when this slice was built, so the two sides were not compared; the wave's merge should check them together.
- (author) A runner whose every slot is busy keeps no next call open; unless the job updates also count as a check-in on the server, it would read as offline and its jobs as lost after 90 s.
