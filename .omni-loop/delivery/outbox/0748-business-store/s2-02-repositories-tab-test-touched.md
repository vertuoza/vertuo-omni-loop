---
id: s2-02-repositories-tab-test-touched
prd: 748
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Adding the Business tab changed a check on the Repositories page, which this piece of work was not meant to touch. Is that fine?

## The decision, in plain words

Yes: the check lists the Settings tabs, so it now expects Business too. Nothing on the Repositories page itself changed.

## The intro, for fun

We added a door to the hallway, and the room next door noticed.

## The punchline, for fun

Its guest list now has one more name on it.

## The options, in plain words

A. Edit the one test assertion in s2, the option built
B. Leave the test red until s4 takes it, since s4 owns the folder

## What I had to decide

Whether s2 may edit apps/galaxy/src/repositories/render.test.ts, outside its territory, to list the new tab.

## What I did meanwhile

The repositories render test's tabs assertion now expects Fleets · Repositories · Business; no source file under apps/galaxy/src/repositories/ changed. Without it the test fails, since SETTINGS_TABS is shared.

## What it costs to change later

One test assertion; s4, which owns apps/galaxy/src/repositories/, may meet it in a merge.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the Settings path lists s2 owns but leaves out the repositories render test, which lists the tabs too
