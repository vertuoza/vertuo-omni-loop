---
id: s6-02-approval-route-carries-voids
prd: 1322
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The server's approval page, which no step of this plan owns, drops the news of a void before the checking command reads it. Should this step teach it to pass the void on?

## The decision, in plain words

Yes: the approval page now passes on, with each approval, the pushes that voided it, so the command reads a voided approval as drifted and names who pushed. Nothing else on that page changed.

## The intro, for fun

The news of a void was ready, and the messenger had no pocket for it.

## The punchline, for fun

So the messenger got one more pocket, and nothing else.

## The options, in plain words

A. A. Pass the voids on through the existing approval route (built).
B. B. Have dossier_approval() answer no approval at all once voided, so nothing outside the territory changes, and the kit reads it as pending instead of drifted.
C. C. Add a separate route for voids that the kit calls after the approval route.

## What I had to decide

Whether s6 may change apps/galaxy/src/approval/approval-api.ts, outside its territory, so GET /api/dossiers/approval passes dossier_approval()'s new `voids` on to the kit.

## What I did meanwhile

approval-api.ts's InForce schema reads an optional `voids: [{pusher, kind, from, to, voidedAt}]` and answerOf passes it on with voidedAt in ISO 8601; a test in approval-api.test.ts proves the kit's parseApprovalReply reads it. The kit's ApprovalSchema takes `voids` as optional, so a server without it reads as before.

## What it costs to change later

Low: one optional field in one schema and one line of its mapping; reverting it only makes the kit fall back to comparing files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives s6 kit/lib/approval/approval and the migration, but not the route between them; no other slice owns apps/galaxy/src/approval/.
