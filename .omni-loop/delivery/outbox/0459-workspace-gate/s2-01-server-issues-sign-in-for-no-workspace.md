---
id: s2-01-server-issues-sign-in-for-no-workspace
prd: 459
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The database still refuses to hand a terminal sign-in to someone who belongs to no workspace, and it cannot be asked which workspace a repository goes to by the person themself. Who does those two things while the database rule stays as it is?

## The decision, in plain words

The web app's server does both with its own full-access database key: it hands over the sign-in when the database refused only because the person is in no workspace, and it asks the database where the repository goes. Everyone else's sign-in goes through the database as before.

## The intro, for fun

The front door was locked for people with no house yet, so the porter let them in by the side gate.

## The punchline, for fun

The side gate works, but someone should really fix the front door.

## The options, in plain words

A. A. The web app's server uses its full-access key for these two steps only: handing over a sign-in the database refused for having no workspace, and asking where the repository goes.
B. B. A new database change drops the workspace requirement from handing over a sign-in and lets a signed-in person ask where a repository goes for themself; the server's full-access key is then not needed here.
C. C. Keep the database rule: someone with no workspace cannot sign in from the terminal until they install the Omni App, against the spec's promise that a sign-in is never refused.

## What I had to decide

Whether to keep the server doing these two things, or to add a database change so the sign-in is never refused for having no workspace and the person may ask where a repository goes themself.

## What I did meanwhile

Someone with no workspace signs in from the terminal and sees the install hint; everyone in a workspace signs in exactly as before. On a deployment without the full-access key, someone with no workspace still cannot finish the sign-in, and the sign-in line names only the account.

## What it costs to change later

Switching to option B is a small database change plus removing about thirty lines from the web app; no stored data changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The database change is outside this slice's ground, so it was not tried here (author).
