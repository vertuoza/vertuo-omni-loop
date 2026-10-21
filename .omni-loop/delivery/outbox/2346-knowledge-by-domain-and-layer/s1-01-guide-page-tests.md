---
id: s1-01-guide-page-tests
prd: 2346
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Adding the Knowledge map page to the guide changed the page count that two docs tests of the site hold. Should the slice have updated them?

## The decision, in plain words

The slice updated the page lists and counts in the two docs tests of the site so they include the new page, instead of leaving them red.

## The intro, for fun

A new page walks into the guide and every counter has to shuffle along.

## The punchline, for fun

Somebody had to move the chairs.

## The options, in plain words

A. A. Update the two docs test files to hold the new page (built).
B. B. Leave the test files alone and let the next slice that owns them update them, with the checks red meanwhile.

## What I had to decide

Edit the page list, titles, next links and counts in the two docs test files, nothing else.

## What I did meanwhile

The tests list the new page after Repository flow, its Next link pointing at Design craft.

## What it costs to change later

Moving the page, or renaming it, is one line in the guide's meta file and the same lines in the tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page belongs after Repository flow or elsewhere in the guide order (author).
