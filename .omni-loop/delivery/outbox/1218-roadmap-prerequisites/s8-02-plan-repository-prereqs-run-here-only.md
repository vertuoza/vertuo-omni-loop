---
id: s8-02-plan-repository-prereqs-run-here-only
prd: 1218
slice: s8
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

In a setup where one planning repository drives several code repositories, the spec says a prerequisite may concern another repository and be checked in a read-only copy of it, where nothing may run. Where should those checks run?

## The decision, in plain words

The check always runs from the planning repository. A row about another repository names it, and its check must only ask something (a package registry, GitHub), never install, build or run that repository's code.

## The intro, for fun

Read only means read only, even when a checklist asks nicely.

## The punchline, for fun

So the checklist asks from the outside.

## The options, in plain words

A. A. Check every row from the planning repository; rows about another repository only read (built).
B. B. Run read-only checks inside a fresh copy of the other repository.

## What I had to decide

Whether a prerequisite about another repository may ever run inside that repository's copy, or only ask from the planning repository.

## What I did meanwhile

Rows about another repository are checked from the planning repository with a read-only command; the install check never targets another repository.

## What it costs to change later

Running checks in the copy later is a change to two instructions, not to stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- none known (author)
