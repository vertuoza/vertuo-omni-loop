# Bug 3005: law-proof asks a person for the test of a proposed rule

## Triage

- **Domain:** the outbox gate (`law-proof`, `kit/lib/outbox/decision-coverage.ts`)
- **Risk:** medium — a slice that changes the test of a proposed rule gets a medium item the gate refuses, so its feature PR stays red until a person re-raises the item high by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/outbox/decision-coverage.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ 'law-proof' ] to deeply equal []`

## Fix

`law-proof` read the `Enforced by:` paths of every knowledge entry, proposed ones included, while `omni item new` ranks an item bearing on a proposed entry medium and `law-demoted` already skips it (P-PRODUCT-81: a proposed entry is no law yet). It now reads the paths of confirmed entries only; a path a confirmed entry names as well still fires.

## Guard

The two reproduction cases, run by `pnpm test`: a path only a proposed entry names fires nothing, and a path a confirmed entry names beside a proposed one still fires `law-proof`.

## Mutation

mutation: 141 killed, 2 survived in kit/lib/outbox/decision-coverage.ts (both survivors at lines 323 and 325, outside the lines the fix changed)

## Still open

- `law-text` fires on any change to a register file, so rewording only a proposed entry still asks a person for a high item, against P-PRODUCT-81.
