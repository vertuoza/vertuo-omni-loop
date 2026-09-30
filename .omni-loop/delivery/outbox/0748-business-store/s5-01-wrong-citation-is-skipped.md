---
id: s5-01-wrong-citation-is-skipped
prd: 748
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When an agent logs that it used a business fact, but names one the business does not have, or gives no run to file it under, what should happen?

## The decision, in plain words

The run under a wrong name is not logged: the agent reads one line saying it was skipped and carries on. Naming the run is optional.

## The intro, for fun

An agent thanked a source that does not exist.

## The punchline, for fun

The thank-you note was returned unopened, and nobody minded.

## The options, in plain words

A. A. The server judges the ids, a wrong one is skipped with exit 0, and the run name is optional, the option built.
B. B. The command refuses a malformed id and a missing run name as a usage error (exit 2), which can stop a think-big run.
C. C. As A, but the run name is required.

## What I had to decide

Whether omni business cited checks claim ids itself and stops with a usage error, and whether --ref is required.

## What I did meanwhile

The ids go to the server as given; a wrong or unknown id comes back 400 or 404 and the command prints a citation skipped line with exit 0. Only no ids or no --by is a usage error (exit 2). --ref may be left out and is stored as null. The server maps an unknown id (P0002) to 404.

## What it costs to change later

A few lines in kit/bin/commands/business.mjs and apps/galaxy/src/business-api/api.ts, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec shows --by and --ref always given, and says any failure skips with exit 0, but does not say whether a malformed id is a usage error or a failure
