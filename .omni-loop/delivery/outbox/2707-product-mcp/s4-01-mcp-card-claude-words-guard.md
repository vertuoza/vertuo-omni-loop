---
id: s4-01-mcp-card-claude-words-guard
prd: 2707
slice: s4
rank: medium
bears-on: none
raised: 2026-11-10
wave: 2
---

## The question, in plain words

The settings card must say Copy for Claude Code, but a guard test refuses the word Claude in the app unless a file is listed. Is it right to list the card there?

## The decision, in plain words

I added two lines to the guard's list of allowed names so the card can say Copy for Claude Code and show Claude Code's own setup command, as the spec asks.

## The intro, for fun

The guard keeps the app from talking about one brand.

## The punchline, for fun

This time the brand is the whole point of the button.

## The options, in plain words

A. A. List the card's two literals in the guard (built).
B. B. Reuse the label and command from the Connect agent setup, so the card says Claude Code only through a file already listed, and its command carries that setup's server name instead of the product's key.

## What I had to decide

Two entries in apps/galaxy/src/agent-words.test.ts, outside the slice's territory, each limited to one literal of the card.

## What I did meanwhile

The card is built as the spec words it, and the guard stays green.

## What it costs to change later

One test file outside the territory changes, by two list entries that a later PRD can drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the guard's list is the right home for the card's two names (author)
