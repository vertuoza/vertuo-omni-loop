# The retro — plan

**PRD:** #72 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/retro` → `main`
(`Closes #72`) · **Sub-PRs:** `feat/retro--<slice>` → the feature branch (`Part of #72`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

s2 is the tracer: one merged feature PR, end to end, to one retro PR holding only the timeline. It lays
out every seam the later slices fill — a module per kind of finding under `kinds/`, `narrate` returning
no prose, `issues` publishing none — so that the wave-3 slices each own one file family and build side
by side.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The kit knows retros: `labels.retro` (default `omni:retro`) and `branches.retro` (default `docs/retro-{topic}`) in the config schema, the label's colour and description so `omni init` creates it, the delivery README naming `retro.md` and `retro.json`, and `.gitattributes` marking `kit/dist/**` as generated | `kit/lib/config.` `kit/lib/init/labels` `kit/bin/init.test.mjs` `kit/dist/omni.mjs` `.omni-loop/delivery/README.md` `.gitattributes` | — | 1 |
| s2 | A merged feature PR opens a retro PR: the webhook routes a merged `closed` to `omni-loop/retro.requested` and nothing else; the manifest asks for the new permissions; the `retro` function qualifies the PR, gathers, runs the kinds (the timeline for real, the others finding nothing), renders `retro.md`, `retro.json` and the PR body, and publishes the branch, the files and the PR, idempotently, or one comment on failure | `apps/omni-app/src/webhook/` `apps/omni-app/src/inngest-client.mjs` `apps/omni-app/api/` `apps/omni-app/app.yml` `apps/omni-app/test/` `apps/omni-app/src/retro/` `apps/omni-app/README.md` | s1 | 2 |
| s3 | Checks red again and again: check runs on every sub-PR commit, the tails of failed jobs' logs, repeated red, red then green on the same commit, and failing tests named from Vitest, Jest, Playwright and pytest output | `apps/omni-app/src/retro/kinds/ci` | s2 | 3 |
| s4 | Code rewritten again and again: every commit's patches, churn per file and per line range followed through the hunks, generated files and lockfiles left out, a file without a patch counted by its totals | `apps/omni-app/src/retro/kinds/churn` | s2 | 3 |
| s5 | How the delivery went: territory breaches through the kit's `breaches`, needs-fix and stuck slices and second claims, decisions from the settled file (drift, rework, a merge under the override label), and review findings left red or unresolved at merge | `apps/omni-app/src/retro/kinds/delivery` | s2 | 3 |
| s6 | The model writes the prose: one call to OpenRouter from the Vercel function, Claude Opus 5.5 unless `OPENROUTER_MODEL` says otherwise, the input capped and masked, the JSON checked and repaired once, and `guard` dropping any field with a number, an id, a link or a word it did not get | `apps/omni-app/src/retro/narrate` `apps/omni-app/src/retro/guard` `apps/omni-app/vercel.json` | s2 | 3 |
| s7 | One retro issue per finding: the five most severe findings each get an issue labelled `labels.retro`, found again by its marker (an open one rewritten, a closed one left closed), ending with the YAML block `/omni:retro-apply` will read | `apps/omni-app/src/retro/issues` | s2 | 3 |
| s8 | Fourteen days later: the function sleeps until the merge plus 14 days, then counts the `bug` issues naming the PRD, the churn ranges their fixes touched and the merge commit's checks, and adds an "After merge" section to the open retro PR, or opens `<branch>-day-14` once the first one is merged | `apps/omni-app/src/retro/kinds/after-merge` `apps/omni-app/src/retro/retro.` `apps/omni-app/src/retro/publish` | s4, s7 | 4 |

**Shared ground.** `apps/omni-app/src/retro/` is s2's whole territory. Every later slice owns a narrower
prefix inside it, and no two slices of one wave share one: s3 to s7 in wave 3 own `kinds/ci`,
`kinds/churn`, `kinds/delivery`, `narrate` + `guard`, and `issues`; s8 alone in wave 4 owns
`kinds/after-merge`, the function file (`retro.`) and `publish`. A wave-3 slice keeps its tests and
fixtures under its own prefix (`kinds/ci.test.mjs`, `kinds/ci.fixtures/`). s2 wires every seam before
wave 3 starts: the kind registry names all five kinds, the function calls `narrate` and the issue
publisher, and `render` places each kind's findings under the section that kind names, prose and issue
links included when they are given. No wave-3 slice edits the registry, the function or `render`. The
PRD 50 recording under `apps/omni-app/test/fixtures/` is s2's; s5 reads it without writing to it.
`kit/dist/omni.mjs` is rebuilt by s1 alone: nothing after it changes the kit.

**Across PRDs.** PRD 45 (knowledge forms) also changes `kit/bin/init.test.mjs` and `kit/dist/omni.mjs`,
and adds keys to the config schema, on its own feature branch. Whichever PRD ships second merges `main`
into its feature branch, resolves those files, and rebuilds the bundle.

## Per slice: done when

- **s1:**
  - `omni config labels.retro` prints `omni:retro` and `omni config branches.retro` prints
    `docs/retro-{topic}` on a config that sets neither; a config that sets them is read back.
  - `omni init` creates `omni:retro` with its colour and description when it is missing, and leaves an
    existing one alone (the label tests).
  - The delivery README names `retro.md` and `retro.json` in a PRD's folder; `.gitattributes` marks
    `kit/dist/**` as `linguist-generated`.
  - `omni check all` is green with a `retro.md` and a `retro.json` in a shipped folder.
  - `kit/dist/omni.mjs` is rebuilt and committed; `kit/test/no-literals.test.mjs` passes; `pnpm test` is
    green.
- **s2:**
  - Acceptance criteria 7 and 8: webhook tests — a merged `closed` becomes one retro event carrying the
    merge SHA and time and no outbox event; an unmerged `closed` becomes nothing; every other handled
    action becomes the outbox event exactly as before. The `outbox-check` tests pass unchanged.
  - `app.yml` asks for `contents: write`, `issues: write`, `actions: read` beside the permissions it
    keeps; its test pins them and the `closed` action.
  - `@inngest/test` against the stubbed GitHub: a merged feature PR publishes a branch
    `docs/retro-<topic>`, `retro.md` and `retro.json` in the PRD's folder (shipped, or inbox when
    unshipped), and a PR labelled `omni:retro` into `main`; a merged sub-PR, a merged phase-0 PR and a
    repository without config publish nothing; a replay creates no second branch or PR and adds a commit
    instead of rewriting one; a GitHub failure after retries leaves one comment on the feature PR.
  - Acceptance criterion 2 for the timeline: every number `render` writes is read from the fact sheet,
    and the fact sheet is what `retro.json` holds (golden files).
  - The PRD 50 recording (#51 and its sub-PRs, as GitHub returned them) replays offline to 3 slices in 2
    waves.
  - Without prose, `retro.md` reads "Facts only: <reason>"; `rules` holds the version, the finding order,
    the cap of five issues and the refused words; the README lists the human steps of the spec.
- **s3:**
  - Fixtures: a check red on two commits, and in two slices; a red then green on the same commit marked
    flaky; one log per reporter (Vitest, Jest, Playwright, pytest) yielding test names and counts; a log
    in an unknown format kept as an excerpt with no count.
  - Only failed jobs' logs are fetched, and only their last lines.
- **s4:**
  - Fixtures: a line range rewritten in three commits across two slices, followed through earlier hunks
    that shift its line numbers; per-file churn at and below the thresholds; a `linguist-generated` path
    and a lockfile left out; a file GitHub sent without a patch counted by its totals, and named.
- **s5:**
  - Fixtures: a breach outside the slice's territory found, and one on declared shared ground not
    flagged; a needs-fix label and a stuck comment; a second claim of one slice; a drifted decision
    closed as reworked; a merge under the override label; a red-circle review finding and a thread
    unresolved at merge.
  - The PRD 50 recording yields 4 adopted decisions and no drift.
- **s6:**
  - Acceptance criterion 5: without `OPENROUTER_API_KEY` the retro reads "Facts only: no model key"; a
    stubbed 500 after the step's retries gives "Facts only: model unavailable (500)".
  - A stubbed reply is accepted field by field; `guard` drops a field holding a digit (a backtick span
    copied from the evidence excepted), an unknown finding id, a foreign link, an over-long field or a
    refused word, each with its reason; a reply failing the schema is repaired once, then dropped.
  - The request carries at most the capped input, older logs cut first, and no token-shaped string.
  - `vercel.json` gives `api/inngest.mjs` a `maxDuration` above 60 seconds.
- **s7:**
  - Acceptance criteria 3 and 4 for issues: the five most severe findings, in `rules`' order, each get
    one issue labelled `omni:retro` and never `omni:prd`, ending with the YAML block; `retro.md` links
    each; a replay rewrites the open ones and creates none; a closed one stays closed and is still
    linked.
- **s8:**
  - Acceptance criterion 6 under `@inngest/test`: the function sleeps until the merge plus 14 days; a
    `bug` issue naming `#<prd>` inside the window is counted and one outside it is not; a fix touching a
    churn range is marked linked; the "After merge" section is committed to the open retro PR, or a
    `<branch>-day-14` PR opens when the first one was merged; a new finding gets its issue.
- **Whole PRD:** acceptance criteria 1, 9 and 10; the README's human steps name what a person does
  before criterion 1 can be checked live; `omni status 72` is green, or red only for items a person must
  answer, and `omni ship 72` has run on the feature branch before the feature PR is marked ready.
