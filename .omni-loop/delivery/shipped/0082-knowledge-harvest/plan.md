# Knowledge harvest — plan

**PRD:** #82 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/knowledge-harvest` →
`main` (`Closes #82`) · **Sub-PRs:** `feat/knowledge-harvest--<slice>` → the feature branch
(`Part of #82`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Build order:**
- **Waves 1 and 2** build the pure units, each against its own fixtures: the kit's config and parser,
  settle at merge, the candidates and the classifier contract, the OpenRouter client, and write
  knowledge. They also build the retro's move onto the shared client and writer.
- **Wave 3 is the tracer.** s7 wires the units into one pipeline and gives it its first caller,
  `omni harvest`, end to end on a fixture repository.
- **Wave 4** holds the pipeline's two other callers: the app's `knowledge-harvest` function (s8), and
  this repository's backfill (s9).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The kit knows knowledge PRs: `branches.knowledge` (default `docs/knowledge-{topic}`) and `labels.knowledge` (default `omni:knowledge`) in the config schema, the label's colour and description so `omni init` creates it, the register parser reading `Merged:` as its own field, and the delivery README naming the knowledge PR and the merge-over-red rule | `kit/lib/config.` `kit/lib/init/labels` `kit/bin/init.test.mjs` `kit/lib/knowledge/registers.` `kit/dist/omni.mjs` `.omni-loop/delivery/README.md` | — | 1 |
| s2 | A merge over a red outbox adopts what is still open: `settleAtMerge` appends one `adopted` entry per open item and per drift never reworked, approved by the merger at the merge time with basis `merged-over-red`, and lists the item files to delete; `renderSettledEntry` takes the `Closed:` line it is given | `kit/lib/outbox/settle-merge.` `kit/lib/outbox/settle.` `kit/dist/omni.mjs` | — | 2 |
| s3 | What to harvest, and what to ask: `harvestCandidates` lists the latest settled entry per id carrying neither `Became:` nor `Stays here:`; `classificationPrompt` builds the prompt from the item, the answer and a summary of the knowledge base; `ClassificationSchema` refuses every reply the spec's field table does not allow, and every kind the repository has no place for | `kit/lib/knowledge/harvest.` `kit/lib/knowledge/classify.` | — | 1 |
| s4 | One OpenRouter client in the kit, ported from PRD 72's `narrate`: PRD 72's default model unless `OPENROUTER_MODEL` names another, token-shaped strings masked, a JSON-schema reply, one repair request, a missing key named, `fetch` injected | `kit/lib/openrouter.` | — | 1 |
| s5 | Decisions written as knowledge: `writeKnowledge` turns classified candidates into file edits. That covers the next ids past the default branch and the open knowledge branches, the decision record, the register entry and the proposed principle, "None yet." removed, provenance and `Proposed:` set by who answered, and the ledger's `Became:` or `Stays here:` lines | `kit/lib/knowledge/write.` | s1, s3 | 2 |
| s6 | The retro shares its model client and its writer, and writes into `shipped/`: its `narrate` calls the kit's OpenRouter client, its branch-and-commit writer moves to `apps/omni-app/src/git-write/`, and `retro.md` and `retro.json` always go into `shipped/<nnnn-topic>/` | `apps/omni-app/src/git-write/` `apps/omni-app/src/retro/narrate.` `apps/omni-app/src/retro/publish.` `apps/omni-app/src/retro/retro.` | s4 | 2 |
| s7 | `omni harvest <prd> --pr <n>`, the tracer: the harvest pipeline the CLI and the app share. Prepare settles at merge, plans the ship and lists the candidates; finish writes, applies, runs both checks and drops what fails. The command runs it locally: merge facts through `gh`, OpenRouter through the kit's client, files written into the working tree, nothing committed | `kit/lib/knowledge/pipeline.` `kit/bin/commands/harvest.` `kit/bin/commands/index.` `kit/bin/harvest.` `kit/bin/github.` `kit/dist/omni.mjs` | s1, s2, s3, s4, s5 | 3 |
| s8 | A merged feature PR opens a knowledge PR: the webhook sends the harvest event beside the retro's, and the `knowledge-harvest` function qualifies, settles, classifies one candidate per step, writes and publishes through the shared writer. One run at a time per repository, ids past every open knowledge branch, a replay adding nothing, settle and ship without a key, one comment on failure | `apps/omni-app/src/webhook/` `apps/omni-app/src/knowledge-harvest/` `apps/omni-app/src/inngest-client.` `apps/omni-app/api/` `apps/omni-app/test/` `apps/omni-app/README.md` | s6, s7 | 4 |
| s9 | This repository's knowledge base, from every PRD shipped: `omni harvest` for PRDs 3 (#4), 7 (#9), 28 (#29), 39 (#40), 45 (#46) and 50 (#51), and every other PRD in `shipped/` when the slice runs; the decisions form's Format section names `Decided:`, `Merged:` and `## Source` | `.omni-loop/knowledge/` `.omni-loop/delivery/shipped/` | s7 | 4 |

**Shared ground.**
- **`kit/dist/omni.mjs`** is declared by s1, s2 and s7, the three slices that change code the bundle
  holds: the config, the parser, the ledger renderer and the new command. The waves keep them apart:
  s1 is in wave 1, s2 in wave 2, s7 in wave 3.
- **The other kit slices (s3, s4, s5)** add modules nothing in the bundle imports until s7 wires them,
  so they leave the bundle unchanged. s7's rebuild takes them in.
- **The retro's folder** is split by file, and only s6 touches it: `narrate.`, `publish.`, `retro.`.
- **The app's function, webhook and route files** are s8's alone.
- **The two users of the harvest**, s8 (the app) and s9 (this repository's files), share no prefix.

**Across PRDs.** This PRD is blocked by PRDs 68 and 72, and wave 1 starts only once both have merged.
Before it starts, `main` is merged into the feature branch.
- PRD 72 owns `apps/omni-app/src/retro/` and the webhook's `closed` route. It also adds `labels.retro`
  and `branches.retro` beside the keys s1 adds, the label styles, the delivery README and the bundle.
- PRD 68 owns the register parser's `Proposed:` line and the relaxed checks s5's output relies on.

s1, s6 and s8 edit those files on top of what the two PRDs merged. Each rebuilds nothing it does not
own, except the bundle, which s1, s2 and s7 rebuild from the source as it stands.

## Per slice: done when

- **s1:**
  - `omni config branches.knowledge` prints `docs/knowledge-{topic}` and `omni config labels.knowledge`
    prints `omni:knowledge` on a config that sets neither; a config that sets them is read back.
  - `omni init` creates `omni:knowledge` with its colour and description when it is missing, and leaves
    an existing one alone (the label tests).
  - A register entry carrying `Decided:` then `Merged:` parses both as their own fields, `merged` on the
    parsed entry, and `omni check knowledge` stays green on it.
  - The delivery README names the knowledge PR, and says a merge over a red outbox adopts what is still
    open.
  - `kit/dist/omni.mjs` is rebuilt and committed; `kit/test/no-literals.test.mjs` passes; `pnpm test` is
    green.
- **s2** (acceptance criteria 1 and 2, for the ledger):
  - A fixture PRD with an open high item, an open human-action item and an open medium item:
    `settleAtMerge` returns three `adopted` entries and the three files to delete. Each entry carries:
    - `Approved by: @<merger>` and `Approved at: <merged_at>`
    - `Channel: feature pull request #<n>` with its URL
    - `Basis: merged-over-red — …`
    - `Closed: yes — adopted at the merge by @<merger>`
    - the answer text the spec gives
  - Drift never reworked gets a new `adopted` entry with `Closed: yes — merged without rework, by
    @<merger>`, and `gateResult` is green on the ledger with it appended. Reworked drift and adopted
    entries get nothing.
  - `renderSettledEntry` without a `closed` renders exactly as today: the existing settle tests pass
    unchanged.
  - The unit returns text and touches no file; `kit/dist/omni.mjs` is rebuilt and committed.
- **s3:**
  - **Candidates.** The fixture ledger holds:
    - an entry carrying `Became:`
    - one carrying `Stays here:`
    - an id settled twice (adopted, then drifted)
    - a plain adopted entry
    
    Only the second settling of the twice-settled id and the plain entry are listed. Each carries its
    item text, answer, verdict, approver, approval time and channel.
  - **The prompt.** It carries:
    - the item's sections, the answer and the verdict
    - every domain with the first line of its README
    - every principle
    - every record `readDecisions` lists
    - the rules and invariants in `product/` and the domains
    
    A snapshot pins it.
  - **The schema** refuses each of these:
    - an unknown kind
    - a `place` naming no existing domain
    - a rule with no `serves`
    - `serves: new` without `principle`
    - a statement or reason over its cap
    - `covers` naming nothing
    - `adr` with no ADR folder
    - `rule` or `invariant` with no knowledge folder
    
    It accepts each valid shape.
- **s4:**
  - **The request, against a stubbed `fetch`.** It goes to OpenRouter's chat completions with PRD 72's
    default model, or `OPENROUTER_MODEL` when set, at temperature 0, with a JSON-schema response format.
    The prompt's token-shaped strings are masked: `ghp_`, `ghs_`, `sk-`, `AKIA`, `Bearer …`, JWTs.
  - A reply that fails the schema gets one repair request. Failing again returns a refusal with its
    reason, and never throws.
  - With no `OPENROUTER_API_KEY`, it returns an error naming it before any request. No test reaches the
    network.
- **s5** (acceptance criteria 3 and 4, and 9 at the unit's level). On a fixture knowledge base holding
  ADR-0001, a principle and a domain:
  - **Each kind lands where it should:**
    - a classified `adr` gives `adr/0002-<slug>.md`, exactly the spec's example: the status line and
      the four sections
    - a rule serving `new` gives the rule, plus a proposed principle with `Why:`, `Source:`, `Merged:`
      and `Proposed:`, and no `Decided:`
    - an invariant goes into its domain's `invariants.md`
    - `covered` gives the ledger line `Became: <id>` and no file
    - `stays-here` gives `Stays here: <reason>`
  - **Ids** go past the highest on the default branch and past `taken`, the ids on open knowledge
    branches, for records and for each register file.
  - "None yet." is removed with a file's first entry.
  - **Provenance:**
    - `Proposed:` is on exactly the entries from adopted decisions and on new principles.
    - `Status:` is `accepted` for an agreed decision or a drift that was reworked, and `adopted`
      otherwise.
    - `Decided:` takes its three forms.
    - Every rule and invariant carries `Enforced by: unenforced`.
  - The edits applied to the fixture give a tree on which `omni check knowledge` and `omni check outbox`
    are green.
- **s6:**
  - The retro's `narrate` sends through `kit/lib/openrouter.mjs`. Its tests pass unchanged: the request,
    the masking, the repair, and facts only without a key.
  - `apps/omni-app/src/git-write/` holds the branch, commit and PR writer:
    - it refuses `repo.defaultBranch` before any request
    - a moved file reuses its blob in the tree
    - the retro's publish uses it, and its tests pass unchanged
  - A PRD merged without being shipped gets `retro.md` and `retro.json` under `shipped/<nnnn-topic>/`,
    and the issue's YAML `retro:` path names it there. The retro tests' expectation moves from `inbox/`
    to `shipped/`, and nothing else changes.
  - The outbox check's tests pass unchanged.
- **s7** (acceptance criteria 1, 5 and 10, through the CLI):
  - **The happy path.** It runs through `main()` on a fixture repository merged over red, with a fake
    `gh` and a fake OpenRouter. `omni harvest <prd> --pr <n>`:
    - settles the open items as adopted by the merger
    - moves the folder to `shipped/`, with its outbox inside
    - writes the knowledge and prints what it wrote
    - commits nothing, and exits `0`
  - Afterwards, `omni check knowledge` and `omni check outbox` are green.
  - An entry made to fail (its `Source:` names a missing file) is printed as not placed, with the
    check's message, and has no ledger line. A candidate whose reply is refused twice is printed as not
    placed.
  - **Refusals.** Exit `1`, naming why, for a PR that is not merged or not into the default branch. Exit
    `2` for a usage error or no `OPENROUTER_API_KEY`, with nothing written.
  - The pipeline's two halves return edits as data (moves, writes, deletes). The same input gives the
    same edits, whichever caller.
  - `kit/dist/omni.mjs` is rebuilt and committed; `omni` lists `harvest`; the plugin test is green.
- **s8** (acceptance criteria 1, 3, 6, 7, 8 and 9):
  - **Webhook tests:**
    - a merged `closed` becomes one retro event and one harvest event,
      `{ installationId, owner, repo, repository, prNumber }`
    - an unmerged `closed` becomes nothing
    - every other handled action still becomes the outbox event
  - **The knowledge PR,** with `@inngest/test` against the stubbed GitHub and a fake OpenRouter. A
    feature PR merged over red gives one knowledge PR:
    - title `docs(knowledge): PRD <n> — <title>`, head `docs/knowledge-<topic>`, base `main`, label
      `omni:knowledge`
    - a tree holding the adopted entries, the moved folder (blobs reused), the knowledge files and the
      ledger lines
    - a body whose table rows match the ledger lines, with the proposed principles first, not-placed
      decisions as checkboxes, then the settled, shipped and checks lines
  - **None of these starts a harvest:** a merged sub-PR, a merged phase-0 PR, a closed unmerged feature
    PR, a merged knowledge PR, a merged retro PR.
  - **Replays and ids.** A replay gives no second PR and no second commit, and rewrites the body. No run
    writes to `main`. A second harvest while the first one's PR is open shares no record number and no
    register id.
  - **Failures.** Without `OPENROUTER_API_KEY`, the PR still opens with the settle and the ship, every
    decision not placed, saying why. A GitHub failure after the retries leaves one comment on the merged
    feature PR.
  - The README's setup names the label, and says the key serves both the retro and the harvest.
- **s9** (acceptance criterion 11):
  - `omni harvest` ran for PRDs 3 (#4), 7 (#9), 28 (#29), 39 (#40), 45 (#46) and 50 (#51), and for every
    other PRD in `shipped/` when the slice runs.
  - `omni check all` is green.
  - Every settled entry in `shipped/` carries `Became:` or `Stays here:`, or is listed as not placed in
    the sub-PR. The PRD 28 decisions ADR-0001 records come back as covered by it.
  - The sub-PR's body lists every decision, where it landed and why.
  - The decisions form's Format section names `Decided:`, `Merged:` and `## Source`, and
    `omni check kb` is green.
  - Without `OPENROUTER_API_KEY` in the environment, the slice stops with a human-action item naming
    it.
