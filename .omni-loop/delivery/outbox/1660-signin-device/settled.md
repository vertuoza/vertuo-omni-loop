# Settled outbox items — PRD 1660

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-device-requests-server-only -->

## s1-01-device-requests-server-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-device-requests-server-only
prd: 1660
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Who may touch the waiting sign-in requests in the database: only the Omni page's own server, or also a signed-in person directly?

## The decision, in plain words

Only the Omni page's server touches them, with its own clock. Without its private database key the device sign-in is simply off, and the page answers that it is not available.

## The intro, for fun

A sign-in request waits ten minutes in a locked drawer.

## The punchline, for fun

Only one key opens the drawer, and it never leaves the server.

## The options, in plain words

A. A. Server only: every function runs for the service role, with the server's clock; no key, no device sign-in (503).
B. B. The approval step also runs as the signed-in person, so a deployment without the service role key still approves requests.
C. C. As A, and the kit treats 503 like 404: it falls back to the loopback on a page without the key.

## What I had to decide

Keep the requests reachable through the server alone (A), or open the approval step to a signed-in person's own database access (B).

## What I did meanwhile

Built as A: the table is closed to every role, the service role included, and seven functions granted to the service role only are the one way in. Galaxy passes its own clock to each call, so expiry and slow_down are its rules, proven on a fake.

## What it costs to change later

B is a new migration that grants the approve and find functions to authenticated and binds them to auth.uid(): a constant-sized change, no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The table has two columns the spec does not list: payload_expires_at (a kit token's own expiry, for s3, whose territory has no migration) and poll_interval (the spec's interval, renamed: interval is a SQL type name). (author)
- Without SUPABASE_SERVICE_ROLE_KEY both routes answer 503; the spec's kit falls back to the loopback on 404 only, so s4 should treat 503 the same way or a deployment without the key strands a cloud session. (author)

```

<!-- /omni-outbox-settled: s1-01-device-requests-server-only -->

<!-- omni-outbox-settled: s1-02-poll-answer-codes -->

## s1-02-poll-answer-codes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-poll-answer-codes
prd: 1660
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

When the terminal asks whether the sign-in was approved, should every answer come back as a plain success, or should waiting, too fast, expired and refused each carry their own web status?

## The decision, in plain words

Each carries its own web status, and the answer's words say the same thing. The terminal reads the words, so either way it works; the statuses only help whoever reads the server's logs.

## The intro, for fun

The terminal keeps asking: are we there yet?

## The punchline, for fun

The page now answers in two languages at once, just in case.

## The options, in plain words

A. A. A web status per answer, the body's status field the same: 200, 429, 410, 403.
B. B. 200 for every answer the terminal expects; only malformed bodies and failures carry an error status.

## What I had to decide

Keep a status per answer (A), or answer 200 for every outcome the terminal expects (B).

## What I did meanwhile

Built as A: pending and approved answer 200, slow_down 429, expired 410, denied 403; the body's status field is the contract the kit reads (src/ask/device.contract.ts).

## What it costs to change later

B is a one-line table change in the controller and its test, before s4's kit reads it; after, a kit that branches on the HTTP status would have to change too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names 404, 410 and 429 in its test seams without saying which answer each is; 404 is read here as the route missing on an older page (the kit's fallback), never an answer of these routes. (author)

```

<!-- /omni-outbox-settled: s1-02-poll-answer-codes -->
