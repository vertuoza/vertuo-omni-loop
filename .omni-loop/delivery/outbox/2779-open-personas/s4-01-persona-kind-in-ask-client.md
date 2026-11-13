---
id: s4-01-persona-kind-in-ask-client
prd: 2779
slice: s4
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

The terminal's shared client for knowledge changes only knew four kinds of change, so writing a persona needed one word added there, outside this slice's listed files. Is that small edit fine?

## The decision, in plain words

I added the word persona to the list of kinds the shared client accepts, and a check for the new row in the skill's test file, rather than work around it with a cast.

## The intro, for fun

The client had a guest list, and personas were not on it.

## The punchline, for fun

One word later, they are in.

## The options, in plain words

A. A. Add persona to the shared client's kind list (built)
B. B. Keep the client as it was and cast the kind inside the business command

## What I had to decide

Edited kit/lib/ask/client.ts (the type of changeKnowledge's kind) and kit/test/knowledge-add-skill.test.ts, both outside the territory. Both are one-line, additive and reversible by deleting the line.

## What I did meanwhile

Nothing waits on it: the write works and every test passes.

## What it costs to change later

None to revert: delete the word and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later slice wants the client to derive its kinds from the contract (author)
