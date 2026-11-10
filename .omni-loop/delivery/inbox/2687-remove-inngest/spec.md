---
prd: 2687
title: Remove Inngest
blocked-by: [2686]
spec: file
areas: [install]
---

## Problem

After PRD 2686, the Omni GitHub App runs every background job on its own ledger, and Inngest runs nothing. But
it is still there:

- the `inngest` package is installed and bundled into `apps/omni-app/api/`;
- `/api/inngest` is still deployed, a public route that serves no function;
- whoever installs the App is still told to create an Inngest account and set `INNGEST_EVENT_KEY`,
  `INNGEST_SIGNING_KEY` and `INNGEST_DEV`;
- the README, the observability guide, the kit's install text, the playbook and many comments still describe
  an Inngest that is gone, and the repository's own config still names `inngest-client.ts` as its job layer.

Omni Loop is open source: every extra vendor is a step each new workspace has to take, and a reader of the
code is misled about how it runs.

## Solution

Inngest leaves the code base. Nothing changes for people who use the App.

### Removed

- The dependency `inngest` from `apps/omni-app/package.json`, and its entries from the lockfile.
- `apps/omni-app/entries/inngest.ts`, `inngest` in `FUNCTIONS` (`apps/omni-app/build.ts`), `api/inngest.mjs` in
  `apps/omni-app/vercel.json`, and the built `apps/omni-app/api/inngest.mjs`.
- `apps/omni-app/src/inngest-client.ts`. What other modules still read from it (the checks' external ids, the
  payload schemas) moves to `apps/omni-app/src/jobs/payloads.ts`.
- `apps/omni-app/src/functions.ts` and its test, by then empty, and the Inngest wrapper in
  `apps/omni-app/src/run-log/run-log.ts` (`loggedClient`).
- `SDK_VARIABLES` in `apps/omni-app/src/env.ts`, and the three variables from the README's list and from
  `env-docs.test.ts`.
- Test helpers that only stub an Inngest step or client.

### Rewritten

- **The words.** Every live mention of Inngest: `apps/omni-app/README.md`, `apps/galaxy/README.md`,
  `docs/observability.md`, the comments in `apps/omni-app/src/`, `apps/galaxy/src/` and `kit/lib/`, and the
  line the install prints about what can stop a merge (`kit/lib/init/steps.ts`), which names the App and its
  database instead.
- **The run log.** `docs/observability.md` describes the `jobs` line in place of the `inngest` line. Lines
  already written keep their old name until Vercel's retention drops them.
- **The repository's own knowledge.** `layers.job` in `.omni-loop/config.yml` names `apps/omni-app/src/jobs/`;
  the playbook's architecture page describes the ledger; one new decision record says background jobs run on
  the App's own ledger and why, and the records it replaces say so in their status line. Their text stays.
- **Generated files.** `kit/dist/` and `apps/omni-app/api/` are rebuilt and committed.

### Kept from coming back

A guard test in `scripts/` fails when a tracked file names Inngest, outside the folders that are history: the
delivery folders (`.omni-loop/delivery/`) and the decision records.

### A person's steps, after the merge

Named in the feature PR's body, since no agent may do them:

1. Remove `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` and `INNGEST_DEV` from the App's Vercel project.
2. Remove Inngest's integration from the Vercel project, if one is installed.
3. Archive the `omni-loop` app on Inngest, then close the account.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | code | `apps/omni-app/src/jobs/payloads.ts` | no written convention: follows `apps/omni-app/src/jobs/pack.ts` |
| vertuo-omni-loop | guard | `scripts/no-inngest-guard.test.ts` | no written convention: follows `scripts/env-guard.test.ts` |
| vertuo-omni-loop | adr | the next number in `.omni-loop/knowledge/adr/` | `.omni-loop/knowledge/adr/README.md` |

## Decisions

- **History is not rewritten.** Shipped PRDs, bug records, concepts and existing decision records keep their
  words: they say what was true then.
- **A guard, not a one-time sweep,** so a copied comment or a restored file is refused in a pull request.
- **The old log name is not migrated.** Vercel keeps log lines for a limited time; the guide says which name a
  line had before this PRD.
- **The person's steps come after the merge,** not before: until the deploy, the old bundle still loads the
  SDK, which reads its variables.

## User stories

- As a workspace owner who installs the Omni GitHub App, I set up GitHub, the database and Vercel, and nothing
  else.
- As a developer reading the App's code, every job is in `apps/omni-app/src/jobs/` and the guide matches it.
- As the person who runs the App, I have one vendor fewer to pay, watch and name in our list of processors.

## Scope

In: everything under **Removed**, **Rewritten** and **Kept from coming back**.

Out: any change to a job's behaviour; the history folders; the person's three steps.

## Test seams

- **The guard:** `scripts/no-inngest-guard.test.ts`, with a fixture file that names Inngest (built at runtime,
  so the guard's own source passes) and the history folders left out.
- **The build:** `apps/omni-app/build.ts`'s test lists four functions; `vercel-functions.test.ts` matches
  `vercel.json`; `kit/test/dist.test.ts` passes on the rebuilt bundle.
- **The environment:** `env-docs.test.ts` no longer expects the three variables, and the App starts with none
  of them set.
- **The install text:** `kit/bin/init.test.ts` expects the new sentence.
- No test calls GitHub or Supabase.

## Risks

- **What merging publishes:** a new deploy of the App without `/api/inngest`, and a new kit (`kit/dist/`)
  whose install text changed. No migration.
- **Rollback:** revert the feature PR. The variables must still be set on Vercel for the reverted App to
  start, which is why the person's steps come after and can wait a few days.
- **A caller of `/api/inngest`.** Inngest's servers may still call the route until the app is archived; they
  get a 404, which harms nothing.
- N-PRODUCT-13: the install could overwrite a person's own settings without them knowing. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design keeps it: only a sentence the install prints changes, not where it writes.
- The business laws: none touched.
- The Legal entries: L-GDPR-5 (every service that handles personal data is named): Inngest is not in the list, and after this PRD nothing is sent to it. L-GDPR-7 (data sent outside the EU): one transfer fewer. L-LICENSE-2 (the built kit keeps its bundled libraries' notices): the kit bundles nothing new.

## Acceptance criteria

- `apps/omni-app/package.json` and the lockfile name no `inngest` package, and `apps/omni-app/api/` holds no
  `inngest.mjs`.
- The deployed App answers 404 on `/api/inngest`, and starts with no `INNGEST_*` variable set.
- No tracked file outside the delivery folders and the decision records names Inngest, and the
  guard test fails when one does.
- The App's README lists no Inngest step and no `INNGEST_*` variable; `docs/observability.md` describes the
  `jobs` line.
- `omni init` prints its line about what can stop a merge without naming Inngest.
- `layers.job` in `.omni-loop/config.yml` matches the files under `apps/omni-app/src/jobs/`.
- A decision record says background jobs run on the App's own ledger.
- The feature PR's body lists the person's three steps.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass, and `kit/dist/` and `apps/omni-app/api/` are rebuilt.
