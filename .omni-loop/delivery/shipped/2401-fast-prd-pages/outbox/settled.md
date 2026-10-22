# Settled outbox items — PRD 2401

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-before-table-not-measured -->

## s1-01-before-table-not-measured — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-before-table-not-measured
prd: 2401
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

The table of how fast the two pages are today could not be taken here, because it needs a signed-in session cookie for production that this run does not hold. Who takes it, and when?

## The decision, in plain words

The measuring script is built and tested, but nobody has run it against production yet, so the sub-PR carries no before table.

## The intro, for fun

A stopwatch is only useful once somebody presses the button.

## The punchline, for fun

The button needs a cookie, and the cookie is not ours to hold.

## The options, in plain words

A. A. A person runs the script against production and posts the table on the feature PR before it merges.
B. B. Drop the before table and judge the result by the Server-Timing reads alone.

## What I had to decide

A person runs the measuring script against production on a checkout of this branch, before the feature PR merges, and pastes the table into the feature PR.

## What I did meanwhile

The other slices go on; the measurement reads the same production pages before any of them is deployed.

## What it costs to change later

Measuring after the first slices deploy would no longer be a before: the 50% target would have nothing honest to compare with.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The before table is not in this sub-PR's body (author).

```

<!-- /omni-outbox-settled: s1-01-before-table-not-measured -->

<!-- omni-outbox-settled: s1-02-timing-in-page-not-header -->

## s1-02-timing-in-page-not-header — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-timing-in-page-not-header
prd: 2401
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A page in this app cannot add a header to its answer once it has begun to stream, so the timing of each read could not be sent as the Server-Timing header the spec names. Should it stay in the page?

## The decision, in plain words

Each read's name and duration is said in a hidden element at the end of the page, in the same Server-Timing format, and the measuring script reads it from there.

## The intro, for fun

A header must leave before the first byte, and the timings only exist after the last.

## The punchline, for fun

So they ride at the back of the page, like a receipt.

## The options, in plain words

A. A. A hidden template at the end of the page holds the Server-Timing value; the script reads it (built).
B. B. A real Server-Timing header, with each page rendered whole by a route handler, which gives up streaming.

## What I had to decide

Keep the hidden element at the end of the page, or move the timings to a real Server-Timing header through a route handler that renders the page without streaming.

## What I did meanwhile

Both pages carry the hidden element and perf-prd.ts reads it; no visible change.

## What it costs to change later

A real header would need both routes to stop streaming, or a route handler in front of each page: a larger change that would slow the pages the PRD speeds up.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Vercel deployment passes a trailing header to the browser was not tried (author).

```

<!-- /omni-outbox-settled: s1-02-timing-in-page-not-header -->

<!-- omni-outbox-settled: s1-03-stream-takes-a-timing-prop -->

## s1-03-stream-takes-a-timing-prop — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-stream-takes-a-timing-prop
prd: 2401
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

To put the timings at the end of a PRD's page, the page's streaming wrapper, which the plan does not list for this slice, gained one optional slot. Is that change fine?

## The decision, in plain words

The streaming wrapper of a PRD's page takes an optional timing element and draws it after the page; nothing else about it changed.

## The intro, for fun

The wrapper had a seat for everything but the clock.

## The punchline, for fun

One optional seat later, the clock sits at the back.

## The options, in plain words

A. A. An optional timing slot on the streaming wrapper (built).
B. B. Return the wrapper and the timings side by side, and change the tests that read the route's shape.

## What I had to decide

Keep the optional slot in the streaming wrapper, or move the timings into a place inside this slice's own files, which the existing tests of the route's shape would need to follow.

## What I did meanwhile

The slot is empty everywhere but on a numbered PRD's page, so nothing else changes.

## What it costs to change later

Moving it means changing tests that read the route's result by its exact shape, in files that belong to no slice of this PRD either.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The streaming wrapper is outside the territory of s1 and of every other slice of the plan (author).

```

<!-- /omni-outbox-settled: s1-03-stream-takes-a-timing-prop -->

<!-- omni-outbox-settled: s2-01-s2-link-order-tests -->

## s2-01-s2-link-order-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-link-order-tests
prd: 2401
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Switching the PRD tabs to client links changed the order of their attributes in the page's HTML, so three older tests that read the tabs by their exact text broke. Should the slice have fixed those tests, which sit just outside its listed files?

## The decision, in plain words

The three tests (PR care, outbox and visual fix pages) were adjusted to read the same links in the new attribute order, with no change to what they check.

## The intro, for fun

A link moved one word to the left and three tests noticed.

## The punchline, for fun

Now they read the new order and agree again.

## The options, in plain words

A. A. Fix the three tests in this slice (as built).
B. B. Leave them red and let a person fix them in a separate change.

## What I had to decide

Territory widened by three test files, regex order only.

## What I did meanwhile

Nothing waits on this; the tests are green.

## What it costs to change later

None to undo: three one-line regex edits.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner wants test fixes outside the listed files in a slice (author)

```

<!-- /omni-outbox-settled: s2-01-s2-link-order-tests -->

<!-- omni-outbox-settled: s3-01-s3-outside-territory -->

## s3-01-s3-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-s3-outside-territory
prd: 2401
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The new database check, the renamed list function and the new database types needed three small edits in files the slice did not own. Is it fine that the slice made them?

## The decision, in plain words

The slice added the new check to the database workflow, updated the existing dossier check to the list function's new signature, and regenerated the database types, so every check stays green and the new one runs on every pull request.

## The intro, for fun

Three files sat just over the fence, and the slice reached across to tidy them.

## The punchline, for fun

Neighbourly, as long as the neighbour agrees.

## The options, in plain words

A. Keep the three edits in this slice: the conventions ask for the workflow step and the regenerated types in the change that needs them.
B. Move them to a slice of their own, and hold this one until it merges.

## What I had to decide

Keep the three edits (A), or move them to a slice of their own and leave this one red until it merges (B).

## What I did meanwhile

The edits are on the slice branch: the workflow runs the new check `supabase/checks/dossier_reads.sql`, `supabase/checks/dossiers.sql` names `dossier_list(uuid, uuid, text)`, and `supabase/database.types.ts` is what `node scripts/supabase-types.ts` wrote from the migrations.

## What it costs to change later

A: none. B: one more slice and a red supabase workflow on this sub-PR until it lands.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s3 names `supabase/checks/dossier_` but not `supabase/checks/dossiers.sql`, the workflow or the generated types, which every migration that changes a function's signature touches (author).

```

<!-- /omni-outbox-settled: s3-01-s3-outside-territory -->

<!-- omni-outbox-settled: s3-02-s3-repos-read-rounds -->

## s3-02-s3-repos-read-rounds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-s3-repos-read-rounds
prd: 2401
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The spec said the new small read for a PRD's repository chips would not look at the questions, yet it must show the repositories the questions were asked in, and the live refresh needs the question counts. Is it fine that it reads that one PRD's questions?

## The decision, in plain words

The new read looks at the questions of the one PRD it is asked about, no other, so the chips show the same repositories as before and the live refresh still notices a new question; it no longer numbers every version of the PRD, which it never needed.

## The intro, for fun

A read promised to skip the questions, then found the chips were made of questions.

## The punchline, for fun

It reads one PRD's questions now, not the whole workspace's.

## The options, in plain words

A. Read the one PRD's questions, so the chips and the live refresh stay exactly as before.
B. Read no question: the chips show only the home repository and the planet's regions, and the live refresh watches versions only.

## What I had to decide

Keep the read as built (A), or drop the questions' repositories from the chips and the question counts from the live refresh (B).

## What I did meanwhile

`dossier_repos(p_dossier)` matches the one dossier's rounds as `dossier_list()` does and returns its repositories, its rounds asked and answered, and its version count per kind; `supabase/checks/dossier_reads.sql` proves it equals `dossier_list(p_dossier)` for every dossier.

## What it costs to change later

A: none. B: a follow-up migration, and the page would miss new questions until it is reloaded.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's "joins no rounds" cannot hold together with "returns the same repositories dossier_list(p_dossier) did": a dossier's other repositories are its rounds' sessions' (author).

```

<!-- /omni-outbox-settled: s3-02-s3-repos-read-rounds -->

<!-- omni-outbox-settled: s3-03-s3-slice-count-in-database -->

## s3-03-s3-slice-count-in-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-s3-slice-count-in-database
prd: 2401
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Where should a plan's slice count be worked out when a plan version is saved: by the database itself, copying the kit's rule, or by the app before it saves?

## The decision, in plain words

The database counts the slices itself as each plan version is saved, following the same rule the kit uses, so every way a plan arrives (the terminal and the GitHub fallback) gets its count. A plan with no slice the kit can read is stored as none, so the page never downloads its text again; plans saved before this keep no count and are read as before.

## The intro, for fun

Counting slices sounds easy until two places must count them the same way.

## The punchline, for fun

Both counters agreed on every one of the repository's 225 plans.

## The options, in plain words

A. The database counts, as built: one rule for every way a plan arrives.
B. The app counts with the kit's own rule and sends the count with each push.

## What I had to decide

Keep the count in the database (A), or have the app count and send it with each push (B).

## What I did meanwhile

`plan_slice_count()` mirrors `parsePlanSlices()` of `kit/lib/inbox/territory.ts` and a trigger stores it in `dossier_versions.slices` on insert, 0 for none; `readPlanSlices` reads it and falls back to the body only when it is null. The two counts were compared on every plan.md of this repository: they agree.

## What it costs to change later

A: the rule lives twice, in the kit and in the database; a change to the kit's slice table needs the same change in a migration. B: a migration changing the push function, and the GitHub fallback would need its own count.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test ties the two rules together on every change: the check proves the database rule on its own cases, and the agreement on the repository's plans was measured once by hand (author).

```

<!-- /omni-outbox-settled: s3-03-s3-slice-count-in-database -->

<!-- omni-outbox-settled: s4-01-after-table-not-measured -->

## s4-01-after-table-not-measured — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-after-table-not-measured
prd: 2401
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The table of how fast the two pages are now, to set beside the one from before, could not be taken here, because it needs a signed-in session cookie for production that this run does not hold. Who takes it, and when?

## The decision, in plain words

The measuring script is ready, but nobody has run it against production after the changes, so the sub-PR carries no after table and the 50% target is not shown to be met.

## The intro, for fun

The stopwatch is back in the drawer and the cookie jar is locked.

## The punchline, for fun

Without the cookie, the race has no finish line.

## The options, in plain words

A. A. A person runs the script against the deployed feature and posts the after table on the feature PR before it merges.
B. B. Judge the result by the Server-Timing reads of the deployed pages alone, and drop the after table.

## What I had to decide

A person runs the measuring script against production once the feature is deployed to a preview or to production, with a session cookie of their own, and pastes the after table beside the before table on the feature PR.
Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

The slice's code is built and tested; the Server-Timing reads name each step, so a slow read can be found as soon as the pages are measured.

## What it costs to change later

Measuring later changes nothing in the code; the only risk is deploying before anyone has looked at the numbers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The after table is not in this sub-PR's body (author).

```

<!-- /omni-outbox-settled: s4-01-after-table-not-measured -->

<!-- omni-outbox-settled: s4-02-shell-one-boundary-no-part-skeletons -->

## s4-02-shell-one-boundary-no-part-skeletons — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-shell-one-boundary-no-part-skeletons
prd: 2401
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

A PRD's page now shows its frame before its approval, its send-to-terminal buttons and the runner that is fixing it are known, but the frame has no placeholder for those three parts, and they come in together rather than one by one. Should each part get its own placeholder and its own wait?

## The decision, in plain words

The page is sent first without the approval block, the send buttons and the fixing line, and the whole page is sent again with all three once they are read; an approval block is left out of the first frame instead of saying it could not be read.

## The intro, for fun

The stage is set and the actors are still in make-up.

## The punchline, for fun

A part that arrives late should at least leave a chair.

## The options, in plain words

A. A. One waiting place for the three late parts, the frame drawn without them (as built).
B. B. One waiting place and one placeholder for each of the three parts, in a follow-up slice that owns the page's files.

## What I had to decide

One waiting place for the three parts together, around the same page drawn without them, because the page's own file (DossierPage) and the stream's file are outside this slice's ground. A page change that draws a placeholder for each part, and one waiting place each, belongs to a slice that owns those files.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The frame, the tabs and the shown version reach the person as soon as the database has answered; the three parts follow in one piece.

## What it costs to change later

Moving to one waiting place per part changes the page's files and its render tests, not the reads: a day of work, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Each part with its own skeleton is not drawn: the files that draw the page are outside the slice's territory (author).

```

<!-- /omni-outbox-settled: s4-02-shell-one-boundary-no-part-skeletons -->

<!-- omni-outbox-settled: s4-03-outside-territory-runners-fake -->

## s4-03-outside-territory-runners-fake — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-outside-territory-runners-fake
prd: 2401
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

Reading several runners in one query added a method to the runners' storage, and the page's route now answers in a new shape, so the test double of the storage and the two files the page's tests read it through had to follow, files outside this slice's ground. May those small changes stand?

## The decision, in plain words

One line was added to the runners' test double so the code still compiles; the page's existing test helper and its page test were taught the route's new shape (a few lines each), and nothing else outside the slice's ground changed. The new tests sit in the one test file of the slice's ground.

## The intro, for fun

A new tool in the shop means a new hook on the pegboard.

## The punchline, for fun

One line, one hook, no tools were harmed.

## The options, in plain words

A. A. Keep the one line in the runners' test double (as built).
B. B. Move the line and the page's tests to a slice that owns those files.

## What I had to decide

Add the new method to the runners' test double (apps/galaxy/src/runners/fixtures/store.fake.ts), one line returning the runners whose id is asked for, teach the test helper dossier/page/stream/settled.ts to read a page whose late parts are awaited, and point one assertion of dossier/page/page.test.ts at the route's new root.
Decided by: Jev (hardToRevert 0.82) · agent said false

## What I did meanwhile

The slice's tests and the type check are green with it.

## What it costs to change later

Dropping the line is one deletion, but the type check fails until the storage's method is removed too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of the runners' test double wants the line made in a slice of its own is not written down (author).

```

<!-- /omni-outbox-settled: s4-03-outside-territory-runners-fake -->
