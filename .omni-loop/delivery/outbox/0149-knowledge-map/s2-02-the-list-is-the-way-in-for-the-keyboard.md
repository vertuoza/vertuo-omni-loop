---
id: s2-02-the-list-is-the-way-in-for-the-keyboard
prd: 149
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The diagram draws every entry as a small dot. Should a keyboard or a screen reader walk through the dots too, or reach the same entries through the list under the diagram?

## The decision, in plain words

The dots answer a mouse or a finger. The list under the diagram holds the same entries as links, grouped in an order that reads well, so the keyboard and screen readers use the list and skip the picture.

## The intro, for fun

Fifty-eight tiny planets in a ring make a lovely picture, and a very long walk for a keyboard.

## The punchline, for fun

So the keyboard takes the list, which goes to the same places in a straight line.

## The options, in plain words

A. The list is the way in for the keyboard and screen readers, and the dots answer a pointer, the option built.
B. Put every dot in the keyboard's path too, after the tabs and before the panel.
C. Let the arrow keys move between the dots once the diagram has focus, as the arcade's pad does.

## What I had to decide

The spec says an entry is selected "by its dot or its index row", and says nothing of reaching the SVG from the keyboard or a screen reader. With 58 dots here (and the 150 the layout is tested with), putting every dot in the tab order doubles each stop the index already offers, in an order (orbit by orbit, clockwise) that reads worse than the index's grouping by principle.

## What I did meanwhile

The figure (the SVG and its legend) is `aria-hidden`; each dot is an SVG `<a>` with `tabIndex={-1}`, its real address as `href`, and a `<title>` tooltip with its id and statement. Every index row is a real link carrying its kind and status in visually hidden text, and choosing one updates the panel, the diagram's selection ring and the address exactly as a dot does. On a phone, choosing brings the panel into view. The by-hand check clicked dots and rows at 1440×900 and tapped both at 393×700.

## What it costs to change later

A constant: drop `tabIndex={-1}` and `aria-hidden` in `apps/galaxy/src/knowledge/OrreryDiagram.tsx` and `KnowledgeMap.tsx`, and give the SVG an accessible name. No data and no address changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The page was not tried with a screen reader, only read through its markup and driven with a pointer in a headless browser.
