# Settled outbox items — PRD 420

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-kit-here-and-quiet-hooks -->

## s1-01-kit-here-and-quiet-hooks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-01-kit-here-and-quiet-hooks -->

<!-- omni-outbox-settled: s2-01-docs-page-test-follows-new-install -->

## s2-01-docs-page-test-follows-new-install — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-docs-page-test-follows-new-install
prd: 420
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The test that checks how the guide's pages look still expected the old twelve-step install page, and it sits outside the files this piece of work was allowed to touch. Should it have been left for someone else?

## The decision, in plain words

The test was updated so it checks the new five-step install page and the new help entries instead of the old steps. Nothing else in it changed.

## The intro, for fun

Rewrite the install page, and the test that memorised the old one starts to cry.

## The punchline, for fun

So it got a new page to memorise, and it is happy again.

## The options, in plain words

A. Update the rendering test in this slice, beside the page it checks (built).
B. Leave the rendering test red here, and fix it in a separate slice.
C. Drop the install page's expected blocks from the rendering test, keeping only the badge check on every page.

## What I had to decide

Whether the page-rendering test may follow the new install page in this slice, or should be changed in a slice of its own.

## What I did meanwhile

The rendering test checks the new install blocks (the npm line, omni --version, omni init, git switch main, omni config, /omni:help) and two troubleshooting blocks (gh auth setup-git and the ask: file lines).

## What it costs to change later

Low: one test file, a few expected lines. Undoing it means writing those expectations elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 did not list apps/galaxy/src/docs/docs.test.ts, although rewriting install.md was bound to break it (author).

```

<!-- /omni-outbox-settled: s2-01-docs-page-test-follows-new-install -->
