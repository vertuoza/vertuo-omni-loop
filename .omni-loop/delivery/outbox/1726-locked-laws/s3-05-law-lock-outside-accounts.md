---
id: s3-05-law-lock-outside-accounts
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Should the new law lock be a separate check that only an owner's approval clears, kept apart from the list of risky changes an agent explains in writing?

## The decision, in plain words

Yes: the lock is its own rule, so no written explanation or answered question can ever clear it, and the local coverage check does not list it.

## The intro, for fun

Some doors open with a note; this one needs a key.

## The punchline, for fun

No note, however well written, turns a lock.

## The options, in plain words

A. A separate rule only an approval clears, outside the accounts (built).
B. One more risky rule the accounts list, always refused as accounted, so the local check names it too.

## What I had to decide

Whether law-locked joins riskyChanges' rules (and so the accounts, the coverage check and the kit's gate) or stays a separate list only the app's outbox check reads.

## What I did meanwhile

lockedLawChanges and lawsAwaitingOwners are exported beside riskyChanges in kit/lib/outbox/decision-coverage.ts but are not in RULE_IDS; the account format and omni check coverage are unchanged. A locked law moved to another register file, its words kept, counts as changed.

## What it costs to change later

Adding it to the risky list later is one rule and an account refusal, plus a local reading of approvals the kit does not have today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the rule runs in decision-coverage and in the app's check; it does not say the accounts should see it.
- (author) Locally, an agent learns of a locked law only from the app's check, until s5's skills read omni kb laws.
