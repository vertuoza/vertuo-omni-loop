---
id: s2-01-terminal-calls-in-the-shared-client
prd: 1246
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The two new terminal commands need to talk to the Omni page. Should they use the one connection every other command shares, even though that file was not on this step's list?

## The decision, in plain words

Yes: the two calls were added to the shared connection, next to the dossier and roadmap calls, so they renew the sign-in the same safe way.

## The intro, for fun

Two new callers, one phone line already wired for everyone.

## The punchline, for fun

We plugged them in rather than run a second cable.

## The options, in plain words

A. Add the two calls to the shared client, beside the dossier and roadmap calls.
B. Write a separate client for ideas inside the slice's folder, repeating the sign-in renewal.

## What I had to decide

Whether the add and list calls join the shared client the other commands use, a file outside this slice's planned ground, or get a client of their own inside it.
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Added two calls, addIdea and listIdeas, to the shared client in the kit's ask folder; no other line of that file changed. The command, its checks and its tests stay in the slice's own folders.

## What it costs to change later

Moving the two calls into their own module is a small refactor: two functions and one import.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice lists the idea folders, the command table and help, but not the shared client every signed-in command calls through.
