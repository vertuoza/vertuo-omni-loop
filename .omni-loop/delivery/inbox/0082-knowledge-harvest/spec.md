---
prd: 82
title: Knowledge harvest — every merged PRD's decisions land in the knowledge base
blocked-by: [68, 72]
spec: file
---

# Knowledge harvest — every merged PRD's decisions land in the knowledge base

**Date:** 2026-09-25 · **PRD:** #82 · **Follows:** #3 (the kit: §6 write-back, §7 the outbox), #28 (the
omni-loop app), #45 (knowledge forms: the decisions form and its reader) · **Builds on:** #72 (the retro:
the merge route, the model call, the app's writes), #68 (invade: the `Proposed:` line) · **Changes:** PRD
72's rule for which folder a retro is written into

## Problem

The loop runs PRD, plan, slices, merge, and then, with PRD 72, a retro. What a PRD decided along the way
never reaches the knowledge base. It stays in the PRD's ledger, `shipped/<nnnn-topic>/outbox/settled.md`,
where nobody looks for it.

The six PRDs shipped so far (3, 7, 28, 39, 45, 50) hold 83 settled decisions: 78 adopted, 5 agreed. Not
one carries a `Became:` line; one carries a `Stays here:` line. The knowledge base holds one decision
record, ADR-0001, written by hand as a slice of PRD 28, and the product registers say "None yet".
Decisions that read like records sit only in a ledger. For example, PRD 28's
`s1-01-evaluate-reads-two-snapshots` says: a settings file inside the pull request is never looked at,
so a pull request cannot quietly rename the override label.

Four gaps explain it:

1. **Adopted decisions are left out on purpose.** `/omni:yolo-fix` writes back only the answers it
   settled in its own run, "never one adopted before this run: nobody answered it". Adopted decisions
   are over 90% of every ledger.
2. **The green path never writes back.** When every item is medium, `/omni:yolo` goes straight to
   `omni ship`, and `/omni:yolo-fix` never runs.
3. **Nothing checks it.** `omni ship` refuses open items and unreworked drift, not a settled entry that
   carries neither `Became:` nor `Stays here:`. PRD 3 left "which answers become entries" as a judgement.
4. **A merge over a red outbox is lost.** On a red gate `/omni:yolo` never runs `omni ship`. A feature
   PR merged anyway, under the override label or without branch protection, leaves its folder in
   `inbox/` and its open items in `outbox/` on the default branch, and nothing ever settles or ships
   them. The merge was a person's decision, and nothing records it.

PRD 72's retro runs on the same merge and leaves this out on purpose: its scope excludes "changing the
playbook or any knowledge file from a retro".

## Solution

When a feature PR merges into the default branch, the omni-loop app **harvests** its PRD. Any outbox
item still open is settled as adopted by the person who merged it. The PRD's folder is shipped if it
never was. Then every settled decision not yet written back is classified by a model through
OpenRouter, and code writes it into the knowledge base, in the right place, with who answered, who
merged and when. It all ends in one docs-only **knowledge PR**, which a person reviews and merges.

### The rule

- **A medium item is for information only.** It is adopted when it is raised, as today.
- **A merge over a red outbox adopts what is still open.** The person who merged is the approver, and
  the merge time is the approval time. For drift that was never reworked, the merge adopts what was
  built; the answer that asked for something else stays in the ledger above it.

### Flow

```
GitHub ── pull_request.closed (merged) ──▶ /api/github   verify → route → inngest.send
                                          omni-loop/retro.requested              (PRD 72, unchanged)
                                          omni-loop/knowledge.harvest.requested  { installationId, owner, repo, repository, prNumber }
Inngest ──▶ /api/inngest   function "knowledge-harvest" — its own function, one run at a time per repository
   step "qualify"         merged into repo.defaultBranch, a feature PR by the app's existing rule;
                          merged_by, merged_at and the merge SHA read from the PR itself
   step "settle"          snapshot the default branch's tip (config, delivery, knowledge, ADRs):
                          settle at merge, plan the ship, list the candidates
   step "classify:<id>"   one OpenRouter call per candidate
   step "write"           snapshot the tip again, apply "settle", write the knowledge,
                          run omni check knowledge and omni check outbox, drop what fails
   step "publish"         one commit on branches.knowledge, cut from the tip; one knowledge PR
   onFailure              one comment on the merged feature PR: "The knowledge harvest could not run: <reason>"
```

The files are read from the default branch as it is at run time, not at the merge commit. The merge
commit only supplies the provenance. That way a harvest of an old PR numbers new entries past
everything written since, and the knowledge PR never starts out conflicting.

### The units

Every rule about the loop's files lives in the kit, as pure code the app imports (as it already imports
the gate). The app only talks to GitHub and OpenRouter.

| Unit | Where | In → out |
|---|---|---|
| Settle at merge | `kit/lib/outbox/settle-merge.mjs` | the PRD, the merge `{ by, at, pr, url }` → ledger entries to append, item files to delete |
| Ship | `planShip` (`kit/lib/delivery/ship.mjs`), unchanged | folder moves as `{ from, to }` pairs, and path rewrites |
| Candidates | `kit/lib/knowledge/harvest.mjs` | the PRD → the latest settled entry per id carrying neither `Became:` nor `Stays here:` |
| Classifier contract | `kit/lib/knowledge/classify.mjs` | a candidate and a summary of the knowledge base → the prompt; the zod schema of the reply |
| OpenRouter client | `kit/lib/openrouter.mjs` | a prompt → a reply the schema accepts; `fetch` injected. Moved here from PRD 72's `narrate`, which then uses it |
| Write knowledge | `kit/lib/knowledge/write.mjs` | classified candidates, the merge, the ids taken elsewhere → file edits and the ledger's `Became:` / `Stays here:` lines |
| Parser | `kit/lib/knowledge/registers.mjs` | learns one field line, `Merged:` |
| `omni harvest` | `kit/bin/commands/harvest.mjs` | the same units, run locally (below) |
| Webhook | `apps/omni-app/src/webhook/` | a merged `closed` → the retro event and the harvest event |
| Git writer | `apps/omni-app/src/git-write/` | file edits and moves → a branch, one commit, a PR. Moved here from PRD 72's `retro/publish`, which then uses it |
| `knowledge-harvest` | `apps/omni-app/src/knowledge-harvest/` | the Inngest function wiring the units, registered in `api/inngest.mjs` |

### Settle at merge

For each open item (any rank: human-action, high, or a medium item no wave adopted), one entry is
appended to the ledger and the item file is deleted:

- `Verdict: adopted`
- `Approved by: @<merger>` and `Approved at: <merged_at>`
- `Channel: feature pull request #<n>`, with its `Channel URL:`
- `Basis: merged-over-red — the feature pull request merged while this item was open; merging adopts what was built`
- `Closed: yes — adopted at the merge by @<merger>`
- the answer, as given: "Adopted when @<merger> merged feature pull request #<n> while this item was open."

A `drifted` entry whose `Closed:` line does not say reworked gets one more entry, appended the same way,
with `Closed: yes — merged without rework, by @<merger>`. The latest entry wins, so the gate reads it as
adopted.

When the PRD's folder is still in `inbox/`, `planShip` gives the moves. A move reuses the file's git
object, so a moved spec, plan or page carries no text through the run.

### Classify

**The prompt** carries, for one candidate:

- the item as raised: the question, the decision, the options, what the agent had to decide, what it
  did meanwhile, what it costs to change later;
- the answer word for word, and its verdict;
- a summary of the knowledge base: every domain under `domains/` with the first line of its README;
  every principle's id and statement; every decision record's number and title (`readDecisions`); and
  the id and statement of every rule and invariant in `product/` and the domains.

Only delivery text leaves GitHub: no code, no logs. Token-shaped strings are masked first, by PRD 72's
rule.

**The reply** is one JSON object that must pass the kit's schema:

| Field | Value | For |
|---|---|---|
| `kind` | `adr`, `invariant`, `rule`, `covered` or `stays-here` | every reply |
| `place` | `product`, or an existing domain's folder name | `rule`, `invariant` |
| `title` | the decision, as a record's title | `adr` |
| `statement` | one or two plain sentences, at most 300 characters | every kind but `covered` |
| `serves` | an existing principle's id, or `new` | `rule` |
| `principle` | `{ statement, why }`, each at most 300 characters | `rule`, when `serves` is `new` |
| `covers` | an existing entry's id or `ADR-NNNN` | `covered` |
| `reason` | why this kind and this place, at most 200 characters | every reply |

- **Only kinds the repository has a place for.** `adr` needs `paths.adr`; `rule` and `invariant` need
  the knowledge folder. Neither folder: every candidate is `stays-here` or `covered`, and no call is
  made for a repository with neither.
- **Only existing places.** `place` names a domain that exists, or `product`. The harvest never creates
  a domain.
- **A principle only arrives with a rule.** When no principle fits, the rule proposes one.
- **`covered`** means an entry or a record already says this. The ledger then points at it, and nothing
  is written twice.

**The model** is PRD 72's default through OpenRouter, and `OPENROUTER_MODEL` overrides it for both.
Temperature 0 and JSON-schema replies. A reply the schema refuses gets one repair request, as in PRD
72. If it is refused again, that candidate is **not placed**.

### Write the knowledge

**Ids.** The next decision record number is one past both `readDecisions`' next free number and every
number an open knowledge branch already takes. The next register id is one past the highest in that
file on the default branch and on every open knowledge branch.

**A decision record**, `adr/NNNN-<slug>.md`, follows the decisions form, with two more fields on its
status line and a `## Source` section:

```markdown
# ADR-0002 — The outbox check reads base settings and head delivery as two snapshots

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #28 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @<merger>, 2026-09-26, PR #29

## Context

<"What I had to decide", verbatim>

## Decision

<the statement>, then the option chosen, verbatim

## Consequences

<"What it costs to change later", verbatim>

## Source

`.omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md`, entry `s1-01-evaluate-reads-two-snapshots`
```

**A register entry** is appended to the layer file of its place. A layer file that holds only its "None
yet." line loses that line with its first entry. `Stated:` is the merge date; `Proposed:` carries the
date of the harvest.

```markdown
## BR-PRODUCT-1

An intro or a punchline is refused only past 120 characters or when it is not in plain words.

Serves: P-PRODUCT-1
Source: .omni-loop/delivery/shipped/0050-question-intros/outbox/settled.md, entry s1-01-fun-line-sentence-count, PRD #50
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @<merger>, 2026-09-26, PR #51
Proposed: harvest 2026-09-26
```

A new principle a rule serves is appended to the same place's `principles.md`, with `Why:`, `Source:`,
`Merged:` and `Proposed: harvest <date>`, and no `Decided:`: PRD 68 lets a proposed principle go
without one, and lets a rule serve it.

**Provenance, the same way everywhere:**

- **`Status:`** (records only): `accepted` when a person answered (agreed, or drifted and reworked);
  `adopted` when nobody did (a medium item, or a merge over red).
- **`Decided:`** is one of three forms:
  - `@<answerer> via <channel> #<n>, <date>`
  - `nobody — adopted when raised (medium), <date>`
  - `@<merger> — merged over a red outbox, <date>`
- **`Merged:`** always names who merged, when, and which PR.
- **`Source:`** names the ledger file and the entry's id. There is no anchor: two headings for one id
  would make it ambiguous.
- **`Enforced by:` is always `unenforced`.** The app never reads code, so it cannot prove a test
  enforces the rule. A reviewer may replace it with a test's path.
- **`Proposed: harvest <date>`** goes on every register entry from an adopted decision and on every
  new principle. Entries from an answered decision are written confirmed. A proposed entry resolves but
  never floors an item's rank and never stops a slice. A person confirms it by deleting the line
  (PRD 68). Merging the knowledge PR confirms nothing.

**The ledger.** Each placed candidate's entry gets `- Became: <id>[, <id>]` (a rule and its new
principle name both), or `- Stays here: <the reason>`. A `covered` candidate becomes `Became:` the id it
covers. A candidate that is not placed gets no line: `Stays here:` would be a claim.

**The checks.** `omni check knowledge` and `omni check outbox` run on the result. An entry that fails
is dropped, with its ledger line, and becomes not placed with the check's message; then the checks run
again. A knowledge PR never carries a knowledge base that fails its own checks.

### The knowledge PR

- **Branch** `branches.knowledge` with `{topic}` filled (default `docs/knowledge-{topic}`), cut from
  the default branch's tip. **Base** `repo.defaultBranch`.
- **Title** `docs(knowledge): PRD <n> — <PRD title>`. **Label** `labels.knowledge` (default
  `omni:knowledge`).
- **Body:**

  ```markdown
  Refs #28 · Knowledge from #29, merged by @<merger> on 2026-09-26

  **Proposed principles — a person's call:** P-PRODUCT-1 (serves BR-PRODUCT-1) · …

  | Decision | Landed as | Decided | Why there |
  |---|---|---|---|
  | s1-01-evaluate-reads-two-snapshots | ADR-0002 (new, adopted) | nobody — adopted | how the check is built |
  | s1-02-… | stays here | nobody — adopted | a local choice, nothing lasting |

  **Not placed:**
  - [ ] s2-03-… — the model's reply was refused twice

  Settled at merge: 2 open items, adopted by @<merger> (merged over a red outbox)
  Shipped at merge: inbox/0028-… → shipped/0028-…
  Checks: omni check knowledge ✓ · omni check outbox ✓

  Proposed entries resolve but bind nothing until a person deletes their `Proposed:` line.
  ```

- **At most one knowledge PR per PRD is open at a time.** A replay finds it by its branch and rewrites
  its body. It never commits twice and never rewrites history. Nothing to harvest opens nothing.
- The app writes through the shared git writer: it never clones, never writes to
  `repo.defaultBranch` (refused before any write), never force-pushes, never merges.

### Without a model

When `OPENROUTER_API_KEY` is not set or the call fails after its retries, settling at merge and shipping
still happen: they need no model. Every candidate is listed as not placed, and the knowledge PR still
opens, saying why. Fixing a merge over red never depends on the model.

### `omni harvest`

`omni harvest <prd> --pr <feature PR>` runs the same kit units locally:

- **Provenance:** it reads `merged_by`, `merged_at` and the merge SHA through `gh`.
- **The model:** it calls OpenRouter through the same client, with the key from the environment.
- **The files:** it writes into the working tree and never commits, like `omni ship`.
- **Ids:** they are taken past the working tree's highest.
- **Exit codes:**
  - `0`: it wrote the files.
  - `1`: refused, naming why (not merged, not into the default branch).
  - `2`: a usage error, or `OPENROUTER_API_KEY` is not set. Nothing is written.

### The backfill slice

One slice of this PRD builds this repository's knowledge base from every PRD already shipped. It runs
`omni harvest` for PRDs 3 (#4), 7 (#9), 28 (#29), 39 (#40), 45 (#46) and 50 (#51), and for every other
PRD in `shipped/` when the slice runs. It commits the result on its slice branch.

- ADR-0001 exists, so the PRD 28 decisions it records come back as `covered`.
- The decisions form's Format section (`adr/README.md`) is amended to name the `Decided:` and `Merged:`
  status fields and the `## Source` section.
- Its sub-PR lists every decision, where it landed and why, and every one not placed.

This PRD's own merge is then the app's first live harvest.

### What changes in PRD 72's code

- **The webhook:** a merged `closed` becomes two events, the retro's (unchanged) and the harvest's.
- **The retro's folder:** it writes `retro.md` and `retro.json` into `shipped/<nnnn-topic>/` always, not
  into `inbox/` for a PRD merged without being shipped, because the harvest ships that folder.
  Otherwise, with both PRs merged, a PRD would sit in two folders.
- **Shared units:** the OpenRouter client moves to `kit/lib/openrouter.mjs` and the branch-and-commit
  writer to `apps/omni-app/src/git-write/`. The retro keeps its behaviour and its tests.

The manifest and the environment gain nothing beyond PRD 72's: `contents: write`, `OPENROUTER_API_KEY`,
`OPENROUTER_MODEL`.

## Decisions

Decided 2026-09-25 by the PRD author, in the brainstorm.

1. **A medium item is for information only:** adopted when raised, unchanged.
2. **A merge over a red outbox adopts what is still open,** the merger approving at the merge time.
   Drift never reworked included: the merge adopts what was built, and the answer that asked otherwise
   stays in the ledger.
3. **After the merge, in the omni-loop app.** Not a per-repository workflow (ADR-0001 holds), and not a
   step someone must remember to run.
4. **A knowledge PR, merged by a person.** No bot writes to the default branch.
5. **The model classifies; code writes.** The model picks the kind, the place and the words. Code
   numbers the ids, writes the provenance and runs the checks.
6. **Kinds:** decision record, invariant, business rule, covered, stays here. A principle is written
   only as the one a new rule serves.
7. **Only existing places:** an existing domain, or `product/`. Never a new domain.
8. **A rule with no principle to serve proposes one** (brainstorm option A), listed first in the PR
   body.
9. **Proposed or confirmed, by who answered.** An entry from an adopted decision, and every new
   principle, carries PRD 68's `Proposed: harvest <date>`. An entry from an answered decision is
   confirmed. A record's `Status:` is `accepted` or `adopted` by the same rule.
10. **Provenance on every entry:** `Decided:` (who answered, how, when), `Merged:` (who, when, which
    PR), and a `Source:` naming the ledger entry. `Enforced by:` is always `unenforced`.
11. **Never edits an existing entry.** `covered` points `Became:` at it; an amendment is a person's.
12. **Nothing half-written, nothing failing.** The commit comes last, the checks run on the result, and
    an entry that fails is not placed.
13. **Settling and shipping never depend on the model.** Without one, every decision is not placed and
    the rest still publishes.
14. **Files from the default branch's tip,** the merge commit only for provenance. One run at a time per
    repository, and ids never collide with an open knowledge branch.
15. **Built on PRDs 72 and 68.** The merge route, the model call and the app's writes are PRD 72's,
    shared; `Proposed:` is PRD 68's.
16. **A retro is always written into `shipped/`.**
17. **A dedicated slice builds the knowledge base** from every PRD already shipped, through
    `omni harvest`, with the same units.
18. **`/omni:yolo-fix`'s write-back stays as it is.** The harvest skips every entry it already wrote
    back.

## User stories

- As the **person who merged a feature PR over a red outbox**, I see the open questions settled in my
  name at the merge time, and the PRD's folder shipped, in one PR I can read.
- As a **reader of the knowledge base**, every entry tells me who answered, who merged, when, and which
  ledger entry it came from.
- As an **agent running `/omni:do-work`**, I read the records and rules earlier PRDs decided instead of
  deciding them again.
- As the **reviewer of a knowledge PR**, I see each decision, where it landed and why, and delete a
  wrong one in a minute.
- As the **maintainer of this repository**, the knowledge base holds what the PRDs shipped so far
  decided.

## Scope

**In:**
- the kit:
  - the units in the table above: settle at merge, candidates, the classifier contract, the OpenRouter
    client, write knowledge
  - the `Merged:` field line
  - `branches.knowledge` and `labels.knowledge`, with the label's style so `omni init` creates it
  - `omni harvest`
  - the delivery README naming the harvest and the merge-over-red rule
  - the rebuilt `kit/dist/omni.mjs`
- the app:
  - the webhook's second event
  - the `knowledge-harvest` function and its registration
  - the shared git writer and the shared OpenRouter client, moved out of the retro
  - the retro's `shipped/` rule
  - the README
- the backfill slice, and the decisions form's Format section.

**Out:**
- editing an existing entry
- creating a domain
- a principle on its own
- a playbook section (`Became: playbook/…` stays `/omni:yolo-fix`'s, written by a person)
- the specs' `## Decisions` sections (only settled outbox decisions are harvested)
- confirming a proposed entry (a person deletes the line)
- proving an `Enforced by:` claim
- a label or comment that starts a harvest (a replay from Inngest does)
- harvesting a phase-0 PR, a sub-PR or a PR outside the loop

**Human steps** (never taken by the work):

1. PRD 72's steps cover the app: the new permissions accepted, and `OPENROUTER_API_KEY` set in its
   Vercel project.
2. Create the `omni:knowledge` label (`labels.autoCreate` is false), or run `omni init`.
3. Set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) in the environment that runs the backfill
   slice. Without it the slice stops with a human-action item.
4. Review and merge each knowledge PR.

## Test seams

All in the root vitest suite (`pnpm test`), offline: fixture repositories (`makeRepo()` from
`kit/test/fixture.mjs`), the stubbed GitHub the app already uses
(`apps/omni-app/src/outbox-check/fake-github.mjs`), and a stubbed `fetch` for OpenRouter. No test calls
GitHub or OpenRouter.

- **Settle at merge:**
  - Open high, human-action and medium items become `adopted` entries with the merger, the time and the
    PR, and their files are deleted.
  - Unreworked drift gets an `adopted` entry that wins, and `gateResult` is green afterwards.
- **Candidates:** entries that carry `Became:` or `Stays here:` are skipped, and only the latest entry for
  each id counts.
- **Classifier contract:**
  - The prompt carries the item's sections and the knowledge base summary, pinned by a snapshot.
  - The schema refuses an unknown kind, a domain that does not exist, a rule with no `serves`, a
    `serves: new` with no principle, an over-long field, and a kind the repository has no place for.
- **OpenRouter client:**
  - The request is built right, with tokens masked.
  - A reply refused twice becomes not placed.
  - A missing key is named.
- **Write knowledge:**
  - Numbering goes past both the default branch and the open knowledge branches.
  - The record, entry, principle and ledger text match this spec's examples exactly.
  - "None yet." is removed with a file's first entry.
  - `Proposed:` and `Status:` follow who answered.
  - The result passes `omni check knowledge` and `omni check outbox`, and an entry made to fail is not
    placed.
- **Parser:** `Merged:` is its own field, never glued onto `Source:`.
- **`omni harvest`:**
  - Through `main()` with a fake `gh` and a fake OpenRouter, it writes the same edits the app would and
    commits nothing.
  - Without a key it exits `2` and writes nothing.
- **Webhook:**
  - A merged `closed` becomes one retro event and one harvest event.
  - An unmerged `closed` becomes nothing.
  - Every other handled action still becomes the outbox event.
- **`knowledge-harvest`** (`@inngest/test`):
  - A feature PR merged over red gives a knowledge PR with the expected tree (moved files reuse their
    blobs) and body.
  - Writing to the default branch is refused.
  - A replay adds no commit and no PR, and nothing to harvest opens nothing.
  - No key gives settle and ship with every decision not placed.
  - A GitHub failure gives the one comment.
- **The retro:** its tests pass unchanged, except the folder rule, which now expects `shipped/`.
- **The outbox check:** its tests pass unchanged.

## Risks

- **A wrong classification.** A person reviews every knowledge PR. Entries from adopted decisions are
  proposed and bind nothing, and the reason for each placement is in the PR body.
- **A knowledge base nobody reads.** "Stays here" is the answer for a local choice, and `covered` stops
  duplicates. Proposed entries floor nothing, so a noisy harvest never blocks delivery.
- **Decision text leaves GitHub** for OpenRouter and the model's provider: only the item and its
  answer, no code and no logs, with tokens masked. A repository that refuses it leaves the key unset and
  gets settle and ship only.
- **Prompt injection through an item's text.** The schema, the caps, an `Enforced by:` that is never a
  path, and a person's review. The model has no tools.
- **Two knowledge PRs touching one register file.** Their ids never collide, but both append to the
  same file. The second one to merge may need its conflict resolved, or a replay after the first
  merges.
- **PRD 72 and PRD 68 are still being built.** This PRD is blocked by both. Moving the retro's client
  and writer happens after PRD 72 ships, with its tests kept green.
- **The bundle is shared ground.** Every slice that changes bundled kit code rebuilds
  `kit/dist/omni.mjs`, so no two such slices share a wave.
- **Model cost.** One call per decision; the backfill is about 83 calls.
- **What a merge publishes** (`omni kb show releasing`):
  - A merge of this PRD to `main` changes what the kit bundle and the plugin hand out, and what the app
    runs once it redeploys.
  - Rollback: revert the feature PR. A knowledge PR is docs-only and can be reverted alone.

## Acceptance criteria

1. A fixture feature PR merged with a high and a human-action item open, its PRD still in `inbox/`,
   gives one knowledge PR:
   - its ledger holds two `adopted` entries, approved by the merger at the merge time, basis
     `merged-over-red`
   - the item files are gone
   - the folder is in `shipped/`, with its outbox inside
2. A fixture merged with unreworked drift gets a new `adopted` entry that wins, and `gateResult` is
   green on the result.
3. Every candidate lands as exactly one of these:
   - a decision record
   - a register entry, with a proposed principle when none fits
   - covered
   - stays here
   - not placed

   Each ledger line matches its row in the PR body, and a candidate that is not placed has no line.
4. Every entry written carries `Decided:`, `Merged:`, a `Source:` naming the ledger entry, and
   `Enforced by: unenforced` (a rule or an invariant).
   - Entries from adopted decisions, and new principles, carry `Proposed: harvest <date>`; entries from
     answered decisions do not.
   - A record's `Status:` is `accepted` or `adopted` by the same rule.
5. `omni check knowledge` and `omni check outbox` are green on the knowledge PR's tree. An entry made to
   fail is not placed, with the check's message.
6. With `OPENROUTER_API_KEY` unset, the knowledge PR still opens with the settle and the ship, and every
   decision not placed.
7. None of these starts a harvest: a merged sub-PR, a merged phase-0 PR, a closed unmerged feature PR, a
   merged knowledge PR, a merged retro PR. A merged feature PR still gets its retro, written into
   `shipped/`.
8. A replay creates no second PR and no second commit. No run writes to `repo.defaultBranch`.
9. Two harvests of one repository, one after the other with the first PR still open, never take the same
   record number or register id.
10. `omni harvest <prd> --pr <n>` on a fixture writes the files the app would write and commits nothing.
    Without a key it exits `2` and writes nothing.
11. This repository's knowledge base holds what every shipped PRD decided:
    - `omni harvest` ran for each shipped PRD
    - `omni check all` is green
    - every settled entry in `shipped/` carries `Became:` or `Stays here:`, or is listed as not placed
      in the backfill slice's sub-PR
12. `pnpm test` is green, the outbox check's tests unchanged.
