---
id: s3-01-settings-repo-when-none-named
prd: 2417
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

A workspace may have no plan repository on file. Which repository should then hold the workspace's shared tech playbook?

## The decision, in plain words

The page treats the workspace's plan repository as its settings repository. A workspace that names none gets an empty playbook and a line saying why, never an error.

## The intro, for fun

Every shared rulebook needs a shelf to sit on.

## The punchline, for fun

For now, workspaces without a plan repository simply have an empty shelf.

## The options, in plain words

A. A. Read the plan repository; none named means an empty playbook with a reason (built)
B. B. Add a settings repository setting on the workspace, falling back to the plan repository

## What I had to decide

Pick the repository to read when the workspace names no plan repository: a repository the workspace names for it, or the first repository it lists. Changing the choice is one function (settingsRepositoryOf) in the settings service.

## What I did meanwhile

A workspace with no plan repository reads the kit's first default, as before.

## What it costs to change later

Changing the choice later costs one small function and its test; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether workspaces should be able to name a settings repository apart from the plan repository (author)
