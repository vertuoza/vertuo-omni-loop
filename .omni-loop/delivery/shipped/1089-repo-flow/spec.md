---
prd: 1089
title: Repository flow — rules, areas and hooks that tailor the loop per repository
blocked-by: none
spec: file
---

# Repository flow — rules, areas and hooks that tailor the loop per repository

**Date:** 2026-10-06 · **PRD:** #1089 · **Stacked on:** #1086 (landings), branch
`claude/omni-landings-impl-aaef5f` · **Touches:** `kit/lib/config.ts`, a new `kit/lib/flow/`,
`kit/lib/inbox/plan-grade.ts`, a new `kit/bin/commands/flow.ts`, `omni check config`, the skills
`plan`, `do-work`, `pr`, `wave`, `yolo` and their `ultra-*` and `mega-*` variants, `invade`,
`mega-invade`, a new ADR, `docs/guide/flow.md`. **Out of scope:** events (`flow.on`, a follow-up
PRD), making the kit's own skills agent-agnostic, the steps of `/omni:bug-fix` and
`/omni:visual-fix` other than `pr.open`.

## Problem

A repository cannot change how the loop works on it. The playbook forms are prose an agent reads,
and a form only adds to a skill's steps (ADR-0025); nothing checks that the agent followed it. So:

- **Planning cannot see a repository's rules.** There is no planning form, and `omni plan check`
  (`plan-grade.ts`) grades a fixed set of rules with no way to add one. "A database migration is one
  file in one PR" or "the kernel lands before the code that uses it" is caught by a person after the
  slices are built, not when the plan is cut.
- **Building is the same everywhere.** `/omni:do-work` runs `commands.preflight` for every slice;
  `/omni:wave` merges every sub-PR with `gh pr merge --squash --delete-branch`; `/omni:pr` opens every
  PR with `gh pr create`. A repository with its own test runner, merge method, required checks or
  PR-opening tool has no seam but #1086's single `pr.openWith`.
- **One repository's rules are not another's.** `src/kernel/` and `resources/js/` in the same
  repository need different rules, and a multi-repository PRD (`/omni:mega-brainstorm`,
  `/omni:ultra-yolo`) slices into targets whose rules nothing carries into the plan.

Teams with an established workflow therefore either bend to the loop's defaults or do not adopt it.

## Solution

A new `flow` section of `.omni-loop/config.yml`, in three parts. No part of it is code: rules are
data, hooks are Markdown.

```yaml
flow:
  rules:                                   # the default area: every path no area below claims
    plan:
      - slice: { maxFiles: 15 }
    subPr: { merge: squash, requireChecks: [phpunit] }
  hooks:
    do-work.test:
      after: .omni-loop/flow/contract-tests.md
    pr.open:
      replace: .omni-loop/flow/open-pr.md
  areas:                                   # first match wins, in this order
    kernel:
      paths: ['^src/kernel/']
      knowledge: kernel
      rules:
        plan:
          - slice: { alone: true, maxFiles: 5 }
          - wave: first
          - blocks: all
        subPr: { requireChecks: [phpunit, phpstan-max], approval: person }
      hooks:
        plan.slice: { before: .omni-loop/flow/kernel/plan.md }
        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }
    migrations:
      paths: ['^database/migrations/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 1 }
          - landing: alone
```

### 1. Rules: checked by the CLI

- **`rules.plan`**, graded by `omni plan check` on each slice's territory:
  - `slice.alone: true`: the slice touches no path outside its area.
  - `slice.maxFiles: <n>`: at most n paths in the slice's territory.
  - `wave: first`: the area's slices sit in a wave before every slice outside the area.
  - `blocks: all`: every slice outside the area lists one of the area's slices in `blocked by`,
    directly or through another slice.
  - `landing: alone`: #1086's landing rule, scoped to the area. `landings.alone: [<re>]` reads as
    an unnamed area with `paths: [<re>]` and `landing: alone`.
- **`rules.subPr`**, applied by `omni flow check merge`:
  - `merge: squash | merge | rebase`: the merge method. Default `squash`, today's behaviour.
  - `requireChecks: [<name>]`: these CI check names are green on the sub-PR.
  - `approval: person`: a person approved the sub-PR. The wave never merges it before that.
  - `territory: report | block`: a diff outside the slice's territory is reported (default,
    today's behaviour) or refuses the merge.
  - `maxOpen: <n>`: at most n of the area's sub-PRs open at once in a wave.

### 2. Areas: rules per part of the code

- `areas.<name>.paths` is a list of regex sources over repository paths, validated and compiled as
  `risk.storedShape` is. A path belongs to the first area, in declared order, whose `paths` match it,
  otherwise to the default area (the root of `flow`).
- A slice belongs to every area its territory touches.
- An area inherits the default area's rules unless it says `inherit: false`.
- Across a slice's areas: limits keep the strictest value; `requireChecks` is the union;
  `approval: person` in one area applies to the slice; `territory: block` in one area applies to the
  slice. Two different `merge` methods on one slice are refused by `omni plan check`, which names
  both areas and asks for the slice to be split.
- `areas.<name>.knowledge` optionally names a knowledge domain folder (`paths.knowledge`) that
  `/omni:plan` reads for the area's slices. It links the spec's `areas: [<domain>]` field to a flow
  area; it does not create a second meaning of the word.

### 3. Hooks: Markdown any agent follows at a named point

- A **point** is `<skill>.<step>`. The catalog, `kit/lib/flow/points.ts`, is the single source of
  each point's skills, allowed modes, inputs and, for `replace`, the outputs it must produce:

  | point | fires in | extend | replace | a replace must produce |
  |---|---|---|---|---|
  | `plan.slice` | `/omni:plan` (also through mega-brainstorm) | ✓ | ✗ | — |
  | `plan.done` | `/omni:plan` | ✓ | ✗ | — |
  | `do-work.start` | `/omni:do-work` (also `--target`, and yolo-fix reworks) | ✓ | ✗ | — |
  | `do-work.test` | `/omni:do-work` | ✓ | ✓ | the verdict line |
  | `do-work.review` | `/omni:do-work` | ✓ | ✗ | — |
  | `do-work.ready` | `/omni:do-work` | ✓ | ✗ | — |
  | `pr.open` | `/omni:pr` (also `--repo`) | ✓ | ✓ | the PR's URL as its last line before the verdict |
  | `wave.merge` | `/omni:wave`, `/omni:ultra-wave` | ✓ | ✓ | the merged PR's number in the verdict |
  | `yolo.ready` | `/omni:yolo`, `/omni:ultra-yolo` | ✓ | ✗ | — |

- A hook names a Markdown file **by its repository path**. Each point takes
  `{ before?: <path> | [<path>], after?: <path> | [<path>], replace?: <path> }`; a bare path is
  `after`.
- **Extend is the default, replace the exception.** At a point the skill follows every `before`,
  then the kit's step or the `replace` hook, then every `after`. A `replace` swaps the act and never
  the guard: signing, labels, PR links, the base check (never into the default branch), the
  territory check and `omni plan check` run whatever the hooks say.
- A hook file carries front matter: `omni-hook: <point>`, its `inputs`, and its `verdict` line. Its
  last line is `omni-hook <point>: pass` or `omni-hook <point>: fail <why>`.
- Across areas: extend hooks add up (the default area's first, then each area's in declared order).
  An area's `replace` wins over the default area's for the slice. Two different `replace` hooks on
  one slice are refused by `omni plan check`.
- **Not tied to Claude.** Nothing under `flow` names a Claude path, a slash command or a Claude tool.
  `omni check config` refuses a hook under `.claude/` unless it is marked `alias: claude`. #1086's
  `pr.openWith: /create-pr` stays readable as a Claude-only alias of `pr.open.replace`, documented
  as such.

### 4. The CLI

- **`omni flow show [<point>] [--prd <n> --slice <id> | --path <p>…] [--repo <target>] [--json]`**
  - With a point, it prints the resolved `before`, `replace` and `after` hooks, each with its area,
    its text, its inputs filled in and its verdict line, plus `kitStep: run | replaced`. The JSON
    is self-sufficient: any agent follows it without knowing the kit.
  - With `--path`, it prints the path's area and every rule and hook that applies there.
  - With no point and no path, it prints what this repository changes from the kit's defaults, area
    by area, so a person sees at a glance how the loop differs here.
  - With `--repo`, it reads a target's flow: the imported copy at planning time.
- **`omni flow verdict <point> --from <file>`** reads a hook's output and prints `ok`, or
  `not ok <hook> <why>`, exit 0 or 1. A missing or malformed verdict line is `not ok … no verdict`.
- **`omni flow check merge --pr <n> [--repo <target>]`** gathers the PR's checks, approvals and diff,
  applies `rules.subPr` for the slice's areas, and prints `ok` with the merge command to run, or
  `not ok` with the reason.
- **`omni check config`** refuses: a regex that does not compile, an unknown point, a `replace` on a
  point that does not allow it, a hook path that is absolute, contains `..`, is a URL, does not
  exist, or sits under `.claude/` without `alias: claude`, and a hook file over
  `limits.hookMaxBytes` (default 20480). It names the key.

### 5. The skills

Each skill that a point lists calls `omni flow show <point>` at that step and follows what it
prints, then passes each hook's output to `omni flow verdict`. With no `flow`, `flow show` prints no
hook and `kitStep: run`, and the skill runs as today. `/omni:wave` (and so `/omni:ultra-wave`) calls
`omni flow check merge` in place of its hard-coded `gh pr merge --squash --delete-branch`.

### 6. Several repositories

| when | the target's flow is read from |
|---|---|
| `/omni:mega-invade` | it copies the target's `flow` section and its hook files into `<paths.knowledge>/repos/<name>/flow/` |
| `/omni:mega-brainstorm`, `omni plan check` | that copy: each `repo: <name>` row is graded against that target's areas and rules |
| `/omni:ultra-wave`, `do-work --target`, `pr.open`, `wave.merge` in a target | the target's own committed config, in its worktree, never the copy |
| `/omni:ultra-yolo`, at its start | it compares the copy with the target at its `read at`, and reports a changed flow as it reports a target that moved |

### 7. `/omni:invade`

`/omni:invade` proposes a `flow` from what the repository proves (a migrations folder becomes a
`migrations` area with `slice.alone` and `landing: alone`), as proposed config a person merges. It
never applies one.

## Decisions

- **No code from the repository runs in the loop** (asked): rules are data, hooks are Markdown.
  Executable hooks were proposed and declined, for security.
- **Extend by default, replace only where the catalog allows it** (asked). ADR-0025 stays true for
  extend; a new ADR scopes the exception: a hook may replace the act at a named point, never a guard.
- **Hooks are paths, not slash commands** (asked): the loop must not be tightly coupled to Claude.
- **Areas live in the central config** (asked), not in per-folder files: one file to review, one
  place for mega-invade to import.
- **Points are named after the base skill** (asked): ultra-yolo follows yolo step for step,
  ultra-wave follows wave, mega-brainstorm follows plan, so a point fires in both without a second
  name. A conformance test keeps it true.
- **do-work gets four points** (asked): start, test, review, ready.
- **Events are a follow-up PRD** (asked): a hook runs inside the loop and can block; an event is
  fire-and-forget, and some transitions (a person merging on GitHub) happen outside the loop, so its
  emitter is a separate design. This PRD reserves `flow.on`: `omni check config` refuses the key
  until that PRD defines it.
- **Stacked on #1086** (asked): the feature branch is cut from #1086's branch and the feature PR's
  base is that branch, not the default branch.
- **No proof video** (asked).
- **The voice's objection** (persona:Lead Engineer, "each repository rewriting its flow breaks
  cohesion"): settled `accepted`: `omni flow show` with no argument prints what the repository changes
  from the kit's defaults.
- Fail closed (taken here): a broken `flow`, a missing hook file or a missing verdict stops the
  point; nothing is skipped silently.

## User stories

- As a lead engineer, I declare that `database/migrations/` changes are one file in one slice, landed
  alone, and `omni plan check` refuses a plan that mixes one with code, before anything is built.
- As a lead engineer, I give `src/kernel/` its own rules (first wave, five files at most, a person
  approves) and see them with `omni flow show --path src/kernel/Bus.php`.
- As a back-end developer, I make `/omni:do-work` run only the tests of the slice's territory with a
  Markdown hook, without forking the kit.
- As a team with its own PR tool, I replace how PRs open, and the loop still signs, labels and links
  them.
- As a PM running `/omni:ultra-yolo`, each target's slices are cut, tested, opened and merged by that
  target's rules, without my knowing them.
- As someone not using Claude, I follow the same hooks from `omni flow show --json`.

## Scope

**In:** the `flow` schema with #1086's aliases; areas and their resolution; the rules listed in
Solution 1; the hook catalog of Solution 3; `omni flow show`, `verdict`, `check merge`; the `omni
check config` refusals; the calls in the skills of the catalog and their ultra and mega variants;
mega-invade's copy of a target's flow; invade's proposal; a new ADR; `docs/guide/flow.md`.

**Out:** events (`flow.on`), executable hooks, per-folder flow files, agent-agnostic kit skills,
points in `/omni:bug-fix` and `/omni:visual-fix` beyond `pr.open`, any change to the outbox gate.

## Test seams

Following `omni kb show testing`: tests beside the code, pure units first, the CLI through its
commands.

1. **Pure units, table-driven:** `resolve` (first match, `inherit`, strictest limit, union),
   each `rules.plan` evaluator, `merge-gate`, the catalog's validation.
2. **CLI:** JSON snapshots of `flow show`, `flow verdict` and `flow check merge` (GitHub facts
   faked at the client seam); each `check config` refusal and its message.
3. **`plan check` integration:** a fixture plan with a `kernel` and a `migrations` area, its
   refusals and the corrected plan green.
4. **Skill conformance:** for each point in the catalog, every skill it lists calls
   `omni flow show <point>`, ultra and mega variants included.
5. **Backward compatibility:** with no `flow`, the existing suite passes unchanged; `landings.alone`
   and `landing: alone`, and `pr.openWith` and `pr.open.replace`, give the same results.
6. **Agent-agnostic:** no `flow show` JSON carries a Claude path, slash command or tool name.

## Risks

- **Stacked on an open PR.** If #1086 is rebased or force-pushed, the feature branch is rebased onto
  its new head. `/omni:yolo` checks that #1086's head is an ancestor of the feature branch and stops
  with that line when it is not. The feature PR is never marked ready while #1086 is open.
- **A feature PR whose base is not the default branch.** `/omni:yolo` and `omni board` may refuse
  it; a slice of the plan checks it and handles it.
- **What merging publishes:** following `omni kb show releasing`, merging the feature PR cuts the
  next kit release. Every repository on that version gets `flow`, opt-in: with no `flow` key nothing
  changes. Rollback: revert the feature PR; a repository that wrote `flow` keeps a key the previous
  kit refuses, so the release notes say to remove it before pinning back.
- **A hook can tell an agent to run anything.** It is followed under the session's permissions, as a
  playbook form is today; a target's hook is only followed in that target's worktree, never from the
  imported copy.
- **Hook text costs context.** `limits.hookMaxBytes` caps each file.

## Acceptance criteria

1. With no `flow` key, every existing test passes unchanged, and `omni flow show do-work.test`
   prints no hook and `kitStep: run`.
2. A plan whose slice touches `database/migrations/x.sql` and `src/Invoice.php`, under the
   `migrations` area above, is refused by `omni plan check`, naming the slice, the area and the rule.
3. Under the `kernel` area, a kernel slice in wave 2 behind a non-kernel slice in wave 1 is refused
   (`wave: first`); with the kernel slice in wave 1, the plan is green.
4. `omni flow show --path src/kernel/Bus/Dispatcher.php` prints area `kernel` and its rules and hooks.
5. `omni flow show` with no argument prints each difference from the kit's defaults, area by area.
6. `omni flow show do-work.test --prd <n> --slice <id> --json` for a kernel slice returns the
   kernel's `replace` hook with its text, its territory and its verdict line, and
   `kitStep: replaced`.
7. `omni flow verdict` prints `ok` for `omni-hook do-work.test: pass`, `not ok` for a `fail`, and
   `not ok … no verdict` for output with no verdict line.
8. `omni flow check merge` on a kernel sub-PR with no approval prints `not ok` naming
   `kernel: approval person`; with `merge: rebase` and green checks it prints `ok` and a
   `gh pr merge --rebase` command.
9. `omni check config` refuses, naming the key: `replace` on `plan.slice`, a hook path with `..`, a
   hook under `.claude/` without `alias: claude`, a missing hook file, a regex that does not compile,
   and `flow.on`.
10. `landings.alone` and `pr.openWith` from #1086 give the same results as their `flow` forms.
11. For every point in the catalog, each skill it lists calls `omni flow show <point>`, checked by a
    test; `/omni:wave` and `/omni:ultra-wave` merge only through `omni flow check merge`.
12. In a plan repository, `omni plan check` grades a `repo: back` row against the back end's imported
    flow and a `repo: web` row against the web's.
13. `docs/guide/flow.md` walks through the kernel and migrations example end to end.
