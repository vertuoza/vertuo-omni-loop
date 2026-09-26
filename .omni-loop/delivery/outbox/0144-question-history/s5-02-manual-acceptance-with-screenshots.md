---
id: s5-02-manual-acceptance-with-screenshots
prd: 144
slice: s5
rank: human-action
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The feature ends with a tryout for real, with two people, a live database and a real Claude session, recorded with screenshots in light and dark. Who runs it, and when?

## The decision, in plain words

Everything is built and tested; the tryout for real waits for a person, once the database changes and the pages are live.

## The intro, for fun

Every test passes, and still nobody has asked a real teammate a real question.

## The punchline, for fun

The robot built the phone line; a human has to pick up.

## What a person must do

1. Deploy the feature branch's migrations and a galaxy preview on a database both accounts can reach
2. With ask mode on, run /omni:brainstorm on a PRD's feature branch; screenshot the question with its context line, its cost and its category, in light and dark
3. Share a live question with a second account; answer it there and check Claude continues with that answer
4. Share another; answer it first as the owner and screenshot Already answered on the teammate's page
5. Open History, filter to those questions and search a word of an answer; screenshot it
6. With a kit from before this PRD (no context), ask a question and check it is answered
7. Attach the screenshots to the sub-PR of s5 and settle this item

## What I had to decide

Who runs the manual acceptance, on which deployment, and with which second account.

## What I did meanwhile

The history page, its filters and search, its sign-in return and the header link are built and tested, and were checked on the demo galaxy in light and dark at phone and desktop widths. The manual acceptance is not recorded.

## What it costs to change later

Nothing to undo: the acceptance only records evidence on the sub-PR. Until it runs, the feature's live behaviour across two accounts is unproven.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The acceptance needs the PRD's migrations on a live database, two signed-in workspace accounts and a real Claude Code session with ask mode on, none of which this slice can reach (author)
