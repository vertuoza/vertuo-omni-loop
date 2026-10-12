# Plan: A world-class AGENTS.md for this repository

PRD #1695, specified in `spec.md` beside this plan. The feature branch `feat/agents-md` merges into
`main` through the feature PR (`Closes #1695`); the one slice reaches it as a sub-PR from
`feat/agents-md--s1` into the feature branch (`Part of #1695`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A root `AGENTS.md` every agent reads, a root `CLAUDE.md` that imports it, and `paths.context` naming it | `AGENTS.md` `CLAUDE.md` `.omni-loop/config.yml` | — | 1 |

One slice, so no ground is shared. The three files only make sense together (a `CLAUDE.md` importing
a missing `AGENTS.md`, or a `paths.context` naming one, is broken on its own), so they are not split.

## Per slice: done when

**s1**
- `AGENTS.md` exists at the root, is at most 150 lines, and has the spec's eight sections in order:
  What this repository is, Before you change anything, Setup, Commands, Generated files, Never, The
  loop, Where to read next.
- Each command in its Commands table was run from the slice's worktree with pnpm 9 and exited 0; its
  row gives the measured wall time and what it needs. A command that did not pass is not listed.
- Setup names pnpm 9 and says pnpm 12 refuses the lockfile.
- Never has one line per Never line of `omni kb show briefing`, and no rule the briefing lacks.
- `CLAUDE.md` is a regular file (`test ! -L CLAUDE.md`) whose whole content is `@AGENTS.md`.
- `omni config paths.context` prints `["AGENTS.md"]`, and the comment above it in
  `.omni-loop/config.yml` describes the root `AGENTS.md` and the `CLAUDE.md` import.
- `.claude/` is unchanged (`git diff --stat origin/main -- .claude` is empty) and no `.agents/`
  directory exists.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
