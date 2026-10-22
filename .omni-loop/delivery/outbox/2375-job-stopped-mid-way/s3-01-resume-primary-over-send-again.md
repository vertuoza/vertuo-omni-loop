---
id: s3-01-resume-primary-over-send-again
prd: 2375
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When the Runners page lists both a job stopped mid-way and a failed job, which of their buttons is the page's one primary?

## The decision, in plain words

Resume is the primary: the page marks it first, ahead of the first Send again, because a stopped job left work half built.

## The intro, for fun

Two buttons walk into a page, and only one gets to be loud.

## The punchline, for fun

The one that rescues half-built work wins the spotlight.

## The options, in plain words

A. A. Resume is primary, ahead of Send again (built)
B. B. The first of either, in board order, is primary

## What I had to decide

The spec says Resume is the page's primary when present but not how it ranks against Send again. Built as Resume first; a different answer is a one-line change to the primary choice in the jobs table.

## What I did meanwhile

Resume is primary whenever a stopped job is listed; Send again is primary only when none is.

## What it costs to change later

Changing it later is one line in the jobs table's primary choice and its render test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not rank Resume against Send again when both are listed (author)
