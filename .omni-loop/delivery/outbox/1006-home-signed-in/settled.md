# Settled outbox items — PRD 1006

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-home-pill-checks-session-with-server -->

## s1-01-home-pill-checks-session-with-server — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-home-pill-checks-session-with-server
prd: 1006
slice: s1
rank: medium
bears-on: none
raised: 2026-10-02
wave: 1
---

## The question, in plain words

When the home page checks whether someone is signed in, should it ask the sign-in service to confirm, or trust what the browser already holds?

## The decision, in plain words

It asks the sign-in service to confirm, as every other page of the galaxy does. That costs one short wait before the pill shows, and a stale sign-in never shows a pill.

## The intro, for fun

The front door now waves at people it knows.

## The punchline, for fun

It just double-checks their face with security first.

## The options, in plain words

A. A. Confirm with the sign-in service, as the rest of the galaxy does (built).
B. B. Trust the browser's stored session: the pill shows sooner, but an expired sign-in may show it until the game page asks again.

## What I had to decide

Whether the home page confirms the session with the sign-in service before drawing the pill, or trusts the browser's copy.

## What I did meanwhile

The pill appears after one confirmation round trip; the next slice's three-second limit covers a slow answer.

## What it costs to change later

Switching is one line in the session read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long the confirmation takes for real visitors was not measured (author).

```

<!-- /omni-outbox-settled: s1-01-home-pill-checks-session-with-server -->
