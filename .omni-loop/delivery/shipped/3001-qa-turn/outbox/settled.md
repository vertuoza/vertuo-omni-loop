# Settled outbox items — PRD 3001

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-qa-line-carries-issues -->

## s1-01-qa-line-carries-issues — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-qa-line-carries-issues
prd: 3001
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

QA's last line says how many bugs it found, but the mission needs to know which bug reports to hand the Engineer. Where should those bug numbers come from?

## The decision, in plain words

QA's last line now lists the bug reports it filed after the count, so the mission reads which bugs to fix from the same line, without opening the comment on GitHub.

## The intro, for fun

Five bugs walk into a log line, and the mission asks for their names.

## The punchline, for fun

Now they sign the guest book on the way in.

## The options, in plain words

A. A. The line lists the bug report numbers right after the count, so one line carries the whole verdict.
B. B. The line stays as the spec quotes it; the mission reads the issues from QA's comment on GitHub.
C. C. The line stays as quoted, and QA prints a second JSON line holding the full verdict.

## What I had to decide

Keep the bug numbers in QA's line, or move them elsewhere before the skill and the mission are built.

## What I did meanwhile

The line reads `omni qa: posted round 1 (bugs, 2: #12 #13) on PR #7: <link>`; a pass reads as the spec wrote it. A bugs line without its numbers, or whose numbers do not match its count, reads as no verdict.

## What it costs to change later

A constant: the line's shape and its parser in one module, before any skill prints it or any mission reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec quotes the line as `(pass|bugs, <k>)` and does not say how the supervisor learns the issues it sends to `/omni:bug-fix` (author).

```

<!-- /omni-outbox-settled: s1-01-qa-line-carries-issues -->

<!-- omni-outbox-settled: s2-01-qa-skill-written-early -->

## s2-01-qa-skill-written-early — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-qa-skill-written-early
prd: 3001
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
excuses: [kit/plugin/skills/qa/SKILL.md, kit/lib/help/entries.ts, kit/lib/help/entries.test.ts, docs/guide/runners.md, .github/workflows/supabase.yml, apps/galaxy/src/runners/runners.skills.migration.test.ts, apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts]
---

## The question, in plain words

Letting runners take the new QA check before its instructions exist would leave the build red between the two waves, because the guide must only name checks that exist. Who should write those instructions first?

## The decision, in plain words

This first step wrote QA's instructions, its help line and the guide's mention itself, so every check stays green between the waves. The next step can rewrite those instructions freely.

## The intro, for fun

The plan said switch on the new tool first and deliver it later.

## The punchline, for fun

The guide refused to name a tool that did not exist, so we delivered it early.

## The options, in plain words

A. Keep it: s2 wrote the skill, its help entry and the guide's line, so every wave stays green; s3 refines them.
B. Undo it in s2: take qa off the runner lists and the database's fixed list until s3, which then needs a migration and the contract outside its own territory.
C. Merge s2 and s3 into one slice in the plan, so the switch and the skill land together.

## What I had to decide

Whether slice s2 keeps the /omni:qa skill, its help entry and the guide's mention it wrote outside its territory, or whether s3 alone writes them. The plan has s2 add qa to RUNNABLE_SKILLS (so the database's fixed list, roles.ts and the Heroes count change together) and s3 write kit/plugin/skills/qa/SKILL.md. But apps/galaxy/src/docs/guide.test.ts holds the Runners page's sentence equal to RUNNABLE_SKILLS and refuses an /omni:<name> with no plugin skill folder, and the skill folder needs a help entry (kit/lib/help/entries.ts) and the skills count (44 to 45). With qa runnable and no folder, the preflight is red and /omni:wave merges no red slice, so s3, s4 and s5 would never start. Outside the row's territory, s2 also changed: docs/guide/runners.md (the runner's lines), .github/workflows/supabase.yml (the step that runs supabase/checks/qa_turn.sql), apps/galaxy/src/runners/runners.skills.migration.test.ts and runners.ultra-skills.migration.test.ts (each names the newest list of the runners' fixed skills: qa added), kit/lib/help/entries.ts and entries.test.ts, and kit/plugin/skills/qa/SKILL.md (written from spec section 2: the preview, the criteria, the edges, five bugs at most with steps, expected, actual and the preview's URL, one comment, the record line).

## What I did meanwhile

The skill, its help entry and the guide's line stand as written; s3 still owns kit/plugin/skills/qa/ and refines the skill and adds its tests, and still sends the run's tokens from the runner.

## What it costs to change later

Rewriting or deleting one Markdown file, one help entry and one count; no data, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the skill's wording matches what s3's agent would have written from the plan (author)
- the skill has no test of its own yet: s3's done-when names the plugin's skill tests (author)

```

<!-- /omni-outbox-settled: s2-01-qa-skill-written-early -->

<!-- omni-outbox-settled: s2-02-job-end-tokens-null -->

## s2-02-job-end-tokens-null — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-job-end-tokens-null
prd: 3001
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

When a job ends and its report says nothing about what it spent, should we forget the count it reported earlier, or keep it?

## The decision, in plain words

We keep the last count when a report says nothing, as today. A job's final report can say outright that its agent gave no count, and then the job keeps none.

## The intro, for fun

A job that forgets to mention its bill should not get its earlier bill torn up.

## The punchline, for fun

Silence keeps the last receipt; only a clear none clears it.

## The options, in plain words

A. Keep the last count when a report says nothing; clear it only when the ending report says null.
B. Clear the count on every ending report that carries none, as the plan's words read, losing the transcript count runners send today.

## What I had to decide

How runners.service.ts stores a job report's tokens. The plan's s2 done-when says the job end takes an optional tokens and the service stores it, and null when absent (AC-8). But runners already send the job's transcript counts on every report (PRD 2102), and a test holds that a report without tokens keeps the last counts. Built: JobUpdateSchema takes tokens: null on a done, failed or cancelled report only (a running report with null is still refused); null is stored as null, a count is stored, and an absent field keeps what was stored. supabase/migrations/20270125160000_qa_turn.sql adds no column: runner_jobs.tokens exists since 20261212090000_runner_tokens.sql, so the migration only adds runner_jobs_tokens_shape, checked by ask_tokens_valid() as ask_rounds.tokens is. s3's runner then sends the agent's Usage on the ending report, or null when the agent gave none.

## What I did meanwhile

An absent tokens field keeps the last counts; null on an ending report clears them.

## What it costs to change later

One schema refinement and one line of the service; changing it is a constant, not a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a job's last transcript count should still show when the agent's own count is missing (author)

```

<!-- /omni-outbox-settled: s2-02-job-end-tokens-null -->

<!-- omni-outbox-settled: s2-03-qa-keys-and-checked-event -->

## s2-03-qa-keys-and-checked-event — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-qa-keys-and-checked-event
prd: 3001
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The QA rounds and the fixes between them need their own job names in the database, and QA's verdict needs a place to be written. Where should those live?

## The decision, in plain words

This step taught the database the new job names now, since it is the only step allowed to change the database. QA's verdict is written in the event's sentence, the way the Reviewer's verdict already is.

## The intro, for fun

The supervisor will soon send jobs with names the database has never heard of.

## The punchline, for fun

So the database learned the names before anyone said them.

## The options, in plain words

A. Widen the job key now, and keep QA's verdict in the event's sentence as the Reviewer's is.
B. Add round, verdict and issues columns to mission events, checked by the database, for QA's verdict alone.

## What I had to decide

Two choices in supabase/migrations/20270125160000_qa_turn.sql. First, runner_jobs_mission_key_shape now takes :qa:<1|2> and :qa-fix:1:<1-5> after a run's key: the plan gives the job keys to s4 (apps/omni-app/src/missions/), but only s2 adds a migration, and without it s4's inserts would be refused. Second, a `checked` event adds no column: its round, verdict and bugs' issues ride in its sentence and its link, as a `reviewed` event carries the Reviewer's, so the database does not refuse a `checked` event with no round; the spec's test seam asked that a checked event need a verdict and a round.

## What I did meanwhile

The keys are accepted by the database now; s4 builds them. A checked event's round and bugs are read from its sentence.

## What it costs to change later

Widening or narrowing one check constraint, or adding nullable columns later, in one follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5's room can read the round and the bugs' issues from the sentence as reliably as from columns (author)

```

<!-- /omni-outbox-settled: s2-03-qa-keys-and-checked-event -->

<!-- omni-outbox-settled: s4-01-bugs-pick-as-resumed-or-stopped -->

## s4-01-bugs-pick-as-resumed-or-stopped — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-bugs-pick-as-resumed-or-stopped
prd: 3001
slice: s4
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

When a bug survives QA's second check, a person picks between sending the work on to the reviewer and stopping it, and the database has no place made for that pick. Where should the pick be written so the mission can read it?

## The decision, in plain words

The pick is written as one more line in the mission's history, signed with the person's name: 'resumed' for the work, to send it on, or 'stopped' for it, to stop it, each naming QA's second check. The mission reads the first such line and acts on it.

## The intro, for fun

A person makes a call, and the database has no drawer to keep it in.

## The punchline, for fun

So it goes in the diary, signed, like every other call.

## The options, in plain words

A. Write the pick as a resumed or stopped row of the PRD, naming QA's second check and signed by the person.
B. Add a new kind of row for the pick, in a migration of its own, and read that instead.
C. Keep the pick on the mission itself, in a new column, and read it there.

## What I had to decide

How a person's pick on Decide the bugs is recorded, so that s4's supervisor reads it and s5's mission page writes it. Taken in apps/omni-app/src/missions/qa.ts (picksOf): a mission_events row of kind `resumed` (Send on to the Reviewer) or `stopped` (Stop this PRD), with prd set to the PRD, job_id set to QA's round-2 job, role supervisor and actor the person's login. The first such row for a job wins. The supervisor's own `stopped` rows name no job and the mission's own `resumed` rows name no PRD, so neither reads as a pick; repair.ts roundOf now opens a new repair round only on a `resumed` with no PRD. The person's `stopped` row also stands for the PRD's stop: its key `stopped:<prd>` keeps the supervisor from recording a second one. No migration: s2 was the only slice allowed one, and the kinds already exist.

## What I did meanwhile

Built and tested this way (qa.test.ts, qa.e2e.test.ts, with store.fake.ts's pickBugs recording the row as the page would). s5 writes the row with the service role as the page records a drop ask today.

## What it costs to change later

Reading the pick from another kind or a new column means one function (picksOf) and one test here, and the row s5 writes; a new kind would need a migration adding it to mission_events_kind_check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person would rather see a pick of its own name in the Operation room's history than a resume or a stop of the PRD
- (author) the PRD, the registers and the glossary do not say how a person's pick on a mission is stored

```

<!-- /omni-outbox-settled: s4-01-bugs-pick-as-resumed-or-stopped -->

<!-- omni-outbox-settled: s4-02-verdict-not-read-is-read-as-failed -->

## s4-02-verdict-not-read-is-read-as-failed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-verdict-not-read-is-read-as-failed
prd: 3001
slice: s4
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

When QA's job finishes without a result the mission can read, the plan says the job ends failed. Should the mission rewrite the job's own record, or only treat it as failed when it decides what comes next?

## The decision, in plain words

The mission only treats such a job as failed when it decides what comes next: it writes 'failed: verdict not read' in its history and sends a repair, and the job's own record keeps the ending its runner gave it.

## The intro, for fun

QA came back from its round with a note nobody could read.

## The punchline, for fun

The mission files it under failed, and leaves QA's own diary alone.

## The options, in plain words

A. Treat the job as failed only in the mission's reading and history; leave the job's own record as its runner gave it.
B. Also rewrite the job's own record to failed, with the reason, so every page shows it failed.

## What I had to decide

Spec section 4 and AC-6 say a QA job whose verdict line cannot be read, or names more than five bugs, ends `failed · verdict not read`. Taken in apps/omni-app/src/missions/qa.ts (withVerdicts), called by job.ts right after the store reads the runs: a QA job the runner reported done whose log tail reads no verdict of its own round is read, for that run, as failed with the reason `verdict not read`. The supervisor then sends a repair within PRD 2980's budget as for any failed step, and records `PRD <n>'s job failed: verdict not read.` signed qa. The runner_jobs row itself is not updated: it stays done as its runner reported it.

## What I did meanwhile

Built and tested this way (qa.test.ts AC-6, qa.e2e.test.ts AC-6). The repair job is sent with the QA job's id, and /omni:repair reads that job's log, which ends on no `omni qa:` line.

## What it costs to change later

Writing the failure on the job's own row later is one update in the store, as the service role, and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the Runners page and the Operation room should show such a job as failed rather than done; s5 draws the room's rows
- (author) whether /omni:repair reads a job its runner reported done as well as a failed one

```

<!-- /omni-outbox-settled: s4-02-verdict-not-read-is-read-as-failed -->

<!-- omni-outbox-settled: s4-03-draft-fix-is-not-fixed -->

## s4-03-draft-fix-is-not-fixed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-draft-fix-is-not-fixed
prd: 3001
slice: s4
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

When the engineer's fix for a bug is finished but its change is still left as a draft, should the mission wait for it or move on to the next bug?

## The decision, in plain words

The mission moves on: a fix still left as a draft once the engineer's job ended is marked 'not fixed', and QA's second check looks at that bug again.

## The intro, for fun

The engineer went home and left the fix half-wrapped on the desk.

## The punchline, for fun

QA will check the gift again on its second round.

## The options, in plain words

A. Mark a fix still left as a draft 'not fixed' and send the next bug.
B. Wait for the draft to be marked ready before moving on, as a repair's fix does.

## What I had to decide

Spec section 4 lists a fix that cannot land as red, closed or refused by GitHub, and says nothing of a draft. Taken in apps/omni-app/src/missions/qa.ts (judgeBugFix): a fix pull request still a draft when its /omni:bug-fix job ended is refused, `#<n> is still a draft`, and the bug is marked `not fixed: #<n> is still a draft`; the next bug goes. A repair's fix (repair.ts judgeFix) waits on a draft instead, but no job is left to mark a QA fix ready, so waiting would hold the PRD with nothing at work. Checks still running on a ready fix are waited for, as a repair's are.

## What I did meanwhile

Built and tested this way (qa.test.ts, 'a fix lands on the feature branch only').

## What it costs to change later

Waiting on a draft instead is one line in judgeBugFix and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether /omni:bug-fix sent with --base ever ends with its fix pull request still a draft

```

<!-- /omni-outbox-settled: s4-03-draft-fix-is-not-fixed -->

<!-- omni-outbox-settled: s5-01-bugs-route-outside-territory -->

## s5-01-bugs-route-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-bugs-route-outside-territory
prd: 3001
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

A person's pick on Decide the bugs needs a web address of its own to send it to, and the slice's territory holds no file for one. Is a five-line route file outside the territory acceptable?

## The decision, in plain words

The route file for the pick was added beside the existing start, pause, resume and level routes; all its logic stays inside the missions folder.

## The intro, for fun

The two buttons needed a door, and the plan forgot to build one.

## The punchline, for fun

It is the same door every sibling route already uses.

## The options, in plain words

A. A. Keep the route file where the other mission routes are.
B. B. Move the route under the missions folder and mount it from elsewhere in a later slice.

## What I had to decide

Build the route as the four sibling routes are built, calling pickBugs of the missions controller (apps/galaxy/app/api/missions/[id]/bugs/route.ts).

## What I did meanwhile

The route exists and is tested through the controller; nothing else outside the territory changed.

## What it costs to change later

Deleting one file and its call removes the pick.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the plan meant the route to belong to this slice's territory

```

<!-- /omni-outbox-settled: s5-01-bugs-route-outside-territory -->

<!-- omni-outbox-settled: s5-02-room-reads-qa-from-what-exists -->

## s5-02-room-reads-qa-from-what-exists — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-room-reads-qa-from-what-exists
prd: 3001
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

The room must say which pull request QA checks, whether it waits for the preview, and what a job spent, and the plan does not say where these come from. Are the choices made here right?

## The decision, in plain words

A job's tokens are its four counts added, shown as 41k tokens or tokens unknown. The pull request QA checks comes from the newest link of that PRD's events and the preview wait from the last log line of the running QA job.

## The intro, for fun

The room had to guess what QA was staring at.

## The punchline, for fun

It looked at the log and the old links, and guessed kindly.

## The options, in plain words

A. A. Keep these sources and the sum of all four counts.
B. B. Count input and output only.
C. C. Have QA's job record its PR and preview wait as parts, and read those.

## What I had to decide

Add the four counts as the Ask page does, read the PR from existing links, and read the preview wait from the log's last line, so no new column or event is needed.

## What I did meanwhile

The room shows these lines from data that already exists.

## What it costs to change later

Changing a word or a source is a small edit in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the spec means cache reads in a job's token total
- (author) whether QA should record the PR it checks so round 1 never falls back to the PRD number

```

<!-- /omni-outbox-settled: s5-02-room-reads-qa-from-what-exists -->

<!-- omni-outbox-settled: s2-04-rule-proof-tests-extended -->

## s2-04-rule-proof-tests-extended — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-17T18:37:24Z
- Channel: feature pull request #3002
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3002#issuecomment-6957354250
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-140
- Raised: 2026-11-17
- Slice: s2
- Wave: 1
- Stays here: the rules keep their meaning; the added test cases only cover the new skill, so nothing new is true about the product.

### The answer, as it was given

```text
A. Keep the added cases: each rule now covers qa as one of the loop's own skills.
```

### The item, as it was raised

```text
---
id: s2-04-rule-proof-tests-extended
prd: 3001
slice: s2
rank: high
bears-on: BR-PRODUCT-140
raised: 2026-11-17
wave: 1
---

## The question, in plain words

Three tests that prove existing product rules were extended so the new QA check is covered. Do these additions keep each rule meaning what it meant?

## The decision, in plain words

Each test gained cases for the new QA check and lost none: the rules read as before, now with QA among the loop's own checks.

## The intro, for fun

Three old guards were handed a new name to watch for.

## The punchline, for fun

None of them was asked to look away from anything.

## The options, in plain words

A. Keep the added cases: each rule now covers qa as one of the loop's own skills.
B. Move the qa cases into new test files, leaving the rule-proof files untouched.

## What I had to decide

Three files that enforce product rules changed, each by addition only. kit/lib/runner/line.test.ts (N-PRODUCT-19, a runner job for one of the loop's own skills never loads the repository's tool servers, and the runner refuses any other line) gains a case: /omni:qa 3001 and /omni:qa 3001 --round 2 run, and a repository's own /qa is refused as the loop's own skill. apps/galaxy/src/runners/runners.skills.migration.test.ts (BR-PRODUCT-140, a repository's Runner skills block never lists a folder named like one of the loop's own skills) adds qa to the skills that joined the fixed list after its migration, as repair was added. apps/galaxy/src/runners/runners.service.test.ts (BR-ACCESS-7, a runner's fresh-token refusals) gains two cases on a job's tokens and changes none of BR-ACCESS-7's. No case was removed or loosened. High by rule, not judgement: the plan asks a high item of any slice that changes a rule-proof test, and check coverage accounts a law-proof change only with a high item, so a person answers it. Jev was asked first and said not hard to revert (0.60).

## What I did meanwhile

The three files stand with their added cases; every earlier case is unchanged.

## What it costs to change later

Reverting a few test lines; no data and no behaviour depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the rules' owners want qa named in the rules' own text too (author)

```

<!-- /omni-outbox-settled: s2-04-rule-proof-tests-extended -->
