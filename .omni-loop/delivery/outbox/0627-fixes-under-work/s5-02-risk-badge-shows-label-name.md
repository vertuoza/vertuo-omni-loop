---
id: s5-02-risk-badge-shows-label-name
prd: 627
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

How does a bug fix's row show the risk of its issue?

## The decision, in plain words

It shows the risk label exactly as the repository names it on GitHub, such as omni:risk-high, next to the state pill.

## The intro, for fun

Every bug arrives wearing a little hat that says how scary it is.

## The punchline, for fun

The list simply shows the hat, label and all.

## The options, in plain words

A. Show the label's own name, such as omni:risk-high (built).
B. Show a short word such as high risk, coloured by level.
C. Show only critical and high, and nothing for lower risks.

## What I had to decide

The spec says bug rows show the issue's risk label, without saying whether in the label's own words or in shorter ones such as high.

## What I did meanwhile

The row shows the first of the repository's configured risk labels (critical, then high, medium, low) the issue carries, as it is written, in a small badge. The regression badge reads regression.

## What it costs to change later

A display string only: shortening it later is one function, with no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people read the raw label comfortably on a phone-width row (author).
