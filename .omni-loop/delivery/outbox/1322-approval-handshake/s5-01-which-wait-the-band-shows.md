---
id: s5-01-which-wait-the-band-shows
prd: 1322
slice: s5
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec says the band above the prompt shows the waiting line and a ten-second highlight, but not which wait it shows when several are kept, nor how quickly it notices the approval.

## The decision, in plain words

The band shows the wait of the PRD the session is on first, else the most recent one still waiting. While a wait runs it checks every five seconds, so the approval appears within seconds and stays highlighted for its ten seconds.

## The intro, for fun

The band only looks up every thirty seconds, and the highlight lasts ten.

## The punchline, for fun

So while someone waits, it glances up every five.

## The options, in plain words

A. A. The session's PRD first, else the latest live wait; check every 5 seconds while waiting (built).
B. B. Only the session's PRD's wait, never another PRD's.
C. C. Keep the 30-second check and start the 10 seconds when the band first sees the approval rather than when it was written.

## What I had to decide

omni now adds an optional wait key { prd, line, toast, until } to its answer, read from .omni-loop/local/approval-wait/<n>.json (the folder name repeated as a constant in kit/lib/now/wait.ts): the work's PRD's file first, else the latest file by its at time that shows something. waiting or held shows the waiting line (the line itself when no one was asked yet); approved or voided shows that line as a toast until at + 10 s, then the waiting line again after a void and nothing after an approval; signed-out, timeout and refused show nothing. The key is absent when nothing shows, so answers without a wait are unchanged. The band adds a wait row after the work and before its links (a toast row drawn inverse and bold), asks omni now every 5 s while a wait shows and once more when the toast ends.

## What I did meanwhile

Built as decided, with tests on the reading (kit/lib/now/wait.test.ts) and on the band (kit/plugin-hud/tests/hud.test.tsx). The plain omni now output prints the wait's line last.

## What it costs to change later

Low: the poll interval, the order of preference and the row's place are constants in kit/lib/now/wait.ts and kit/plugin-hud/hooks/band.ts; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A wait killed with Ctrl-C leaves its file in the waiting state, and the band keeps showing the waiting line until a later wait rewrites it; the wait command, outside this slice, could clear it on exit.
- (author) Polling omni now every 5 seconds runs a short node process that often for as long as a wait lasts (60 minutes by default).
