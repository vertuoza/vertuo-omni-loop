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

<!-- omni-outbox-settled: s3-01-new-persona-starts-neutral-builder -->

## s3-01-new-persona-starts-neutral-builder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-new-persona-starts-neutral-builder
prd: 799
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When someone adds a persona, which stance and which trade should the form start on before they pick?

## The decision, in plain words

A new persona starts neutral, as a builder, on a portrait picked at random. The person changes any of them before saving.

## The intro, for fun

Every new face walks onto the stage in someone's work clothes.

## The punchline, for fun

Today the wardrobe hands out hard hats, and a calm expression.

## The options, in plain words

A. Neutral builder: stance neutral, the first trade, a random portrait.
B. Nothing chosen: no stance and no trade until the person picks, and Save waits for both.
C. Random trade too: stance neutral, a trade picked at random, a random portrait.

## What I had to decide

The stance and trade a new persona's form starts on.

## What I did meanwhile

Stance neutral, trade builder (the first trade of the list), portrait random for that trade.

## What it costs to change later

One constant in the page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only that the portrait starts random; it does not say which stance or trade a new persona starts on (author).

```

<!-- /omni-outbox-settled: s3-01-new-persona-starts-neutral-builder -->

<!-- omni-outbox-settled: s3-02-unknown-trade-kept-on-edit -->

## s3-02-unknown-trade-kept-on-edit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-unknown-trade-kept-on-edit
prd: 799
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

A persona could be stored with a trade the page has no drawing for, for example through the import. What should its card and form show?

## The decision, in plain words

Its card shows an empty portrait square and the trade's word as stored. Editing it keeps that trade as the first choice of the list, so saving never changes it without asking.

## The intro, for fun

One guest arrived in a costume the wardrobe has never seen.

## The punchline, for fun

So they keep their own outfit, and the photographer leaves the frame empty.

## The options, in plain words

A. Keep it: empty portrait, the stored word shown and kept as a choice while editing.
B. Hide it: such personas do not show on the page at all until the page can draw their trade.
C. Force a pick: show it, but the drawer asks for one of the drawable trades before saving.

## What I had to decide

How a persona whose trade the page cannot draw shows on its card and in the drawer.

## What I did meanwhile

An empty portrait square, the stored word as its trade, and that word kept as an extra choice in the trade list while editing.

## What it costs to change later

A small change in the page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the page shows only trades it can draw, and does not say what happens to a stored persona whose trade it cannot (author).

```

<!-- /omni-outbox-settled: s3-02-unknown-trade-kept-on-edit -->

<!-- omni-outbox-settled: s4-01-import-all-or-none-by-checking-first -->

## s4-01-import-all-or-none-by-checking-first — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-import-all-or-none-by-checking-first
prd: 799
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The import must add all the personas of a file or none of them. How is that kept when the database adds them one at a time?

## The decision, in plain words

Every row is checked before anything is written, so a bad file writes nothing. If the connection fails halfway, running the import again adds only the missing personas, because a persona whose name is already on its product is left alone.

## The intro, for fun

All or nothing sounds simple until the database takes one persona at a time.

## The punchline, for fun

So the import checks everything first, and a second run just finishes the job.

## The options, in plain words

A. A. Check every row first, add one by one, skip a name already on the product so a rerun completes.
B. B. Add a database function that adds the whole file in one transaction.
C. C. Check first and add one by one, but add every row again on a rerun, even a same name.

## What I had to decide

Whether all-or-none needs one database transaction for the whole file, or whether checking every row first plus a safe rerun is enough.

## What I did meanwhile

The import checks every row as the database does, then adds them one by one; a persona already on its product under the same name is skipped, so a rerun never adds it twice.

## What it costs to change later

A constant change in the import script; a true single transaction would need a new database function, a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says all or none but the database offers one add per persona; a one-call bulk add was outside this slice's territory. (author)
- Whether two personas may share a name on one product is not settled; the import treats a same name as the same persona. (author)

```

<!-- /omni-outbox-settled: s4-01-import-all-or-none-by-checking-first -->

<!-- omni-outbox-settled: s4-02-import-row-leaves-out-avatar-and-product -->

## s4-02-import-row-leaves-out-avatar-and-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-import-row-leaves-out-avatar-and-product
prd: 799
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Must the file spell out every persona's portrait numbers and product, and may it name a trade the page cannot draw?

## The decision, in plain words

A row may leave out its portrait, and one is picked for it the same way every time; with one product, it may leave out the product too. The trade must be one the page can draw.

## The intro, for fun

Nobody wants to type five portrait numbers per persona by hand.

## The punchline, for fun

So the import picks a face for you, and only trades the page can actually draw get in.

## The options, in plain words

A. A. Portrait and product optional (one product only), trade limited to the drawable ones.
B. B. Every field required in every row.
C. C. Portrait optional, and any short lower-case trade the database accepts.

## What I had to decide

Whether the portrait and the product are required in every row, and whether the trade is limited to the ones the page draws.

## What I did meanwhile

A missing portrait is picked from the product and the name; a missing product means the only product; a trade outside the drawable list refuses the file.

## What it costs to change later

A constant change in the import script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the portrait among the checked fields but does not say whether a file must carry it. (author)

```

<!-- /omni-outbox-settled: s4-02-import-row-leaves-out-avatar-and-product -->
