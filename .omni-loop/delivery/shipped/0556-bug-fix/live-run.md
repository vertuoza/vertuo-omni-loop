# Live run: /omni:bug-fix (PRD 556, slice s3)

2026-09-29. `/omni:bug-fix` was followed as written on the feature branch,
`kit/plugin/skills/bug-fix/SKILL.md` on `feat/bug-fix` (the installed plugin is older), twice on
this repository (vertuoza/vertuo-omni-loop): once on a real bug, once on a report of a flaky check.

| run | issue | pull request | ended |
| --- | --- | --- | --- |
| live run, a real bug | [#571](https://github.com/vertuoza/vertuo-omni-loop/issues/571) | [#573](https://github.com/vertuoza/vertuo-omni-loop/pull/573), into `main`, ready, not merged | PR open, `omni bug 571` printed `ok` |
| live stop, a flaky check | [#570](https://github.com/vertuoza/vertuo-omni-loop/issues/570) | none | `Kind: tooling` triage comment, stop rule 1 |

## Live run: #571, omni reads 1e2 or 0x10 as a PRD number

**The bug, seen before any issue was opened.** On `main`, `omni prd 0x10` looked up PRD 16 and
`omni prd 1e2` printed PRD 100 (`0100-workspaces`), while `omni prd 1.5` and `omni prd 556abc` were
refused with "must be a positive number". Every command reads its numbers through `positiveInt` in
`kit/bin/args.mjs`, which used `Number()`: it takes exponents, hex/octal/binary prefixes, a sign and
spaces.

What was seen, step by step:

1. **Issue.** Opened from a one-line description as [#571](https://github.com/vertuoza/vertuo-omni-loop/issues/571),
   title `Bug: …`, body with the skill's paragraph and the signed footer.
2. **Classify.** A behaviour bug: a CLI user observes it.
3. **Triage.** One comment with the `<!-- omni-bug:triage -->` marker
   ([comment](https://github.com/vertuoza/vertuo-omni-loop/issues/571#issuecomment-5886983527)):
   domain the omni command line, risk `low`, new bug (the reader has been this way since `1cbd22a`,
   the command line's first commit; `git log -S` found no other change), reproduction
   `kit/bin/args.test.mjs`, branch `fix/571-number-args`.
4. **Boundary.** Not crossed: the right behaviour is settled (the refusal message and the code's own
   comment say "positive number"/"positive integer"), `risk.storedShape` and `risk.sharedContract`
   are empty, and no screen, route or API is added.
5. **Branch.** `fix/571-number-args` from `origin/main`.
6. **Words first.** `paths.glossary` is null; the words (PRD number, plain digits) come from the
   kit's own messages. Nothing added.
7. **Prove red.** `kit/bin/args.test.mjs`, through `main()` on a fixture repository holding PRD 16 and
   PRD 100, run before any fix: 7 of 10 tests red. The red line kept verbatim:
   `× omni prd "0x10" is refused, not read as another PRD — AssertionError: expected '' to be 'omni prd: <n> must be a positive numb…' // Object.is equality`.
8. **Fix.** `positiveInt` accepts plain digits only (`/^\d+$/`); the bundle rebuilt with
   `pnpm kit:build`. The reproduction was not edited.
9. **Guard.** A unit test of `positiveInt` with ten non-digit forms. Seen failing against `main`'s
   `kit/bin/args.mjs` (1 failed) and passing on the fix.
10. **Mutation.** `commands.mutation` is null: `Mutation: not set here`.
11. **Record.** `.omni-loop/delivery/bugs/0571-number-args/bug.md`, five sections filled.
12. **Ship.** One commit, `fix(kit): omni refuses a number that is not plain digits instead of reading another PRD (#571)`,
    signed. `omni bug 571 --base origin/main` printed `ok`, exit 0, on the first run. Pushed, and
    [#573](https://github.com/vertuoza/vertuo-omni-loop/pull/573) opened through `/omni:pr` as a
    standalone PR into `main` with `Closes #571`, the **Bug** section filled and the record path;
    every reported check green (only the Vercel deployments run on pull requests here), mergeable,
    marked ready, `omni:in-progress` removed, status comment `done`.
13. **Hand off.** Not merged: a person merges.

**Preflight.** `pnpm test` was green (398 files, 6262 tests) on the third run. The first two each
failed one test outside the fix with "Test timed out in 5000ms" (`kit/bin/status.test.mjs`, then
`kit/lib/statusline/facts.test.mjs`), each green when run alone: the flaky check reported as #570.

## Live stop: #570, the suite times out under load

Opened from a one-line description as [#570](https://github.com/vertuoza/vertuo-omni-loop/issues/570):
the full `pnpm test` suite intermittently fails with "Test timed out in 5000ms" under load (seen in
`kit/bin/init.test.mjs`, `kit/bin/help.test.mjs`, `kit/bin/status.test.mjs`,
`kit/lib/ask/hook.test.mjs`, `kit/lib/statusline/facts.test.mjs`), each file passing alone. It is real:
it struck this run's own preflight twice. Classified as tooling at step 2; the triage comment
([comment](https://github.com/vertuoza/vertuo-omni-loop/issues/570#issuecomment-5886977749)) carries the
marker and `- **Kind:** tooling — not a behaviour bug` with one sentence why, and the skill stopped
(stop rule 1): no branch, no reproduction, no pull request.

## Labels: human steps

`omni:bug`, `omni:regression` and the `omni:risk-*` labels do not exist on this repository, and
`labels.autoCreate` is false. Following the **Labels** rules, none was created, and none could be
added; each was reported as a human step in the triage comments, in #573's body and status comment,
and here:

- create label `omni:bug`, then add it to #570, #571 and #573
- create label `omni:risk-low`, then add it to #571
- (`omni:regression` was not needed: #571 is a new bug)

## What was not seen

- **Labels on GitHub.** No issue or PR carries `omni:bug` or a risk label (above). The done-when's
  "an `omni:bug` issue … and its risk label" and "one PR labelled `omni:bug`" hold only once a person
  creates the labels.
- **CI on the fix.** This repository runs no test workflow on pull requests; the proof is the local
  `pnpm test` and `omni bug 571`, not a CI run.
- **Mutation testing**, since `commands.mutation` is not set here.
- **The `bug` verb from `main`'s installed kit.** `main`'s `.omni-loop/bin/omni.mjs` has no `bug`
  verb yet (it ships with PRD 556), so `omni bug 571 --base origin/main` ran the feature branch's
  `kit/dist/omni.mjs`. Run directly as a script, that bundle hands over to the repository's installed
  `.omni-loop/bin/omni.mjs` (which printed the usage line without `bug`, exit 2), so it was run by
  importing the bundle and calling its `main(['bug', '571', '--base', 'origin/main'])`.
- **A separate worktree for the fix.** Step 5 cuts `.claude/worktrees/571-number-args`; the
  `git worktree add` worked, but this session was confined to its own worktree and could not write
  there, so the worktree was removed and the fix branch was built in this session's worktree
  instead, then switched back to this slice branch. The branch, its base and its commit are as the
  skill says.
- **Stop rules 2 to 5** were not exercised: no term needed inventing, the reproduction was red, the
  boundary was not crossed, and the fix went green on the first attempt.
