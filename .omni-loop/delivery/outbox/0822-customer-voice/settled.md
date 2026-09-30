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

<!-- omni-outbox-settled: s2-01-voice-tab-name-set-early -->

## s2-01-voice-tab-name-set-early — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-voice-tab-name-set-early
prd: 822
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Adding the voice record to the PRD page's list of documents forced the page to know its tab name and empty line before the tab itself is built. Should this step set them now?

## The decision, in plain words

It set the tab name to User voice and the empty line to the spec's own words, and shows no tab yet. The next step builds the tab itself and can change both.

## The intro, for fun

The page wanted a name for a tab that does not exist yet.

## The punchline, for fun

So it got a name tag before it got a room.

## The options, in plain words

A. Set both strings now, outside this slice's territory, taken from the spec's words (built).
B. Keep the page untouched and leave the type check red until the tab slice lands.
C. Keep voice out of the page's artifact kinds with a second list of stored kinds, merged later by the tab slice.

## What I had to decide

Whether the tab's name and empty line may be set by the step that adds the record, ahead of the step that builds the tab.

## What I did meanwhile

The label 'User voice' and the empty line from the spec sit in the page's two lookup tables (DossierPage.tsx EMPTY, view.ts TAB_LABELS); no tab lists voice yet, so nothing changes on screen.

## What it costs to change later

Two strings; the tab slice s3 may reword or move them for the price of a constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the words are the spec's own (author).

```

<!-- /omni-outbox-settled: s2-01-voice-tab-name-set-early -->

<!-- omni-outbox-settled: s2-02-a-silent-round-has-no-objection -->

## s2-02-a-silent-round-has-no-objection — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-a-silent-round-has-no-objection
prd: 822
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When every persona is happy with a stage, nobody objects. How should the voice record say that a round had no objection at all?

## The decision, in plain words

A round where nobody objected keeps an empty objection and may leave its fit line empty too. The settled value none is kept for an objection that was raised but never answered.

## The intro, for fun

Sometimes the whole panel nods along and nobody grumbles.

## The punchline, for fun

The record now knows the difference between silence and a shrug.

## The options, in plain words

A. Objection null when nobody objected; settled none for an objection left unanswered (built).
B. Always an objection; settled none also means nobody objected, with empty text.
C. Leave the objection out of the round entirely when nobody objected.

## What I had to decide

Whether a round with no objection is an empty objection, or an objection whose settlement is none.

## What I did meanwhile

voice.json accepts objection null and fit null; settled none means an objection raised with no answer. The skills in s4 and the tab in s3 read it this way.

## What it costs to change later

A rule in the voice schema and its readers; changing it is a constant, since no voice.json exists yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists none among the settlements without saying whether it also means no objection (author).

```

<!-- /omni-outbox-settled: s2-02-a-silent-round-has-no-objection -->
