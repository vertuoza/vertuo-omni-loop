---
id: s3-02-outbox-last-send-route
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

When a plan's pull request is merged or closed, which part of the GitHub helper should send the Omni page its questions one last time?

## The decision, in plain words

The same part that checks the questions on every push sends the last copy too, but it writes no check and no comment on the closed pull request.

## The intro, for fun

Last orders at the bar, served by the usual bartender.

## The punchline, for fun

Same bartender, no new round on the tab.

## The options, in plain words

A. The usual checker sends the last copy, without checking (as built).
B. A separate helper sends only the last copy.
C. No last copy: the page keeps the questions as they were before the merge.

## What I had to decide

The spec wants one last send with state merged or closed from the pull_request.closed delivery, which today only starts the retro and the knowledge harvest. It does not say which function sends it.

## What I did meanwhile

The webhook turns every pull_request.closed into an outbox-check event with trigger pull_request.closed and its state; the outbox-check function then skips its check run and its comment and runs only evaluate and relay. It shares the function's per-pull-request debounce, so the last event of a burst wins.

## What it costs to change later

A small change in the webhook and the function: a separate relay function would be a new function id, and Inngest must be resynced when it is added.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a closed, unmerged pull request should also clear the page's open questions, which today it does by sending state closed.
