---
id: s2-02-who-the-terminal-lets-in
prd: 1246
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

Who may add an idea or list a board from the terminal: anyone whose workspace owns the GitHub organisation, or only a member of a workspace that has the repository in its list?

## The decision, in plain words

Only a member of a workspace that lists the repository. Anyone else, even on a public board, gets the same refusal: no workspace of theirs lists it.

## The intro, for fun

The guest list says members only, and the bouncer reads the list.

## The punchline, for fun

Fans can still cheer from the public page.

## The options, in plain words

A. Members of a workspace listing the repository only, for adding and for listing.
B. Members only to add; anyone signed in may list a public board.
C. The organisation-ownership gate dossiers use, through a new database function.

## What I had to decide

Which gate the two terminal calls use: the organisation-ownership rule dossiers use, or membership of a workspace that lists the repository, which an idea needs anyway to be stored.

## What I did meanwhile

Both calls read the repository rows the caller can see (a member sees only their own workspace's), and refuse with 403 when none lists the repository. The list refuses a non-member even when the board is public; the board's page is where everyone else reads it.

## What it costs to change later

Letting anyone list a public board is a one-line change in the list call; switching to the ownership rule needs a database function, so a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says both go through the workspace gate dossiers use, but an idea must belong to a repository row of a workspace, which that gate does not require, and it does not say whether a non-member may list a public board from the terminal.
