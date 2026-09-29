# omni-loop — the GitHub App behind the outbox check, the retro and the knowledge harvest

`apps/omni-app` is the webhook server of **omni-loop**, a public GitHub App owned by the vertuoza org
(PRD 28; public since PRD 359, so anyone can install it and a workspace is born from the installation).
It does three jobs: the **outbox check** on every pull request, and, after every feature pull
request merges, a **retro** (PRD 72) and a **knowledge harvest** (PRD 82), below. Once the app is
installed on a repository that has the loop (a `.omni-loop/config.yml` on the base branch), every pull
request carries one check run named **outbox** (shown as **omni-loop · outbox**):

| Situation | Conclusion |
|---|---|
| No `.omni-loop/config.yml` on the base branch | no check run and no comment: the app stays silent |
| Not a feature PR (sub-PR, other branch, no PRD folder) | `skipped` — omni-loop is not active on this PR |
| Outbox clear | `success` |
| Open items, unreworked drift or unaccounted risky changes | `failure` |
| Red, but labelled with the override label (`labels.outboxGo`) | `neutral` |
| Broken base config, snapshot over its bound, or any failure after retries | `failure` |

Nothing is added to an installed repository: no workflow, no file under `.github/`, no secret.

## The retro (PRD 72)

When a feature PR merges into the default branch, the app runs a retro of its PRD, by itself: code
counts what went wrong from GitHub and from the PRD's folder, and a model writes the prose around those
facts. It ends in a **retro PR** from `branches.retro` (default `docs/retro-<topic>`) into the default
branch, labelled `labels.retro` (default `omni:retro`), adding `retro.md` and `retro.json` to the PRD's
shipped folder (`shipped/<nnnn-topic>/`, always: a PRD merged unshipped is shipped by the knowledge
harvest on the same merge), and in one **retro issue** per finding, at most five per run. A person merges the retro PR; merging keeps the retro
as history and changes nothing else.

- A merged sub-PR, a merged phase-0 PR, a retro PR, a pull request closed without merging and a
  repository without `.omni-loop/config.yml` get no retro, and nothing is posted.
- Without `OPENROUTER_API_KEY`, or when the model fails, the retro still goes out, its summary reading
  "Facts only: <reason>".
- If GitHub fails after the retries, one comment on the merged PR says "The retro could not run:
  <reason>".
- **To re-run a retro,** replay its run from Inngest's dashboard. Publishing is idempotent: the branch
  and the PR are found again, and a commit is added (never a force-push) only when the retro changed.
  A missed webhook can also be redelivered from the app's settings.
- **What leaves GitHub:** the model receives the PRD's title and problem and, per finding, its facts and
  evidence excerpts — the last lines of failed jobs' logs, the hunks of rewritten code, the text of
  stuck and review comments — with token-shaped strings masked. They go to OpenRouter and the model's
  provider. A repository that refuses this leaves `OPENROUTER_API_KEY` unset and gets facts only.

## The knowledge harvest (PRD 82)

On the same merge, the app harvests the PRD's decisions into the knowledge base. Any outbox item still
open is settled as adopted by the person who merged (a merge over a red outbox adopts what is still
open), the PRD's folder is shipped if it never was, and every settled decision not yet written back is
classified by a model and written by code: a decision record, a rule (with the principle it proposes
when none fits), an invariant, covered by an existing entry, or staying in the ledger. It all ends in
one docs-only **knowledge PR** from `branches.knowledge` (default `docs/knowledge-<topic>`) into the
default branch, labelled `labels.knowledge` (default `omni:knowledge`). A person reviews and merges it.

- Every rule about the loop's files is the kit's harvest pipeline, the one `omni harvest` runs locally.
  The app reads the files at the default branch's tip, never at the merge commit: the merge only
  supplies who merged, when, and which PR.
- The same pull requests that get no retro get no harvest, nor does a merged knowledge PR.
- One harvest at a time per repository. Ids are numbered past the default branch and past every other
  open knowledge PR, so two open knowledge PRs never share a record number or a register id.
- Without `OPENROUTER_API_KEY`, or when the model fails, settling and shipping still happen: the
  knowledge PR opens with every decision listed as not placed, saying why.
- The checks (`omni check knowledge`, `omni check outbox`) run on the result; an entry that fails is
  dropped and listed as not placed, with the check's message.
- If GitHub fails after the retries, one comment on the merged PR says "The knowledge harvest could not
  run: <reason>".
- **To re-run a harvest,** replay its run from Inngest's dashboard. The branch and the PR are found
  again: a branch that already holds the harvest's commit is never committed to again, and only the
  PR's body is rewritten. Nothing to harvest opens nothing.
- **What leaves GitHub:** per decision, the outbox item as raised and its answer, and a summary of the
  knowledge base (ids, titles, statements), with token-shaped strings masked. No code, no logs.

## The Engineering board's collector (PRD 612)

Every 15 minutes the Inngest function **pr-stats** (`prStats`) reads the pull requests of every
**tracked** repository (galaxy's Settings → Repositories) of every workspace with an installation of
the app, through that installation, and writes them to Supabase for galaxy's Dashboard → Engineering:
one `pull_requests` row per pull request (author, dates, who merged, base, commits, lines, and whether
Omni-man signed it), and its reviewers in `pull_request_reviews` (once each, dated at their first
review, never its author).

- A repository's first collection backfills 90 days; each one after reads only the pull requests
  updated after its cursor (`repositories.collected_until`). Rows are upserted, so running twice
  changes nothing.
- Each repository is its own Inngest step, at most 50 pull requests a step. A failure (no access, a
  rate limit, a GitHub error) is written to that repository's `collect_error`, with the cursor at what
  was written, and retried on the next run; the others are collected all the same.
- **Omni-man signed** a pull request when a commit carries a co-author trailer with his e-mail, its
  body carries `<!-- omni-loop:signed -->`, or `omni-loop-invader[bot]` opened it.
- It writes only those two tables and the collection columns of `repositories`, and reads GitHub only.

## How it runs

```
GitHub ── pull_request / check_run.rerequested ──▶ /api/github    verify signature → inngest.send → 200
             a merged pull_request.closed → omni-loop/retro.requested and
                                            omni-loop/knowledge.harvest.requested, never the outbox check
             every other handled action   → omni-loop/outbox.check.requested
Inngest ──▶ /api/inngest   function "outbox-check" (debounced per repo + PR)
              step "in-progress"  create the check run, in_progress, on the head SHA
                                  (no base config: stop here, post nothing)
              step "evaluate"     snapshot base config + head delivery folder into /tmp, evaluate
              step "publish"      complete the check run; rewrite the outbox comment unless the head moved on
            onFailure          complete the check run as failure — never left in_progress
                               (no base config: post nothing)
Inngest ──▶ /api/inngest   function "retro" (one at a time per repository)
              step "qualify"          the config at the merge SHA; a feature PR; its PRD folder
              step "gather-pulls"     the sub-PRs into the feature branch
              steps "gather-<kind>"   each kind of finding's GitHub reads, one step per kind
              step "facts"            detect: the fact sheet, memoized
              step "narrate"          the model's prose, called from this Vercel function
              step "guard"            each field of prose accepted, or dropped with its reason
              step "publish-issues"   one retro issue per finding, worst first
              step "publish"          the branch, retro.md + retro.json, then the retro PR
            onFailure          one comment on the merged PR
Inngest ──▶ /api/inngest   function "knowledge-harvest" (one at a time per repository)
              step "qualify"          the merge (who, when, which commit); a feature PR, by the retro's rule
              step "settle"           the default branch's tip: settle at merge, plan the ship, list the candidates
              steps "classify:<id>"   one OpenRouter call per candidate
              step "write"            the same tip: write the knowledge, run both checks, drop what fails
              step "publish"          one commit on branches.knowledge, cut from that tip; the knowledge PR
            onFailure          one comment on the merged PR
Inngest ──▶ /api/inngest   function "pr-stats" (cron */15 * * * *, one run at a time)
              step "list-repositories"        the tracked repositories of installed workspaces
              steps "collect <ws>/<repo> <n>" at most 50 pull requests each: details, reviews, commits
```

| Unit | Where |
|---|---|
| `webhook` — verify and filter a delivery | `src/webhook/`, served at `api/github.mjs` |
| `snapshot` — only the listed paths, at most 2,000 files and 20 MB | `src/snapshot/` |
| `evaluate` — pure, reuses the kit's gate unchanged | `src/evaluate/` |
| `publish` — the check run and the comment | `src/publish/` |
| `outbox-check` — the Inngest function | `src/outbox-check/`, served at `api/inngest.mjs` |
| `retro` — the Inngest function wiring the retro's units | `src/retro/retro.mjs`, served at `api/inngest.mjs` |
| `qualify` — which merged PR gets a retro, and its PRD | `src/retro/qualify.mjs` |
| the kinds of finding — each one's GitHub reads, detector and section | `src/retro/kinds/` (registry: `index.mjs`) |
| `detect` — pure: plain records → the fact sheet | `src/retro/detect.mjs` |
| `narrate` and `guard` — the model's prose, and what of it is kept | `src/retro/narrate.mjs`, `src/retro/guard.mjs` |
| `render` — pure: `retro.md`, `retro.json`, the PR body | `src/retro/render.mjs` |
| the issue publisher, and `publish` — the branch, the files, the PR | `src/retro/issues.mjs`, `src/retro/publish.mjs` |
| `rules` — every threshold, the finding order, the words refused, a version | `src/retro/rules.mjs` |
| `git-write` — the shared writer: a branch, one commit (moves reuse blobs), a PR | `src/git-write/` |
| `knowledge-harvest` — the Inngest function wiring the kit's harvest pipeline | `src/knowledge-harvest/knowledge-harvest.mjs`, served at `api/inngest.mjs` |
| the harvest's GitHub reads — the merge, the tip, the ids other knowledge PRs take | `src/knowledge-harvest/github.mjs` |
| `render` — pure: the knowledge PR's title and body, the commit | `src/knowledge-harvest/render.mjs` |
| `pr-stats` — the Engineering board's collector, its GitHub reads and its store | `src/pr-stats/`, served at `api/inngest.mjs` |

The app only reads YAML, Markdown, JSON, patches and logs, as text; it never runs repository code. The
retro writes only its own `branches.retro` branches, their pull requests, its retro issues and one
comment on failure; the harvest only its own `branches.knowledge` branches, their pull requests and one
comment on failure. Neither ever force-pushes, writes to the default branch or merges.

Tests run from the repository root with `pnpm test`, against a stubbed GitHub. The retro's tests also
replay PRD 50 as GitHub returned it (`test/fixtures/prd-50/`), offline.

## Setup — human steps

None of these is taken by the code; a person does each once.

1. **Register and install the app.** An org admin registers the app from [`app.yml`](app.yml) and
   installs it on `vertuoza/vertuo-omni-loop`. Check that the manifest's hosts match the production
   domains before registering: `url` and the webhook this app's Vercel project (step 2), `setup_url`
   galaxy's. Both can also be corrected later in the app's settings. Keep the app's private key; it
   is shown once. In the app's
   settings, upload [`assets/logo.png`](assets/logo.png) as the logo (OmniMan landing on a planet,
   drawn from `@omni/sprites`) and set the badge background colour to `#07061c`.
2. **Create the Vercel project** for `apps/omni-app` (root directory `apps/omni-app`, its own project,
   separate from the galaxy) and set these environment variables:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` — the PEM; a value pasted with literal `\n` sequences is accepted
   - `GITHUB_WEBHOOK_SECRET` — the same secret as in the app's settings
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — the same project and service key as galaxy's,
     for the pr-stats collector (PRD 612). With either unset it logs one line and writes nothing.

   The private key lives only there. To rotate it, generate a new key in the app's settings, replace
   the Vercel variable, redeploy, then delete the old key.
3. **Inngest.** Create (or reuse) the Inngest account and sync the app at
   `https://<production domain>/api/inngest`. A deploy does not resync it: after a deploy that adds a
   function (pr-stats, PRD 612, is one), press **Resync** on the app in Inngest, or the new function
   never runs.
4. **Branch protection (optional).** Require the **outbox** check from the `omni-loop` app on the
   default branch.

   > **Warning.** A required check that is never posted blocks every pull request in that repository:
   > if the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The
   > remedy is to remove the requirement in branch protection — never to fake a status. Inngest's run
   > history shows whether a run was attempted.
5. **Labels.** Run `npx github:vertuoza/vertuo-omni-loop init` in the repository: it creates the missing `omni:*` labels.

### Making the app public — human steps (PRD 359)

None of these is taken by the code. Until they are done, only the vertuoza org can install the app,
and GitHub sends no installer to galaxy's sign-up.

1. **Make the app public.** In the app's settings (Advanced → Danger zone), make it public. Anyone can
   then install it on the repositories they pick; the installation carries the outbox check, the retro
   and the harvest, with `contents: write` on those repositories only. Its permissions and events do
   not change.
2. **Set the setup URL** to galaxy's `https://<galaxy's production domain>/signup/installed`
   (Post installation → Setup URL, the manifest's `setup_url`).
   GitHub sends the installer there with `installation_id` and `setup_action` (`install`, or `request`
   when they are not the org's admin); galaxy checks the installation and creates the workspace.
3. **Give galaxy the app's identity:** the same app id and private key, and the app's slug, in
   galaxy's Vercel project (galaxy's README lists the variable names).
4. **To roll back,** make the app private again from the same settings page. GitHub may first ask
   for the installations on other accounts to be removed.

A repository that installs the app without the loop gets nothing from it: no check run, no comment,
no retro, no harvest.

### The retro — human steps (PRD 72)

None of these is taken by the code. Until steps 1 and 2 are done, a merged feature PR cannot be seen
opening a retro PR live (PRD 72, acceptance criterion 1).

1. **Accept the new permissions.** The retro widened the app's permissions once: `contents: write`
   (was `read`), `issues: write` and `actions: read`. An org admin updates the app from
   [`app.yml`](app.yml) (or in the app's settings), then accepts the new permissions on each
   installation. Until then the retro fails on its first write, and its failure comment says so.
2. **Set the model's key** in the app's Vercel project: `OPENROUTER_API_KEY`, and optionally
   `OPENROUTER_MODEL` to use another model than Claude Opus 5.5. Without the key, every retro goes out
   facts only.
3. **Check the Inngest plan allows a 14-day sleep,** for the second run fourteen days after the merge.
   If it does not, the day-14 run is started by a daily scheduled Inngest function instead.
4. **Create the `omni:retro` label:** run `npx github:vertuoza/vertuo-omni-loop init` in each
   repository.

### The knowledge harvest — human steps (PRD 82)

None of these is taken by the code. The harvest needs nothing beyond the retro's permissions and
environment.

1. **The retro's steps 1 and 2 cover the app.** `contents: write` lets the harvest write its own
   branch, and the one `OPENROUTER_API_KEY` (with `OPENROUTER_MODEL`, when set) serves both the retro
   and the harvest. Without the key, every knowledge PR still settles and ships, and lists every
   decision as not placed.
2. **Create the `omni:knowledge` label** (`labels.autoCreate` is false): run
   `npx github:vertuoza/vertuo-omni-loop init` in each repository, so the label carries its colour
   and description.
3. **Review and merge each knowledge PR.** Entries from adopted decisions carry
   `Proposed: harvest <date>` and bind nothing until a person deletes that line.

## Checking it live

With the app installed on this repository, PRD 28's acceptance criteria 1–6 are re-run by hand on a
feature PR: red with an open item, green once settled, neutral under `omni:outbox-go`, skipped on a sub-PR,
nothing at all on a repository without `.omni-loop/config.yml` (PRD 359), re-evaluated by **Re-run**.
