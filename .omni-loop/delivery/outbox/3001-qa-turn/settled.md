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
