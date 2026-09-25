---
id: s1-02-worktree-sessions-use-main-checkout
prd: 7
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Which copy of the plugin does a session opened in a side working copy of this repository load?

## The decision, in plain words

It loads the plugin from the main working copy, whatever branch that copy is on, because the settings give a relative folder. This was kept, since an absolute folder would only work on one machine.

## The options, in plain words

A. Keep the relative folder, so every working copy loads the main copy's plugin, the option built.
B. Write an absolute folder, which only works on the machine it was written on.
C. Leave the settings out and load the plugin per session with a command-line flag.

## What I had to decide

The `path` of the `directory` marketplace source in `.claude/settings.json`: relative (`./`) or absolute.

## What I did meanwhile

Kept `"path": "./"`. The docs (…/plugins/org.md) say a relative `directory` or `file` path "resolves against your repository's main checkout. When you run Claude Code from a git worktree, the path still points at the main checkout."

Consequence for the dogfood: a wave subagent in a worktree runs the skills of the main checkout's current branch, not of its own branch; and until this slice reaches the branch the main checkout has out, a session there finds no `.claude-plugin/marketplace.json` and registers nothing. `claude --plugin-dir kit/plugin` loads a worktree's own copy when that matters.

## What it costs to change later

One line in `.claude/settings.json`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave skill will want a worktree to run its own branch's skills; nothing in the spec says so yet.
