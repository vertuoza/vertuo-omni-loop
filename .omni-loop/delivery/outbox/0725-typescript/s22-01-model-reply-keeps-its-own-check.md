---
id: s22-01-model-reply-keeps-its-own-check
prd: 725
slice: s22
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The retro already checks the model's answer field by field, and sends its sentences back to the model when the answer is wrong. Should that check become a schema, like every other answer read from outside?

## The decision, in plain words

The retro keeps its own check of the model's answer, now typed, because its sentences are what the model reads when it is asked to fix its answer. Turning it into a schema would change those sentences.

## The intro, for fun

The retro already marks the model's homework, line by line, in its own handwriting.

## The punchline, for fun

Swapping in a stamp would be tidier, but the model has learned to read the handwriting.

## The options, in plain words

A. Keep the retro's own check of the model's answer, typed, so the model is told the same thing as before
B. Replace it with a schema now, and accept that the model is told what is wrong in other words
C. Wrap the schema so it writes the same sentences as the check does today

## What I had to decide

PRD 725's done-when asks every value read from the network to pass a Zod schema, and forbids any output change. narrate.ts's checkReply is the model reply's validator: its error sentences go back to OpenRouter in the repair request (askModel), so a Zod schema would change the repair prompt the model is sent.

## What I did meanwhile

Kept checkReply hand-written, typed it (unknown in, ModelReply out), and said why in its doc comment. Every GitHub answer, the retro event and a retro.json read back from a branch go through Zod schemas in apps/omni-app/src/retro/github.schema.ts.

## What it costs to change later

Cheap: askModel already accepts a Zod schema as its check, so a later slice can swap checkReply for one and accept the new repair sentences.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the repair prompt's exact sentences matter to anyone beyond the tests that pin them (author)
