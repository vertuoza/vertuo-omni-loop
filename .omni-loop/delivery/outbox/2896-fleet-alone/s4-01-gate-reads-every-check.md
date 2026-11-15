---
id: s4-01-gate-reads-every-check
prd: 2896
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The merge gate needs every required check green, but a mission branch has no list of required checks. Which checks count, and what about one that was skipped?

## The decision, in plain words

Every check on the pull request's latest commit counts. A check that was skipped, cancelled or ended without a verdict holds the merge as not judged, so a pull request whose checks were all skipped waits for a person instead of joining.

## The intro, for fun

A guard with no list of names checks everybody at the door.

## The punchline, for fun

Better a guest kept waiting than a stranger let in.

## The options, in plain words

A. A. Every check on the head counts, and a skipped one holds the merge (built).
B. B. Every check counts, but a skipped one passes, as main's required checks treat it.
C. C. Only a list of required checks named in the repository's config counts.

## What I had to decide

Keep every check on the head as the gate's list, skipped ones held as not judged, or name a list of required checks for mission branches.

## What I did meanwhile

The gate reads every check run and commit status on the head, judges each name by its latest run that decided, and holds the merge on any red, unfinished or undecided one.

## What it costs to change later

Reading a named list instead costs one setting and one filter in the gate; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every required check, and the repository protects no mission branch, so there is no required list to read.
- (author) A pull request that changes only docs has its checks skipped on purpose; at with-you main lets it merge, while here it waits for a person.
- (author) The gate trusts any review that carries the Reviewer's marker; it cannot tell the Reviewer's account from a person's, since runners post with the account they run as.
