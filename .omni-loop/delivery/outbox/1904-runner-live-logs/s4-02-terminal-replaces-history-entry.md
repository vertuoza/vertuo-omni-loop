---
id: s4-02-terminal-replaces-history-entry
prd: 1904
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

Opening and closing the Terminal panel changes the page's address, and the spec does not say whether the browser's Back button should close the panel.

## The decision, in plain words

Opening or closing the panel rewrites the current address in place, so Back leaves the Runners page as before and never just closes the panel.

## The intro, for fun

Every panel opened could have left a breadcrumb in the browser's history.

## The punchline, for fun

No breadcrumbs: Back still means back.

## The options, in plain words

A. A. Rewrite the address in place; Back leaves the page (as built).
B. B. Add a history entry per opening, so Back closes the panel first.

## What I had to decide

Keep A, or choose B so that Back closes an open panel.

## What I did meanwhile

Back leaves the page; Escape or the close button closes the panel.

## What it costs to change later

One call in the panel; switching is a one-word edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec only says opening sets the parameter and closing removes it.
