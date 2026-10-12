---
id: s4-03-next-stops-on-no-sign-in
prd: 1665
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The loop's next-step command used to answer 'wait, GitHub is unreachable' on any failed read, while the spec now asks every command to print one line and stop when it cannot read at all. Which should it do?

## The decision, in plain words

When nothing can be read at all (no sign-in, no answer, a page that cannot read the loop yet), it prints that one line and stops. When only one repository is refused, it still answers 'wait' for that work, as before, and carries on.

## The intro, for fun

A traffic light that is off is not the same as a red one.

## The punchline, for fun

So the command now says the light is off, and stops waiting at it.

## The options, in plain words

A. A. Stop with the one line when nothing can be read; keep wait for one repository refused (built).
B. B. Keep answering wait for every read failure, as before, and print no line.
C. C. Stop with the line on any read failure, one repository refused included.

## What I had to decide

omni next caught every read failure into the verdict `wait: github unreachable` (exit 0). The spec's behaviour table and acceptance 3 say no sign-in, no answer and a page without the routes print one line and exit 1, for next too. Built: a LoopReadError of scope `everything` stops the whole run (stderr line, exit 1, no verdict printed); scope `repository` (403/424/429, a 404 with the page's words) keeps today's `wait: github unreachable` for that PRD, and a target refused alone stays `unreadable`. The care command does the same. s6 tells /omni:drive and the other skills to treat the line as held, not failed.

## What I did meanwhile

Tested both: a refused repository still answers wait with exit 0; each of the three whole-run lines prints alone with exit 1.

## What it costs to change later

One condition in next.ts (stopsEverything) and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Until s6 updates /omni:drive, a loop that reads exit 1 from omni next as a failure may stop instead of holding; landing 2 ships s4 and s6 together.
