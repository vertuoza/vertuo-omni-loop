---
id: s5-01-acceptance-check-carries-the-report
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The proof of each success criterion travels as a check on the latest change, and the ready gate and the Omni App read it from there. Where in the check does the proof sit, and who writes the check when a runner, not the continuous checks, still has to run the screen tests?

## The decision, in plain words

The check carries the full proof as its detailed text, with a short table on top for people. When the screen tests wait on a runner, the continuous checks write no check at all and keep the proof as a downloadable file, so the App writes the one check once the runner is done.

## The intro, for fun

Two couriers, one parcel, and a label that says who signs for it.

## The punchline, for fun

Whoever finishes last seals the box.

## The options, in plain words

A. The check's detailed text is the proof; while a runner still has to run the screen tests, no check is written and the proof is kept as a file for the App: what was built.
B. Always write the check from the continuous checks, marked as waiting, and let the App add a second one once a runner is done.

## What I had to decide

s1's `kit/lib/ready/report.ts` fixes the report's format and the check run's name, `acceptance`, but not where in the check run the report sits; s3 (`omni ready`'s `gh` reader) and s8 (the App's runner fallback) read it, in the same wave or later. A check run can only be completed by the app that created it, and the ready rule's check 1 counts every check run of the head commit: a run CI left going for a runner would stay `in_progress` there forever, and a second `acceptance` from the App would sit beside it.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

`scripts/acceptance-report.ts post` writes the check run `acceptance` with `output.text` the report exactly as `renderAcceptanceReport` prints it (so `parseAcceptanceReport(output.text)` reads it), `output.summary` one table row per criterion, conclusion `success`, `failure` or `neutral` (no `AC-<n>` criterion). When an `e2e` criterion is `pending` (`e2e.ci` false, no key, no `e2e.url`), it posts nothing and the `acceptance-report` artifact of the `checks` run holds the report for s8.

## What it costs to change later

The few lines of `postCheckRun` and `verdictOf` in `scripts/acceptance-report.ts`, and the readers s3 and s8 write against them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how s3 and s8, built beside this slice, read the check run: if either expects the report elsewhere, one of them changes
