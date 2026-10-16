---
id: s4-01-which-plugin-copy-counts
prd: 2100
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The tool that lists installed plugins can show the Omni plugin once for each place it is installed on the runner machine, and the copies can be at different versions. Which copy decides whether the plugin is old enough for a job?

## The decision, in plain words

The runner looks at the copy installed for the machine's user, because a job loads that one, and takes the oldest when there are several, so a stale copy is never hidden by a fresh one. With no user copy at all, it takes the newest.

## The intro, for fun

Three copies of one plugin walk into a runner and each swears it is the latest.

## The punchline, for fun

The runner trusts the oldest one, since that is the one most likely to be wrong.

## The options, in plain words

A. Count the copy installed for the user, the oldest if there are several, and the newest only when there is no user copy.
B. Count the newest copy anywhere, so one fresh copy is enough to start a job.
C. Count the oldest copy anywhere, user or project, so any stale copy triggers an update.

## What I had to decide

The list of installed plugins shows one entry per place a plugin is installed, and the spec does not say which entry a job reads. Built as: entries for the user's own place, or with no place named, are the candidates, and the oldest version among them counts; with no such entry, the newest version among all of them counts. Another rule is a change in one small function of the runner's plugin file, with its tests.

Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

A runner with a single copy behaves the same under every option. With several copies, the job is checked against the oldest user copy and updated when that one is behind.

## What it costs to change later

One small function and its tests change if a person picks another rule; nothing stored or published depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the version is read the way the sync command reads it, but that command reads one entry and does not say what to do with several (author).
- Whether Claude Code loads the user copy or a project copy inside a job's own worktree was checked only on this machine, where the plugin folder keeps each version apart (author).
