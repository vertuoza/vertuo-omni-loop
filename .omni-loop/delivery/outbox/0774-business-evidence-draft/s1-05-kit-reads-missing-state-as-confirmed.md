---
id: s1-05-kit-reads-missing-state-as-confirmed
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When the terminal command reads the business from an Omni page that has not been updated yet, the claims carry no state. How should it read them?

## The decision, in plain words

As confirmed: an older page only ever sent confirmed claims, so nothing is lost and agents keep working.

## The intro, for fun

New terminal, old page: someone has to be polite about it.

## The punchline, for fun

No state means what it always meant: confirmed.

## The options, in plain words

A. Read a missing state as confirmed
B. Refuse the reply until the page is updated

## What I had to decide

Whether a claim without a state should read as confirmed, or the whole reply be refused.

## What I did meanwhile

A claim with no state reads as confirmed; a claim with any state other than confirmed or contradicted makes the reply refused, and the command still exits 0.

## What it costs to change later

One default in the command, changed in a later release.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec adds state to the read but says nothing of a terminal meeting a page not yet updated (author).
