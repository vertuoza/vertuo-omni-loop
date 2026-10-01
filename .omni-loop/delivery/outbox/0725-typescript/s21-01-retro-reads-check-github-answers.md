---
id: s21-01-retro-reads-check-github-answers
prd: 725
slice: s21
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When GitHub answers one of the retro's questions in a shape it should never have, should the retro stop and say which part was wrong, or carry on as it used to?

## The decision, in plain words

It stops that read and names the part that was wrong, and the read is tried again later as any failed read is. Every answer GitHub has given so far reads exactly as before.

## The intro, for fun

The retro asks GitHub about every check that ran, and GitHub has always answered politely.

## The punchline, for fun

If it ever mumbles, the retro now asks it to repeat itself, by name.

## The options, in plain words

A. A. A malformed answer fails the read with an error naming the field, and the step is retried; well-formed answers read exactly as before
B. B. Treat a malformed answer like an unreadable one: the section says it could not be read
C. C. Keep passing malformed answers through as before, and describe their shape only for the compiler

## What I had to decide

PRD 725 asks every value read from the network to pass a schema and fail with an error naming its field. The retro's kinds of finding (apps/omni-app/src/retro/kinds/) read workflow runs, jobs, issues, pull requests, changed files, commits, comments, reviews, issue events and the review-threads GraphQL answer field by field, most with fallbacks, and passed anything else through: a job with no name would have been counted as a check called undefined.

## What I did meanwhile

apps/omni-app/src/retro/kinds/schema.ts holds one loose schema per answer, naming only the fields the kinds read. A field the kinds read with a fallback is nullish there, so it reads as before; the fields they cannot do without (a run's or a job's id, a job's name, an issue's number, link and opening time, a closed pull request's number and link, a file's name, a commit's sha, an issue event's kind and time) are required. A malformed answer throws a Zod error naming its path inside the gather step, which Inngest retries like any other failed read; the 403, 404 and 410 handling is unchanged.

## What it costs to change later

Cheap: make a field nullish in the folder's schema file, or drop one parse; no stored shape changes, and the records each kind keeps are the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether GitHub ever sends a job without its name, or an issue without its link; its REST answers always carry them so far (author)
- Whether a step that now fails on a malformed answer should rather leave that section out of the retro, as an unreadable answer does (author)
