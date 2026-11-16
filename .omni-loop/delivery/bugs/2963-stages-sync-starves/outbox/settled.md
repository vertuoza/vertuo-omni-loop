# Settled outbox items — PRD 2963

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-sync-test-seeds-last-read -->

## s1-01-sync-test-seeds-last-read — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T18:43:12Z
- Channel: feature pull request #2964
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2964#issuecomment-6925665009
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-123
- Raised: 2026-11-16
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built and states nothing new about the product; BR-PRODUCT-123 reads as before.

### The answer, as it was given

```text
1: A
```

### The item, as it was raised

```text
---
id: s1-01-sync-test-seeds-last-read
prd: 2963
slice: s1
rank: high
bears-on: BR-PRODUCT-123
raised: 2026-11-16
wave: 1
---

## The question, in plain words

One of the test files that proves how a PRD's timeline is dated had to change: three of its tests set up "when the sync last looked at a repository" the old way, and the fix changed where that date is kept. The rule about dating the timeline is untouched. Is that change to its proof acceptable?

## The decision, in plain words

The three tests now set up the date in the new place; what they check about the timeline and the sync is the same, except that a repository with no new PRD is now read only from its last look, not from scratch.

## The intro, for fun

The timeline's referee got a new stopwatch.

## The punchline, for fun

Same rules, same calls; it just stops forgetting when it last blinked.

## The options, in plain words

A. Keep the three tests set up the new way (built).
B. Leave the file as it was, and prove the same things from a new test file instead, deleting nothing.

## What I had to decide

BR-PRODUCT-123 (timeline dates) lists `apps/galaxy/src/stages/sync/sync.test.ts` among its proofs. The fix changed three tests there: "reads a repository in full on its first sync, then only what changed since it" (acme/gears is now read from its last read, not in full again), "takes when a repository was last synced from its recorded read only" (seeded through recordSynced, renamed), and "logs milestones it cannot read or record…" (seeded through recordSynced instead of a `prd` stage row). No assertion about how milestones are dated changed.

## What I did meanwhile

The branch holds the three tests as described, all green, with the full suite green.

## What it costs to change later

Moving the three tests to a file of their own is a small test-only change.

## What I could not know

- Whether the rule's owner wants tests of the sync's read order kept out of the rule's proof file altogether (author).
```

<!-- /omni-outbox-settled: s1-01-sync-test-seeds-last-read -->
