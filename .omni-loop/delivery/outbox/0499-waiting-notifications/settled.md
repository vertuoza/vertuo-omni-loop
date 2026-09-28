# Settled outbox items — PRD 499

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-own-question-counts-while-page-can-answer -->

## s1-01-own-question-counts-while-page-can-answer — adopted

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
id: s1-01-own-question-counts-while-page-can-answer
prd: 499
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Should a question from your own terminal count as waiting for as long as it stays open, or only while the page can still answer it?

## The decision, in plain words

It counts only while the page can still answer it: once the terminal has taken the question back, after nine minutes, it stops counting, exactly as the home page's Waiting for you tile already counts.

## The intro, for fun

A question left open overnight still looks like it is waiting for you.

## The punchline, for fun

We only count the ones you can still actually answer.

## The options, in plain words

A. Count a question while the page can still answer it, like the home page's tile (built).
B. Count every question still marked open, even after the terminal took it back.

## What I had to decide

Whether the count follows the page's own nine-minute answering window, or every question still marked open.

## What I did meanwhile

The count, the menu badges and the title follow the home page's rule: a question counts while the page can answer it.

## What it costs to change later

One line in the waiting list's own-question rule to count every open round instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names both 'status open' and the ask pages' own readers, which apply the nine-minute window; it does not say which wins when they differ.

```

<!-- /omni-outbox-settled: s1-01-own-question-counts-while-page-can-answer -->

<!-- omni-outbox-settled: s1-02-app-headers-test-questions-badge -->

## s1-02-app-headers-test-questions-badge — adopted

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
id: s1-02-app-headers-test-questions-badge
prd: 499
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

May this slice change a test of every app page's menu that lies outside its own ground, now that Questions carries a count?

## The decision, in plain words

Yes: the shared test of every app page's menu now accepts a count after Questions, as it already did after Shared with me. Nothing else in it changed.

## The intro, for fun

The menu learned to count, and an old test thought it was a typo.

## The punchline, for fun

We taught the test to read numbers too.

## The options, in plain words

A. Change the one line so the menu test accepts a count after Questions (built).
B. Leave that test untouched and let a later slice that owns it fix it.

## What I had to decide

Whether a one-line change to a test outside the slice's ground is acceptable.

## What I did meanwhile

The test accepts an optional count after Questions, so it passes with and without questions waiting.

## What it costs to change later

Reverting the one line in that test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the menu test of every app page to no slice; its territory lists the sidebar's own tests only.

```

<!-- /omni-outbox-settled: s1-02-app-headers-test-questions-badge -->

<!-- omni-outbox-settled: s2-01-outbox-item-id-joins-dossier -->

## s2-01-outbox-item-id-joins-dossier — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-outbox-item-id-joins-dossier
prd: 499
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Two different PRDs can hold outbox questions with the same short name. What name should the waiting list give each one so it is never mixed up with another?

## The decision, in plain words

Each waiting outbox question is named by its PRD's page plus its own short name, so two PRDs never share a name and an alert fires once per question.

## The intro, for fun

Two PRDs walk into a bell, both wearing a name tag that says s1-01.

## The punchline, for fun

Now every tag also says which PRD it came from.

## The options, in plain words

A. Join the dossier id and the item id, so every id is unique across PRDs (built).
B. Answer the item's own id, and let the waiting list build a unique key from it and the dossier id.

## What I had to decide

Whether the waiting list names an outbox question by its PRD's page and its own name together, or by its own name alone.

## What I did meanwhile

The route answers each item's id as the dossier id and the item id joined by a colon; the dossier id and the PRD number are also given on their own.

## What it costs to change later

Changing it is one line in the route and its tests; nothing is stored, and the alerts slice only compares ids it has seen in the same browser session.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the field id without saying whose id it is (author).
- The route also counts a PRD whose feature PR could not be read as unread, beside a failed summary or outbox, since it cannot say whether anything waits (author).

```

<!-- /omni-outbox-settled: s2-01-outbox-item-id-joins-dossier -->
