# `kit/plugin/skills/do-work/SKILL.md`

Source: `.claude/skills/vertuo-do-work/SKILL.md` @ `vertuo-ai-domain@c4a210122`, and the prose
duties of `outbox-policy.mjs` beside it (the module itself was ported earlier as
`kit/lib/policy/outbox-policy.mjs`, see `policy--outbox-policy.md`). Typed `/omni:do-work`.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| no Step 0 | `omni config`, stop in one line when it fails (spec §2.1 rule 1) |
| `docs/knowledge/`, `docs/glossary.md` | `paths.knowledge` (only when `laws.source` is `knowledge`), `paths.glossary`, every file in `paths.context` |
| plan, slice and PRD found by convention | `omni prd <n>` gives the plan, the spec and the outbox dir; the slice row gives the territory |
| `origin/feat/<topic>`, slice branch by hand | `repo.remote`, the feature branch as an input, `branches.slice` for the slice branch |
| `docs/outbox/<prd>/…` | the outbox dir `omni prd` prints; accounts at `<outbox dir>/accounts/<slice>.md` |
| `renderOutboxItem` + `adoptItem` called by hand, or `scripts/outbox-settle.mjs adopt` | `omni item new --prd --slice --file <file> --json`, which picks the rank and the id; `--adopt` for a medium item when running alone |
| `node scripts/check-decision-coverage.mjs origin/feat/<topic> <prd>` | `omni check coverage --base <remote>/<feature branch> --prd <n>` |
| `pnpm quality:preflight --full` | `commands.preflightFull`, falling back to `commands.preflight` |
| `pnpm check` (implied) | every command in `commands.checks`, then `omni check all` |
| `<behaviour>.pending.feature` → `.feature` | `acceptance.pendingSuffix` under `acceptance.dir`, only when `acceptance.enabled` |
| the browser scenarios run twice against Railway | `acceptance.run`, run twice, only when `acceptance.enabled` |
| `vertuo-pull-request` (PR kind, labels, `Part of #<prd>`, lifecycle) | "follow `/omni:pr`" — labels and link lines are that skill's, read from `labels.*` and `prLinks.*` |
| `vertuo-parallel-wave` dispatch | `/omni:wave`, signalled by the explicit `--in-wave` input |
| "Start From Architecture" (Zod-first, OpenRouter, Kysely, controller-service-repository, `use-intl`, ADR 0037/0040) | the repository's own forms: `omni kb show architecture`, `conventions` and `setup` (PRD 45; it was `.omni-loop/repo.md`, now retired) |
| `docs/agents/testing.md`, `verification.md`, `pull-request.md`, `definition-of-done.md` ("Pair With") | `omni kb show testing` at test-first; `verification`, `pull-requests`, `definition-of-done` at ship (PRD 45) |

## Dropped

- **Railway e2e recipe:** `E2E_BASE_URL`, the door secret, the QA tenant login, `railway variables`,
  `playwright install`, `bddgen`. Replaced by `acceptance.run`.
- **OpenRouter / `system-ai` / `LlmClient`, Zod-first, Kysely / `system-db-core`, prompt/eval
  rules, i18n and `use-intl` (ADR 0037, ADR 0040):** repository architecture; now the repository's
  `architecture` form (PRD 45; `.omni-loop/repo.md` before it).
- **`apps/e2e/handles.json` and `pnpm check:test-handles`:** repository-specific; a repository that
  wants it writes it in its `testing` form and `commands.checks` (PRD 45; `.omni-loop/repo.md` before).
- **ADR 0061 (PR-creation hook), ADR 0069 (legacy spec path), PRD #985/#1044/#1071/#1081/#1166
  references:** upstream history.
- **"Given a spec path" / standalone PR into `main`:** the loop builds slices only; a legacy spec is
  not an Omni Loop input.
- **"Right-Size The Model (When Delegating)":** a slice is built by one agent, and `/omni:wave`
  already sits two levels deep; do-work delegating further would near the three-level subagent limit.
- **"SOLID In This Repo" examples tied to OpenRouter/Kysely:** kept as three generic lines in Build.
- **"Pair With"** (`vertuo-fix-bug`, `vertuo-testing`, `docs/agents/*.md`): none has an `/omni:` twin;
  the `docs/agents/` pages came back as the playbook forms in PRD 45 (above).
- **Writing the item text by hand** (the letter-your-own-options fallback): `omni item new` renders it.

## Changed

- **Stops:** upstream's three stops (named law, human action, principles conflict) are now read
  from `omni item new`'s exit code and stderr: `must stop` / `nothing was written (stop)` is the stop
  outcome (named law or principles conflict, merged in one row); `is blocked` is the blocked outcome.
- **Medium items:** upstream always adopted at raise time. Here `--adopt` is passed only when
  running alone; under `--in-wave` the open file is left for `/omni:wave` to adopt after the wave
  merges (the rule the PRD 7 slices themselves follow, to avoid ledger races).
- **"A sub-PR has no CI"** (its lifecycle ends at a green preflight and no conflict with the feature
  branch) and the **Co-Authored-By trailer** line are kept, in the hand-off to `/omni:pr`; the
  Conventional-Commit title and the in-progress label are left to `/omni:pr`.
- **Reading `omni item new`'s outcome from stderr** (`must stop`, `nothing was written (stop)`,
  `is blocked`) is now reading its `--json` output instead (slice s13): `{ outcome, rank, id,
  file, adopted, reason }` on stdout. `outcome` is `null` — not one of `decideRecording`'s three
  values — for a failure that never reached the recording policy at all: an `--adopt` the ledger
  refused, or a rendered item the same check `omni check outbox` runs on every open item would
  reject; either way nothing is written and `reason` says why.
- **Account example** keeps the upstream three-line shape, with placeholders instead of a real path.
- **`.omni-loop/repo.md` retired** (PRD 45, the spec's wiring table): step 1.5 read it "when it
  exists", and no repository held one. It now reads the `architecture`, `conventions` and `setup`
  forms through `omni kb show`, which print the kit default for any section a repository left
  blank; the skill no longer names `repo.md`.
- **Step 0's stop line** says "not installed" (PRD 45, and PRD 68 for the config error): `/omni:invade`
  (PRD 45's form-filling skill, renamed by PRD 68) now names filling the forms, and a failing
  `omni config` means `omni init` has not run.

## Added

- The `--in-wave` input (explicit; upstream inferred "dispatched by the wave" from context).
- Claim first when running alone: follow `/omni:pr`'s Claim mode (empty claim commit, push, draft
  sub-PR, claimed status comment) before building (spec §2.1 rule 6). Upstream left the claim to the
  wave. Under `--in-wave`, the existing claimed slice branch is checked out, never cut afresh.
- Heartbeat: push work in progress at least every half of `limits.claimStaleMinutes`, so a long live
  slice never reads as a stale claim a second wave could take.
- `/omni:pr` owns marking the sub-PR ready once the preflight is green; do-work hands off to it.
- A `red` status in the wave's result shape, for a preflight or checks that never went green.
- The `--adopt` failure path (exit 1, `nothing was written:`): rerun without `--adopt`, name it in risks.
- "Territory only": a change outside the slice row's territory is a decision, not a fix.
- The item JSON field list, and "exit 2 means your JSON is wrong".
- **The playbook forms** (PRD 45, the spec's wiring table), each read through `omni kb show`:
  - step 0 prints the `briefing` before any other step (acceptance criterion 9), and says how to
    read a form: a blank section is the kit default, a `[hole]` is a question for a person and never
    stops the slice (decision 7), and a form adds to the skill's steps without overriding its rules
    (item s6-02);
  - read before building: `architecture`, `conventions` and `setup`, in place of `repo.md` (above);
  - build, test-first: `testing`, before naming the "done" condition;
  - ship: `verification`, `pull-requests` and `definition-of-done` first; what they ask of a push or
    a hand-off is part of the step.

  Not wired, because the spec's table does not name them for do-work: `decisions` (the before/after
  page lists it beside `bearsOn: ADR-nnnn`) and `definition-of-done` at the account step. The spec's
  risk "a step reads only the forms the wiring table names" decides.

## PRD 50, slice s3: the intro and the punchline

Not a re-port: upstream's skill has no intro or punchline. A kit-local change to the prose, which
the bundle does not carry.

- **Step 3, `Fields:`** names `introFun` and `punchlineFun` after the two plain-words fields, with
  their rules: written for every item raised; one sentence (two short ones at most, since the kit
  allows two — PRD 50's outbox item `s1-01-fun-line-sentence-count`); at most 120 characters; plain
  words by the same rules; about the question or its situation, never about a person or a team,
  never mocking whoever answers; the kit refuses one without the other. It says where they show:
  the intro opens the question in the pull request's outbox comment, the punchline follows it. The
  spec's leave for an agent's line to name anything in the repository's world is not repeated: the
  skill names no game word (PRD 3 §2, principle 7).
- **Step 3, exit `2`** now tells its two kinds apart, as `omni item new` does since PRD 50 s1
  (`kit/porting/bin--commands.md`): the JSON refused — not valid JSON, or a field missing, unknown
  or breaking its rule, a bad intro or punchline or one without the other included — is one line on
  stderr naming the field and an empty stdout, even with `--json`; the rendered item refused by
  `checkItemText` is `outcome: null` with `reason` on stdout under `--json`. This replaces "Exit `2`
  is no longer only 'your JSON is wrong': read `reason` first", which a bad intro contradicts.
- **Step 0** says "the Omni Loop kit is not installed in this repository" instead of the older
  game-word line, so the skill names no game word. `/omni:plan`, `/omni:brainstorm` and
  `kit/lib/config.mjs` kept the old word at first (PRD 50's outbox item `s3-01`, on the installed
  wording); PRD 68 made "not installed" the only wording.

### Tests

None added: `kit/test/plugin.test.mjs` is outside this slice's territory, and asserts only that
the frontmatter parses and that every `omni` command the skill names exists. The two
refusal shapes the exit-`2` bullet describes were checked against the live CLI and against
`kit/bin/item.test.mjs` (the s1 tests "an intro over 120 characters…", "the same refusal under
--json and --adopt…", "the same violation prints outcome null…").

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.

## PRD #99, slice s2 — the skill signs the loop's work

Not a re-port: upstream's skill signs nothing. A kit-local change to the prose, which the bundle
does not carry. PRD #99 makes OmniMan (the `signature` config section, slice s1) a co-author of every
commit the loop makes and the signer of every pull request and issue it opens.

- **Signing,** a paragraph under the `omni` line: every commit the skill makes ends with the
  session's co-author trailer, then the line `omni sign trailer` prints, as the message's last line
  with no blank line between them, so both stay in the trailer block. Every pull request or issue it
  opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
  the session's own attribution lines, and a body it rewrites keeps that line. Comments are never
  signed. A command that prints nothing (`signature: null`) means signing is off: the skill adds
  nothing and runs unchanged. No skill spells the signer's name or address.
- **Build, reviewable commits:** every commit of the slice (code, item files, the account, a
  heartbeat push) ends with the co-author trailer, then the trailer line. Before, only the hand-off
  named the trailer.
- **Ship, the hand-off to `/omni:pr`:** "Co-Authored-By trailer on every commit" becomes a body
  that ends with the footer line, and the co-author trailer and the trailer line on every commit.
  This supersedes the **Changed** bullet above, in which the hand-off alone kept the trailer.

### Tests

`kit/test/plugin.test.mjs` gained one rule, run on the live skills and on fixtures built to break
it: a SKILL.md that asks for the co-author trailer names `omni sign trailer`, and one that opens a
pull request or an issue (`gh pr create`, `gh issue create`, or "open(s) the/a … PR, pull request
or issue" in prose), or rewrites its body (`gh pr edit … --body-file`), names `omni sign footer`.
A skill that only comments is held to nothing. The existing rule that every `omni` command a
SKILL.md names exists now covers `sign`.

### Gate (this update)

`pnpm vitest run kit/test/plugin.test.mjs kit/test/no-literals.test.mjs` and `pnpm test`, green.

## PRD #1369, slice s4 — the design review on UI work

Not a re-port: upstream's skill never looks at a screen. A kit-local change to the prose, behind
the `design.enabled` flag (default off), wired to `/omni:pixel-perfect review` and
`omni design touched` rather than restating them.

- **Step 0** reads `omni config design.enabled` after the config. Anything but `true` means no
  design review runs and the sub-PR has no **Design review** section: the skill is as it was.
- **Step 4, Design review,** inside point `do-work.review` and before the coverage grade (its fixes
  are code the account must cover). It runs `omni design touched <remote>/<feature branch>` and
  follows `/omni:pixel-perfect review` (that skill's step 0, then `reference/review.md`) when the
  plan marks the slice `ui: yes` or the check prints `ui: yes`; on `ui: unknown` it judges from the
  diff and says that it judged; on `ui: no` it skips, with one `—` line. It is given the PRD and
  slice, the territory, the base and the before/after page's "after" screen.
- **Never blocking.** A finding is never the stop or the blocked outcome, never turns a check red
  and never holds the sub-PR draft; what it did not fix becomes an outbox item through step 3.
  Step 3's "two ways a slice ends early" says so too.
- **Step 5's hand-off** carries the **Design review** section in the sub-PR body when the flag is
  on. Screenshots stay in a scratch folder, attached when the session can, never committed.
- **Under `--target`** the review does not run (no target app runs from a plan repository): one
  `—` line says so.

### Tests

`kit/test/plugin.test.ts`, the block "the design review in the skills that drive screen work (PRD
1369)": the flag in step 0, `omni design touched` then `/omni:pixel-perfect review` before the
coverage grade, the `ui: unknown` judgement, the never-blocking lines, and the section in step 5.

## PRD #1407, slice s6 — the design memory

Not a re-port: kit-local prose behind `design.enabled`, wired to `omni design screens`,
`omni design touched`'s `screens:` line and `/omni:pixel-perfect`'s review, never restating them.

- **Step 1** gains item 6, **The design memory**: on a slice that builds or changes a screen, read
  `omni kb show design` with its `language` laws, then `omni design screens` and each library
  screen the slice builds or touches, file and mockup. A locked screen is built as written, never
  redesigned; a draft is a starting point.
- **Step 3** gains **A change to a locked screen or law**: never edit a locked screen's body or a
  locked law, never lock; build what the spec asks, and record it with `hardToRevert: true` by rule
  (the Jev step skipped, so it is always high), naming the screen, the change and who locked it,
  with the amendment line the owner would add left for their words. Never a stop, and the one
  design finding that is high. **Exactly two ways a slice ends early** says so.
- **Step 4's design review** reads the same check's `screens:` line, and a change it finds to a
  locked screen is that high item, never a lock and never an edit of the locked file.

### Tests

`kit/test/plugin.test.ts`, the block "the design memory in pixel-perfect and do-work (PRD 1407)":
the library read in step 1, the locked screen built as written, and the high item in step 3.
