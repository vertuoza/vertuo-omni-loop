---
id: s5-01-packages-law-proof-fixtures-renamed
prd: 2305
slice: s5
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Four tests in the game and the shared packages that prove the product's rules used the maintainer's repository names in their sample data. Do you approve renaming that sample data to fictional names?

## The decision, in plain words

The sample names in those tests now read as made-up ones, and each test still checks the same rule with the same steps.

## The intro, for fun

Four more tests swapped costumes and kept their jobs.

## The punchline, for fun

Same badge, new outfit.

## The options, in plain words

A. A. Keep the fictional names in the four tests, as built.
B. B. Put the original names back in those four tests and exclude them from the guard.

## What I had to decide

Law-proof tests changed: game/cli/scripts.test.ts, game/sources/parsers.test.ts, game/sources/supabase.test.ts, packages/design/src/mascots.test.ts. Only fixture names changed (the maintainer's repositories to demo-org/nimbus-*, a colleague's login to jane.doe); no assertion was weakened. The owner of the rules they prove approves the feature PR.

## What I did meanwhile

The tests stay green with the new names and keep proving their rules.

## What it costs to change later

Undoing it means renaming the sample data back, a mechanical edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which rule each of the four tests proves was read from the register, not re-judged (author)
