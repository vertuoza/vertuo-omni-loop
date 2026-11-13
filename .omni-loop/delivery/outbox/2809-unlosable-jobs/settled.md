# Settled outbox items — PRD 2809

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-budget-drops-the-bundle -->

## s2-01-budget-drops-the-bundle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-budget-drops-the-bundle
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When a runner has too many saved jobs on its disk, should the oldest save go whole, or should only its big folder go while its small saved copy stays?

## The decision, in plain words

The oldest save goes whole: its folder and its saved copy are both removed, and its record says what was lost, as the design describes.

## The intro, for fun

Every disk fills up one day, and somebody has to choose what gets thrown out first.

## The punchline, for fun

Spring cleaning, with a receipt for everything that went in the bin.

## The options, in plain words

A. A. The oldest save goes whole, folder and bundle; its manifest names what was lost (built)
B. B. Only the folder goes; the bundle stays until its keep date, so nothing committed or uncommitted is lost, only ignored files
C. C. The bundle goes first and the folder stays, since the folder alone can still be pushed by hand

## What I had to decide

Keep A, or choose B: on a runner over its keep budget, remove only the oldest kept folder and keep its bundle (a few MB) until its keep date, so the resume can still take the work back.

## What I did meanwhile

Over `--keep-budget`, `keepWithin` (kit/lib/runner/sweep.ts) removes the oldest kept folder and its bundle `<folder>.checkpoint.bundle`, and rewrites its manifest with `lost: { at, why }`; the manifest stays until `keepUntil`. Both the folder and the bundle count toward the budget.

## What it costs to change later

A constant: B is a few lines in `dropKept` (keep the bundle, count its bytes only) and a test change. No stored shape changes: the manifest already carries `bundle` and `bundleBytes`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person reads "the oldest kept folder is removed" as the save going, or only the folder (author)

```

<!-- /omni-outbox-settled: s2-01-budget-drops-the-bundle -->

<!-- omni-outbox-settled: s2-02-snapshot-author -->

## s2-02-snapshot-author — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-snapshot-author
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When the runner saves a job's unfinished edits as a commit, whose name should that commit carry when the runner no longer knows which app the job ran as?

## The decision, in plain words

The commit carries the job's app when the runner knows it. When it does not, after a restart, it carries the runner's own name, never a person's.

## The intro, for fun

A note left on the fridge still needs a signature, even when the writer has left the house.

## The punchline, for fun

Signed: the robot who tidied up, and nobody pretending otherwise.

## The options, in plain words

A. A. The job's app when known, else the runner's own name and an address that cannot receive mail (built)
B. B. Always the job's app, its name kept on the runner for the sweep after a restart
C. C. Always the runner's own name, so every snapshot reads as the runner's

## What I had to decide

Keep A, or choose B: sign a snapshot made after a restart as the job's app too, by keeping the app's name and email in the job's token file while it runs.

## What I did meanwhile

`saveJob` (kit/lib/runner/checkpoint.ts) authors the snapshot commit with `job.github`'s login and email at a job's end; for a folder the sweep finds after a restart it uses `omni runner <name>` <`<name>@runner.omni.invalid`>. A resume that fast-forwards onto the snapshot pushes that commit, so the name shows on GitHub.

## What it costs to change later

A constant: B adds the login and email to the token file the runner already writes per job and reads them back in the sweeper. No stored shape on the server changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a commit signed by an `.invalid` address is refused by any repository's push rules (author)

```

<!-- /omni-outbox-settled: s2-02-snapshot-author -->

<!-- omni-outbox-settled: s2-03-failed-save-keeps-folder -->

## s2-03-failed-save-keeps-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-failed-save-keeps-folder
prd: 2809
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

If the runner tries to save a job's unfinished work and the save itself breaks, should it keep the job's folder anyway, or remove it as it did before this feature?

## The decision, in plain words

It keeps the folder, with a note saying the save failed and why. The folder still goes after seven days, or sooner when the disk budget is full.

## The intro, for fun

Sometimes the box you were packing breaks before the move is finished.

## The punchline, for fun

So the furniture stays in the old flat, with a note on the door.

## The options, in plain words

A. A. Keep the folder, its manifest saying the save failed (built)
B. B. Remove the folder as before, the failure printed only
C. C. Keep the folder and stop the runner taking new jobs until a person looks

## What I had to decide

Keep A, or choose B: a save that fails removes the folder as before, and only the runner's printed line says so.

## What I did meanwhile

`saveJob` (kit/lib/runner/checkpoint.ts) catches any failure of the listing, snapshot or bundle, writes the manifest with `bundle: null`, `branches: []` and `failed: 'the save failed: <first line of the error>'`, and keeps the folder; it counts toward the keep budget and goes at its keep date like any kept folder.

## What it costs to change later

A constant: B is one branch in `saveJob`. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a save should be tried again on a later sweep: today a folder kept after a failed save is never saved again, and goes at its keep date (author)

```

<!-- /omni-outbox-settled: s2-03-failed-save-keeps-folder -->

<!-- omni-outbox-settled: s1-02-cancel-asked-not-resumed -->

## s1-02-cancel-asked-not-resumed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-cancel-asked-not-resumed
prd: 2809
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When someone asks to stop a running job and its machine dies before the job stops, should the job start again on another machine?

## The decision, in plain words

It does not start again: a job someone asked to stop is never resumed, even when its machine is lost before it stopped.

## The intro, for fun

Someone pressed stop, then the machine fell asleep mid-sentence.

## The punchline, for fun

Waking it up somewhere else would ignore the one wish we had in writing.

## The options, in plain words

A. A. A job whose cancel was asked is never resumed, even when its runner is lost first.
B. B. A lost job is resumed whatever was asked; a person cancels the resume if they still want it stopped.

## What I had to decide

The spec lists a cancelled job among those never resumed, and a loss among those always resumed; it does not say which wins for a running job whose cancel was asked (cancel_requested set, its runner not yet stopped) and whose runner is then lost. The trigger reads `new.cancel_requested` and queues nothing then, so a person's cancel is never undone by a resume.

## What I did meanwhile

runner_job_resume_lost() returns before queuing when `cancel_requested` is true; supabase/checks/runner_resume.sql proves it (Q1, cancel asked, then lost with its runner: no resume).

## What it costs to change later

One condition in the trigger's function, changed by a follow-up migration; no row to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person ever asks to cancel a job hoping it restarts elsewhere is not known. (author)

```

<!-- /omni-outbox-settled: s1-02-cancel-asked-not-resumed -->

<!-- omni-outbox-settled: s4-02-upload-link-two-hours -->

## s4-02-upload-link-two-hours — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-upload-link-two-hours
prd: 2809
slice: s4
rank: medium
bears-on: none
raised: 2026-11-13
wave: 3
---

## The question, in plain words

The plan asks for an upload link that works for a few minutes, but the storage service gives every upload link two hours and offers no way to shorten it. Is two hours acceptable for sending a job's saved work?

## The decision, in plain words

The link lives the storage's fixed two hours, and the app says so when it hands it out. It is good for one upload to one place only, cannot replace what is already there, and only the job's own runner gets one.

## The intro, for fun

We asked for a five-minute pass and the storage handed us a two-hour wristband.

## The punchline, for fun

At least the wristband opens exactly one door, once.

## The options, in plain words

A. A. Keep the storage's two-hour upload link, for one upload of one path, and say so in the reply
B. B. Refuse to record a save uploaded more than a set number of minutes after its link was signed

## What I had to decide

A keeps the storage's two hours as built. B shortens it: the app would refuse to record a save whose upload came more than a set number of minutes after its link (a constant in the service), which limits what a late upload can do but not the link itself.

## What I did meanwhile

checkpointsService().link() answers expiresAt two hours after it signs (SIGNED_UPLOAD_MS in apps/galaxy/src/runners/runners.service.ts). The link names one path, <workspace>/<job>/<random id>.bundle, under the private bucket runner-checkpoints; a second upload on it was refused (400) on a local stack, and an anonymous download of the bundle was refused.

## What it costs to change later

A constant in the service and one check before the record: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Supabase's createSignedUploadUrl (storage-js 2.117.1) takes no lifetime, and the storage service fixes it at two hours: no setting in this repository changes that. (author)
- Whether a two-hour window for one upload of one path is within what the spec's Risks line ('signed links of minutes') meant to promise is the PRD author's call. (author)

```

<!-- /omni-outbox-settled: s4-02-upload-link-two-hours -->

<!-- omni-outbox-settled: s4-03-send-save-wired-by-s5 -->

## s4-03-send-save-wired-by-s5 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-send-save-wired-by-s5
prd: 2809
slice: s4
rank: medium
bears-on: none
raised: 2026-11-13
wave: 3
---

## The question, in plain words

The runner can now send a job's saved work to the app, but the place where a job ends and its folder is cleaned up belongs to another slice of this plan, so nothing calls the send yet. Should the next slice that owns that place (s5) switch it on?

## The decision, in plain words

The send is built and tested on its own, and left switched off: a runner keeps every save on its own disk, as before, until the cleanup calls it. The plan's s5 already changes that same file and needs the saves on the server to restore them.

## The intro, for fun

The parcel is packed, labelled and weighed, but the door it leaves by belongs to the neighbour.

## The punchline, for fun

The neighbour moves in next wave, so we left the parcel by the door with a note.

## The options, in plain words

A. A. Leave switching it on to slice s5, which already changes the runner's cleanup
B. B. Widen this slice to the runner's cleanup and its hourly sweep, and switch the send on now

## What I had to decide

A leaves the call to s5, whose territory holds kit/lib/runner/runner.ts: at cleanUp, after saveJob, call sendSave with checkpointApi(...), the job's handoff note and its tokens, and let the sweep retry a kept save whose manifest has no `sent`. B widens s4's territory now and adds that call here.

## What I did meanwhile

kit/lib/runner/checkpoint.ts exports sendSave(): it asks checkpointApi().link(), puts the bundle, records it portable and marks the runner's own manifest `sent`; a failed save, a bundle over 100 MB, a refused link or a failed upload records it local, saying why; it never throws. Tested on temporary git repositories with a nested worktree (kit/lib/runner/checkpoint.test.ts). runner.ts and sweep.ts are unchanged, so the runner behaves as after s2.

## What it costs to change later

One call in cleanUp and one in the sweep's pass, in s5 or a follow-up slice; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives s4 the upload but gives runner.ts and sweep.ts to s2 and s5 only, so who switches it on is not settled. (author)
- A bundle uploaded whose portable record then fails is recorded local with no storage path: only a forget job that also deletes any bundle 7 days old by its age in the bucket (s6's done-when says so) removes it. (author)

```

<!-- /omni-outbox-settled: s4-03-send-save-wired-by-s5 -->

<!-- omni-outbox-settled: s5-01-resume-note-in-the-prompt -->

## s5-01-resume-note-in-the-prompt — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-resume-note-in-the-prompt
prd: 2809
slice: s5
rank: medium
bears-on: none
raised: 2026-11-13
wave: 4
---

## The question, in plain words

When a job picks up the work of a job that was lost, how should its agent be told to read the note about what came back, before anything else?

## The decision, in plain words

The note is pointed at in the agent's first message, right after the job's own command. A side effect: if the job later has to switch to another account, it only switches to an account that accepts every kind of job.

## The intro, for fun

A relay runner needs the baton and a sticky note saying which lane to run in.

## The punchline, for fun

We stuck the note on the baton itself, which is not where batons expect notes.

## The options, in plain words

A. The note is pointed at after the job's line, in the line file; a resume turns over only to accounts that take any job (built)
B. The runner passes the note as an option of the job's process, which adds it to the first message; the line stays one line
C. Keep the pointer in the line file, and fix the job process to read the first line alone for the skill

## What I had to decide

Keep A, or choose B: the runner hands the note's path to the job's process as an option of its own, and the process adds it to the first message; the job's own command stays a single line.

## What I did meanwhile

runner.ts writes the job's line file as `<line>\n\n<pointer>`, the pointer naming ~/logs/job-<id>.resume.md (resumePointer in kit/lib/runner/resume.ts). job.ts, outside this slice's territory, reads the whole file as the line and sends it as the prompt, so the session reads the pointer after its line. The same file read by skillOf() in job.ts no longer reads as a fixed skill, so a turnover of a resume picks only accounts with no `takes` list.

## What it costs to change later

A constant: B is one flag in kit/bin/commands/runner.ts and job.ts (or a one-line fix in job.ts reading the first line for the skill), and the runner writing the line alone again. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives this slice runner.ts but not job.ts or the runner command, where a flag for the note would live.
- (author) Whether any runner's accounts file restricts accounts with `takes` today is not known here.

```

<!-- /omni-outbox-settled: s5-01-resume-note-in-the-prompt -->

<!-- omni-outbox-settled: s5-04-checkpoint-rule-in-the-note -->

## s5-04-checkpoint-rule-in-the-note — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-checkpoint-rule-in-the-note
prd: 2809
slice: s5
rank: medium
bears-on: none
raised: 2026-11-13
wave: 4
---

## The question, in plain words

Where should the rule live that tells a job to first take back the saved work of a branch before touching it?

## The decision, in plain words

The rule is written in the note each resumed job reads first, and nowhere in the instructions the building skills read. A job that never got a note is never told it.

## The intro, for fun

Every recipe card says to preheat the oven, but only on the card you were handed.

## The punchline, for fun

Nobody reads the cookbook's foreword anyway.

## The options, in plain words

A. The rule is in the resume note alone (built)
B. Also write it once in the runner guidance the resumable skills read, in a follow-up

## What I had to decide

Keep A, or choose B: also write the rule once in the kit's runner guidance the resumable skills read, as the spec's section on restoring says, in a follow-up outside this slice.

## What I did meanwhile

resumeNote() in kit/lib/runner/resume.ts writes the rule (git merge --ff-only omni-checkpoint/<branch>, or a merge when it diverged, or a checkout from the checkpoint when origin has no such branch) under each restored branch list, and the session's prompt points at the note. No skill or guidance file changed: none is in this slice's territory, nor in any slice of the plan.

## What it costs to change later

A paragraph in one guidance file, in a follow-up: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks the rule to be written once in the kit's runner guidance, but the plan gives no slice that file.

```

<!-- /omni-outbox-settled: s5-04-checkpoint-rule-in-the-note -->

<!-- omni-outbox-settled: s5-03-keeper-runner-routing -->

## s5-03-keeper-runner-routing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-keeper-runner-routing
prd: 2809
slice: s5
rank: medium
bears-on: none
raised: 2026-11-13
wave: 4
---

## The question, in plain words

When a lost job's saved work could only be kept on the machine that lost it, and that machine is back online but busy, should the job that picks up the work wait for it?

## The decision, in plain words

It waits for that machine while the machine is online and allowed to take the job, even when all its slots are busy. Once the machine has been silent for a minute and a half, any machine takes the job and is told what stayed behind.

## The intro, for fun

The only person with the house keys is home, but on the phone.

## The punchline, for fun

We wait by the door rather than climb in through the window.

## The options, in plain words

A. The resume waits for its online keeper, busy or not (built)
B. A busy keeper does not hold it: any free runner takes it, and its note says what stayed behind
C. The keeper holds it for a set time only, then any runner takes it

## What I had to decide

Keep A, or choose B: a busy keeper does not hold the resume, which then goes to any free runner, its note saying what stayed on the keeper.

## What I did meanwhile

runner_claim() in supabase/migrations/20270120110000_runner_claim_resume.sql skips, for every runner but the keeper, a resume whose chain's newest local save (not deleted, still kept) is kept by a runner seen in the last 90 s, of the workspace, an App runner, holding the job's repository and its target. Free slots are not read; supabase/checks/runner_resume.sql proves the online, offline and expired cases.

## What it costs to change later

One condition in runner_claim(), changed by a follow-up migration: no row moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long a busy keeper may hold a resume is not bounded: a keeper whose slots stay full holds it until one frees.

```

<!-- /omni-outbox-settled: s5-03-keeper-runner-routing -->
