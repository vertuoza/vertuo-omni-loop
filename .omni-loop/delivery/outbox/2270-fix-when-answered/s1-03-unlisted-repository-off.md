---
id: s1-03-unlisted-repository-off
prd: 2270
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

A runner can work on a repository the team never added on its Repositories settings page, so that repository has no switch at all. Should the fix start by itself there?

## The decision, in plain words

No: a repository with no switch is treated as switched off, so nothing starts by itself where no person can see or turn the switch off.

## The intro, for fun

The switch is on by default, but some repositories never got a switch to begin with.

## The punchline, for fun

No switch, no surprise: the runner waits for the button instead.

## The options, in plain words

A. A repository missing from the settings page reads as switched off (built).
B. It reads as switched on, the default of a listed repository.

## What I had to decide

Whether a repository missing from the settings page behaves as switched on, like a new one, or as switched off.

## What I did meanwhile

On such a repository the job keeps waiting until someone sends the fix by hand, or the owner adds the repository to the settings page.

## What it costs to change later

Changing it is one line in the decision; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many repositories run jobs without being on the settings page (author)
