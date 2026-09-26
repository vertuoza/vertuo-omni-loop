---
id: s4-02-for-me-count-on-every-page
prd: 144
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The count of questions waiting for someone sits in the header of every ask page; should it be read fresh each time a page opens, or refreshed while the page stays open?

## The decision, in plain words

It is read fresh each time an ask page opens, and not refreshed while the page stays open. The For me list itself is also read when it opens; reloading shows new questions.

## The intro, for fun

A little number in the corner that says someone needs you.

## The punchline, for fun

It only checks when you walk in, like a doorbell with a short memory.

## The options, in plain words

A. Read once when a page opens
B. Refresh the count and the list every few seconds while the page is open

## What I had to decide

Whether the For me count and list update on their own while a page stays open, or only when a page is opened or reloaded.

## What I did meanwhile

Every ask page reads the count once as it opens; For me reads its list once; the question page itself keeps refreshing every two seconds while open.

## What it costs to change later

Adding a refresh later is a small change to the header and the list; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the header shows the count but not whether it stays current, and Slack notifications come in the next PRD (author)
- Reading the count costs a few small database reads on every ask page load; its weight in production is not known yet (author)
