---
prd: 3001
title: QA checks a mission's PRD and hands its bugs to the Engineer
blocked-by: none
spec: file
phase0: server
---

## Problem

A mission's PRD reaches a person without anyone having used it. In
`apps/omni-app/src/missions/supervisor.ts` a run is `build → review:1 → fix:1 → review:2`: the
Engineer builds, the Reviewer reads the diff, and the PRD is marked ready. The Reviewer reads code;
nobody opens the preview and checks that each acceptance criterion holds, or tries what the
criteria do not name. A bug a person would see in the first minute is found by that person, after
the Reviewer's pass.

The QA seat exists (`kit/lib/virtual-fleet/roles.ts`, skills `prove`, `bug-fix`, `validate-e2e`),
but a mission never sends it anything: its row on the Heroes tab reads its skills and the limit
`It reports what it saw; a person decides.`, and the Operation room never shows a `QA · agent` row.

Beside it, the room cannot say what a job cost. Runners read each run's tokens from the agent
(`kit/lib/runner/agents/agent.ts`, `Usage`), but never send them: a person cannot tell what a QA
round, or any job, spent.

This is area `qa-seat-and-seats` of concept #2800. The concept let QA take the branch to fix a bug
itself; the person chose otherwise here: QA reports, the Engineer fixes, and the Engineer stays the
only writer (**Decisions**). The Seats tab keeps its name, Heroes (**Scope**).

## Solution

### 1. A QA pair before the Reviewer

A mission's run of one PRD becomes:

```
build → qa:1 → qa-fix:1:<k>… → qa:2 → review:1 → fix:1 → review:2 → ready
```

- After the build, the supervisor sends `/omni:qa <n>` under the key `…:run:<r>:qa:1`.
- QA's `pass` in round 1 sends the Reviewer's round 1 next: no `qa:2`.
- QA's `bugs` sends one Engineer job per bug, one at a time, in the verdict's order:
  `/omni:bug-fix #<issue> --base <the PRD's feature branch>`, under `…:qa-fix:1:<k>` (`<k>` from
  1 to at most 5). The next is sent once the previous one's fix has landed on the feature branch or
  is marked (section 4). One job writes the branch at a time.
- Once every bug of round 1 is landed or marked, the supervisor sends `/omni:qa <n> --round 2`
  under `…:qa:2`. Its `pass` sends the Reviewer's round 1.
- A bug still there after round 2 holds the PRD on **Decide the bugs** (section 4). There is no
  third round: `qa:3` has no key.
- Each key is unique, so a replay of a run sends each job once.
- A PRD of a plan repository (`/omni:ultra-yolo`) skips the QA pair, as it skips the Reviewer today.

### 2. `/omni:qa`: check the work, report the bugs

A new skill, `kit/plugin/skills/qa/SKILL.md`, of the QA seat, in `RUNNABLE_SKILLS`: a runner runs it
alone, and a person may run it on any PRD with a feature PR.

1. **The preview.** It reads the feature PR's preview the way `/omni:prove` does (`e2e.url`,
   `e2e.deployment`). While the preview is building it waits for it, with no time limit, as a limit
   wait does (PRD 2949), and the room says `Waiting for the preview`. A repository with no preview
   configured is checked on its `AC-<n>` tests only, and the verdict says so.
2. **The criteria.** For each `### AC-<n>` of the spec it checks the scenario: in a browser against
   the preview when a browser can show it (the clip `/omni:prove` records), else by running the
   `AC-<n>:` test the feature PR carries.
3. **The edges.** It then tries what the criteria do not name, inside the PRD's scope: empty and
   long input, a second click, a reload mid-way, a narrow window, a member without rights.
4. **The bugs.** Each bug it finds, at most five, the most serious first, is filed as a GitHub issue
   labelled `bug`, signed as an agent (L-AIACT-1), linking the PRD and its feature PR, with:
   numbered steps to reproduce on the preview, what was expected (the criterion, when one names
   it), what happened, and the preview's URL. A sixth bug is not filed: the verdict says
   `5 of <k> found filed`.
5. **The verdict.** It posts one comment on the feature PR, `QA · agent · round <r> of 2`, with the
   verdict and the bugs' links, then prints its last line:
   `omni qa: posted round <r> (pass|bugs, <k>) on PR #<pr>: <comment url>`, which the App reads
   from the job's log as it reads `omni review:` (PRD 2871).
6. **Round 2** checks the criteria again and each bug of round 1, by its steps; it files no new
   bug from the edges. A round-1 bug still there is reported again by its issue, not filed twice.

QA never commits, never pushes and never opens a pull request: it writes no branch.

### 3. The Engineer fixes each bug

The Engineer's job is `/omni:bug-fix #<issue> --base <feature branch>` (`--base` from PRD 2980):
its reproduction is QA's steps, proven red first, and its fix PR targets the PRD's feature branch.
The App lands it there once its checks are green, as it lands a repair's fix on the mission branch
(PRD 2980, `FixLanding`). Nothing reaches the default branch: only a person merges there
(N-PRODUCT-15).

### 4. When a fix cannot land, or a bug stays

- **A fix that cannot land** (its checks red, its PR closed or refused by GitHub) or **no fix**
  (`/omni:bug-fix` found its reproduction passing, or stopped at its boundary) is marked on that
  bug's line, `not fixed: <why>`, and the next bug is sent. QA's round 2 checks it again.
- **A bug still there after round 2** holds the PRD: `Waits for you · Decide the bugs`, listing
  each bug with its issue. A person picks one action: **Send on to the Reviewer** (the PRD goes on
  with the bugs open) or **Stop this PRD**.
- **A QA or fix job that fails** is repaired within PRD 2980's budget, as any failed step is
  (BR-PRODUCT-139, unchanged). A QA verdict line that cannot be read, or that names more than five
  bugs, ends the job `failed · verdict not read`.

### 5. A job's tokens

When a job ends, the runner sends the run's tokens beside its status: `{input, output, cacheRead,
cacheWrite}`, read from the agent's `Usage`, the shape `ask_rounds.tokens` already stores. The App
keeps them on the job (`runner_jobs.tokens`, null when the agent gave none). Every job row of the
Operation room ends with its count, `· 41k tokens`, or `· tokens unknown`.

### 6. The room and the Heroes tab

- **Operation room.** QA's now line reads `Checking PR <n> · round 1 of 2`, `Waiting for the preview`
  or `Idle`. A new mission event kind, `checked`, signed `QA · agent`, carries the verdict, the
  round and the bugs' issue numbers, as `reviewed` carries the Reviewer's. Its row:
  `QA · agent · 2 bugs found · Round 1 of 2 · #3012 #3013 · 41k tokens`, or
  `QA · agent · pass · Round 2 of 2 · 18k tokens`. The Engineer's fix rows read
  `Engineer · agent · fixed #3012 · PR #3015`, or `not fixed #3013: <why>`.
- **Heroes tab.** QA's skills become `qa`, `prove`, `bug-fix`, `validate-e2e`
  (`Runs 3 of 4 skills alone`), and its limits, after every hero's two:
  `It never writes the branch.`,
  `It reports bugs to the Engineer.`, `It reports five bugs at most.`, `It checks two rounds at most.` The old
  `It reports what it saw; a person decides.` goes. `virtual_hero_roles()` holds the same.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | migration | `20270125150000_qa_turn.sql` | conventions › A new migration takes the next free version (after `20270125140000_mission_repairs.sql`) |
| vertuoza/vertuo-omni-loop | column | `runner_jobs.tokens` (jsonb) | no written convention: follows `supabase/migrations/20260927090000_ask_context.sql:35` (`ask_rounds.tokens`, `{input, output, cacheRead, cacheWrite}`) |
| vertuoza/vertuo-omni-loop | event kind | `checked` | no written convention: follows `supabase/migrations/20270122122000_reviewer.sql:62` (`reviewed`, a seat's verdict as a past participle) |
| vertuoza/vertuo-omni-loop | job keys | `…:qa:1`, `…:qa-fix:1:<k>`, `…:qa:2` | no written convention: follows `apps/omni-app/src/missions/supervisor.ts:224` (`…:review:1`, `…:fix:1`) |
| vertuoza/vertuo-omni-loop | skill | `/omni:qa` | no written convention: follows `kit/plugin/skills/` (one verb or noun per folder, `review` for the Reviewer) |
| vertuoza/vertuo-omni-loop | record line | `omni qa: posted round …` | no written convention: follows `apps/omni-app/src/missions/supervisor.ts:285` (`omni review: posted round …`) |
| vertuoza/vertuo-omni-loop | kit module | `kit/lib/qa/verdict.ts` | no written convention: follows `kit/lib/repair/` (one folder per pure capability) |

## Decisions

- **QA before the Reviewer** (asked): build, then QA, then the Reviewer, so the Reviewer reads
  work that was checked.
- **QA reports, the Engineer fixes** (asked), over the concept's "QA takes the branch": the person
  wants each bug reported properly, with its steps, and fixed by the fleet's Engineer through
  `/omni:bug-fix`. The Engineer stays the one writer, which is also what persona:F-E Developer and
  persona:B-E DEv asked for in the concept's dissent; no branch hold is built.
- **QA checks again, two rounds at most** (asked), as the Reviewer does; a bug still there waits for
  a person.
- **A new skill, `/omni:qa`** (asked), over reusing `/omni:prove` alone: it checks the criteria
  and tries their edges, and hands back a typed verdict.
- **Heroes keeps its name** (asked): only QA's row changes. Renaming it Seats and letting a person
  hold a seat are out of scope.
- **The voice's objection, accepted.** persona:B-E DEv: "Each PRD now costs a QA job, up to five
  bug-fix jobs and a second QA job before the Reviewer even starts, so my runners are full twice as
  long. I want the QA pair skipped when QA 1 passes and to know what it cost." A pass in round 1
  skips round 2 (section 1), and every job row shows its tokens (section 5).
- **One fix job per bug, one at a time**, over one job for all: each bug has its own issue,
  reproduction and pull request, and a fix that cannot land holds no other.
- **Proof video:** no (asked).

## User stories

- As a person running a mission with the laptop closed, I find each PRD checked on its preview
  before the Reviewer read it, so the bugs I would have found in the first minute are already fixed.
- As a person, when a bug survives two rounds, I see it with its steps and decide in one action
  whether the PRD goes on or stops.
- As a B-E developer watching the runners, I see what each job spent in tokens, on its row.
- As anyone reading the Heroes tab, I see what QA does alone and what it never does.

## Scope

In:

- the QA pair in a mission's run (`qa:1`, `qa-fix:1:<k>`, `qa:2`) and its states;
- `/omni:qa` and its verdict (`kit/lib/qa/verdict.ts`), in `RUNNABLE_SKILLS`;
- the Engineer's `/omni:bug-fix --base <feature branch>` per bug, landed by the App;
- `Decide the bugs`, with its two actions;
- `runner_jobs.tokens`, sent at a job's end, and the token count on every room row;
- the `checked` event kind and the room's QA rows and now line;
- QA's skills and limits on the Heroes tab and in `virtual_hero_roles()`;
- the guide: `docs/guide/missions.md` says what QA does.

Out:

- renaming Heroes to Seats, and a person holding a seat;
- QA writing a branch, and any branch hold;
- `/omni:qa` sending fixes outside a mission: run by hand it only reports;
- QA on a plan repository's PRD (`/omni:ultra-yolo`);
- a cost budget or a cap in tokens: the count is shown, never enforced.

## Test seams

Every seam is a vitest test over pure code first, with no GitHub, no network and no clock
(`omni kb show testing`).

- `kit/lib/qa/verdict.ts`: the Zod schema of a verdict (`pass`, or `bugs` with 1 to 5, each with an
  issue number) and the parser of the `omni qa: posted round …` line; a sixth bug and an unreadable
  line are refused.
- `apps/omni-app/src/missions/supervisor.ts`: the steps `qa:1`, `qa-fix:1:<k>` and `qa:2`, through
  the existing fakes (`store.fake.ts`, `git.fake.ts`), as `supervisor.reviewer.test.ts` tests the
  Reviewer; a replay sends no key twice.
- `supabase/checks/`: `runner_jobs.tokens` takes only the four counts, `checked` needs a verdict and
  a round, and `virtual_hero_roles()` equals `roles.ts` (the arcade's `roles-sql.test.ts`).
- The runner's job end sends `Usage` as `tokens`, and `null` when the agent gave none.
- The room's and the Heroes tab's render tests.
- `kit/plugin/skills/qa/SKILL.md` passes the plugin's skill tests, and `qa` is in the runner's line
  parser.

## Risks

- **What merging publishes.** A new migration on the production database (one column, one event
  kind, a function's defaults), a new skill in the plugin, and the App sending QA jobs in every
  running mission at its next supervisor run. Rolled back by reverting the feature PR: the column is
  nullable and the event kind only added, so the old code reads the database as it is; a mission
  mid-QA then carries on from `review:1` at its next run.
- **More runner time per PRD.** Up to seven more jobs per PRD (two QA, five fixes). A pass in round
  1 costs one job; the token count makes the cost visible.
- **A flaky preview** may read as a bug. QA reports what it saw with its steps, and the Engineer's
  `/omni:bug-fix` proves it red before fixing; a bug it cannot reproduce ends `not fixed`, never a
  change.
- **The Legal entries.** L-AIACT-1: QA's issues and comments say an agent wrote them, signed as
  the Omni App. L-GDPR-1: bug issues are filed in the workspace's own repository, never elsewhere.
  L-GDPR-2: tokens are counts, never a credential; no log is copied into an issue. L-GDPR-4: a
  job's tokens are kept with the job, under its existing retention.
- **The locked laws.** N-PRODUCT-15: Only a person merges into the main branch. If broken,
  unreviewed work reaches every user; the App lands QA's fixes into the PRD's feature branch only,
  never `main`. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  N-PRODUCT-16: The game's ledger is only ever added to. If broken, history changes after the fact;
  `checked` events are only added, never rewritten. Changing it needs @pierrederval or @dervalp to
  approve the pull request on GitHub.
- **The rules.** BR-PRODUCT-139 is kept: a failed QA or fix job is repaired within the repair
  budget, as any step. BR-PRODUCT-74 is kept: `Decide the bugs` parks the PRD on a person and the
  mission keeps running.
- **The business laws.** BL-APPROVALS-1 (an approval covers exactly the files the approver read):
  kept, QA approves nothing and a fix on the feature branch changes no approved file of the PRD's
  folder. BL-ASK-1 (a person's answer is never changed): kept, QA's comments and verdicts are its
  own, signed as an agent, and `Decide the bugs` records the person's pick beside them.
- **The glossary's Bug fix** says "one pull request a person merges". In a mission, the App lands
  QA's fix PRs into the PRD's feature branch, as PRD 2980 lands a repair's fix into the mission
  branch; the feature PR that carries them into `main` is still merged by a person.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: a built PRD meets QA before the Reviewer
  Given a mission whose PRD's build job ended ready for review
  When the supervisor runs
  Then it sends "/omni:qa <n>" under the key "…:qa:1"
  And it sends no Reviewer job
```

### AC-2 · test

```gherkin
Scenario: a pass in round 1 goes straight to the Reviewer
  Given a PRD whose QA round 1 posted "pass"
  When the supervisor runs
  Then it sends the Reviewer's round 1
  And it sends no "qa:2" job
```

### AC-3 · test

```gherkin
Scenario: each bug is sent to the Engineer, one at a time
  Given a PRD whose QA round 1 posted "bugs, 2" with issues 12 and 13
  When the supervisor runs twice, the first fix landing between the runs
  Then the first run sends "/omni:bug-fix #12 --base <feature branch>" under "…:qa-fix:1:1" and nothing else
  And the second run sends "/omni:bug-fix #13 --base <feature branch>" under "…:qa-fix:1:2"
```

### AC-4 · test

```gherkin
Scenario: round 2 follows the last fix, and its pass sends the Reviewer
  Given a PRD whose two QA bugs are one landed and one marked not fixed
  When the supervisor runs
  Then it sends "/omni:qa <n> --round 2" under "…:qa:2"
  And once round 2 posted "pass" the next run sends the Reviewer's round 1
```

### AC-5 · test

```gherkin
Scenario: a bug still there after round 2 waits for a person
  Given a PRD whose QA round 2 posted "bugs, 1"
  When the supervisor runs
  Then the PRD reads "Waits for you · Decide the bugs" listing the bug's issue
  And nothing more is sent for it until a person picks "Send on to the Reviewer" or "Stop this PRD"
```

### AC-6 · test

```gherkin
Scenario: a verdict that cannot be read ends the job failed
  Given a QA job whose last line names six bugs, or no "omni qa:" line at all
  When the App reads the job's log
  Then the job ends "failed · verdict not read"
  And the repair budget handles it as any failed step
```

### AC-7 · test

```gherkin
Scenario: a replayed run sends nothing twice
  Given a run whose "qa:1", "qa-fix:1:1" and "qa:2" jobs were already sent
  When the supervisor runs again over the same state
  Then it sends none of them again
```

### AC-8 · test

```gherkin
Scenario: a job's tokens are kept when it ends
  Given a runner job whose agent reported 41000 input and 2000 output tokens
  When the runner ends the job
  Then the job keeps those counts in "tokens"
  And a job whose agent reported none keeps "tokens" empty and its row reads "tokens unknown"
```

### AC-9 · test

```gherkin
Scenario: the room shows QA's rows
  Given a mission with a "checked" event of round 1 with bugs 12 and 13, and its job's tokens
  When the Operation room is drawn
  Then a row reads "QA · agent · 2 bugs found · Round 1 of 2 · #12 #13 · 41k tokens"
```

### AC-10 · test

```gherkin
Scenario: the Heroes tab says what QA does and never does
  Given a virtual fleet with a QA hero
  When the Heroes tab is drawn
  Then QA's row reads "Runs 3 of 4 skills alone"
  And its limits include "It never writes the branch." and "It reports bugs to the Engineer."
```
