---
id: s2-01-thrown-values-read-as-text
prd: 942
slice: s2
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

When the tool fails with something that is not a normal error, which only happens through a mistake in the tool itself, what should its one-line message say?

## The decision, in plain words

The message now shows what was thrown, as text, where it used to show the word undefined or crash. Normal errors read exactly as before.

## The intro, for fun

Some failures arrive without a label, like a parcel with no address.

## The punchline, for fun

Now we at least read what is written on the box.

## The options, in plain words

A. A. Read a non-Error throw as text, through the shared helper (built)
B. B. Keep the old reading: the cast and its reason stay in those places
C. C. Treat a non-Error throw as a crash, with its own message

## What I had to decide

Whether a thrown value that is not an Error should keep reading as nothing (as the removed cast let it), or be read as text by the shared helper that replaced the cast.

## What I did meanwhile

The kit's errorMessage, and the yaml and plan parse failures in config, forms and plan grading, read what was thrown through messageOf: an Error's message, else the value as text. Every kit module throws an Error, so no output a test pins changed; a new test pins both readings.

## What it costs to change later

Low: putting back the old reading is one line in errorMessage, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec forbids behaviour change, but does not say whether a path only a kit bug can reach counts
