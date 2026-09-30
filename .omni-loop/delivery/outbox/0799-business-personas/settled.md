# Settled outbox items — PRD 799

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-persona-undo-keeps-the-row -->

## s1-01-persona-undo-keeps-the-row — adopted

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
id: s1-01-persona-undo-keeps-the-row
prd: 799
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When someone deletes a persona, should it be erased for good straight away, or kept out of sight so Undo can bring back exactly the same persona?

## The decision, in plain words

A deleted persona disappears for everyone at once, but it is kept out of sight so Undo brings it back as it was, in the same place in the list. Nothing erases it for good yet.

## The intro, for fun

Every cast has an actor who storms off the set and comes back five seconds later.

## The punchline, for fun

So the dressing room stays unlocked, just in case.

## The options, in plain words

A. Keep it hidden: Delete hides it, Undo shows it again, same place in the list. Hidden rows stay until a later cleanup.
B. Erase at once: Delete erases it; Undo adds it back from what the page still holds, at the end of the list.
C. Keep it hidden for a while: As the first, plus a daily job erasing personas hidden for more than a set time.

## What I had to decide

Whether a deleted persona is kept out of sight (Undo brings it back) or erased at once (Undo re-creates it from the page's copy).

## What I did meanwhile

Deleted personas are hidden from everyone, agents included, and kept in the database.

## What it costs to change later

Switching to erase-at-once is one follow-up change to the delete and restore functions and a cleanup of the hidden rows; no page or agent changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No rule yet on how long a hidden persona is kept before it is erased for good (author).

```

<!-- /omni-outbox-settled: s1-01-persona-undo-keeps-the-row -->

<!-- omni-outbox-settled: s1-02-business-check-reads-personas -->

## s1-02-business-check-reads-personas — adopted

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
id: s1-02-business-check-reads-personas
prd: 799
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Should agents get an empty list of personas even for a workspace with no business yet, which meant changing one line of the older business proof?

## The decision, in plain words

The answer always carries the personas list, empty when there is none, so agents never have to guess. The older business proof was updated by one line to expect it.

## The intro, for fun

The old proof knew the answer by heart, and the answer grew a new line.

## The punchline, for fun

One line of homework, and it is back to top of the class.

## The options, in plain words

A. Always carry the list: every answer has personas, empty when none; the business proof changes by one line.
B. Leave it out when there is no business: the proof stays untouched, and the app and the kit fill in an empty list themselves.

## What I had to decide

Whether the answer for a workspace with no business carries an empty personas list, and so whether the business proof may change by that one line.

## What I did meanwhile

Every answer carries personas; the business proof expects the empty list.

## What it costs to change later

Dropping the list from that one answer is a one-line change in the database read and the same one line back in the proof.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says [] when there are none, and does not say whether a workspace with no business counts (author).

```

<!-- /omni-outbox-settled: s1-02-business-check-reads-personas -->

<!-- omni-outbox-settled: s2-01-trade-ids-one-word -->

## s2-01-trade-ids-one-word — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-trade-ids-one-word
prd: 799
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Three trades have two-word names (heating engineer, site foreman, office manager). What short word is stored for each?

## The decision, in plain words

Each trade is stored as one plain lower-case word (heating, foreman, office) while the page shows the full name, so the database check accepts every trade whatever its exact rule.

## The intro, for fun

Some trades needed two words, but the database only takes one.

## The punchline, for fun

So the heating engineer now answers to heating, and the page still says the full name.

## The options, in plain words

A. One word per trade (heating, foreman, office), with the full name as the label.
B. Dashed words (heating-engineer, site-foreman, office-manager), with the database check accepting dashes.

## What I had to decide

Whether stored trades may be two words joined by a dash instead of one word.

## What I did meanwhile

Stored trades are single words; labels carry the full names.

## What it costs to change later

A constant change in the design package before any persona is stored; after that, renaming a stored trade needs a data update.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan says only that a trade is a short lower-case word; the database rule itself is written in s1, built in parallel, so its exact pattern was not known. (author)

```

<!-- /omni-outbox-settled: s2-01-trade-ids-one-word -->
