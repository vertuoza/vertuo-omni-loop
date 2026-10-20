---
id: s1-01-switch-owner-only
prd: 2270
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Who may turn Fix on a runner once answered on or off for a repository? The spec says whoever may change the other repository switches, but anyone in the team changes Public ideas while only the owner changes Phase 0 on the server.

## The decision, in plain words

Only the workspace's owner can change it, the same as Phase 0 on the server, because it decides whether work starts with nobody pressing a button.

## The intro, for fun

Two switches, two different gatekeepers, and a third switch asking which one to copy.

## The punchline, for fun

We copied the stricter one; loosening a lock is easier than explaining why it was loose.

## The options, in plain words

A. Only the workspace's owner changes it, like Phase 0 on the server (built).
B. Any member of the workspace changes it, like Public ideas.
C. Only the owner turns it on, but any member may turn it off.

## What I had to decide

Whether turning the automatic fix on or off is the owner's call alone, or anyone's in the team.

## What I did meanwhile

Only the owner can change the switch; everyone else sees it as it stands. It starts on for every repository.

## What it costs to change later

A follow-up database change rewrites who the switch's save function lets through; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which of the two existing switches the spec meant as the model (author)
