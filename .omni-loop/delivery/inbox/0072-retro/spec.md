---
prd: 72
title: The retro — a retro PR and retro issues after every feature PR merges
blocked-by: none
spec: file
---

# The retro — a retro PR and retro issues after every feature PR merges

**Date:** 2026-09-25 · **PRD:** #72 · **Follows:** #28 (the omni-loop app and its outbox check), #3 (the
kit) · **Restates:** PRD 28 decisions 5 and 9 (the app reads and never executes; permissions widen once
for automated pull requests) · **Leads to:** a later PRD for `/omni:retro-apply`, which reads the issues
this one opens

## Problem

When a feature PR merges, nobody looks back at how its PRD was delivered. What went wrong is still on
GitHub, spread over a dozen places: a check that was red on four commits in two slices, a re-run that
turned green with no code change, an end-to-end test that failed in every slice, forty lines of one file
rewritten in five commits, a slice that went stuck after three attempts, a decision that drifted and was
reworked, a review finding left unresolved at merge, a bug reported against the PRD a week later. Each
one is visible to whoever happens to open the right page, and none of them is ever added up.

So the same failures come back PRD after PRD. The lesson a person could draw — a flaky test to fix, a
territory drawn too narrow, a check that fails for a reason nobody wrote down — is never drawn, and
nothing records it for the next delivery.

The omni-loop app (`apps/omni-app`, PRD 28) is the one piece that is already installed on every
repository the loop runs in. Today it does one job, the outbox check, and it never sees a merge: the
webhook drops `pull_request.closed` (`src/webhook/webhook.mjs`). There is no model call anywhere in the
repository, and no retro.

## Solution

When a feature PR merges into the default branch, the app runs a **retro** of its PRD, by itself, on
Vercel: once at the merge and once again 14 days later. Code counts what went wrong from GitHub and from
the PRD's folder; a model writes the prose around those facts and proposes lessons. Each run ends in two
places:

- a **retro PR** adding `retro.md` (findings, evidence, lessons) and `retro.json` (every number it
  shows) to the PRD's folder. A person merges it; merging keeps the retro as history and changes
  nothing else;
- one **retro issue** per finding, labelled `labels.retro` (default `omni:retro`), explaining it with its
  evidence and a proposed lesson. A retro issue is never a PRD; a later PRD's `/omni:retro-apply #<n>`
  turns one into a change.

### Flow

```
GitHub ── pull_request.closed (merged) ──▶ /api/github   verify → route → inngest.send
                                          omni-loop/retro.requested
                                          { installationId, owner, repo, repository, prNumber, mergeSha, mergedAt }
Inngest ──▶ /api/inngest   function "retro" — its own function, never shares a run with "outbox-check"
   step "qualify"       base config at the merge SHA; a feature PR by the app's existing rule; the PRD folder
   steps "gather-*"     GitHub API → plain records, one step per kind so each fits the function's time limit
   step "facts"         the detectors → the fact sheet (JSON); memoized, so a retry never changes a number
   step "narrate"       one call to OpenRouter, made from the Vercel function, streamed
   step "guard"         each field of prose accepted, or dropped with a reason
   step "publish"       issues first, then the branch, retro.md + retro.json, then the PR
   step.sleepUntil      mergedAt + 14 days
   the same steps       + the bug issues and main's checks since the merge → an "After merge" section,
                          new issues for new findings, and a PR (the first one, when it is still open)
```

A `closed` event only ever becomes a retro event; every other event the webhook handles still becomes
the outbox check event, exactly as today. The retro function has its own retries, its own concurrency
key (repository + PRD) and its own failure handler, and never reads or writes a check run.

### Units (`apps/omni-app/src/retro/`)

| Unit | In → out | Touches GitHub |
|---|---|---|
| `gather` | installation, PR → plain records: sub-PRs, their commits with patches, check runs, failed-job log tails, timelines, comments, review threads, the PRD folder, `.gitattributes`; at day 14 the bug issues and main's checks | yes (read) |
| `detect` | plain records → the fact sheet: facts, findings, evidence | **no — pure** |
| `narrate` | fact sheet + evidence excerpts → the request, and the model's JSON | OpenRouter only |
| `guard` | model JSON + fact sheet → accepted fields, or dropped fields with reasons | **no — pure** |
| `render` | fact sheet + accepted prose → `retro.md`, `retro.json`, issue bodies, PR body | **no — pure** |
| `publish` | rendered files → issues, branch, commit, PR | yes (write) |
| `rules` | every threshold, the finding order, the words refused, a version number | no |
| `retro` | the Inngest function wiring the units | through them |

`detect` takes plain data only, never an Octokit, so a later PRD can feed it from a clone of the
repository in a sandbox instead of from the API. `detect` reuses the kit unchanged: `parsePlanSlices` and
`breaches` for territories, `parseSettledEntries` for decisions, `parseFolderName` for the folder.

### The facts, and what makes a finding

Every number is counted by `detect`. A **finding** is a detector crossing a threshold of `rules`; its id
is built from what it found (`repeated-red:e2e`, `churn:src/cart.ts:120-160`), so the same facts always
give the same ids.

| Detector | Counts | A finding when |
|---|---|---|
| Timeline | feature PR opened, ready, merged; per slice, sub-PR opened (the claim) and merged; waves as planned and as merged | a slice took more than 3× the median slice time |
| Repeated red | per check name, across every sub-PR commit: runs, failures, and a red then green on the same SHA | a check red on 2 or more commits or in 2 or more slices; any red then green on the same SHA (flaky) |
| Failing tests | test names parsed from failed-job log tails for Vitest, Jest, Playwright and pytest; any other format keeps its excerpt as evidence and gets no count | the same test failing in 2 or more runs |
| Churn | per file, lines added across all commits minus lines added in the final diff; per line range, the commits that rewrote it, line numbers followed through each commit's hunks | a range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines |
| Territory | files a sub-PR changed outside its slice's territory (`breaches`) | any breach the plan does not list as shared ground |
| Agent friction | `labels.needsFix` added (from the timeline), "Stuck after N attempts" comments, a second claim of the same slice | any stuck or needs-fix slice |
| Decisions | from the settled file: raised, adopted, agreed and drifted, by rank; a drift closed as reworked; a merge under `labels.outboxGo` | any drift; any merge under the override label |
| Review | review threads by author kind (person or bot); red-circle bot findings; threads unresolved at merge | a red-circle finding or a thread unresolved at merge |
| After merge (day 14) | `bug` issues whose title or body names `#<prd>`, created within 14 days of the merge, fixed or not; the files their fixing PRs touched against the churn ranges; the checks on the merge commit | any such bug; a fix touching a churn range is marked as linked |

Churn leaves out generated files: paths marked `linguist-generated` in `.gitattributes` at the merge SHA,
and lockfiles by name. This PRD adds `.gitattributes` to this repository with `kit/dist/**
linguist-generated`, since the bundle is rebuilt in every slice. When GitHub returns no patch for a file,
the file counts additions and deletions only, and `retro.md` says so.

### The retro PR

- **Files:** `retro.md` and `retro.json` in the PRD's folder at the merge SHA — `shipped/<nnnn-topic>/`,
  or `inbox/<nnnn-topic>/` for a PRD merged without being shipped.
- **Branch:** `branches.retro` with `{topic}` filled (default `docs/retro-{topic}`); base
  `repo.defaultBranch`. The day-14 run commits to the same branch while its PR is open, and opens
  `<branch>-day-14` once it is merged.
- **Title** `docs(retro): PRD <n> — <PRD title>`; **label** `labels.retro`; **body** `Refs #<prd>`, the
  findings with their issue links, and one line: merging keeps this retro as history and changes nothing
  else.
- The app writes through GitHub's Git Data API: it never clones, never force-pushes, never writes to the
  default branch and never merges. **At most one retro PR per PRD is open at a time.**

`retro.md`:

```markdown
---
prd: 50
feature-pr: 51
merge-sha: 4e2dc90
runs: [merge]            # [merge, day-14] once the follow-up ran
model: <OpenRouter model id, or none>
rules: 1
---
# Retro — PRD 50, <title>

<summary: three to five sentences by the model, no numbers — or "Facts only: <reason>">

## Findings
### F1 · <title by the model> — `repeated-red:e2e` · #123
- **What happened:** <written by render from the facts>
- **Why it matters:** <the model>
- **Evidence:** <links: check runs, commits, log excerpt>

## Proposed lessons
## Timeline
## Decisions
## Rules            <the thresholds this run used>
## After merge      <added by the day-14 run>
```

A PRD with a second feature PR (a rework after merge) gets one more section per feature PR, headed with
its number. `retro.json` holds the fact sheet of every run, so any number in `retro.md` can be checked.

### The retro issues

One issue per finding, worst first, **at most five per run**; the other findings stay in `retro.md`
without an issue. The order, most severe first: a day-14 bug; a merge under the override label; a
drifted decision; a repeated red check or flaky run; a failing test; a red-circle or unresolved review
finding; a stuck or needs-fix slice; a territory breach; churn; a slow slice.

````markdown
<!-- omni-outbox-retro: prd=50 finding=repeated-red:e2e -->
**Retro of PRD 50** (#50 · feature PR #51 · retro PR #…) · F1

## What happened
## Why it matters
## Proposed lesson
## Evidence

```yaml
prd: 50
finding: repeated-red:e2e
kind: repeated-red
retro: .omni-loop/delivery/shipped/0050-question-intros/retro.md
evidence: [<urls>]
```
````

The title is `retro(PRD <n>): <title>`; the label is `labels.retro`, never `labels.prd`. The marker's
prefix is `markers.prefix`. Before it creates an issue the app looks for one carrying the same PRD and
finding id: an open one is rewritten in place; a closed one stays closed and `retro.md` still links it.

### The model, and the guard

The model is **Claude Opus 5.5 through OpenRouter**, `OPENROUTER_MODEL` overriding it. It receives the
PRD's title and problem, then per finding its id, its facts and its evidence excerpts (failed-job log
tails of about 200 lines, the hunks of churn ranges, the text of stuck and review comments), at most
about 40,000 tokens: past that, older attempts' logs go first, then hunks, and the latest failure of each
check always stays. Before anything is sent, token-shaped strings (`ghp_`, `ghs_`, `sk-`, `AKIA`,
`Bearer …`, JWTs) are masked. It returns JSON: a `summary`; per finding id a `title`, `whyItMatters` and
an optional `lesson`; a `lessons` list, each citing finding ids. JSON that fails its schema gets one
repair request, then the retro goes out facts only.

`guard` checks each field on its own and drops a field that:

- holds a digit, once backtick spans copied verbatim from the evidence are set aside;
- names a finding id `detect` did not produce, or is a lesson citing none;
- carries a link that is not one of the evidence URLs;
- is longer than its cap in `rules`, or holds a word `rules` refuses: the same list of words the kit's
  question pool may not hold (`kit/lib/outbox/banter.test.mjs`), copied into `rules`, since a retro is a
  delivery file too.

A dropped field is replaced by one line naming the reason. The model has no tools and takes no action:
it cannot add a finding, a number, an issue or a link.

### Failures

| When | Then |
|---|---|
| no config on the base branch, or not a feature PR | the run ends and posts nothing |
| `OPENROUTER_API_KEY` is not set | a retro with facts only: "Facts only: no model key" |
| the model call fails after the step's retries | a retro with facts only: "Facts only: model unavailable (<status>)" |
| GitHub fails after the step's retries | one comment on the merged feature PR: "The retro could not run: <reason>" |

A run replayed from Inngest's dashboard is the way to re-run a retro. Publishing is idempotent: issues are
found again by their marker and the PR by its branch, so a replay or a retry after a half-done publish
completes it instead of duplicating it, adding a commit and never rewriting history.

### The app's manifest, the kit, the environment

- `app.yml`: `contents: write` (was `read`), `issues: write` and `actions: read` added; `checks: write`,
  `pull_requests: write`, `metadata: read` kept; events unchanged. The webhook adds `closed` to the
  `pull_request` actions.
- The kit: `labels.retro` (default `omni:retro`) with its colour and description in `LABEL_STYLES`, so
  `omni init` creates it; `branches.retro` (default `docs/retro-{topic}`); the delivery README names
  `retro.md` and `retro.json`.
- Vercel: `OPENROUTER_API_KEY`, and optionally `OPENROUTER_MODEL`; `maxDuration` for `api/inngest.mjs`
  raised above 60 seconds so the model call fits.

## Decisions

Decided 2026-09-25 by the PRD author, in the brainstorm.

1. **Automatic, twice.** A retro runs by itself when a feature PR merges and again 14 days later. No
   person starts it.
2. **On Vercel only.** Every step runs in the app's Vercel functions; Inngest queues, retries and wakes
   the function, as it does for the outbox check. No workflow, nothing under `.github/`, nothing runs in
   an installed repository. The model call is made from the Vercel function, not from Inngest, so the
   OpenRouter key never leaves Vercel.
3. **A retro PR, merged by a person.** It adds `retro.md` and `retro.json` to the PRD's folder; merging
   keeps the retro as history and changes nothing else. No bot writes to the default branch.
4. **A retro issue per finding,** labelled `labels.retro` and never `labels.prd`. Its body ends with a
   YAML block that is the contract for `/omni:retro-apply`, a later PRD.
5. **Code counts, the model writes.** Every number comes from `detect` and is kept in `retro.json`; the
   model writes titles, prose and proposed lessons, and `guard` refuses any number, id or link it did not
   get.
6. **CI read in depth:** check runs on every sub-PR commit plus the last lines of each failed job's log,
   which is what names a failing test in any repository. Log excerpts leave GitHub for OpenRouter and the
   model's provider.
7. **Claude Opus 5.5 through OpenRouter,** overridable by `OPENROUTER_MODEL`.
8. **Facts only, rather than nothing.** A missing key, a failed call or refused prose still publishes the
   retro, saying why the prose is missing.
9. **Detectors over plain data.** `detect` never touches GitHub, so a later PRD can feed it from a
   sandbox clone to reproduce a suspect test. In this PRD no repository code runs anywhere.
10. **The app still never executes repository code** (PRD 28, decision 5, restated): it parses YAML,
    Markdown, JSON, patches and logs, and writes only its own `branches.retro` branches, its PRs, its
    issues and one comment on failure.
11. **Permissions widen once** (PRD 28, decision 9): `contents: write`, `issues: write`, `actions: read`,
    accepted by an org admin.
12. **Which PRs:** merged into `repo.defaultBranch` and a feature PR by the app's existing rule (head
    matches `branches.feature`, a PRD folder for the topic). The label is not required. Phase-0 PRs never
    get a retro; a second feature PR of the same PRD gets its own section.
13. **Re-run by replay.** No label or comment starts a retro; a replay from Inngest is idempotent.
14. **The outbox check is untouched:** a `closed` event never becomes an outbox event, and the retro never
    reads or writes a check run.
15. **At most five issues per run,** worst first by the order above.
16. **Thresholds live in `rules`,** with a version number that `retro.md` records.

## User stories

- As the **author of a PRD**, a few minutes after my feature PR merges I get a retro PR that says, with
  links, what broke while it was built and what I could do differently.
- As a **team lead**, I see an `omni:retro` issue for the test that failed in three slices, with its logs
  linked, and can decide whether to act on it.
- As a **person fixing the loop itself**, I read `retro.json` across PRDs and trust every number in it.
- As a **reviewer of a retro PR**, I can check each number against its link, and nothing in it is a
  guess.
- As the **author of a later PRD**, `/omni:retro-apply #<issue>` reads the issue's YAML block and has
  everything it needs.
- As a **maintainer of this repository**, this repository's own feature PRs get retros, starting with
  the next one after this PRD ships.

## Scope

**In:** the retro units, the Inngest function and its registration in `api/inngest.mjs`; the webhook's
`closed` route; `app.yml` and its test; `vercel.json`'s `maxDuration`; the README's setup steps; the kit's
`labels.retro`, `branches.retro` and label style; the delivery README; `.gitattributes`; tests.

**Out:** `/omni:retro-apply` (a later PRD); running tests or any repository code in a sandbox (a later
PRD); changing the playbook or any knowledge file from a retro; a label or comment that starts a retro;
Slack; showing a retro anywhere outside GitHub; retros of phase-0 PRs, sub-PRs or pull requests outside
the loop.

**Human steps** (in the README, never taken by the work):

1. An org admin accepts the app's new permissions (`contents: write`, `issues: write`, `actions: read`)
   on each installation.
2. Set `OPENROUTER_API_KEY` (and, to change the model, `OPENROUTER_MODEL`) in the app's Vercel project.
3. Check the Inngest plan allows a 14-day sleep. If it does not, the day-14 run is started by a daily
   scheduled Inngest function instead (the plan chooses before building).
4. Run `npx github:vertuoza/vertuo-omni-loop init` in each repository to create `omni:retro`.

## Test seams

All in the root vitest suite (`pnpm test`), offline, against the stubbed GitHub the app already uses and a
stubbed `fetch` for OpenRouter.

- **`webhook`** — a merged `closed` becomes one retro event and no outbox event; an unmerged `closed`
  becomes nothing; every other handled action still becomes the outbox event, unchanged.
- **`app.yml`** — exactly the new permissions; the `closed` action in `HANDLED`.
- **`detect`** — one fixture per detector: repeated red; red then green on the same SHA; test names from
  Vitest, Jest, Playwright and pytest logs, and an unknown format kept as an excerpt without a count;
  churn followed through hunks; generated files and lockfiles left out; a breach through the kit's
  `breaches`; decisions through the kit's parser; a day-14 bug whose fix touches a churn range.
- **PRD 50, recorded** — #51 and its sub-PRs as GitHub returned them, replayed offline: 3 slices, 2
  waves, 4 adopted decisions, no drift.
- **`guard`** — digits refused except verbatim backtick spans; unknown ids, foreign links, over-long
  fields and refused words dropped, each with its reason.
- **`render`** — `retro.md`, an issue body and the PR body against golden files, with prose and facts
  only.
- **`retro`** (`@inngest/test`) — issues, then files, then the PR, in that order; a replay creates
  nothing twice; no key or a model error gives facts only; a GitHub error gives the one comment; the
  day-14 run commits to an open retro PR and opens `…-day-14` after a merged one.
- **`outbox-check`** — its existing tests pass unchanged.
- **The kit** — `labels.retro` and `branches.retro` defaults; `omni init` creates `omni:retro`;
  `omni check all` is green with `retro.md` and `retro.json` in a shipped folder.

## Risks

- **CI logs leave GitHub.** Excerpts go to OpenRouter and the model's provider. Mitigations: only failed
  jobs, only their last lines, token-shaped strings masked; the README says so, and a repository that
  refuses it unsets the key and gets facts only.
- **Prompt injection through logs, comments and reviews.** The model has no tools; `guard` refuses
  anything that is not a field of prose; a person reviews the retro PR before it merges.
- **A model id that is new.** Opus 5.5 is recent; if OpenRouter does not serve it, `OPENROUTER_MODEL`
  names another, and until then retros go out facts only.
- **The function's time limit.** Vercel's longest `maxDuration` depends on the plan; a model call that
  outlasts it fails the step, and after its retries the retro goes out facts only.
- **A 14-day sleep** may exceed the Inngest plan; human step 3 and its fallback cover it.
- **Noise.** Too many issues and nobody reads them: the cap of five per run and the thresholds in
  `rules` are the levers, and `rules` has a version so a change is visible in every retro.
- **Retro PRs pile up** when nobody merges them: one open per PRD at most, and the day-14 run reuses it.
- **Thin retros here.** This repository runs no test workflow; its sub-PRs carry only the outbox check
  and Vercel's. Its retros will be mostly timeline, churn, decisions and review; a repository with CI gets
  the rest.
- **A missed webhook** means no retro. Redelivering the webhook from the app's settings, or replaying the
  run, recovers it.

## Acceptance criteria

1. On this repository, with the new permissions accepted and the key set, merging a feature PR opens,
   within ten minutes, a retro PR labelled `omni:retro` that adds `retro.md` and `retro.json` to the
   PRD's folder, with base `main` and head `docs/retro-<topic>`.
2. Every number in that `retro.md` appears in its `retro.json`, and every finding links its evidence.
3. Each finding the run ranks among its first five has one open issue labelled `omni:retro`, not
   `omni:prd`, ending with the YAML block; `retro.md` links each one.
4. Replaying the run from Inngest creates no second PR and no second issue.
5. With `OPENROUTER_API_KEY` unset, the retro PR still opens, its summary reading "Facts only: no model
   key", with the same findings and issues.
6. Fourteen days after the merge, the retro PR carries an "After merge" section listing the `bug` issues
   that name the PRD, or a new `…-day-14` PR does when the first one was merged.
7. A merged sub-PR, a merged phase-0 PR and a closed, unmerged feature PR get no retro.
8. The outbox check behaves exactly as before on every pull request, the retro PR included (`skipped`).
9. No file under `.github/` is added, and no workflow runs any part of the retro.
10. `pnpm test` is green, including the test seams above.
