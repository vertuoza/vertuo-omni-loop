---
id: s5-01-moved-round-refresh
prd: 384
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a question moves to the terminal without an answer, should the open PRD page notice that change on its own?

## The decision, in plain words

The page watches only what the spec named: how many questions, how many answered, and the latest version of each document. A question moving to the terminal changes none of these, so the page shows it on the next other change or reload.

## The intro, for fun

A question slipped out the back door to the terminal, and nobody rang the bell.

## The punchline, for fun

The page will spot it the next time anything else happens, or on a reload.

## The options, in plain words

A. Watch only the three counts the spec named: questions asked, questions answered and the latest version of each document, with no database change. This is what is built.
B. Also count the questions moved to the terminal, which needs a small database change, so a move shows on an open page within two seconds.

## What I had to decide

Whether the change check should also count questions moved to the terminal.

## What I did meanwhile

A question that moves to the terminal still reads as open on a page left open, until the next question, answer, version or reload.

## What it costs to change later

Counting moved questions means adding one count to the database's list function, which is a migration; the page side is one field in the signature.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people leave a PRD page open long enough, while questions time out, for a stale open question to matter (author)
