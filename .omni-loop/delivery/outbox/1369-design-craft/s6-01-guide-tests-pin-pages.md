---
id: s6-01-guide-tests-pin-pages
prd: 1369
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The new design page could not join the guide's menu without also updating the two docs tests that list every guide page in order. Is it fine that this slice changed those tests?

## The decision, in plain words

We updated the two docs tests so they list the new design page between Repository flow and Validate with e2e, because the guide's menu cannot gain a page otherwise.

## The intro, for fun

A new page knocked on the guide's door, and two tests were holding the guest list.

## The punchline, for fun

We added one name to the list rather than leave the page standing outside.

## The options, in plain words

A. Keep the page in the menu and the two tests updated, as built.
B. Keep the page out of the menu, reachable only through links from other pages, and leave the tests as they were.

## What I had to decide

Whether the slice may change the docs tests that pin the guide's page list, outside its own territory.

## What I did meanwhile

The design page sits in the guide's menu after Repository flow, and both docs tests list it.

## What it costs to change later

Undoing it is moving one line in the menu file and two lines in each test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave this slice the guide folder only; the docs tests that pin the page list were not foreseen (author).
