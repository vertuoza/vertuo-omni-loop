---
id: s5-01-ask-command-run-by-the-skills
prd: 315
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

The help screen sorts every command by who runs it. Where does the command behind ask mode go: with the commands a person types, or with the ones the skills run?

## The decision, in plain words

It goes with the ones the skills run. People switch ask mode on and off through the Claude command made for it, and the help for that command still says a person may run it directly.

## The intro, for fun

Every command had a seat at the help table, except one that nobody had invited.

## The punchline, for fun

It sits with the helpers now, and a single line moves it if it would rather be seen.

## The options, in plain words

A. Name it with the commands the skills run, since people use the Claude command for it: the option built.
B. List it with the commands a person types in the terminal, as a row of its own saying it switches ask mode.
C. Name it on the closing line of terminal commands, with the others that have no row of their own.

## What I had to decide

Where `omni ask` shows in the `omni help` overview. The spec's example screen lists every command but two: `help`, which the closing line names, and `ask`, which it leaves out. The spec also says every command must appear in one section. `/omni:ask` runs `omni ask on`, `off` and `status`, and the plugin's hooks run `omni ask hook`; a person can type `omni ask on` too.

## What I did meanwhile

The `ask` entry in `kit/lib/help/entries.mjs` has `who: 'skills'`, so the overview names it on the "Run by the skills" line after `sign`, and `omni help ask` prints it as "run by the skills" with a detail ending "/omni:ask runs on, off and status for you", then the `/omni:ask` skill's entry, "for you". `help` has its own row under IN THE TERMINAL.

## What it costs to change later

One field of one entry in `kit/lib/help/entries.mjs` (and a label for its row, if it moves to the terminal section). No stored data, no test to change: the tests read the table.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example of the overview does not list `omni ask` in any section, while its acceptance criteria ask for every command to appear in one.
