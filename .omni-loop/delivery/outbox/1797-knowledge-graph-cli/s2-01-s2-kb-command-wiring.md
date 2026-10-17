---
id: s2-01-s2-kb-command-wiring
prd: 1797
slice: s2
rank: medium
bears-on: none
raised: 2026-10-17
wave: 2
---

## The question, in plain words

The slice needed the graph command to read the screens and the cached product knowledge, but the plan gives this slice no right to touch the command file. Is it fine that the slice made that small change there?

## The decision, in plain words

The slice made a small change to the graph command file, which the next slice also owns, so the new data reaches the command; nothing else in that file changed.

## The intro, for fun

A slice found a door it had no key for, and the door was already ajar.

## The punchline, for fun

It stepped through, closed it quietly, and left a note.

## The options, in plain words

A. A. Keep the small change to the command file in this slice, as built.
B. B. Move the command wiring into the next slice and keep this one to the library and the tests.

## What I had to decide

Adopt A unless the next slice would rather rebase over the change; B moves the wiring into the next slice and leaves screens and product knowledge unreachable until then.

## What I did meanwhile

The command reads screens and the cache; the next slice builds on the wiring as it stands.

## What it costs to change later

A conflict in the command file is possible for the next slice, small because the change is one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the command file to be in this slice's territory (author)
