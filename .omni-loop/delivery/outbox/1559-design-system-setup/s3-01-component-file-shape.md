---
id: s3-01-component-file-shape
prd: 1559
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When the design check looks for screen parts the design system does not list, which files count as a part? The spec says a component file but does not say how to tell one apart.

## The decision, in plain words

A file counts as a part when it is a React, Vue, Svelte or Astro component file inside the folders the design settings name, test files left out. Plain scripts and styles are never flagged.

## The intro, for fun

Every file in the screens folder wants to be a component when it grows up.

## The punchline, for fun

We picked the ones that already render something.

## The options, in plain words

A. A. React, Vue, Svelte and Astro component files under the design paths (as built)
B. B. A, plus server templates (Twig, Blade, PHP views)
C. C. Only files inside a folder named components under the design paths

## What I had to decide

Keep the four front-end component file kinds, or widen or narrow the list (add server templates for a PHP repository, or count only files inside a components folder).

## What I did meanwhile

The drift check warns on unlisted React, Vue, Svelte and Astro component files under the design paths; it never turns the check red.

## What it costs to change later

A constant in one file: changing the list later is a one-line edit and a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A repository whose components are server templates (PHP, Twig, Blade) gets no unlisted-file warning today (author)
- Slice s2 reads a diff for new component files in parallel and may pick its own definition; the two should share one (author)
