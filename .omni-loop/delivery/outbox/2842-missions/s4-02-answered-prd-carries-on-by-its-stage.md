---
id: s4-02-answered-prd-carries-on-by-its-stage
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

When a PRD of a mission waits for a person to answer its questions, how does the mission tell it was answered and the work carried on?

## The decision, in plain words

The mission does not follow the fix the page runs once a person answers, and never sends that PRD again itself. It keeps the PRD waiting on answers until the PRD reads ready for review, then waits for its merge.

## The intro, for fun

The mission asked a question and then stared at the door.

## The punchline, for fun

It only looks up when the PRD walks in ready.

## The options, in plain words

A. The PRD carries on by its stage: ready, then merged (built).
B. The mission also follows the auto-fix jobs of the PRD, and stops the PRD, saying why, when one fails.

## What I had to decide

Whether a PRD waiting on answers is seen moving on only through its stage (ready, then merged), as built, or whether the mission should also follow the runner jobs the page's auto-fix sends for it, and react to their ends as it does to its own.

Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Built the PRD's state from its stage first: a PRD at outbox reads waiting for a merge, shipped or retro reads merged, whatever the mission's own runs said. A job of the mission that ended on answers keeps the PRD waiting on answers until then. A done job with no outcome is read as stopped mid-way, as the Runners page reads it.

## What it costs to change later

A constant and one more read: following the auto-fix jobs means reading the runner jobs of the PRD's line beside the mission's own, and mapping their ends with the same table. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) If the auto-fix stops or fails, the mission keeps reading waiting on answers, and only a person sees the fix's own end on the Runners page.
