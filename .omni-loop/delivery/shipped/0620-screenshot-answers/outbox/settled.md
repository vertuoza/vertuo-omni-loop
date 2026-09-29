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

<!-- omni-outbox-settled: s2-01-five-per-round -->

## s2-01-five-per-round — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-five-per-round
prd: 620
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The design says each Other answer takes up to five screenshots, but the storage keeps at most five screenshots for a whole question round. Should a round with several questions share five, or should each question get five?

## The decision, in plain words

I made the five a limit for the whole round: once five screenshots are added across its questions, a sixth is refused with the usual "5 screenshots max".

## The intro, for fun

Five seats on the bus, and three questions all want to bring friends.

## The punchline, for fun

So the friends share the bus, and the sixth one walks.

## The options, in plain words

A. Five for the whole round, shared by its questions (built).
B. Five per question: a follow-up migration numbers paths per question, and the page counts per question.

## What I had to decide

Whether the five-screenshot limit counts per question or per round.

## What I did meanwhile

The page counts screenshots across the whole round and refuses the sixth, whichever question it is added to. Most rounds have one question, where both readings agree.

## What it costs to change later

One constant on the page, plus a follow-up migration that widens the storage rule's numbering if each question should get five. No stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names both "5 per Other answer" and paths numbered 1 to 5 under the round's folder; the storage rule built in the first slice enforces the latter.

```

<!-- /omni-outbox-settled: s2-01-five-per-round -->

<!-- omni-outbox-settled: s2-02-screenshots-beside-send -->

## s2-02-screenshots-beside-send — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-screenshots-beside-send
prd: 620
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The answer form and the code that sends an answer are separate pieces, and the send step today only takes the typed answers. How should the screenshots reach the send step?

## The decision, in plain words

The answer form puts its screenshots aside for its question round, and the send step picks them up from there, so the two pages that send answers did not have to change. The demo page sends the text only.

## The intro, for fun

The answer and its pictures took different doors into the same room.

## The punchline, for fun

They meet at the send button, which is all that matters.

## The options, in plain words

A. A per-round holding place the send step reads (built).
B. Pass the screenshots as a new part of every send call, changing both answering pages and the demo.

## What I had to decide

Whether screenshots travel to the send step through a per-round holding place or as a new part of every send call.

## What I did meanwhile

The form keeps each round's screenshots in a holding place the send step reads; uploads that already went through are remembered there, so Send again only uploads the rest. On the demo page, screenshots show but only "(see screenshots)" is sent.

## What it costs to change later

A small rework of the send call and the two pages that call it; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory leaves out the two pages that call Send, so passing screenshots through them would have reached outside it.

```

<!-- /omni-outbox-settled: s2-02-screenshots-beside-send -->

<!-- omni-outbox-settled: s3-01-delete-waits-for-screenshots -->

## s3-01-delete-waits-for-screenshots — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-delete-waits-for-screenshots
prd: 620
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When someone deletes a session but its screenshots cannot be removed at that moment, should the session still be deleted?

## The decision, in plain words

The session is kept and the person sees an error asking them to try again, so no screenshot is ever left behind without its session.

## The intro, for fun

Taking out the rubbish is easy, unless the bin lid is stuck.

## The punchline, for fun

So the rubbish waits by the door until the lid opens.

## The options, in plain words

A. A. Keep the session and ask to try again when its screenshots cannot be removed (built).
B. B. Delete the session anyway and leave any screenshots that could not be removed in the store.
C. C. Delete the session anyway and retry the screenshot removal later in the background.

## What I had to decide

Whether a failed screenshot removal blocks deleting the session, or the session goes anyway.

## What I did meanwhile

Deleting a session refuses with a try-again error when the file store fails; the rows stay until a retry succeeds.

## What it costs to change later

Changing it later is one line in the delete handler: catch the removal failure and carry on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often the file store fails in production is unknown (author).

```

<!-- /omni-outbox-settled: s3-01-delete-waits-for-screenshots -->
