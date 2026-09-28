# Settled outbox items — PRD 384

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-version-picker-keeps-every-tab -->

## s1-01-version-picker-keeps-every-tab — adopted

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
id: s1-01-version-picker-keeps-every-tab
prd: 384
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Once the PRD page opens on Questions, picking an older version of the before-and-after page sent the reader to Questions instead. Should the version choice always remember which tab it came from?

## The decision, in plain words

Yes: picking a version now always keeps the tab you were on, the before-and-after tab included, so the address gains a tab mention it did not carry before.

## The intro, for fun

The page grew a new front door, and the old side door started leading to the wrong room.

## The punchline, for fun

So now every door says which room it opens.

## The options, in plain words

A. Always carry the tab: what was built; the picker names its tab every time, so it can never land on the wrong one.
B. Carry it except on the default tab: a cleaner address, but the picker would need to know the page's default, which now depends on whether a question was asked.
C. Leave the picker as it was: no change outside the slice, but picking a version of the before-and-after page on a PRD with questions lands on Questions.

## What I had to decide

Whether the version picker, which sits outside this slice's declared files, may carry the tab on every tab.

## What I did meanwhile

The picker always names its tab; a version picked on the before-and-after tab stays there.

## What it costs to change later

One line in the version picker; undoing it is putting the old condition back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The version picker file is not in slice s1's declared territory; no sibling slice declares it either (author).

```

<!-- /omni-outbox-settled: s1-01-version-picker-keeps-every-tab -->

<!-- omni-outbox-settled: s5-01-moved-round-refresh -->

## s5-01-moved-round-refresh — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-moved-round-refresh
prd: 384
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a question moves to the terminal without an answer, should the open PRD page notice that change on its own?

## The decision, in plain words

The page watches only what the spec named: how many questions, how many answered, and the latest version of each document. A question moving to the terminal changes none of these, so the page shows it on the next other change or reload.

## The intro, for fun

A question slipped out the back door to the terminal, and nobody rang the bell.

## The punchline, for fun

The page will spot it the next time anything else happens, or on a reload.

## The options, in plain words

A. Watch only the three counts the spec named: questions asked, questions answered and the latest version of each document, with no database change. This is what is built.
B. Also count the questions moved to the terminal, which needs a small database change, so a move shows on an open page within two seconds.

## What I had to decide

Whether the change check should also count questions moved to the terminal.

## What I did meanwhile

A question that moves to the terminal still reads as open on a page left open, until the next question, answer, version or reload.

## What it costs to change later

Counting moved questions means adding one count to the database's list function, which is a migration; the page side is one field in the signature.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people leave a PRD page open long enough, while questions time out, for a stale open question to matter (author)

```

<!-- /omni-outbox-settled: s5-01-moved-round-refresh -->
