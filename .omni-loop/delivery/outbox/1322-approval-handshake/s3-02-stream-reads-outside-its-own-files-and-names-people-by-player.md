---
id: s3-02-stream-reads-outside-its-own-files-and-names-people-by-player
prd: 1322
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The live approval feed needs to read the PRD's history and say who was asked by name. Where does that reading live, and where do the names come from?

## The decision, in plain words

The reading joins the shared approvals storage file, as the spec's layering asks, and the sign-in check is shared with the request route. Names come from each person's player profile in the workspace, the same place the page shows them, falling back to their account number when they have none.

## The intro, for fun

The feed knew everything that happened, but not everyone's name.

## The punchline, for fun

So it asked the team roster, the one everybody signed.

## The options, in plain words

A. Read in the approvals repository, shape in a stream service, names from player profiles with the account id as fallback (built).
B. Add a database function that names people exactly as the request does, in a migration outside this slice.
C. Read the names with the server's service key, which may call the login function.

## What I had to decide

The plan gives this slice files starting with stream, while the spec says the approvals repository is the only file that reaches the database; and the request rows store who was asked as accounts, not names, while the function that turns an account into a login is closed to signed-in members.

## What I did meanwhile

approvals.repository.ts gains historyRepository (the history read and the Realtime watch, as the caller), approvals.controller.ts exports refusalOf and a new callerOf (the sign-in check both routes use), and the event shaping lives in stream.service.ts rather than approvals.service.ts. The asked people, the author and their names come from the players table (GitHub login in lower case, display name), falling back to the account id when a member has no player row; the product's name from the products table; the approver and the pusher from the logins their rows recorded.

## What it costs to change later

Low: moving the read is a rename; reading names through a database function instead is one migration and one call, with no row changing shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A member with no player row is named by their account id in the stream, where the request's own reply names them by GitHub identity or email; the kit then prints the waiting line again with that id.
- (author) Whether the stream's shaping belongs in approvals.service.ts rather than its own stream file is not settled by the plan.
