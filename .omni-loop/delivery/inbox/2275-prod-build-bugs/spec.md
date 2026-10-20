---
prd: 2275
title: Bug fixes prove a bug that only shows in a production build
blocked-by: none
spec: file
phase0: server
---

# Bug fixes prove a bug that only shows in a production build

**Date:** 2026-10-20 · **PRD:** #2275 · **After:** PRD 556 (`/omni:bug-fix`), PRD 1118 (`/omni:mega-bug-fix`),
PRD 1804 (`commands.setup`), PRD 2100 (bug-fix proof) · **Touches:** `kit/plugin/skills/bug-fix`,
`kit/plugin/skills/mega-bug-fix`, `kit/lib/config.ts`, the `bug-fixing` form's kit default, the guide

## Problem

On 2026-10-20, vertuoza/vertuo-apps v3.14.22 moved vertuo-front to TanStack Start (Vite 8, rolldown,
`"type": "module"`). Once it reached production, the Opportunities kanban crashed for every user:
983 React #130 errors on `/crm/opportunities`, the first at 10:32 UTC, none before. The cause was one
import, `import Realistic from "react-canvas-confetti/dist/presets/realistic"`, of a CommonJS file.
The production bundle emits `__toESM(require_realistic(), 1)`, so `.default` is the whole module
object, and the component renders it unconditionally. The team fixed it by hand.

`/omni:mega-bug-fix` had the right suspect and stopped. In order of weight:

1. **It could not build what ships.** In a target it may run only the target's committed
   `commands.setup` and `commands.preflightFull` (else `commands.preflight`). vertuo-apps commits
   `setup: bun install --frozen-lockfile` and a preflight of format, lint and unit tests, with no
   build. The bug existed only in the production bundle, so no command it was allowed to run could
   see it.
2. **A passing reproduction has only two readings.** `/omni:bug-fix` step 7 reads a passing
   reproduction as "it misses the bug" or "the bug is already gone", then stop rule 3. It never
   reads "this level cannot see it". The unit test passed (vitest's CommonJS interop differs from
   the production bundler's; unverified), and the skill stopped there.
3. **Production evidence was misread.** The agent took the first occurrence for 2026-10-07 instead
   of today 10:32 UTC, and doubted its own lead because of it. Nothing asks to match the first
   occurrence against release deploys. Regression evidence knows only `git log` on the default
   branch and CI runs, never a release range (v3.14.21..v3.14.22), and mega-bug-fix's **Locate**
   reads only the default branch, never the deployed tag.
4. **A stop left nothing on the issue.** The triage comment waits for its **Reproduction** and
   **Branch** lines, so it is posted late, and a stop before then posts none.
5. **A stop threw the reproduction away.** The agent deleted the test, the worktree and the branch,
   and a `critical` bug stopped as quietly as a `low` one.

A smoke test of each route of the production build, run by the target's CI, would have stopped
v3.14.22 before it shipped. Nothing in either skill leads to that guard.

## Solution

### 1. `commands.smoke`, a committed command that builds what ships and checks it

- A new key, `commands.smoke`, beside `setup` and `preflight` in `kit/lib/config.ts`: a non-empty
  string or `null`, `null` by default. Its meaning is fixed: **it builds what the repository ships to
  production, then runs checks against the built output** (for a web front-end, it serves the
  production bundle and loads each route; for an SSR app, it renders each route from the built
  server). Example: `smoke: bun run build && bun run test:smoke`.
- `/omni:mega-bug-fix` reads it from a target's `.omni-loop/config.yml` on the target's default
  branch, as it reads `setup` and `preflight`, never from a branch. `/omni:bug-fix` reads it from
  its own repository's config.
- **The safety rule keeps its shape and gains one word.** In a target, the only commands ever run
  beyond `git` and `gh` are its own committed `setup`, then its own committed preflight, then its
  own committed `smoke`, the last only when step 7 moves up to it. The rule's paragraph, the
  mega-bug-fix **Never** line and bug-fix's step 7 say so. `/omni:bug-fix` follows the same rule in
  its own repository: it reaches the build level only through `commands.smoke`, never by running a
  build script or a probe of its own.
- The same command serves three times: the build-level reproduction harness (red), the proof the
  fix works (green), and the guard the repository's CI runs.
- Nothing else: no `commands.build`, and `omni init` does not detect a smoke script.

### 2. Prove red: a third reading, and moving up a level

`/omni:bug-fix` step 7 (and mega-bug-fix step 7, which follows it in each target):

- **A passing reproduction has three readings:** it misses the bug, the bug is already gone, or
  **this level cannot see it**. The third applies when the evidence points at what only the build
  changes: an error in production that the source cannot produce (a module's shape, CommonJS/ESM
  interop, server-side rendering, minification, a production-only environment value), or a
  regression range that changes the toolchain (the bundler, the package's `"type"`, the framework).
- **Under the third reading, it moves up.** The reproduction is written as one more case of what
  `commands.smoke` checks (the failing route added to the routes it loads, or the equivalent), and
  run as `setup`, then `smoke`:
  - **smoke fails:** its failing line is the red, and steps 8 onward run as today, with `smoke`
    green as the proof the fix works (beside the preflight).
  - **smoke passes too:** stop rule 3, as today, with **Who fixed it**. A unit-level pass alone
    never reaches stop rule 3 while the third reading applies.
  - **smoke is set but cannot run in this session** (a browser or a tool the session lacks): the
    reproduction is pushed alone on the draft PR, and the red is the CI run of `smoke` on it, when
    the repository's CI runs `smoke`. When it does not, stop rule 6.
  - **smoke is `null`:** stop rule 6.
- **Stop rule 6, new, written verbatim with the others:** *The bug lives in the build and the
  repository commits no `commands.smoke` it can run: stop, keep the reproduction, comment on the
  issue with the suspect, the production evidence and the line to commit. Never fix without red.*
  Its comment names the suspect (`<file>:<line>`), the **Production** line of the triage, the exact
  YAML to commit in `.omni-loop/config.yml` (`commands.smoke: <a command that builds and checks the
  route>`), and the command that reruns the fix. In mega-bug-fix it names the target, and pushes
  nothing to any other target (all or nothing holds).

### 3. A stop keeps the reproduction, and a critical stop says so

- **Stop rules 3, 4 and 6 keep the reproduction.** It is committed alone on the fix branch, and the
  branch is pushed. Stop rule 6 also opens the fix PR as a draft, labelled `labels.needsFix`, as
  stop rule 5 does today, its body saying it stopped and why. The stop's comment links the branch
  and names the reproduction's path. **Never** gains: *never delete the reproduction, its branch or
  its worktree on a stop.* (Stop rule 4 today leaves the worktree unpushed; it now pushes the
  branch too.)
- **A `critical` stop.** When the triage's risk is `critical`, the stop's comment starts with a
  GitHub alert, `> [!CAUTION]` then `> critical — nothing is fixed.`, and mentions nobody. The
  issue keeps `labels.riskCritical`. The hand-off prints that line first.

### 4. Triage: posted at once, and production evidence read against releases

`/omni:bug-fix` step 3, which mega-bug-fix step 3 follows in the plan repository:

- **The triage is posted at once.** The comment `<!-- omni-bug:triage -->` is posted in step 3
  with `- **Reproduction:** pending` and `- **Branch:** pending`, and edited in place, by its
  marker, at step 5 (the branch) and step 7 (the reproduction). Every stop after step 3 leaves a
  triage on the issue.
- **A new line, `Production:`**, after **Regression**, only when the report comes from production:

  ```markdown
  - **Production:** <deployed version> · first seen <YYYY-MM-DD HH:MM> UTC (<source>) · <count> occurrences
  ```

  - The first occurrence is read from the report's source (the error tracker's own first-seen time,
    with its time zone), never inferred from the issue's date, and written in UTC.
  - It is matched against releases: `gh release list --json tagName,publishedAt`, and the
    repository's GitHub deployments (`gh api repos/<slug>/deployments`) when it has them. The
    deployed version is the last release published, or deployed, before the first occurrence.
  - When the tracker gives the stack unminified, the triage cites its top frame in the source's
    terms (`<file>:<line>`).
- **A release range is regression evidence:** `Regression: yes — <previous tag>..<tag> (first seen
  <time> UTC, none before)`, when the first occurrence follows that release and none came before
  it. The suspect diff is read with `git log <previous tag>..<tag>`.
- **mega-bug-fix step 4, Locate,** reads each target at the deployed tag the triage names, besides
  its default branch, when the triage names one. The fix is still cut from the target's default
  branch.

### 5. The guard is the smoke, run by CI

`/omni:bug-fix` step 9, for a bug proven red at the smoke level:

- The case the reproduction added to `commands.smoke` is the guard. The skill checks, read-only,
  whether the repository's CI runs `commands.smoke` (the command's text in a workflow under
  `.github/workflows/`).
- **It does:** `Guard: <the case> in commands.smoke, run by CI`.
- **It does not:** `Guard: none — <repository>'s CI does not run commands.smoke`, and the PR body
  and a comment on the issue name the CI step to add. The skill never edits a repository's CI
  workflows.

### 6. The record names the level

The record's **Reproduction** section (step 11) gains `- **Level:** <unit | acceptance | smoke>`,
the level where red was seen. mega-bug-fix's **Fixes** rows keep their shape; each target PR's
reproduction line names its level. `omni bug` reads the record as today: it requires **File** and
**Red**, and ignores the new line.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | kit config | `commands.smoke` | `commands.setup` ← `kit/lib/config.ts:391`; one lower-case word like `commands.design` ← `kit/lib/config.ts:399` |
| vertuo-omni-loop | skill text | `- **Production:** …` triage line | follows the triage template's bold-field lines ← `kit/plugin/skills/bug-fix/SKILL.md:146` |
| vertuo-omni-loop | skill text | `pending` (Reproduction and Branch before they exist) | no written convention: follows the fix plan's `—` for a pull request not yet open ← `kit/plugin/skills/mega-bug-fix/SKILL.md:192`, spelled as a word because the line is read by people |
| vertuo-omni-loop | skill text | stop rule 6 | follows the numbered **Stop rules** ← `kit/plugin/skills/bug-fix/SKILL.md:558` |
| vertuo-omni-loop | skill text | `Guard: none — <repository>'s CI does not run commands.smoke` | follows `Guard: none — <reason>` ← `kit/plugin/skills/bug-fix/SKILL.md:292` |
| vertuo-omni-loop | record | `- **Level:** <unit \| acceptance \| smoke>` | follows the record's bold fields ← `kit/plugin/skills/bug-fix/SKILL.md:317` |
| vertuo-omni-loop | test | `kit/test/bug-fix-smoke.test.ts` | follows `kit/test/bug-fix-proof.test.ts` (skill text read section by section) |

## Decisions

- **One PRD** for the five gaps and the guard (asked): they change the same two skills.
- **`commands.smoke`, one command** that builds and checks (asked, settled in the parent session):
  no `commands.build`, no preview-deployment harness.
- **No smoke, no fix** (asked, settled in the parent session): stop rule 6; never an unproven fix.
- **`/omni:bug-fix` follows the same rule** in its own repository (asked): the build level only
  through `commands.smoke`.
- **A critical stop: the `[!CAUTION]` alert alone** (asked): no mention, no phone or email alert.
- **The guard: a line and a recommendation** (asked): the skill never edits a repository's CI.
- **Stop rule 6 opens a draft PR** labelled `labels.needsFix` (asked, with the visible stop).
- **Smoke set but not runnable in the session** (taken without asking, the most reversible): CI's
  run of `smoke` on the reproduction alone is the red when CI runs it, else stop rule 6.
- **Stop rule 4 now pushes its branch** (taken without asking): the reproduction must outlive the
  session, which a runner's or a removed worktree's does not.
- **The voice's objection** (persona:Irisa): *"When production crashes for every customer, I want
  the fix today. A skill that stops until someone commits a smoke command leaves my customers on the
  broken screen."* Settled `none`: the person approved the section without answering it. Stop rule
  6's comment carries the suspect and the exact line to commit, so a person can fix by hand at once.

## User stories

- As a developer running `/omni:mega-bug-fix` on a production crash that only the bundle shows, I
  get a red seen at the smoke level and a fix proven green there, or a stop that names the suspect,
  keeps the reproduction and gives me the line to commit.
- As the person reading the issue, I see the triage as soon as the skill has one, with the deployed
  version and the first occurrence in UTC, whatever happens next.
- As a lead engineer, I see a `critical` stop at a glance, and the guard tells me whether our CI
  runs the smoke that would have caught it.

## Scope

**In:**

- `kit/plugin/skills/bug-fix/SKILL.md`: steps 3, 5, 7, 9, 11, 13, **Stop rules** and **Never**.
- `kit/plugin/skills/mega-bug-fix/SKILL.md`: the rule **Code runs only from a target's own
  config**, steps 3, 4, 7, 10 and **Never**.
- `kit/lib/config.ts` and `kit/lib/config.test.ts`: `commands.smoke`.
- `kit/templates/playbook/bug-fixing.md`: step 4 (the three readings) and the guard (the smoke run
  by CI).
- `kit/porting/plugin--bug-fix.md` and `kit/porting/templates--bug-fixing.md`: the change logged.
- `docs/guide/several-repositories.md`: a target commits `commands.smoke`, and what it runs.
- `kit/test/bug-fix-smoke.test.ts`: the skill text tests.
- `kit/dist/` and `apps/omni-app/api/` rebuilt once, by the wave after merging (`generated:`).

**Out:**

- vertuo-apps itself: its fix (made by hand), its `commands.smoke` and its CI step.
- Editing any repository's CI from a skill.
- Detecting a smoke script in `omni init`.
- A server-side alert (phone, email) for a critical stop.
- `omni bug`'s verdict (`kit/lib/bug/verdict.ts`): unchanged.

## Test seams

Every test runs on fixtures and never calls GitHub (`omni kb show testing`). The mutation floors in
`mutation/floor.json` hold.

- **The config** (`kit/lib/config.test.ts`): `commands.smoke` is `null` when absent, reads a
  command as written, and an empty string is refused with an error naming `commands.smoke`, as the
  test of `commands.design` does.
- **The skill text** (`kit/test/bug-fix-smoke.test.ts`, reading each `SKILL.md` section by section,
  as `kit/test/bug-fix-proof.test.ts` does):
  - bug-fix step 7 names the three readings in order, and moves up to `commands.smoke` under the
    third;
  - the **Stop rules** hold rule 6 verbatim, and rule 3 says it applies after the smoke level when
    the third reading holds;
  - step 3's triage template holds `Reproduction:** pending`, `Branch:** pending` and the
    `Production:` line, and the regression evidence names a release range;
  - step 9 holds both guard lines, and says the skill never edits CI;
  - the record template holds the `Level` line;
  - **Never** says the reproduction, its branch and its worktree are never deleted on a stop;
  - mega-bug-fix's rule and its **Never** name `setup`, the preflight and `smoke`, in that order;
    step 4 reads the deployed tag.
- **The form** (`kit/templates/playbook/bug-fixing.md`): its kit default names the third reading
  and the smoke run by CI; the playbook form tests that already read it stay green.
- The law proofs in `kit/test/plugin.test.ts` stay as they are: this PRD tests its text in its own
  file, never beside them.

## Risks

- **What a merge publishes.** The plugin (`kit/plugin`) and the kit (`kit/dist/omni.mjs`), so
  every repository's `/omni:bug-fix` and `/omni:mega-bug-fix` change at once, and each repository's
  config accepts `commands.smoke` at its next `omni update`. Until then, a repository whose pinned
  omni predates the key refuses a config that sets it: commit `commands.smoke` only after updating.
  The GitHub App's bundle is rebuilt because `kit/lib` changes. No migration. Rolled back by
  reverting the feature PR; a repository that committed `commands.smoke` then removes the line.
- **A smoke command is code the skill now runs.** It is committed by the repository, on its
  default branch, as `setup` and the preflight are: the safety rule's boundary is unchanged.
- **A slow smoke.** A production build plus route loads takes minutes. It runs only under the third
  reading, never on every bug.
- **The third reading can be over-used** to escape stop rule 3. It applies only with the evidence
  step 7 names, and the reproduction still has to fail at the smoke level before any fix.
- **The locked laws.** `omni kb laws` prints all twenty for every file here, none scoped by path.
  - **The skill edits** sit where `kit/test/plugin.test.ts` proves three laws. Their proofs stay as
    they are, and this PRD's text is tested in `kit/test/bug-fix-smoke.test.ts`:
    - BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering the
      open questions. Changing it needs @pierrederval to approve the pull request on GitHub.
    - BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it
      needs @pierrederval to approve the pull request on GitHub.
    - N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it
      needs @pierrederval to approve the pull request on GitHub.
  - **Why they hold:** stop rule 6's PR stays a draft (BR-PRODUCT-5); the skills still never merge
    (N-PRODUCT-15); no label the gate reads is applied by the skill (BR-PRODUCT-3).
  - The rule BR-PRODUCT-23 governs `kit/lib/config.ts`'s `signature` keys, which this PRD does not
    touch.

## Acceptance criteria

1. `parseConfig` accepts `commands.smoke` as a command, reads it `null` when absent, and refuses an
   empty one with an error naming `commands.smoke`.
2. `/omni:bug-fix` step 7 names three readings of a passing reproduction, and under "this level
   cannot see it" runs `setup` then `commands.smoke` with the case added, before any fix.
3. A unit-level pass alone never reaches stop rule 3 while the third reading applies; a smoke-level
   pass does.
4. Stop rule 6 is written verbatim in **Stop rules**: with no runnable `commands.smoke`, the skill
   stops, keeps the reproduction on a pushed branch and a draft PR labelled `labels.needsFix`, and
   comments the suspect, the production evidence and the YAML line to commit.
5. Stop rules 3, 4 and 6 push the branch holding the reproduction, and **Never** forbids deleting
   the reproduction, its branch or its worktree on a stop.
6. A stop whose risk is `critical` starts its comment with `> [!CAUTION]` and
   `critical — nothing is fixed`, mentioning nobody.
7. The triage comment is posted in step 3 with `Reproduction: pending` and `Branch: pending`, and
   edited in place by its marker at steps 5 and 7.
8. The triage carries a `Production:` line with the deployed version and the first occurrence in UTC
   read from the report's source and matched against releases; a release range counts as regression
   evidence.
9. mega-bug-fix step 4 reads each target at the deployed tag the triage names.
10. mega-bug-fix's rule and **Never** allow, in a target, only its committed `setup`, preflight and
    `smoke`.
11. Step 9 writes `Guard: <the case> in commands.smoke, run by CI` when the repository's CI runs it,
    else `Guard: none — <repository>'s CI does not run commands.smoke` with the CI step named in the
    PR and on the issue, and never edits CI.
12. The record's **Reproduction** holds `Level: <unit | acceptance | smoke>`, and `omni bug` still
    passes a record without it.
13. The `bug-fixing` form's kit default names the third reading and the smoke run by CI as the guard.
14. `docs/guide/several-repositories.md` tells a target how to commit `commands.smoke` and when the
    skills run it.
