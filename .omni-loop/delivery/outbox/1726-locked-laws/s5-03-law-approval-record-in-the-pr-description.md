---
id: s5-03-law-approval-record-in-the-pr-description
prd: 1726
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Where does the record of who approved a change to a locked law live, so the merge keeps it?

## The decision, in plain words

The pull request skill writes one approval line per approving owner in the pull request's description, just above its signature, taken only from what the outbox check says.

## The intro, for fun

Someone approved the law change; history wants their name in ink.

## The punchline, for fun

The ink is the pull request description, copied from the check that saw the approval.

## The options, in plain words

A. A. Lines in the pull request description, from the outbox check's summary.
B. B. Lines the person merging adds to the merge commit message, the skill only reminding them.

## What I had to decide

Keep A, or choose B and the record is written in the merge commit message by whoever merges.

## What I did meanwhile

A squash merge carries the lines in its message; a merge commit keeps them in the pull request.

## What it costs to change later

Changing where the lines go is one paragraph of the pull request skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No command reports the approvers locally, so the skill reads them from the outbox check's summary; a repository without the GitHub App gets no record (author).
