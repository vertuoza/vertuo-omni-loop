---
screen: runner-terminal
status: draft
kind: page
mock: runner-terminal.html
implements: [apps/galaxy/src/runners/page/Terminal.tsx, apps/galaxy/src/runners/page/terminal.css]
reads: [apps/galaxy/src/runners/runners.contract.ts, 'apps/galaxy/app/api/runners/jobs/[id]/lines/route.ts', apps/galaxy/src/ask/page/poll.ts]
routes: ['/app/runners?terminal=<job id>']
supersedes: null
---

## Purpose

A read-only live view of one runner job's log, over the Runners page: one line per step claude
takes (a command, an edit, an error with its output, a pull request, the result), arriving every 5
seconds while the job runs, and the job's last 20,000 lines once it has ended.

## Regions

- **The header:** `job <short id> · <repo> · <runner>`, the job's status with a live dot while
  queued or running, and a close button.
- **The lines:** monospace on the terminal's dark ground, each starting with its time:
  - `✗` lines and their indented output read in the error colour;
  - each `PR:` link opens in a new tab;
  - `Done:` lines are bold.
- **Jump to latest:** shown only while scrolled up from the bottom; its one primary action.
- **Over the page:** it slides over the right side of the Runners page, the whole width under
  720 px; the page behind is dimmed.

## States

- **Following:** at the bottom, new lines scroll into view.
- **Scrolled up:** following stops and Jump to latest shows.
- **Waiting:** "Waiting for the first line…" while running with no line yet.
- **Old runner:** "Update this runner for live logs." with `omni update` to copy, above the
  runner's last 200 lines.
- **Cleared:** "This job's log was cleared." when the job is no longer listed.
- **Dropped:** "Earlier lines were dropped." above the first line, past 20,000.
- **Reconnecting:** "Reconnecting…" in the header after a failed read; the lines stay.
- **Ended:** no live dot, no more reads; every kept line stays.

## Words

Terminal · Running · Queued · Done · Failed · Cancelled · Jump to latest · Close ·
Waiting for the first line… · Update this runner for live logs. · This job's log was cleared. ·
Earlier lines were dropped. · Reconnecting…

## Refusals

- No input of any kind: typing into a job is a later PRD.
- No thinking, and no output of a tool call that succeeded.

## Open questions

- Does the panel offer a way to copy or download the whole log?

## Source

/omni:brainstorm, PRD 1904: .omni-loop/delivery/inbox/1904-runner-live-logs/before-after.html
