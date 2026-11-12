---
id: s3-02-thread-url-is-pr-and-id
prd: 2739
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

The page the kit reads gives no link to each review comment, so what link should a kept point carry to say which comment it came from?

## The decision, in plain words

A kept point links to its pull request, followed by the comment thread's own name, and shipping finds the point and the question by that same link; a point a person chose to fix now needs no kept file.

## The intro, for fun

Every comment needs an address, even when the map shows only the street.

## The punchline, for fun

So the street plus the door name it is.

## The options, in plain words

A. Link to the pull request followed by the thread's name, and match on that.
B. Add each comment's link to what the page answers, then link straight to the comment.
C. Match on the reviewer's words instead of a link.

## What I had to decide

The spec names the source `PRD #<n> · <thread url>`, read in `omni ship` "through the reader `omni care` already uses". That reader, the loop's reads (`LoopThreadSchema`, PRD 1665), carries a thread's id and its comments but no comment url, and `kit/test/no-gh-reads.test.ts` forbids a `gh` GraphQL query in `kit/bin/commands/care.ts`. So the thread url is the pull request's url, `#`, then the thread id (`threadUrl` in `kit/lib/care/later.ts`, e.g. `https://github.com/acme/widgets/pull/9#PRRT_x`): `omni care reply --verdict later` finds the thread among the PRD's feature PR and sub-PRs through the loop's reads and writes that url into the follow-up's source and the item; `omni ship` builds the same url for each `later` thread and matches the source exactly and the item by naming it whole. A link opens the pull request, not the comment. An item settled `drifted` (the person chose to fix it in this PRD) needs no follow-up file, since the rework deletes it; without that the PRD could never ship after a fix-it-now answer.

## What I did meanwhile

Built it so, with tests in `kit/bin/care-later.test.ts` and `kit/lib/delivery/ship-review.test.ts` (no file, no item, both, another thread of the same PR, a sub-PR, a closed sub-PR, drifted, unreadable threads).

## What it costs to change later

Low: one function names the url; if the Omni page's contract later carries comment urls, `threadUrl` changes and the follow-up files already written keep the old form, which `omni ship` would then not match.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people want the link to open the comment itself rather than the pull request.
- (author) The spec did not say what a fix-it-now answer does to the file check.
