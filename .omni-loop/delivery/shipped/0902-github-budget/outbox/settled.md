# Settled outbox items — PRD 902

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-migration-version -->

## s1-01-migration-version — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-05T13:29:46Z
- Channel: feature pull request #903
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/903#issuecomment-5995466338
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1
- Became: playbook/conventions#naming

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-01-migration-version
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The plan named a date for the new database change that another change already uses, so the database would refuse to apply both. Which date should it carry?

## The decision, in plain words

I gave the new database change the next free date, a day after the latest one, so both apply in order.

## The intro, for fun

Two database changes walked in holding the same ticket number.

## The punchline, for fun

One of them politely took the next ticket instead.

## The options, in plain words

A. Keep 20261030090000, the next free version.
B. Pick another free version the reviewer prefers.

## What I had to decide

The plan's territory names `supabase/migrations/20261028090000_github_budget*`, but `20261028090000_agent_tokens.sql` already holds that version, and Supabase keys applied migrations by version. s2's planned `20261029090000_dossier_github*` collides with `20261029090000_constituents.sql` the same way.

## What I did meanwhile

Named the migration `supabase/migrations/20261030090000_github_budget.sql`, the first version after the latest one on the feature branch. It applies cleanly after every other migration on a local `supabase db start`.

## What it costs to change later

A rename of one file before it merges; after it reaches production, a new migration, never a rename. s2 should pick its own free version too (for example 20261031090000).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's version was meant to sort before s2's on purpose (author): the new name keeps that order only if s2 picks a later one.

```

<!-- /omni-outbox-settled: s1-01-migration-version -->

<!-- omni-outbox-settled: s1-02-budget-check-in-ci -->

## s1-02-budget-check-in-ci — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-05T13:29:46Z
- Channel: feature pull request #903
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/903#issuecomment-5995466338
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1
- Became: playbook/conventions#naming

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-02-budget-check-in-ci
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The new check that proves nobody in a browser can read the GitHub budget is written, but the pipeline that runs database checks lists each one by hand and that list sits outside this slice. Should it be added there?

## The decision, in plain words

I wrote the check and ran it by hand against a fresh local database, where it passed, but left the pipeline's list untouched since it lies outside this slice.

## The intro, for fun

The new guard dog is trained and ready.

## The punchline, for fun

Somebody still has to put it on the night shift roster.

## The options, in plain words

A. Add one step for the new check to the supabase workflow, in the feature branch, before it ships.
B. Leave it to a follow-up that runs every check in the folder in one step.
C. Leave the check as a by-hand script.

## What I had to decide

The plan asks for a check under `supabase/checks/` proving the two tables are readable by no browser role. The `supabase` workflow runs each check as its own named step, and `.github/workflows/supabase.yml` is not in s1's territory.

## What I did meanwhile

Wrote `supabase/checks/github_budget.sql` and ran it, with every other check, against a local database built from all migrations: it passes. The workflow does not run it yet.

## What it costs to change later

One step in the workflow, a few lines, at any time; until then a later change could open the tables without CI noticing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person who owns the workflow wants one step per check, as today, or one step that runs every file in the folder (author).

```

<!-- /omni-outbox-settled: s1-02-budget-check-in-ci -->

<!-- omni-outbox-settled: s1-03-recount-priority -->

## s1-03-recount-priority — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-05T13:29:46Z
- Channel: feature pull request #903
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/903#issuecomment-5995466338
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-10-01
- Slice: s1
- Wave: 1
- Stays here: a stopgap until s2 rewrites the recount, nothing lasting to file

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-03-recount-priority
prd: 902
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

Only the scheduled sync's outbox recount now steps back when the GitHub budget is low, while the recounts after a stage event or a sent answer still read as if a person were waiting. Is that acceptable until the next slice rewrites the recount?

## The decision, in plain words

The sync's recount and fix refresh read as background work; the stage event's and the send's recounts keep reading as a person's request, because their code lies outside this slice and the next slice replaces it.

## The intro, for fun

Three doors lead to the same counting room.

## The punchline, for fun

Only one of them has the new 'please wait' sign so far.

## The options, in plain words

A. Leave the stage event's and the send's recounts interactive until s2 replaces them.
B. Have s2 pass background for the stage event's recount and keep the send interactive, as the spec asks.

## What I had to decide

The plan's done-when says the PRD reader is `interactive` from a page and `background` from a recount. The recounts of the stage event and of outbox send are wired in `apps/galaxy/src/stages/outbox/live.ts`, which is s2's territory, not s1's.

## What I did meanwhile

The reader takes a priority (`interactive` by default). `apps/galaxy/src/stages/sync/live.ts` passes `background` for the sync's recount and fix refresh. `recountLive` (stage event, outbox send) still reads at the default, `interactive`, so it may spend the budget below the 20% floor, but never past a pause.

## What it costs to change later

One argument in one file, which s2 rewrites anyway when the recount derives from the snapshot.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often stage events arrive during a busy wave, and so how much of the budget their recounts spend below the floor (author).

```

<!-- /omni-outbox-settled: s1-03-recount-priority -->

<!-- omni-outbox-settled: s2-01-fix-page-staleness -->

## s2-01-fix-page-staleness — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fix-page-staleness
prd: 902
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

A fix's page now shows what was last stored about it instead of asking GitHub every time. Nothing records when that stored copy goes out of date, so when should the page ask GitHub again?

## The decision, in plain words

The page shows the stored copy at once and quietly asks GitHub again after it has loaded, as long as the fix has not shipped yet. A shipped fix never changes, so it is never asked again.

## The intro, for fun

A fix page used to phone GitHub every single time someone glanced at it.

## The punchline, for fun

Now it only calls back while the fix is still on its way out the door.

## The options, in plain words

A. A. Refresh after every visit while the fix has no release (built)
B. B. Refresh only when the stored facts are older than a set age
C. C. Refresh only when a webhook or the sync says GitHub moved, adding a stale mark to the stored fix facts

## What I had to decide

Whether a fix page's stored facts are out of date until the fix ships (built), or only after a set age, or only when something says GitHub moved.

## What I did meanwhile

Every visit to an unshipped fix's page costs one background read after the page is shown; the reader's one-minute sharing caps it, and a low budget refuses it first.

## What it costs to change later

A constant: the rule is one line in the fix page's facts module, and the stored fix facts need no new column for options A and C.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The stored fix facts keep no stale mark like the PRD snapshot does, so option C needs the webhooks of a later slice to set one (author).

```

<!-- /omni-outbox-settled: s2-01-fix-page-staleness -->

<!-- omni-outbox-settled: s2-02-snapshot-outside-territory -->

## s2-02-snapshot-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-snapshot-outside-territory
prd: 902
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The new stored copy of GitHub needed two files the slice was not listed to change: the description of the database tables the code reads, and the automatic check list that proves who may read the new table. Was it right to change them here?

## The decision, in plain words

I added the new table to the description of the database and its access check to the automatic check list, as the repository's own rules ask for every new table and check. The sync, which a later slice owns, was left untouched and still asks GitHub itself for its recount until then.

## The intro, for fun

The new table showed up without a name tag or a bouncer.

## The punchline, for fun

So it got both, even though they hang on a door down the hall.

## The options, in plain words

A. A. Change both here, with the table, as the conventions ask (built)
B. B. Leave them for a follow-up slice that owns them, with the table unchecked until then

## What I had to decide

Whether a slice may change the shared table description and the check list when it adds a table, or the plan should name them in its territory.

## What I did meanwhile

The check runs on every pull request and the table description matches the change; the sync's recount reads GitHub directly until the later slice rewires it.

## What it costs to change later

A constant: two additions that any later slice could have made instead; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left these two files out on purpose is not known (author).

```

<!-- /omni-outbox-settled: s2-02-snapshot-outside-territory -->

<!-- omni-outbox-settled: s5-01-octokit-builder-outside-territory -->

## s5-01-octokit-builder-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-octokit-builder-outside-territory
prd: 902
slice: s5
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The plan gave this slice only the outbox check's folder, but the place where the GitHub App builds its connection for every check lives next to it, in the app's shared wiring. Was it right to change that shared wiring too?

## The decision, in plain words

Yes: the shared wiring now builds every connection on the shared budget, so all six of the app's jobs spend the one budget with galaxy, not only the outbox check. The change there is a few lines, and the outbox check's folder holds the tests.

## The intro, for fun

The map said stay in your room, but the light switch was in the hallway.

## The punchline, for fun

We flipped it, and every room got the same light.

## The options, in plain words

A. A. Change the shared connection builder and its wiring so every job of the app spends the shared budget (built).
B. B. Keep the change inside the outbox check's folder, for the outbox check alone, leaving the other five jobs outside the budget until a later slice.
C. C. Leave the builder as it was and only prove the client in the end-to-end test, wiring it in a later slice.

## What I had to decide

Whether the shared connection builder (outside the slice's listed territory) may be changed so every job of the app goes through the shared budget.

## What I did meanwhile

Every job of the app (outbox check, inbox check, retro, harvest, statistics, canon buttons) calls GitHub through the shared budget-aware client, at background priority.

## What it costs to change later

Reverting means building the connection without the shared fetch again: a few lines in two files, no data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when says every Octokit the app builds goes through the client, which cannot be met inside the outbox check's folder alone; the territory row looks under-declared rather than deliberate.

```

<!-- /omni-outbox-settled: s5-01-octokit-builder-outside-territory -->

<!-- omni-outbox-settled: s5-02-refused-check-waits-for-budget -->

## s5-02-refused-check-waits-for-budget — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-refused-check-waits-for-budget
prd: 902
slice: s5
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

When the shared GitHub budget is paused or too low, what should the outbox check do with a pull request it cannot read yet?

## The decision, in plain words

It writes one line to the log, posts nothing, and asks to be tried again when the budget says it may, never sooner. If it is still refused after its usual retries, the existing failure path takes over once GitHub answers again.

## The intro, for fun

The kitchen is closed until three; do you stand at the door knocking?

## The punchline, for fun

We leave a note and come back at three.

## The options, in plain words

A. A. Log one line and retry at the time the budget gives (built).
B. B. Log one line and end the run quietly, without retrying; the next push or re-run evaluates again.
C. C. Treat a refusal like any other error: retried on the usual schedule, then failed.

## What I had to decide

Whether a refused outbox check waits for the budget and retries at the time the budget gives, or gives up at once.

## What I did meanwhile

A refused step logs one line naming the pull request and the time GitHub resumes, and is retried at that time; the check run is not created or changed meanwhile.

## What it costs to change later

A constant change in the outbox check: retry later, or stop without retrying. No data is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The other five jobs of the app are not taught this: a refused call there is an ordinary error, retried on the job's usual schedule, which the budget refuses again unsent.
- (author) A check whose retries all fall inside a long pause ends in the failure handler, which is itself refused while the pause lasts; the check run may then be left as it was until the next push.

```

<!-- /omni-outbox-settled: s5-02-refused-check-waits-for-budget -->

<!-- omni-outbox-settled: s3-01-touch-during-refresh -->

## s3-01-touch-during-refresh — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-touch-during-refresh
prd: 902
slice: s3
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

When GitHub says something changed while a page is already being refreshed, how do we make sure that change is not forgotten once the refresh ends?

## The decision, in plain words

A change that arrives during a refresh pushes the page's 'out of date' time forward, so the refresh cannot clear it, and the refresh a change started reads GitHub once more at its end.

## The intro, for fun

Ten pull requests merged while the page was still reading the first one.

## The punchline, for fun

So the page reads again once, instead of ten times, or zero.

## The options, in plain words

A. A. Re-stamp the mark in the touched route with the store's existing methods, and follow up once from the touch's own refresh.
B. B. Move the re-stamp into the snapshot store's own stale mark, as one atomic update, so every caller gets it.
C. C. Have every refresh, page-started included, follow up once when still stale at its end.

## What I had to decide

The snapshot store marks a dossier stale only when it is not stale already, and a refresh clears every mark set before it started. A touch landing during a refresh found the earlier mark, kept it, and the refresh's end cleared it: the touch was lost until the next sync. In the touched route (`apps/galaxy/src/touched/touched.ts`), a touch on a snapshot whose lease is held first clears the old mark (`store.current(id, now)`), then marks it stale at now through `staleSnapshot`, so the mark is later than the refresh's start and survives it. The refresh a touch starts (`refreshAfterTouch`) then reads once more when the snapshot is still stale; a refresh started by a page view does not follow up, and the open page's poll sees `read_at` move and renders again, which refreshes a stale snapshot.

## What I did meanwhile

Built it as described, with only the snapshot store's existing methods (no change to `apps/galaxy/src/dossier/snapshot/`, which is s2's territory). Tested with a stubbed clock: three touches during one read lead to exactly one follow-up read.

## What it costs to change later

A constant change: the re-stamp is two lines in `markTouched`; moving it into the store's `markStale` (an atomic update setting `stale_since` to now while `refreshing_until` is in the future) is a small change to one store method and its fake, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says touches during a refresh leave stale_since set, but the store s2 built keeps the first mark; it does not say whether the fix belongs in the store or in the route.
- (author) The two-step re-stamp is not atomic: a refresh ending between its two steps is harmless (the mark is set after), and two concurrent touches each clearing and setting it still leave it set.

```

<!-- /omni-outbox-settled: s3-01-touch-during-refresh -->

<!-- omni-outbox-settled: s4-01-etag-cleanup-in-sync -->

## s4-01-etag-cleanup-in-sync — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-etag-cleanup-in-sync
prd: 902
slice: s4
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

Old saved GitHub answers must be thrown away after a week of not being used. Should the shared GitHub helper learn to do that itself, or may the regular sync clean them up on its own?

## The decision, in plain words

The regular sync throws away saved answers nobody used for a week, by itself, without changing the shared GitHub helper that another part of the work owns.

## The intro, for fun

The fridge of saved GitHub answers was getting crowded.

## The punchline, for fun

The night cleaner now bins anything untouched for a week.

## The options, in plain words

A. A. Keep the cleanup in the sync; the shared GitHub helper stays as it was built.
B. B. Teach the shared GitHub helper to throw away old answers, and have the sync ask it to.
C. C. Leave the cleanup to a scheduled job in the database instead of the sync.

## What I had to decide

Whether the delete of idle ETag rows stays in the sync's own store or moves behind the GithubStore port in packages/github.

## What I did meanwhile

apps/galaxy/src/stages/sync/snapshots.ts deletes github_etags rows whose read_at is more than 7 days old, once per sync run, as the service role (the s1 migration already grants it delete and indexes read_at). The GithubStore port, memoryGithubStore and supabaseGithubStore are unchanged, so packages/github (s1's ground) is untouched.

## What it costs to change later

Moving it behind the port later is one method on GithubStore, its two stores and one call in the sync: an hour, no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s1 meant supabaseGithubStore to be the only code that writes github_etags: the spec says only that the sync may delete rows unread for 7 days.

```

<!-- /omni-outbox-settled: s4-01-etag-cleanup-in-sync -->

<!-- omni-outbox-settled: s6-01-installation-listing-outside-territory -->

## s6-01-installation-listing-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-installation-listing-outside-territory
prd: 902
slice: s6
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The App's way of listing the repositories it reaches went around the shared GitHub budget, and it sits in the sign-up code, outside what this slice may change. Should the slice reach in and close it?

## The decision, in plain words

I closed it: that listing now always uses the budget-aware door its caller hands it, and the one older shortcut that skipped the door is gone, since nothing used it any more.

## The intro, for fun

A side door in the sign-up hallway let one GitHub question skip the queue.

## The punchline, for fun

The door is now a wall, and the queue is one line again.

## The options, in plain words

A. A. Close the side door in the sign-up module, outside the slice's territory (built).
B. B. Leave the sign-up module untouched and list its plain listing as a known exception in the call-site test.
C. C. Leave it to a follow-up slice that owns the sign-up module.

## What I had to decide

Whether to change the sign-up module's GitHub helper, outside the slice's territory, so the repositories listing cannot go around the shared client.

## What I did meanwhile

Removed githubApp().installationRepositories (only its own test used it once Settings > Repositories read through the client), made reachedRepositories take its fetch from its caller, and moved its tests onto reachedRepositories directly.

## What it costs to change later

A constant: putting the method back is a few lines in apps/galaxy/src/signup/github-app.ts; no stored shape, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left the sign-up module out of s6 on purpose (author).

```

<!-- /omni-outbox-settled: s6-01-installation-listing-outside-territory -->

<!-- omni-outbox-settled: s6-02-readers-without-shared-store -->

## s6-02-readers-without-shared-store — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-05
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-05
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-readers-without-shared-store
prd: 902
slice: s6
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The background sync and the business draft build their own copies of these GitHub readers, in files this slice may not change, so their calls go through the budget-aware door without the shared record of the budget. Who connects them to that record?

## The decision, in plain words

I let each reader take the shared record as an option and gave it to the knowledge map's reader; the sync and the draft keep a door with no shared record until their own files are changed.

## The intro, for fun

Two readers came through the new turnstile without a ticket.

## The punchline, for fun

The turnstile counted them anyway, just in its own head.

## The options, in plain words

A. A. Connect the record where this slice may, and connect the sync and the draft in a small follow-up (built).
B. B. Connect the sync and the draft in this slice too, outside its ground, racing another slice of the same wave.
C. C. Make the readers find the shared record themselves, so no caller can forget it.

## What I had to decide

How the sync's and the draft's own knowledgeReader and repoReader instances, built in apps/galaxy/src/stages/sync/live.ts and apps/galaxy/src/business/draft/live.ts (outside s6's territory; the first is s4's in this same wave), get the shared store.

## What I did meanwhile

knowledgeReader and repoReader take an optional store (default none) and the knowledge reader a priority (default background). knowledge/github-server.ts passes githubStore() and interactive. The two live.ts files are unchanged, so their calls go through githubClient with no store: no shared ETags, budget or pause for them.

## What it costs to change later

One line in each live.ts: pass githubStore() (sync/live.ts already imports it). No stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s4 wires the sync's knowledge reader while it is in stages/sync/ (author).

```

<!-- /omni-outbox-settled: s6-02-readers-without-shared-store -->
