---
id: s6-01-checks-own-workspace-initech
prd: 2305
slice: s6
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The database checks used to lean on the company's own workspace, which a fresh install no longer creates. What should the checks' own made-up workspace be called, and should every check share one copy of it?

## The decision, in plain words

The checks share one made-up workspace called Initech, with its own GitHub organisation, instead of the demo-org name the plan suggests, because the demo world already owns demo-org and two workspaces of one organisation would make the checks read the demo world's data.

## The intro, for fun

Every test needs a company to pretend to be, and the demo world had already taken the nice name.

## The punchline, for fun

So the checks moved into Initech, where the printers jam but the tests pass.

## The options, in plain words

A. One shared fixture, Initech with organisation initech, included by each check (built).
B. The same shared fixture, renamed to a name the reviewer prefers.
C. Inline the fixture in every check that needs it, with no shared file.

## What I had to decide

Whether the checks' fixture workspace is Initech (organisation initech), shared through supabase/checks/fixtures/initech.sql that each check includes after its begin, or whether it should be renamed or inlined.

## What I did meanwhile

Every check that needed a playing workspace includes the shared fixture and passes locally against a fresh database; the open-source guard is green with the supabase baseline deleted.

## What it costs to change later

Renaming the fixture is a find-and-replace over supabase/checks; inlining it copies about forty lines into each of thirty-three checks. No migration, no production data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The conventions form says each file under supabase/checks is a CI step; the fixture sits in a subfolder and is no check of its own (author).
