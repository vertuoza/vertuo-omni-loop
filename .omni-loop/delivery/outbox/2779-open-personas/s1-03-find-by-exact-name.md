---
id: s1-03-find-by-exact-name
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When an agent edits a persona by its name from the terminal, should the name match exactly, capital letters included, or should Sam and sam count as the same persona?

## The decision, in plain words

The name must match exactly, once the spaces around it are dropped. Sam finds Sam, and sam finds no one, so an edit never lands on a persona it was not meant for.

## The intro, for fun

Sam, sam and SAM walk into a product.

## The punchline, for fun

Only one of them answers to the name on the door.

## The options, in plain words

A. A. The name matches exactly, capitals included, after trimming the spaces around it.
B. B. The name matches without regard to capitals.
C. C. Exact first, then without capitals when exact finds no one.

## What I had to decide

Keep A when an exact name is safest, since names are not unique. Pick B when a person should not have to remember capitals; two personas that differ only by capitals then count as several, and the agent is sent to the page.

## What I did meanwhile

An edit by name finds the one live persona of that exact name in the product. None says so with the name and the product; several sends the person to the Knowledge tab.

## What it costs to change later

B changes one comparison in the database's find function and two lines of its check; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says an edit finds the persona by its name in the product, and does not say whether capitals count (author).
- The database tells none and several apart with two different refusal codes, which the terminal's slice turns into its 404 and 409.
