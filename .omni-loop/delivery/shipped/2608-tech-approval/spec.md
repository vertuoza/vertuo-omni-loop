---
prd: 2608
title: Tech Approval before the build
blocked-by: none
spec: file
phase0: server
areas: [approvals]
---

## Problem

A PM can finish a brainstorm and start a build without anyone technical having read the plan. Today's
approval is one stamp, given by a product's approvers, who are usually PMs. They judge whether the PRD
is the right thing to build. Nobody is asked whether the architecture, the data shape, the test seams
or the slices are sound, and the PM often cannot judge them: the harness is what holds them back.

## Solution

An optional second approval, a **Tech Approval**, asked for one PRD at a time, built by extending the
approval that exists.

### 1. The flow

1. `/omni:brainstorm` runs in full as it does today, the proof video and e2e questions included, and
   ends with its plan pushed. At the very end, only for a ◆ PRD, it asks the author: **Request a Tech
   Approval?** No changes nothing. Yes names one workspace member.
2. The named person sees the request in their **Waiting** section and gets an email, with the PRD's
   page and the line `/omni:tech-review <n>`.
3. They run `/omni:tech-review <n>`: an agent grills the coding side of the plan with them, and
   changes what they decide. Each change reaches the PRD's page as a new version.
4. They press **Give Tech Approval** on the PRD's page. Only a person can press it.
5. The product's approvers are asked, as today, and read the final version.
6. `/omni:yolo <n>` builds once both approvals hold.

The author may instead press **Request a Tech Approval** on the PRD's page, any time before the PRD is
approved. A PRD with no request runs exactly as it does today.

### 2. The rules

- **Who requests:** only the PRD's author (the rule of BR-PRODUCT-103), and never naming themselves.
- **Who approves:** only the named person.
- **It cannot be skipped.** Once requested, the request stays until the approval is given. Nobody can
  withdraw it. The author cannot change the named person. The one exception: when the named person
  has left the workspace, a workspace owner names another, so the PRD is not stuck for good.
- **Two approvals, tech first.** While a requested Tech Approval is not in force, `dossier_approve`
  refuses the product approval, in the database. So no gate needs to learn about it: `/omni:yolo`, the
  App's `omni/approved` check and an older kit all read "not approved yet".
- **A later change cancels both.** Any push that changes a pinned file voids every approval in force,
  of either kind. The named person approves again, then the product's approvers.
- **Nothing chases.** No reminder, no deadline, no reassigning: the Waiting section and the email are
  all it does.
- **Where it applies:** a ◆ PRD of one repository. A ◇ PRD (its phase 0 is a pull request), a product
  PRD (`<key>-<n>`) and a roadmap are refused and never offered it.

### 3. The record: one approval, two kinds

- `approvals` gains `approval_kind`, `product` or `tech`; every existing row reads `product`. A tech
  approval pins the same files as a product approval, and stays append-only.
- `approval_requests` gains `approval_kind` too. Its `kind` column already means `asked` or `re-asked`,
  so the new column cannot take that name. A tech request's `asked` holds the one named person.
- `dossier_request_tech_approval(p_dossier, p_login)` records the request, under the rules above. It
  also lets a workspace owner name another person once the named one has left.
- `dossier_approve(p_dossier, p_kind default 'product')` takes the kind. An older caller keeps getting
  a product approval, under the new refusal.
- **Every read of an approval in force reads `product` only,** unless it asks for `tech` by name. Today
  those reads take the latest row of a dossier, so an unfiltered read would take a tech approval for
  the product one and open the build. `dossier_approval`, the voiding in `dossier_push`, the
  waiting list, `approval_recipients`, the App's judge and the page's reads are each changed in this
  PRD, and a check in `supabase/checks/tech_approval.sql` proves a tech approval alone reads as no
  approval. `dossier_push` voids both kinds.
- The approval route's reply gains an optional `tech`: `{ login, state }`, `state` being `asked`,
  `approved` or `voided`. An older kit ignores it.

### 4. Waiting and alerts

- The tech request joins `approval_requests_waiting()`, labelled `tech approval`, for the named
  person, as long as no tech approval is in force. A voided one shows again.
- When the Tech Approval is given, the server asks the product's approvers by itself, with the existing
  request, so nobody has to run anything. The approved label is added on the product approval only.
- `omni wait approval <n>` prints `◌ PRD <n> · waiting for <login>'s tech approval` until then, and the
  page's Stage line says the same.
- **Email is on by default, for everyone.** `alert_channels.email` defaults to true, and a person with
  no row reads as on. A row already there is kept as it is, because the table cannot tell a person who
  chose off from a person who turned on phone alerts only. Phone alerts stay off by default.

### 5. The page

- **Request a Tech Approval** with a member picker, for the author, on a ◆ PRD not yet approved, under
  the head where the approve screen sits.
- **Give Tech Approval,** for the named person only, on the approve screen, with the changes since
  their last approval.
- While the Tech Approval is missing, a product approver sees the waiting line in place of **Approve**.
- Two seals once approved, tech first.

### 6. `/omni:tech-review <n>`, a new skill

It covers **coding only**. Product decisions stay the PM's.

| the reviewer may change | the reviewer may not change |
|---|---|
| the spec's **Conventions**, **Test seams** and **Risks**, and the technical side of **Solution** and **Decisions** | **Problem**, **User stories**, **Scope**, **Acceptance criteria** |
| the before/after page's **Technical** tab | its **Functional & design** tab |
| the plan: its slices, territories, blockers and waves | the `proof` and `e2e` front matter |

1. **Refuses, with one line,** when the PRD has no plan, no open tech request, a sub-PR already merged,
   when the person running it is not the named one, or under `OMNI_UNATTENDED`: a grill needs a person.
2. **Reads before it asks:** the spec, the plan, the Technical tab, the playbook's `architecture`,
   `testing`, `conventions` and `ci` forms, the laws its files touch, and the code. What the code
   answers is not asked.
3. **Shows the choices already made,** in one short list: architecture (approach, data shape, contracts,
   deploy order, risks) and harness (test seams, levels of test, slices and their order).
4. **Grills, one question at a time.** Each question comes with a recommended answer and why, and
   follows a decision to what depends on it. It asks only what the PRD leaves open or looks wrong, never
   the same thing twice, and stops when the reviewer says enough.
5. **Applies the answers** to the files in the table's left column, and grades the plan again with
   `omni plan check`. It records each settled question in the spec's **Decisions**, under
   `### Tech review`: the question, the answer, what changed and who answered it.
6. **Sends product questions back.** A question only the PM can settle becomes a comment on the PRD's
   issue naming the author. The skill changes nothing about it.
7. **Pushes, never approves.** A signed commit `docs(prd): tech review <topic>`, `omni check inbox`, the
   feature branch, `/omni:dossier-push <n>`, then the page's link. It has no way to give the approval.

The kit adds `omni approval tech request <n> --to <login>`. Without `--to` it prints the workspace's
members, one per line, for `/omni:brainstorm` to offer.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `approvals.approval_kind`, `approval_requests.approval_kind` | no written convention: follows `approval_requests.kind` ← supabase/migrations/20261125090000_approval_requests.sql:54, renamed because that column is taken |
| vertuo-omni-loop | db | `dossier_request_tech_approval` | no written convention: follows `dossier_approve` ← supabase/migrations/20261210100000_product_roadmaps.sql:416 |
| vertuo-omni-loop | db | `20270110090000_tech_approval.sql` | conventions › A new migration takes the next free version; re-dated if `main` overtakes it |
| vertuo-omni-loop | db | `supabase/checks/tech_approval.sql` | no written convention: follows supabase/checks/approval_requests.sql |
| vertuo-omni-loop | cli | `omni approval tech request` | no written convention: follows `omni approval restore` ← kit/bin/commands/approval.ts:9 |
| vertuo-omni-loop | ui | `RequestTechApproval.tsx`, `GiveTechApprovalButton.tsx` | no written convention: follows apps/galaxy/src/dossier/page/ApproveButton.tsx:12 |
| vertuo-omni-loop | kit | skill `/omni:tech-review` in `kit/plugin/skills/tech-review/SKILL.md` | no written convention: follows kit/plugin/skills/rewind/SKILL.md |

## Decisions

- **Optional per PRD, asked at the very end of the brainstorm.** The person's call: not a repository
  setting and not a new list of reviewers. It is asked last because a tech review must meet a brainstorm
  that is fully done.
- **One named person,** picked by the PM ("send it to someone else, for now"). No reviewers list. The
  requester cannot name themselves.
- **It cannot be skipped.** The person's call: no withdrawal, and no renaming by the author. The owner's
  renaming applies only to a person who left the workspace. An agent's addition, so that a departure
  cannot block a PRD for good: the most reversible option, and open to the person's answer.
- **The same approval, extended,** by the person's call, not a table of its own. The cost is that every
  read of "the approval in force" must filter by kind, which the check guards.
- **Tech first, then product,** by the person's call, so a tech change never cancels a product approval.
- **Coding only.** By the person's call, the reviewer cannot change product parts, nor the proof and e2e
  choices. This replaces an earlier draft of the design, where they could change anything and the change
  was flagged.
- **The review is recorded in the spec,** with no new file kind, so it is a plain file and pinned by the
  approval.
- **The objection and how it was settled.** `persona:Lead Engineer` objected that requests could sit
  unseen, with nothing telling the PM what the PRD waits on (`persona:Irisa` agreeing). Settled
  `accepted`, in part: a short grill, a waiting line naming who, the Waiting section and an email. The
  person refused the rest: "I am not here to manage agenda of tech people", so nothing chases and nothing
  reassigns.
- **Email on by default for everyone,** by the person's call, over emailing only the named person. Rows
  already there are kept.
- **No proof video for this PRD.** The question's answer was neither yes nor no, so `proof` is left out,
  which is the choice a later `/omni:prove` can still reverse.

## User stories

- As a PM, I finish my brainstorm and request a Tech Approval from one engineer, so somebody technical
  checks what I cannot judge.
- As that engineer, I get an email, find the PRD in my Waiting section, and run `/omni:tech-review <n>`.
- As that engineer, I change the data shape and the slices with the agent, and every change shows on the
  PRD's page.
- As that engineer, I press **Give Tech Approval** once I am satisfied.
- As a product approver, I am asked only once the Tech Approval is given, and I read the final version.
- As a PM, I see who my PRD waits on.
- As a PM who requests no Tech Approval, nothing changes for me.
- As someone building, `/omni:yolo` waits until both approvals hold.

## Scope

In: one repository's ◆ PRDs; the database change and its check; the approval route's `tech`; the App's
judge reading `product`; the page's buttons, line and seals; the Waiting section; the email default;
`omni approval tech request`, the waiting line; `/omni:brainstorm`'s last question; `/omni:tech-review`;
`omni help`, and the guide.

Out: ◇ PRDs, product PRDs and roadmaps; several reviewers; a reviewers list; reminders, deadlines or
reassigning; requesting from a runner; an agent giving the approval.

## Test seams

- **Database,** `supabase/checks/tech_approval.sql`: who may request, who may give it, the product
  approval refused while it is missing, a push voiding both kinds, a tech approval alone reading as no
  approval through `dossier_approval`, the waiting list per kind, and the owner's rename only after the
  named person left. A red check here is what guards the gate.
- **Email default:** the check in `supabase/checks/approval_requests.sql` for a person with no row, a row
  with email off, and a row with email on.
- **The App,** `apps/galaxy/src/approvals/judge.test.ts`: the `omni/approved` check stays red on a tech
  approval alone.
- **Route and page:** `apps/galaxy/src/approval/` with a stubbed client, and the page's view module, as
  `MainPane.test.ts` tests it.
- **The kit,** `kit/lib/approval/`: the waiting line, the `tech` field read and ignored by an older reply,
  and `omni approval tech request` through `main()` on a fixture repository, as `kit/bin/kb.test.ts` does.
- **The skill,** `kit/test/`: a smoke test reading `SKILL.md`, as `kit/test/bug-fix-smoke.test.ts` does,
  and one proving `/omni:brainstorm` asks last, after the plan.
- `pnpm mutation:changed` runs when a delivery-core file changes.

## Risks

**What merging publishes.** A merge applies the migration to production, deploys the arcade and the App,
and changes the kit and the plugin everyone installs.

**Rollback.** A follow-up migration restores `dossier_approve` and the reads, and drops the function and
the columns, refusing while a tech approval is in force. Until then, not using the feature changes
nothing: a PRD with no request has no tech row and reads as today. The email default rolls back apart:
restoring the default does not unsend anything.

**The gate could open.** The reads of "the approval in force" take a dossier's latest row. One read left
unfiltered would treat a tech approval as the product approval and let `/omni:yolo` build. The change
lists each read, and the check proves it. This is this PRD's largest risk.

**A PRD can wait for good** when the named person never acts. That is the person's decision, and it is
the point of the gate.

**Email volume rises** for people who never opted in, on every approval message. Each message is about a
request or a void they are part of, and the profile's switch still turns it off.

**The Legal entries it touches:**
- L-GDPR-1: the picker, the waiting line and the seals show logins, to members only.
- L-GDPR-3: a tech approval is a record of a decision, kept after the account is deleted, as an approval
  is today.
- L-GDPR-4: the rows are decision records, kept for good, as approvals are.
- L-GDPR-5: more email goes through Resend once the default is on, and that entry's list names Supabase,
  Vercel and Anthropic only. @pierrederval owns the entry, and should check whether Resend needs naming
  in it before this merges.
- L-AIACT-1: the `### Tech review` record and the issue comments are written by an agent, and signed as
  one, naming the person who answered.

**The locked laws it touches.** None is changed. `omni kb laws` prints them for the files listed:
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left could still read a team's work through an agent. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: players could no longer trust the scores they earned. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository, so each is held by ordinary tests.

1. A PRD with no Tech Approval request is approved and built exactly as today.
2. `/omni:brainstorm` asks about a Tech Approval last, after its plan is pushed, for a ◆ PRD only.
3. The PRD's author can request one, naming another member. The author cannot name themselves, and
   nobody else can request it.
4. A second request, a withdrawal and a rename by the author are refused. A workspace owner can name
   another person only once the named person has left the workspace.
5. The named person sees the request in Waiting and gets an email, unless they switched email off.
6. While the Tech Approval is missing, the product approval is refused and `omni approval <n>` reads
   `pending`, naming who it waits on. The `omni/approved` check stays red.
7. Only the named person can give it. Once given, the product's approvers are asked with nothing else run.
8. `/omni:yolo <n>` builds only when both approvals hold.
9. A push that changes a pinned file voids both approvals, and the named person is asked first again.
10. `/omni:tech-review <n>` refuses anyone but the named person, a PRD with no request, a PRD with a merged
    sub-PR, and a run under `OMNI_UNATTENDED`.
11. `/omni:tech-review <n>` changes only the coding parts listed in the spec, records each settled question
    under `### Tech review`, and gives no approval.
12. A person with no alert row gets approval emails; a row with email off gets none.
