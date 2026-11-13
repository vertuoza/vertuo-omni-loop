---
id: s5-04-checkpoint-rule-in-the-note
prd: 2809
slice: s5
rank: medium
bears-on: none
raised: 2026-11-13
wave: 4
---

## The question, in plain words

Where should the rule live that tells a job to first take back the saved work of a branch before touching it?

## The decision, in plain words

The rule is written in the note each resumed job reads first, and nowhere in the instructions the building skills read. A job that never got a note is never told it.

## The intro, for fun

Every recipe card says to preheat the oven, but only on the card you were handed.

## The punchline, for fun

Nobody reads the cookbook's foreword anyway.

## The options, in plain words

A. The rule is in the resume note alone (built)
B. Also write it once in the runner guidance the resumable skills read, in a follow-up

## What I had to decide

Keep A, or choose B: also write the rule once in the kit's runner guidance the resumable skills read, as the spec's section on restoring says, in a follow-up outside this slice.

## What I did meanwhile

resumeNote() in kit/lib/runner/resume.ts writes the rule (git merge --ff-only omni-checkpoint/<branch>, or a merge when it diverged, or a checkout from the checkpoint when origin has no such branch) under each restored branch list, and the session's prompt points at the note. No skill or guidance file changed: none is in this slice's territory, nor in any slice of the plan.

## What it costs to change later

A paragraph in one guidance file, in a follow-up: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks the rule to be written once in the kit's runner guidance, but the plan gives no slice that file.
