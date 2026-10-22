---
id: s8-01-one-ping-per-change
prd: 2425
slice: s8
rank: medium
bears-on: none
raised: 2026-10-22
wave: 6
---

## The question, in plain words

A job can finish and settle on an outcome in the same moment, which changes both its status and its outcome. Should the app that asked for it get one ping or two?

## The decision, in plain words

One ping per change: it says outcome when the job ended with an outcome, and status otherwise, so the app reads the job once and sees everything that changed.

## The intro, for fun

A job finishes, and two things changed at once.

## The punchline, for fun

The app gets one knock at the door, not two.

## The options, in plain words

A. One ping per stored change: outcome when the job ended with one, otherwise status.
B. Two pings when both changed: status first, then outcome.

## What I had to decide

The spec names three events (`status`, `outcome`, `questions`) and says a ping goes out when the status, the outcome or the questions change, but not what a change of two at once sends. I send one ping per stored change: `outcome` when the job ended with an outcome stored (or its outcome changed), otherwise `status`; `questions` when a round opens or closes, on the job that asked. A claim and a run send `status`. A running job asked to stop sends none, since nothing is stored yet and its end will; a runner reporting only a release or only log lines sends none.

## What I did meanwhile

Built the event rule as one small function in the runners' rules and tested each transition: claimed, running, ended with and without an outcome, released, log lines only, stop requested, runner lost, questions asked, answered and dismissed.

## What it costs to change later

Changing it is one function and its tests. An app that reads the job on any ping sees no difference; an app that expects a status ping before the outcome ping would need the second ping added.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether an app wants a separate status ping before the outcome ping when a job ends.
