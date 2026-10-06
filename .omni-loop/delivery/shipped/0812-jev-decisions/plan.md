# Plan: Jev decisions, opt-in per workspace

PRD #812, spec beside this plan (`spec.md`). The feature branch `feat/jev-decisions` goes into
`main` through the feature PR (`Closes #812`). Each slice is a sub-PR from
`feat/jev-decisions--<slice>` into the feature branch (`Part of #812`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Opts a workspace in to Jev. One migration adds `workspace_secrets`, `jev_decisions` and `jev_calls`, their RLS, and the owner-only security-definer functions to set and remove the key (removing it sets every decision Off) and to set a decision's mode, threshold and confidence floor. `supabase/checks/jev.sql` proves it in CI. The secret box encrypts with `SECRETS_MASTER_KEY` (AES-256-GCM, last four kept). The Jev client calls `api.typesafe.ai/v1/systemone` with the pinned `jev-1.13.0`, a 5 s timeout and no retry. The mask ports the kit's `maskSecrets` rules. The store reads and writes the three tables. Settings › Jev (a new tab) lets the owner switch Jev on, and a pasted key is saved only after one test call succeeds; a refused key shows TypeSafe's reason. Members see the page without the key; without `SECRETS_MASTER_KEY` the page says Jev is not available here | `supabase/migrations/` `supabase/checks/jev.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/jev/secret-box` `apps/galaxy/src/jev/client` `apps/galaxy/src/jev/mask` `apps/galaxy/src/jev/store` `apps/galaxy/src/jev/settings/` `apps/galaxy/app/app/settings/jev/` `apps/galaxy/app/api/jev/` `apps/galaxy/src/nav/` `apps/galaxy/src/fleets/render.test.ts` `apps/galaxy/src/repositories/render.test.ts` `apps/galaxy/src/business/render.test.ts` `apps/galaxy/.env.example` `apps/galaxy/README.md` | — | 1 |
| s2 | Puts the question category through Jev. The registry holds one entry per decision (question type, instructions, options, state, answer mapping), the first being `question-category`, a Choice over the six categories. The resolver turns mode × outcome (answered, under the floor, failed, no key) into the answer that counts, `decidedBy`, and one `jev_calls` row with the old answer beside Jev's. `classify` runs through it in `after()`: Off is exactly today, Shadow stores Haiku's and logs Jev's, On stores Jev's and Haiku's when Jev cannot. Settings › Jev gains the three decision rows (mode, threshold, floor, what each sends), owner-editable, `outbox-risk` and `bug-risk` shown as "coming in this PRD" until their slices land | `apps/galaxy/src/jev/decisions/` `apps/galaxy/src/jev/resolve` `apps/galaxy/src/jev/settings/` `apps/galaxy/app/app/settings/jev/` `apps/galaxy/src/ask/classify` `apps/galaxy/src/ask/api-live.ts` `apps/galaxy/src/ask/api.ts` `apps/galaxy/src/ask/api.test.ts` | s1 | 2 |
| s3 | Lets a Claude session ask Jev whether a decision is hard to revert. `POST /api/decide/<decision>` takes the caller's sign-in, the repository, the state and the old answer, finds the workspace, and answers `{ answer, confidence, decidedBy }` through the resolver (Off without calling Jev). `omni decide <outbox-risk or bug-risk> --state-file <json> --old <value> [--ref <text>] [--json]` prints `<answer> <confidence>` or `unset`, exits 0 on every decision outcome and 2 on a usage error. The `outbox-risk` registry entry asks a Noul "hard to revert?" and maps it with the decision's threshold. `/omni:do-work`'s "Record it" step runs `omni decide outbox-risk` after setting `hardToRevert`, uses its answer when it prints one, and writes `Decided by: Jev (hardToRevert <p>) · agent said <old>` on the item; the kit's rank and law floor are unchanged | `apps/galaxy/src/jev/decisions/` `apps/galaxy/app/api/decide/` `kit/bin/commands/decide.mjs` `kit/bin/commands/index.mjs` `kit/bin/decide.test.mjs` `kit/test/fake-ask-server.mjs` `kit/lib/help/entries.mjs` `kit/dist/omni.mjs` `kit/plugin/skills/do-work/` | s2 | 3 |
| s4 | Shows each decision's record on Settings › Jev: over the last 30 days, the number of calls, the agreement rate with the old answer, and the last ten disagreements with both answers and a link to the round, the outbox item or the issue. A decision that is Off with no calls says "Off: Jev is not called" | `apps/galaxy/src/jev/record/` `apps/galaxy/src/jev/settings/` `apps/galaxy/app/app/settings/jev/` | s2 | 3 |
| s5 | Lets `/omni:bug-fix` ask Jev for the bug's risk. The `bug-risk` registry entry is a Score over critical, high, medium, low, each level worded from the repository's bug-fixing form, given the issue's title and body, the reproduction's path, the domain and the agent's sentence. Step 3 "Triage" runs `omni decide bug-risk` after the agent's own call, uses its level when it prints one (label included), and appends `(Jev, <confidence>)` to the Risk line; Kind, Domain and Regression are unchanged | `apps/galaxy/src/jev/decisions/` `kit/plugin/skills/bug-fix/` | s3 | 4 |

**Shared ground.**
- **`apps/galaxy/src/jev/decisions/`:** the registry, one file per decision and an index. s2 creates
  it, s3 adds `outbox-risk`, s5 adds `bug-risk`; waves 2, 3 and 4 keep them apart.
- **`apps/galaxy/src/jev/settings/` and `apps/galaxy/app/app/settings/jev/`:** the page. s1 builds
  the key part, s2 the decision rows, s4 the record; waves 1, 2 and 3 keep them apart. s3 and s4
  share wave 3 and no prefix.
- **The database:** every table and function lands in s1's single migration; later slices read and
  write through `apps/galaxy/src/jev/store` and never touch `supabase/`. The migration's date is
  checked against the latest one on `main` before the feature PR merges (the lesson of #771).
- **The settings tabs' tests:** adding the Jev tab changes what `src/fleets/render.test.ts`,
  `src/repositories/render.test.ts` and `src/business/render.test.ts` see; s1 owns them.
- **`kit/dist/omni.mjs`:** s3 only, rebuilt with `pnpm kit:build` because `kit/test/dist.test.mjs`
  fails on a stale bundle. `omni decide` accepts any decision name and the app refuses an unknown
  one, so s5 needs no kit change.

## Per slice: done when

**s1**
- `supabase/checks/jev.sql` passes in CI and proves: an owner sets and removes the key and sets a
  mode, threshold and floor; a member and an owner of another workspace are refused by every
  function and read no `workspace_secrets` row; removing the key sets every decision Off.
- `src/jev/secret-box.test.ts`: a round trip; a wrong master key, a changed ciphertext and a changed
  iv fail; the last four; a missing master key.
- `src/jev/client.test.ts`: the request (endpoint, bearer, `jev-1.13.0`, question keys) and each
  outcome — a Choice, a Score, a Noul, a non-200, a timeout, a reply outside the schema.
- `src/jev/mask.test.ts`: the kit's secret shapes are masked, and masking twice changes nothing.
- The page's tests: the owner's view with and without a key; a refused test call stores nothing and
  shows TypeSafe's reason; the member's view shows no key field; no `SECRETS_MASTER_KEY` shows "Jev
  is not available on this deployment"; the Jev tab appears under Settings.
- `SECRETS_MASTER_KEY` is in `apps/galaxy/.env.example` and the README.

**s2**
- `src/jev/decisions/*.test.ts`: `question-category`'s question validates, and each Choice maps to
  its category; a key outside the options is refused.
- `src/jev/resolve.test.ts`: every mode × every outcome gives the right counted answer, `decidedBy`
  and log row; On with an answer under the floor counts the old one; On keeps Jev's answer when it
  differs from the old one.
- The existing `src/ask/` tests pass unchanged with the decision Off; new tests: Shadow stores
  Haiku's category and logs Jev's; On stores Jev's, and Haiku's when Jev fails.
- The page's tests: the owner changes a decision's mode, threshold and floor and no other decision's
  settings move; a member sees them read-only.

**s3**
- `app/api/decide/[decision]/route.test.ts`: no sign-in, a repository no workspace owns, an unknown
  decision, a malformed state, and each of Off, Shadow and On.
- `kit/bin/decide.test.mjs`, through `main()` with a stubbed `fetch` and token store: an answer; `unset`
  on no sign-in, a timeout, a refusal, Off and Shadow; `--json`; a usage error exits 2.
- `outbox-risk`'s registry test: a Noul at or above the threshold maps to `true`, under it to `false`.
- `kit/plugin/skills/do-work/SKILL.md`'s "Record it" step runs `omni decide outbox-risk` and writes the
  `Decided by` line only when Jev's answer counted; `unset` leaves the step as today.
- `kit/test/dist.test.mjs` passes on the rebuilt bundle, and `omni help decide` prints its entry.

**s4**
- `src/jev/record/*.test.ts`, from fixture `jev_calls` rows: the 30-day window, the counts, the
  agreement rate, the last ten disagreements newest first with their links; nothing older than 30
  days counts.
- The page's tests: each decision row shows its record; an Off decision with no calls says so.

**s5**
- `bug-risk`'s registry test: the Score's levels map to `critical | high | medium | low`, and the
  question carries the bug-fixing form's wording of each level.
- `kit/plugin/skills/bug-fix/SKILL.md` step 3 runs `omni decide bug-risk`, labels the issue with the
  level that counted, and appends `(Jev, <confidence>)` only when Jev's answer counted; `unset` leaves
  the step as today.
