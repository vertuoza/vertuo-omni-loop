---
id: s7-01-lost-job-offers-no-button-while-resuming
prd: 2809
slice: s7
rank: medium
bears-on: none
raised: 2026-11-13
wave: 5
---

## The question, in plain words

While a lost job is waiting for its automatic resume, should the Runners page still offer Send again on the lost job?

## The decision, in plain words

No: the lost job shows no button while its resume exists, because pressing Send again would queue the same work twice. The resume has its own Cancel, and Lost 3 times offers Resume.

## The intro, for fun

Two people are about to send the same pizza order, and the first order is already in the oven.

## The punchline, for fun

The page hides the second phone until the first pizza is cold.

## The options, in plain words

A. A. The lost job shows no button while its resume exists (built)
B. B. Send again stays on the lost job, beside the automatic resume
C. C. Send again stays but is greyed out with the words the resume is queued

## What I had to decide

Keep A, or choose B: Send again stays on the lost job and queues a second chain beside the automatic resume.

## What I did meanwhile

RunnersPage.tsx returns no action for a job that reads Lost · resuming, and never makes it the page's primary action; Lost 3 times shows Resume, which sends the line again as the person who presses it. The board also lists each save of the jobs it shows (runners.service.ts reads them through the existing savesOf, one more read per board), so the page can say what came back and what a runner keeps.

## What it costs to change later

A constant-sized change in one component: B is the previous behaviour, one line to restore.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says what the lost job reads and what its resume reads, and says nothing about its buttons while the resume waits.
