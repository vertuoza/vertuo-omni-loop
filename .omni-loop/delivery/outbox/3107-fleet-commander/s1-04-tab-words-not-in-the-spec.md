---
id: s1-04-tab-words-not-in-the-spec
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

Three small things on the Commander tab the screens do not show: what the status line says when the fleet has no daily token limit, what a suggested question does when clicked, and how a source's own line is shown.

## The decision, in plain words

With no daily limit the status line says no daily token cap; clicking a suggested question asks it at once; and a source shows its record's own line when the pointer rests on it.

## The intro, for fun

Forty-one percent of no limit at all is a hard number to draw.

## The punchline, for fun

So the line just says there is no cap.

## The options, in plain words

A. A. As built: no daily token cap, a suggestion asks at once, the record line on hover.
B. B. The status line hides the tokens when there is no cap, and a suggestion only fills the box.
C. C. As A, with the record line also shown on tap, in a small popover.

## What I had to decide

A keeps each to the smallest change: words for a state the screens do not draw, one click for a first question, and the browser's own hover text; B and C name the other ways a person might prefer.

## What I did meanwhile

The tab shows these three as built; the rail, the Message fleet mode and the Notebooks button come with the later slices.

## What it costs to change later

Each is a line or two of the tab; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Design review: a source's record line shows on hover only, not on a tap on a phone; a tap opens the record itself. (author)
- Design review: the screens were judged from the source and the component renders, as the demo world has no Virtual Fleet and no preview of this slice is deployed. (author)
