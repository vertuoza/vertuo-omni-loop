---
id: s7-04-not-finished-shows-in-progress
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

When the verdict is not finished, how should the App's ready check look on the pull request, knowing it must never look green?

## The decision, in plain words

While evidence is still coming it shows as in progress and is updated in place; when nothing more will come and a check could not be judged, it shows as neutral. Ready is green, not ready is red.

## The intro, for fun

A kettle that is not boiling yet is neither hot nor cold.

## The punchline, for fun

So we gave it a little yellow light instead of a thumbs-up.

## The options, in plain words

A. A. In progress while evidence comes, neutral when only not judged, green and red otherwise: what was built.
B. B. The same, but not judged shows red, so a required check holds the pull request.
C. C. Every not finished verdict shows neutral, never in progress.

## What I had to decide

`runState` in `apps/omni-app/src/ready-check/output.ts`: `ready` completed `success`, `not ready` completed `failure`, `not finished` with any check `not finished` as `in_progress`, else completed `neutral`. GitHub reads `neutral` as passing for a required check, so a repository that made `omni / ready` required would let a not judged verdict through; the kit's own gate is `omni ready`, which leaves this check out. The sweep's delayed post (`apps/omni-app/src/jobs/delayed.ts`) does not cover `pr-ready`: it would post on pull requests whose gate is off.

## What I did meanwhile

Built as above, with tests of each state and of a run in progress completed in place.

## What it costs to change later

A table of four rows in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person would rather see not judged as red, so a required check holds it
