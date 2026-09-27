---
id: s3-01-rounds-own-workspace
prd: 216
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

The spec links questions to a PRD in two ways: by the terminal session that brainstormed it, and by the PRD's number in its home repository. Should those links also stay inside the workspace the PRD belongs to?

## The decision, in plain words

Yes: a PRD shows only questions asked in its own workspace, and only that workspace's PRDs close a brainstorm. Everyone who can open the PRD sees the same list, and someone in two workspaces never sees one workspace's questions on the other's PRD.

## The intro, for fun

A question wandered into the wrong workspace and asked to be counted.

## The punchline, for fun

It was shown the door, politely, and counted where it belonged.

## The options, in plain words

A. Only questions from the PRD's own workspace, the same list for every reader
B. Every question the reader may open in any of their workspaces, so two readers may see different lists
C. Keep the brainstorm link inside the PRD's workspace, and let the delivery link look wherever the reader can

## What I had to decide

Whether the two linking rules look at every workspace the reader can open, or only at the dossier's own workspace.

## What I did meanwhile

The database function and the page's fake store limit both rules to the dossier's workspace: the ask sessions they read, and the dossier that ends a brainstorm window. The access checks prove that a member of two workspaces sees only the dossier's own workspace's rounds, and that another workspace's dossier with the same Claude session ends nothing.

## What it costs to change later

A change to one function in a follow-up migration. Nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) In practice both rules already stay in one workspace: a dossier and its terminal's ask sessions are placed by the same person and repository. Only an account in two workspaces can tell the difference, and the spec does not say which list it should see.
