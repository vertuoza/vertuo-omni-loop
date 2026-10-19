# Bug 2189: a worktree agent is refused each time it keeps a PR's status comment

## Triage

- **Domain:** Kit skills — the shell recipes agents run (`kit/plugin/skills/`)
- **Risk:** medium — every worktree-isolated agent (runner jobs, wave slices) is refused when it keeps a PR's status comment, so the comment goes stale or the agent spends turns splitting the command itself; the work goes on, the person loses the "is an agent still on this?" signal. (Jev, 0.77)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/test/skills-plain-shell.test.ts`
- **Red:** `× run git and gh as plain commands, never inside $(…)` — five lines found: `pr/SKILL.md:326: ID=$(gh api "repos/$REPO/issues/<n>/comments" --paginate`, `pr/SKILL.md:414`, `pr-care/SKILL.md:176`, `invade/SKILL.md:455`, `mega-invade/SKILL.md:158`

## Fix

`/omni:pr`'s status-comment recipe found the comment with `ID=$(gh api … --jq … | head -n 1)` and an `if`, a construct Claude Code's worktree guard cannot verify, so every agent isolated in a worktree was refused it. The recipe now runs plain commands — one `gh api` that prints the id, then the PATCH or the new comment — and the four other skill lines that hid `git` or `gh` in `$(…)` (`pr`'s merge-base, `pr-care`'s landing rebase, `invade`'s and `mega-invade`'s evidence hash) are split the same way. `kit/dist/omni.mjs` is rebuilt with them.

## Guard

`kit/test/skills-plain-shell.test.ts`: no Markdown file of the plugin's skills runs `git` or `gh` inside `$(…)`; its rule is proven on fixtures, and it fails on main's five lines.

## Mutation

mutation: no changed core file against origin/main (2c408752): nothing to mutate
