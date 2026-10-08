---
id: s6-02-hud-outside-repo-checks
prd: 1208
slice: s6
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The band's code is written against Claude Code's own type definitions, which only Claude Code provides, so the repository's linter and dead-code audit cannot read it. How should the repository check it?

## The decision, in plain words

The linter and the dead-code audit skip the band's folder, and Claude Code's own validate and test commands check it instead, run from the plugin guard test whenever Claude Code is installed.

## The intro, for fun

The band speaks Claude Code's dialect, and the repository's linter only reads the house one.

## The punchline, for fun

So the band gets graded by a teacher who actually speaks its language.

## The options, in plain words

A. A. Skip the band's folder in the linter and the dead-code audit, and let Claude Code's validate and test commands check it.
B. B. Pin a copy of Claude Code's type definitions in the repository so the linter and the audit read the band like any other code.
C. C. Install Claude Code in continuous integration so its checks of the band run on every pull request too.

## What I had to decide

Whether skipping the band's folder in the linter and the dead-code audit is acceptable, with Claude Code's own checks standing in for them.

## What I did meanwhile

Two lines outside this slice's ground say so: one in the linter's settings and one in the dead-code audit's settings, each with a comment naming the checks that stand in.

## What it costs to change later

Undoing it means removing those two lines and adding a pinned copy of Claude Code's type definitions to the repository so both tools can read the band; no stored data is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) On a machine without Claude Code, as in continuous integration, the guard test skips the band's checks and says so; nothing else checks the band's code there.
