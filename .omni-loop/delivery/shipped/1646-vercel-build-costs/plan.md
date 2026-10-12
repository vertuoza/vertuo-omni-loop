# Plan: Cut Vercel build costs — build only what can change an app

PRD #1646, specified in `spec.md` beside this plan. The feature branch `feat/vercel-build-costs`
merges into `main` with `Closes #1646`; each slice is a sub-PR from `feat/vercel-build-costs--<slice>`
into the feature branch, with `Part of #1646`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Each project's rule decides from a list of changed paths whether it can change what that project deploys: galaxy by its never list, omni-app by its allow list, `.omni-loop/` never on a branch | `scripts/vercel-inputs` | — | 1 |
| s2 | The Vercel ignore step skips a merge commit on `main`, builds its release commit only for a project whose inputs changed since its last production deploy, builds a fallback-marked commit, builds a branch commit only with its project's `vercel/preview/<project>` status, honours `VERCEL_FORCE_BUILD`, and omni-app installs its runtime dependencies only | `scripts/vercel-ignore` `apps/galaxy/vercel.json` `apps/omni-app/vercel.json` | s1 | 2 |
| s3 | A ready pull request into `main` gets one preview per changed project, 150 s after its last push, created on Vercel through the REST API from Git | `scripts/preview-debounce` `.github/workflows/preview-debounce.yml` | s1 | 2 |
| s4 | When the release workflow fails or is cancelled, both projects deploy `main` through their Deploy Hooks; the deploy notes, the environment list and the releasing playbook say how builds are now decided and which dashboard steps they need | `.github/workflows/release.yml` `apps/galaxy/README.md` `apps/omni-app/README.md` `README.md` `.omni-loop/knowledge/playbook/releasing.md` | s2, s3 | 3 |

**Shared ground.** None: no prefix is declared by two slices. s2 and s3 share wave 2 and both call
s1's module without editing it. `scripts/vercel-ignore` covers both the script and its existing test,
`scripts/vercel-ignore.test.ts`. If s4 adds a variable the repository's environment check
(`scripts/env-docs.test.ts`) requires listed, the list it reads is the root `README.md`, which s4 owns.

## Per slice: done when

**s1**
- `scripts/vercel-inputs.mjs` (plain ESM JavaScript, no dependency, runs on any Node 22 Vercel
  offers) exports `affects(project, paths, { branch })` and a CLI:
  `node scripts/vercel-inputs.mjs <galaxy|omni-app> <main|branch>` reads changed paths on stdin,
  prints `vercel-inputs: <project> <yes|no>: <first matching path, or "none">` and exits 0 for yes,
  1 for no.
- galaxy answers no only when every path is on the spec's never list; a path anywhere else, an
  empty list, or an unknown project answers yes.
- omni-app answers yes for `apps/omni-app/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and the root
  `package.json` only when the diff text it is given shows a changed line other than `"version"`
  (the CLI takes `--package-json-diff <file>`); otherwise no.
- With `branch`, every `.omni-loop/` path counts as never, for both projects.
- `scripts/vercel-inputs.test.ts` covers each rule with valid and invalid input, and checks the
  never list against the code: no non-test file under `apps/galaxy/` imports a path on it
  (following `next.config.ts`'s `outputFileTracingIncludes` too), and every module
  `apps/omni-app/build.ts` bundles from outside `apps/omni-app/` is reached through a committed
  `apps/omni-app/api/*.mjs`.

**s2**
- `scripts/vercel-ignore.sh <galaxy|omni-app>` decides in this order, printing one
  `vercel-ignore: <reason>, <building|skipping>` line: `VERCEL_FORCE_BUILD=1` builds; on `main`, a
  commit carrying the status `vercel/production-fallback` = `success` builds; a commit whose message
  does not start `chore(release): ` skips; a release commit builds when s1 says the diff
  `VERCEL_GIT_PREVIOUS_SHA..VERCEL_GIT_COMMIT_SHA` affects the project (one `git fetch --deepen=200`
  when the SHA is missing; any failure builds); on any other branch, it builds only when the commit
  carries `vercel/preview/<project>` = `success`, read with `GITHUB_STATUS_TOKEN` (no token, no
  answer, or no status: skip). The phase-0 rule of PRD 675 stays covered: those branches skip.
- GitHub is read at `${VERCEL_IGNORE_GITHUB_API:-https://api.github.com}`, with a 5-second limit.
- Both `vercel.json` call it with their project (`cd ../.. && bash scripts/vercel-ignore.sh galaxy`);
  `apps/omni-app/vercel.json` gains
  `"installCommand": "pnpm install --frozen-lockfile --prod --filter @omni/omni-app..."`.
- `scripts/vercel-ignore.test.ts` runs the script in a temporary repository per case, with a local
  HTTP stub for GitHub: every row of the spec's branch table, merge vs release commit, changed paths
  per project, status present / absent / GitHub unreachable, previous SHA present / missing /
  outside the clone, and `VERCEL_FORCE_BUILD`, asserting exit 0 or 1 per project.

**s3**
- `scripts/preview-debounce.ts` takes the pull request number and, with GitHub and Vercel reached
  through injectable base URLs: stops (exit 0, one line why) on a draft, a base other than `main`,
  or a `dependabot/` head; waits `PREVIEW_DEBOUNCE_SECONDS` (default 150); stops when the head SHA
  moved or the PR turned draft meanwhile; for each project s1 says the diff from the merge base with
  `main` to the head affects (as a branch), sets `vercel/preview/<project>` = `success` on the head
  commit, then `POST /v13/deployments?teamId=…` with the project id and
  `gitSource: { type: "github", repoId, ref: <head branch>, sha: <head sha> }`, no `target`; exits
  non-zero when an API call fails.
- `.github/workflows/preview-debounce.yml` runs on `pull_request` `ready_for_review` and
  `synchronize`, with `concurrency: { group: preview-${{ github.head_ref }}, cancel-in-progress: true }`,
  `permissions: { statuses: write, pull-requests: read, contents: read }`, and calls the script with
  the secrets and variable the spec names; it installs nothing beyond Node.
- `scripts/preview-debounce.test.ts` covers draft, wrong base, dependabot, head moved, turned draft,
  no project changed, one and both projects changed, and a Vercel failure, with the wait set to 0.

**s4**
- `release.yml` gains `statuses: write` and a last step, `if: failure() || cancelled()`, that sets
  `vercel/production-fallback` = `success` on the triggering SHA, then POSTs
  `secrets.VERCEL_DEPLOY_HOOK_GALAXY_MAIN` and `secrets.VERCEL_DEPLOY_HOOK_OMNI_APP_MAIN`, skipping a
  hook whose secret is empty with a warning; the YAML parses and `scripts/checks-workflow.test.ts`
  (or a sibling test) asserts the step and its condition.
- `apps/galaxy/README.md` › Deploy to production and `apps/omni-app/README.md` describe when each
  project builds, the escape hatch, and the spec's **Dashboard steps** 1–5 as written there.
- The root `README.md`'s environment list names `GITHUB_STATUS_TOKEN` and `VERCEL_FORCE_BUILD`
  (Vercel project env) and the GitHub secrets and variable, as the repository's environment check
  requires.
- `.omni-loop/knowledge/playbook/releasing.md` answers its TODO: a merge to `main` deploys galaxy and
  omni-app to production through the release commit, each only when its inputs changed.
