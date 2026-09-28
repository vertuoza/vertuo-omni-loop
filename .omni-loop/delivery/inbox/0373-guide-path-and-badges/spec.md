---
prd: 373
title: The guide puts omni on the PATH and badges every code block
blocked-by: none
spec: file
---

# The guide puts omni on the PATH and badges every code block

**Date:** 2026-09-28 · **PRD:** #373 · **Touches:** the Getting Started guide (`docs/guide/*.md`),
its docs guard (`apps/galaxy/src/docs/guide.ts` and its test), the guide's markdown compile
(`apps/galaxy/source.config.ts`) and its stylesheet (`apps/galaxy/src/docs/docs.css`). No CLI change.

## Problem

Feedback from a first read of the Getting Started guide (PRD 346):

1. **`omni` is not a command on the laptop.** Install offers an optional "shortcut",
   `alias omni='node .omni-loop/bin/omni.mjs'`. It works only at the repository's root, only in that
   terminal unless it is copied into `~/.zshrc` by hand, and a reader who skips it meets
   `command not found: omni` on the very next step (`omni signin`). Install and Invade then write
   bare `omni`, while Your first PRD and When something goes wrong spell out
   `node .omni-loop/bin/omni.mjs`: two ways to write the same command.
2. **Nothing says where a block goes.** The guide mixes commands for a classic terminal
   (`git switch …`, `gh auth login`), commands typed in Claude Code (`/omni:brainstorm …`,
   `/plugin install …`), lines to add to a file (`.omni-loop/config.yml`) and a reply to post on a
   pull request (`1: A`). Every one is the same grey rectangle; only the prose around it, sometimes,
   tells them apart.

## Solution

### `omni` on the PATH

- Install's section "A shortcut for the omni command" is replaced by **"Put omni on your PATH"**, in
  the same place (after the install pull request is merged). It is one block, pasted once per
  laptop, that:
  1. writes a small shell script to `~/.local/bin/omni` and makes it executable. The script finds the
     root of the git checkout it runs in (`git rev-parse --show-toplevel`, which is a worktree's own
     root inside a worktree), and runs that checkout's `.omni-loop/bin/omni.mjs` with Node, passing
     every argument through. Outside a git checkout, or in one with no
     `.omni-loop/bin/omni.mjs`, it prints one line to stderr — `omni: no Omni Loop kit here (.omni-loop/bin/omni.mjs). cd into a repository that has it.` — and exits 2;
  2. appends `export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc`;
  3. restarts the shell (`exec zsh`).
- A sentence under it gives the `~/.bashrc` / `exec bash` variant for bash users.
- The step ends with its check: `omni help` from any folder of the repository prints the loop's one
  screen.
- Because the script runs the checkout's own copy, `omni` always matches the kit version that
  repository pins, and works from any subfolder: no global install of the kit.
- Every page then writes plain `omni` in its code blocks. Your first PRD and When something goes
  wrong drop their "On this page, `omni` is short for …, the code blocks spell it out in full"
  paragraph and their spelled-out `node .omni-loop/bin/omni.mjs` blocks.
- When something goes wrong gains an entry, **`command not found: omni`** (or `zsh: command not
  found: omni`): the PATH step was skipped or the terminal predates it; open a new terminal, or do
  the step. And one for the script's own line, `omni: no Omni Loop kit here`: `cd` into the
  repository, or install the kit.
- The skills are unchanged: they keep calling `node .omni-loop/bin/omni.mjs` and never depend on the
  PATH.

### A badge on every code block

- Every fenced code block in `docs/guide/*.md` names **where it goes**, as words after the language
  on its opening fence line. There are four kinds:

  | Fence word | Badge text | Colour token |
  |---|---|---|
  | `terminal` | TERMINAL | `--ask-cyan` |
  | `agent` | CODING AGENT | `--ask-plasma` |
  | `file=<path>` | FILE · `<path>` | `--ask-muted` |
  | `github` | GITHUB COMMENT | `--ask-green` |

  For example: ` ```bash terminal agent`, ` ```text agent`, ` ```yaml file=.omni-loop/config.yml`,
  ` ```text github`.
- A block may name `terminal` and `agent` together, and then shows both badges, TERMINAL first. A
  block names both when it is a terminal command that also runs from Claude Code's prompt with `!`
  in front and asks nothing interactively: every `omni …` block, `git switch …`, `git pull`,
  `git config user.email …`. A block names `terminal` alone when it is interactive, starts or
  installs Claude Code, or changes the shell: `gh auth login`, `claude`,
  `npm install -g @anthropic-ai/claude-code`, `npx github:vertuoza/vertuo-omni-loop init` (it asks
  questions), the PATH step, and the install pull request's `git add`/`commit`/`push`/`gh pr create`
  block. `file=` and `github` stand alone.
- Install says once, before the first block with both badges, what CODING AGENT on a terminal
  command means: type it in Claude Code with `!` before it.
- The badge is the **arcade chip** picked in the brainstorm's badge lab: the pixel face
  (`--ask-px`, Press Start 2P) at 8 px, uppercase, in the kind's colour, a 2 px border and a hard
  2 px offset shadow in the same colour, on the block's own `--ask-sunk` background. It sits at the
  block's top right, inside it, with space kept above the code so the two never overlap; two badges
  sit side by side with a 6 px gap. Every colour is an `--ask-*` token, so Omni, light and dark all
  follow the theme switch. The badge is real text, read by a screen reader before the code, and is
  not selected when the code is copied.
- Blocks that only show a path and are neither run nor pasted (Your first PRD's
  `.omni-loop/delivery/shipped/<n>-<topic>/release.md`) become inline code in their sentence.
- The fence words become the badges when the guide is compiled, through a step in
  `source.config.ts`'s markdown pipeline; nothing is decided in the browser.
- **The docs guard** (`guideProblems`) fails a guide where a fenced block names no kind, names a
  word that is no kind, names `file` with no path, or pairs `file=`/`github` with another kind. Each
  problem is one line naming the page and the block's line.

## Decisions

- **A wrapper script, not a global install.** `npm install -g` of the kit would put a global `omni`
  that drifts from the version each repository pins (PRD 347 releases); an alias works only at the
  root. The wrapper runs the checkout's own copy from any subfolder, and needs no CLI change.
- **`~/.local/bin`**, the usual per-user bin folder, and `~/.zshrc` by default: macOS's shell.
- **Badge words:** TERMINAL and CODING AGENT (the person's wording, generic so it holds for another
  agent later), plus FILE · <path> and GITHUB COMMENT so no block is left without one.
- **Both badges** on terminal commands that also run through `!` in Claude Code, not only one.
- **Style C, the arcade chip**, out of five drawn directions (soft pill, folder tab, arcade chip,
  rail and label, header bar).
- **The kind is declared on the fence, never guessed** from the language or the first word: the
  author says where the block goes, and the guard makes sure they said it.

## User stories

- As a newcomer on a blank laptop, I paste one block and can type `omni` from anywhere in my
  repository, in every new terminal.
- As a newcomer, I see at a glance whether a block goes in my terminal, in Claude Code, in a file or
  in a GitHub comment, before I read the paragraph around it.
- As someone writing the next guide page, the guard tells me when I forgot to say where a block
  goes.

## Scope

In: the five guide pages' text and fences; the fence-word compile step; the chip's CSS; the guard
and its tests.

Out: any change to the `omni` CLI or `omni init` (it could install the wrapper itself later); a
Windows or fish-shell variant of the PATH step; badges anywhere outside `/docs`; copy buttons.

## Test seams

Following `omni kb show testing` (vitest, beside the code, fixtures only, no network):

- **The guard, unit** (`apps/galaxy/src/docs/guide.test.ts`): a page with a block naming no kind, an
  unknown word, `file` with no path, or `github` beside `terminal` yields exactly one problem line
  naming the page; blocks with `terminal`, `agent`, both, `file=<path>` or `github` yield none. The
  existing "passes the guard" test over the real `docs/guide/` stays green, so every real block is
  covered.
- **The fence-word compile step, unit:** a code node whose meta is `terminal agent` comes out
  carrying both kinds, in order; `file=.omni-loop/config.yml` carries the path; a block with no
  meta carries nothing (the guard, not the compiler, refuses it).
- **The rendered page** (`apps/galaxy/src/docs/docs.test.ts`): a compiled guide page's block shows
  its badge text (TERMINAL, CODING AGENT, FILE · …, GITHUB COMMENT) at the top of the block, before
  the code.
- **The stylesheet:** the chip's rules use only `--ask-*` properties (the existing design-system
  test already refuses a colour of its own).
- **The wrapper script:** a test runs the exact script text the Install page shows, from a
  subfolder of a fixture checkout holding a stub `.omni-loop/bin/omni.mjs`, and sees the stub run
  with the arguments passed; run outside any checkout, it exits 2 with the one line above.
- **Manual:** open `/docs/install` in the Omni and light themes, on a phone width and a desktop
  width, and read the badges.

## Risks

Merging publishes the guide's new text and look at `/docs` on the galaxy app's next production
deploy, and nothing else: no CLI, plugin, database or GitHub App change. A wrong line in the PATH
step would reach a reader's `~/.zshrc`; the step only appends one `export PATH` line and writes one
file under `~/.local/bin`, both easy to undo by hand. Rollback: revert the feature PR; the guide
returns to the alias and unbadged blocks.

## Acceptance criteria

- Install has a "Put omni on your PATH" step whose one block, pasted in a new terminal on macOS,
  makes `omni help` work from any subfolder of the repository in every later terminal.
- Outside a repository with the kit, `omni` prints `omni: no Omni Loop kit here (.omni-loop/bin/omni.mjs). cd into a repository that has it.` and exits 2.
- No guide page contains `node .omni-loop/bin/omni.mjs` in a code block, nor the alias.
- When something goes wrong has entries for `command not found: omni` and for the wrapper's line.
- Every fenced block of every guide page shows at least one badge at its top right; the four kinds
  read TERMINAL, CODING AGENT, FILE · <path> and GITHUB COMMENT.
- `omni signin`, `omni config`, `git pull` show TERMINAL and CODING AGENT side by side; `gh auth
  login` and `claude` show TERMINAL alone; `/omni:brainstorm …` shows CODING AGENT alone; the
  `ask:` YAML shows FILE · .omni-loop/config.yml; the `1: A` reply shows GITHUB COMMENT.
- The badges are the arcade chip, readable in the Omni, light and dark themes, and never cover the
  code at a 375 px phone width.
- `pnpm test` is green, and the docs guard fails a guide page with an unbadged block.
