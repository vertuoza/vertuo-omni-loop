---
name: do-work
description: Build ONE slice of a PRD to standard — grounded in the repository's own context, test-first through red-green-refactor, inside the slice's territory only, every decision taken without asking recorded as an outbox item — then ship it as a sub-PR. The job every /omni:wave subagent does; a person may also run it on one slice. Triggers on "do the slice", "build s3", "/omni:do-work".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-do-work/SKILL.md — changes in kit/porting/plugin--do-work.md -->

# Do work: one slice, to standard

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

## Inputs

| input | example | notes |
|---|---|---|
| PRD | `7` | the PRD number |
| slice | `s5` | a row of the PRD's plan |
| feature branch | shaped like `branches.feature` | the branch the slice is cut from and its sub-PR targets |
| `--in-wave` | — | set by `/omni:wave` only. Changes three things, below: the claimed slice branch is checked out rather than cut, medium items are not adopted, and the skill stops once the sub-PR is open and returns the wave's result shape |

Given only a PRD, this is not your job: follow `/omni:yolo` (or `/omni:wave`) instead.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the repository
is not terraformed. Keep the JSON; later steps read `repo.remote`, `branches.*`, `paths.*`,
`commands.*`, `acceptance.*` and `laws.source` from it.

## 1. Read before you build

1. `node .omni-loop/bin/omni.mjs prd <n>` — where the PRD lives: its plan, its spec, its outbox dir.
2. The slice's row in the plan: its **territory** (the only paths you may create or change, plus
   outbox item and account files), what blocks it, its wave. Read the plan's "done when" for it.
3. The spec, in full.
4. Every file in `paths.context`, the glossary at `paths.glossary` when set, and — when
   `laws.source` is `knowledge` — the knowledge folder at `paths.knowledge` (principles, rules,
   invariants; `node .omni-loop/bin/omni.mjs knowledge <id>` explains one).
5. `.omni-loop/repo.md` when it exists: the repository's architecture rules (layering, data
   contracts, persistence, UI text, test handles). They bind this slice as if written here.

The slice branch is `branches.slice` filled with the feature branch's topic and the slice id.
Never work on the default branch or on the feature branch.

- **Under `--in-wave`:** `/omni:wave` has already claimed the slice. Do not cut a fresh branch:
  fetch and check out the existing `<repo.remote>/<slice branch>`, which holds the claim commit.
- **Running alone:** claim first. Cut the slice branch from `<repo.remote>/<feature branch>`, then
  follow `/omni:pr`'s **Claim** mode (an empty claim commit, a push, the draft sub-PR, the claimed
  status comment) before you build anything.

**Heartbeat.** A claim reads as stale when its branch has no commit beyond the claim and the claim
is older than `limits.claimStaleMinutes`; a stale claim can be taken by a second wave. While
building, commit and push work in progress at least every half of
`node .omni-loop/bin/omni.mjs config limits.claimStaleMinutes` minutes.

## 2. Build

- **Test-first:** name the testable "done" condition, write the failing test, watch it fail
  (red), make it pass (green), then refactor with the tests green. Characterization tests first
  before a risky refactor.
- **Tracer bullets, not layer piles.** Prove the smallest vertical path, then widen.
- **Territory only.** A change outside the row's territory is a decision (below), not a fix you
  just make.
- **Follow local patterns;** let abstractions earn their keep. Narrow, behavioural seams; small
  ports over broad clients; one responsibility per module.
- **Reviewable commits:** one coherent change each, no unrelated formatting.

## 3. Record the decision, keep building

When the PRD, the spec, the context files and the knowledge folder do not settle something:

1. **Take the most reversible option** — the one a different answer undoes for the price of a
   constant, not a migration — and carry on.
2. **Record it** with `omni item new`. Write the JSON to a scratch file (never in the repository):

   ```bash
   node .omni-loop/bin/omni.mjs item new --prd <n> --slice <id> --json <file>            # --in-wave
   node .omni-loop/bin/omni.mjs item new --prd <n> --slice <id> --json <file> --adopt    # alone
   ```

   Fields: `slug`, `wave`, `bearsOn` (a law id, `ADR-nnnn`, or omit), `questionPlain`,
   `decisionPlain`, `decide`, `meanwhile`, `cost`, `gaps`, `options` (two to four; A is what you
   built), and the flags `hardToRevert`, `breaksNamedLaw`, `needsHumanAction` (then `personSteps`
   instead of `options`), `principlesConflict`. The two plain-words fields are for a business
   person: one or two sentences, no path, no code, no id. **Never invent a rationale:** a gap you
   could not close goes in `gaps`, marked `(author)`.
   The kit picks the rank and the id; you never do. `--adopt` only acts on a medium item: it goes
   straight to the ledger. Under `--in-wave`, never pass it — `/omni:wave` adopts after the wave
   merges, so parallel slices do not race on the ledger.
3. **Read the exit code.** `0`: carry on. Non-zero with `must stop` or `nothing was written (stop)`
   on stderr: the **stop** outcome. Non-zero with `is blocked`: the **blocked** outcome. Exit `2`:
   your JSON is wrong — fix it and rerun. Exit `1` with `nothing was written:` after `--adopt`: the
   ledger refused the adoption (the lines under it say why); rerun without `--adopt` so the item
   stays an open file, name the refusal in your risks, and carry on.
4. Commit the item file (or the ledger change) on the slice branch.

**Exactly two ways a slice ends early.**

| the slice meets | it does |
|---|---|
| the **stop** outcome — a law it can name would break, or two principles pull the decision apart | stops that slice, commits any item written, pushes, and reports the law or principles. Its siblings finish |
| the **blocked** outcome — a human action it cannot perform (a secret, a grant, a console step) | commits the human-action item, pushes, opens the sub-PR through `/omni:pr`, returns `blocked` |

Anything else is not a stop. "This might break something" is a risk: record it with
`hardToRevert` and carry on. Contradicting an ADR is proposing to supersede it: record it with
`bearsOn` set to the ADR, and carry on.

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
   sub-PR (title, body, Co-Authored-By trailer on every commit), keeps its status comment, marks it
   ready once the preflight is green, and runs its lifecycle. A sub-PR has no CI: its lifecycle
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
