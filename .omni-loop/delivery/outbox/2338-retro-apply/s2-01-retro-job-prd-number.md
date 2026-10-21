---
id: s2-01-retro-job-prd-number
prd: 2338
slice: s2
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Where should the Runners page read which PRD a retro job is for? The job's line names only the retro pull request, and nothing the page reads links a retro pull request to its PRD.

## The decision, in plain words

The page shows the words 'retro of PRD' and its number when it is given the PRD of that retro pull request, and the retro pull request number, linked to it, when it is not. For now the live page is not given any, so it shows the pull request.

## The intro, for fun

A retro job knows the pull request it was sent for, but not whose story it retells.

## The punchline, for fun

Until someone tells the page, it names the pull request and keeps the PRD to itself.

## The options, in plain words

A. Show the retro pull request, and the PRD once the page is given it (built)
B. Store the PRD number on the job in a new column, written by the retro app's queue step
C. Read the retro pull request from GitHub on every page load

## What I had to decide

Pick where the PRD number of a retro pull request comes from: the retro app's queue step (slice s4) could store it, or the page could read it from the retro pull request.

## What I did meanwhile

The Runners page shows the retro pull request number, linked, under Omni app. Giving the page the map later changes one read and no stored shape.

## What it costs to change later

A person reading the page sees a pull request number instead of the PRD number until the PRD is wired in.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The migration holds only the sender, as the spec's slice says, so no PRD number is stored on the job (author)
