---
id: s1-02-evaluate-grades-changed-files-when-given
prd: 28
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the check is handed the list of files a pull request changed, should it also hold the pull request for risky changes nobody explained?

## The decision, in plain words

Yes, when the list is handed in: the check then holds the pull request exactly as the kit's full gate does, and names those changes in its title. When no list is handed in, it only looks at open questions and unfinished rework.

## The options, in plain words

A. Grade the changed files whenever they are handed in, as built.
B. Never grade them: the check looks only at open questions and unfinished rework, matching the conclusion table.
C. Grade them, and widen the copy to include the knowledge folder so every rule can fire.

## What I had to decide

The spec makes changed files an input to evaluate, and the kit's gate uses them for one thing only, the unaccounted-risky-change reason. But the spec's conclusion table names only open items and unreworked drift, and the gate as /omni:yolo runs it today does not grade the range.

## What I did meanwhile

evaluate passes `changes` straight to `gateResult` when given (default null, range not graded); an unaccounted change makes the check `failure` with 'n unaccounted risky changes' in the title, overridable by the label like the others. The Inngest function (s5) chooses whether to pass the compare endpoint's files.

## What it costs to change later

One argument: s5 passes the changed files or does not. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) With laws.source set to knowledge, the law-proof rule reads the knowledge folder, which the snapshot does not hold today, so that one rule would never fire from the app.
- (author) Whether the spec author wanted the app's gate to match /omni:yolo's (no range) or the kit's fullest gate.
