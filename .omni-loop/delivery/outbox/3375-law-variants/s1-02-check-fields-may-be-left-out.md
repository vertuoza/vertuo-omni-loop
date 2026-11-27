---
id: s1-02-check-fields-may-be-left-out
prd: 3375
slice: s1
rank: medium
bears-on: none
raised: 2026-11-27
wave: 1
---

## The question, in plain words

When a variant says how it was checked, may the person writing the file leave out the day, the release and the note instead of writing them as empty?

## The decision, in plain words

They may be left out: a missing day, release or note reads as empty, and a live or code check still needs its day.

## The intro, for fun

Writing the word nothing three times is a small tax on every variant.

## The punchline, for fun

So silence now counts as nothing, except where a day is owed.

## The options, in plain words

A. Let the day, the release and the note be left out, read as empty, as built.
B. Require all three to be written, as empty when there is nothing to say.
C. Require only the day, and let the release and the note be left out.

## What I had to decide

Whether `checked.on`, `checked.release` and `checked.note` may be left out of `law-variants.json` (read as `null`), or must always be written, as the spec's table reads them (`text or null`).

## What I did meanwhile

The schema defaults the three to `null` when absent; `live` or `code` with no day is still refused, by path. An audience's `note` is optional but must be text when written, never `null`.

## What it costs to change later

Requiring them is one change per field in the schema of `kit/lib/knowledge/law-variants.ts` and one test; a file written meanwhile without them would then be refused by path.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says `text or null` and does not say whether the key may be absent; its example writes every one.
- (author) Two wordings the spec leaves open, chosen here: a variant that maps no audience `on` reads `Differs for: none — …`, and an unchecked variant's line drops its release (`· not checked` alone).
- (author) The `--base` diff names a change of release or note as its own field, `checked.release` and `checked.note`, beside `checked: live 2026-11-01 → live 2026-11-27`.
