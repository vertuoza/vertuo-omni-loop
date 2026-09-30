---
id: s4-01-care-tab-open-count
prd: 790
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

On the PR care tab, the review counts list open, fixed, pushed back and asked. Should 'open' mean only the comments nobody has handled yet, or also the ones waiting for the PM?

## The decision, in plain words

In the counts row, open means nobody has handled it yet, and asked is counted on its own. The tab's small badge adds both together, like the health chip does.

## The intro, for fun

Two counters looked at the same comment and argued about whose it was.

## The punchline, for fun

We gave the row one each and let the badge count them together.

## The options, in plain words

A. Open counts only unhandled threads in the row; the badge counts open plus asked (built).
B. Open counts every unresolved thread in the row too, asked ones shown twice.
C. Rename the row's open to 'not handled' so it never reads like the chip.

## What I had to decide

What 'open' counts in the PR care tab's Review row, given the health chip's 'N open' counts unresolved threads including asked ones (s2-01).

## What I did meanwhile

The Review row reads '1 open · 1 fixed · 1 pushed back · 1 asked' with open = verdict open only; the tab badge reads 'N open' with N = open + asked, matching the chip.

## What it costs to change later

One word map and a count in view.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the four counts without saying whether open includes asked.
