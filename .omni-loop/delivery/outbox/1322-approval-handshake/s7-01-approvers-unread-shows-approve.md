---
id: s7-01-approvers-unread-shows-approve
prd: 1322
slice: s7
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When the page cannot read who a product asks to approve, should a member still see the Approve button?

## The decision, in plain words

Yes: the page shows Approve to every member in that case, and the server still refuses anyone the product does not ask, with its own words.

## The intro, for fun

The guest list fell behind the sofa for a moment.

## The punchline, for fun

So the door stays open, and the bouncer at the server still checks every name.

## The options, in plain words

A. Show Approve to every member while the list cannot be read; the server refuses anyone not asked.
B. Hide Approve from everyone while the list cannot be read, and say why on the page.

## What I had to decide

Whether a failed read of the product's approvers shows Approve to every member, the server deciding, or hides it from everyone until the page reloads.

## What I did meanwhile

A member the product does not ask may see Approve during such a failure; pressing it shows the server's refusal and nothing is approved.

## What it costs to change later

One line in the page's approval view: switching to hiding the button is a constant change, no data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often that read fails in production is not known (author).
