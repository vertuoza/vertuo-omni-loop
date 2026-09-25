---
id: s4-02-question-moves-on-time
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The waiting side gives up after nine minutes and asks in the terminal instead, but it may not manage to tell the page. Should the page still offer to answer a question that has waited longer than that?

## The decision, in plain words

After nine minutes the page shows the question as moved to the terminal and no longer offers to send an answer, even when nobody told it. Until then it says how many minutes are left.

## The intro, for fun

A bus that left ten minutes ago can still be up on the timetable.

## The punchline, for fun

The page now reads the clock instead of waiting for the driver to call.

## The options, in plain words

A. Stop offering an answer after nine minutes, whatever the page was told, the option built.
B. Offer an answer until the page is told the question moved, even when nobody is waiting for it any more.
C. Stop a little before nine minutes, to leave room for a slow network.

## What I had to decide

The spec: the hook waits up to 540 s in total, then the terminal prompt shows, and the page marks the round "moved to the terminal" once the hook calls `abandon`. When the hook is killed instead (its 600 s timeout, the person interrupting Claude, a machine going to sleep), no `abandon` arrives and the round stays `open`; an answer sent then is stored and nobody reads it. The spec also says a person who takes longer than 9 min gets the terminal prompt, "and the page says so".

## What I did meanwhile

`sessionView` in `src/ask/page/view.ts` reads the newest round as open only while its status is `open`, its questions can be read, and less than `HOOK_WAIT_MS` (540 000 ms) has passed since `created_at`; otherwise it shows "moved to the terminal", with no Send. An older round still `open` under a newer one shows in the history as not answered. The page counts on the server's clock (the offset is taken at render time), and the footer says "moves to the terminal in N min".

## What it costs to change later

One constant; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the kit's 540 s total wait is final: the page repeats the number rather than reading it from the kit, so the two can drift.
