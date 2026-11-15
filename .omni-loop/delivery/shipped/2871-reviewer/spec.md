---
prd: 2871
title: The Reviewer checks a PRD's branch before its PR goes ready
blocked-by: none
spec: file
phase0: server
---

## Problem

PRD 2842 gave a mission a Virtual Fleet of five heroes, but only the Engineer's word decides that a
PRD is done: `/omni:yolo` runs its gate, ships, and marks the feature PR ready. Nobody but the agent
that built the branch has looked at it when a person is asked to review it. The Reviewer hero exists
on the Heroes tab with no skill (`kit/lib/virtual-fleet/roles.ts`: "Its review skill is not built
yet.") and reads `A person does this today`.

Concept #2800 (the Fleet's Operation room, area `room-and-reviewer`) asks for the seat people pay for
first, because it guards a person's review time: a **Reviewer** that checks the Engineer's work
before it becomes the pull request a person reads, answering with a typed verdict, `pass` or at most
five findings, over at most two rounds, then a person decides. PRD 2842 split the area in two and left
the Reviewer for this PRD.

## Solution

### 1. `/omni:review <n>`, the Reviewer's skill

A new kit skill, `kit/plugin/skills/review/SKILL.md`, runnable on a runner with nobody at it, or by a
person in a terminal. It reviews PRD n's feature branch on its feature PR, **like a person does: one
GitHub review**, and writes no code.

**What it reads, in order:**

1. **The PRD:** the spec (its Acceptance criteria and Scope) and the plan (its slices' territories),
   from the PRD's folder.
2. **The repository's rules:** `omni kb laws --paths <changed files>`, the playbook forms `testing`,
   `conventions` and `architecture`, and the `review` form's new **`look-for`** section.
3. **The kit's default `look-for`**, which a repository extends in its own `look-for` section and
   never removes from. In order of harm:
   1. **Correctness:** the diff does what the spec says; edge cases, error paths, concurrency, data
      loss.
   2. **Security and data:** a secret, personal data, an authorisation check, injection, row-level
      security on a new table.
   3. **Tests that prove it:** every acceptance criterion has a test that would fail if the code
      broke; no test loosened, skipped or deleted to go green; no suppression added; no floor
      lowered.
   4. **Scope:** a file outside the plan's territories, or work the spec does not ask for.
   5. **Laws and conventions:** what a law, a rule or a playbook line says, cited by its id or its
      form and section.
   6. **Design and complexity:** duplicated code, needless generality, a misleading name; only as a
      defect, never as taste.

**How it reviews:**

- It reads the whole diff of the feature branch against `repo.defaultBranch`, and the code around
  it (callers, configuration, the existing handling of the same case), never the diff alone.
- It drafts its candidate findings, then **a verification pass**, a fresh subagent with the whole
  repository, tries to disprove each one; only a finding that survives is kept.
- It keeps **at most five**, the most severe first, and drops the rest: the Reviewer blocks a PR, so
  a finding must be worth fixing (precision over recall).
- It never comments on style a linter enforces or no rule names: the `review` form's push-back list
  is what the Engineer would answer it with.
- It runs on the deep tier (`tiers.<agent>.deep`), as the Reviewer hero records.

**A finding** holds: its file and line, a severity (`blocker`, `major`, `minor`), the rule it breaks
(a law or rule id, a playbook form and section, or `default › <item>`), what is wrong in one sentence
and what would fix it in one sentence. **A verdict** is `pass` (no finding) or `changes` (1 to 5
findings), with its round (1 or 2). Both are Zod-checked by `kit/lib/review/verdict.ts` before
anything is posted: a refused finding is fixed or dropped, and a review is never posted half-formed.

**What it posts:** one GitHub review on the feature PR, in `COMMENT` mode, never `APPROVE` or
`REQUEST_CHANGES` (approving is a person's), with one inline thread per finding on its file and line,
and a summary body that names the verdict and the round (`Round 1 of 2: 2 findings`) under a marker
the kit reads back (`<!-- omni-review: <round> <verdict> -->`). It is written by an agent and says
so. A review already posted for a round is not posted again.

**On `pass`:** when the PRD has shipped on its branch (`omni ship` committed) and its feature PR is a
draft with the outbox gate green, it runs `/omni:yolo`'s ready step itself: the `yolo.ready` flow
point's hooks, `gh pr ready`, then `/omni:pr`'s lifecycle until CI is green or stuck. Otherwise (a PR
already ready, or one not shipped) it posts the review and changes nothing else.

**Round 2** reads its round-1 threads and the Engineer's replies. A finding the Engineer fixed is
resolved; a finding pushed back with a reason from the `review` form is either resolved or kept, the
review saying why, once: the `review` form's "the reviewer keeps the last word, then a person" holds,
and there is no third argument. Round 2 raises a new finding only on lines changed since round 1.

### 2. A mission hands the PR to the Reviewer

Under a mission, the supervisor (`apps/omni-app/src/missions/supervisor.ts`) sends:

| step | job | its key |
| --- | --- | --- |
| build | `/omni:yolo <n> --for-review` (Engineer) | `mission:<id>:prd:<n>:run:<k>` (as today) |
| review, round r | `/omni:review <n>` (Reviewer) | `mission:<id>:prd:<n>:run:<k>:review:<r>` |
| fix after round 1 | `/omni:yolo-fix <n> --for-review` (Engineer), `/omni:ultra-yolo-fix` for a multi-repository PRD | `mission:<id>:prd:<n>:run:<k>:fix:1` |

- **`--for-review`** on `/omni:yolo` and `/omni:yolo-fix`: everything as today up to and including
  `omni ship`, then the feature PR stays a draft, and the job ends with the hand-off `review` (the PR
  waits for the Reviewer) in place of marking it ready.
- **`/omni:yolo-fix --for-review`** reads the Reviewer's open threads as well as the outbox replies,
  and judges each thread as `/omni:pr-care`'s **Review threads** does, against the `review` form:
  fix it, push back with a reason, or ask a person.

**Two new job ends**, the hand-off lines `kit/lib/runner/log.ts` reads, and a migration widening the
`runner_jobs.outcome` check:

| job end | the mission |
| --- | --- |
| `review` | sends `/omni:review <n>`, round 1 after a build, round 2 after a fix |
| `changes`, round 1 | sends the fix job |
| `changes`, round 2 | the PRD waits on a person: `decide the Reviewer's findings on PR #<pr>` |
| `ready` (the Reviewer's pass) | waits for a person to merge it, as today |

A Reviewer job that cannot finish (GitHub refuses the review, no diff, CI never settles) ends
`stopped` and follows the existing row: sent again once, then the PRD stops with why. Once the PRD
waits on a person after round 2, the PR turning ready, or the person's reply, wakes the mission, and
it never sends round 3.

**The ledger:** a new mission event kind `reviewed`, role `reviewer`, actor `agent`, linking the
review: `Changes asked: 2 findings, round 1/2.`, `Passed, round 2 of 2: marked ready.` Signed `Reviewer · agent` in the Operation room, like every agent row.

### 3. The Reviewer hero works alone

`kit/lib/virtual-fleet/roles.ts` and its SQL mirror (`virtual_hero_roles()`): the Reviewer's skills
become `['review']`, `review` joins the skills a runner runs with nobody at it, and its limits read:
`It never merges into the default branch.`, `It never answers for a person.`, `It never approves on
GitHub.`, `It marks ready on its pass only.`, `It raises five findings at most.`, `It reviews two rounds
at most.` Its `why not alone` line goes. A fleet made before this PRD gets its Reviewer hero's
skills and limits updated by the same migration, unless a person edited that hero.

### 4. Outside a mission, nothing changes

`/omni:yolo` and `/omni:yolo-fix` without `--for-review` mark ready as today. A person may run
`/omni:review <n>` on any feature PR at any time; on `pass` it marks ready only as section 1 says.

### 5. Reviewer joins the glossary

**Reviewer:** the agent seat that reviews a PRD's branch on its feature PR before it goes ready,
answering pass or at most five findings, over at most two rounds. Avoid: code-review bot. **Approver**
loses `reviewer` from its words to avoid and gains `PRD reviewer`.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | skill | `kit/plugin/skills/review/SKILL.md` (`/omni:review`) | no written convention: follows `kit/plugin/skills/tech-review/` |
| vertuo-omni-loop | kit | `kit/lib/review/verdict.ts`, `kit/lib/review/look-for.ts` | no written convention: follows `kit/lib/care/` |
| vertuo-omni-loop | kit | `review` form section `look-for` | form sections ← `kit/lib/playbook/forms.ts:80` |
| vertuo-omni-loop | kit | hand-off outcomes `review`, `changes` | outcomes ← `kit/lib/runner/api.ts:200` |
| vertuo-omni-loop | kit | flag `--for-review` | no written convention: follows `/omni:pr-care --once` |
| vertuo-omni-loop | db | `supabase/migrations/<next free version>_reviewer.sql` | conventions › A new migration takes the next free version |
| vertuo-omni-loop | db | mission event kind `reviewed` | event kinds ← `supabase/migrations/20270122093000_missions.sql:190` |
| vertuo-omni-loop | job | keys `…:review:<r>`, `…:fix:1` | `mission_key` ← `supabase/migrations/20270122093000_missions.sql:15` |

## Decisions

- **The Reviewer runs as its own runner job,** sent by the mission's supervisor (the person picked
  it over running it inside `/omni:yolo`): each verdict is its own job, with its own id on the ledger.
- **No finding: the Reviewer job marks the PR ready. Findings: the Engineer's `/omni:yolo-fix` (or
  `/omni:ultra-yolo-fix`) settles them** (the person's words).
- **The findings live on GitHub, as a person's review does,** inline threads on the feature PR (the
  person: "the same as a human, in a GitHub pull request"), never a file in the PRD's folder.
- **What it checks is a good default the repository extends:** the kit's built-in `look-for`,
  extended by the repository's playbook and rules (the person). The default follows Google's review
  guide (design, functionality, complexity, tests that would fail when the code breaks), and agentic
  review's measured lessons: a separate verification pass that tries to disprove each finding, and
  the whole repository as context, not the diff alone.
- **`COMMENT` mode only:** the Reviewer never approves or requests changes on GitHub, so a person's
  approval keeps its meaning, and the PR's author account can post it.
- **Outside a mission nothing changes** (the person): only a mission makes the Reviewer a gate; a
  person can run `/omni:review <n>` by hand.
- **Reviewer joins the glossary, and Approver gives the word up** (the person).
- **The glossary entry is written by a person,** through `/omni:knowledge-add` once this PRD is
  approved: an agent never writes the product's glossary on a runner (`OMNI_UNATTENDED`).
- **The voice.** persona:Paul - Product Manager objected: "Two more runner jobs and maybe a fix round
  per PRD: my quick wins now wait hours for an agent to grade an agent." Settled `none`: the person
  approved the design as is.
- **No proof video:** the person said no; the fake-fleet tests are the proof.

## User stories

- As the Lead Engineer, I open a ready PR a mission delivered and see a Reviewer's review on it,
  round 2 of 2, every finding fixed or answered.
- As the F-E Developer, I filter the Operation room to the Reviewer and read every verdict, each
  linking its review.
- As the B-E DEv, I find each finding on its line, with the law or playbook section it cites, and
  push back on one with a reason.
- As Paul, my mission's PRD reads `waits on you: decide the Reviewer's findings on PR #2817` only
  after two rounds failed to agree.

## Scope

In: `/omni:review` and its Zod verdict; the `review` form's `look-for` section and the kit default;
`--for-review` on `/omni:yolo` and `/omni:yolo-fix` (and `/omni:ultra-yolo-fix`); the `review` and
`changes` hand-offs and the outcome migration; the supervisor's review and fix hand-offs, the
`reviewed` event; the Reviewer hero's skill, limits and works-alone line; the glossary entry's text;
the tests.

Out: a review gate outside a mission; the QA, PM and Architect working alone; the five checks of
"ready for review" (area `ready-five-checks`); fleet-wide capacity; reviewing sub-PRs.

## Test seams

- `kit/lib/review/verdict.test.ts`: the schema (0 to 5 findings, each with its fields and a rule),
  the summary body and its marker, the same verdict rendering the same body.
- `kit/lib/review/look-for.test.ts`: the kit default, extended by a repository's section, never
  shortened.
- `kit/lib/runner/log.test.ts` and `kit/lib/runner/api.test.ts`: the `review` and `changes` hand-offs.
- `apps/omni-app/src/missions/supervisor.test.ts`: the hand-off table (review sends the Reviewer;
  changes in round 1 sends the fix; changes in round 2 waits on a person; a pass waits for the merge;
  a stopped Reviewer is sent again once).
- `apps/omni-app/src/missions/mission.e2e.test.ts`: one PRD passes in round 1, another goes changes,
  fix, pass, against the fake fleet; a replay inserts no job twice.
- `supabase/checks/missions.sql`: the outcome check takes `review` and `changes`, the event kind
  `reviewed`; `virtual-fleets/roles-sql.test.ts`: the Reviewer's defaults match the kit's.
- `kit/test/`: the skill text guards for `/omni:review` and the `--for-review` stop.
- No test calls a model or GitHub.

## Risks

- **What merging publishes:** a migration on production (the outcome check, the event kind, the
  Reviewer's defaults), the App's supervisor hand-offs, and the kit (`/omni:review`, `--for-review`,
  the `look-for` section). Missions then send Reviewer jobs, which post reviews on feature PRs.
  Rolled back by reverting the PR (missions then send `/omni:yolo` and mark ready as before) and a
  migration restoring the checks once no row uses the new values.
- **Noisy reviews waste a person's time:** at most five findings, a verification pass, no style, two
  rounds.
- **The Legal entries:** L-AIACT-1 (the review is signed as an agent's, and its ledger rows read
  `Reviewer · agent`); L-GDPR-2 (no credential or log excerpt in a review or an event); L-GDPR-4
  (`reviewed` events record decisions and are kept).
- **The locked laws:**
  - N-PRODUCT-15: if broken, unreviewed work reaches every user, and nobody chose to ship it. Kept:
    the Reviewer never merges; ready still waits for a person to merge. Changing it needs
    @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-5: if broken, a person could merge work whose open decisions nobody answered. Kept:
    the Reviewer marks ready only with the outbox gate green. Changing it needs @pierrederval or
    @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-12: if broken, the terminal acts on words the person no longer stands behind. Kept:
    the Reviewer reads replies and changes none. Changing it needs @pierrederval or @dervalp to
    approve the pull request on GitHub.
  - BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-63, BR-PRODUCT-64,
    N-PRODUCT-16: printed for the database layer; the design keeps each (no membership, ask session,
    AI key, agent link or game ledger row is read or written). Changing any needs @pierrederval or
    @dervalp to approve the pull request on GitHub.
  - Rule BR-PRODUCT-130 (`omni ship` reads review replies when a PR carries a review): from round 1
    on, the feature PR carries the Reviewer's review, so the fix job's `omni ship` judges its threads;
    the fix job settles each thread before it ships. Rule BR-PRODUCT-139 (a failed PRD is never sent
    again) holds for Reviewer jobs.
- **The business laws:** BL-APPROVALS-1 (an approval covers exactly the files the approver read;
  any later change voids it) is kept: the Reviewer changes no file of the PRD's folder and never
  gives a phase-0 approval; the PR's GitHub approval stays a person's. BL-ASK-1 (an answer a person
  gave is never changed or reworded) is kept: the Reviewer posts its own review, in its own name as
  an agent, and never edits, resolves on behalf of or rewords a person's comment or reply; round 2
  replies beside the Engineer's and a person's words, never over them.

## Acceptance criteria

- `/omni:review <n>` posts one GitHub review on PRD n's feature PR in `COMMENT` mode, with one inline
  thread per finding and a summary naming the verdict and the round; it never approves or requests
  changes, and writes no code.
- A review holds at most five findings, each with its file and line, severity, the rule it cites, what
  is wrong and what would fix it; a verdict the schema refuses is never posted.
- The repository's `look-for` section adds to the kit's default and never removes from it.
- On `pass`, with the PRD shipped, the PR a draft and the outbox gate green, the Reviewer job runs the
  `yolo.ready` hooks and marks the PR ready; otherwise it marks nothing.
- Under a mission, `/omni:yolo --for-review` ships and leaves the PR a draft, ending `review`; the
  mission then sends `/omni:review`; `changes` in round 1 sends `/omni:yolo-fix --for-review`, which
  settles each Reviewer thread (fix, push back or ask); round 2's `changes` makes the PRD wait on a
  person, and no round 3 is ever sent.
- Round 2 raises new findings only on lines changed since round 1.
- A replay or concurrent run of the mission sends each review and fix job once.
- The Operation room shows each verdict as a `Reviewer · agent` row linking its review.
- The Reviewer hero reads `Works alone`, with the skill `review` and its six limits.
- Without `--for-review`, `/omni:yolo` and `/omni:yolo-fix` mark ready as today.
- Every test runs on a fake fleet and fixtures, with no model call and no GitHub call.
