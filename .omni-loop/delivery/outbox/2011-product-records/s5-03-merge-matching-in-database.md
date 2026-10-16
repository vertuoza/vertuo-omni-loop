---
id: s5-03-merge-matching-in-database
prd: 2011
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a fix's pull request merges, something has to find its row, mark it merged, ship the bug once every fix is in, and remember a merge that matches no row. Does the database do that, or the GitHub App?

## The decision, in plain words

The database does it, through one action only the server may call: it marks the matching rows merged, closed or reopened, says which bug records that merge completed, and keeps a merge that names a bug but matches none of its rows. The App only has to pass on what GitHub told it.

## The intro, for fun

Every fix that merges has to find its own name on the list.

## The punchline, for fun

The database keeps the list, so the App only has to read the news.

## The options, in plain words

A. The database matches, stamps and ships, and keeps unmatched merges; the App passes on GitHub's events (as built)
B. The App matches and decides shipping itself, writing rows through a plainer database action
C. The database stores only the merge time; shipping and unmatched merges are worked out when a page is read

## What I had to decide

Where the matching rule of s7 lives, given that s5 is the only slice of landing 2 that may change the database.

## What I did meanwhile

Built fix_row_stamp(repo, pull, merged|closed|reopened, at, bug?) for the service role alone: a merge stamps merged_at once (a replay keeps the first and ships nothing twice), a close marks an unmerged row closed, a reopen clears it; its answer names each record this merge shipped. A merge matching no row, whose body names a record of a product holding the repository, is kept once in fix_unmatched_merges. Being shipped is read from the rows, never stored: fix_facts carries it in its rows summary, and a product bug's facts show its pull request from the rows.

## What it costs to change later

A constant: the App can match rows itself later and stop calling the function; the table and the function stay, unused, until a follow-up migration drops them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s7 owns the webhook but has no database ground, so its rule had to be settled here before s7 is built (author)
- Whether a merge whose body names no record at all should be kept anywhere is left out: it is dropped (author)
