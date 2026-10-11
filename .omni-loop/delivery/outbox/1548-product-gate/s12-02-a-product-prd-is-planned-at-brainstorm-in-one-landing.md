---
id: s12-02-a-product-prd-is-planned-at-brainstorm-in-one-landing
prd: 1548
slice: s12
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When a product PRD reaches the build with no plan on its page, or with a plan split into several landings, should the build plan it or split it itself?

## The decision, in plain words

Neither: the build stops in one line. A product PRD's plan is approved together with its spec at brainstorm, so the build never writes one after approval, and a product PRD lands as one feature pull request per repository for now.

## The intro, for fun

The builder shows up and finds the blueprint drawer empty.

## The punchline, for fun

It leaves a note asking for the blueprint instead of sketching one on a napkin.

## The options, in plain words

A. Stop in one line: the plan comes from the brainstorm, in one landing per repository (built).
B. Plan it in the build, as a repository's PRD is planned, and ask for approval again.
C. Allow several landings, each repository getting its own chain of pull requests.

## What I had to decide

What the build does with a product PRD whose page holds no plan, or whose plan has more than one landing.

## What I did meanwhile

The build stops with one line naming the brainstorm that plans it, or the number of landings, and builds nothing.

## What it costs to change later

Skill text only: allowing either later is a paragraph in the build's product section.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a plan written after approval would void the approval on the server (author)
