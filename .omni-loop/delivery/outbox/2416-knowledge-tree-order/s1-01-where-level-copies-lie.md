---
id: s1-01-where-level-copies-lie
prd: 2416
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Where on a laptop does a repository keep its read copy of the plan repository's rules and of the workspace's settings rules?

## The decision, in plain words

Each sits in its own folder inside the repository's local, never-committed area, laid out like the repository's own knowledge folder. Nothing fills them yet: the next PRD writes the settings copy.

## The intro, for fun

Every family tree needs an address book for the relatives upstairs.

## The punchline, for fun

We wrote the addresses down; nobody has moved in yet.

## The options, in plain words

A. Two folders in the checkout's local area, laid out as a knowledge folder, read from the checkout's root: the option built.
B. Read the plan repository's level from its newest knowledge pack kept in the main checkout, once a repository can name its plan repository.
C. Commit the copies inside the repository's knowledge folder, so every clone reads the same text without a sync.

## What I had to decide

Where the two read copies above the repository live, and how they are laid out. Built: `.omni-loop/local/tree/plan-repo/` and `.omni-loop/local/tree/omni-settings/`, each a knowledge folder (`playbook/<form>.md`, `adr/README.md`), read from the checkout's own root (`kit/lib/knowledge-tree/levels.ts`). The checkout's local folder is git-ignored, so the copies are never committed (Never 6: the files themselves stay in their own repositories). A worktree reads its own local folder, as the product-knowledge cache does; the knowledge packs read the main checkout instead, which PRD #2417 may adopt when it writes the copy.

## What I did meanwhile

The folders are two constants in one module; a repository with neither copy reads every form exactly as before.

## What it costs to change later

Two path constants and their test; moving them is a one-line change before any copy is written.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how a target repository learns which repository is its plan repository, so something can fill its copy (author)
- whether a worktree should read the main checkout's copies, as the knowledge packs do (author)
