---
id: s6-03-who-opened-a-prd
prd: 587
slice: s6
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

To count your PRDs or a fleet's, the dashboard must know who opened each one. Where should that come from?

## The decision, in plain words

From who opened the PRD issue, as the game already records it, or from who opened its page. A PRD with neither counts on the workspace dashboard only.

## The intro, for fun

Every PRD has a parent, but some of them left no forwarding address.

## The punchline, for fun

Those orphans still count for the workspace, just not for anyone in particular.

## The options, in plain words

A. Use the recorded issue author, then the page opener, the option built.
B. Have the stage sync store each PRD issue's author beside its stages.
C. Count by the page opener only.

## What I had to decide

Which record says who opened a PRD, for the personal and fleet counts and the People column.

## What I did meanwhile

The issue author from the recorded PRD-opened events, matched by repository name and number, or the account that opened the PRD's page; neither known means workspace only.

## What it costs to change later

A change in one read and one pure function; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the PRD-opened events are only polled over the last 40 days, so an older PRD with no page may have no known opener (author)
- whether the stage sync should store the issue author itself (author)
