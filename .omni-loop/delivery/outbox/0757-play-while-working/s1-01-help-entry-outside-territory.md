---
id: s1-01-help-entry-outside-territory
prd: 757
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The list of commands the help screen shows lives in a file the plan did not give to this slice. Should the new command still get its line there now?

## The decision, in plain words

Yes: the new command got its line in the help list, and the check that counts the commands now expects one more, since the plan asks for help to list it and the check refuses a command without a line.

## The intro, for fun

The plan said to list it in help, then fenced off the help list itself.

## The punchline, for fun

So the new command came in through the side door and signed the guest book.

## The options, in plain words

A. Add the help line and the new count now, outside the part of the code the plan gave this slice (what was built).
B. Leave help alone and let a later slice add the entry; the command table check fails until it does.

## What I had to decide

Whether a help line for a new command belongs to the slice that adds the command, even when the plan's territory leaves the help list out.

## What I did meanwhile

The help screen names the heartbeat under the commands the skills run, with two sentences on what it does.

## What it costs to change later

Undoing it is deleting one entry and setting a count back: minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory named kit/bin/commands/help.mjs, which prints help but holds no entry; the entries live in kit/lib/help/entries.mjs. (author)
