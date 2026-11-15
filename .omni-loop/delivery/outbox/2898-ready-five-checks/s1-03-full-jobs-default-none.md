---
id: s1-03-full-jobs-default-none
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The check that the full tests and lint ran needs the names of the jobs that run everything. What should it do in a repository that names none, and how does it recognise a job split into parallel parts?

## The decision, in plain words

A repository that names no job gets that check marked as not judged, with the reason, so it can never pass by accident. A job split into parts counts only when every part succeeded, and a job with another name never counts, even one with a similar name.

## The intro, for fun

Asked to check the full tests, the checker first asks which ones.

## The punchline, for fun

No answer, no pass.

## The options, in plain words

A. No job by default, so the check is not judged until a repository names its own: what was built.
B. Default to test and lint, the names this repository uses.
C. Also count a run whose name ends with the job's name, for jobs run through a shared workflow.

## What I had to decide

`ready.full` has no default the kit can know: job names are each repository's. With `[]` as the default, check 2 reads `not judged · ready.full names no CI job` (BL-GATE-1). A job's run is a check run named exactly the job (`test`) or a leg of its matrix (`test (1)`); `quick` and `test shard 1/3` are other jobs. This repository sets `ready.full: [test, lint]` in s10.

## What I did meanwhile

`ready.full` defaults to `[]`; check 2 matches a run by the job's exact name or by `<job> (`, and every leg must succeed.

## What it costs to change later

A default and one matching line in `kit/lib/ready/checks.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a repository runs its full suite under a job name that a reusable workflow prefixes, as caller / job, which this matching does not read
