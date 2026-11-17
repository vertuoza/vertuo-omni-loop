# Settled outbox items — PRD 2999

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-omni-test-fixtures -->

## s1-01-omni-test-fixtures — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-17T12:53:49Z
- Channel: feature pull request #3000
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3000#issuecomment-6948602243
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-12
- Raised: 2026-11-17
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; N-PRODUCT-12 reads as before, and only three outbox-gate tests beside its proof gained a fetched main branch.

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-01-omni-test-fixtures
prd: 2999
slice: s1
rank: high
bears-on: N-PRODUCT-12
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The fix edits a test file that also proves the rule "the terminal answers calmly outside a kitted folder". Only three outbox-gate tests in it change, to give their sample repository a fetched main branch. Do you accept that edit?

## The decision, in plain words

The three gate tests now run on a sample repository whose main branch looks fetched, because the gate now always compares with the main branch. The tests that prove the rule are not touched.

## The intro, for fun

A test file guarding a rule got a small visitor.

## The punchline, for fun

It only came to hand three sample repositories a map of main.

## The options, in plain words

A. Keep the edit: the three gate tests get a fetched main branch (built).
B. Keep the file as it was, and move the three gate tests to a file that proves no rule.

## What I had to decide

N-PRODUCT-12, whose proof names this test file: the range adds a fetched main branch to the sample repository of three outbox-gate tests in it, and changes no test of the rule itself.

## What I did meanwhile

The branch holds option A: three fixture lines changed, every test green.

## What it costs to change later

Small: moving three tests to another file, one commit.

## What I could not know

Whether the rule's owner prefers its proof file to hold only the rule's own tests (author).
```

<!-- /omni-outbox-settled: s1-01-omni-test-fixtures -->
