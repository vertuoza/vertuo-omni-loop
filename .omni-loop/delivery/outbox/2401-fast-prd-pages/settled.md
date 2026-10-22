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
