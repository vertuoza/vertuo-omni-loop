---
id: s4-01-live-github-ask
prd: 426
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

How should an open PRD page learn that its stage or its open decisions changed on GitHub?

## The decision, in plain words

Every fifteen seconds the open page asks our own server, which answers from the copy of GitHub it keeps for a minute. The page never talks to GitHub, and GitHub is read at most once a minute per PRD.

## The intro, for fun

A page that keeps asking whether anything changed had better ask politely.

## The punchline, for fun

Fifteen seconds between questions, and the answer is never more than a minute old.

## The options, in plain words

A. A server function asked every fifteen seconds, answering from the one-minute copy
B. A dedicated address under the PRD page, asked the same way
C. Ask every two seconds, with the other checks

## What I had to decide

Whether the page should ask the server through a small server function every fifteen seconds, or through a dedicated address the app serves.

## What I did meanwhile

The page asks through a server function every fifteen seconds; the two-second check of questions and versions is unchanged.

## What it costs to change later

Changing it means moving one small function behind a new address and changing one constant: no data, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the two-second check never calls GitHub itself; it does not say how the page learns of a GitHub change, so this ask was added (author).
- The framework's own guide describes server functions as made for changes rather than reads, and runs them one at a time from the browser (author).
