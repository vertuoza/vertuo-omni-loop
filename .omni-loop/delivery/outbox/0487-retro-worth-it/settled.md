# Settled outbox items — PRD 487

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-no-promotion-keeps-the-ship -->

## s1-01-no-promotion-keeps-the-ship — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-no-promotion-keeps-the-ship
prd: 487
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a merged feature taught nothing new, should the harvest also skip the bookkeeping it does at merge time, like moving the feature's folder to the shipped shelf?

## The decision, in plain words

It skips only its own notes about what stayed local. If the feature's folder still has to move to the shipped shelf, or open questions still have to be closed, that still happens.

## The intro, for fun

Nothing new was learned, but the boxes still have to go to the attic.

## The punchline, for fun

We skip the diary entry, not the move.

## The options, in plain words

A. A. Skip only the harvest's own notes; still settle and ship what prepare planned, the option built.
B. B. Drop every change, the settling and the move included, so no pull request ever opens without a promotion.
C. C. Keep the notes too, and let the app decide from the list of promotions whether to open a pull request.

## What I had to decide

Whether a harvest with nothing promoted drops every change it would make, or only its own notes about what stayed local.

## What I did meanwhile

A harvest with no new register entry or decision record keeps the merge-time settling and the move out of the inbox that prepare planned, and adds none of its own ledger lines. For a feature already shipped by its branch, which is the usual case, that is no change at all, so the app opens no pull request.

## What it costs to change later

One line in the harvest's finishing step: return no changes at all instead of only what prepare planned.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the harvest returns no edits and the app opens no pull request; it does not say what should happen to a feature still in the inbox at merge, whose move would then never be made by anyone.
- (author) Without the local notes, a replayed harvest asks the model about the same candidates again; the spec does not say whether that matters.

```

<!-- /omni-outbox-settled: s1-01-no-promotion-keeps-the-ship -->

<!-- omni-outbox-settled: s2-01-bookkeeping-still-opens-a-pr -->

## s2-01-bookkeeping-still-opens-a-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-bookkeeping-still-opens-a-pr
prd: 487
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a merged feature taught nothing new but its folder still has to move to the shipped shelf, should the app still open a knowledge pull request for that move?

## The decision, in plain words

Yes: the app skips the pull request only when there is truly nothing to change. If the move or the closing of open questions is still owed, it opens the pull request as before, and leaves no comment.

## The intro, for fun

Nothing new was learned, but the boxes are still sitting in the hallway.

## The punchline, for fun

Someone has to carry them upstairs, and that takes a pull request.

## The options, in plain words

A. Open the pull request only when there is something to write; a bookkeeping-only pull request still opens, the option built.
B. Never open a pull request without a promotion, and leave the move and the settling undone until a later harvest.
C. Never open a pull request without a promotion, and say in the comment that the move is still owed so a person does it by hand.

## What I had to decide

Whether the app gates the knowledge pull request on 'nothing to write at all' or on 'nothing promoted', when a feature with no promotion still has merge-time bookkeeping left.

## What I did meanwhile

The app opens no branch and no pull request, and leaves the 'Knowledge: nothing new' comment, only when the harvest has nothing at all to write. That is the usual case, since the feature branch already ships its own folder. When the move or the settling is still owed, the pull request opens as before, carrying only that bookkeeping. The count in the comment is every candidate the harvest looked at.

## What it costs to change later

One condition in the harvest's publish step: test for a promotion instead of for an empty change set.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says no promotion means no pull request, and the adopted s1 decision says the move and the settling still happen; both cannot hold for a feature still in the inbox at merge, so the app follows the s1 decision.
- (author) The spec does not say whether '<n> candidates stayed local' counts candidates the model could not place; the comment counts every candidate.

```

<!-- /omni-outbox-settled: s2-01-bookkeeping-still-opens-a-pr -->

<!-- omni-outbox-settled: s3-01-verdict-follows-prose-rules -->

## s3-01-verdict-follows-prose-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-verdict-follows-prose-rules
prd: 487
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The judge's short reason for its verdict, and its reason for keeping each finding, are published words. Should they follow the same strict wording rules as the rest of the retro, even though breaking one throws the whole verdict away?

## The decision, in plain words

They follow the same rules as every other published sentence of the retro: no digits, no links, no refused words, and a length cap of three hundred characters each. When one breaks a rule, the whole verdict is dropped and the retro counts as not judged, so no pull request opens.

## The intro, for fun

The judge has to watch its language as closely as the witnesses do.

## The punchline, for fun

One stray digit and the verdict is thrown out of court.

## The options, in plain words

A. A: every prose rule applies to the reason and each why, with caps of three hundred characters, and any failure drops the whole verdict
B. B: only the length caps apply to the reason and each why; other prose rules are not checked on them
C. C: a reason or why breaking a rule is dropped on its own, and the verdict survives when the rest holds

## What I had to decide

Whether the verdict's reason and each finding's why obey every prose rule (A), only the length cap the spec names (B), or are cleaned instead of dropped (C).

## What I did meanwhile

A verdict whose reason or why holds a digit, a link or a refused word is dropped, and the retro takes the quiet path with a comment reading not judged.

## What it costs to change later

A constant change in the guard and the field caps; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No live reply has been seen yet, so how often the model writes a digit in its reason is unknown (author).

```

<!-- /omni-outbox-settled: s3-01-verdict-follows-prose-rules -->

<!-- omni-outbox-settled: s3-02-two-test-files-past-the-fence -->

## s3-02-two-test-files-past-the-fence — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-two-test-files-past-the-fence
prd: 487
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Asking the model for a verdict changed two test files that belong to the next slice: a saved copy of the retro's rules, and one test reply that had no verdict. Is it fine that this slice touched them, rather than leaving the tests red until the next slice?

## The decision, in plain words

This slice changed both, as little as it could: the saved rules gained the two new length caps, and the one test reply gained a verdict saying nothing is worth keeping. Every test stays green, and the next slice still owns those files.

## The intro, for fun

Two test files sat just past the fence, and the new verdict rolled over it.

## The punchline, for fun

The slice stepped over, tidied both, and stepped right back.

## The options, in plain words

A. A: this slice changes the saved rules and the one test reply, so every test stays green
B. B: leave both to the next slice, and let the retro tests stay red until it lands

## What I had to decide

Whether the two small test changes stay in this slice (A), or move to the next slice with the tests left red in between (B).

## What I did meanwhile

The saved retro rules list the two new caps, and the retro's test reply for the day-fourteen run carries a verdict judged not worth it.

## What it costs to change later

Two lines in test files; reverting them only moves the work to the next slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the next slice would rather rewrite these lines its own way is not known (author).

```

<!-- /omni-outbox-settled: s3-02-two-test-files-past-the-fence -->
