# omni-loop — the GitHub App behind the outbox check

`apps/omni-app` is the webhook server of **omni-loop**, a private GitHub App owned by the vertuoza org
(PRD 28). Once the app is installed on a repository, every pull request carries one check run named
**outbox** (shown as **omni-loop · outbox**):

| Situation | Conclusion |
|---|---|
| No `.omni-loop/config.yml` on the base branch | `skipped` — omni-loop is not active on this repo |
| Not a feature PR (sub-PR, other branch, no PRD folder) | `skipped` — omni-loop is not active on this PR |
| Outbox clear | `success` |
| Open items, unreworked drift or unaccounted risky changes | `failure` |
| Red, but labelled with the override label (`labels.outboxGo`) | `neutral` |
| Broken base config, snapshot over its bound, or any failure after retries | `failure` |

Nothing is added to an installed repository: no workflow, no file under `.github/`, no secret.

## How it runs

```
GitHub ── pull_request / check_run.rerequested ──▶ /api/github    verify signature → inngest.send → 200
Inngest ──▶ /api/inngest   function "outbox-check" (debounced per repo + PR)
              step "in-progress"  create the check run, in_progress, on the head SHA
              step "evaluate"     snapshot base config + head delivery folder into /tmp, evaluate
              step "publish"      complete the check run; rewrite the outbox comment unless the head moved on
            onFailure          complete the check run as failure — never left in_progress
```

| Unit | Where |
|---|---|
| `webhook` — verify and filter a delivery | `src/webhook/`, served at `api/github.mjs` |
| `snapshot` — only the listed paths, at most 2,000 files and 20 MB | `src/snapshot/` |
| `evaluate` — pure, reuses the kit's gate unchanged | `src/evaluate/` |
| `publish` — the check run and the comment | `src/publish/` |
| `outbox-check` — the Inngest function | `src/outbox-check/`, served at `api/inngest.mjs` |

The app only reads YAML and Markdown through the kit's schemas; it never runs repository code.

Tests run from the repository root with `pnpm test`, against a stubbed GitHub.

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
5. **Labels.** Create the missing label `prd` (and the `pr:*` labels) in this repository.

## Checking it live

With the app installed on this repository, PRD 28's acceptance criteria 1–6 are re-run by hand on a
feature PR: red with an open item, green once settled, neutral under `outbox:go`, skipped on a sub-PR,
skipped on a repository without `.omni-loop/config.yml`, re-evaluated by **Re-run**.
