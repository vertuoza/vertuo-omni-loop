---
id: s1-01-repo-refusal-is-a-violation
prd: 549
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When an ordinary repository's plan names a repository per slice, should the plan check list that among its other findings, or stop at once with a single error line?

## The decision, in plain words

It is listed among the plan's other findings, so a person sees everything wrong with the plan in one run.

## The intro, for fun

A plan walks into the wrong repository carrying a map of five others.

## The punchline, for fun

The check reads the whole map aloud before showing it the door.

## The options, in plain words

A. List it as a finding beside the others and exit 1 (built).
B. Stop at once with one error line and exit 2, grading nothing else.

## What I had to decide

Whether a plan-repository table found outside a plan repository is one finding among others (exit 1) or a usage error that stops the check (exit 2).

## What I did meanwhile

It is a finding: the check still grades waves, blockers and collisions, and exits 1 with every finding listed.

## What it costs to change later

Switching is a few lines in the plan command and two test expectations; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says 'refused' without naming the exit code (author).
