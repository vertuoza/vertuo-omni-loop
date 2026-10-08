# Settled outbox items — PRD 1217

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-outbox-entry-text -->

## s1-01-outbox-entry-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-outbox-entry-text
prd: 1217
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

An item in the list of decisions waiting for a person has no title of its own. What words should stand for it in the roadmap's human work list?

## The decision, in plain words

Its question in plain words, as the person answering reads it on the pull request. When an item has none, its plain decision is shown, then what it had to decide.

## The intro, for fun

The spec asked for each item's title, and the items never had one.

## The punchline, for fun

So the plain question stepped in, since it was written for people anyway.

## The options, in plain words

A. A. The plain question, then the plain decision, then what it had to decide (the option built).
B. B. The plain decision first, saying what was done rather than what is asked.
C. C. Add a title field to outbox items, which the spec puts out of scope.

## What I had to decide

Which part of an outbox item becomes the text of its human work entry, since items carry no title.

## What I did meanwhile

outboxWork in kit/lib/roadmap/human-work.ts uses the item's 'The question, in plain words', falling back to 'The decision, in plain words', then 'What I had to decide', then the item id, flattened onto one line. The rule-kind words also match their plural (secrets, tokens, permissions, deploys).

## What it costs to change later

One function of the kit: the next push refreshes every open entry's text, and nothing stored needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'the item's title', and an outbox item has no title section or field; the plain question is the closest reading
- (author) The spec says the rule words match whole; whether a plural counts as the whole word was not said

```

<!-- /omni-outbox-settled: s1-01-outbox-entry-text -->

<!-- omni-outbox-settled: s1-02-question-prd -->

## s1-02-question-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-question-prd
prd: 1217
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

A roadmap question waiting for a person may hold up several of its PRDs, or none. Which PRD should the human work list show it under?

## The decision, in plain words

The first PRD the question holds up, in the order the roadmap names them. A question that holds up no PRD is shown with no PRD at all.

## The intro, for fun

One question can hold up three PRDs, and the list only has room for one name.

## The punchline, for fun

The first one in line gets the credit, and a free-floating question gets none.

## The options, in plain words

A. A. The first PRD it holds up, or none (the option built).
B. B. Always none for a question: it belongs to the roadmap, not a PRD.
C. C. One entry per PRD it holds up, each with its own key.

## What I had to decide

Which PRD number a question entry carries, since a roadmap question blocks a list of rows, possibly empty.

## What I did meanwhile

questionWork sets prd to the PRD of the first row in the question's blocks that is a row of the roadmap, and null when it blocks none. The app's slice s2 must accept a null prd on a question entry.

## What it costs to change later

One line of the kit; the app may show the PRD differently without any stored change, since the push refreshes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's entry shape has a prd field for every source but does not say which PRD a roadmap question carries
- (author) Whether slice s2's route accepts a null prd was not known when this was built: the two slices run in parallel

```

<!-- /omni-outbox-settled: s1-02-question-prd -->

<!-- omni-outbox-settled: s1-03-partial-read-sends-none -->

## s1-03-partial-read-sends-none — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-partial-read-sends-none
prd: 1217
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When the code host answers only part of what the roadmap push reads, should the push still send the human work it did read?

## The decision, in plain words

No: when any part cannot be read, the push sends no human work at all, so nothing is wrongly marked done. The rest of the roadmap is still sent as before.

## The intro, for fun

Half a list looks a lot like a list where half the work got done.

## The punchline, for fun

So when a read hiccups, the list keeps its last good copy instead of guessing.

## The options, in plain words

A. A. Send no human work when any read fails (the option built).
B. B. Send what was read, and let a missing key close until the next push reopens it.
C. C. Fail the whole push as unreachable.

## What I had to decide

What omni roadmap push sends as humanWork when one of its reads of comments or of a feature branch's outbox fails.

## What I did meanwhile

readRoadmapPrds returns prdWork null on any failure while reading human work, and roadmapPushBody then leaves the humanWork field out, which the spec says closes nothing. In a plan repository, outbox items are read from the plan repository's own feature branch, where every target slice's items are relayed, and each is named by its slice's repository from the plan.

## What it costs to change later

A few lines of the push: sending what was read instead is one branch, and nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a push without the field closes nothing but not what to do when a read fails part way
- (author) The spec says each target's outbox in a plan repository; items of a target slice are relayed into the plan repository's outbox, so the targets' own branches are not read

```

<!-- /omni-outbox-settled: s1-03-partial-read-sends-none -->

<!-- omni-outbox-settled: s2-01-human-work-entry-limits -->

## s2-01-human-work-entry-limits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-human-work-entry-limits
prd: 1217
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The spec does not say how big a piece of human work may be, whether every piece must name a PRD and a link, or what an empty list from the kit means. What should the app accept?

## The decision, in plain words

A roadmap question may have no PRD and any piece may have no link; a text holds up to a thousand characters, the act a person must do up to four thousand, and a push up to five hundred pieces. An empty list means nothing is waiting any more, so every open piece is marked done.

## The intro, for fun

Every inbox needs a size limit, even the one for jobs only a person can do.

## The punchline, for fun

Five hundred chores per roadmap is a lot of chores, and a sign to stop adding them.

## The options, in plain words

A. Keep these limits, with PRD and link optional and an empty list closing everything, as built.
B. Require a PRD and a link on every piece, so a roadmap question must point at one.
C. Treat an empty list like no list at all, so only a kit that sends pieces can close any.

## What I had to decide

The limits and optional fields of a human work entry, and whether an empty list closes every open entry.

## What I did meanwhile

prd and url are nullable (a roadmap question belongs to no PRD); text <= 1000, act <= 4000, at most 500 entries, a key used twice refused; `humanWork: []` marks every open key done, while a missing or null field closes nothing.

## What it costs to change later

A constant: the limits are check constraints and zod bounds, changed by a migration that only widens them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a question's link should be the roadmap issue, which the kit decides in s1 (author)

```

<!-- /omni-outbox-settled: s2-01-human-work-entry-limits -->

<!-- omni-outbox-settled: s2-02-database-types-outside-territory -->

## s2-02-database-types-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-database-types-outside-territory
prd: 1217
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The new table changes the list of database types the app keeps beside its migrations, a file the plan did not give this slice. Should the slice refresh it?

## The decision, in plain words

The slice refreshed that list from the new migration, because the database check fails on any pull request where the list and the migrations disagree.

## The intro, for fun

A new table walked in, and the guest list at the door had to learn its name.

## The punchline, for fun

Nobody wants a bouncer turning away the table it was built for.

## The options, in plain words

A. Refresh the list in the slice that adds the migration, as done.
B. Leave the list alone in the slice and refresh it in a follow-up, letting the database check fail until then.
C. Add the list to the plan's territory for every slice that adds a migration, from the next plan on.

## What I had to decide

Whether the generated database types may be refreshed by the slice that adds a migration, though the plan left them out of its territory.

## What I did meanwhile

supabase/database.types.ts is regenerated with `node scripts/supabase-types.ts` against a local database with the new migration applied: only the roadmap_human_work table is added.

## What it costs to change later

A constant: the file is generated, so any other answer is a regeneration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the list should become a generated entry of the config, rebuilt by the wave like the kit bundle (author)

```

<!-- /omni-outbox-settled: s2-02-database-types-outside-territory -->

<!-- omni-outbox-settled: s3-01-territory-tests-and-types -->

## s3-01-territory-tests-and-types — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-territory-tests-and-types
prd: 1217
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Adding the new sorting setting changes a few files the plan did not list for this part of the work. May it touch them?

## The decision, in plain words

Yes. Two existing tests that count the settings now count one more, and the database's type file gains the new column and the two new database calls, as the database itself now has them.

## The intro, for fun

The plan drew a neat fence around this slice, and two tests stood just outside it.

## The punchline, for fun

They counted five settings, and there are six now, so they had to learn to count.

## The options, in plain words

A. Change the two tests and the types file in this slice (built).
B. Leave them to a follow-up slice, with the settings tests red until then.

## What I had to decide

Whether this slice may change apps/galaxy/src/jev/settings/render.test.ts, apps/galaxy/src/jev/decisions/question-category.test.ts and supabase/database.types.ts, outside its territory.

## What I did meanwhile

Both tests list the six decisions instead of five, and the settings page test checks hitl-category shows Off by default with what it sends. supabase/database.types.ts is edited by hand as `supabase gen types` would write it (the classified_at column, roadmap_human_work_claim and roadmap_human_work_set_kind); CI's types check confirms it.

## What it costs to change later

Low: these are a list in two tests and generated types; another slice owning them would make the same edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The types file was edited by hand, not generated: the supabase CLI was not available here, so CI's types check is the first to compare it (author).

```

<!-- /omni-outbox-settled: s3-01-territory-tests-and-types -->

<!-- omni-outbox-settled: s3-02-offered-once-even-off -->

## s3-02-offered-once-even-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-offered-once-even-off
prd: 1217
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the automatic sorting is switched off and a new piece of human work arrives, should it be sorted later if someone switches the sorting on?

## The decision, in plain words

No: each new piece is looked at once, when it first arrives, whatever the setting is then. Pieces that arrived while the sorting was off, and those already stored, keep the kind the simple rules gave them.

## The intro, for fun

The spec says each new piece is sorted once, and is silent on pieces that arrived while sorting was off.

## The punchline, for fun

Once means once, so switching it on later does not reopen the old ones.

## The options, in plain words

A. Offer each key once, at its first push, whatever the mode is then; the backlog keeps the rule kind (built).
B. Offer only while the decision is Shadow or On; keys stored while Off are offered the first push after it is turned on.
C. Offer the open keys again whenever the decision is turned On, once per switch.

## What I had to decide

Whether switching the Jev decision On later sorts the pieces that arrived while it was Off, or only the ones that arrive from then on.

## What I did meanwhile

Every key is marked offered the first time a push stores it, Off included; turning hitl-category On only sorts keys first stored after that. The rows stored before the migration count as offered. A key the time budget of one push did not reach is offered after the next push.

## What it costs to change later

Low: offering the backlog instead is one migration that clears the offered mark on the rule-kind keys, and nothing else changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a new key is classified once but not what turning the decision On does to keys stored while it was Off (author).

```

<!-- /omni-outbox-settled: s3-02-offered-once-even-off -->
