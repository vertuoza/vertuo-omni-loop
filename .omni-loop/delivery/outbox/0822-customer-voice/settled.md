# Settled outbox items — PRD 822

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-answered-claims-not-yet-on-the-check-list -->

## s1-01-answered-claims-not-yet-on-the-check-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-answered-claims-not-yet-on-the-check-list
prd: 822
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

An answer saved as a claim waits as proposed for a member to confirm, but today the bell and the Business page's list of things to check only count what the evidence draft proposed. Should they also show answers saved from a brainstorm?

## The decision, in plain words

I stored the answer as proposed and left the bell and the list to check as they are, so a saved answer does not show there yet. It still counts for nothing until someone confirms it.

## The intro, for fun

Someone left a note on the fridge, but the fridge only reads notes signed by the evidence robot.

## The punchline, for fun

So the note waits politely until someone opens the door.

## The options, in plain words

A. Leave them off for now: answers stay proposed and invisible on the bell and the check list until a later change adds them.
B. Count and list them: the bell counts them and the Business page lists them to confirm or reject, like the evidence draft's.
C. Store them confirmed: skip the wait, an overrule saved as a claim is confirmed at once.

## What I had to decide

Whether proposed claims that came from an answer join the bell's count and the Business page's list to check, beside the evidence draft's.

## What I did meanwhile

Answered claims are stored proposed with their receipt; agents never read them, and the bell count and the check list still only hold evidence and faded claims.

## What it costs to change later

One change to the count function in a new migration and one filter on the Business page's check list; no stored row changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the bell already counts a saved answer, but the bell and the page only count proposed evidence claims today; the page is outside this slice's ground.

```

<!-- /omni-outbox-settled: s1-01-answered-claims-not-yet-on-the-check-list -->

<!-- omni-outbox-settled: s1-02-an-answer-opens-the-business -->

## s1-02-an-answer-opens-the-business — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-an-answer-opens-the-business
prd: 822
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When someone answers a question about the business in a workspace where nobody has opened the Business page yet, should the answer be saved anyway, or dropped?

## The decision, in plain words

The answer opens the workspace's business, exactly as visiting the Business page would, and is saved there, so no answer is lost.

## The intro, for fun

The first guest arrived before anyone had unlocked the shop.

## The punchline, for fun

So the guest was handed the keys, politely.

## The options, in plain words

A. Open it and save: the answer opens the business, as a visit to the page would, and is stored.
B. Refuse and skip: the answer is not saved, and the terminal prints one skip line saying the workspace has no business yet.

## What I had to decide

Whether saving an answered claim may open a workspace's business on its own, or is refused until a member opens the Business page.

## What I did meanwhile

Saving an answer opens the business (named after the workspace, with its first product) when it has none, then stores the claim.

## What it costs to change later

A one-line change in a follow-up migration to refuse instead; a business opened this way is the same as one a person opened.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what happens to an answer in a workspace with no business yet.

```

<!-- /omni-outbox-settled: s1-02-an-answer-opens-the-business -->
