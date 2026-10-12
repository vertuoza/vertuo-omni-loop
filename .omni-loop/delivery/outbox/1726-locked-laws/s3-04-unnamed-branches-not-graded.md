---
id: s3-04-unnamed-branches-not-graded
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Should the lock on a law also hold a pull request whose branch the loop does not recognise, which today gets no outbox check at all?

## The decision, in plain words

Not in this slice: the lock holds every pull request the check already grades (features, fixes, knowledge and test pull requests), and a pull request on an unrecognised branch still gets a skipped check.

## The intro, for fun

The guard checks every door with a name on it.

## The punchline, for fun

The side door with no name is still a side door.

## The options, in plain words

A. Lock every pull request the check grades; others stay skipped (built).
B. Also grade any pull request into the default branch for locked laws, red when one is changed without approval.

## What I had to decide

Whether law-locked runs on pull requests into the default branch the check skips today: a branch matching no branches.* shape, a feature branch with no PRD folder, and a target or product feature PR whose check defers elsewhere.

## What I did meanwhile

withLawGate runs after evaluate in evaluateAt (apps/omni-app/src/outbox-check/outbox-check.ts), reached only by a gated pull request: feature, fix, knowledge and enforce PRs. checkTarget still posts a skipped check on any other pull request, before any knowledge is read (issue 876 keeps those from ever going red).

## What it costs to change later

Grading a skipped pull request for locked laws means reading the base's knowledge in the in-progress step and turning a skipped check red there; issue 876's never-red promise would be amended.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'every kind, knowledge and enforce PRs included'; it does not name branches the loop does not know.
- (author) Until it is closed, renaming a branch out of the loop's shapes skips the lock; branch protection requiring a CODEOWNER review closes it on GitHub's side.
