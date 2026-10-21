---
id: s1-02-config-test-law-proof
prd: 2346
slice: s1
rank: high
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The config test file also proves a locked rule, and this slice added tests to it and changed two old expectations for the new alias tables. Are you fine with that file changing?

## The decision, in plain words

The slice put its new config tests in the existing config test file and updated the two expectations that held the old, unaliased words, as the spec says an alias reads as its canonical word.

## The intro, for fun

The old words got new names, so two old expectations had to learn them.

## The punchline, for fun

Same rule, same test, a few more words.

## The options, in plain words

A. A. Keep the new tests and the two updated expectations in the config test file (built).
B. B. Move the new tests to a file of their own and leave only the two updated expectations in the config test file.

## What I had to decide

Keep the new tests and the two updated expectations in the existing config test file; the law's own assertions are untouched.

## What I did meanwhile

A kind written rest reads as api, and a role written back-end reads as api, in every config the kit parses.

## What it costs to change later

Moving the new tests to a file of their own is a copy of those blocks; the two updated expectations stay either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which locked rule the config test file proves, and whether its owner wants the tests of other behaviour kept out of it (author).
