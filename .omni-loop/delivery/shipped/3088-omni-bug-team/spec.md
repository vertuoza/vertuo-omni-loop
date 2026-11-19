---
prd: 3088
title: A mission team fixes the Omni Loop bugs missions report
blocked-by: none
spec: file
phase0: server
---

## Problem

When a mission's repair finds that Omni Loop itself is wrong (the kit, a skill or the runner: class
`omni-loop`), the App files a scrubbed report as an issue labelled `bug` on the Omni Loop repository,
or adds a `+1` to the one already open (PRD 2980, `omni_bug_reports`, `scrub()` in
`kit/lib/repair/scrub.ts`). The PRD that met it stops with `Waits on Omni Loop bug #<issue>`.

Then nothing happens:

- Nobody picks those issues up. The most-reported bug waits as long as the least.
- Nothing reads whether the issue was closed or its fix released, so the PRD that waits on it stays
  stopped until a person notices and presses Resume on the whole mission.
- A mission's scope is always a list of PRDs, and it ends `delivered` once they are merged
  (`apps/omni-app/src/missions/supervisor.ts`, `conclude`): no mission can stand and watch a queue.

PRD 2980 left this out on purpose ("a mission team that picks up the reported Omni Loop bugs is its
own PRD"). This is that PRD.

## Solution

### 1. A standing mission: kind `omni-bugs`

`missions` gains `kind`: `prds`, today's mission and the default, or `omni-bugs`.

- An `omni-bugs` mission runs only on the Omni Loop repository: the one the App's setting names for
  bug reports (`OMNI_LOOP_REPOSITORY`, `vertuoza/vertuo-omni-loop` by default), in the workspace
  that holds it. Started on any other repository, the brief is refused: `Only the Omni Loop
  repository runs the Omni Loop bug team`.
- Its scope is empty. It never ends `delivered`: it runs, waits, pauses or stops like any mission,
  with the same Pause and Resume. At most one `omni-bugs` mission is running at a time.
- `/omni:mission --omni-bugs` writes its brief in one line: the goal `Fix the Omni Loop bugs missions
  report`, no measure, the default mandate, and the workspace's Virtual Fleet that has an Engineer
  (with several, it asks which one: its one question).

### 2. What it takes

At each wake, the supervisor of an `omni-bugs` mission reads the rows of `omni_bug_reports` and
takes, in order:

1. the bugs in state `open`, most-reported first (`count` descending), then the oldest;
2. skipping a bug whose issue is closed or already has an open pull request that closes it (a person
   is on it);
3. up to the mandate's `parallel` (1 to 4, 2 by default) bug fixes running at once.

Each bug taken becomes one runner job, `/omni:bug-fix #<issue>`, into the default branch, keyed
`mission:<mission id>:bug:<issue>:run:<k>`, sent to the fleet's runners. Its row turns `fixing` and
the room gets `bug-taken`. A person merges each pull request: nothing reaches the default branch
otherwise (N-PRODUCT-15).

Only bugs the App filed are taken (rows of `omni_bug_reports`), never an issue a person opened by
hand with the label `bug`.

### 3. Only the report

The job's only input is the public issue, which holds the scrubbed report (kit version, command,
class, message, fingerprint). The team never reads a mission of another workspace, its repository,
its logs or its retro. The link from a bug to the missions that met it is the fingerprint, read by
the service role only, in the App. The Omni Loop workspace sees how often a bug was reported (its
`count`), never who reported it.

### 4. A bug's state on the team's side

`omni_bug_reports` gains `state`, `attempts`, `fix_pr`, `fixed_in` and `asked_job`. The states:

| state | means | how it is reached |
|---|---|---|
| `open` | waits to be taken | filed (PRD 2980); an answer to its question that asks for another try |
| `fixing` | a bug-fix job runs | taken (section 2) |
| `pr-opened` | its fix pull request waits for a person's merge | the job ends `pr-opened` |
| `asked` | set aside, its one question waits for a person | the job ends `need-human`, `needs-brainstorm` or `not-a-bug`, or a 3rd attempt ends with no pull request |
| `merged` | its fix is on the default branch, not released yet | the fix pull request merged and closed the issue; the job ends `already-fixed` naming the pull request |
| `fixed` | released, `fixed_in` names the kit version | the release that holds the merge (section 5) |
| `wont-fix` | will not be fixed | the issue closed as not planned |

- **Attempts.** A job that ends `stuck` or `blocked`, or with no outcome the App can read, spends one
  attempt and puts the bug back `open`; the 3rd such ends it `asked`, with what was tried. A lost job
  resumes as any job does (PRD 2949) and spends none. The database refuses a 4th attempt.
- **The question, once.** An `asked` bug's question is the bug-fix job's own (`omni runner ask`,
  `kit/plugin/skills/bug-fix/SKILL.md`), shown in the Omni Loop workspace's bell and the team's room
  (`bug-asked`). The team moves on to the next bug and never asks that bug again. The person's answer
  resumes the bug fix (`/omni:bug-fix --answers <job>`, the bug back to `fixing`); closing the issue
  as not planned makes it `wont-fix`.
- **A fix pull request closed without merging** puts the bug back `open`, its attempt spent.

### 5. Fixed means released

- The fix pull request merges and closes its issue: the bug turns `merged`, `fix_pr` set.
- The release workflow cuts `v0.0.N` after each merge into the default branch. On that release, the
  App marks each `merged` bug whose merge commit the release's tag holds as `fixed`, `fixed_in =
  0.0.N`. A person who closes the issue as completed with no pull request: the next release sets
  `fixed_in`.
- An issue closed as not planned turns its bug `wont-fix`; a closed issue reopened turns it `open`.
- The App learns these from the `issues`, `pull_request` and `release` webhooks of the Omni Loop
  repository; a missed one is caught by a sweep at the team's next wake, which reads the issue's
  state and the latest release.

### 6. The missions that waited on it

The missions that met the bug are found by its fingerprint: their `mission_repairs` rows of class
`omni-loop` whose PRD stopped waiting on it (PRD 2980, `repair.ts`).

- **Fixed.** Each such mission gets one event, `bug-fixed`: `Omni Loop bug #<issue> is fixed in
  v0.0.N`. At its next wake, its supervisor reads the kit version its repository pins (the version
  `.omni-loop/bin/omni.mjs` carries on the mission branch, the one the runner compares with,
  `kit/lib/runner/plugin.ts`):
  - at `0.0.N` or later: the PRD's step is sent again, spending no repair, and the PRD reads
    `Resumed: Omni Loop bug #<issue> is fixed`;
  - older: the PRD reads `Fixed in v0.0.N: update the kit to resume (omni update)`, and resumes by
    itself at the first wake that reads a version new enough.
  - A mission that is paused or stopped waits for its own Resume, as today; the PRD then resumes by
    the same rule.
- **Won't fix.** One event: `Omni Loop bug #<issue> won't be fixed: take this PRD by hand`. The PRD
  stays stopped.
- **What the reporter sees.** A customer workspace sees its own rows, the public issue and the
  version, never the team's job, and never the other workspaces that met the bug.

### 7. The room

The team's Operation room shows one row per bug it holds: `#<issue> · reported 7× · fixing`, or
`PR #<m> waits for a merge`, `asked: <question>`, `fixed in v0.0.N`, `won't fix`. Its ledger reads the
three new event kinds, `bug-taken`, `bug-asked` and `bug-fixed`, each one sentence and one link.

### 8. The budget

Every team job carries the mission's id, so PRD 3040's two caps count it as they count any mission
job: the mission's budget over its whole life, and the fleet's `Tokens per day`. A standing mission
lives long, so its fleet's daily cap is the one that paces it; at a cap it pauses and asks once, as
PRD 3040 says.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | migration | `20270127100000_omni_bug_team.sql` | conventions › A migration stays the newest (after `20270126120000_mission_retro_skill.sql`) |
| vertuoza/vertuo-omni-loop | column | `missions.kind` (`prds`, `omni-bugs`) | no written convention: follows `supabase/migrations/20270122090000_virtual_fleets.sql:28` (`teams.kind`, a checked text column) |
| vertuoza/vertuo-omni-loop | columns | `omni_bug_reports.state`, `attempts`, `fix_pr`, `fixed_in`, `asked_job` | no written convention: follows `supabase/migrations/20270125140000_mission_repairs.sql:147` (snake_case, the table's own) |
| vertuoza/vertuo-omni-loop | job key | `mission:<id>:bug:<issue>:run:<k>` | no written convention: follows `supabase/migrations/20270126110000_mission_retros.sql:330` (`runner_jobs_mission_key_shape`) |
| vertuoza/vertuo-omni-loop | event kinds | `bug-taken`, `bug-asked`, `bug-fixed` | no written convention: follows `supabase/migrations/20270125140000_mission_repairs.sql` (`bug-reported`, kebab-case) |
| vertuoza/vertuo-omni-loop | App module | `apps/omni-app/src/missions/bug-team.ts` | no written convention: follows `apps/omni-app/src/missions/repair.ts` (one file per mission step, pure, its run beside it) |
| vertuoza/vertuo-omni-loop | skill flag | `/omni:mission --omni-bugs` | no written convention: follows `/omni:mission --prd <n>` (`kit/plugin/skills/mission/SKILL.md`) |

## Decisions

- **A standing mission** (asked), of a new kind `omni-bugs`, over a fleet setting with no mission or
  one mission per sweep: it reuses the supervisor, the budget, the room and Pause and Resume.
- **Fixed means released, and a holding PRD resumes by itself once its repository's kit is at the
  fix's version or later** (asked); older, it says to update the kit. It never re-runs on a kit that
  still holds the bug.
- **A bug the team cannot fix alone is set aside, asked once** (asked); the team moves on to the next
  bug, and the answer resumes it.
- **Up to the mandate's `parallel`** bug fixes at once (asked).
- **Only bugs the App filed** are taken, never an issue a person opened by hand: those have no
  fingerprint, no count and no mission waiting on them. Taken without asking; the most reversible
  choice.
- **A bug with an open fix pull request is skipped**: a person is on it. Taken without asking.
- **3 attempts per bug**, as PRD 2980 gives a cause 3 repairs. Taken without asking.
- **`not-a-bug` goes to a person** as a question rather than closing the issue: an agent never closes
  a report alone. Taken without asking.
- **The webhooks, with a sweep**: a missed event is caught at the team's next wake. Taken without
  asking.
- **The voice's objection, answered.** persona:F-E Developer: "A bot fixing the tool's own bugs from
  a three-line report, the most-reported first, will rush out a patch that hides the symptom, and a
  release ships it to every repository that runs Omni Loop." Settled `none`: the person approved the
  design as it stood, `/omni:bug-fix` already proves the bug red before it fixes, adds the guard
  that would have caught it, sends a bug it cannot reproduce from the report to a person, and only a
  person merges.
- **Proof video:** no (asked).

## User stories

- As an Omni Loop maintainer, I start one mission on the Omni Loop repository, and the bugs that
  customers' missions report come to me as bug-fix pull requests, the most-reported first, each
  proven red before it was fixed; I review and merge them.
- As the same maintainer, a bug the team could not reproduce reaches me once, as a question in my
  bell, and the team keeps working on the others.
- As a person whose mission stopped a PRD on an Omni Loop bug, I read in its room that the bug is
  fixed in v0.0.N, and once my repository's kit is updated the PRD carries on by itself.
- As a back-end developer, each team job counts toward the fleet's daily token cap, so the team
  cannot spend the night on one hard bug.

## Scope

In: `missions.kind` and the `omni-bugs` mission (its brief, its supervisor pick, its job key); the
bug states on `omni_bug_reports`; the App's reading of a bug-fix job's outcome, of the issue's
close, the fix pull request's merge and the release; the resume of a holding PRD by its repository's
pinned kit version; three event kinds; the team's room rows; `/omni:mission --omni-bugs`.

Out: issues a person opened by hand; fixing a bug in a customer's repository (the team fixes Omni
Loop only); updating a customer's kit (the PRD says how, a person runs it); a per-bug token cap;
ranking by anything but the count and age; more than one `omni-bugs` mission.

## Test seams

Follows `omni kb show testing`: pure functions first, the supervisor on its fake store and fake
runners, the webhooks on fake payloads, the database through `supabase/checks/`, never GitHub or a
model.

- `apps/omni-app/src/missions/bug-team.test.ts`: the pick (count, then age; the skipped states and
  open fix pull requests; the cap at `parallel`); each outcome word to its state; 3 attempts then
  `asked`; a lost job spends none; a question asked once only.
- `apps/omni-app/src/bug-reports/*.test.ts`: an issue closed by a merged pull request turns
  `merged`; a release whose tag holds the merge sets `fixed_in`; closed as not planned turns
  `wont-fix`; reopened turns `open`; the sweep catches a missed event.
- `apps/omni-app/src/missions/repair.test.ts`: a holding PRD resumes on a pinned kit at or after
  `fixed_in`, says to update the kit on an older one, resumes once it catches up, stays stopped on
  `wont-fix`, and spends no repair.
- `kit/lib/mission/brief.test.ts`: an `omni-bugs` brief with an empty scope reads; one on another
  repository is refused.
- `supabase/checks/omni_bug_team.sql`, a step in the `supabase` workflow: a second running
  `omni-bugs` mission, a 4th attempt and a malformed `bug:` job key are refused; a member of another
  workspace reads no row of `omni_bug_reports` nor the team's mission.
- `apps/galaxy/src/missions/room/*.test.ts`: the bug rows and the three event sentences.

## Risks

Merging publishes one migration (a column on `missions`, five on `omni_bug_reports`, the job key
shape, three event kinds), App code reading three more GitHub webhooks, and a skill flag. It is inert
until a person starts an `omni-bugs` mission. Roll back by stopping that mission; a follow-up
migration drops the columns and the kinds if needed. The App must be subscribed to the `issues` and
`release` events of the Omni Loop repository; until it is, the sweep alone moves the states.

- **A symptom patch reaches every repository.** The F-E Developer's objection (**Decisions**): red
  before green, a guard test, a person's merge, and a release only after that merge.
- **A leak across workspaces.** The team reads the public issue only; the fingerprint join runs in
  the App with the service role, and customer workspaces read only their own rows. A leak would
  break never#5 and P-PRODUCT-127.
- **A loop on one bug.** 3 attempts, held by the database, and the fleet's daily cap.
- **A resume on a kit that still holds the bug.** The pinned version is read before the step is sent
  again; a version that does not read counts as older.

The Legal entries it touches:

- L-AIACT-1 (content an agent makes says so): the fix pull requests and the room's events are
  signed as agents, as `/omni:bug-fix` and the App sign them today.
- L-GDPR-1 (only members read a workspace's personal data): the team's rows hold no login; a
  customer's mission rows stay readable by its members only.

The locked laws the touched files carry:

- N-PRODUCT-15: unreviewed work could reach every user. Each fix is a pull request into the default
  branch that only a person merges. Changing it needs @pierrederval or @dervalp to approve the pull
  request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. The team's job reads only the
  Omni Loop repository and the public issue. Changing it needs @pierrederval or @dervalp to approve
  the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16 and
  BR-PRODUCT-59 sit in the database files this change adds to and are kept. Changing any needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

The rules it keeps: BR-PRODUCT-163 and P-PRODUCT-127 (a public report never identifies a
workspace): the team writes nothing back to the issue beyond its pull request. BR-PRODUCT-139 (a
stopped PRD goes again only when a repair allows it) gains one more way back: a PRD stopped on an
Omni Loop bug goes again once its fix is released and the repository runs it; the rule's text is
updated in the same change.

The business laws: none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The most-reported bug is taken first
  Given a running omni-bugs mission with parallel 1 and two open bug reports counted 2 and 7
  When the supervisor wakes
  Then it sends one job /omni:bug-fix for the bug counted 7 and that bug reads fixing
```

### AC-2 · test

```gherkin
Scenario: A bug with an open fix pull request is left alone
  Given an open bug report whose issue already has an open pull request that closes it
  When the supervisor wakes
  Then it sends no job for that bug
```

### AC-3 · test

```gherkin
Scenario: A bug the team cannot reproduce is asked once and set aside
  Given a bug whose bug-fix job ends need-human with its question
  When the supervisor reads the end
  Then the bug reads asked, the question shows once in the workspace's bell, and the next wake takes another bug
  And no later wake asks about that bug again
```

### AC-4 · test

```gherkin
Scenario: Three attempts with no pull request set the bug aside
  Given a bug whose bug-fix job ended stuck twice
  When its third job ends stuck
  Then the bug reads asked with what was tried, and the database refuses a fourth attempt
```

### AC-5 · test

```gherkin
Scenario: A bug is fixed once the release holds its merge
  Given a bug whose fix pull request merged and closed its issue
  When the release v0.0.N whose tag holds the merge commit is published
  Then the bug reads fixed in v0.0.N
```

### AC-6 · test

```gherkin
Scenario: A waiting PRD resumes once its repository runs the fix
  Given a mission whose PRD stopped waiting on Omni Loop bug #N, and the bug fixed in v0.0.N
  When its supervisor wakes on a mission branch whose kit is v0.0.N or later
  Then the room reads Omni Loop bug #N is fixed in v0.0.N and the PRD's step is sent again, spending no repair
```

### AC-7 · test

```gherkin
Scenario: A waiting PRD on an older kit says to update it
  Given a mission whose PRD stopped waiting on a bug fixed in v0.0.N
  When its supervisor wakes on a mission branch whose kit is older than v0.0.N
  Then the PRD reads Fixed in v0.0.N: update the kit to resume, and nothing is sent
  And once the kit reads v0.0.N the next wake sends the step again
```

### AC-8 · test

```gherkin
Scenario: A bug closed as not planned tells the missions that waited on it
  Given a mission whose PRD stopped waiting on Omni Loop bug #N
  When the issue is closed as not planned
  Then the bug reads won't fix and the mission's room reads Omni Loop bug #N won't be fixed: take this PRD by hand
```

### AC-9 · test

```gherkin
Scenario: The team sees no workspace that reported a bug
  Given a bug reported by missions of two workspaces
  When the team's job and room read it
  Then they hold its issue and its count of 2, and no workspace, repository or login of either
  And a member of one workspace reads none of the other's mission rows
```

### AC-10 · test

```gherkin
Scenario: Only the Omni Loop repository runs the team, once
  Given a workspace with a running omni-bugs mission on the Omni Loop repository
  When a second omni-bugs mission starts, or one starts on another repository
  Then each is refused, naming why
```
