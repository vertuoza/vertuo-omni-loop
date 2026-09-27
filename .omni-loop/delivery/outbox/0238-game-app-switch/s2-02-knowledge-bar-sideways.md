---
id: s2-02-knowledge-bar-sideways
prd: 238
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

On a phone held sideways, the knowledge map's top bar can no longer hold the name, the repository and all its buttons on one line once Game mode joins it. Which part should move to a second line?

## The decision, in plain words

The buttons move together to a second line, at the left, and the name and the repository keep the first line. On a computer's screen, everything still fits on one line.

## The intro, for fun

The knowledge map's top bar held a name, a repository and three buttons, then the phone turned sideways.

## The punchline, for fun

The buttons took the next line down together, and nobody was left behind.

## The options, in plain words

A. The buttons move together to a second line, at the left, the option built.
B. The repository's name moves under the Omni Loop name, so the buttons keep the first line.
C. The buttons move together to a second line, at the right.

## What I had to decide

Which part of the /knowledge bar wraps at 852×393, now that the bar is wider than the screen there.

## What I did meanwhile

No rule was added for it: the bar's end (.km-bar-end in src/knowledge/knowledge.css) wraps as it already did between 480 and 849 px wide, to the left of the header's second row. At 852×393 it sat on the first row at the right before Game mode joined it; it now wraps too.

## What it costs to change later

One CSS rule in src/knowledge/knowledge.css.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says nothing else in the headers moves; at 852 px wide something has to, and the spec does not say what.
