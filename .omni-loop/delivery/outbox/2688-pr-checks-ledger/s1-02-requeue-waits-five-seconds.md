---
id: s1-02-requeue-waits-five-seconds
prd: 2688
slice: s1
rank: medium
bears-on: none
raised: 2026-11-10
wave: 1
---

## The question, in plain words

When a check that already finished is asked again, does it run at once, or after the same five-second pause a brand-new check waits?

## The decision, in plain words

It waits the same five seconds, so a burst of pushes on a pull request whose checks had finished still becomes one run on the latest state.

## The intro, for fun

A finished check hears three pushes in two seconds.

## The punchline, for fun

It waits for the drummer to stop before it plays.

## The options, in plain words

A. Wait five seconds, the option built.
B. Run at once, so a lone event on a finished check is answered five seconds sooner.

## What I had to decide

Whether a finished check, asked again, waits the short pause that gathers a burst of events into one run.

## What I did meanwhile

It waits five seconds, like a new check and like a waiting check that is asked again; a check asked while it runs still goes again at once when it ends.

## What it costs to change later

One value in one database function, changed by a later migration that only replaces it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's table gives the five seconds for a new check and a waiting one, and says only queued again for a finished one (author).
