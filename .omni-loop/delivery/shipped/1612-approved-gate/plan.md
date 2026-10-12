# Plan: The omni/approved gate

PRD #1612. The spec is `spec.md`, beside this plan. The feature branch `feat/approved-gate` is cut
from `main`, and its feature PR (`Closes #1612`) targets `main`. Each slice is a sub-PR from
`feat/approved-gate--<slice>` into the feature branch (`Part of #1612`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The kit: one shared judge `judgeApproval` for the four states, `omni approval restore <n>`, and `ci.approvedContext` | `kit/lib/approval/` `kit/bin/commands/approval.ts` `kit/bin/approval.test.ts` `kit/lib/config.ts` `kit/lib/ci-approved-context.test.ts` `kit/lib/help/entries.ts` | — | 1 |
| s2 | Galaxy's side of the record: the App-signed `GET /api/approvals/judge`, and a void removes the approved label | `apps/galaxy/app/api/approvals/` `apps/galaxy/src/approval/` `apps/galaxy/src/approvals/` | — | 1 |
| s3 | The App: `approvedCheck` posts `omni/approved` on ◆ feature PRs and "Part of" target PRs, rerun on PR events and on the approved label added or removed | `apps/omni-app/src/approved-check/` `apps/omni-app/src/webhook/` `apps/omni-app/src/functions.ts` | s1, s2 | 2 |
| s4 | The Attestation page at `/prd/<id>/attestation?head=<sha>`, and its draft screen in the library | `apps/galaxy/app/prd/[id]/attestation/` `apps/galaxy/src/dossier/attestation/` `.omni-loop/knowledge/design/screens/attestation` | s1, s2 | 2 |
| s5 | The guide: the check, its states, the attestation, restore, and making the check required | `docs/guide/` | s3, s4 | 3 |

**Shared ground.** None between slices of one wave: s1 owns the kit, s2 galaxy's approval code, s3 the
App and s4 the new page. s4 reads the approval through galaxy's own approval code (s2's territory),
never editing it. `kit/lib/config.test.ts` and `kit/test/plugin.test.ts`, proofs of laws, are
touched by no slice: `ci.approvedContext`'s test goes in `kit/lib/ci-approved-context.test.ts`. The
generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by the wave, never listed.

## Per slice: done when

**s1 — the kit**
- `judgeApproval` returns `approved`, `waiting`, `drifted` (content or whitespace only) or `held` from
  fixtures, and `omni approval <n>` prints it through the same function.
- `omni approval restore <n>` writes each drifted file back from the pinned version's content, after
  checking it hashes to its sha256; prints one line per file; refuses a version whose content does not
  hash; never commits or pushes; says `approve again: <PRD page>` when a version cannot be read.
- `ci.approvedContext` defaults to `omni/approved`.
- `omni help approval` names `restore`.

**s2 — galaxy's record**
- `GET /api/approvals/judge?repo=&prd=` answers a request signed with `STAGE_EVENT_SECRET` with the
  approval in force (who, when, pinned files with sha256 and kind, voided or not, the PRD page link),
  and refuses an unsigned or wrongly signed one with 401.
- Voiding an approval removes `labels.approved` from the PRD's issue, as the App's installation.

**s3 — the App**
- `approvedCheck` posts one `omni/approved` check (or the name `ci.approvedContext` gives) on a ◆
  feature PR and on a PR whose body starts `Part of <owner/repo>#<n>`; none on a sub-PR, a ◇ PRD's
  PR or a PR naming no PRD.
- Each state gives its conclusion and title as the spec's table says; a drifted title ends with
  `omni approval restore <n>`; a 401 or timeout from galaxy reads held.
- Its Details link is `/prd/<id>/attestation?head=<sha>`.
- `issues.labeled` / `unlabeled` of the approved label rerun it on every open PR of the PRD; PR events
  rerun it on that PR; runs are debounced and go through the budget client.

**s4 — the Attestation page**
- `/prd/<id>/attestation?head=<sha>` renders, for each state, the seal, the approver and when, the
  policy line, each pinned file `=` / `≠` (both hashes) / `?`, the target PRs with their states, and
  on a drift `omni approval restore <n>` with Copy and Approve again for an approver.
- `.omni-loop/knowledge/design/screens/attestation.md` and `attestation.html` exist as a draft page
  screen, the app shell in its `reads`; `omni check design` is green.

**s5 — the guide**
- The guide's approval page explains the check, its four states, the attestation, `omni approval
  restore`, and how a repository makes `omni/approved` required; the galaxy docs tests stay green.
