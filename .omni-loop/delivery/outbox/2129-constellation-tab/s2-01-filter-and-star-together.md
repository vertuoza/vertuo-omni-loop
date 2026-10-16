---
id: s2-01-filter-and-star-together
prd: 2129
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

On the Constellation, when someone has lit one PRD and then taps a repository (or the other way round), should the page keep both choices, or start over with only the last one?

## The decision, in plain words

Both are kept: tapping a repository keeps the lit PRD, and picking a PRD keeps the open repository card. 'Everything' clears only the lit PRD.

## The intro, for fun

Two filters walk into a sky and neither wants to leave.

## The punchline, for fun

So they share the view, politely.

## The options, in plain words

A. A. Keep both choices across links (built).
B. B. Each link resets the other choice: a repository tap clears the lit PRD, a PRD chip closes the card.
C. C. Keep the lit PRD on a repository tap, but close the card when a PRD chip is picked.

## What I had to decide

Whether the PRD filter and the selected repository survive each other's links, or each link resets the other.

## What I did meanwhile

Each link carries the other choice along, so a person can light a PRD and read a repository's card at once.

## What it costs to change later

A one-line change in how the tab builds its links; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says what each choice does alone, not whether they combine; the mockup shows neither case.
