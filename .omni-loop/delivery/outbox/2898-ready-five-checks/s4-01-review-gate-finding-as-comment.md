---
id: s4-01-review-gate-finding-as-comment
prd: 2898
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

When the Reviewer's pass is blocked by a red ready check, where should the failing check be written down?

## The decision, in plain words

The Reviewer leaves the pull request a draft and posts the failing check as one signed comment, because its review is already posted for that round and cannot hold a second one. A check still running or unreadable ends the run on a stop line instead of asking for changes.

## The intro, for fun

The five checks are lined up, and one of them just dropped the ball.

## The punchline, for fun

The Reviewer writes it down, signs it, and keeps the draft a draft.

## The options, in plain words

A. A. One signed pull request comment naming the failing check; not finished or not judged ends on a stop line.
B. B. Post it as a second review round carrying the check as a finding on a changed line.

## What I had to decide

A person decides whether a red ready check should instead open a new round of the review.

## What I did meanwhile

The draft stays a draft and the check is named on the pull request.

## What it costs to change later

A reword of two skill paragraphs and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a red verdict ends changes with the failing check as its finding but not where that finding is posted when the round's review already exists (author).
