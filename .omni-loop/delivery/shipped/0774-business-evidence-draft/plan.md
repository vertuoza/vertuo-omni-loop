# Plan: Drafted from evidence

PRD #774, spec beside this plan (`spec.md`). The feature branch `feat/business-evidence-draft` goes
into `main` through the feature PR (`Closes #774`). Each slice is a sub-PR from
`feat/business-evidence-draft--<slice>` into the feature branch (`Part of #774`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Covers the store and its read. One migration adds `business_sources` (at most three web pages), `claim_receipts`, `business_drafts`, `claims.replaces` and their RPCs (add or remove a source, start or finish a draft, propose an evidence claim with its receipts, That's us, settle a replacement, still-true, the count to check). It also makes `business_for_repo` return confirmed and contradicted claims with `state`, and `receipt` as the newest receipt. `supabase/checks/business.sql` proves it. `GET /api/business` and `omni business show --json` carry `state` per claim. `/omni:invade`'s hand-off names Settings › Business › Draft from my repos | `supabase/migrations/` `supabase/checks/business.sql` `apps/galaxy/src/business-api/` `apps/galaxy/app/api/business/route.ts` `kit/bin/commands/business.mjs` `kit/bin/business.test.mjs` `kit/test/fake-ask-server.mjs` `kit/lib/help/entries.mjs` `kit/dist/omni.mjs` `kit/plugin/skills/invade/` `kit/test/plugin.test.mjs` | — | 1 |
| s2 | Adds the draft, headless. `src/business/draft/` lists the sources (README, top-level `docs/*.md`, the ten latest shipped PRD specs with the kit layout, the pasted pages, twelve files per repository at most), reads them as the App and through the safe fetch, extracts candidates with the small model, keeps only word-for-word quotes, and merges them as decision 9 says. `POST /api/business/draft` runs one draft per business at a time, and `/api/business/sources` adds or removes a web page | `apps/galaxy/src/business/draft/` `apps/galaxy/app/api/business/draft/` `apps/galaxy/app/api/business/sources/` | s1 | 2 |
| s5 | Adds the Monday digest to the bell. Every member's bell shows one "Business · N to check" group, linking to Settings › Business, when proposed evidence claims, contradictions or faded claims wait; at zero it shows nothing | `apps/galaxy/src/waiting/` `apps/galaxy/app/api/waiting/` `apps/galaxy/src/data/viewer-reads.test.ts` | s1 | 2 |
| s3 | Adds the draft to the page. It adds Draft from my repos and + add a web page, and the scan of sources as read or skipped. The sentence types itself as "We think you sell …", with the Sources used line. Then come the What we found rows with receipt chips and ✓ Right / ✗ Wrong, the That's us dock, the thin-evidence state ("We found only N things") and the nothing-found state. It works at 393px and in demo mode | `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` `apps/galaxy/src/data/viewer-reads.test.ts` | s2 | 3 |
| s4 | Adds the weekly recheck and what it finds. `POST /api/business/recheck` is guarded by `BUSINESS_RECHECK_SECRET` and woken Sundays at 22:00 UTC by `.github/workflows/business-recheck.yml`. It reruns the draft for each business with a confirmed claim and skips a failing workspace. The page shows addition and replacement diffs (✓ / ✗ settle them) and faded claims (not quoted for eight weeks) with ✓ Still true / ✗ Wrong, on top | `apps/galaxy/app/api/business/recheck/` `.github/workflows/business-recheck.yml` `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` `apps/galaxy/src/data/viewer-reads.test.ts` | s2, s3 | 4 |

**Shared ground.**
- **`apps/galaxy/src/business/`** (with `draft/` under it) and **`apps/galaxy/app/app/settings/business/`:**
  s2 owns `draft/` in wave 2; s3 and s4 both edit the page view, its model and `render.test.ts`,
  so s4 waits for s3 (waves 3 and 4). s4 may extend the draft core's merge only for the recheck's
  run kind, after s2 and s3 have merged.
- **`apps/galaxy/src/data/viewer-reads.test.ts`:** s5, s3 and s4 may each add the tables their page
  reads (`business_drafts`, `claim_receipts`, the count to check). Waves 2, 3 and 4 keep them apart.
- **The database:** every table, column and RPC lands in s1's single migration, including those s2,
  s3, s4 and s5 call, so no later slice touches `supabase/`. The migration's date is checked
  against the latest one on `main` before the feature PR merges (the lesson of #771).
- **`kit/dist/omni.mjs`:** s1 only, rebuilt with `pnpm kit:build` because `kit/test/dist.test.mjs`
  fails on a stale bundle.
- s2 and s5 share no prefix: `apps/galaxy/src/business/draft/` and `apps/galaxy/src/waiting/` do
  not meet.

## Per slice: done when

**s1**
- `supabase/checks/business.sql` passes in CI and proves:
  - a fourth source is refused (`22023`);
  - a receipt appends and moves `last_seen`;
  - That's us confirms only the proposed rows not marked ✗;
  - a replacement's ✓ confirms the new claim and rejects the old, and ✗ does the reverse;
  - an evidence proposal of a rejected value adds nothing;
  - another workspace's member is refused (`42501`);
  - `business_for_repo` returns confirmed and contradicted claims with `state`, and never a
    proposed or rejected one.
- `GET /api/business`'s tests: each claim carries `state`; proposed and rejected never appear.
- `kit/bin/business.test.mjs`: `--json` gives each claim `state` against the fake server; every
  other state still exits 0.
- `kit/test/plugin.test.mjs` checks invade's hand-off line naming Settings › Business › Draft from
  my repos.

**s2**
- `verify` tests: a quote not in its source is dropped; whitespace and case differences pass.
- `merge` table test covers every row of spec decision 9, and a size snapped to the slider stops.
- `extract` with a stubbed fetch returns parsed candidates, and none on a failure or with the key
  unset.
- The URL guard refuses `http:`, private, loopback and link-local hosts and a redirect to one, and
  cuts a page over 1 MB.
- `sources` caps twelve files per repository and reads PRD specs only with the kit layout.
- The draft route, with fakes: a non-member is refused; a run writes `proposed` evidence claims with
  receipts and a `business_drafts` row; a second call while one runs returns the running one.

**s5**
- With N > 0 things to check, the bell's render shows "Business · N to check" linking to Settings ›
  Business, for any member; at zero no group shows.

**s3**
- Render tests: the scan (read and skipped sources), the typed "We think you sell …" headline and
  Sources used line, the What we found rows with receipts, the That's us dock, thin evidence ("We
  found only N things" beside the pick controls), nothing found ("Nothing we could quote — pick
  instead"), + add a web page refusing a fourth, 393px, demo mode.
- That's us confirms every row not marked ✗, and the page then shows the filled sentence.

**s4**
- The recheck route refuses a call without the secret; with it, a failing workspace is skipped and
  the others are rechecked; a business with no confirmed claim is skipped.
- Render tests: an addition diff ("Belgium → Belgium + France") and a replacement ("ERP → CRM") on
  top, each settled by ✓ / ✗; a claim with receipts unseen for eight weeks shows faded with its
  date and ✓ Still true clears it; a claim without receipts never fades.
- `.github/workflows/business-recheck.yml` runs on a Sunday 22:00 UTC schedule and on
  `workflow_dispatch`, calling the route with the secret.
