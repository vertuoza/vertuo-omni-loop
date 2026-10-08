---
id: s3-01-voter-sign-in-joins-nothing
prd: 1246
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When someone signs in with GitHub only to vote on a public ideas board, should that sign-in also try to add them to the workspaces of their GitHub organisations, as a member's sign-in does?

## The decision, in plain words

A sign-in to vote only signs the person in, counts their vote and brings them back to the board. It adds them to no workspace and makes no game player of them, since a voter needs neither.

## The intro, for fun

Someone came in to cast one vote, not to be handed a desk and a badge.

## The punchline, for fun

They vote, they leave, and the guest list stays exactly as it was.

## The options, in plain words

A. A voter's sign-in joins nothing and links no player: it signs in, counts the vote and returns to the board.
B. Run the same joining and linking steps a member's sign-in runs, best effort, before returning to the board.
C. Link the GitHub login to a player only, so a voter shows up in the game, and join no workspace.

## What I had to decide

Whether a voter's sign-in, which asks GitHub for no organisation access, also runs the member sign-in's joining steps (join workspaces by GitHub organisation, finish pending sign-ups, link the GitHub login to a player) or skips them.

## What I did meanwhile

The callback's voter branch exchanges the code, counts the vote and redirects to the board; it never calls the joining steps or link_github(). A person already a member keeps their membership; the next member sign-in joins as before.

## What it costs to change later

Calling the existing settle step from the voter branch of the auth callback: a few lines in one route, no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a voter needs no workspace and their sign-in skips read:org and /signup, but does not say whether the joining and player-linking steps run.
- (author) Without read:org, joining by organisation would only see public memberships, so running it could join some voters and not others.
