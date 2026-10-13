---
id: s1-01-briefing-session-budget-raise
prd: 1858
slice: s1
rank: high
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The spec raised the size limits of the rules every agent reads first, but the size check only turns green on a person's answer. Do you confirm the raise?

## The decision, in plain words

The two limits are raised as the spec says, and this question carries your yes to the size check, which only reads answered questions.

## The intro, for fun

The spec already said yes, but the size check only listens to answered questions.

## The punchline, for fun

One quick answer and the check stops holding its breath.

## The options, in plain words

A. A. Keep the raised limits: briefing 4096 bytes, session 10240 bytes, as the spec agreed.
B. B. Keep the old limits and trim the new section, or the agents guide, until both fit again.

## What I had to decide

Answer A to confirm the raise the spec agreed at the design. Budget raise: `briefing` to 4096 bytes. Budget raise: `session` to 10240 bytes.

## What I did meanwhile

The context check stays red on the feature pull request until this is answered; nothing else waits on it.

## What it costs to change later

Each agent session reads about 1 KB more before its first step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says no outbox item is raised for this raise, but the check matches only settled items, so the raise could not turn green without one
