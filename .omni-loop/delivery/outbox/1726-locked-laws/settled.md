# Settled outbox items — PRD 1726

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-law-word-means-locked-weight-unchanged -->

## s1-01-law-word-means-locked-weight-unchanged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-law-word-means-locked-weight-unchanged
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Now that a law means a locked rule, should a decision that bears on a principle or an ordinary rule still be ranked high, as it is today?

## The decision, in plain words

Yes for now: only the word changed, so a law is a locked rule and nothing else is called one. What gets ranked high, and what the review gate asks of a rule, stay as they were.

## The intro, for fun

One word, three meanings, one rename.

## The punchline, for fun

The word moved house; the furniture stayed put.

## The options, in plain words

A. A. Keep the high floor for every confirmed principle, rule and law; reserve the word law for locked entries only.
B. B. Floor only rules and laws high; a decision bearing on a principle gets its own rank.
C. C. Floor only locked laws high; rules and principles rank like any other decision.

## What I had to decide

Whether items bearing on a principle or an unlocked rule keep their high floor, now that only locked entries are called laws.

## What I did meanwhile

The registers now have one law test: a locked rule or invariant. A second test, for confirmed rules, keeps the rule-level gate and the high floor exactly as before. The review gate now uses that shared test instead of its own copy. The status and graph counts that still say law for every confirmed entry are left for slices s2 and s5.

## What it costs to change later

One line in the floor check and its tests; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says law means one thing everywhere, but also that the rules keep their gate; it does not say whether a principle still floors an item high.
- (author) kb status, the knowledge graph and knowledge judge still count every confirmed entry as a law; their files belong to s2 and s5.

```

<!-- /omni-outbox-settled: s1-01-law-word-means-locked-weight-unchanged -->

<!-- omni-outbox-settled: s1-02-how-a-lock-line-is-read -->

## s1-02-how-a-lock-line-is-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-how-a-lock-line-is-read
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

How strict should the knowledge check be about a lock line that is badly written, or that sits beside other lines that contradict it?

## The decision, in plain words

Strict: a badly written lock still counts and is refused until fixed, and so is a lock on a rule still marked proposed or whose test is only promised. Owners are written without the at sign, and a copy of another repository's knowledge is never asked about the cap or the owners.

## The intro, for fun

A lock scribbled in pencil is still a lock.

## The punchline, for fun

Better a red check today than a quiet law nobody guards.

## The options, in plain words

A. A. Fail closed: a malformed lock counts and is refused; lock beside Proposed: is refused; pending is no test; owners without @.
B. B. Lenient: a malformed lock is ignored with a warning, pending counts as a test, and owners may carry @.

## What I had to decide

How a malformed or contradictory Locked: line is read and graded.

## What I did meanwhile

A malformed Locked: line reads as locked with no owner and no date, counts against the cap and is refused. Locked: beside Proposed: is refused. Enforced by: pending counts as no test. laws.owners refuses a name written with @. An imported copy skips the cap and owners checks, as it skips requireProof.

## What it costs to change later

A constant or a branch each in the register reader and the knowledge check, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists what a lock must carry but not how a malformed lock line, or a lock beside Proposed:, is read.
- (author) Whether a pending law issue counts as the test a lock needs is not settled; I read a lock as needing a real test path.

```

<!-- /omni-outbox-settled: s1-02-how-a-lock-line-is-read -->

<!-- omni-outbox-settled: s1-03-coverage-helper-outside-territory -->

## s1-03-coverage-helper-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-coverage-helper-outside-territory
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Was it right to touch the review gate's file, which belongs to a later slice, to share the new definition of a law?

## The decision, in plain words

Yes, with the smallest possible change: the gate now asks the shared rule test instead of keeping its own copy, and it behaves exactly as before.

## The intro, for fun

Two copies of one definition always drift apart.

## The punchline, for fun

So one of them retired early.

## The options, in plain words

A. A. Swap the private helper for the shared one in s1, behaviour unchanged.
B. B. Leave the review gate's own copy alone and let the later slice make the swap.

## What I had to decide

Whether s1 may swap decision-coverage.ts's private law test for the shared one, outside its territory.

## What I did meanwhile

decision-coverage.ts imports isConfirmedRule from the registers in place of its own isLaw; its tests pass unchanged. Slice s3 builds law-locked in that file next wave.

## What it costs to change later

Reverting is one import and five lines in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when asks both files to agree, but its territory for s1 does not list decision-coverage.ts.

```

<!-- /omni-outbox-settled: s1-03-coverage-helper-outside-territory -->
