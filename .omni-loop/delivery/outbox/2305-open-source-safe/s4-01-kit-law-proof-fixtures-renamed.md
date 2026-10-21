---
id: s4-01-kit-law-proof-fixtures-renamed
prd: 2305
slice: s4
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Six tests that prove the loop's rules used the maintainer's repository names in their sample data. Do you approve renaming that sample data to fictional names?

## The decision, in plain words

The sample names in those tests now read as made-up ones, and each test still checks the same rule with the same steps.

## The intro, for fun

Six tests changed their costumes but kept their jobs.

## The punchline, for fun

Please check the badge, not the outfit.

## The options, in plain words

A. A. Keep the fictional names in the six tests, as built.
B. B. Put the original names back in those six tests and exclude them from the guard.

## What I had to decide

Law-proof tests changed: kit/bin/roadmap.test.ts, kit/lib/config.test.ts, kit/lib/knowledge/check-knowledge.test.ts, kit/lib/policy/phase-0.test.ts, kit/lib/roadmap/grade.test.ts, kit/lib/roadmap/parse.test.ts. Only fixture names changed (the maintainer's repositories to demo-org/nimbus-*); no assertion was weakened. The owner of the laws they prove approves the feature PR.

## What I did meanwhile

The tests stay green with the new names and keep proving their laws.

## What it costs to change later

Undoing it means renaming the sample data back, a mechanical edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which law each of the six tests proves was read from the register, not re-judged (author)
