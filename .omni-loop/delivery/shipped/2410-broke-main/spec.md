---
prd: 2410
title: Broke main, a shipped PRD's status on main and the rewind that finds why
blocked-by: none
spec: file
phase0: server
---

## Problem

The loop ends at the merge. Nothing says what a PRD did to `main` afterwards: whether its merge turned
a check red, whether one of its pull requests had to be reverted, whether a regression was traced back
to it. Today's retro (PRD 72) reads some of these facts at day 14, but it writes them as lessons in a
`retro.md`, never as a status of the PRD, and nobody can count them across PRDs. So a team cannot
answer the first question about its delivery, "how often do our PRDs break main?", and when one does,
nobody walks back through how it was built to find where the break started: in the repository, in the
Omni setup, or in knowledge nobody wrote down.

## Solution

Three parts, each with one job.

**1. The main watch (Omni App, server).** When a feature PR merges, the App opens a watch for the PRD
in every repository it merged into (a multi-repository PRD's targets included, as the retro reads
them). For seven days it records three signals:

- **CI red:** any job of any workflow run on the merge commit ending red, a red that a re-run turns
  green included. The parent commit's result is kept beside it as evidence.
- **Revert:** a commit pushed to the default branch that reverts the feature PR or one of its sub-PRs
  (GitHub's `Revert "<title>"` form, or `This reverts commit <sha>` naming a commit they merged).
- **Regression:** an issue opened within the seven days that names the PRD (`#<n>`), or whose
  `/omni:bug-fix` triage, or `labels.regression`, names one of the PRD's pull requests as the culprit.

The watch is a status, not a retro: `watching` (with the days left), then `clean` when seven days pass
with no signal, or `broke` the moment one lands. A PRD's status is the worst of its repositories'.
A signal GitHub would not let the App read keeps the watch `watching`, marked "could not check", past
its seven days: a missing read never reads clean.

**2. The rewind (`/omni:rewind <n>`, a runner job).** On the first break the App queues
`/omni:rewind <n>` once, sent by the app (as it queues `/omni:retro-apply`, PRD 2338). The skill
checks out the repository, reads the breaks with `omni rewind facts <n>`, and walks back from the
break to the spec, one check at a time:

1. the reviews: every review thread and comment on the feature PR and its sub-PRs, and why each was
   raised;
2. the CI: every red run on the slices and the feature PR, and the main break's own log;
3. the pull request bodies, against the repository's `pull-requests` form and its template;
4. the waves: the order slices were claimed and merged, against `plan.md`'s waves and blockers;
5. the plan: each slice's "done when" and territory, against its merged diff;
6. the spec and its answers: each acceptance criterion and each settled outbox answer, marked
   kept, drifted or broken;
7. the knowledge: `omni kb laws --paths` on the changed files, the glossary's words, the conventions.

It starts from the break and names the one cause the evidence points to; it writes the premise every
earlier fix assumed and tests it before naming a cause (pstack's attack-the-premise). Each finding
names **where it started**: `repository` (code, tests, CI), `omni-setup` (config, a skill, the kit) or
`knowledge` (a rule, law or word nobody wrote down), and **a fix**. A repository fix names the
strongest level that would have stopped the break, in this order: architecture, types, a lint, a test,
docs last (pstack's `/correct`). `omni rewind push <n>` sends the findings to the PRD's page. The
rewind writes nothing to the repository and never merges.

**3. On the Omni page.**

- **The PRD page** shows the status in its head: Watching · n days left, Clean, Broke main, or
  Could not check. A **Main** tab lists the breaks, each with its link, then the rewind's findings as
  **proposals**, each with **Approve** and **Reject**. No rewind yet, or a failed one, says so, with the
  `/omni:rewind <n>` line to run it from a terminal.
- **`/app/engineering`** shows, for its period, the share of PRDs shipped in it that broke main
  (`3 of 20 · 15%`), PRDs still watched counted apart, and the list of those that broke, each linking
  its page.

**What Approve does,** by where the finding started:

| origin | Approve |
|---|---|
| `repository` | queues `/omni:bug-fix '<the finding>'` on a runner of the workspace, sent by the member who approved |
| `knowledge`, a glossary term or a Legal entry | files it as a product knowledge proposal (`product_knowledge_propose`), for the kind's owner to decide |
| `knowledge`, the playbook or a register | queues `/omni:knowledge-add '<the finding>'` on a runner, sent by the member |
| `omni-setup` | opens an issue on the kit's repository holding exactly the text the card showed, which names no workspace code, repository or person; in this repository, the issue opens here |

**Reject** keeps the finding with an optional reason; a decision is never rewritten, and the same
finding (same check, origin and evidence) is never proposed again.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `prd_main_watch`, `prd_main_breaks`, `rewind_findings` | no written convention: follows `prd_stages` ← supabase/migrations/20261009090000_prd_stages.sql:17 |
| vertuo-omni-loop | db | `rewind_finding_approve`, `rewind_finding_reject` | no written convention: follows `product_knowledge_approve / _reject` ← supabase/migrations/20261212110000_product_knowledge.sql:27 |
| vertuo-omni-loop | job | `main-watch` (Inngest function) | no written convention: follows `retro` ← apps/omni-app/src/retro/retro.ts:243 |
| vertuo-omni-loop | cli | `omni rewind facts`, `omni rewind push` | no written convention: follows `omni retro outcome` ← kit/bin/commands/index.ts:72 |
| vertuo-omni-loop | skill | `/omni:rewind` | no written convention: follows `/omni:retro-apply` ← kit/plugin/skills/retro-apply/SKILL.md:1 |
| vertuo-omni-loop | config | `mainWatch.enabled` | no written convention: follows `retro.guards` ← kit/lib/config.ts:516 |
| vertuo-omni-loop | ui | `MainPane` (the Main tab) | no written convention: follows `RetroPane` ← apps/galaxy/src/dossier/page/RetroPane.tsx:9 |

## Decisions

- **Start from main, not from the lessons.** The person's words: "monitor the impact of the PRs in the
  main branches of all the PRs involved in a PRD; that is where we should start, for example the % of
  PRDs that broke main". The seven checks explain a break; they do not run on a clean PRD.
- **Broke main means** a red on the merge commit, a revert, or a traced regression (the person's pick).
  A production failure or an error spike does not count yet.
- **A flaky red counts** (the person's pick: "merge commit red, even flaky"). The parent commit's
  result is kept as evidence, so a reader sees when main was already red before the merge.
- **Seven days** of watch (the person's pick), not the retro's fourteen.
- **It is a status, not a retro** (the person's words). The existing retro (PRD 72) runs as today,
  unchanged; the watch is a function of its own beside it.
- **The rewind runs on a runner, queued by the app**, and only for a PRD that broke main; findings are
  proposals a person approves or rejects on the PRD page (the person's picks).
- **A regression is traced from what `/omni:bug-fix` already writes** (its triage's culprit, the
  regression label) or an issue naming the PRD, never guessed from overlapping lines. Assumed, not
  asked: reversible by widening the rule later.
- **An Omni-setup finding leaves the workspace only when a member approves it,** as the exact text the
  card showed, with no workspace code, repository or person in it (constituent never#5). The person's
  words: "in the PRD page as a proposal, with Approve and Reject".
- **Approve on a repository or knowledge finding queues a runner job sent by the member who
  approved:** the member chose to start it, so the job is theirs, never the app's.
- **The voice.** B-E DEv objected: "I already see this PRD's red runs on GitHub. Another status and a
  list of proposals to approve is more clicking, and it feels like fluff to me" (persona:B-E DEv).
  Settled **accepted**: the design already meets it, since proposals appear only for a PRD that broke
  main and each is one click, with nothing to fill in.
- **New words** (`Broke main`, `main watch`, `rewind`) are not in the product glossary yet; the
  first slice that shows them proposes them as glossary terms, for the glossary's owner to decide.

## User stories

- As a member of a workspace, I see on a shipped PRD's page whether it broke main, and what broke it,
  so I know which deliveries to look at.
- As a lead engineer, I see on `/app/engineering` the share of PRDs that broke main this period, so
  I can tell whether the loop is getting better.
- As a member, when a PRD broke main, I read where the break started and approve the fix I want, in
  one click, so the next PRD does not break the same way.
- As a member, I reject a proposal I disagree with, and it is never proposed to me again.

## Scope

In:

- the migration of the three tables and the approve/reject functions, with their row-level security
  checks in `supabase/checks`;
- the `main-watch` function in the Omni App, its GitHub reads, its daily close and its one queued
  rewind job;
- `omni rewind facts` and `omni rewind push`, and the `/omni:rewind` skill;
- the PRD page's status and Main tab, the approve and reject routes, and the Engineering board's share
  and list;
- `mainWatch.enabled` in the config, on by default.

Out:

- production signals (deploys, error tracking);
- rewinding a PRD that did not break main;
- changing the existing retro, `retro.md` or `/omni:retro-apply`;
- any score, point or ledger event from a break (constituent never#7).

## Test seams

The repository's testing form: tests beside the code, the narrowest level that proves the risk.

- **`main-watch`, against a stubbed GitHub**, as `apps/omni-app/src/retro/retro.test.ts` runs the
  retro: a red job on the merge commit → `broke`; a red that a re-run turned green → `broke`; a revert
  naming a sub-PR → `broke`; a regression opened on day eight → not counted; seven days with nothing →
  `clean`; a refused read → `watching`, could not check; a replayed event → no second row; a
  multi-repository PRD broken in one target → `broke`; the rewind job queued once.
- **The migration:** a persistence test with realistic rows, and the row-level security checks in
  `supabase/checks` (ADR-0028): members read, nobody signed in writes a table, approve and reject only
  through their functions, each writing its event in the same transaction, a decided finding refused a
  second decision, a non-member refused with 42501.
- **The kit:** `omni rewind facts` and `push` through `main()` on a fixture repository
  (`kit/test/fixture.ts`): `push` refuses a finding with no evidence link, an unknown origin, and a
  finding already proposed.
- **The skill:** its SKILL.md tested as `kit/test/retro-apply-skill.test.ts` tests retro-apply's: the
  seven checks in order, the origins, the strongest-level rule, and that it writes nothing to the
  repository and never merges.
- **The pages:** component tests for the status's four states, a proposal's Approve and Reject and
  what it shows once decided, and the Engineering share with none, some and every PRD broken.

## Risks

Merging publishes a new Inngest function on the Omni App, a migration on the production database and
new tabs on the Omni page. Rollback: `mainWatch.enabled: false` stops new watches and rewinds at once;
reverting the feature PR removes the code; a follow-up migration drops the three tables, which nothing
else reads. Already queued rewind jobs can be cancelled from the Runners page.

- **Blame.** The status names PRDs, never people, and feeds nothing in the game.
- **Noise from flaky checks.** A flaky red counts by choice; the parent's result shown beside it keeps
  the reader honest, and the choice can be narrowed later.
- **A finding that leaks.** An Omni-setup issue leaves the workspace only on a member's Approve, with
  the text they read.

The Legal entries it touches:

- L-AIACT-1, content an agent makes says so: every finding and every kit issue the rewind writes says
  it was written by an agent, and is signed as one.
- L-GDPR-1, only members read the personal data a workspace holds: the three tables are read by the
  workspace's members only.
- L-GDPR-2, secrets masked in every log excerpt: the CI excerpts a finding quotes go through the
  retro's masking.
- L-GDPR-3 and L-GDPR-4, decisions kept for good: who approved or rejected a proposal, and when, is
  kept; log excerpts are capped at the retro's `logTailLines`.

The locked laws it touches:

- BR-PRODUCT-63: an agent link reads only its own workspace's repositories. The rewind job is queued
  for the workspace the App's installation belongs to, and reads only its repositories. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: only a person merges into main. The rewind and the jobs Approve queues never merge.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: an answer never changes after it is given. An Approve or a Reject is never rewritten.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: the game's ledger is only added to. A break writes no ledger event. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-64: printed because the
  design touches the galaxy app and the migrations folder they govern; the design changes none of
  them (no account link, ask mode, session, AI key or agent link). Changing one needs @pierrederval or
  @dervalp to approve the pull request on GitHub.

## Acceptance criteria

- A PRD whose merge commit has a red job on main reads **Broke main** on its page within the time the
  App takes to receive the run, with the red job linked.
- A PRD with no signal for seven days after its merge reads **Clean**; until then it reads
  **Watching · n days left**.
- A PRD one of whose pull requests was reverted on main within the seven days reads **Broke main**,
  with the revert linked.
- A PRD named by a regression issue opened within the seven days reads **Broke main**; one opened on
  day eight changes nothing.
- A PRD whose reads GitHub refused reads **Could not check**, never Clean.
- `/app/engineering` shows, for the period, how many PRDs shipped in it broke main out of how many
  finished their watch, and the list of those that broke.
- A PRD that broke main gets exactly one `/omni:rewind` job, sent by the app.
- The rewind's findings appear on the PRD's Main tab, each naming its check, where it started, its
  evidence and its fix; a finding with no evidence link is refused by `omni rewind push`.
- Approving a repository finding queues `/omni:bug-fix` sent by the member who approved; approving an
  Omni-setup finding opens one issue holding the card's text; rejecting one keeps it, with its reason,
  and it is never proposed again.
- The rewind changes no file in the repository and merges nothing.
