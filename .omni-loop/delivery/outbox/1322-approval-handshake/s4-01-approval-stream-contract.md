---
id: s4-01-approval-stream-contract
prd: 1322
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The spec names the two new server calls the waiting command makes, but not exactly what they answer. What do the command and the server agree each answer holds?

## The decision, in plain words

The command expects the people asked by name, whether only the author was left, the author and the product, then four kinds of news with a rising number each: asked, approved, voided and asked again. The server work is built to match.

## The intro, for fun

Two teams build both ends of one phone line at the same time.

## The punchline, for fun

So somebody wrote down what hello sounds like before anyone dialled.

## The options, in plain words

A. A. Keep the shapes as recorded here, with the approved event carrying who, when and how many files.
B. B. Have the approved event carry only its number, and let the kit read the approval again and compare the files before it says approved.
C. C. Have the request answer also the approval already in force, so the kit makes one call instead of two before it waits.

## What I had to decide

Contract the kit relies on (kit/lib/approval/stream.ts, kit/lib/approval/wait.ts), for s2 and s3 to match. POST /api/dossiers/approval/request, body {repo: 'owner/name', prd: number}, answers 200 {asked: [{login: string, name?: string|null}], nobodyElse: boolean, author: string, product: string|null}; nobodyElse true means only the author is asked (asked may then be empty or hold the author). 401 after one token refresh means signed out (exit 1); any other 4xx is 'refused (<status>)', exit 1; 5xx or unreachable is retried as a failed try. GET /api/dossiers/approval/stream?repo=&prd= with Accept: text/event-stream and Last-Event-ID when resuming answers 200 text/event-stream; events: 'asked' and 're-asked' with data equal to the request's reply shape; 'approved' with data {approver: login, approvedAt: ISO time, pinned: number of files}; 'voided' with data {pusher: login, kind: string, from: full sha256, to: full sha256} (the kit prints the first 7 characters); 'ping' and 'reconnect' with no data and no id. Every other event carries an increasing id; the kit drops an id it has seen. 'reconnect' makes the kit reconnect at once; a stream that closes before any message counts as a failed try. An approval already in force is read through the existing GET /api/dossiers/approval before any request. Small choices taken with it: a repository with no product says 'this repository has no other approver'; the approved time prints as the ISO string the server sends, as omni approval does.

## What I did meanwhile

s2 and s3 build their replies to these shapes; the kit's tests stub exactly these shapes.

## What it costs to change later

A renamed field is a one-line change in the kit's schema and in the server's service; nothing is stored in this shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether an approved event should be checked against the files in the checkout; the kit trusts the event and leaves that check to omni approval at the gates
