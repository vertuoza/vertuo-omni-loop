---
id: s3-01-report-repo-must-be-the-workspaces
prd: 855
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

When an agent sends a question and names a code project that does not belong to the team, should the question still be kept?

## The decision, in plain words

The question is refused with one line, the same way reading the business is refused for a project that is not the team's.

## The intro, for fun

An agent walks in from the wrong building and asks the front desk a question.

## The punchline, for fun

The desk points at the sign on the door and says this is not that building.

## The options, in plain words

A. Refuse it, as the read does (built).
B. Keep it, and show the project's name as the agent sent it.

## What I had to decide

Whether a question naming a project outside the workspace is refused, or kept with that project's name on it.

## What I did meanwhile

Such a question is refused; the agent gets the same one-line reason it gets when it reads the business for that project.

## What it costs to change later

One condition in the report function: dropping it keeps such questions, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says what a report stores, not which repositories it may name (author)
