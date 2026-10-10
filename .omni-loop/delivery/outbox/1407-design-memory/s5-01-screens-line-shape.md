---
id: s5-01-screens-line-shape
prd: 1407
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When a change touches a screen that is not locked yet, how should the list of touched screens show its state next to the pages it lives on?

## The decision, in plain words

A locked screen shows a lock, any other shows its state in brackets, and the pages it lives on follow in their own brackets, so a draft reads like this: quote list (draft) (/quotes).

## The intro, for fun

The spec drew a locked screen with its pages and a draft without any, and left the middle blank.

## The punchline, for fun

So the draft got two pairs of brackets, which is one more than most drafts ever get.

## The options, in plain words

A. A. Two pairs: quote-list (draft) (/quotes), a lock on a locked screen: quote-editor 🔒 (/quotes/:id)
B. B. One pair: quote-list (draft, /quotes)
C. C. Pages first, then the state: quote-list (/quotes) draft

## What I had to decide

Keep the two pairs of brackets, or fold the state and the pages into one pair.

## What I did meanwhile

Every touched screen is listed with its state and its pages; the review reads the pages from the same line either way.

## What it costs to change later

A change to one format function and its tests; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's example shows a draft without pages only, so the shape of a draft with pages is a guess (author).
