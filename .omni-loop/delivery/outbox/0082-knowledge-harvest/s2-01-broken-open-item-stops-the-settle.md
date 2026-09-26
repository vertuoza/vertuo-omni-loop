---
id: s2-01-broken-open-item-stops-the-settle
prd: 82
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When a feature is merged while a question is still open, and one of those open questions is written so badly it cannot be read, what should happen?

## The decision, in plain words

Nothing is settled for that feature, and the reason names the unreadable question, so a person can fix it and run the settling again.

## The intro, for fun

One open question got scribbled on a napkin instead of the form.

## The punchline, for fun

So the whole pile waits until someone rewrites the napkin.

## The options, in plain words

A. Settle nothing and name the unreadable question, so a person fixes it first.
B. Settle every readable question and list the unreadable ones as left open.
C. Settle every question, reading only the header of an unreadable one.

## What I had to decide

What settle at merge does when an open item file in the PRD's outbox does not parse. The spec says every open item is adopted, but an entry needs the item's id, rank, slice and wave, and a file that does not parse gives none of them reliably.

## What I did meanwhile

settleAtMerge returns ok: false with the parser's errors, naming the file, and settles nothing for that PRD. The outbox check refuses a malformed item on every pull request, so this should only happen when that check was bypassed.

## What it costs to change later

A constant change in one function: settle the parseable items and list the unparseable ones as not settled, or fall back to the front matter alone. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what a merge over red does with an open item that does not parse.
