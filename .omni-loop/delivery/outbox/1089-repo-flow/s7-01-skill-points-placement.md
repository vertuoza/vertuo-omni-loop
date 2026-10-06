---
id: s7-01-skill-points-placement
prd: 1089
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 6
---

## The question, in plain words

Where exactly do the loop's steps let a repository add its own instructions, which steps can never be swapped out, and what happens to a slice the merge check refuses?

## The decision, in plain words

The test point wraps the slice's own test runs while the full check before shipping always runs; a replacement way of opening pull requests applies to the main pull requests only, as the older setting did; and a slice the merge check refuses stays open, unlabelled, and is tried again on the next run.

## The intro, for fun

A repository asked to rewrite the rulebook, and the loop handed it a pencil with the safety page in ink.

## The punchline, for fun

It may add pages anywhere, but the safety chapter stays as it is.

## The options, in plain words

A. Keep it: the test point wraps the slice's test runs, the preflight and the merge gate are guards, a replace opener skips sub-PRs, and a refused merge waits unlabelled for the next run.
B. Let the test point replace the preflight too, so a repository can run only the slice's tests before shipping.
C. Let a replace opener open sub-PRs as well, and mark a refused merge stuck with the needs-fix label.

## What I had to decide

Whether the test point should also be able to replace the full check that runs before a slice ships, whether a replacement opener should open the small slice pull requests too, and whether a refused merge should wait quietly or be marked as stuck.

## What I did meanwhile

Wired every skill the catalog lists: do-work's test point wraps the test runs of its build step and its preflight stays a guard; pr.open's replace opens feature and standalone PRs only, the sub-PR claim keeps gh pr create with only before and after hooks, as pr.openWith did; wave merges only with the command omni flow check merge prints, and a not ok sub-PR is left open with no label, so the next run takes it as awaiting merge; plan.slice runs once per drafted row and plan.done after the PR opens.

## What it costs to change later

Small: a few sentences in kit/plugin/skills/do-work, pr and wave, and the regexes in kit/test/flow-points.test.ts; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's guard list does not name the preflight; it is kept a guard here so a replace hook cannot skip the check every sub-PR is graded by.
- (author) The spec does not say whether pr.open's replace opens a sub-PR; it does not here, so pr.openWith and pr.open.replace keep giving the same result (acceptance 10).
- (author) /omni:yolo-fix still finds the feature PR with --base and merges its rework sub-PRs with gh pr merge --squash: it is outside this slice's territory (settled item s2-01).
- (author) An input the CLI cannot fill without --prd and --slice ({prd}, {plan}, {pr}) is filled by the agent from the step, as each point's paragraph says.
