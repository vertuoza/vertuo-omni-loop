---
id: s1-02-answer-after-job-ended
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Can a person answer the questions of a job that has not finished yet, or only once the job has ended and reads Need human?

## The decision, in plain words

Only once it has ended: answering and dismissing are refused until the job reads Need human, so the run that resumes never overlaps the one that stopped.

## The intro, for fun

The job has asked its question, but it is still packing its bags.

## The punchline, for fun

Answering waits for the door to close behind it.

## The options, in plain words

A. A. Answering and dismissing wait until the job has ended and reads Need human.
B. B. Answering and dismissing are accepted as soon as the questions are asked.

## What I had to decide

Pick A to refuse answers and dismissals until the job has ended. Pick B to accept them as soon as the questions are asked, which lets the resume job queue while the first one is still wrapping up.

## What I did meanwhile

A person who tries to answer while the job is still running is told that the job is not waiting for an answer yet. The Runners page only offers the button once the job reads Need human, so the window lasts seconds.

## What it costs to change later

Switching to B is one check removed from the service and one from the database function, plus tests; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what happens between the moment a job asks and the moment it ends (author).
