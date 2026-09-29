# Settled outbox items — PRD 620

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-owner-deletes-screenshots -->

## s1-01-owner-deletes-screenshots — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-owner-deletes-screenshots
prd: 620
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The design lets only the uploader delete a screenshot, and only while its question is open, yet deleting a session must remove its screenshots long after. Who should be allowed to delete a screenshot?

## The decision, in plain words

I let the uploader delete while the question is open, as designed, and also let the owner of the session delete its screenshots at any time, so deleting a session can clear them out.

## The intro, for fun

Tidying up after yourself sounds simple until the broom is locked in the cupboard.

## The punchline, for fun

So the session's owner now holds a spare key to the cupboard.

## The options, in plain words

A. The uploader while the round is open, or the session's owner at any time (built).
B. The uploader while the round is open only; the session delete removes files with a service key.
C. The uploader while the round is open only; screenshots stay in the bucket after a session is deleted.

## What I had to decide

Whether the owner of a session may delete its screenshots at any time, or whether deleting a session should clear them some other way.

## What I did meanwhile

The delete rule on the screenshot bucket lets in the uploader while the round is open, or the session's owner at any time. Nobody else deletes, and nobody replaces a screenshot.

## What it costs to change later

One storage rule in the new migration; changing it is a follow-up migration that alters the policy. No stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The alternative, a service-role delete on session removal, would bring a service key into the ask API, which today acts only as the caller.

```

<!-- /omni-outbox-settled: s1-01-owner-deletes-screenshots -->
