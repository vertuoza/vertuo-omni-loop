---
id: s2-01-s2-job-tells-skill-by-line
prd: 2313
slice: s2
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The runner loads a repository's own tool servers only for a job of a repository's own skill, but the program that starts the job is outside this part's files and says nothing of its kind. Is it fine that the job tells its kind from the line it was sent?

## The decision, in plain words

The job reads its own line: a line of one of the loop's own skills runs exactly as before, and any other line, which the runner only lets through as a skill the repository's owner allowed, loads the repository's tool servers when the repository declares them.

## The intro, for fun

The job had to guess its own kind, with only its orders in hand.

## The punchline, for fun

It reads the first word of its orders, and the gate before it already checked the rest.

## The options, in plain words

A. Keep it: the job tells the kind from its line, the runner having refused every other line before it starts.
B. Pass the kind from the runner to the job as a flag, in a follow-up that touches the command that starts the job.
C. Load the repository's tool servers for every job whose worktree declares them, a fixed skill's too.

## What I had to decide

Keep the job telling a repository skill's line from a fixed skill's by the line itself (A), or have the runner hand the job that answer when it starts it, which touches the command that starts the job (B).

## What I did meanwhile

A fixed skill's job runs with the same arguments as before. A repository skill's job runs with --mcp-config .mcp.json only when its worktree holds .mcp.json; the runner refuses any line that is neither a fixed skill nor one the job carries before the job starts.

## What it costs to change later

Low: one function in kit/lib/runner/job.ts; option B adds a flag to the job's command line in kit/bin/commands/runner.ts and passes it from kit/lib/runner/runner.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this part kit/lib/runner/job.ts but not kit/bin/commands/runner.ts, which starts the job and is the only place that could pass the job's kind.
- (author) The plan marks this part as touching a screen, but it changes none: the before/after page says the kit's part has no screen, and the design check found none, so no design review looked at a screen.
