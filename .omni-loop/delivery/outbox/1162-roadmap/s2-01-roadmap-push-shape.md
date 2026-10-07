---
id: s2-01-roadmap-push-shape
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The spec lists what a stored roadmap holds, but not its open questions, how a waiting PRD names what it waits on, or what a PRD whose work was closed without merging looks like. What should the app keep?

## The decision, in plain words

The app keeps each roadmap's open questions with any answer given, so the page can show them and the answer box; a waiting PRD keeps one line naming what it waits on plus its link; and a PRD can be marked closed, beside waiting, building, outbox, ready for a merge and merged.

## The intro, for fun

A roadmap walks into a database and asks for a table for its questions.

## The punchline, for fun

The database said yes, and kept a seat for the answers too.

## The options, in plain words

A. A. Store the questions with their answers on the roadmap, waits-on as a line and a link, and six states including closed (built).
B. B. Store no questions; the page reads them from the stored roadmap document and the answers from the roadmap's issue.
C. C. Keep the spec's five states and show a PRD closed unmerged as waiting, its line saying why.

## What I had to decide

Whether the stored roadmap carries its questions and answers, and whether `closed` is a state of its own.

## What I did meanwhile

The page (s5) and `omni roadmap push` (s6) build against this shape: `questions` on the roadmap, `waitsOn` and `waitsOnUrl` on each PRD, and six states.

## What it costs to change later

Changing it later is one migration on two tables nothing else reads, and the matching edits in the API's schema, s5's page and s6's push.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page needs the phase's done-when line beside the milestone: the front matter has no field for it, so nothing stores it. (author)
