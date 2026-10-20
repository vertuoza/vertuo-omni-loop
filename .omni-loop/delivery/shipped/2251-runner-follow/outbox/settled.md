# Settled outbox items — PRD 2251

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-runners-read-by-repository -->

## s1-01-runners-read-by-repository — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-runners-read-by-repository
prd: 2251
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The spec asks for one address that lists a workspace's runners, but a person can belong to several workspaces, so the address alone cannot tell which one to list.

## The decision, in plain words

The terminal names the repository it is in, and the list shows the runners of the workspace that repository belongs to, to its members only.

## The intro, for fun

One person, three workspaces, and a terminal asking which runners are free.

## The punchline, for fun

The repository you stand in answers it before anyone has to.

## The options, in plain words

A. A. The terminal names its repository, and reads that workspace's runners (as built).
B. B. The address takes no query and lists the runners of every workspace the person belongs to.
C. C. The terminal names a workspace instead of a repository.

## What I had to decide

Whether the runners list is read by the repository the terminal is in (as built: GET /api/runners?repo=owner/name), or by something else, such as every workspace the person belongs to.

## What I did meanwhile

GET /api/runners requires repo=owner/name and answers the runners of that repository's workspace, all of them, each with its repositories, so the HUD and the follow can keep the ones online for this repository. A query without it is refused with 400; a person outside that workspace is refused with 403, as sending a job there is.

## What it costs to change later

A constant: the route reads one query parameter, and the kit's client (s3) sends it. Reading every workspace instead is a new service method, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the route without a query and does not say which workspace a member of several reads; every other route the terminal reads (the loop, the dossiers, approvals) takes repo=owner/name, so this follows them.
- (author) A person outside the workspace gets 403 with the reason, as POST /api/runners/jobs answers today; the job lines route keeps its 404.

```

<!-- /omni-outbox-settled: s1-01-runners-read-by-repository -->

<!-- omni-outbox-settled: s1-02-prd-jobs-among-listed -->

## s1-02-prd-jobs-among-listed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-prd-jobs-among-listed
prd: 2251
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When the terminal asks for a PRD's jobs, how far back should it look: every job ever sent for it, or only the ones the Runners page still lists?

## The decision, in plain words

It looks among the jobs the Runners page lists, the waiting and running ones plus the last fifty that ended, and keeps the ones whose line names the PRD.

## The intro, for fun

A PRD built three weeks and two hundred jobs ago asks to be followed again.

## The punchline, for fun

The terminal only remembers what the page still shows.

## The options, in plain words

A. A. Look among the jobs the Runners page lists (as built).
B. B. Look across every job of the repository, with a new storage read.

## What I had to decide

Whether a PRD's jobs are looked up among the jobs the Runners page lists (as built), or across every job the workspace ever ran.

## What I did meanwhile

GET /api/runners/jobs reads the workspace's queued and running jobs and its last 50 ended ones, keeps those of the repository whose line's first argument is the PRD's number, and answers them newest first. A PRD whose last job ended before the workspace's last 50 answers no job, so the follow waits for one.

## What it costs to change later

A constant: a new read in the runners' storage that filters by repository and line, and a change in the store's fake. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's territory holds the service, not the storage fake its tests run on, so a new storage read was left out; the jobs a follow needs, the one queued or running and the one just ended, are always among the listed ones.

```

<!-- /omni-outbox-settled: s1-02-prd-jobs-among-listed -->

<!-- omni-outbox-settled: s3-01-help-entry-outside-territory -->

## s3-01-help-entry-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-help-entry-outside-territory
prd: 2251
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The plan asks that the runner help page names both new commands, but the file that holds that page is outside this slice's territory.

## The decision, in plain words

The slice edited the runner's entry in the help text, adding the two commands, and nothing else in that file.

## The intro, for fun

Two new commands walked into the help page and found the door was not on their map.

## The punchline, for fun

The page now lists them, and the map is for a person to redraw.

## The options, in plain words

A. A. Keep the one-entry edit in this slice (as built).
B. B. Move the help edit to a later slice that owns the help file and leave the page without them until then.

## What I had to decide

Whether the help entry stays edited by this slice (as built), or moves to another slice's territory.

## What I did meanwhile

Added the two usage lines and one paragraph to the runner entry of the help entries; no other entry changed, and a test in the runner command's tests reads the help page.

## What it costs to change later

A constant: the text can be moved or reworded in any later change; nothing depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when says omni help runner names both commands but its territory lists only the runner client and command files.

```

<!-- /omni-outbox-settled: s3-01-help-entry-outside-territory -->

<!-- omni-outbox-settled: s3-02-follow-keeps-last-milestone-file -->

## s3-02-follow-keeps-last-milestone-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-follow-keeps-last-milestone-file
prd: 2251
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The plan says the follow writes its last milestone for this session, but not where, so the band's slice has nothing fixed to read.

## The decision, in plain words

While a follow runs, it keeps its last milestone in one small file per PRD in the checkout's local folder, and removes it when the follow ends; the board's merged count is read every 30 seconds from the board command.

## The intro, for fun

A follow needs a note on the fridge so the band can read it without asking.

## The punchline, for fun

The note says what happened last, and it comes off the fridge when the job ends.

## The options, in plain words

A. A. One file per PRD under the local folder, removed when the follow ends (as built).
B. B. One file per terminal session, named by the session id the way ask mode names its files.
C. C. No file: the band asks the page for the followed job itself.

## What I had to decide

Where the followed job's last milestone is kept for the HUD, and how the slice count is read.

## What I did meanwhile

Wrote .omni-loop/local/runner-follow/<prd>.json holding prd, runner, line and at; the file is deleted when the follow ends for any reason. The count of merged slices comes from running the board command's JSON every sixth read (30 seconds) and once the job ends; an unreadable board prints no count line.

## What it costs to change later

A constant: the file's name and shape are read only by the band's slice, which is not built yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names no file or shape for what the follow leaves, nor where the board's count comes from.

```

<!-- /omni-outbox-settled: s3-02-follow-keeps-last-milestone-file -->

<!-- omni-outbox-settled: s4-01-runner-jobs-listing -->

## s4-01-runner-jobs-listing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-runner-jobs-listing
prd: 2251
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The terminal has no command that lists a PRD's jobs or the online runners, so the new skill cannot read them directly. How should it find a job to follow and the runners to offer?

## The decision, in plain words

The skill probes with a short, time-limited follow to see whether a job is queued or running, and offers a choice of runner only when a list command exists, otherwise it sends to any runner.

## The intro, for fun

Looking for a job with no list is like finding a seat in a dark cinema.

## The punchline, for fun

A small list command would turn the lights on.

## The options, in plain words

A. A. Probe with a bounded follow, send to any runner without a list command (what was built)
B. B. Add a list of runners and a list of a PRD's jobs to the kit, and read them in the skill
C. C. Ask the person for the job id and the runner every time

## What I had to decide

Built: a 20 second `omni runner follow <n>` probe, and `omni runner list --json` named for the runner choice with a fall back to any runner. Undo by adding the list command and replacing both steps in the skill.

## What I did meanwhile

Works today: a running job is followed, a new one is sent to any runner. The person is never asked where until the list command exists.

## What it costs to change later

Cheap to change: one list command in the kit and two paragraphs of the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a list command belongs in this PRD or a follow-up (author)

```

<!-- /omni-outbox-settled: s4-01-runner-jobs-listing -->

<!-- omni-outbox-settled: s4-02-runner-skill-help-entry -->

## s4-02-runner-skill-help-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-runner-skill-help-entry
prd: 2251
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The new runner skill needs a line in the kit's help table, and the help and docs tests count skills there, but that table is outside this slice's territory. Who adds it, and when?

## The decision, in plain words

The slice left the help table alone, so three tests that list every skill fail until the entry and the new skill and command counts are added by the wave or a follow-up change.

## The intro, for fun

A new skill walked in and the guest book had no page for it.

## The punchline, for fun

One entry in the help table signs it in.

## The options, in plain words

A. A. Leave the help table alone and let the wave or a follow-up add the entry (what was built)
B. B. Widen this slice's territory to the help table and add the entry here
C. C. Add a tiny slice 6 for the help entry, blocked by this one

## What I had to decide

Built: nothing outside the territory. Undo by adding the entry for the skill to the help table and raising the counts in its test from 61 commands and 33 skills to 61 and 34.

## What I did meanwhile

The skill works and its own tests pass. The help table test and the two docs skill tests stay red until the entry lands.

## What it costs to change later

Cheap: one help entry and one number in a test, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave check should add the entry or a later slice (author)

```

<!-- /omni-outbox-settled: s4-02-runner-skill-help-entry -->
