---
id: s3-01-runner-hands-messages-to-the-session
prd: 3107
slice: s3
rank: medium
bears-on: none
raised: 2026-11-20
wave: 3
---

## The question, in plain words

A job's claim now carries the fleet's messages, but the runner program that starts each job lies outside this slice. Who should hand the messages to the job's session?

## The decision, in plain words

The session prints the messages from a small file in the job's workspace folder, and the runner will write that file once a later change lets it read the new field of the claim.

## The intro, for fun

The post office now sorts the letters, but nobody has told the courier to carry them.

## The punchline, for fun

Until the courier is briefed, the letters wait in the tray.

## The options, in plain words

A. A. The runner writes a file in the job's worktree, which omni session start reads (as built on the reading side).
B. B. The runner sets an environment variable with the messages, which needs a new entry in the kit's environment module.
C. C. omni session start fetches the messages from the app itself, with the job's id.

## What I had to decide

Add the claim's messages to the runner's job reading (kit/lib/runner/api.ts) and have the runner write them to .omni-loop/local/from-your-people.json in the job's worktree before the agent starts (kit/lib/runner/runner.ts).

## What I did meanwhile

The app side is done and tested: the claim carries the messages, they are marked read, and omni session start prints them from the file. Until the runner writes the file, a job prints no block and the message keeps reading as read by that job.

## What it costs to change later

Small: one field in the runner's job schema and one file write per job, with a test; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice holds kit/bin/commands/session.ts but not kit/lib/runner/, so the runner side could not be built here
