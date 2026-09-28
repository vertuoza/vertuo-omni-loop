---
id: s2-01-home-link-guard-allows-docs
prd: 346
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The home page checks that it links only to the game and the release notes, so the new Getting Started button to the docs needed that check widened. Is it fine to allow the docs link there?

## The decision, in plain words

The check now allows three links from the home page: the game, the release notes and the docs. Everything else it guards stays as it was.

## The intro, for fun

The home page had a strict guest list, and the docs just showed up at the door.

## The punchline, for fun

We added one name to the list and kept the bouncer on duty.

## The options, in plain words

A. Allow the docs link in the home page's link check (built).
B. Keep the check to the game and release notes, and drop the Getting Started button from the home page.

## What I had to decide

Whether the home page's link check may name the docs page beside the game and the release notes.

## What I did meanwhile

The home page links to the docs, and its check accepts exactly the game, the release notes and the docs.

## What it costs to change later

Undoing it is one line in the check, plus removing the button.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec asks for the button; only the existing link check outside this slice had to follow it.
