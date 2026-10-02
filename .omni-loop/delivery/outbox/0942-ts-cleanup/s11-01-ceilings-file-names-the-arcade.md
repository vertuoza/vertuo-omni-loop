---
id: s11-01-ceilings-file-names-the-arcade
prd: 942
slice: s11
rank: high
bears-on: ADR-0002
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The new file that sets how many type escape hatches each part of the repository may keep has to name the arcade's folder, and the kit's own rule forbids any kit file but a test from naming the game. Is it right to treat that one file as part of the test that reads it?

## The decision, in plain words

The file stays where the spec puts it, under the kit's test folder, and the rule that keeps the game's name out of the kit now leaves exactly that one file alone, since only a test reads it and it never ships.

## The intro, for fun

A list of limits had to name the arcade, in the one place that never says its name.

## The punchline, for fun

So the list got a backstage pass, valid for one file and no other.

## The options, in plain words

A. A. Treat the ceilings file as the guard test's own data: a one-file exception in the word rule, proven narrow by a fixture (built)
B. B. Move the ceilings file out of the kit folder, beside the repository's root, so the word rule needs no exception
C. C. Keep the file, but key the arcade's area by a name without the game's word, and let the guard's messages use that name

## What I had to decide

Whether the ceilings file may name the arcade's area as the test it serves does, or must move or be renamed so the kit's word rule needs no exception.

## What I did meanwhile

The ratchet works as the spec describes, with its file at the path the spec names and its areas named as the spec names them; the word rule ignores that one file and still refuses the word in every other file under the kit but a test.

## What it costs to change later

Undoing it is one line in the word rule's test plus moving or renaming the ceilings file and the one constant in the TypeScript guard that points at it; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec nor ADR-0002 says whether a data file only a test reads counts as part of that test; this reading is the author's own. (author)
