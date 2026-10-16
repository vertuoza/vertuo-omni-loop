---
id: s4-03-unreadable-entry-runs-job
prd: 2100
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The Omni plugin can show up in the list of installed plugins with no readable version. Should a job in that case be refused, or run like it does when the whole list cannot be read?

## The decision, in plain words

The job runs, and the first line of its log says the version was not read, exactly as for a list that could not be read at all. The runner prints a line only when the version changed or an update failed, never on a job that needed no update.

## The intro, for fun

The plugin is on the list but will not say how old it is.

## The punchline, for fun

The runner takes its word that it is fine, and writes the doubt in the log.

## The options, in plain words

A. Let the job run, with the log's first line saying the version was not read, as for an unreadable list.
B. Refuse the job, naming the missing version as the reason.
C. Update the plugin first, then read again, and refuse only if the version is still missing.

## What I had to decide

The spec lets a job run when the list does not read, and is silent on an entry that is there without a version. Built as: that entry counts as not read, with its own reason in the log's first line. On the same path the runner prints a line only when the plugin's version changed or an update failed, as the spec says for the hourly update; a job that needs no update prints nothing.

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Jobs run on whatever plugin is installed, and the log says the age was not checked. The hourly update still tries to bring the plugin up.

## What it costs to change later

One branch of the runner's plugin file and its tests change if a person prefers refusing; nothing stored or published depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what an entry without a version counts as, nor whether the lines printed on a job's path follow the hourly update's rule (author).
