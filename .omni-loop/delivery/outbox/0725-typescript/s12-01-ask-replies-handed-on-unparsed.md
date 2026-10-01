---
id: s12-01-ask-replies-handed-on-unparsed
prd: 725
slice: s12
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The tool that talks to the Omni page gets answers back from the server. Should it check every answer's shape itself, or hand each one on to the command that asked?

## The decision, in plain words

It hands each answer on as it came, and checks only the few parts it reads itself: the renewed sign-in and the server's error text. Each command checks the rest.

## The intro, for fun

The postman was asked to read every letter before delivering it.

## The punchline, for fun

He reads the address and the stamp, and leaves the rest to whoever opens it.

## The options, in plain words

A. Hand each reply on as it came, and check only the sign-in and the error text inside the client
B. Check every reply's shape inside the client, and fail a call whose answer is not of the shape
C. Check every reply's shape inside the client, and drop the fields that are not of the shape instead of failing

## What I had to decide

Whether kit/lib/ask/client.ts should parse every reply of the contract through a schema, or hand replies on as `unknown` for the calling command to parse.

## What I did meanwhile

Every client method now returns `Promise<unknown>`: the client reads only the renewed tokens (through TokenReplySchema) and the `{error}` text itself, both in kit/lib/ask/schema.ts. The hooks in kit/lib/ask/hook.ts read the fields they need from a reply (`id`, `roundId`, `status`, `answers`, `attachments`) field by field, as they did. The commands under kit/bin that read replies are s17's to type; they will need a schema for each reply they read.

## What it costs to change later

A constant per call: add a schema per reply in kit/lib/ask/schema.ts and parse it in the method; the callers' code only loses its own checks. No stored shape and no output change today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reply that misses a field should become an error (it passes through today, and a parsing client would refuse it), which would change what a command prints against an older server
