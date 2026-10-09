---
id: s2-01-bell-and-check-outside-the-plan-ground
prd: 1322
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

Showing an approval request in the bell, and proving the new database rules in the automatic checks, both need files the plan did not give to this step. Should this step change them?

## The decision, in plain words

Yes: this step adds an Approvals group to the bell with its own small read, and adds a database check that the automatic checks run, as every new database rule here must have.

## The intro, for fun

The bell had room for one more line, but the bell lives next door.

## The punchline, for fun

So this step knocked, borrowed a nail and hung it.

## The options, in plain words

A. A. Change the bell, add its route, the database check and the publication here (built).
B. B. Leave the bell's drawing and the check to a later slice, and show nothing in the bell until then.
C. C. Read the requests straight from the database in the browser, without a route, as the older bell parts still do.

## What I had to decide

Whether the bell's drawing, its new read route and a new database check are changed by this step, outside the ground the plan gave it.

## What I did meanwhile

The bell (apps/galaxy/src/nav/bell.ts, Bell.tsx, and the count in sidebar.test.ts) gains an Approvals group after Questions, counted in the badge, read from GET /api/waiting/approvals (apps/galaxy/app/api/waiting/approvals/route.ts, served by approvals.controller.ts) every 15 s. supabase/checks/approval_requests.sql proves who is asked, the bell's read and the recipients function, and .github/workflows/supabase.yml runs it, as the conventions require. The migration also adds approvals, approval_voids and approval_requests to Supabase Realtime's publication, which the stream (s3) follows and which no later slice has a migration to do.

## What it costs to change later

Low: the bell group is one function and one prop; the route is two lines; the check is a file and a workflow step. Moving any of them is a rename.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists apps/galaxy/src/waiting/ for the bell, but the bell is drawn in apps/galaxy/src/nav/, and PRD 1318 asks new reads to go through a route rather than the browser's database client.
- (author) Whether s3 wants the requests table in the Realtime publication as well as approvals and voids is not known; it is added so re-asked events can be streamed.
