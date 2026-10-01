---
id: s3-02-kit-keeps-zod-3-wording
prd: 725
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The new library words its error messages differently, so the tool would start printing new wording for the same mistakes. Should the tool keep its old wording?

## The decision, in plain words

The tool keeps the old wording for every mistake it reports, so people see the same messages as before. The web app and the game take the new wording.

## The intro, for fun

The library learned to say 'Invalid input: expected string, received undefined' instead of 'Required'.

## The punchline, for fun

The tool politely asked it to keep using its inside voice.

## The options, in plain words

A. The tool keeps the old wording; the web app and the game take the new
B. Every part keeps the old wording, the web app and the game included
C. Everyone takes the new wording, and the tool's tests change with it

## What I had to decide

Zod 4 rewrote every default issue message ('Required' became 'Invalid input: expected string, received undefined'). The kit prints those messages (config errors, inbox, outbox and account front matter, the item command), and the PRD says a person running omni must notice nothing; apps/galaxy's release sync test caught the change.

## What I did meanwhile

Added kit/lib/schema/messages.ts: KIT_MESSAGES, an error map giving Zod 3's words issue by issue, passed at each kit parse (`safeParse(value, { error: KIT_MESSAGES })`). A message a schema names itself still wins. The arcade's and the game's own schemas print Zod 4's default words.

## What it costs to change later

Cheap: drop the option at each parse site to take Zod 4's words, or pass it in the arcade and the game too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone relies on the exact default wording in the arcade's or the game's errors (author)
