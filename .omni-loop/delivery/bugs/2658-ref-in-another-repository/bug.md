# Bug 2658: a pull request opened in another repository does not carry its issue's reference

## Triage

- **Domain:** kit — `/omni:pr` point `pr.open` in `--repo` mode, `omni ref`, `/omni:mega-bug-fix` step 7 (PRD 2648)
- **Risk:** medium — a repository that turns `pr.ref` on gets the target pull requests of `/omni:mega-bug-fix` and `/omni:ultra-yolo` without its ticket key or link, so its title check refuses them; a person renames them by hand (Jev, 0.94)
- **Regression:** new bug — no evidence this ever worked (PRD 2648 shipped it in #2649 without the `--repo` case)

## Reproduction

- **File:** `kit/bin/ref.test.ts`
- **Level:** unit
- **Red:** omni ref: unknown flag --repo.

## Fix

A pull request `/omni:pr --repo` opens in another repository (a target of `/omni:mega-bug-fix` or `/omni:ultra-yolo`) never ran `omni ref`, and `omni ref` could only format with this repository's `pr.ref`. `omni ref` now takes `--repo <owner/name>`: it still reads the marker on this repository's issue, and formats with the `pr.ref` the other repository commits on its default branch, read through `gh api`. A repository that commits no config, or no `pr.ref`, keeps the title as it is; a config `gh` cannot read, or that does not read, exits 1 with one line, and the pull request opens with its title unchanged. `/omni:pr`'s `--repo` mode runs it, `/omni:mega-bug-fix` hands each target PR the plan repository's issue (`--issue <n>`), and its record PR is opened with `--issue <n>` too.

## Guard

The reproduction: `omni ref --repo` against a fake `gh` (a target with its own format, with none, unreadable, invalid, written by another kit), and `kit/test/pr-ref-repo.test.ts`, the skills' text naming `--repo` and `--issue` at the steps that open a pull request in another repository. Both fail on the default branch and pass here.

## Mutation

mutation: no changed core file against origin/main (b2a59139): nothing to mutate
