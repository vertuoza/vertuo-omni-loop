---
id: s2-02-old-header-outline-test-updated
prd: 498
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

An older check still demanded the outlined box around the PRD header that this PRD removes. Should this slice update that check, even though the file belongs to a later slice?

## The decision, in plain words

The one line of that check now asks for the strong bottom rule instead of a full outline. Nothing else in the file changed.

## The intro, for fun

The old guard still stood at the door of a box that no longer exists.

## The punchline, for fun

So it was told to watch the floor line instead.

## The options, in plain words

A. Update the one line in this slice so the whole test suite stays green (built).
B. Leave the check failing and let the later questions slice fix it.

## What I had to decide

Whether a slice may adjust an older check that its own change makes wrong when the file sits in another slice's area.

## What I did meanwhile

The check reads the header's bottom rule; the later questions slice builds on top of it.

## What it costs to change later

One line of a test; undoing it means restoring the old wording.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not list this test in the slice's area, though the spec's change makes it fail (author).
