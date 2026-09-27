---
id: s1-01-example-notes-invented-product
prd: 262
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The playbook page on releasing shows three example release notes. Should they describe an invented product, or this project's own releases?

## The decision, in plain words

They describe an invented product with reports, invoices and search, because every repository that runs the loop reads this page, not only ours.

## The intro, for fun

Every style guide needs a few examples, and someone has to decide whose story they tell.

## The punchline, for fun

The invented product never ships late, which makes it a very patient example.

## The options, in plain words

A. Examples about an invented product, so any repository reads them as neutral: the option built.
B. Three of this project's own initial release lines, the voice it actually ships.
C. No examples at all, only the rules.

## What I had to decide

What the three example notes in the kit default of the `releasing` form's `notes` slot describe. The spec asks for "the rules above with three example notes" and does not say which product they are about.

## What I did meanwhile

Three notes about an invented product: a public link to a report, invoices in the customer's language, and search as you type. Each parses and passes `omni check releases` (`kit/lib/playbook/releasing.test.mjs`).

## What it costs to change later

One template section and its test: swap the three fenced examples, rebuild the bundle with `pnpm kit:build`. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the reviewer would rather the kit default carry this repository's own voice (three of the initial release's lines), which every other repository running the loop would then read as its playbook's example.
