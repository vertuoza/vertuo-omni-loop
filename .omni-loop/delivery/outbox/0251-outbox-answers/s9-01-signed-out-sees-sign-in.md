---
id: s9-01-signed-out-sees-sign-in
prd: 251
slice: s9
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Should a visitor who is not signed in, or who is not in the team, see the questions on the page, read-only, as the spec's table says?

## The decision, in plain words

For now such a visitor still sees the sign-in card, or a not-found page, exactly as today. The tab itself knows how to show the questions read-only with a line asking to sign in with GitHub, so opening the page to them later is a small change.

## The intro, for fun

The door has a window now, but the curtain is still drawn.

## The punchline, for fun

Anyone can peek once someone opens the curtain.

## The options, in plain words

A. Keep the route as it is: only members see the tab; the read-only state waits until someone opens the route.
B. Let signed-out visitors see the Outbox tab read-only, through the route, and keep non-members out.
C. Let anyone with the link see the questions read-only, members and non-members alike, with the rest of the dossier hidden.

## What I had to decide

The spec's table lists a state for a signed-out visitor or a non-member: the questions, read-only, with Sign in with GitHub to answer here. The page's route decides who sees a dossier at all: signed out it shows the sign-in card, and row-level security answers not found to anyone outside the workspace. The route is outside this slice's territory, and showing a dossier to a non-member means reading it past row-level security.

## What I did meanwhile

Built the read-only state into the tab (a viewer with no session gets the questions read-only, no toolbar, and the sign-in line), tested it, and left the route unchanged, so today nobody outside the workspace reaches it.

## What it costs to change later

A constant, then a route change: letting signed-out visitors through is a few lines in the route; letting non-members read a dossier needs a server read that bypasses row-level security for the outbox part only, and a decision on what else they may see.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec meant non-members to read a dossier at all: the rest of the page is workspace-only by design (PRD 216).
- (author) Whether the read-only view should show the brainstorm and the spec beside it, which are workspace-only today.
