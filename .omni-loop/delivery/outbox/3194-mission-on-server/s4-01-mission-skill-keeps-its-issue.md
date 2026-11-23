---
id: s4-01-mission-skill-keeps-its-issue
prd: 3194
slice: s4
rank: medium
bears-on: none
raised: 2026-11-23
wave: 2
---

## The question, in plain words

A mission is numbered by its GitHub issue. Now that the page is its record, should the mission skill still open that issue?

## The decision, in plain words

The skill still opens the issue, because the mission's number comes from it and the page needs a number; only the branch, the commit and the docs pull request are gone.

## The intro, for fun

A mission loses its pull request but keeps its ticket.

## The punchline, for fun

Numbers still have to come from somewhere.

## The options, in plain words

A. A. Keep opening the issue; the mission number is its number.
B. B. Number missions on the server and open no issue; needs a server change outside this PRD.

## What I had to decide

Kept: step 2 opens the issue and the brief is written to a scratch folder from mktemp. Changing it later means giving a mission its number another way.

## What I did meanwhile

Missions are numbered by their issue, as before.

## What it costs to change later

One issue per mission stays on GitHub; a person may close it at will.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec removes the docs pull request but is silent on the issue (author)
