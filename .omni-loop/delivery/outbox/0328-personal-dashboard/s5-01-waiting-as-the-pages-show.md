---
id: s5-01-waiting-as-the-pages-show
prd: 328
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The spec counts a question as waiting while it is still open. Some questions stay open after the terminal has taken them over, or after their session has closed: should the Waiting for you tile count those?

## The decision, in plain words

It counts a question only while the Omni page can still answer it, exactly as the questions page and the shared-with-me page show it. A question the terminal already took over, or one in a closed session, does not count.

## The intro, for fun

A question left open by a terminal that went home is still, technically, open.

## The punchline, for fun

So the tile only counts the ones someone could actually answer right now.

## The options, in plain words

A. Count only the questions the page can still answer, as the questions pages show them (the option built).
B. Count every question still marked open, as the spec words it, even one the terminal took over or one in a closed session.

## What I had to decide

Whether Waiting for you counts every question whose round is still open, as the spec words it, or only those the page it links to would show as waiting.

## What I did meanwhile

waitingCount runs the ask pages' own rules over what readTabs and readForMe return: a session's newest open round counts while it is under nine minutes old (the hook's wait) and its session is not closed, as the tab list shows it needing you; a shared open round counts while forMeList would list it. The tile and the pages it links to always agree.

## What it costs to change later

One function in the counts' folder: dropping the time rule is two lines, and nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a round is always marked as moved when its terminal stops waiting, which would make the spec's literal rule agree with the pages, was not checked against the stored rounds
