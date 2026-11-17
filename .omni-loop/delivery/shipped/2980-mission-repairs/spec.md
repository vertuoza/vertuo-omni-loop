---
prd: 2980
title: A mission repairs a failed step, then stops and explains
blocked-by: none
spec: file
phase0: server
---

## Problem

A mission gives up on a PRD at its first real failure. In `apps/omni-app/src/missions/supervisor.ts`,
`outcome()` stops the PRD at once when its job ends `failed` (`its job failed: <reason>`), and after a
second hold or a second stop mid-way (`LAST_RUN = 2`). The PRD then reads stopped with the fixed hint
`Take it to ready by hand and the mission carries on.` (BR-PRODUCT-139). Nobody looks at why it
failed: no retro runs on a runner, no cause is named, nothing is tried, and the same cause can stop
the next PRD and the one after it the same way.

Three more gaps sit beside it:

- A failure caused by Omni Loop itself (the kit, a skill, the runner) is invisible to the people who
  could fix it: a mission runs in a customer's repository, and nothing reports it to the Omni Loop
  repository.
- Nothing stops a mission that keeps failing for a new reason every time: the only cap is per run.
- The stopped line says what to do by hand, never what was tried or what would fix it.

This is area `mission-retro-repair` of concept #2800, cut to the failure and repeat triggers. The
"no progress" and "milestone" triggers, rule changes as outbox items, and a mission team that picks
up the reported Omni Loop bugs are left to later PRDs (**Scope**).

## Solution

### 1. A failure sends a repair, not a stop

Where `outcome()` stops a PRD today (a `failed` job, a second hold, a second stop mid-way), the
supervisor sends a **repair** step when the budget allows (section 4): a runner job running
`/omni:repair --mission <m> --prd <n> --job <failed job>`, claimed first in line like a recovery job
(PRD 2949). The PRD reads `Repairing (1 of 3)`. A cancelled job still sends nothing: a person
stopped it.

### 2. `/omni:repair`: a retro, then one of four ways

A new skill, `kit/plugin/skills/repair/SKILL.md`, run on a runner, never by hand:

1. **The retro.** It reads why the step failed, on the runner: the failed job's log and saved work,
   the PRD's branch and its plan's step. It writes a retro checked by `RepairRetroSchema`
   (`kit/lib/repair/retro.ts`): the cause in one sentence, its class, where (a file, a command or a
   skill), the error's signature, the evidence as sentences (never a log excerpt), the proposed fix
   and the **fingerprint**.
2. **The fingerprint.** `fingerprint()` hashes the class, the place and the signature after
   normalising them: line numbers, hashes, times, temporary paths and numbers inside messages are
   dropped, so one cause gives one fingerprint whichever run met it.
3. **The way, by class:**
   - `code`: the work's own code is wrong. It follows `/omni:bug-fix` (`/omni:mega-bug-fix` when
     the PRD spans repositories) with `--base <mission branch>`; the retro is the bug fix's triage
     and its red reproduction the proof. The fix PR targets the mission branch.
   - `omni-loop`: the kit, a skill or the runner is wrong. The skill writes the scrubbed report
     (section 3) into its record line and fixes nothing. In the Omni Loop repository itself, this
     class is read as `code`.
   - `flake`: a timeout, a lost network or a busy service, with no change to make. Nothing is
     fixed; the step is sent once more.
   - `person`: only a person can decide (the bug fix's boundary was crossed, a product decision, a
     secret missing). The PRD stops with the question.
4. **The record line.** The skill's last output is one line,
   `omni repair: {"v":1,"mission":<m>,"prd":<n>,"fingerprint":"<hex>","class":"<class>","retro":{…},"fix":<pr|null>,"report":{…}|null}`,
   which the App reads from the job's log, as it reads `omni pm:` (PRD 2896).

### 3. An Omni Loop bug is reported, scrubbed

`scrub()` (`kit/lib/repair/scrub.ts`) builds the public report from fixed fields only: the kit
version, the command or skill, the error's class and its message with every path, repository name,
login, email, URL and token-shaped string removed, and the fingerprint. When anything that still
looks sensitive is left, it refuses and returns no report.

The App files the report on the Omni Loop repository (one App setting names it,
`vertuoza/vertuo-omni-loop` by default) as an issue labelled `bug`, signed as the Omni App: one issue
per fingerprint (`omni_bug_reports`), a repeat adding a `+1` comment with the kit version. The PRD
stops with `Waits on Omni Loop bug #<issue>`, linking it. A refused scrub files nothing: the PRD
stops and says why on the workspace's own pages only.

### 4. The budget: 3 per cause, 9 per mission

Each repair is a row of `mission_repairs`: the mission, the PRD, the fingerprint, its number for
that fingerprint (1 to 3), the retro, the fix PR and its outcome. The database refuses a 4th repair
of one fingerprint in a mission round and a 10th repair in a mission, so the cap holds even when
the supervisor is wrong.

- A failure whose fingerprint was repaired 3 times stops the PRD and explains (section 6).
- The 10th would-be repair of a mission stops that PRD the same way, saying the mission spent its 9.
- A repair whose fix landed and whose step then passes ends `fixed`; one whose step fails again
  ends `not fixed`, and the new failure is a new retro.
- A person's **Resume** of a stopped mission opens a new round: each fingerprint gets 3 again, and
  the mission's 9 stay counted. With the 9 spent, a failure stops its PRD as today.

### 5. A fix lands in the mission branch, then the step runs again

The App reads a `code` verdict's fix PR and lands it into the mission branch once its checks are
green, as it lands a PRD (PRD 2896). It then sends the failed step again: `/omni:yolo --base
<mission branch>` meets the mission branch first, so the PRD's branch carries the fix. A fix PR that
conflicts on the mission branch stops the PRD and names its files, as a landing does today. Nothing
reaches the default branch: only a person merges there (N-PRODUCT-15).

### 6. The room says it

Four new mission event kinds, each one sentence and one link, never a log: `repair-started`,
`retro`, `repair-ended` and `bug-reported`, each carrying its fingerprint's first 8 characters. The
Operation room and the mission page read two states from them:

- **Repairing:** `Repairing (2 of 3) · 7 left in this mission`, the cause in one sentence, the fix
  PR linked.
- **Stopped:** the cause, the repairs tried (each with its PR and outcome), the proposed fix, and
  how to resume (`Resume` gives each cause 3 more; `n of 9 left in this mission`), or the Omni Loop
  issue it waits on.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | migration | `20270125140000_mission_repairs.sql` | conventions › A new migration takes the next free version (after `20270125130000_runner_claim_recovery_first.sql`) |
| vertuoza/vertuo-omni-loop | table | `mission_repairs` | no written convention: follows `supabase/migrations/20270124110000_mission_joins.sql` (`mission_joins`, a mission's rows in a table named `mission_<things>`) |
| vertuoza/vertuo-omni-loop | table | `omni_bug_reports` | no written convention: follows `supabase/migrations/20270122093000_missions.sql` (plural snake_case nouns) |
| vertuoza/vertuo-omni-loop | event kinds | `repair-started`, `retro`, `repair-ended`, `bug-reported` | no written convention: follows `supabase/migrations/20270124150000_mission_pm.sql:37` (kebab-case verbs and nouns) |
| vertuoza/vertuo-omni-loop | skill | `/omni:repair` | no written convention: follows `kit/plugin/skills/` (one verb or noun per folder) |
| vertuoza/vertuo-omni-loop | record line | `omni repair: {…}` | no written convention: follows the `omni pm:` line of `kit/plugin/skills/brainstorm/SKILL.md` (**For a mission's PM**) |
| vertuoza/vertuo-omni-loop | kit module | `kit/lib/repair/` (`retro.ts`, `fingerprint.ts`, `scrub.ts`) | no written convention: follows `kit/lib/ready/` (one folder per pure capability) |

## Decisions

- **Scope: retro and repairs** (asked), on the failure and repeat triggers. "No progress",
  "milestone" and rule-change outbox items are left out.
- **3 repairs per cause** (asked), over the concept's 2: "let's not restrict ourselves".
- **A repair is a skill** (asked): `/omni:repair` finds the cause, writes it down, and starts a bug
  fix, or reports an Omni Loop bug on the public Omni Loop repository. The person's word was
  "post-mortem"; the glossary's term is **Retro** (not: post-mortem), so the spec says retro.
- **A mission team that fixes reported Omni Loop bugs** (asked) is its own PRD: it is a new seat
  with its own design, flagged and split out.
- **Scrubbed, sent alone** (asked): the report holds fixed fields only and goes out without a
  person, deduplicated by fingerprint; a scrub that cannot prove itself clean sends nothing.
- **The fix lands in the mission branch** (asked); the PRD's branch takes in the mission branch and
  the step runs again, so every PRD of the mission gets the fix.
- **The voice's objection, accepted.** persona:B-E DEv: "Three repairs per fingerprint, with no
  other cap, means a step that fails for a new reason every time starts bug fix after bug fix and
  never stops." The person set a cap of 9 repairs in a mission (section 4).
- **The cap lives in the database**, beside the supervisor's own count, so a supervisor bug cannot
  loop.
- **A lost repair spends nothing; a failed or unreadable one spends one**, so a repair can never
  fail for free and a runner's loss is never charged to the cause.
- **BR-PRODUCT-139 changes.** A mission sends a failed PRD again when a repair allows it; a PRD
  stops for good when its cause's 3 or the mission's 9 are spent, a cancel stopped it, or a
  repair's class is `person` or `omni-loop`. The rule's text is updated in the same change.
- **Proof video:** no (asked).

## User stories

- As a person who started a mission before going to sleep, I find in the morning that a PRD whose
  test broke at 02:00 was fixed by a bug fix into the mission branch and reached ready, and the room
  names the cause and the fix PR.
- As the same person, when a PRD failed three times for one cause, I read the cause, the three fixes
  tried and the proposed next one, and I resume it or take it by hand.
- As an Omni Loop maintainer, I get one issue per Omni Loop bug a mission met anywhere, with no
  customer's work in it, and a `+1` each time it comes back.
- As a back-end developer debugging a mission, each repair is a row with its fingerprint and job, and
  a mission never runs more than 9.

## Scope

In: the repair step and its budget in the supervisor; `/omni:repair`; `RepairRetroSchema`,
`fingerprint()` and `scrub()`; `mission_repairs` and `omni_bug_reports`; four event kinds; the App's
landing of a fix PR into the mission branch and its filing of the report; `/omni:bug-fix` taking
`--base <branch>`; the two room states; BR-PRODUCT-139's new text.

Out: the "no progress" and "milestone" triggers; rule changes proposed as outbox items; a seat or
mission team that fixes the reported Omni Loop bugs; a repair outside a mission (a terminal
`/omni:yolo` keeps stopping as it does); an alert when a repair starts.

## Test seams

Follows `omni kb show testing`: pure functions first, the supervisor on its fake store and fake
runners, the database through `supabase/checks/`, never GitHub or a model.

- `kit/lib/repair/*.test.ts`: the schema refuses a malformed retro; two wordings of one cause (line
  numbers, hashes, times, temporary paths) give one fingerprint, two causes two; `scrub()` removes
  each sensitive shape a fixture holds and refuses one it leaves.
- `apps/omni-app/src/missions/supervisor.test.ts`: `outcome()` sends a repair on a failure, a second
  hold and a second stop mid-way; it stops on a cancel, a spent cause, a spent mission, `person` and
  `omni-loop`.
- `apps/omni-app/src/missions/repair.test.ts` on fake runners: a failure → repair → fix landed →
  step again → ready; a cause failing 4 times stops; the 10th repair stops; a lost repair spends
  nothing; an unreadable record line spends one; Resume gives each cause 3 again and keeps the 9.
- The report filer is a port with a fake: one issue per fingerprint, a `+1` on a repeat, nothing
  filed on a refused scrub, a GitHub refusal retried by the ledger.
- `supabase/checks/mission_repairs.sql`, its own step in the `supabase` workflow: a 4th repair of
  one fingerprint in a round and a 10th in a mission are refused; members of another workspace read
  no row.
- `apps/galaxy/src/missions/room/*.test.ts`: the Repairing and Stopped words, the counts, the links.

## Risks

Merging publishes one migration (two tables, four event kinds), a skill, a supervisor change and an
App that files issues on a public repository. It is inert until a mission's job fails. Roll back by
setting the repair budget to 0 in the supervisor (a failure stops as today) and, if needed, a
follow-up migration dropping the two tables and the four kinds.

- **A public issue could leak a customer's work.** `scrub()` keeps fixed fields only and refuses
  what it cannot prove clean; its tests hold every sensitive shape the briefing names. A leak would
  break never#5, never#11 and never#12.
- **A repair can be slop.** A fix that loosens a test to pass is the risk the concept's F-E
  Developer named: the bug fix proves red before green, and the ready checks (PRD 2898) still refuse
  a loosened test before anything is marked ready.
- **A wrong fingerprint** either merges two causes (one stops early) or splits one (it runs up to the
  mission's 9): the 9 bound both.
- **The fix lands on the mission branch** without a person: a person still reviews it in the
  mission's pull request into the default branch.

The Legal entries it touches:

- L-AIACT-1 (content an agent makes says so): the public issue and its `+1` are signed as the Omni
  App, never as a person.
- L-GDPR-1 (only members read a workspace's personal data): the public report carries no login,
  email, answer or log; the retro rows are read by the workspace's members only.
- L-GDPR-2 (credentials never stored or logged in clear): the retro holds no log excerpt, and the
  scrub refuses a token-shaped string.

The locked laws the touched files carry (none changes):

- N-PRODUCT-15: unreviewed work could reach every user. A fix lands in the mission branch only.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. The repair reads only its own
  mission's repository. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16 and
  BR-PRODUCT-59 sit in the database files this change adds to and are kept. Changing any needs
  @pierrederval or @dervalp to approve the pull request on GitHub.

The rule it changes: BR-PRODUCT-139 (proposed), as **Decisions** says.

The business laws: none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: A failed step is repaired and reaches ready
  Given a running mission whose PRD's job ends failed on a broken test
  When the supervisor reads the end
  Then it sends a repair job first in line and the PRD reads Repairing (1 of 3)
  And once the repair's fix PR lands on the mission branch the step is sent again and reaches ready
```

### AC-2 · test

```gherkin
Scenario: One cause gives one fingerprint
  Given two failures of the same test at different lines, times and temporary paths
  When the retro fingerprints them
  Then both get the same fingerprint, and a failure of another test gets another
```

### AC-3 · test

```gherkin
Scenario: A cause repaired three times stops the PRD and explains
  Given a PRD whose cause was repaired 3 times in this round
  When its step fails a 4th time with that fingerprint
  Then no repair is sent and the PRD stops with the cause, the 3 fix PRs and their outcomes, the proposed fix and how to resume
```

### AC-4 · test

```gherkin
Scenario: A mission never runs a 10th repair
  Given a mission that has run 9 repairs across its PRDs
  When another step fails for a new cause
  Then no repair is sent, the PRD stops saying the mission spent its 9, and the database refuses a 10th repair row
```

### AC-5 · test

```gherkin
Scenario: An Omni Loop bug is reported once, scrubbed
  Given a repair whose retro reads class omni-loop with a message naming a path, a repository and a login
  When the App reads its record line
  Then it files one issue on the Omni Loop repository holding none of them, and the PRD stops with Waits on Omni Loop bug and its link
  And the same fingerprint met again adds a +1 comment, never a second issue
```

### AC-6 · test

```gherkin
Scenario: A report that cannot be proven clean is never sent
  Given a retro whose message still holds a token-shaped string after scrubbing
  When the App reads its record line
  Then no issue is filed and the PRD stops saying why on the workspace's pages only
```

### AC-7 · test

```gherkin
Scenario: A lost repair spends nothing, a failed one spends one
  Given a repair job whose runner goes silent, and another whose record line cannot be read
  When the supervisor reads both
  Then the lost one resumes and the count is unchanged, and the unreadable one counts as a repair ended not fixed
```

### AC-8 · test

```gherkin
Scenario: Resume opens a new round but keeps the mission's count
  Given a mission stopped because a cause was repaired 3 times, with 3 of its 9 spent
  When a person resumes it
  Then that cause may be repaired 3 more times and the room reads 6 left in this mission
```

### AC-9 · test

```gherkin
Scenario: A flake is retried, a person's decision stops
  Given one repair whose retro reads class flake and another whose retro reads class person
  When the supervisor reads them
  Then the first sends the step once more with no fix PR, and the second stops its PRD with the question
```

### AC-10 · test

```gherkin
Scenario: The room says what was tried
  Given a mission with one PRD repairing and one stopped after 3 repairs
  When a member opens the Operation room
  Then one row reads Repairing (2 of 3) · 7 left in this mission with its cause and fix PR, and the other reads Stopped with the cause, the repairs tried, the proposed fix and Resume
```
