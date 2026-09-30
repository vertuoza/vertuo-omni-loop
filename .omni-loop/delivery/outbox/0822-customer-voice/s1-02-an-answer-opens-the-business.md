---
id: s1-02-an-answer-opens-the-business
prd: 822
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When someone answers a question about the business in a workspace where nobody has opened the Business page yet, should the answer be saved anyway, or dropped?

## The decision, in plain words

The answer opens the workspace's business, exactly as visiting the Business page would, and is saved there, so no answer is lost.

## The intro, for fun

The first guest arrived before anyone had unlocked the shop.

## The punchline, for fun

So the guest was handed the keys, politely.

## The options, in plain words

A. Open it and save: the answer opens the business, as a visit to the page would, and is stored.
B. Refuse and skip: the answer is not saved, and the terminal prints one skip line saying the workspace has no business yet.

## What I had to decide

Whether saving an answered claim may open a workspace's business on its own, or is refused until a member opens the Business page.

## What I did meanwhile

Saving an answer opens the business (named after the workspace, with its first product) when it has none, then stores the claim.

## What it costs to change later

A one-line change in a follow-up migration to refuse instead; a business opened this way is the same as one a person opened.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what happens to an answer in a workspace with no business yet.
