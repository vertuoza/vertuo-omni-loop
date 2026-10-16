---
id: s7-01-stamp-runs-as-an-app-job
prd: 2011
slice: s7
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

When a fix is merged, closed or reopened, should the GitHub App record it on the bug through a background job of its own that retries on failure, rather than through the arcade?

## The decision, in plain words

The App records the change through a background job of its own, which writes to the database directly and tries again when the database fails. The arcade's stamp page was not built, and two tests that list the App's jobs now list this one too.

## The intro, for fun

A merge happened, and someone has to write it in the logbook.

## The punchline, for fun

The App holds the pen itself, and tries again if the ink runs out.

## The options, in plain words

A. The App's own background job writes to the database, with retries (as built)
B. The App forwards each change to an arcade route that writes to the database, signed as the stage events are
C. The App writes to the database while it answers GitHub, with no job and no retry

## What I had to decide

Keep the App's own job, or move the write behind an arcade route.

## What I did meanwhile

Built `apps/omni-app/src/fix-rows/` (the event, the service-role call of fix_row_stamp(), the `fix-row-stamp` Inngest function, retried 3 times) and registered it in `functions.ts`. The webhook hands its events to a new `sendStamps`. `apps/galaxy/app/api/fixes/stamp/` was not created. Outside the territory, `apps/omni-app/src/functions.test.ts` and `apps/omni-app/src/outbox-check/inngest-route.test.ts` each gained the new function id and count (eleven functions, sixteen with failure handlers); `apps/omni-app/entries/inngest.ts` still says ten in its header comment.

## What it costs to change later

A constant: the function's step could POST to a galaxy route instead of calling the database; the event and the webhook stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists both `apps/omni-app/src/functions.ts` (register the stamp) and `apps/galaxy/app/api/fixes/stamp/`, and the spec does not say which side writes; s5's note says to call fix_row_stamp() as the service role, which the App already holds.
- (author) Every registered function is listed in two tests outside the territory, so registering one cannot be done inside it.
