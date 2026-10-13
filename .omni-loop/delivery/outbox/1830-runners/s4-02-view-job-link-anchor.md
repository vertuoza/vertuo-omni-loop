---
id: s4-02-view-job-link-anchor
prd: 1830
slice: s4
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

Once a job is sent, the button links to it on the Runners page, which another part of this work builds at the same time, and the spec does not say how that link points at one job. What should it point at?

## The decision, in plain words

The link opens the Runners page at the job's own spot on the page, named after the job, and the Runners page is asked to give each job row that name so the link lands on it.

## The intro, for fun

Two builders, one door, and nobody said which side the handle goes on.

## The punchline, for fun

We picked a side and left a note on the door.

## The options, in plain words

A. A spot on the Runners page named after the job, which the page gives each job's row.
B. The Runners page with that job opened, its log showing.
C. A page of its own for each job.

## What I had to decide

The shape of View job's link: /app/runners#job-<id> (an anchor the Runners page gives each job row), a query /app/runners?job=<id> that opens the job, or a page of its own per job.

## What I did meanwhile

jobHref() in apps/galaxy/src/runners/send/targets.ts answers /app/runners#job-<id>. Slice s3 (the Runners page, same wave) builds the rows; when merged, each job row needs id="job-<id>" for the link to land on it, otherwise the link opens the page at its top.

## What it costs to change later

One constant in one function, and an id on the Runners page's job rows; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3 gives each job row the anchor is not known from this slice; the wave's merge, or a follow-up line on the Runners page, settles it.
