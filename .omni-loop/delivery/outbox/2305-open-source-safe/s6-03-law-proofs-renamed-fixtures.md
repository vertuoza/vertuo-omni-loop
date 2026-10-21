---
id: s6-03-law-proofs-renamed-fixtures
prd: 2305
slice: s6
rank: high
bears-on: N-PRODUCT-16
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Four database checks that prove product rules, one of them the locked rule that the game's history is only ever added to, had their made-up names changed and now build their own workspace. Do they still prove what they proved before?

## The decision, in plain words

Only the names and the workspace they run in changed: every assertion about the rules is the same, and all four pass against a fresh database. The locked rule's check gained one proof, that a fresh install creates no workspace but the demo one.

## The intro, for fun

The witnesses changed their names, but they still saw the same thing.

## The punchline, for fun

Same testimony, new badges, and the history book still only grows.

## The options, in plain words

A. The renamed proofs stand as they are (built).
B. Restore a proof the reviewer finds weakened, inside the same fixture.

## What I had to decide

Whether the renamed proofs in supabase/checks/access.sql (N-PRODUCT-16), roadmaps.sql (BR-PRODUCT-81), agent_tokens.sql (BR-PRODUCT-110, BR-PRODUCT-111) and knowledge_graphs.sql (BR-PRODUCT-120) still prove their rules; the locked one needs an approving review from its owner on the feature pull request.

## What I did meanwhile

Each check includes supabase/checks/fixtures/initech.sql instead of reading the workspace the migrations used to seed; names follow PRD 2305's rule. access.sql's first block now proves a fresh install holds only the demo seed's nimbus workspace and no repository, where it used to check the seeded workspace's fleets and sectors.

## What it costs to change later

Reverting is a revert of this slice's check commit; no production data or schema is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The four checks were run against a local fresh database only; the supabase workflow on the pull request is the first CI run (author).
