---
id: s4-02-rail-tests-outside-territory
prd: 733
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The new fold buttons and the hover names on menu entries change what three older page checks expected to see. May the slice update those checks, although they sit outside the files it was given?

## The decision, in plain words

Yes: the slice updated the three checks so they expect the two fold buttons, the hover names and the thin line between the two menu groups in the rail. Nothing else in them changed.

## The intro, for fun

Three old checks counted the menu's buttons and found two newcomers at the door.

## The punchline, for fun

They were told the guests are expected, and the count now agrees.

## The options, in plain words

A. Update the three checks to expect the new menu (built): the page-header check, the PRD page check and the outline check each take a one-line change.
B. Leave the checks alone and hand them to a separate slice: The feature branch would stay red until that slice lands.

## What I had to decide

Whether a slice may adjust checks outside its files when the change it was asked for makes them out of date.

## What I did meanwhile

The three checks expect the new menu; every check is green.

## What it costs to change later

Undoing it means reverting three one-line changes in the checks, no data or screen affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No written rule says whether a wave slice may adjust checks outside its files (author)
