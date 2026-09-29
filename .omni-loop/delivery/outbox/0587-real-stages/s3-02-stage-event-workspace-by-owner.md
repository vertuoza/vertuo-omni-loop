---
id: s3-02-stage-event-workspace-by-owner
prd: 587
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When a pull request moves a PRD, how does the app know which workspace the PRD belongs to?

## The decision, in plain words

The workspace is the one named after the repository's GitHub account, the same way questions from the terminal are placed. The message also goes to the production app unless another address is set.

## The intro, for fun

Every letter needs an address, even the ones about PRDs.

## The punchline, for fun

We looked at the name on the mailbox and knocked there.

## The options, in plain words

A. By the repository owner's GitHub org, matching how terminal questions are placed (built).
B. By the App installation id carried in the event.
C. By both: installation first, then the owner's org.

## What I had to decide

Whether stage events are placed by the repository owner's GitHub org, or by the App installation the event came from.

## What I did meanwhile

galaxy places an event in every workspace whose github_org matches the repository owner, case-insensitively; omni-app posts to GALAXY_URL, defaulting to galaxy's production host.

## What it costs to change later

Placing by installation means adding the installation id to the event and one lookup on workspaces.github_installation_id; the event shape gains a field, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A workspace whose github_org differs from the owner of an installed repository gets no instant events, only the sync (author)
