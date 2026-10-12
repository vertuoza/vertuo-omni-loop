---
id: s3-02-teams-never-clear-a-law
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the owners file names a team rather than a person for a locked law, should a team member's approval clear the change?

## The decision, in plain words

Not yet: only a person named directly counts, because the app is not allowed to read who belongs to a team, so a law owned by a team alone stays red.

## The intro, for fun

The owners file says 'the core team', and the app cannot see who that is.

## The punchline, for fun

When in doubt, the door stays shut.

## The options, in plain words

A. Only a person named directly clears a law; a team owner alone keeps it red (built).
B. Ask for the members permission and let any member of an owning team clear it.
C. Refuse a team in laws.owners, so the CODEOWNERS block only ever names persons.

## What I had to decide

How law-locked treats a CODEOWNERS owner that is a team (@org/team) or an e-mail, which no review can be matched to without reading team membership.

## What I did meanwhile

isPersonOwner (kit/lib/codeowners.ts) counts only @login owners; a file owned by teams or e-mails alone is held as 'no CODEOWNER', red and naming the law. The app's manifest asks for no members permission, so team membership cannot be read.

## What it costs to change later

Reading team membership needs the App's members:read permission (an org admin re-approves it) and one call per team owner; the matching itself is one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says laws.owners holds logins or teams, but not how a team's approval is checked.
- (author) laws.owners is not read by the gate: CODEOWNERS on the base branch is, as the spec says.
