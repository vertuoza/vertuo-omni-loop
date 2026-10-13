---
id: s1-02-runner-workspace-from-repos
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

A person can belong to several workspaces, and a runner does not say which one it joins. Which workspace does a new runner register in?

## The decision, in plain words

A runner joins the workspace its repositories belong to for the person who starts it. All its repositories must belong to that one workspace, and a runner's name stays with the person who first registered it.

## The intro, for fun

A runner walks into a building with three front doors.

## The punchline, for fun

It takes the one its repositories have the keys to.

## The options, in plain words

A. The workspace its repositories belong to, all in one workspace; a name is its first owner's
B. Add a workspace field to register, defaulting to the person's first workspace
C. One runner may serve repositories of several workspaces, one row per workspace

## What I had to decide

How register picks the runner's workspace, and who may register a name again.

## What I did meanwhile

register asks repo_workspace() for each repository (lower-cased, duplicates dropped) and refuses with 403 when one is outside the caller's workspaces or when two land in different workspaces. A name already registered by another person in that workspace is refused with 403; the same person registering again updates slots, repositories, version and the check-in.

## What it costs to change later

A constant: a later change could add a `workspace` field to the register body, which the contract refuses today, without touching stored rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the runner registers with the Omni app but not how the workspace is chosen (author).
