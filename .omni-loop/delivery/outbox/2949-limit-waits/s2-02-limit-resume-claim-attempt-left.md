---
id: s2-02-limit-resume-claim-attempt-left
prd: 2949
slice: s2
rank: medium
bears-on: none
raised: 2026-11-16
wave: 2
---

## The question, in plain words

When a job waits out a provider limit, the server hands the runner its resume as a try 2 or 3, which the runner reads as a recovery after a lost runner. Should the runner say something different for a limit?

## The decision, in plain words

We left the runner's reading of a resume as it is: it accepts tries 2 and 3, and its note says the earlier job was lost. A limit's resume therefore reads as try 2 of 3 and its note says the runner lost the job.

## The intro, for fun

The runner still thinks it was a power cut.

## The punchline, for fun

It was only the meter running out.

## The options, in plain words

A. Leave the runner as it is for now: the note's wording is slightly off for a limit, nothing breaks
B. Have the server tell the runner why the job resumes, and the runner word its note and its try count for a limit

## What I had to decide

Whether the runner needs to know a resume is for a limit: its note (kit/lib/runner/resume.ts) says 'which its runner lost' and counts the try shown as 2 of 3, and a runner lost during the resumed job reads attempt 2 as one try already spent.

## What I did meanwhile

Nothing changed in the runner's resume code; the limit report and the wait it triggers work without it.

## What it costs to change later

Medium: it needs a field on the resume claim (server, contract, runner) and its note's wording.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The server's resume claim clamps the try to at least 2 (resumeClaimOf), so the runner cannot tell a limit's resume from a lost runner's without a new field.
