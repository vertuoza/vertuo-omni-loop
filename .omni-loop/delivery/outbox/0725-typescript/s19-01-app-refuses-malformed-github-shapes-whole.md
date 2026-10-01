---
id: s19-01-app-refuses-malformed-github-shapes-whole
prd: 725
slice: s19
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When GitHub sends the App something in a shape it never sends, should the App stop and say which part was wrong, or carry on part by part as it used to?

## The decision, in plain words

It stops: an answer from GitHub or an event missing a part fails naming that part, and a delivery of the wrong shape starts nothing. Every well-formed delivery and answer gives exactly the same result as before.

## The intro, for fun

GitHub once sent a pull request whose number was a word. Nobody believes it either.

## The punchline, for fun

Now the App says so at the door, instead of tripping three rooms later.

## The options, in plain words

A. A. A malformed answer or event fails naming its field; a malformed delivery starts nothing; well-formed ones behave as before
B. B. Parse only for the types, and let malformed values pass through as before
C. C. Fail on malformed answers, but keep reading malformed deliveries field by field

## What I had to decide

PRD 725 asks every value read from the network to pass a schema and fail naming its field, and asks for no output change. The App read webhook deliveries, GitHub's REST answers and Inngest event data field by field with fallbacks: a field of an unexpected type passed through until something downstream crashed or quietly used it.

## What I did meanwhile

src/outbox-check/github-schema.ts holds one schema per GitHub answer the App reads (pull request, issue, comments, compare, check runs, trees, blobs, refs, commits, pulls); each names only the fields read, with the fallbacks as before (nullish where the code had `??`). src/inngest-client.ts holds the event data schemas, which every function parses `event.data` through. The webhook (src/webhook/webhook.ts) and the stage events (src/stage-forward/stage-forward.ts) parse a delivery with safeParse: a delivery of another shape becomes no event and no stage, as a delivery missing those fields already did. All 635 tests pass unchanged; src/outbox-check/github-schema.test.ts adds five that show a refusal naming its field.

## What it costs to change later

Cheap: loosen a field to nullish or unknown in the schema file, or drop a parse; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether GitHub ever sends a delivery whose repository has no `name`, which the webhook schema now requires; every recorded delivery has one
- (author) Whether a malformed event already sitting in Inngest's queue would now fail its run by name, where it used to fail later
