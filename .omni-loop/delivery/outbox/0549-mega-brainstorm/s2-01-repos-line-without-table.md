---
id: s2-01-repos-line-without-table
prd: 549
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When a plan names a repository for each piece of work but forgets the list of repositories, or cannot be read at all, what should the PRD summary say?

## The decision, in plain words

The summary still names every repository the pieces of work mention, in the order they appear, and says nothing about repositories when the plan cannot be read yet.

## The intro, for fun

A guest list got lost, but the seating chart still has names on every chair.

## The punchline, for fun

So we read the names off the chairs and let the plan checker scold the host.

## The options, in plain words

A. Table order, then slice-only repositories; no repos line for an unreadable plan (built).
B. Only the Repositories table; a repo column with no table prints no repos line.
C. An unreadable plan makes omni prd fail, so yolo and wave stop on it.

## What I had to decide

Whether the repos line lists repositories named only in the slice table, and whether an unreadable plan prints no repos line.

## What I did meanwhile

omni prd lists the Repositories table first, then any repository only a slice names, in slice order; a plan that fails to parse prints no repos line. omni plan check still refuses both plans.

## What it costs to change later

One function in kit/lib/delivery/prd.mjs; changing it is a few lines and a test, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec only names the Repositories order; the fallback is the author's reading (author).
