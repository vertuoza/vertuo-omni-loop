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

<!-- omni-outbox-settled: s3-01-edge-function-test-and-entry -->

## s3-01-edge-function-test-and-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-edge-function-test-and-entry
prd: 2728
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The new embed function's tests and its starting file sit in a folder the test runner and the unused-code audit did not know about. Should those two tools be told about that folder, though the plan did not list their settings for this slice?

## The decision, in plain words

Yes: one line tells the test runner to run the function's tests, and one line tells the unused-code audit that the function's starting file is started by Supabase, not imported by other code.

## The intro, for fun

A brand new folder showed up, and two tools had never heard of it.

## The punchline, for fun

Two short introductions later, everyone is on speaking terms.

## The options, in plain words

A. A. Tell the test runner and the unused-code audit about the new function's folder, two lines in all (built).
B. B. Leave both settings alone, so the function's tests never run and the audit calls its starting file unused.
C. C. Move the function's logic and tests into the kit's folder, leaving only its starting file with Supabase.

## What I had to decide

Keep the two lines (A), or move the function's tests elsewhere and leave the settings as they were (B).

## What I did meanwhile

The function's tests run in the preflight, and the audit counts its starting file as used.

## What it costs to change later

Undoing it is deleting two lines in two settings files; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave this slice the function's folder, the database settings and the database workflow, not the test runner's or the audit's settings (author).

```

<!-- /omni-outbox-settled: s3-01-edge-function-test-and-entry -->

<!-- omni-outbox-settled: s3-02-embed-checks-its-own-key -->

## s3-02-embed-checks-its-own-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-embed-checks-its-own-key
prd: 2728
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The spec had Supabase's gateway check every caller's token, but the newer server keys are not tokens of that kind, so every call would be refused. Should the embed function check the caller's key itself instead?

## The decision, in plain words

Yes: the gateway check is off, and the function lets a caller in only when it presents one of the project's own server keys, old or new style, compared so that timing reveals nothing. The job and the search call it as before, with no change on their side.

## The intro, for fun

The doorman only reads one kind of badge, and the staff just got new badges.

## The punchline, for fun

So the function now checks badges itself, both kinds, at the same door.

## The options, in plain words

A. A. The function checks the caller's server key itself, old or new style, with the gateway check off (built).
B. B. The gateway checks tokens as the spec wrote, and every caller must hold the old-style service key.
C. C. Both: the gateway check on, and the function also compares the key, which still refuses the new keys.

## What I had to decide

Keep the function's own key check with the gateway check off (A), or turn the gateway check back on and require the old-style key everywhere (B).

## What I did meanwhile

The function answers the old-style service key and every new-style secret key the project holds, and refuses everyone else before reading anything.

## What it costs to change later

Going back is one setting and a few lines in the function; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which kind of server key production holds today is not known here; the function accepts both, so either works (author).

```

<!-- /omni-outbox-settled: s3-02-embed-checks-its-own-key -->

<!-- omni-outbox-settled: s4-01-embed-job-runs-again-when-out-of-time -->

## s4-01-embed-job-runs-again-when-out-of-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-embed-job-runs-again-when-out-of-time
prd: 2728
slice: s4
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

A very large knowledge base can take longer to read into the meaning search than one background run is allowed. What should happen then?

## The decision, in plain words

The background run stops after about two and a half minutes, keeps everything it already finished, and comes back a minute later to carry on with what is left.

## The intro, for fun

Two thousand rules walk into a background job with four minutes on the clock.

## The punchline, for fun

It takes a breather, keeps its place, and finishes the rest after a short coffee.

## The options, in plain words

A. A. Stop after about 150 seconds, keep what is done, and run again a minute later (built).
B. B. Embed the whole pack in one run, and let the ledger retry it when the run is cut off.
C. C. Split the pack into one job per batch of 64 from the start.

## What I had to decide

Whether a large pack is embedded over several short runs (as built), or the run is given more time.

## What I did meanwhile

A pack of a few hundred entries finishes in one run; only a pack of thousands takes a second or third run, a minute apart.

## What it costs to change later

Changing it is one constant (the run's time budget) in the embed job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The 150-second budget is a guess under the worker's 240 seconds; the real speed of the model per batch is not measured yet.

```

<!-- /omni-outbox-settled: s4-01-embed-job-runs-again-when-out-of-time -->

<!-- omni-outbox-settled: s4-02-embed-job-reads-live-products-rows-directly -->

## s4-02-embed-job-reads-live-products-rows-directly — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-embed-job-reads-live-products-rows-directly
prd: 2728
slice: s4
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

To prepare a product's legal entries, terms and never lines for the meaning search, the background job must read them. Which products count, and where does it read them from?

## The decision, in plain words

It reads them straight from where the product keeps them, for every product that holds the repository and is not archived, and leaves out who owns each legal entry.

## The intro, for fun

An archived product is like a closed shop: the lights are off, so nobody restocks the shelves.

## The punchline, for fun

If it reopens, the next merge stocks it again by itself.

## The options, in plain words

A. A. Read the rows of live products straight from their tables, with no owner (built).
B. B. Include archived products too.
C. C. Add a database function for the service role that answers a repository's products and their rows, and read through it.

## What I had to decide

Whether archived products are skipped (as built) and whether the job reads the product's rows directly, as the MCP reads its never lines, rather than through one database function.

## What I did meanwhile

The MCP of an archived product does not answer, so nothing is lost; an unarchived product's rows are embedded at its next pack, or by the search itself.

## What it costs to change later

Including archived products is one filter removed; reading through a database function is one new function and a swap of the store's reads.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The function the MCP reads these rows through is closed to the service role, so the job reads the same tables with the same filters instead.

```

<!-- /omni-outbox-settled: s4-02-embed-job-reads-live-products-rows-directly -->

<!-- omni-outbox-settled: s5-01-meaning-total-counts-every-ranked-entry -->

## s5-01-meaning-total-counts-every-ranked-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-12
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-meaning-total-counts-every-ranked-entry
prd: 2728
slice: s5
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

When the search ranks by meaning, every entry that has a meaning summary gets a place in the order, so the count the answer gives is close to the size of the whole knowledge. Should the count instead say how many entries are close enough to count as a match?

## The decision, in plain words

The count says how many entries were ranked, as the spec words it, so with meaning it is nearly every entry of the product; agents read the first hits, not the count.

## The intro, for fun

Ask for one law, and the answer says two thousand entries came along for the ride.

## The punchline, for fun

Everything is a little bit relevant, if you squint hard enough.

## The options, in plain words

A. A. The count is every entry ranked, exact, by meaning and by words (as built).
B. B. Only entries within a closeness threshold are ranked by meaning; the count then means close matches.
C. C. Keep the order, and make the count the word matches only, as before.

## What I had to decide

Keep the count as every entry ranked (A), or cut the meaning ranking at a closeness threshold so the count means matches (B).

## What I did meanwhile

Searches by meaning answer a count near the product's size; the hits and their order are unaffected.

## What it costs to change later

B is one threshold constant in the ranking and a test; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No threshold was measured: the spike scored ranks, not distances (author).

```

<!-- /omni-outbox-settled: s5-01-meaning-total-counts-every-ranked-entry -->
