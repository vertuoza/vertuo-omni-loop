# omni-loop — the GitHub App behind the outbox check and the retro

`apps/omni-app` is the webhook server of **omni-loop**, a private GitHub App owned by the vertuoza org
(PRD 28). It does two jobs: the **outbox check** on every pull request, and a **retro** after every
feature pull request merges (PRD 72, below). Once the app is installed on a repository, every pull
request carries one check run named **outbox** (shown as **omni-loop · outbox**):

| Situation | Conclusion |
|---|---|
| No `.omni-loop/config.yml` on the base branch | `skipped` — omni-loop is not active on this repo |
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
folder (`shipped/<nnnn-topic>/`, or `inbox/<nnnn-topic>/` for a PRD merged unshipped), and in one
**retro issue** per finding, at most five per run. A person merges the retro PR; merging keeps the retro
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

## How it runs

```
GitHub ── pull_request / check_run.rerequested ──▶ /api/github    verify signature → inngest.send → 200
             a merged pull_request.closed → omni-loop/retro.requested, never the outbox check
             every other handled action   → omni-loop/outbox.check.requested
Inngest ──▶ /api/inngest   function "outbox-check" (debounced per repo + PR)
              step "in-progress"  create the check run, in_progress, on the head SHA
              step "evaluate"     snapshot base config + head delivery folder into /tmp, evaluate
              step "publish"      complete the check run; rewrite the outbox comment unless the head moved on
            onFailure          complete the check run as failure — never left in_progress
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

The app only reads YAML, Markdown, JSON, patches and logs, as text; it never runs repository code. The
retro writes only its own `branches.retro` branches, their pull requests, its retro issues and one
comment on failure; it never force-pushes, never writes to the default branch and never merges.

Tests run from the repository root with `pnpm test`, against a stubbed GitHub. The retro's tests also
replay PRD 50 as GitHub returned it (`test/fixtures/prd-50/`), offline.

## Setup — human steps

None of these is taken by the code; a person does each once.

1. **Register and install the app.** An org admin registers the app from [`app.yml`](app.yml) (private
   to vertuoza) and installs it on `vertuoza/vertuo-omni-loop`. Check that the manifest's host matches
   the Vercel project's production domain (step 2) before registering; the webhook URL can also be
   corrected later in the app's settings. Keep the app's private key; it is shown once. In the app's
   settings, upload [`assets/logo.png`](assets/logo.png) as the logo (OmniMan landing on a planet,
   drawn from `@omni/sprites`) and set the badge background colour to `#07061c`.
2. **Create the Vercel project** for `apps/omni-app` (root directory `apps/omni-app`, its own project,
   separate from the galaxy) and set these environment variables:
   - `GITHUB_APP_ID`
   - `GITHUB_APP_PRIVATE_KEY` — the PEM; a value pasted with literal `\n` sequences is accepted
   - `GITHUB_WEBHOOK_SECRET` — the same secret as in the app's settings
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

   The private key lives only there. To rotate it, generate a new key in the app's settings, replace
   the Vercel variable, redeploy, then delete the old key.
3. **Inngest.** Create (or reuse) the Inngest account and sync the app at
   `https://<production domain>/api/inngest`.
4. **Branch protection (optional).** Require the **outbox** check from the `omni-loop` app on the
   default branch.

   > **Warning.** A required check that is never posted blocks every pull request in that repository:
   > if the app is uninstalled, its deploy is broken or Inngest is down, nothing can merge. The
   > remedy is to remove the requirement in branch protection — never to fake a status. Inngest's run
   > history shows whether a run was attempted.
5. **Labels.** Run `npx github:vertuoza/vertuo-omni-loop init` in the repository: it creates the missing `omni:*` labels.

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

## Checking it live

With the app installed on this repository, PRD 28's acceptance criteria 1–6 are re-run by hand on a
feature PR: red with an open item, green once settled, neutral under `omni:outbox-go`, skipped on a sub-PR,
skipped on a repository without `.omni-loop/config.yml`, re-evaluated by **Re-run**.
