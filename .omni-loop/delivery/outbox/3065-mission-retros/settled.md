# Settled outbox items — PRD 3065

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-02-mission-retro-fixed-skill -->

## s2-02-mission-retro-fixed-skill — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-mission-retro-fixed-skill
prd: 3065
slice: s2
rank: medium
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

Should the database also list the new milestone retro skill among the loop's own skills, so that no repository can give one of its own skills the same name?

## The decision, in plain words

I left the database's list of the loop's own skills as it is. Adding the new skill there means changing tests and a list in the arcade that no slice of this plan owns, so it waits for a small follow-up.

## The intro, for fun

Two skills with the same name walk into a runner.

## The punchline, for fun

For now only one of them is allowed through the front door, and it is not ours.

## The options, in plain words

A. Leave the fixed list as it is in this PRD, and add the skill to it in a follow-up that also updates the arcade's list and its tests.
B. Widen this PRD's plan so a slice owns the arcade's runner list and its tests, and add the skill now.

## What I had to decide

The plan's s3 makes runners run /omni:mission-retro, but set_repository_runner_skill()'s fixed list, which refuses a repository's own skill named like a loop skill, was not extended: apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts pins the newest definition to 20270125160000_qa_turn.sql and its list to RUNNER_SKILLS (apps/galaxy/src/runners/runners.contract.ts), and apps/galaxy/src/virtual-fleets/roles-sql.test.ts pins virtual_hero_roles() the same way. Both files sit outside every slice's territory. If s3 adds mission-retro to a hero's skills in kit/lib/virtual-fleet/roles.ts, roles-sql.test.ts fails until a migration redefines virtual_hero_roles().

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

No migration redefines set_repository_runner_skill() or virtual_hero_roles(); runner_jobs never checks a job's skill against that list, so the supervisor can still send the job.

## What it costs to change later

Low: one follow-up migration redefines the two functions, with RUNNER_SKILLS and the two pinning tests updated in the same change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3 gives the skill to a hero role was not known when this slice was built.

```

<!-- /omni-outbox-settled: s2-02-mission-retro-fixed-skill -->

<!-- omni-outbox-settled: s4-01-stuck-line-names-short-jobs -->

## s4-01-stuck-line-names-short-jobs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-stuck-line-names-short-jobs
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

How should the supervisor name the five jobs a stuck repair reads, when a runner only takes a short line with no commas in it?

## The decision, in plain words

The supervisor names each of the five jobs by its first eight characters, separated by commas, as the PRD writes it. Five whole job names do not fit in the line a runner takes, and today's runners refuse a comma, so until the kit's line check takes one, a stuck repair is refused by the runner and spends one repair.

## The intro, for fun

Five long names walk into a line that only has room for four.

## The punchline, for fun

So each one gives its first name only, and the doorman still frowns at the commas.

## The options, in plain words

A. A. Name each job by its first 8 characters, separated by commas, and widen the runner line check to take a comma.
B. B. Name each job by its first 8 characters, separated by colons, which runners take today.
C. C. Name only the fifth job in full, and let the repair skill find the four jobs before it.

## What I had to decide

Pick how a stuck repair's line names its five jobs. A keeps the PRD's comma list and needs the kit's runner line check to take a comma (the mission-retro slice owns that check). B changes one constant in apps/omni-app/src/missions/stuck.ts so runners take the line today, and the repair skill splits on a colon. C names only the fifth job in full, and the skill reads the four before it from the mission.

## What I did meanwhile

Built A: `/omni:repair --mission <m> --stuck --jobs <j1>,<j2>,<j3>,<j4>,<j5>`, each job its first 8 characters, at most about 90 characters. The App keeps the fifth job's whole id as the repair's failed job by matching those 8 characters against the mission's jobs.

## What it costs to change later

Low: the line is one constant (stuckSkillLine in apps/omni-app/src/missions/stuck.ts) and its reader (stuckJobsOf). Changing it later changes no stored shape; stuck repairs already sent keep their line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the mission-retro slice (s3) widens the runner line check to take a comma, or parses the jobs another way, is not known here: it is built at the same time.
- (author) Whether the repair skill can read a job's log from its first 8 characters, rather than its whole id, is not known here.

```

<!-- /omni-outbox-settled: s4-01-stuck-line-names-short-jobs -->

<!-- omni-outbox-settled: s4-02-what-the-stuck-count-counts -->

## s4-02-what-the-stuck-count-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-what-the-stuck-count-counts
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

Which job ends count toward a stuck mission, and what does the supervisor do when a stuck repair ends and the mission has nothing else that can move?

## The decision, in plain words

Only the jobs that build, check or review a PRD count toward being stuck, never a committee, a planner, a repair or a retro. A mission with nothing able to move still stops as it does today, and a stuck repair counts as fixed once something moves after it.

## The intro, for fun

Counting sheep is easy until someone asks which animals are sheep.

## The punchline, for fun

We count only the ones that were supposed to be building something.

## The options, in plain words

A. A. Count only a PRD's step jobs, let a mission with nothing able to move stop, and settle a stuck repair by what happens next.
B. B. Count every job the mission sent, committees and PM jobs included.
C. C. Pause by stuck even when the mission would otherwise stop, so a person always gets the stuck question.

## What I had to decide

Confirm what the stuck count counts and how a stuck repair ends, or pick another reading. Each choice is a few lines of apps/omni-app/src/missions/stuck.ts (beatsOf, settleStuck) and stuck-run.ts.

## What I did meanwhile

Built A: a job end counts when it is a PRD's step job (build, QA, a QA fix, the Reviewer, the fix after it) and its last attempt ended; a lost or limited attempt carried by its resume does not. Moving is a PRD sent to a step further than any it reached, a ready, a join or a merge; a Resume of the mission, a stuck repair sent and a pause by stuck start the count again. The stuck count acts only while the mission runs or waits: one that would stop stops. A code stuck repair settles once its fix landed; a fix that cannot land ends it not fixed; an omni-loop one files its report and the mission goes on; only person, a spent cause or the spent 9 pause.

## What it costs to change later

Low: no stored shape depends on it. The count is read again from the mission's events on every run, so a different reading applies to running missions from the next run on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names retro jobs as counting nothing but does not say whether a committee, a PM or a care job does.
- (author) The kit's repair record line has no items field, so a change to a rule that a stuck repair proposes is not read into the mission's outbox; only a milestone retro's items are.

```

<!-- /omni-outbox-settled: s4-02-what-the-stuck-count-counts -->

<!-- omni-outbox-settled: s4-03-milestone-retros-run-and-shape -->

## s4-03-milestone-retros-run-and-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-milestone-retros-run-and-shape
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

How does a delivered mission still get its retros, and how is a proposed rule change written down for the mission page to show?

## The decision, in plain words

A delivered mission keeps being checked until each retro it sent is written down, one retro at a time, and one over its token budget skips the ones it never sent. A proposed change names what it changes in plain words that start with law, rule or the form's name, so the page can tell them apart.

## The intro, for fun

The party is over, but someone still has to write the thank-you notes.

## The punchline, for fun

The supervisor stays behind with the pen, one note at a time.

## The options, in plain words

A. A. Keep watching a delivered mission until its retros are written, one milestone retro at a time, and keep a target as plain words with its kind first.
B. B. Also hold a milestone retro back while a stuck repair works, so only one retro of any kind runs per mission.
C. C. Keep an item's target as separate fields (its kind, its id, its form and section) in a follow-up migration.

## What I had to decide

Confirm how milestone retros run and how an item's target is kept, or pick another. The run is apps/omni-app/src/missions/milestone.ts and milestone-run.ts; the target words are targetWords there, which the mission page (s5) reads.

## What I did meanwhile

Built A: a delivered mission's job keeps running while a milestone retro it sent is not recorded yet, then ends; the roadmaps' retros go first and the mission's last, never two at once, while a stuck repair or a PRD's repair may run beside one. A delivered mission over a cap keeps each milestone it did not send as skipped, `budget reached`. An item's target is kept as `law <id>`, `rule <id>` or `the <form> form: <section>`; its file is kept empty, since the retro's record line names no file per item; a retro's file the database would refuse is kept empty too.

## What it costs to change later

Low: the target words are text in mission_items, read by the mission page alone; a different shape is one function and the rows written so far, which a short follow-up can rewrite before any person answers one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's 'one retro at a time per mission' could also hold a milestone retro back while a stuck repair works; this slice reads it as one milestone retro at a time.
- (author) A mission delivered before this change, whose job runs again, sends its mission retro then: nothing in the spec says to leave such missions out.

```

<!-- /omni-outbox-settled: s4-03-milestone-retros-run-and-shape -->

<!-- omni-outbox-settled: s5-01-stuck-stop-and-item-routes -->

## s5-01-stuck-stop-and-item-routes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-stuck-stop-and-item-routes
prd: 3065
slice: s5
rank: medium
bears-on: none
raised: 2026-11-18
wave: 3
---

## The question, in plain words

The page needs a way to stop a mission paused by stuck and a way to adopt or decline a question, and only Resume had a route. Should this slice add those two routes?

## The decision, in plain words

The slice added one route that stops a stuck mission, saying it was stuck, and one that adopts or declines a question once through the database. Each records the person's own event, and Resume keeps its existing route.

## The intro, for fun

Two buttons on the page needed two doors in the wall.

## The punchline, for fun

Adopt knocks, the database answers once, and nobody opens it twice.

## The options, in plain words

A. A. Add a stop route and an answer route, each recording the person's event (as built).
B. B. Reuse the budget stop's answer route for the stuck pause and the question, in one shared route.
C. C. Leave Stop and the answers to a later slice and show the buttons disabled.

## What I had to decide

Kept the answer written once by the database (BR-PRODUCT-12) and never by the page. A name that cannot be read shows as a member.

## What I did meanwhile

Without the two routes the page would show Stop the mission, Adopt and Decline with nothing behind them.

## What it costs to change later

Removing a route is a small change; the events they record stay in the ledger, which is only ever added to.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether Stop the mission records its own event or only moves the mission; it records one so the room shows who stopped it.
- (author) The name of who answered a question is read from the players table; if a member's name cannot be read the card says a member.

```

<!-- /omni-outbox-settled: s5-01-stuck-stop-and-item-routes -->

<!-- omni-outbox-settled: s2-03-mission-retros-check-in-ci -->

## s2-03-mission-retros-check-in-ci — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-18T20:22:17Z
- Channel: feature pull request #3066
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3066#issuecomment-6990529145
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-11-18
- Slice: s2
- Wave: 1
- Became: playbook/conventions#naming

### The answer, as it was given

```text
ok
```

### The item, as it was raised

````text
---
id: s2-03-mission-retros-check-in-ci
prd: 3065
slice: s2
rank: human-action
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

The new database check for mission retros has to run in the automatic checks on every pull request, but the agent is not allowed to change the automatic checks' settings. Can a person add that one step?

## The decision, in plain words

The agent wrote the check and proved it passes on a local database, but its push was refused when it tried to add the check to the automatic checks. Until a person adds that step, nothing runs the new check on a pull request.

## The intro, for fun

The guard is hired, trained and in uniform.

## The punchline, for fun

Somebody just has to put it on the rota.

## What a person must do

On the branch feat/mission-retros (or feat/mission-retros--s2 before it merges), in .github/workflows/supabase.yml, right after the step "A mission's token budget, its fleet's daily cap and a budget stop's answer", add:

```yaml
      - name: A mission's stuck repairs, milestone retros and own outbox
        # A repair reads failure unless it says stuck; a stuck one may name no PRD and spends from the same 3 per cause and 9
        # per mission. One retro per milestone, never changed; an item names a target, a wording and cited evidence, and a
        # member answers it once as themselves, nobody else; paused by stuck only while paused; the five event kinds, the
        # two job keys, and a stuck repair claimed first (PRD 3065).
        run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/mission_retros.sql
```

Commit and push it with an account that may change workflows, then answer this item.

## What I had to decide

The slice's territory includes .github/workflows/supabase.yml, and conventions › A new database check runs in CI asks for a named step. The push of that change was refused: "refusing to allow a GitHub App to create or update workflow `.github/workflows/supabase.yml` without `workflows` permission". The step was dropped from the slice so the rest could be pushed.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

supabase/checks/mission_retros.sql is committed and passed on a local database (supabase db start, then psql -f), along with every other check the workflow names.

## What it costs to change later

None to add later: one step, no other file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the wave runner can be given the workflows permission, so a later slice can add such a step itself, is not known here.

````

<!-- /omni-outbox-settled: s2-03-mission-retros-check-in-ci -->

<!-- omni-outbox-settled: s2-01-stuck-and-retro-shapes -->

## s2-01-stuck-and-retro-shapes — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-18T19:22:49Z
- Channel: feature pull request #3066
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3066#issuecomment-6989088790
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-18
- Slice: s2
- Wave: 1
- Stays here: the shapes belong to this PRD; its migration and spec hold them

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s2-01-stuck-and-retro-shapes
prd: 3065
slice: s2
rank: high
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

How should the database remember that a mission was paused because it was stuck, and what a retro that could not be written looks like?

## The decision, in plain words

A mission now carries a small mark saying it was paused because it was stuck, and the database wipes that mark itself as soon as the mission is resumed or stopped. A retro that was skipped is kept as a card saying why, and every proposed rule change points back to the one retro or repair that raised it.

## The intro, for fun

A mission that spins all night needs a sticky note on the fridge.

## The punchline, for fun

The note peels itself off the moment someone presses Resume.

## The options, in plain words

A. Keep a paused-by mark on the mission, cleared by the database when the pause ends, and the shapes above.
B. Keep no mark: tell a pause by stuck apart from the mission's latest events instead.
C. Keep the pause by stuck as its own table of questions and answers, as the token budget does.

## What I had to decide

The spec asks the database to keep the pause by stuck but does not say how. I added missions.paused_by (only 'stuck', only while status is paused), and a trigger clears it whenever the mission leaves paused, so the existing Resume and Stop paths need no change. Other shapes the spec left open: a mission_retros row holds either a retro or a skipped reason (never both), one per milestone; a mission_items row is raised by exactly one milestone retro or one repair of the same mission, numbered 1 to 20 within it; a stuck repair's failed_job_id is the fifth job, whose end made the mission stuck; job keys mission:<id>:stuck:<k> and mission:<id>:retro:<roadmap n | mission> keep a replay from sending twice; a stuck repair is claimed first in line, as a PRD's repair is.

Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

Built and proven by supabase/checks/mission_retros.sql against a local database, with every other database check still green.

## What it costs to change later

Low: the tables and the column are new and empty until the supervisor (s4) writes them; a follow-up migration can reshape them before any row exists, or with a small backfill after.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the pause by a token budget should share the same mark, which today lives in its own budget-stop table, was left as it is.

```

<!-- /omni-outbox-settled: s2-01-stuck-and-retro-shapes -->

<!-- omni-outbox-settled: s3-01-mission-retro-runner-lists -->

## s3-01-mission-retro-runner-lists — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-18T19:22:49Z
- Channel: feature pull request #3066
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3066#issuecomment-6989088790
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-18
- Slice: s3
- Wave: 2
- Became: playbook/conventions#naming

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s3-01-mission-retro-runner-lists
prd: 3065
slice: s3
rank: high
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

A runner can only take a skill that the runner list, the app's copy of it, the database's copy and the runners guide all name. Should this slice have touched those outside its own folders so a mission can send the new retro skill?

## The decision, in plain words

To let a runner accept the mission retro skill, the slice also added it to the app's runner list, the runners guide and one small new database migration that keeps a repository from reusing the name. It left the engineer hero's skill list alone, because adding it there changes many page tests.

## The intro, for fun

A new skill needs a badge before the bouncer lets it in.

## The punchline, for fun

Four doors, four lists, and one of them was a database.

## The options, in plain words

A. A. Add the name to the app list, the guide and a new migration, and leave the Engineer role as it is (as built).
B. B. Add it everywhere, the Engineer role and the heroes drawer's tests included, in a later slice that owns the arcade.
C. C. Touch nothing outside the slice and let the supervisor slice add the lists.

## What I had to decide

Kept: the kit's runnable list, the app's contract list, the guide's line and a migration (20270126120000_mission_retro_skill.sql) adding mission-retro to the fixed list of set_repository_runner_skill. Not done: mission-retro in the Engineer's skills (kit/lib/virtual-fleet/roles.ts), which the plan lists for this slice but which moves counts on the heroes drawer in apps/galaxy.

## What I did meanwhile

Without these edits a mission could not send /omni:mission-retro: the app and the database would refuse the line.

## What it costs to change later

The migration redefines one function with one more name in its list; undoing it is another migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The Engineer role does not list mission-retro yet, so the heroes drawer does not show it (author).

```

<!-- /omni-outbox-settled: s3-01-mission-retro-runner-lists -->
