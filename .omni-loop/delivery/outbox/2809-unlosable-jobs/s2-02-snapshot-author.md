---
id: s2-02-snapshot-author
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When the runner saves a job's unfinished edits as a commit, whose name should that commit carry when the runner no longer knows which app the job ran as?

## The decision, in plain words

The commit carries the job's app when the runner knows it. When it does not, after a restart, it carries the runner's own name, never a person's.

## The intro, for fun

A note left on the fridge still needs a signature, even when the writer has left the house.

## The punchline, for fun

Signed: the robot who tidied up, and nobody pretending otherwise.

## The options, in plain words

A. A. The job's app when known, else the runner's own name and an address that cannot receive mail (built)
B. B. Always the job's app, its name kept on the runner for the sweep after a restart
C. C. Always the runner's own name, so every snapshot reads as the runner's

## What I had to decide

Keep A, or choose B: sign a snapshot made after a restart as the job's app too, by keeping the app's name and email in the job's token file while it runs.

## What I did meanwhile

`saveJob` (kit/lib/runner/checkpoint.ts) authors the snapshot commit with `job.github`'s login and email at a job's end; for a folder the sweep finds after a restart it uses `omni runner <name>` <`<name>@runner.omni.invalid`>. A resume that fast-forwards onto the snapshot pushes that commit, so the name shows on GitHub.

## What it costs to change later

A constant: B adds the login and email to the token file the runner already writes per job and reads them back in the sweeper. No stored shape on the server changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a commit signed by an `.invalid` address is refused by any repository's push rules (author)
