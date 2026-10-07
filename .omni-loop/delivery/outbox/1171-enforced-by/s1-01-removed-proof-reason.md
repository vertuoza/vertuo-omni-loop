---
id: s1-01-removed-proof-reason
prd: 1171
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When the harvest refuses a proposed test because the change deleted it, how should it explain that?

## The decision, in plain words

It says the change removed that file, a third reason beside the two the design named, so a person sees exactly why the link was dropped.

## The intro, for fun

A test that was deleted cannot prove anything, however hard the model points at it.

## The punchline, for fun

So the harvest says so plainly: that one left with the change.

## The options, in plain words

A. A. Report a removed path with its own reason, "removed by #<pr>", and pass the status into the library so the app and the command share the rule.
B. B. Report a removed path as "no longer in the tree", keeping exactly the two reasons the spec names.
C. C. Have each caller drop removed paths before the library sees them, so a removed path reads as "not changed by #<pr>".

## What I had to decide

The spec names two reasons for dropping a proposed proof (not changed by the pull request, no longer in the tree) and says the callers keep only added, modified or renamed paths. It does not say whether a path the pull request removed is reported as one of those two or on its own.

## What I did meanwhile

The changed files reach the library with GitHub's status, removals included. A removed path is dropped with the reason "removed by #<pr>", a path the pull request did not change with "not changed by #<pr>", and a changed path missing from the tree with "no longer in the tree". The prompt lists only the added, modified and renamed paths.

## What it costs to change later

One reason string and the list of statuses in the writer, and the tests that pin them; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing in the spec or the knowledge says whether a third reason is wanted or whether the two named ones were meant to be the only ones.
