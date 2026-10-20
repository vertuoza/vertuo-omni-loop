---
id: s1-02-prd-jobs-among-listed
prd: 2251
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When the terminal asks for a PRD's jobs, how far back should it look: every job ever sent for it, or only the ones the Runners page still lists?

## The decision, in plain words

It looks among the jobs the Runners page lists, the waiting and running ones plus the last fifty that ended, and keeps the ones whose line names the PRD.

## The intro, for fun

A PRD built three weeks and two hundred jobs ago asks to be followed again.

## The punchline, for fun

The terminal only remembers what the page still shows.

## The options, in plain words

A. A. Look among the jobs the Runners page lists (as built).
B. B. Look across every job of the repository, with a new storage read.

## What I had to decide

Whether a PRD's jobs are looked up among the jobs the Runners page lists (as built), or across every job the workspace ever ran.

## What I did meanwhile

GET /api/runners/jobs reads the workspace's queued and running jobs and its last 50 ended ones, keeps those of the repository whose line's first argument is the PRD's number, and answers them newest first. A PRD whose last job ended before the workspace's last 50 answers no job, so the follow waits for one.

## What it costs to change later

A constant: a new read in the runners' storage that filters by repository and line, and a change in the store's fake. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory holds the service, not the storage fake its tests run on, so a new storage read was left out; the jobs a follow needs, the one queued or running and the one just ended, are always among the listed ones.
