---
id: s7-02-visual-fix-asks-the-screen-owner
prd: 1407
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 5
---

## The question, in plain words

A quick visual fix may change a screen someone has locked. Should that fix wait for the person who locked the screen to answer, the way a change to a rule does?

## The decision, in plain words

Yes: the fix is built and its pull request opens, with one question for the screen's owner that keeps it from going green until they answer.

## The intro, for fun

Someone put a padlock on the sidebar, and a paintbrush just showed up.

## The punchline, for fun

The brush waits politely while the padlock's owner reads the note.

## The options, in plain words

A. A. Build the fix and ask the screen's owner through one high question on its pull request (built)
B. B. Stop the visual fix on a locked screen and hand over to a full design run

## What I had to decide

Whether a visual fix whose pick departs from a locked screen raises one high question in the fix's own folder for the person who locked it, as a change to a rule already does, or simply stops and hands over to a full design run.

## What I did meanwhile

The visual-fix skill applies the pick, leaves the locked screen's file and mockup untouched, and writes one high item per locked screen in the fix folder's outbox, naming the screen and who locked it, with the amendment line left for the owner's words; no account is written, since no check names a locked screen in a visual fix.

## What it costs to change later

A section of the visual-fix skill: switching to a stop is replacing that section with a pointer to its existing stop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a change to a locked screen raises a high item, but the visual fix had an outbox only for changes to a rule until now
- (author) omni visual does not read locked screens, so nothing but the outbox check holds the pull request
