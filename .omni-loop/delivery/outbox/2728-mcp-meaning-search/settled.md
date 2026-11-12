# Settled outbox items — PRD 2728

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-law-home-reexports-kit-builder -->

## s1-01-law-home-reexports-kit-builder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-law-home-reexports-kit-builder
prd: 2728
slice: s1
rank: medium
bears-on: none
raised: 2026-11-12
wave: 1
---

## The question, in plain words

The code that reads a product's business laws had to move into the shared kit so the App can use it too. That took a small edit to a file outside this step's list; is that fine?

## The decision, in plain words

The galaxy file now takes the function from the kit and hands it on under the same name, so every caller keeps working and no logic was copied.

## The intro, for fun

A function packed its bags for the kit and left a forwarding address.

## The punchline, for fun

Mail still arrives; only the street changed.

## The options, in plain words

A. A. Move the function to the kit and let the old place hand it on (built).
B. B. Keep one copy in the kit and one in galaxy, and let the duplication count grow.

## What I had to decide

Moved lawsOfPackFiles to kit/lib/knowledge/entries.ts (the kit builder needs it, and the App's embed job in s4 cannot import galaxy). apps/galaxy/src/business-laws/law-home.ts, outside s1's territory, now imports and re-exports it: three lines, behaviour unchanged. The alternative, a copy in the kit, fails the repository's duplication audit.

## What I did meanwhile

Callers of law-home keep importing lawsOfPackFiles from it; nothing else changes.

## What it costs to change later

One small edit outside the listed paths; undone by moving the function back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of the territory minds the three-line edit to law-home.ts (author)

```

<!-- /omni-outbox-settled: s1-01-law-home-reexports-kit-builder -->

<!-- omni-outbox-settled: s2-01-vectors-forget-daily -->

## s2-01-vectors-forget-daily — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-vectors-forget-daily
prd: 2728
slice: s2
rank: medium
bears-on: none
raised: 2026-11-12
wave: 1
---

## The question, in plain words

The spec says knowledge vectors nobody used for 90 days are deleted, but not what triggers the deletion. Should the database run it by itself every day?

## The decision, in plain words

The database runs the clean-up by itself once a day, at night, the same way it already expires old ask sessions. Nobody has to remember to run it.

## The intro, for fun

Ninety days of silence and a vector packs its bags.

## The punchline, for fun

Someone has to hold the door open, so the database does it nightly.

## The options, in plain words

A. A. A pg_cron job runs knowledge_vectors_forget() every day, as ask_expire() is run today.
B. B. The App's job ledger runs it as a scheduled job, so a failure shows on the ledger's health check.
C. C. Nothing runs it on a schedule; a person runs it when needed.

## What I had to decide

Keep the nightly clean-up (A), or have the App's job ledger run it instead (B), or run it by hand only (C).

## What I did meanwhile

Every night at 03:43 UTC the database deletes the vectors unused for 90 days; a search or a job using a vector keeps it.

## What it costs to change later

Changing it is one follow-up migration that unschedules the job (and, for B, one job kind in the App).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A failed nightly run is seen only in cron.job_run_details, not on the job ledger's health check (author).

```

<!-- /omni-outbox-settled: s2-01-vectors-forget-daily -->
