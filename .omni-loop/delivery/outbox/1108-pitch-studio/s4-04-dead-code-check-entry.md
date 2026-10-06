---
id: s4-04-dead-code-check-entry
prd: 1108
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The animation page is reached only by the build, never by other code, so the unused-code check thought all of it was unused. Was it right to teach that check about it, a file outside this slice's agreed area?

## The decision, in plain words

One line in the unused-code check's settings names the page's starting file as a place the code starts from, the same way the build script and the command line are already named there.

## The intro, for fun

The guard did not recognise the new building because it has no front door on the street.

## The punchline, for fun

We gave it an address card, like the neighbours already have.

## The options, in plain words

A. A. Name the page's starting file in the check's settings, as the build is (built).
B. B. Leave the settings alone and accept the check's warning on every change.
C. C. Move the page's starting file somewhere the check already looks.

## What I had to decide

Whether that one settings line outside the slice's area is acceptable, or the page should be wired some other way.

## What I did meanwhile

The unused-code check sees the whole animation page as used, and still reports anything inside it that nothing uses.

## What it costs to change later

One line to remove or move in one settings file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's agreed area does not list the check's settings file; nothing else could tell the check where the page starts.
