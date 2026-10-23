---
id: s3-01-line-names-the-prd
prd: 2498
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

When a member approves a lesson nobody wrote down, the job sent to the runner names the PRD and the finding, where the spec names the finding alone. Is that right?

## The decision, in plain words

The job names the PRD first, then the finding. The agent can only read a finding through its PRD, and the Runners page files a job under the PRD its line names first, so the job shows with the PRD's other work.

## The intro, for fun

The spec gave the runner a finding's name and nothing else, like a parcel with no street.

## The punchline, for fun

So we wrote the street on it too, and the postman stopped circling.

## The options, in plain words

A. The PRD's number, then the finding's id, the option built.
B. The finding's id alone, as the spec words it, with a new kit command and route that read one finding by its id.

## What I had to decide

Whether the runner's line for an approved knowledge finding names the PRD as well as the finding.

## What I did meanwhile

Approve queues `/omni:rewind-apply <prd> <finding id>` (rewind.approval.ts); the skill, the help entry and the guide take `<prd> <finding>`. The line still carries no text of the finding, as the spec asks. A glossary or Legal finding that names no term or code also goes to the skill, which asks one question for it (the product's knowledge is not a file of the repository).

## What it costs to change later

One line in the approve plan, the skill's input section, one help entry and two lines of the guide; no stored data changes, and a job already queued runs as it was sent.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec words the line `/omni:rewind-apply <finding id>`, but `omni rewind facts` reads findings by PRD and the kit has no way to read one finding by its id
- (author) the spec does not say where a glossary or Legal finding that names no term or code goes once nothing queues /omni:knowledge-add
