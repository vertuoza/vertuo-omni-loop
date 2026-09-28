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

<!-- omni-outbox-settled: s3-01-install-pr-lines-after-closing-steps -->

## s3-01-install-pr-lines-after-closing-steps — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-install-pr-lines-after-closing-steps
prd: 420
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When the install command has opened the install pull request, where in its closing message does it say so, and what does it do when a previous run already left the install branch behind?

## The decision, in plain words

The install pull request gets its own short block at the very end of the message, after the steps a person still takes by hand. A rerun moves back onto the install branch a previous run left, instead of stopping.

## The intro, for fun

The install command finished its chores and wanted to tell someone.

## The punchline, for fun

It waited politely until everyone else had spoken, then said it last.

## The options, in plain words

A. A separate block at the end of the message; a rerun switches back to the existing install branch (built).
B. Print the install lines at the top, before the files written, in the order the steps ran.
C. Fold them into the closing steps now, replacing the commit-and-merge-by-hand line.

## What I had to decide

Whether the install pull request lines stay as the last block, or move into the closing steps when the next slice rewrites them.

## What I did meanwhile

Until the next slice rewrites the closing steps, the message still says to commit and merge by hand above the block that says the commit and pull request are done.

## What it costs to change later

Moving the block is a few lines in one file and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec orders the steps but does not say where their status lines print relative to the existing closing steps

```

<!-- /omni-outbox-settled: s3-01-install-pr-lines-after-closing-steps -->

<!-- omni-outbox-settled: s4-01-init-closing-message-order -->

## s4-01-init-closing-message-order — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-init-closing-message-order
prd: 420
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

In what order does the install command tell a person what it did and what is left for them, now that it also installs the plugin and signs in?

## The decision, in plain words

It lists what it wrote, then the install pull request, then what it did on this computer, then the steps left for a person, numbered: the GitHub App, merging the pull request by its number, the optional protection, and filling the forms. A step it could not do shows the exact lines to type right below its own status.

## The intro, for fun

The install command had a lot to say and one terminal to say it in.

## The punchline, for fun

So it spoke in the order it worked, and saved the chores for last.

## The options, in plain words

A. A. Four blocks: written, install pull request, this computer, then the numbered steps by hand; each fallback under its block (built).
B. B. Fold every fallback (the /plugin lines, omni signin) into the numbered steps by hand, and keep only status lines above.
C. C. One flat list of status lines for every step, then one block of everything left to type.

## What I had to decide

Where the plugin and sign-in status lines and their fallback lines print, and what replaces the old commit-and-merge-by-hand line in the closing steps.

## What I did meanwhile

Four blocks in order: what was written, `Install pull request:`, `On this computer:` (plugin, then sign-in, each fallback printed under the block), then `Then, by hand:` with the App link, `Merge PR #N into <default branch>` and its link, the optional branch protection and `/omni:invade`. The setup and pull request lines print before the plugin and sign-in run, so a person sees progress before the browser opens. This settles the layout the wave 2 item left open.

## What it costs to change later

A few lines in the closing-steps module and the expected output in the init tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec orders the steps and lists what the closing lines print, but not where each step's fallback lines go or what the header of the closing steps says.

```

<!-- /omni-outbox-settled: s4-01-init-closing-message-order -->

<!-- omni-outbox-settled: s4-02-plugin-and-signin-already -->

## s4-02-plugin-and-signin-already — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-plugin-and-signin-already
prd: 420
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

How does the install command know the plugin is already installed or the computer already signed in, and what does it do when the repository has no Omni page address?

## The decision, in plain words

It asks Claude Code which plugins are installed, and counts any kept sign-in as signed in, even an old one. With no Omni page address set, it skips the sign-in and says so.

## The intro, for fun

The plugin moved in last week, and the install command came knocking again.

## The punchline, for fun

The install command checks the list before ringing the bell again.

## The options, in plain words

A. A. Ask Claude Code for its plugin list, count any kept sign-in, and skip the sign-in when there is no Omni page address (built).
B. B. Always run both plugin commands and read their output for already, and renew an old sign-in before saying already.
C. C. As A, but with no Omni page address still print omni signin as a later step.

## What I had to decide

How init detects an installed plugin and a held sign-in, and what the sign-in step does when `ask.url` is null in a kept config.

## What I did meanwhile

`claude plugin list --json` naming `omni@omni-loop` means already installed; `claude plugin marketplace add` runs only when `claude plugin marketplace list --json` lacks the marketplace. Any entry in the credentials file for the `ask.url` host counts as signed in, whatever its expiry (the hooks renew it). With `ask.url` null the step prints `signin  skipped: ask.url is not set` and nothing to type.

## What it costs to change later

A constant: a condition in each of the two step modules and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a plugin already installed or a sign-in already held prints already, but not how either is detected, nor what happens when a kept config has no ask.url.

```

<!-- /omni-outbox-settled: s4-02-plugin-and-signin-already -->
