---
id: s9-01-openrouter-key-for-backfill
prd: 82
slice: s9
rank: human-action
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

Filing every past decision into the knowledge base needs a model to say where each one belongs, and the key that lets us call that model is not set where this work runs.

## The decision, in plain words

The backfill waits. The decision records page already describes what a filed decision looks like, and nothing else was written until the key is there.

## The intro, for fun

Every past decision is packed and labelled, waiting at the door.

## The punchline, for fun

The only thing missing is the key to the sorting room.

## What a person must do

1. Set OPENROUTER_API_KEY (and optionally OPENROUTER_MODEL) in the environment that runs the s9 backfill slice.
2. Rerun /omni:do-work 82 s9 on feat/knowledge-harvest--s9: it runs omni harvest for PRDs 3 (#4), 7 (#9), 28 (#29), 39 (#40), 45 (#46), 50 (#51) and every other PRD in shipped/.

## What I had to decide

Set the model key in the environment that runs the backfill, then rerun this slice.

## What I did meanwhile

The decision records page already names the new fields; no past decision has been filed yet, and the shipped folders are unchanged.

## What it costs to change later

Nothing to undo: the backfill has not started, so it runs cleanly once the key is set.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the key should come from a shared secret store rather than a local environment was not settled (author).
