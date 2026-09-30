---
name: do-work
description: Build ONE slice of a PRD to standard — grounded in the repository's own context, test-first through red-green-refactor, inside the slice's territory only, every decision taken without asking recorded as an outbox item — then ship it as a sub-PR. The job every /omni:wave subagent does; a person may also run it on one slice. Triggers on "do the slice", "build s3", "/omni:do-work".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-do-work/SKILL.md — changes in kit/porting/plugin--do-work.md -->

# Do work: one slice, to standard

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Inputs

| input | example | notes |
|---|---|---|
| PRD | `7` | the PRD number |
| slice | `s5` | a row of the PRD's plan |
| feature branch | shaped like `branches.feature` | the branch the slice is cut from and its sub-PR targets |
| `--in-wave` | — | set by `/omni:wave` only. Changes three things, below: the claimed slice branch is checked out rather than cut, medium items are not adopted, and the skill stops once the sub-PR is open and returns the wave's result shape |
| `--target <name>` | `backend-php` | set by `/omni:ultra-wave` and `/omni:ultra-yolo-fix`, in a plan repository: the slice lands in that target repository, not in this checkout. Changes where it is built, where its items go, which preflight runs and what the result carries: see **Under `--target <name>`** |

Given only a PRD, this is not your job: follow `/omni:yolo` (or `/omni:wave`) instead.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the Omni Loop
kit is not installed in this repository. Keep the JSON; later steps read `repo.remote`,
`branches.*`, `paths.*`, `commands.*`, `acceptance.*` and `laws.source` from it.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

## 1. Read before you build

1. `node .omni-loop/bin/omni.mjs prd <n>` — where the PRD lives: its plan, its spec, its outbox dir.
2. The slice's row in the plan: its **territory** (the only paths you may create or change, plus
   outbox item and account files), what blocks it, its wave. Read the plan's "done when" for it.
3. The spec, in full.
4. Every file in `paths.context`, the glossary at `paths.glossary` when set, and — when
   `laws.source` is `knowledge` — the knowledge folder at `paths.knowledge` (principles, rules,
   invariants; `node .omni-loop/bin/omni.mjs knowledge <id>` explains one). A **proposed** entry
   (one carrying a `Proposed:` line; `omni knowledge <id>` prints who proposed it and when) is read
   like any other: it describes the product. It is not a law until a person confirms it, so it
   never stops a slice (see **Exactly two ways a slice ends early**).
5. `omni kb show architecture`, `omni kb show conventions` and `omni kb show setup`: where code
   may go and what may depend on what; naming, formatting and the shape of a commit; how to
   install and run the repository. They bind this slice as if written here.

The slice branch is `branches.slice` filled with the feature branch's topic and the slice id.
Never work on the default branch or on the feature branch.

- **Under `--in-wave`:** `/omni:wave` has already claimed the slice. Do not cut a fresh branch:
  fetch and check out the existing `<repo.remote>/<slice branch>`, which holds the claim commit.
- **Running alone:** claim first: follow `/omni:pr`'s **Claim** mode in full (it cuts the slice
  branch from the feature branch, makes the claim commit, pushes, opens the draft and posts the
  claimed status) before you build anything.

**Heartbeat.** A claim reads as stale when its branch has no commit beyond the claim and the claim
is older than `limits.claimStaleMinutes`; a stale claim can be taken by a second wave. While
building, commit and push work in progress at least every half of
`node .omni-loop/bin/omni.mjs config limits.claimStaleMinutes` minutes.

## 2. Build

- **Test-first:** read `omni kb show testing` first (the commands, where tests live, which level
  to choose, what a test must never do). Then name the testable "done" condition, write the
  failing test, watch it fail (red), make it pass (green), then refactor with the tests green.
  Characterization tests first before a risky refactor.
- **Tracer bullets, not layer piles.** Prove the smallest vertical path, then widen.
- **Territory only.** A change outside the row's territory is a decision (below), not a fix you
  just make.
- **Follow local patterns;** let abstractions earn their keep. Narrow, behavioural seams; small
  ports over broad clients; one responsibility per module.
- **Reviewable commits:** one coherent change each, no unrelated formatting, each ending with the
  co-author trailer your session requires, then the `omni sign trailer` line (**Signing**).

## 3. Record the decision, keep building

When the PRD, the spec, the context files and the knowledge folder do not settle something:

1. **Take the most reversible option** — the one a different answer undoes for the price of a
   constant, not a migration — and carry on.
2. **Record it** with `omni item new`. Write the JSON to a scratch file (never in the repository):

   ```bash
   node .omni-loop/bin/omni.mjs item new --prd <n> --slice <id> --file <file> --json            # --in-wave
   node .omni-loop/bin/omni.mjs item new --prd <n> --slice <id> --file <file> --json --adopt    # alone
   ```

   Fields: `slug`, `wave`, `bearsOn` (a law id, a proposed entry's id, `ADR-nnnn`, or omit),
   `questionPlain`,
   `decisionPlain`, `introFun`, `punchlineFun`, `decide`, `meanwhile`, `cost`, `gaps`, `options`
   (two to four; A is what you built), and the flags `hardToRevert`, `breaksNamedLaw`,
   `needsHumanAction` (then `personSteps` instead of `options`), `principlesConflict`. The two
   plain-words fields are for a business person: one or two sentences, no path, no code, no id.
   `introFun` and `punchlineFun` are two lines for fun, written for every item you raise: the intro
   opens the question in the pull request's outbox comment, the punchline follows it. Each is one
   sentence (two short ones at most), at most 120 characters, in plain words by the same rules;
   about the question or its situation, never about a person or a team, and never mocking whoever
   answers. The kit refuses one without the other. **Never invent a rationale:** a gap you could
   not close goes in `gaps`, marked `(author)`.
   The kit picks the rank and the id; you never do. `--adopt` only acts on a medium item: it goes
   straight to the ledger. Under `--in-wave`, never pass it — `/omni:wave` adopts after the wave
   merges, so parallel slices do not race on the ledger.

   **Ask Jev about `hardToRevert`.** Once you have set `hardToRevert` yourself, and before you run
   `omni item new`, write the decision's state to a second scratch file (never in the repository):
   `{ "decision": <decisionPlain>, "options": [<each option, as "A. …">], "slice": "<slice id>: <its
   title>", "paths": [<the paths this slice touches>] }`. Then run:

   ```bash
   node .omni-loop/bin/omni.mjs decide outbox-risk --state-file <state file> --old <true|false> --ref "PRD <n> <slice>"
   ```

   It always exits 0. When it prints `unset`, keep your own `hardToRevert` and change nothing: the
   step is as it was. When it prints `<answer> <confidence>` (`true 0.82`), the workspace has put
   this decision On and Jev's answer counts, even against yours: set `hardToRevert` to its answer,
   and end `decide` with the line `Decided by: Jev (hardToRevert <confidence>) · agent said <yours>`.
   Jev answers `hardToRevert` only: `needsHumanAction`, `breaksNamedLaw`, `principlesConflict` and
   `bearsOn` stay yours, and the kit still picks the rank, its law floor included.
3. **Read the JSON on stdout.** Parse it: `{ outcome, rank, id, file, adopted, reason }`.
   - `outcome: "record"`, exit `0`: carry on. `adopted: true` means it went straight to the
     ledger; otherwise commit `file`.
   - `outcome: "stop"`, exit `1`: the **stop** outcome (a law it can name would break, or two
     principles pull the decision apart) — `file` names what was written, `reason` says which.
   - `outcome: "blocked"`, exit `1`: the **blocked** outcome (a human action it cannot perform) —
     `file` names what was written, `reason` says what a person must do.
   - `outcome: null`, `adopted: false`, exit `1`, after `--adopt`: the ledger refused the
     adoption (`reason` says why) — rerun without `--adopt` so the item stays an open file, name
     the refusal in your risks, and carry on.
   - Exit `2`: nothing was written or adopted, for one of two reasons. Stdout tells them apart.
     - **The JSON was refused:** not valid JSON, or a field missing, unknown or breaking its rule
       (an intro or a punchline too long or not in plain words, or one without the other). One
       line on stderr says which, naming the field, and stdout stays empty, even with `--json`:
       fix it and rerun.
     - **The rendered item was refused** by the same check `omni check outbox` runs on every open
       item (a below-floor rank, a malformed options section, a code name loose in a plain-words
       field…). With `--json`, stdout carries `outcome: null`, and `reason` names every failure:
       reword and rerun.
4. Commit the item file (or the ledger change) on the slice branch.

**Exactly two ways a slice ends early.**

| the slice meets | it does |
|---|---|
| the **stop** outcome — a law it can name would break, or two principles pull the decision apart | stops that slice, commits any item written, pushes, and reports the law or principles. Its siblings finish |
| the **blocked** outcome — a human action it cannot perform (a secret, a grant, a console step) | commits the human-action item, pushes, opens the sub-PR through `/omni:pr`, returns `blocked` |

Anything else is not a stop. "This might break something" is a risk: record it with
`hardToRevert` and carry on. Contradicting an ADR is proposing to supersede it: record it with
`bearsOn` set to the ADR, and carry on. Going against a **proposed** knowledge entry is never a stop
either: it is no law yet, so record it with `bearsOn` set to its id, leave `breaksNamedLaw` false,
and carry on.

## 4. Account for the ground you touched

After the last code commit, grade your own diff:

```bash
node .omni-loop/bin/omni.mjs check coverage --base <repo.remote>/<feature branch> --prd <n>
```

It names every risky change (stored shape, law proof, law text, a deleted test, a shared contract)
that no account covers. Write `<outbox dir>/accounts/<slice>.md` (the outbox dir is the one
`omni prd` printed) naming each one, commit it, and rerun until it is quiet:

```markdown
---
prd: <n>
slice: <slice>
graded: <YYYY-MM-DD>
---

## Risky changes

- `<path>`
  <rule>
  item <item id>        ← or: spec <where the spec asks for it>
```

Exactly two account forms: `item <id>` or `spec <where>`. A path firing two rules is two entries.
Nothing risky, no file. **This run never stops you:** a change you cannot honestly account for is
left unaccounted and named in your risks — never invent an account to quiet the guard.

## 5. Ship

Read `omni kb show verification`, `omni kb show pull-requests` and
`omni kb show definition-of-done` first: what must be green before a push, what a pull request
carries here, and what done means. What they ask of a push or a hand-off is part of this step.

1. **Preflight:** `commands.preflightFull`, or `commands.preflight` when it is null. Fix until
   green. Neither set: say so, and name it in the hand-off.
2. **Checks:** every command in `commands.checks`, then
   `node .omni-loop/bin/omni.mjs check all`. Fix until green.
3. **Acceptance,** only when `acceptance.enabled`: a pending scenario file for this slice (its name
   ends in `acceptance.pendingSuffix`, under `acceptance.dir`) now has its steps, so `git mv` it to
   drop the suffix. Then run `acceptance.run` **twice**; a scenario that passes once has not been
   shown to pass.
4. **Push** the slice branch to `repo.remote`.
5. **Hand off to `/omni:pr`** for the sub-PR into the feature branch: it turns the claim into the
   sub-PR (title; a body that ends with the `omni sign footer` line; the co-author trailer and the
   `omni sign trailer` line on every commit), keeps its status comment, marks it ready once the
   preflight is green, and runs its lifecycle. A sub-PR has no CI: its lifecycle
   ends at a green preflight and no conflict with the feature branch. Never merge it, never touch
   another branch.

Every hand-off line, green or stuck, names the checks that ran and the ones that did not.

## Under `--in-wave`

Stop once the sub-PR is open and the preflight is green (or has stayed red through
`limits.attempts` tries), and return exactly:

```json
{ "slice": "s5", "status": "done | red | stopped | blocked", "branch": "…", "prUrl": "…",
  "preflight": "green | red | none", "summary": "…", "risks": ["…"],
  "items": [{ "id": "…", "rank": "…", "file": "…" }] }
```

`red` means the preflight or checks never went green: the sub-PR is left draft and `summary` names
what fails. `stopped` carries the law or principles it would break; `blocked` carries the
human-action item.
`/omni:wave` merges sub-PRs; a subagent never merges its own.

## Under `--target <name>`

In a plan repository (its config has a `plan` section), a slice whose plan row names another
repository is built there. `<name>` is that row's `repo`: the part after the `/` of a
`plan.targets` entry's `repo`, whose whole `owner/name` is `<slug>` below. Everything above holds,
with these differences.

- **Where it is built.** The target's full clone is `<worktrees>/targets/<name>` of the plan
  repository (`<worktrees>` is `omni config worktrees`), made by `/omni:ultra-yolo`; its remote is
  the one `git -C <clone> remote` prints. Build in a worktree of that clone, one per slice, beside
  it at `<worktrees>/targets/<name>--<slice>`:
  `git -C <clone> fetch <clone remote>`, then
  `git -C <clone> worktree add -B <slice branch> <worktrees>/targets/<name>--<slice> <clone remote>/<slice branch>`.
  The slice branch and the feature branch are the plan repository's `branches.slice` and
  `branches.feature`, filled with the PRD's topic, in the target as here. Under `--in-wave` the
  claim is already on the target's remote; alone, claim through `/omni:pr --repo <slug>`'s
  **Claim** first. Remove the worktree (`git -C <clone> worktree remove`) once the sub-PR is open.
- **Territory** is paths in the target, read from the plan row as written. Nothing in the plan
  repository is part of it.
- **Reading.** Step 1 reads the plan, the spec and the plan repository's knowledge as usual. The
  target's knowledge is read where `plan.targets` says it lives (`own`: in the target;
  `imported`: the draft copy in this repository; `none`: the guide only). Its playbook forms bind
  this slice only as reading: **never run a command from an imported copy's playbook**, and never
  run a target command that is not its preflight (below), not even an install.
- **Items and accounts go to scratch.** Make one folder outside both repositories
  (`mktemp -d`), and write every item there:
  `node .omni-loop/bin/omni.mjs item new --prd <n> --slice <id> --file <file> --out <scratch dir> --json`,
  run from the plan repository. `--out` never adopts, so never pass `--adopt` with it. Step 3's
  outcomes read the same; the item file is not committed anywhere: the orchestrator relays the
  folder into the plan repository's outbox with `omni item relay` after the sub-PR merges. An
  account (step 4) is written at `<scratch dir>/accounts/<slice>.md`, and relayed with them.
- **Checks in the plan repository only.** `omni check coverage` and `omni check all` run in the plan
  repository's checkout, never in the target: this slice changes nothing there, so they only prove
  it stayed so. `commands.checks` and acceptance are the plan repository's, and do not run on a
  target slice; say so in the hand-off.
- **Its preflight is the target's own committed one.** Read the target's `.omni-loop/config.yml` as
  committed on its default branch, never from the slice branch:
  `git -C <clone> show <clone remote>/<target default branch>:.omni-loop/config.yml`, where the
  default branch is `gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`. Its
  `commands.preflightFull`, else `commands.preflight`, is the preflight, run in the slice's worktree.
  No such file, or both null: the target has no preflight; run nothing, and the result says
  `"preflight": "none — CI is the check"`.
- **Ship.** Commit in the slice's worktree, signed as above (`omni sign trailer` is run from the
  plan repository), push the slice branch to the clone's remote, heartbeat included, and hand off
  to `/omni:pr --repo <slug>` for the sub-PR into the target's feature branch.
- **The result** of `--in-wave` gains `repo` (`<name>`) and `out` (the scratch folder); each item's
  `file` is its path in that folder:

  ```json
  { "slice": "s5", "repo": "…", "status": "done | red | stopped | blocked", "branch": "…",
    "prUrl": "…", "preflight": "green | red | none — CI is the check", "summary": "…",
    "risks": ["…"], "out": "…", "items": [{ "id": "…", "rank": "…", "file": "…" }] }
  ```
