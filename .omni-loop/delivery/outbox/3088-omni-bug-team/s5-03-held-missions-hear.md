---
id: s5-03-held-missions-hear
prd: 3088
slice: s5
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-19
wave: 3
---

## The question, in plain words

A mission that stopped on an Omni Loop bug no longer wakes by itself, so it would never hear the bug was fixed. How does it learn, and what does a person's Resume do afterwards?

## The decision, in plain words

The bug team wakes each paused or stopped mission that waited on the bug once, and that mission writes the news in its own room, sending nothing until a person resumes it. After a Resume, a fixed bug still needs the repository's kit at the fix's version, a bug closed as not planned keeps the PRD stopped, and a bug still open goes again as before.

## The intro, for fun

A stopped mission sleeps soundly, even through good news.

## The punchline, for fun

So the bug team knocks once, leaves a note, and lets the person decide when to get up.

## The options, in plain words

A. The team wakes each paused or stopped mission once; a Resume follows the bug (built).
B. A paused or stopped mission hears nothing until a person resumes it, and a Resume sends the PRD again whatever the bug's state, as before.
C. The team writes the news into each waiting mission's room itself, without waking it.

## What I had to decide

How a stopped mission hears that its bug moved, since only a mission that runs or waits checks again each minute, and whether a Resume overrides the bug's state. The spec says a paused or stopped mission waits for its own Resume and the PRD then resumes by the same rule.

## What I did meanwhile

The team, after each of its runs, finds the paused or stopped missions holding a PRD on a bug that was fixed or will not be and that were not told yet, and wakes each by its own job; it writes nothing into another workspace's mission itself. The woken mission records the news once and stays as it was. A Resume follows the bug as described.

## What it costs to change later

Each part is a few lines: the wake is one step after the team's run, and the Resume rule is one check before the new round's.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Only a running team wakes these missions: with no bug team running, a stopped mission hears of the fix at its next Resume.
- (author) The spec does not say whether a Resume should override a bug closed as not planned; keeping it stopped follows the room's words, take this PRD by hand.
