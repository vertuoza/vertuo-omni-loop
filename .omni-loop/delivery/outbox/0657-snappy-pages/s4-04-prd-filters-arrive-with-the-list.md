---
id: s4-04-prd-filters-arrive-with-the-list
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

On the PRD list, the plan asked for the filters to show before the rows, but the filters' repository choices come from the same read as the rows. Should the filters wait for the rows?

## The decision, in plain words

The heading and a grey outline of the filters show at once, and the real filters arrive together with the rows.

## The intro, for fun

The shop opens its doors, but the price tags are still in the delivery van.

## The punchline, for fun

The shelves are already out, and the tags come on the same truck as the goods.

## The options, in plain words

A. The filters arrive with the rows, under a skeleton of their size (built).
B. Show the filters at once with the search and the draft-or-PRD pick, and fill in the repository choices when the rows arrive.

## What I had to decide

Whether /prd renders its filters outside the list's Suspense. The filter form's repository choices (historyChoices) and the 'No PRD yet' state that hides the filters both come from the dossier rows, and DossierHistory.tsx, which draws filters and rows together, is outside s4's territory.

## What I did meanwhile

app/prd/page.tsx decides the demo, closed and signed-out cases at once, then streams the whole list (filters, stage bar, rows) in one Streamed block under a skeleton of the heading, the filters and six rows. The reads stay in page.tsx, where s5 swaps the GitHub reader.

## What it costs to change later

A change to the list's drawing later; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the filters showing a moment later matters to people using the list is unknown.
