---
id: s7-03-approval-label-looks-up-once
prd: 2688
slice: s7
rank: medium
bears-on: none
raised: 2026-11-10
wave: 3
---

## The question, in plain words

When the approval label changes on a PRD, the App looks up that PRD's open pull requests on GitHub once, right after answering, to re-run their approval checks. If GitHub refuses at that moment, should the App try again later, or wait for the next push?

## The decision, in plain words

The lookup runs once and a failure is written to the log. The next push, or a press of Re-run, brings the check back.

## The intro, for fun

The label changed, so someone has to knock on every open door.

## The punchline, for fun

They knock once; if nobody answers, the next push knocks again.

## The options, in plain words

A. A. As built: one lookup right after the answer, logged when it fails.
B. B. A job of its own for the label change, retried like any other, which then re-runs each pull request's check.

## What I had to decide

Answer A to keep it, or B to make the approval's re-run its own kind of job that retries (apps/omni-app/src/webhook/github-route.ts, approvedRerunJobs).
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

A label change re-runs the approval check on every open pull request of the PRD, unless GitHub refuses that one lookup.

## What it costs to change later

B is one more kind of job and its handler, with no stored data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says the webhook refreshes each pull request's approval job but not what happens when GitHub refuses the lookup.
