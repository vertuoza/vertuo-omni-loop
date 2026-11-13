---
id: s2-01-stances-param-in-shared-client
prd: 2779
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

The page's shared connection code now sends the new request word for every read of the business, not only the one command the plan named. Is that the right place for it?

## The decision, in plain words

The word was added once in the shared connection code, so the terminal command and the knowledge reads both get the renamed stance, instead of copying the connection code into the command.

## The intro, for fun

One small word, and every reader now asks for the new vocabulary.

## The punchline, for fun

Old kits keep their old word, and nobody gets left saying excited.

## The options, in plain words

A. A. Send stances=2 from the shared client, as built.
B. B. Send it only from the business command, with its own copy of the call.

## What I had to decide

Edit kit/lib/ask/client.ts readBusiness to send stances=2, outside slice s2's territory. Every caller (omni business show, kb) reads both stance words, so none can break.

## What I did meanwhile

The shared code sends stances=2 and every reader accepts enthusiastic and excited.

## What it costs to change later

A different answer means moving one query parameter into the business command only; a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test calls the shared client with the old kit's own client code, so the compat test strips the parameter by hand (author).
