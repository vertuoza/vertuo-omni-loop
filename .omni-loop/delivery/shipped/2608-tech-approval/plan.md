# Plan: Tech Approval before the build

PRD #2608, its spec in `spec.md` beside this plan. The feature branch `feat/tech-approval` goes into `main` with `Closes #2608`, and the sub-PRs go from `feat/tech-approval--<slice>` into the feature branch with `Part of #2608`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The database holds a Tech Approval: its request, its two kinds, the product approval refused without it, a push voiding both, and a tech approval alone reading as no approval | `supabase/migrations/20270110090000_tech_approval.sql` `supabase/checks/tech_approval.sql` `supabase/database.types.ts` | — | 1 | deep |
| s2 | Approval email is on by default: a person with no row gets it, and a row with email off does not | `supabase/migrations/20270110100000_approval_email_default.sql` `supabase/checks/approval_requests.sql` `apps/galaxy/src/push/` | s1 | 2 | build |
| s3 | A PM can request a Tech Approval from the terminal, the named person is emailed, `omni wait approval` names who it waits on, the App's check stays red on a tech approval alone, and giving it asks the product's approvers | `apps/galaxy/src/approval/` `apps/galaxy/src/approvals/` `apps/galaxy/app/api/dossiers/approval/` `apps/galaxy/src/product-home/` `apps/galaxy/src/products/` `kit/lib/approval/` `kit/lib/now/wait` `kit/bin/commands/approval` | s1 | 2 | deep |
| s4 | On the PRD's page, the author requests a Tech Approval, the named person gives it, a product approver sees who it waits on, both seals show, and the request shows in the Waiting section | `apps/galaxy/src/dossier/` `apps/galaxy/src/waiting/` `apps/galaxy/app/api/waiting/approvals/` `apps/galaxy/src/nav/` | s3 | 3 | build |
| s5 | `/omni:tech-review <n>` grills the coding side with the named person, changes only the coding parts, records each settled question and gives no approval, and the guide and `omni help` describe it | `kit/plugin/skills/tech-review/` `kit/test/tech-review-skill.test.ts` `kit/lib/help/entries` `docs/guide/` | s3 | 3 | build |
| s6 | `/omni:brainstorm` asks about a Tech Approval last, after its plan is pushed, for a ◆ PRD only | `kit/plugin/skills/brainstorm/` `kit/porting/plugin--brainstorm.md` `kit/test/brainstorm-tech-approval.test.ts` | s3 | 3 | build |

**Shared ground.** No prefix is declared by two slices, so no wave separates any. Two things no territory shows: s1 and s2 both redefine `approval_recipients` in their own migrations, so s2 comes after s1 and starts from s1's version; and each migration stays the newest until it merges (conventions › A migration stays the newest), so a slice re-dates its file and its territory's name if `main` overtakes it, through `node scripts/migration-order.ts`. 

## Per slice: done when

### s1 (deep: one unfiltered read of the approval in force opens the build)

- `supabase/checks/tech_approval.sql` proves: only the author requests, never naming themselves; a non-member, a ◇ PRD, a product PRD and a roadmap are refused; a second request, a withdrawal and a rename by the author are refused; a workspace owner renames only once the named person left.
- The same check proves: only the named person gives it; the product approval is refused while it is missing or voided; a PRD with no request approves as today.
- The same check proves: a tech approval alone reads as no approval through `dossier_approval`; a push changing a pinned file voids both kinds; `approval_requests_waiting` shows a tech request until it is given, and again once voided.
- Every function reading the approvals table reads `product` unless it names `tech`, each one listed in the migration's header comment, and every existing row reads `product`.
- The migration's header names its rollback, as its neighbours do, and `dossier_approve(p_dossier)` still works for an older caller.

**s2** (`ui: yes`)
- `alert_channels.email` defaults to true, and a person with no row reads as on, in `approval_recipients` and on the profile's switch.
- A row already there is unchanged, and a row with email off gets no email: the check in `supabase/checks/approval_requests.sql` holds all three cases.

**s3** (deep: the wait and the stream must stay right for an older kit and an older page) (`ui: yes`)

- `omni approval tech request <n> --to <login>` requests it, and with no `--to` prints the workspace's members, one per line: tested through `main()` on a fixture repository.
- A refusal from the database reaches the terminal in its own words.
- The named person's message reaches them by the channels they have on, and names the page and `/omni:tech-review <n>`.
- `omni wait approval <n>` and `omni prd <n>` print `waiting for <login>'s tech approval` while it is missing, with the state `prd`.
- An older reply with no `tech` reads as today, and the `tech` field is read only where named.
- Giving the Tech Approval asks the product's approvers with nothing else run, and adds no approved label: only the product approval does.
- `apps/galaxy/src/approvals/judge.test.ts` proves `omni/approved` stays red on a tech approval alone.

**s4** (`ui: yes`)
- The author sees **Request a Tech Approval** with a member picker on a ◆ PRD not yet approved; nobody else does, and a ◇ PRD, a product PRD or a roadmap shows nothing new.
- Only the named person sees **Give Tech Approval**, with the changes since their last approval.
- A product approver sees the waiting line in place of **Approve** while it is missing.
- Two seals show once both approvals hold, tech first.
- The Waiting section and the bell list `Tech approval · PRD #<n>`, for the named person only.
- A PRD with no request renders as today, held by the page's view tests.

### s5

- `kit/plugin/skills/tech-review/SKILL.md` has the steps of the spec's section 6, and its refusals: no plan, no open request, not the named person, a merged sub-PR, `OMNI_UNATTENDED`.
- The skill's table says what the reviewer may and may not change, and hands product questions to the PRD's issue, naming the author.
- It records under `### Tech review` in the spec's **Decisions**, and it ends on the page's link, with no way to give the approval.
- `kit/test/tech-review-skill.test.ts` holds those lines, as `kit/test/rewind-skill.test.ts` does.
- `omni help tech-review` prints it, and `docs/guide/loop.md` explains the two approvals.
- It is not added to the runner's runnable skills.

### s6

- The question comes last, after the plan is pushed, and only when step 0 read `phase 0: server`.
- No, or no answer, changes nothing and the hand-off reads as today.
- Yes sends the request through `omni approval tech request`, and the hand-off names who it waits on and `/omni:tech-review <n>`.
- The proof video and e2e questions stay where they are.
- `kit/test/brainstorm-tech-approval.test.ts` holds it.
