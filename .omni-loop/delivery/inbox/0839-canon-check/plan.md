# Plan: The canon check

PRD #839, spec beside this plan (`spec.md`). The feature branch `feat/canon-check` goes into `main`
through the feature PR (`Closes #839`). Each slice is a sub-PR from `feat/canon-check--<slice>` into
the feature branch (`Part of #839`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Covers Never lines in the store and the business read. One migration adds the `never` kind (a product's, at most 200 characters, picked `confirmed` or proposed as evidence) and a service-role read by repository returning that product's confirmed claims and personas only. `supabase/checks/business.sql` proves both. `GET /api/business` and `omni business show [--json]` carry `never` claims, printed as `never#<seq>` lines | `supabase/migrations/` `supabase/checks/business.sql` `apps/galaxy/src/business-api/` `kit/bin/commands/business.mjs` `kit/bin/business.test.mjs` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | Adds Never lines on Settings › Business. A Never lines list sits under the claims, with + Never line (typed, `confirmed` at once, 200 characters at most) and ✓ / ✗ on each line. Each line has an anchor `#never-<seq>` for the App's link. The draft and the weekly recheck propose a `never` claim with its receipt when a source says what the product does not do. It works at 393px and in demo mode | `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s1 | 2 |
| s3 | Adds the canon gate to the App's inbox check. `apps/omni-app/src/canon/` reads the PR's `spec.md` and the repository's business through s1's service-role read. It asks the small model (OpenRouter) for findings that quote the spec and cite claim ids, keeps only findings whose quote is word for word in the spec, and picks the persona it fits worst for one line. It caches by the spec's hash and the claims' latest update. The inbox check's verdict gains a fifth gate: red "canon ✗ N" with each break listed, green "canon ✓ · N claims read", or neutral with its reason (no business, no product claims, no key, a model error) | `apps/omni-app/src/canon/` `apps/omni-app/src/inbox-check/` `apps/omni-app/README.md` | s1 | 2 |
| s4 | Adds the two actions on a red canon check. The check run carries Rewrite for <persona> and Change the claim. The webhook handles both `requested_action`s: the first posts one comment with `/omni:brainstorm --rework <n>`, and the second posts one comment linking to Settings › Business `#never-<seq>` (or the claim's anchor). A second click edits the same comment | `apps/omni-app/src/webhook/` `apps/omni-app/src/inbox-check/` `apps/omni-app/api/` | s3 | 3 |

**Shared ground.**
- **`apps/omni-app/src/inbox-check/`:** s3 adds the gate and s4 adds the actions to the same check
  run, so s4 waits one wave behind s3.
- **The database:** the `never` kind and the service-role read both land in s1's single migration;
  no later slice touches `supabase/`. The migration's date is checked against the latest one on
  `main` before the feature PR merges (the lesson of #771).
- **`kit/dist/omni.mjs`:** s1 only, rebuilt with `pnpm kit:build`.
- **The claim anchor** `#never-<seq>` is written by s2 on the page and linked by s4; s4 builds the
  link from the claim id alone, so the two share no file.
- s2 and s3 share no prefix, so both run in wave 2.
- Every slice runs `FALLOW_AUDIT_BASE=origin/main pnpm fallow:audit` before it is marked ready.

## Per slice: done when

**s1**
- `supabase/checks/business.sql` proves:
  - a `never` pick is `confirmed`, a `never` evidence claim is `proposed`;
  - a `never` value over 200 characters is refused (`22023`);
  - the service-role read returns a repository's confirmed claims (with `never`) and personas, never
    a proposed or rejected claim, and nothing for an untracked repository.
- `GET /api/business` returns `never` claims; `kit/bin/business.test.mjs` checks the `never#<seq>`
  lines and `--json`.

**s2**
- Render tests: an empty Never lines list; adding one; ✓ / ✗; the `#never-<seq>` anchor; 393px;
  demo mode.
- The draft's merge test proposes a `never` claim with its receipt from a "we don't…" source.

**s3**
- `evaluateInbox` tests with a stubbed model and business:
  - green, "canon ✓ · N claims read";
  - red, "canon ✗ N", with the claim, the quoted spec line and one persona line;
  - a finding without a word-for-word quote dropped;
  - neutral for no business, no product claims, no key and a model error, each with its line;
  - a re-run with an unchanged spec and claims not calling the model.
- The four existing gates are unchanged.

**s4**
- A red canon check run carries the two actions; a green or neutral one carries none.
- Webhook tests: each `requested_action` posts one comment with the right text; a second click edits
  that comment; an action on a PR that is not phase-0 is ignored.
