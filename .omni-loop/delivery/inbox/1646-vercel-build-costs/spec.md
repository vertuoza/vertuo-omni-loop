---
prd: 1646
title: Cut Vercel build costs — build only what can change an app
blocked-by: none
spec: file
---

# Cut Vercel build costs — build only what can change an app

**Date:** 2026-10-12 · **PRD:** #1646 · **After:** PRD 675 (the phase-0 ignore step) ·
**Touches:** `scripts/vercel-ignore.sh` (rewritten, with its tests), `apps/galaxy/vercel.json` and
`apps/omni-app/vercel.json` (each passes its project to the script; omni-app gains an
`installCommand`), `.github/workflows/release.yml` (a Deploy Hook fallback step), a new
`.github/workflows/preview-debounce.yml` with the script it calls, and the README's deploy notes.
**Out of scope:** application code, CI checks (typecheck, lint, tests, fallow, mutation), the
hosting provider, `vercel build` or `vercel deploy --prebuilt` anywhere, and the Vercel dashboard
settings, which a person changes (listed under **Dashboard steps**).

## Problem

Vercel Build CPU Minutes are 65,810 a month, $230.34, nearly the whole Vercel bill. Two Vercel
projects are imported from this repository, galaxy (`apps/galaxy`, Next.js) and omni-app
(`apps/omni-app`, the GitHub App's three functions). Both run the same ignore step,
`scripts/vercel-ignore.sh`, which skips only `docs/phase-0-*` branches. So:

1. **Every merge to `main` builds both projects twice.** The `release` workflow pushes
   `chore(release): v0.0.N` about a minute after every merge. In the 30 days to 2026-10-12, `main`
   took 868 commits, 337 of them release commits: about 1,700 production builds. A release commit
   changes only the version in `package.json`, two `plugin.json` and `kit/dist/omni.mjs`.
2. **Every push on every branch builds both projects.** The remote holds 660 branches (337
   `feat/*`, 205 `docs/*`, 76 `fix/*`, 11 `claude/*`, dependabot). Slice and landing branches,
   drafts, retro and knowledge branches, agent branches and dependabot all build both apps.
3. **Nothing looks at what changed.** A galaxy-only change rebuilds omni-app and the reverse; a
   change under `.omni-loop/delivery/` (a phase-0 merge, a retro) rebuilds both in production.
   130 of the month's merges were `docs(phase-0)`.
4. **omni-app installs the whole workspace** (Next, Playwright, Stryker, ESLint, Vitest) to ship
   three function bundles that are already committed (`apps/omni-app/api/*.mjs`).
5. **AI agents push in bursts:** several small commits within a minute or two on one branch, each a
   build.

## Solution

Each project builds only when a change can reach what it deploys. Production on `main` stays
automatic; previews are kept for the pull requests a person reviews.

### On `main`: one production build per merge, per project that changed

- **A merge commit is skipped;** the release commit that follows carries it and builds. A commit
  on `main` is a release commit when its message starts `chore(release): `
  (`VERCEL_GIT_COMMIT_MESSAGE`).
- **Each project then builds only when its inputs changed** since its last production deploy:
  `git diff --name-only $VERCEL_GIT_PREVIOUS_SHA $VERCEL_GIT_COMMIT_SHA`, checked against the
  project's rule (below). No previous SHA, a SHA the shallow clone lacks after one
  `git fetch --deepen=200`, or a diff that fails: **build**.
- **The safety net.** `release.yml` gains a last step, `if: failure() || cancelled()`, that POSTs
  the Deploy Hook of each project for `main` (secrets `VERCEL_DEPLOY_HOOK_GALAXY_MAIN`,
  `VERCEL_DEPLOY_HOOK_OMNI_APP_MAIN`). A hook-triggered deployment runs the ignore step like any
  other; the script builds it because it is not a merge commit's skip case (see **Decisions**,
  hook deployments). The release workflow's own `if:` already skips release commits, so a hook
  never fires for one.

### The project rules

- **galaxy builds unless every changed file is on its never list.** A deny list, so a new folder
  galaxy starts reading builds by default. The never list:
  `.omni-loop/delivery/**`, `.omni-loop/knowledge/adr/**`, `.omni-loop/knowledge/playbook/**`,
  `.omni-loop/knowledge/README.md`, `apps/omni-app/**`, `.github/**`, `mutation/**`, `fallow/**`,
  `layering/**`, `docs/superpowers/**`, `scripts/**`, `README.md`, `eslint.config.ts`,
  `vitest.config.ts`, `stryker.config*.ts`, `.fallowrc.jsonc`, and every `*.test.ts`,
  `*.test.mjs` file. `.omni-loop/config.yml` and the knowledge registers stay inputs: galaxy serves
  them at runtime (`next.config.ts`, `outputFileTracingIncludes`), and so does the root
  `package.json` (the sidebar shows its version).
- **omni-app builds only when a file on its list changed.** An allow list: its functions are the
  committed bundles, which `src/vercel-functions.test.ts` keeps equal to a fresh build, so a kit
  or package change that reaches them changes `apps/omni-app/api/` in the same commit. The list:
  `apps/omni-app/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and the root `package.json` when a
  line other than `"version"` changed.
- **On any branch but `main`,** every file under `.omni-loop/` is on both never lists as well: a
  change only there never previews.
- **`VERCEL_FORCE_BUILD=1`** on a project builds every deployment, read before any rule: the
  switch that stops skipping without a revert.

### Previews: ready pull requests into `main`, after a quiet window

- **A push to any branch but `main` never builds on its own.** The ignore step builds a branch
  commit only when GitHub shows its project's commit status, `vercel/preview/galaxy` or
  `vercel/preview/omni-app`, = `success` on it, read with `GITHUB_STATUS_TOKEN`. No status, or GitHub unreachable: skip.
- **`preview-debounce.yml`** runs on `pull_request` `ready_for_review` and `synchronize`, with
  `concurrency: preview-<head branch>` and `cancel-in-progress: true`, so a newer push cancels the
  wait of an older one. Its script (`scripts/preview-debounce.ts`, tested on its own):
  1. stops when the PR is a draft, its base is not `main`, or its head is `dependabot/**`;
  2. waits 150 seconds;
  3. stops when the PR's head moved, or it turned draft, meanwhile;
  4. for each project whose rule says its inputs changed between the merge base with `main` and
     the head: sets that project's `vercel/preview/<project>` = `success` on the head commit, then creates a deployment
     through the Vercel REST API (`POST /v13/deployments` with `gitSource` = the repository and
     the head branch and SHA, `target` omitted: a preview). Vercel builds it from Git, on its own
     build machines; nothing is built or uploaded from the runner.
  5. A failed API call fails the job, red on the PR.
- What this gives each branch shape (the ignore step's tests hold this table):

| branch | builds |
|---|---|
| `main`, merge commit | nothing (its release commit builds) |
| `main`, release commit | each project whose inputs changed since its last production deploy |
| feature `feat/<topic>`, PR draft | nothing |
| feature, PR marked ready (after `chore(delivery): ship PRD <n>`) | galaxy (and omni-app if its files changed), ~150 s after the last push |
| feature, yolo-fix pushes on a ready PR | once per burst, ~150 s after the last push |
| slice `feat/<topic>--<slice>`, landing branches | nothing (their PRs' base is not `main`) |
| `fix/*`, any other ready PR into `main` | as a ready feature branch |
| `docs/phase-0-*`, `docs/retro-*`, `docs/knowledge-*` | nothing (only `.omni-loop/` changes) |
| `claude/*` without a ready PR into `main` | nothing |
| `dependabot/**` | nothing |

### Cheaper builds, nothing weakened

- **omni-app** gets `"installCommand": "pnpm install --frozen-lockfile --prod --filter @omni/omni-app..."`
  in its `vercel.json`: only the npm packages its bundles import (`@octokit/*`, `inngest`,
  `@supabase/supabase-js`, `zod`) and its workspace packages' production dependencies.
- **galaxy keeps the full install:** it transpiles kit source, which imports root
  devDependencies (`yaml`), so a filtered install would break it.
- `next build` keeps its type check; CI keeps typecheck, lint, tests and fallow.

### Dashboard steps (a person does these; the PR body repeats them)

1. **Vercel → each project → Settings → Git → Deploy Hooks:** create one for branch `main`;
   store the URLs as GitHub secrets `VERCEL_DEPLOY_HOOK_GALAXY_MAIN` and
   `VERCEL_DEPLOY_HOOK_OMNI_APP_MAIN`.
2. **Vercel → Account → Tokens:** a token scoped to the team; GitHub secrets `VERCEL_TOKEN`,
   `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID_GALAXY`, `VERCEL_PROJECT_ID_OMNI_APP` (each project's
   Settings → General), and the repository's numeric id as variable `VERCEL_GITHUB_REPO_ID`.
3. **GitHub → a fine-grained token,** this repository only, permission *Commit statuses: read*;
   on both Vercel projects, env var `GITHUB_STATUS_TOKEN` for Production and Preview.
4. **Vercel → each project → Settings → Build and Deployment:**
   - **Build Machine:** omni-app → Standard. galaxy → open its last 10 production builds and note
     the build duration; Standard unless Standard takes more than twice the current machine's
     wall time (Build CPU Minutes are vCPUs × minutes: Enhanced costs about 2×, Turbo about 7.5×
     Standard for the same wall time).
   - **On-Demand Concurrent Builds:** off. **Prioritize Production Builds:** on.
   - **Ignored Build Step:** stays "Run my Bash script" from `vercel.json` (no dashboard override).
5. Order: steps 1–3 before the feature PR merges (without the token, previews would never build;
   without the hooks, the fallback cannot fire). Step 4 any time.

## Decisions

- **Release commit builds, merge commit skips** (person, design review): one production build per
  merge with the right version number. Rejected: building only the merge commit (the sidebar
  shows the previous version) and keeping both (galaxy builds twice per code merge).
- **Deploy Hook fallback** (person): production never depends on the release workflow alone.
- **Hook deployments build.** A hook deployment's commit is `main`'s head, a merge commit; the
  ignore step tells it apart because the release workflow's fallback first sets the commit status
  `vercel/production-fallback` = `success` on that SHA (the workflow gains `statuses: write`), and
  the script builds a `main` merge commit that carries it.
- **Debounce in GitHub Actions, not in the ignore step** (person asked for a 2–3 minute pushback):
  the ignore step runs on the paid build machine, where a wait is billed like a build. 150 s.
- **No preview for drafts, slices, landings, `.omni-loop/`-only changes or dependabot** (person).
  Yolo-fix pushes on a ready PR do preview (person).
- **Retro and knowledge branches never preview** (person asked they be covered); a knowledge merge
  still rebuilds galaxy in production, which serves the registers.
- **galaxy by deny list, omni-app by allow list:** galaxy reads `supabase/`, `kit/lib`, `kit/bin`,
  `game/`, `docs/guide`, `kit/plugin` and the knowledge registers, so a deny list fails safe;
  omni-app's committed bundles make an allow list exact.
- **Fail open on `main`, closed on branches:** a production deployment is never lost to an error;
  a preview lost to one is retried by the next push or a Redeploy.
- **No proof video** (person): no screen changes; verification is on Vercel Usage.
- **Accepted cost:** after a merge that changes nothing galaxy deploys (a phase-0 or retro), the
  sidebar's version lags until the next merge that does.

## User stories

- As the person paying for Vercel, Build CPU Minutes fall by about 85% with no change to how I
  ship.
- As a reviewer of a ready feature PR, I still get a galaxy preview, built once per burst of
  agent pushes.
- As `/omni:prove`, I still find the ready feature PR's preview within my 10-minute wait.
- As the release, every merge to `main` still reaches production automatically, even when the
  release workflow fails.

## Scope

In: the ignore script and its tests, both `vercel.json`, `release.yml`'s fallback step,
`preview-debounce.yml` and its script with tests, the README deploy notes (`apps/galaxy/README.md`
› Deploy to production, `apps/omni-app/README.md`), and the releasing playbook's TODO about Vercel
deploys answered.

Out: application code; CI checks; dashboard settings (listed above, done by a person); other
Vercel costs.

## Test seams

- **The ignore script** (`scripts/vercel-ignore.test.ts`, vitest): runs `scripts/vercel-ignore.sh`
  in a temporary git repository built per case, with `VERCEL_*` env vars set and the GitHub status
  read stubbed through a `VERCEL_IGNORE_GITHUB_API` base URL pointed at a local HTTP stub. One row
  per case: branch shape × release/merge commit × changed paths × status present/absent/unreachable
  × previous SHA present/missing/outside the clone × `VERCEL_FORCE_BUILD`, asserting exit 0 (skip)
  or 1 (build) per project.
- **The never list** (`scripts/vercel-inputs.test.ts`): no non-test file under `apps/galaxy/`
  imports, or traces through `next.config.ts`, a path on galaxy's never list; and every file
  `apps/omni-app/build.ts` bundles from outside `apps/omni-app/` ends in a committed
  `apps/omni-app/api/*.mjs`.
- **The debounce script** (`scripts/preview-debounce.test.ts`): GitHub and Vercel stubbed; draft,
  base not `main`, dependabot, head moved, turned draft, no project changed, one or both projects
  changed, and a Vercel API failure (exits non-zero).
- **Workflows:** `actionlint` when available; otherwise the YAML parses and the step names exist.
- Never a local `next build`, `vercel build` or `vercel deploy`.
- Follow `omni kb show testing`: tests beside the code, under folders `vitest.config.ts` includes
  (`scripts/` is added to its include list when it is not there).

## Risks

What merging publishes: new skip rules on both Vercel projects' production and preview builds,
and a new workflow that creates Vercel deployments.

- **A production change is skipped by a wrong never-list entry.** Mitigated by the deny-list
  shape, the import-graph test, and fail-open on `main`. Rollback: set `VERCEL_FORCE_BUILD=1` on
  the project (immediate), then revert the feature PR.
- **Previews stop** if `GITHUB_STATUS_TOKEN` or `VERCEL_TOKEN` is missing or expires: the debounce
  job goes red on the PR; Redeploy builds by hand. Rollback the same way.
- **omni-app's filtered install misses a runtime package:** the first omni-app preview after
  merge shows it (a function fails to start); revert the `installCommand` line alone.
- **The release fallback fires twice** (a re-run): two identical production builds, harmless.
- Read `omni kb show releasing`: a merge to `main` also ships the kit; this PRD changes no kit
  file.

## Acceptance criteria

1. A merge commit on `main` shows "Canceled by Ignored Build Step" on both projects, and its
   release commit builds each project whose inputs changed.
2. A merge whose files are all under `.omni-loop/delivery/` (a phase-0 or retro) builds neither
   project, merge or release commit.
3. A merge that changes only `apps/omni-app/**` is skipped on both projects; its release commit
   builds omni-app (its files changed since its last deploy) and galaxy (the version it shows).
   A merge that changes only `apps/galaxy/**` builds galaxy alone at its release commit: omni-app
   ignores a version-only `package.json`.
4. When `release.yml` fails or is cancelled, both projects deploy `main`'s head within minutes,
   through the Deploy Hooks.
5. A push to a branch with no PR, a draft PR, a PR whose base is not `main`, or a dependabot PR
   starts no Vercel build.
6. Marking a feature PR ready starts one galaxy preview about 150 s later, on the head commit, and
   three pushes 30 s apart on a ready PR start one preview, of the last commit.
7. A ready PR whose changes are all under `.omni-loop/` gets no preview.
8. `VERCEL_FORCE_BUILD=1` on a project builds every deployment of it.
9. omni-app's build log shows the filtered install, and its three functions answer on the first
   preview (`/api/github` returns its health response).
10. One week after merge, Vercel Usage shows Build CPU Minutes per day at or below 330 (from about
    2,190), with no production deploy of a merge missing.

## Verifying on Vercel

- **Baseline (before merge):** Usage → Build CPU Minutes, last 30 days (65,810), split by project;
  Deployments → count by project and environment for the same window.
- **First merges:** the Deployments list shows the merge commit canceled, the release commit
  built (criteria 1–3); build logs print `vercel-ignore: <reason>` for every decision.
- **After a week:** Build CPU Minutes per day against the baseline's ~2,190; deployments per day
  per project; omni-app's install duration in a build log.
- **Proof:** `/omni:prove` on the next shipped PRD with `proof: video` finds its preview.
