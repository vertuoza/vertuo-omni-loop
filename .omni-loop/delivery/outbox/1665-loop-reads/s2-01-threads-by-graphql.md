---
id: s2-01-threads-by-graphql
prd: 1665
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The plan said the page reads a change's review the plain way, but that way cannot tell whether a review conversation was closed, nor which changes close an issue. How should the page learn those two facts?

## The decision, in plain words

The page asks those two facts the one other way the code host offers, from the server, under the same budget, while everything else stays the plain way. The kit still never needs the host's own tools.

## The intro, for fun

Two questions the front desk cannot answer, so the page walks to the back office.

## The punchline, for fun

Same badge, same budget, and the kit never leaves the lobby.

## The options, in plain words

A. A. Read threads and closing changes by GraphQL from the server, the rest by REST (built).
B. B. Read everything by REST and answer every thread as unresolved, with no closing changes.
C. C. Read the whole review by GraphQL, one call per change.

## What I had to decide

Whether apps/galaxy/src/loop/github.ts may read review threads (isResolved, the thread's node id that care reply's addPullRequestReviewThreadReply names) and an issue's closedByPullRequestsReferences through GitHub GraphQL, when the spec says review state is read by REST. REST has neither field.

## What I did meanwhile

Built both as POST /graphql through @omni/github's client (resource 'graphql', budgeted, never stored, so no ETag); checks (check runs and commit statuses on the head) and mergeable stay REST with ETags. Threads page 100 at a time, at most 10 pages; GraphQL errors answered with a 200 throw and the route answers 500.

## What it costs to change later

Swapping the two reads for another source is a change inside github.ts and its tests; the contract does not move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A board read of one change now spends GraphQL budget on every call, since GraphQL answers are never served from an ETag; the spec's acceptance 6 (304s on a repeated read) holds for the REST calls only.
- (author) Whether the GitHub App's installation token is granted GraphQL for review threads in every workspace was not checked against a live install.
