---
id: s1-01-kit-here-and-quiet-hooks
prd: 420
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When omni is typed in a folder, what counts as a repository that has the Omni Loop, and must the ask-mode hooks also be refused where there is none?

## The decision, in plain words

A repository has the Omni Loop when it holds either its settings file or its own copy of omni. The ask-mode hooks always run and stay silent, even where there is no Omni Loop, as they did before.

## The intro, for fun

A command walks into a folder and asks: is anybody home?

## The punchline, for fun

A settings file on the doormat counts as somebody home.

## The options, in plain words

A. The config or the bin counts as the kit, and the ask hooks always run silently (built).
B. Only the bin counts as the kit, and the ask hooks always run silently.
C. Only the bin counts, and the hooks are refused like any other command, with the one line on stderr.

## What I had to decide

Whether a repository holding only the kit's config counts as having the kit, and whether `omni ask hook` is exempt from the no-kit refusal.

## What I did meanwhile

The launcher treats the config or the repository's own bin as the kit being there, and lets `ask hook` run everywhere; every other command outside a kit exits 2 with the one line.

## What it costs to change later

A constant: the set of commands allowed without a kit and one condition in the launcher's decision.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names only init, help and --version as running without a kit; it does not say whether a repository with the config but no bin has the kit, nor mention the ask hooks.
- (author) Existing tests run the source CLI in such repositories and outside any, and expect the ask commands to work and the hooks to stay silent.
