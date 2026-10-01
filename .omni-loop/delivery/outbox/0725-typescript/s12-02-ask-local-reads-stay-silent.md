---
id: s12-02-ask-local-reads-stay-silent
prd: 725
slice: s12
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The plan asks that a file the tool cannot read fails with a message naming what is wrong, but question mode always read its own small files and the sign-in quietly, a broken one counting as missing. Which wins?

## The decision, in plain words

They are still read quietly: a broken file counts as missing and nothing is printed, so a question is never blocked. The check behind it now uses a proper shape description.

## The intro, for fun

The plan wanted every smudged note read aloud with its typo.

## The punchline, for fun

Question mode shrugs, bins the note, and lets the question through.

## The options, in plain words

A. Keep the reads quiet: a value not of the shape reads as absent, through a schema
B. Fail each read with an error naming the field, and let the hooks catch and swallow it
C. Keep the reads quiet but write the field's error to a local log a person can read

## What I had to decide

Whether the reads of ask mode's local state, the sign-in store, the dossier drafts file, a hook's input and a transcript should fail with an error naming the field (the plan's done-when), or stay lenient as they were.

## What I did meanwhile

Each read goes through a Zod schema with safeParse (ModeFileSchema, TerminalFileSchema, RoundFileSchema, HeartbeatWindowSchema, TokensSchema, TokenReplySchema in kit/lib/ask/schema.ts; DossierEntrySchema in kit/lib/dossier/local.ts), and a value that fails reads as absent, exactly as before. Transcript lines and hook inputs, which are any JSON, are read field by field with the `field` helper rather than one schema. No output changed.

## What it costs to change later

A constant: where an error is wanted, swap a safeParse for parse with the kit's messages; the schemas are already there. Each such swap changes what a hook prints, which the spec rules out for this PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan's rule that an invalid value fails naming its field was meant to cover reads that were designed never to fail (the hooks must never block a question)
