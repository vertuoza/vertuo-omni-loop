---
id: s2-02-how-outbox-items-read-on-the-page
prd: 426
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The Outbox tab shows a recommendation for each open decision and a title for each settled one, but the decision files carry nothing by those names. What should the page show there?

## The decision, in plain words

The recommendation is the decision the agent took meanwhile, in plain words, and a settled decision is titled by its question in plain words. The answer link opens the numbered outbox comment first, then the older one, then the feature pull request.

## The intro, for fun

The page was asked for a recommendation and a title, and the files had neither.

## The punchline, for fun

So it borrowed the words the agents had already written.

## The options, in plain words

A. A. Use the decision in plain words as the recommendation and the question as the title, as built.
B. B. Use option A's text as the recommendation and the item's name as the title.
C. C. Show the whole decision file for each item.

## What I had to decide

Which part of an outbox item stands for the recommendation, which part titles a settled entry, and which outbox comment the answer link opens when both exist.

## What I did meanwhile

Recommendation = the decision in plain words; settled title = the question in plain words, else the item id; answer link = the comment carrying the numbered outbox marker, else the plain outbox marker, else the feature PR. An item file that does not parse is left off the list and logged.

## What it costs to change later

A few lines in the view and the reader; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reader expects the recommendation to be option A's text rather than the decision sentence (author).
- Whether a malformed item should appear on the tab as unreadable instead of being left off (author).
