# Bug 3041: law-text asks a person when only a proposed entry is reworded

## Triage

- **Domain:** outbox gate (`kit/lib/outbox/decision-coverage.ts`, rule `law-text`)
- **Risk:** medium — a team with proposed (harvested) knowledge gets a high outbox item for rewording a draft that floors nothing; the workaround is answering the item by hand.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/outbox/decision-coverage.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ 'law-text' ] to deeply equal []`

## Fix

`law-text` matched a register file by its path alone, so any change to it asked a person, even one that only reworded, added or removed entries carrying a `Proposed:` line, which are no law yet (P-PRODUCT-81). Given the range's base, it now compares the file's entries on both sides and stays quiet when every entry that differs is proposed on each side that holds it. Confirming a draft, changing a confirmed entry, an ADR, or a change with no base still fires it as before.

## Guard

The five `riskyChanges — law-text on proposed entries (#3041)` unit tests: drafts-only changes fire nothing; a confirmed change beside a draft, a confirmation, a missing base or a header-only change still fire.

## Mutation

mutation: 182 killed, 5 survived in kit/lib/outbox/decision-coverage.ts (after one strengthening; in the fix's lines, the base-side file filter at line 185 survives because each test base holds one file, and `() => false` → `() => undefined` at line 216 is equivalent; lines 348 and 350 predate it)
