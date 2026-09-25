---
id: s5-03-a-readme-for-the-kit
prd: 71
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The plan asks for one line about ask mode in the kit's own readme, but the kit had no readme. Where should the line go?

## The decision, in plain words

A short readme for the kit was written: one paragraph on what the kit is, then the paragraph on ask mode. The repository's front page is unchanged.

## The intro, for fun

Adding a line to a book that was never printed takes a little extra paper.

## The punchline, for fun

So the book got a cover, one page, and exactly that line.

## The options, in plain words

A. Write a short readme for the kit, holding the line, the option built.
B. Put the line on the repository's front page instead, outside this slice's ground.
C. Leave the line out until the kit has a fuller readme.

## What I had to decide

The spec's scope names "a line in the kit README" and the plan gives `kit/README.md` to s5, but no `kit/README.md` exists on the feature branch or on `main`. The only README is the repository's own `README.md`, outside this slice's territory, whose table names `kit/` "the delivery kit (`omni` CLI)".

## What I did meanwhile

Created `kit/README.md`: one paragraph on what the kit is (the `omni` CLI, shipped bundled as `kit/dist/omni.mjs`, and the `omni` plugin's skills and hooks, reading everything specific to a repository from its `.omni-loop/config.yml`), then one on ask mode (`omni signin` once per computer, `/omni:ask on` prints the page's link, `/omni:ask off` turns it off, `ask.url` null by default, and the terminal takes over whenever the page cannot answer). `kit/test/no-game-words.test.mjs` scans it like every other non-test file under `kit/`.

## What it costs to change later

Deleting one file, or moving its ask mode paragraph to the repository's front page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the repository's front page, or expected a kit readme to exist already.
