# Plan: Product constituents

PRD #871, spec beside this plan (`spec.md`). Feature branch `feat/product-constituents` into `main`
(`Closes #871`); each slice is a sub-PR from `feat/product-constituents--<slice>` into the feature
branch (`Part of #871`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Adds the constituents store and its reads. One migration creates `constituents` (a product's Statement, its Never lines with `never#<n>` ids kept for life, removed rows kept) and the append-only `constituent_events`; owner-only security-definer functions (add, edit, remove; each writes its event in the same transaction); the one-time move of each product's confirmed `never` claims into its Never list (a `moved` event each, the claim left `rejected`); `claim_pick` and `claim_propose_evidence` refuse kind `never`; a service-role read by repository for the App; and `jev_decision_names()` widened with `constituent-break`. `GET /api/constituents?repo=` returns the repository's product's Statement, Never list and latest event id with the terminal's sign-in. `supabase/checks/constituents.sql` proves it | `supabase/migrations/` `supabase/checks/constituents.sql` `supabase/checks/business.sql` `apps/galaxy/src/constituents/` `apps/galaxy/app/api/constituents/route.ts` | — | 1 |
| s2 | Adds the Constituents panel on Settings › Business. Per product, above the claims: the Statement with Edit, the Never list with `+ Never line` and remove, each row anchored `#never-<n>`, and a History drawer listing every event newest first (person chip, date and time, before and after). Owners see the controls; members see the same panel read-only. The vague-word hint shows under the Never line field and never blocks. The Never kind leaves the claim editor, and the draft and the recheck stop proposing it. It works at 393px and in both themes | `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s1 | 2 |
| s3 | Adds `omni constituents` and the boot hook. The command reads `GET /api/constituents` for the repository with the terminal's sign-in, writes `.omni-loop/local/constituents.json`, and prints the Statement and the Never list with "synced just now"; offline or failing it prints the cached copy with its age, and with no cache, no product or no sign-in one line; it always exits 0 within 3 seconds. `--json` prints the same as JSON. The kit plugin's `hooks.json` gains a `SessionStart` hook that runs it, and the help entries gain `omni constituents` | `kit/bin/commands/constituents.mjs` `kit/bin/commands/index.mjs` `kit/bin/constituents.test.mjs` `kit/lib/constituents/` `kit/lib/help/entries.mjs` `kit/plugin/hooks/hooks.json` `kit/dist/omni.mjs` | s1 | 2 |
| s4 | Adds the Jev decision `constituent-break` and the App's judge route. A registry entry (question: does this spec break the Statement or a Never line, with the spec, the constituents and today's verdict as its state) registered in `index.ts`, shown on Settings › Jev with Off / Shadow / On like the other three. `POST /api/constituents/judge`, signed by the App with HMAC over the body under `CONSTITUENT_JUDGE_SECRET` (as stage events are), runs the resolver for the repository's workspace and returns `{answer, confidence, decidedBy}`; an unsigned or wrongly signed call is refused | `apps/galaxy/src/jev/decisions/` `apps/galaxy/app/api/constituents/judge/` | s1 | 2 |
| s5 | The canon gate judges constituents. The gate reads the repository's constituents through s1's service-role read beside the claims and personas, and judges the Statement and the Never lines. Off: today's Haiku verdict. Shadow: Haiku decides and the judge route logs Jev's. On: Jev's verdict when at or above the floor, otherwise Haiku's. A finding is kept only with a word-for-word quote and a live `never#<n>` or the Statement. The cache key gains the latest constituent event id. A red check names the quote and the constituent, with Rewrite and "Change the line" (linking `#never-<n>` on Settings › Business). Neutral, never red, on a judge or Jev failure | `apps/omni-app/src/canon/` `apps/omni-app/src/inbox-check/` `apps/omni-app/README.md` | s1, s4 | 3 |

**Shared ground.**
- **The database:** every schema change (both tables, the functions, the move, the claim kinds, the
  service-role read and the widened `jev_decision_names()`) lands in s1's single migration; no later
  slice touches `supabase/`. The migration's date is checked against the latest one on `main` before
  the feature PR merges (the lesson of #771).
- **`supabase/checks/business.sql`:** s1 only, for `claim_pick` refusing `never`.
- **`apps/galaxy/app/api/constituents/`:** s1 owns `route.ts` only; s4 owns `judge/` beside it, so
  their prefixes do not meet and both s2 to s4 run in wave 2.
- **`apps/galaxy/src/constituents/`:** s1 writes the model and store; s2 and s4 import them and never
  change them.
- **`kit/dist/omni.mjs`:** s3 only, rebuilt with `pnpm kit:build`.
- **`apps/omni-app/src/inbox-check/`:** s5 only.
- Every slice runs `FALLOW_AUDIT_BASE=origin/main pnpm fallow:audit` before it is marked ready.

## Per slice: done when

**s1**
- `supabase/checks/constituents.sql` passes: an owner adds, edits and removes; a member and an
  outsider are refused; each write leaves exactly one event with its before and after; a removed line
  keeps its row and id, and the next line gets a new id.
- The move turns each confirmed `never` claim into a Never line with a `moved` event and leaves the
  claim `rejected`; `claim_pick` with kind `never` is refused (`supabase/checks/business.sql`).
- `constituent-break` is accepted by `jev_decision_names()`.
- `GET /api/constituents?repo=` answers the Statement, the Never list and the latest event id for a
  member's repository, 401 without a token and 403 outside the caller's workspaces (route tests with
  injected dependencies).

**s2**
- An owner adds a Statement and two Never lines, edits the Statement and removes `never#2`; the panel
  shows the result and the History drawer lists the events with their person, time, before and after
  (render and store tests).
- A member sees the panel and the History with no Edit, add or remove control.
- Typing "world-class components" shows the hint, and the line still saves.
- The claim editor no longer offers the Never kind; the draft and recheck never propose `never`.

**s3**
- Kit tests cover: fresh (prints, writes the cache), offline with a cache (prints it with its age),
  offline without one, no product, no sign-in, and a page slower than 3 seconds; each exits 0.
- `omni constituents --json` prints `{state, product, statement, never, syncedAt}`.
- `kit/plugin/hooks/hooks.json` holds the `SessionStart` hook; `omni help` lists the command.

**s4**
- The registry test lists `constituent-break` with its question and state schema.
- The judge route answers Off (no Jev call), Shadow (today's answer, Jev logged) and On (Jev's above
  the floor) with injected dependencies, and refuses a missing or wrong signature.

**s5**
- Canon tests cover Off, Shadow and On; a finding without a word-for-word quote or citing a removed
  line is dropped; a judge-route error or missing secret is neutral, never red; a new constituent
  event re-judges a cached spec.
- A spec quoting `fetch('/api/v1/projects')` against a Never line about real APIs gives a red check
  naming that quote and `never#1`, with Rewrite and "Change the line" linking `#never-1`.
