# omni-loop GitHub App — the outbox check — plan

**PRD:** #28 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/omni-app-outbox-check` →
`main` (`Closes #28`) · **Sub-PRs:** `feat/omni-app-outbox-check--<slice>` → the feature branch
(`Part of #28`).

Any decision taken without asking is an outbox item. Acceptance criteria 1–6 are live: they need the
human steps (the app registered and installed, the Vercel project, the Inngest sync), so the slices
prove them in-process against a stubbed GitHub, and a person runs them on this repository after merge.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `apps/omni-app` exists with every dependency it will need, and `evaluate` turns a snapshot folder, PR facts and changed files into the check's conclusion, title, summary and comment — every row of the spec's conclusion table, reusing the kit unchanged | `apps/omni-app/package.json` `apps/omni-app/src/evaluate/` `apps/omni-app/src/inngest-client.mjs` `apps/omni-app/test/fixtures/` `vitest.config.mjs` `pnpm-lock.yaml` | — | 1 |
| s2 | The kit names the check `outbox` by default, `/omni:yolo` and `/omni:pr` say the omni-loop app posts it, and an ADR records that the gate runs as a GitHub App instead of PRD 3's `omni-outbox.yml` | `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/dist/` `kit/plugin/skills/yolo/` `kit/plugin/skills/pr/` `kit/porting/` `.omni-loop/knowledge/adr/` | — | 1 |
| s3 | `/api/github` answers 401 to a bad or missing signature, 200 to an ignored event, and turns a handled `pull_request` or `check_run.rerequested` into one Inngest event; the committed `app.yml` manifest holds exactly the spec's permissions and events | `apps/omni-app/src/webhook/` `apps/omni-app/api/github.mjs` `apps/omni-app/app.yml` `apps/omni-app/test/app-yml.test.mjs` | s1 | 2 |
| s4 | `snapshot` fetches only the listed paths (base config, head delivery folder) within its bound, and `publish` moves a check run from `in_progress` to `completed` on the right SHA and rewrites the outbox comment unless the head moved on | `apps/omni-app/src/snapshot/` `apps/omni-app/src/publish/` | s1 | 2 |
| s5 | The Inngest function `outbox-check` runs in-progress → evaluate → publish, debounced per repo and PR, and its failure handler completes the check as `failure`; `/api/inngest` serves it; the README lists the setup steps and the Vercel config deploys it | `apps/omni-app/src/outbox-check/` `apps/omni-app/api/inngest.mjs` `apps/omni-app/vercel.json` `apps/omni-app/README.md` | s3, s4 | 3 |

No prefix is shared. s1 adds every dependency (`@octokit/app`, `@octokit/webhooks`, `inngest`,
`@inngest/test`) to `apps/omni-app/package.json` and `pnpm-lock.yaml`, and creates the Inngest client,
so s3, s4 and s5 never touch the manifest, the lockfile or the client. A later slice that needs another
dependency raises it as an outbox item instead of editing s1's files.

## Per slice: done when

- **s1:**
  - `pnpm test` runs `apps/omni-app/**/*.test.mjs` from the root suite.
  - One `evaluate` test per row of the spec's conclusion table passes on fixture folders: not active on
    this repo, not active on this PR (each of: base is not the default branch, head does not match
    `branches.feature`, no PRD folder), outbox clear, open items, unreworked drift, override label,
    broken base config.
  - A head snapshot that renames the override label leaves the verdict unchanged (config from base).
  - A snapshot holding only `.omni-loop/config.yml` and the delivery folder is enough; no kit read
    outside them.
  - `gateResult` and the kit's other policy code are imported, not copied.
- **s2:**
  - `omni config` prints `ci.outboxContext: outbox` when the key is unset; the config test says so.
  - `/omni:yolo` and `/omni:pr` each carry one line naming the omni-loop app as the outbox check's
    source; `kit/test/no-literals.test.mjs` stays green.
  - An ADR under `paths.adr` records decision 1 and names the PRD 3 spec sections it supersedes.
  - `kit/dist/` is rebuilt with `pnpm kit:build` and committed.
- **s3:**
  - Tests: a valid signature sends one event; a wrong or missing signature answers 401 and sends none;
    `closed` and unrelated events answer 200 and send none.
  - The `app.yml` shape test fails on any permission or event beyond the spec's list.
- **s4:**
  - With a stubbed Octokit: only the listed paths are fetched; over 2,000 files or 20 MB fails naming
    the bound.
  - `publish` creates the check under `ci.outboxContext` on the head SHA, completes it with the
    verdict, and rewrites the marker comment in place; when the PR's head SHA has moved, the check is
    completed and the comment is left alone.
- **s5:**
  - `@inngest/test`: the three steps run in order; the debounce key is repo + PR number; a thrown step
    after retries ends in the failure handler completing the check as `failure` ("omni-loop could not
    evaluate: …").
  - An in-process run from a signed webhook to a completed check, against a stubbed GitHub, reproduces
    acceptance criteria 1–6 (failure, success after settle, neutral under the override, skipped on a
    sub-PR, skipped on an inactive repo, re-evaluated on `rerequested`).
  - The README lists the spec's five human steps and the branch-protection warning.
