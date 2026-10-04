---
id: s3-03-rows-the-table-leaves-unsaid
prd: 1066
slice: s3
rank: medium
bears-on: none
raised: 2026-10-04
wave: 2
---

## The question, in plain words

The agreed layering rules say what each main part of the code may borrow, but stay silent on the delivery tool's own test helpers and on the repository's configuration files. What may those borrow?

## The decision, in plain words

The delivery tool's test helpers may borrow the tool itself and its command line, and the configuration files may borrow anything, like the repository's own scripts. Every package must also list any sibling package it borrows by name.

## The intro, for fun

Every room in the house got a rule, except the broom cupboard and the fuse box.

## The punchline, for fun

So the broom cupboard may hold brooms, and the fuse box may touch every wire.

## The options, in plain words

A. Give the unlisted parts the rules above, and ask every package to list what it borrows (what was built).
B. Check only the parts the rules list, and ask only the design library to list what it borrows, leaving the rest unchecked.
C. Narrow the config files' row to what they import today, so a config file cannot reach an app.

## What I had to decide

What the guard does where the spec's rule table has no row, and how far its declared-dependency check reaches. The table names kit/test and the supabase types as zones but gives them no row, and names no zone for eslint.config.ts, vitest.config.ts and .claude/hooks/. It asks only packages/design to declare the kit.

## What I did meanwhile

kit/test may import kit/lib and kit/bin (it is the kit's own test fixtures); the supabase types and the root manifest import nothing; the repository's config files and Claude Code's hooks may import anything, like scripts. Any import by package name (vertuo-omni-plan/..., @omni/*) from another workspace package must be declared in the importing package's manifest, for every package, not only packages/design: it holds on the whole tree today.

## What it costs to change later

A few lines of the guard's table and its fixtures, and the matching rows of the ADR and of the architecture form.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether its table was meant to be complete, nor whether the declared-dependency rule was meant for packages/design only.
