---
id: s5-01-design-lint-proposed-despite-findings
prd: 1369
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 5
---

## The question, in plain words

When the setup step finds a design checker already installed, should it suggest using it even if the checker reports problems in today's screens?

## The decision, in plain words

It suggests the checker as long as it runs and produces its report, whatever problems it finds, because the design review only reports and never blocks. A checker that cannot start is turned into a question instead.

## The intro, for fun

Every app has a few pixels it would rather not talk about.

## The punchline, for fun

We let the checker speak anyway; it only takes notes.

## The options, in plain words

A. A. Suggest it whenever it runs to its report, findings or not, since the review never blocks
B. B. Suggest it only when it passes, like every other command setup suggests
C. C. Never suggest it; a person sets it by hand

## What I had to decide

Whether a design checker with findings on today's screens is still suggested during setup.

## What I did meanwhile

Setup suggests an installed design checker whenever it runs to its report, findings or not.

## What it costs to change later

A one-line change in the setup skill's config table; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only that a design checker already installed is suggested; every other command setup suggests must pass first (author)
