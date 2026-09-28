# Plan: The guide puts omni on the PATH and badges every code block

PRD #373, spec beside this plan (`spec.md`). The feature branch `feat/guide-path-and-badges` merges
into `main` through the feature PR, whose body says `Closes #373`. Each slice is a sub-PR from
`feat/guide-path-and-badges--<slice>` into the feature branch, whose body says `Part of #373`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every code block of the guide carries its badge. Covers: the fence words (`terminal`, `agent`, `file=<path>`, `github`) turned into badges by a step in the guide's markdown compile; the arcade chip in `docs.css` from `--ask-*` tokens only, top right, never over the code at 375 px, not selected on copy; every fenced block of the five pages declaring its kind (both badges on non-interactive terminal commands, TERMINAL alone on `gh auth login`, `claude`, the npm and npx installs and the install PR block); the `release.md` path turned to inline code; Install's sentence on what CODING AGENT on a terminal command means (`!`); the guard refusing a block with no kind, an unknown word, `file` with no path, or `file=`/`github` beside another kind; their tests | `docs/guide/` `apps/galaxy/source.config.ts` `apps/galaxy/src/docs/` | — | 1 |
| s2 | `omni` is on the PATH from Install, and every page writes plain `omni`. Covers: "A shortcut for the omni command" replaced by "Put omni on your PATH" (the `~/.local/bin/omni` wrapper, the `~/.zshrc` line, `exec zsh`, the bash variant, the `omni help` check), badged TERMINAL; Your first PRD and When something goes wrong dropping the "spelled out in full" paragraph and every `node .omni-loop/bin/omni.mjs` in a code block; When something goes wrong's entries for `command not found: omni` and `omni: no Omni Loop kit here`; a test that runs the script text Install shows, from a subfolder of a fixture checkout (the stub kit runs with the arguments) and outside any checkout (exit 2, the one line) | `docs/guide/` `apps/galaxy/src/docs/path` | s1 | 2 |

**Shared ground.** `docs/guide/` is declared by both slices, and the waves keep them apart: s1
(wave 1) badges every block that exists today; s2 (wave 2) rewrites the Install section and the
omni blocks of two pages, and badges the blocks it adds, under the guard s1 put in place. s2's test
file sits under `apps/galaxy/src/docs/path`, inside s1's `apps/galaxy/src/docs/`, and s2 comes after
it, so they never share a wave.

## Per slice: done when

**s1**

- Every fenced block of every page of `/docs` shows at least one arcade chip at its top right, in
  the Omni, light and dark themes, and at a 375 px width no chip covers the code.
- `omni signin`, `omni config` and `git pull` show TERMINAL then CODING AGENT; `gh auth login` and
  `claude` show TERMINAL alone; `/omni:brainstorm …` shows CODING AGENT alone; the `ask:` YAML
  shows FILE · .omni-loop/config.yml; the `1: A` reply shows GITHUB COMMENT.
- Copying a block's code copies no badge text.
- The guard test yields exactly one problem line, naming the page, for a fixture block with no
  kind, with an unknown word, with `file` and no path, and with `github` beside `terminal`; none
  for valid blocks; and "passes the guard" over the real `docs/guide/` is green.
- The compile step's unit test: `terminal agent` gives both kinds in order, `file=<path>` carries
  the path, no meta gives nothing.
- A rendered guide page's block shows its badge text before its code (`docs.test.ts`).
- The design-system guard stays green: the chip names no colour of its own.
- `pnpm test` is green.

**s2**

- Install's "Put omni on your PATH" block, pasted in a new macOS terminal, makes `omni help` work
  from any subfolder of the repository, and in every later terminal.
- The wrapper test is green: from a fixture checkout's subfolder the stub kit runs with the
  arguments passed; outside any checkout it exits 2 and prints
  `omni: no Omni Loop kit here (.omni-loop/bin/omni.mjs). cd into a repository that has it.`
- No guide page holds the alias, nor `node .omni-loop/bin/omni.mjs` in a code block.
- When something goes wrong has the `command not found: omni` and `omni: no Omni Loop kit here`
  entries.
- Every block s2 adds carries its badge, and the guard is green.
- `pnpm test` is green.
