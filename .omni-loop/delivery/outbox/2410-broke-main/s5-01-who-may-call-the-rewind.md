---
id: s5-01-who-may-call-the-rewind
prd: 2410
slice: s5
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

Who may call the two rewind endpoints: a member signed in at the terminal, or also an agent link (an omb_ token)?

## The decision, in plain words

Only a member signed in at the terminal, the same sign-in every other kit push uses. The agent links the page hands out are read-only and do not write anywhere.

## The intro, for fun

The rewind has two doors, and so far only one has a lock that opens for a signed-in member.

## The punchline, for fun

Agent links can still read the room, but they cannot move the furniture.

## The options, in plain words

A. A. Terminal sign-in of a member only (built).
B. B. Terminal sign-in or an agent link, the link resolved to its workspace for the write.
C. C. A new write-scoped agent link made for the rewind.

## What I had to decide

The spec says the endpoints answer only an agent link or a member of the PRD's workspace. An agent link (omb_...) is checked only by the MCP server, read-only, as nobody, with no write path in this app. The endpoints therefore take the member's terminal sign-in (Authorization: Bearer from omni signin), find the PRD's watch among the rows that member can read, and only then insert as the service role. A PRD of another workspace reads as no watch (BR-PRODUCT-63).

## What I did meanwhile

Built both routes on the terminal sign-in alone, as /api/knowledge/changes is: GET /api/rewind/facts and POST /api/rewind/findings in apps/galaxy/app/api/rewind/.

## What it costs to change later

Accepting agent links later means a second check in rewind.controller.ts that resolves the link to its workspace and passes the service that workspace instead of the caller's own read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say which of the two an agent link would resolve to a workspace for a write
- (author) a runner's job signs in with the member's or the app's token, which this slice did not exercise against a real runner
