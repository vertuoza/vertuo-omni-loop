---
id: s5-02-moved-question-pauses-the-dock
prd: 757
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When the page did not answer in time and the question moved to the terminal, is Claude still waiting on the person, so the game should stay paused?

## The decision, in plain words

Yes: while that question is still unanswered, the game stays paused and its button leads to the top of the terminal's tab, where the page says to answer it in the terminal.

## The intro, for fun

The question walked out of the page and into the terminal, still holding its coffee.

## The punchline, for fun

The game waits politely until someone answers it over there.

## The options, in plain words

A. A. A moved but unanswered question keeps the game paused, pointing at the tab (what was built).
B. B. Only a question the page can still answer pauses the game; a moved one lets it play on.

## What I had to decide

Whether a question that moved to the terminal and is not answered yet counts as Claude asking for the play dock on the questions page.

## What I did meanwhile

Any unanswered question of the tab's session pauses the dock; the button scrolls to the top of the tab, just above the question or the moved-to-terminal card.

## What it costs to change later

Counting only questions the page can still answer is one filter in one pure function: minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a question is open for a round of the terminal's session, and does not say whether a round moved to the terminal is still open for the dock. (author)
