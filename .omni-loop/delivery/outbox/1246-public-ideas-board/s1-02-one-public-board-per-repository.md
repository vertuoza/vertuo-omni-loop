---
id: s1-02-one-public-board-per-repository
prd: 1246
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Two workspaces could both list the same repository. Which one's ideas board does the public address show?

## The decision, in plain words

Only one workspace at a time can make a given repository's board public. The second one is refused until the first turns its board private again.

## The intro, for fun

Two shops, one street address: the postman needs to pick a door.

## The punchline, for fun

First one to hang the sign gets the mail.

## The options, in plain words

A. A. One public board per repository name; a second workspace is refused while the first is public.
B. B. Put the workspace in the address, so each workspace can publish its own board for the same repository.
C. C. Let the oldest workspace's board win, silently, and hide the others.

## What I had to decide

Whether one public board per repository name is right, or the address should name the workspace too.

## What I did meanwhile

The database refuses a second workspace's attempt to make the same repository's board public; the page reads the one public board by its owner and name.

## What it costs to change later

Dropping the rule later is one small database change; adding the workspace to the address would change the page's links.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives the address as /ideas/<owner>/<repo> and never says what happens when two workspaces list one repository.
