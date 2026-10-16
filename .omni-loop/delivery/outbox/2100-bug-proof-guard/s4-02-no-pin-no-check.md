---
id: s4-02-no-pin-no-check
prd: 2100
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

A repository can have no copy of the Omni program file at all, so it pins no version. Should the runner still check the plugin before a job in that repository?

## The decision, in plain words

No: with nothing pinned there is nothing to compare, so the runner starts the job without looking at the plugin at all. A repository whose program file is only a small stand-in is checked against the version of the runner's own kit.

## The intro, for fun

No pinned version means no yardstick, and the runner will not invent one.

## The punchline, for fun

A job with nothing to be older than cannot be too old.

## The options, in plain words

A. Check nothing when the repository has no program file, and use the runner's own kit version for a stand-in program file.
B. Check every repository against the runner's own kit version, whether it has a program file or not.
C. Check nothing for a repository without a program file, and nothing for a stand-in program file either.

## What I had to decide

The spec compares the plugin with the version the repository's program file carries, and says nothing about a repository that has no such file. Built as: no program file means no version is pinned and nothing is checked or called; a program file that only hands over to the global one pins the version of the kit the runner itself runs. Checking against the runner's own version for every repository is a change to one condition in the runner's plugin file.

Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Jobs in repositories without a program file start as they always did, on whatever plugin the machine has. The hourly update still keeps the plugin near the latest release.

## What it costs to change later

One condition and its tests change if a person prefers another rule; nothing stored or published depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what a repository with no program file pins, nor what a stand-in program file pins (author).
