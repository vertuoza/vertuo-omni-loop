---
id: s5-01-resume-note-in-the-prompt
prd: 2809
slice: s5
rank: medium
bears-on: none
raised: 2026-11-13
wave: 4
---

## The question, in plain words

When a job picks up the work of a job that was lost, how should its agent be told to read the note about what came back, before anything else?

## The decision, in plain words

The note is pointed at in the agent's first message, right after the job's own command. A side effect: if the job later has to switch to another account, it only switches to an account that accepts every kind of job.

## The intro, for fun

A relay runner needs the baton and a sticky note saying which lane to run in.

## The punchline, for fun

We stuck the note on the baton itself, which is not where batons expect notes.

## The options, in plain words

A. The note is pointed at after the job's line, in the line file; a resume turns over only to accounts that take any job (built)
B. The runner passes the note as an option of the job's process, which adds it to the first message; the line stays one line
C. Keep the pointer in the line file, and fix the job process to read the first line alone for the skill

## What I had to decide

Keep A, or choose B: the runner hands the note's path to the job's process as an option of its own, and the process adds it to the first message; the job's own command stays a single line.

## What I did meanwhile

runner.ts writes the job's line file as `<line>\n\n<pointer>`, the pointer naming ~/logs/job-<id>.resume.md (resumePointer in kit/lib/runner/resume.ts). job.ts, outside this slice's territory, reads the whole file as the line and sends it as the prompt, so the session reads the pointer after its line. The same file read by skillOf() in job.ts no longer reads as a fixed skill, so a turnover of a resume picks only accounts with no `takes` list.

## What it costs to change later

A constant: B is one flag in kit/bin/commands/runner.ts and job.ts (or a one-line fix in job.ts reading the first line for the skill), and the runner writing the line alone again. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice runner.ts but not job.ts or the runner command, where a flag for the note would live.
- (author) Whether any runner's accounts file restricts accounts with `takes` today is not known here.
