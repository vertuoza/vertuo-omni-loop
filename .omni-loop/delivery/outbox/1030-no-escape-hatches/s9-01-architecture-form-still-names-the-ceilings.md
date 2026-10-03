---
id: s9-01-architecture-form-still-names-the-ceilings
prd: 1030
slice: s9
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

The architecture page of the playbook still says the repository's type guard keeps its ceilings, which this feature removed. Who should correct that line, and when?

## The decision, in plain words

This slice left that page as it is, since it is outside what this slice may change, and named the stale words here so the finish can fix them.

## The intro, for fun

The ceilings came down, but one page still points up at them.

## The punchline, for fun

A sign for a staircase that was taken out last week.

## The options, in plain words

A. A. Leave the line for the finish or a follow-up docs change to correct (what this slice did).
B. B. Correct it in this PRD's finish, before the feature PR is marked ready.
C. C. Correct it in a separate docs pull request after this PRD ships.

## What I had to decide

Whether the playbook's architecture form drops the words 'its ceilings' from its line about scripts/, in this PRD's finish or in a later docs change.

## What I did meanwhile

Left .omni-loop/knowledge/playbook/architecture.md untouched; it is outside s9's territory (scripts/typescript-guard.test.ts, scripts/typescript-ceilings.json, ADR 0054). git grep -n 'ts-allow' finds no other mention outside the guard's own fixtures and the delivery history; no README, CLAUDE.md or fallow config names ts-allow or the ceilings file.

## What it costs to change later

One line of prose: change '(its TypeScript guard, its ceilings)' to '(its TypeScript guard)' at any time. Nothing reads it as config.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person wants the playbook's forms corrected in the finish of a feature PR, or kept to docs-only pull requests (author).
