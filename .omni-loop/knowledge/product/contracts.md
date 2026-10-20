# Product contracts

## DC-PRODUCT-1

An outbox item has exactly one rank: human-action, high or medium.

Points to: kit/lib/schema/front-matter.ts
Source: PRD #1796
Stated: 2026-10-15

## DC-PRODUCT-2

A PRD's folder, `<nnnn>-<topic>`, sits in the inbox until it ships, then in the shipped folder: the
folder is its status. A PRD with no folder is still an idea or waits for its approval.

Points to: kit/lib/layout.ts
Source: docs/guide/loop.md
Stated: 2026-10-20

## DC-PRODUCT-3

A rule or an invariant becomes a law only when a person adds a `Locked:` line; until then an agent
may only write `Proposed law:`. A law's `Enforced by:` names its test, or `pending #<n>` while its law
issue waits for one.

Points to: kit/lib/knowledge/registers.ts
Source: PRD #1726, PRD #1342
Stated: 2026-10-20

## DC-PRODUCT-4

A loop is running until it ends, then parked when PRDs wait on people, or stopped. Live, sleeping and
silent are read from its times, never stored.

Points to: kit/lib/loop/local.ts
Source: PRD #1139
Stated: 2026-10-20

## DC-PRODUCT-5

A runner job moves queued → claimed → running and ends done, failed or cancelled. Only a job that
has ended has an end time.

Points to: supabase/migrations/20261207100000_runners.sql
Source: PRD #1830
Stated: 2026-10-20

## DC-PRODUCT-6

A proposal to change a product's Legal entries or glossary is open, then approved or rejected. A
Legal entry is retired and a term is removed, but neither is ever deleted.

Points to: supabase/migrations/20261212110000_product_knowledge.sql
Source: PRD #1795
Stated: 2026-10-20
