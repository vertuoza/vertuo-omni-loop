---
id: s14-02-hooks-folder-unseen-by-typecheck
prd: 725
slice: s14
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The test beside the assistant's commit guard is now typed, but the repository's type check never looks inside that hidden folder. Should the check be widened to see it?

## The decision, in plain words

The test is typed and was checked by hand with the shared settings. Widening the repository's check is left to the last slice, which owns that setting.

## The intro, for fun

The type checker skips hidden folders, the way a tidy guest skips the closet.

## The punchline, for fun

The guard's own test was hiding in there, typed and spotless, with nobody to admire it.

## The options, in plain words

A. Leave the root include as it is for now; s29 adds the hooks folder when it tightens the configs
B. Add the hooks folder to the root include now, outside this slice's ground
C. Leave the hooks folder out of the type check for good: it holds one test

## What I had to decide

The root tsconfig.json includes **/*.ts, but TypeScript's wildcards do not enter folders whose name starts with a dot, so .claude/hooks/fallow-gate.test.ts is not checked by pnpm typecheck. tsconfig.json is s29's territory, not s14's.

## What I did meanwhile

Removed the file's nocheck marker, typed its helpers, and checked it with a scratch config that extends tsconfig.base.json and includes .claude/hooks/*.ts: no error. pnpm test still runs it.

## What it costs to change later

Cheap: add ".claude/hooks/**/*.ts" to the root include in s29, or leave it unchecked.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s29's guard test, which reads files itself, also covers dot folders (author)
