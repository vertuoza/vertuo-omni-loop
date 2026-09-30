---
id: s1-02-session-end-own-hook
prd: 757
slice: s1
rank: high
bears-on: ADR-0002
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a Claude session ends, the page must hear that it stopped, even when ask mode is off. Should that message ride on the existing end-of-session step of ask mode, or run as a step of its own?

## The decision, in plain words

It runs as a step of its own beside ask mode's, so it goes out whether ask mode is on or off, and ask mode's own step is left untouched.

## The intro, for fun

Two goodbyes at the door: one for the questions page, one for the working light.

## The punchline, for fun

Nobody leaves without waving twice, and each wave has its own hand.

## The options, in plain words

A. A separate end-of-session step for the heartbeat, beside ask mode's (what was built).
B. Fold the heartbeat into ask mode's end step, reworking it so it no longer stops early when ask mode is off.

## What I had to decide

Whether the end-of-session heartbeat is its own hook step, or folded into ask mode's end step.

## What I did meanwhile

The session's end runs two steps: ask mode closes its questions tab, and the heartbeat says the session stopped. A draft the session opened that has since been numbered is reported as that PRD.

## What it costs to change later

Folding it into ask mode's step later means moving one line between two hook steps: minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the end step ask mode already runs also sends it; ask mode's command sat outside this slice's territory and stops early when ask mode is off, so a second step was added instead. (author)
