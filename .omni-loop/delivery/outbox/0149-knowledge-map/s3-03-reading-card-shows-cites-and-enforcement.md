---
id: s3-03-reading-card-shows-cites-and-enforcement
prd: 149
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The reading card in the arcade shows a whole knowledge entry. Besides what the spec lists, should it also show what the entry cites and how it is enforced?

## The decision, in plain words

Yes: the card also lists the entries it cites, and how it is enforced when it is, so the arcade and the page tell the same whole story. An entry marked as not enforced says nothing about it.

## The intro, for fun

A good reading lamp shows the footnotes too, not just the headline.

## The punchline, for fun

And it skips the footnote that only says there is no footnote.

## The options, in plain words

A. Show what it cites, and how it is enforced when it is, the option built.
B. Keep to the spec's list: statement, Why:, serves, served by, PRD.
C. Show everything the page's panel shows, the file included.

## What I had to decide

The spec lists the card's content as the whole statement, Why:, what it serves, what serves it and the PRD it came from, while the acceptance criteria call it the whole entry, and the /knowledge page's panel also shows cites and Enforced by:. This repository's registers write 'Enforced by: unenforced' on unenforced entries.

## What I did meanwhile

`cardBlocks` in scenes/chart.tsx adds CITES (the ids, when there are any) and ENFORCED BY (the line as written, only when the entry is enforced), between what serves it and FROM PRD. The panel beside the diagram keeps to what the spec lists.

## What it costs to change later

Dropping either block is one line in `cardBlocks` and one assertion in chart.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's list of the card's content and the acceptance criteria's 'whole entry' differ by these two lines.
