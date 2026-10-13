---
id: s1-01-hooks-enter-through-check-changed
prd: 1814
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The two new git checks need a starting point the dead-code audit can see. Should they start inside the existing changed-files checker, or from a script of their own that the audit's settings list?

## The decision, in plain words

They start inside the existing changed-files checker, through a hook mode, so the audit sees them without a settings change outside this slice.

## The intro, for fun

Every gate needs a door, and this one had two places it could hang.

## The punchline, for fun

We used the door that was already in the wall.

## The options, in plain words

A. A. The checks start inside the existing changed-files checker, and the audit settings stay as they are.
B. B. The checks start from a script of their own, and the audit settings list that script.

## What I had to decide

Keep A unless you would rather the hooks have a script of their own. B moves the hook mode out of scripts/check-changed.ts into its own entry file and adds that file to the entry list of .fallowrc.jsonc, which is outside this slice's territory.

## What I did meanwhile

The hooks run `node scripts/check-changed.ts --hook pre-commit|pre-push`; the gate's code lives in scripts/check-changed-hooks.ts, imported by scripts/check-changed.ts.

## What it costs to change later

Cheap either way: one import and one argument check to move, plus one line in .fallowrc.jsonc for B.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- vitest.config.ts still includes .claude/hooks/**/*.test.{mjs,ts}, which now matches nothing; the file is outside this slice, so the glob was left (author)
