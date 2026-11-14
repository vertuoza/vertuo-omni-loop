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

<!-- omni-outbox-settled: s7-01-lost-job-offers-no-button-while-resuming -->

## s7-01-lost-job-offers-no-button-while-resuming — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s7
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-lost-job-offers-no-button-while-resuming
prd: 2809
slice: s7
rank: medium
bears-on: none
raised: 2026-11-13
wave: 5
---

## The question, in plain words

While a lost job is waiting for its automatic resume, should the Runners page still offer Send again on the lost job?

## The decision, in plain words

No: the lost job shows no button while its resume exists, because pressing Send again would queue the same work twice. The resume has its own Cancel, and Lost 3 times offers Resume.

## The intro, for fun

Two people are about to send the same pizza order, and the first order is already in the oven.

## The punchline, for fun

The page hides the second phone until the first pizza is cold.

## The options, in plain words

A. A. The lost job shows no button while its resume exists (built)
B. B. Send again stays on the lost job, beside the automatic resume
C. C. Send again stays but is greyed out with the words the resume is queued

## What I had to decide

Keep A, or choose B: Send again stays on the lost job and queues a second chain beside the automatic resume.

## What I did meanwhile

RunnersPage.tsx returns no action for a job that reads Lost · resuming, and never makes it the page's primary action; Lost 3 times shows Resume, which sends the line again as the person who presses it. The board also lists each save of the jobs it shows (runners.service.ts reads them through the existing savesOf, one more read per board), so the page can say what came back and what a runner keeps.

## What it costs to change later

A constant-sized change in one component: B is the previous behaviour, one line to restore.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says what the lost job reads and what its resume reads, and says nothing about its buttons while the resume waits.

```

<!-- /omni-outbox-settled: s7-01-lost-job-offers-no-button-while-resuming -->

<!-- omni-outbox-settled: s1-01-resume-check-in-ci -->

## s1-01-resume-check-in-ci — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-14T06:14:44Z
- Channel: feature pull request #2810
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2810#issuecomment-6872948576
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1
- Stays here: a one-off CI step a person adds by hand; "ok" states no lasting rule

### The answer, as it was given

```text
ok
```

### The item, as it was raised

````text
---
id: s1-01-resume-check-in-ci
prd: 2809
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

The database check that proves a lost job is resumed exactly once is written and passes, but the build robot is not allowed to change the file that tells CI what to run, so CI does not run it yet. Can a person add that one step?

## The decision, in plain words

The check was left out of CI and everything else was pushed. Until a person adds the step, nothing in CI proves a lost job queues one resume and waits before it starts.

## The intro, for fun

The proof is written and passes, but the robot has no badge for the room where CI keeps its list.

## The punchline, for fun

So the proof waits in the hall until a person walks it in.

## What a person must do

1. Check out the branch feat/unlosable-jobs--s1 (or the feature branch feat/unlosable-jobs once s1 is merged into it).
2. In .github/workflows/supabase.yml, in the check job, right after the step named "Who may read and write the runners, and how a runner claims a job" (the one running supabase/checks/runners.sql), add this step:

```yaml
      - name: A lost runner job queues one resume, and no runner claims it before its wait
        # A job sent anew reads attempt 1; a claimed or running job of a resumable skill that ends lost queues, in
        # the same statement, one resume with its line, repository, sender (the key and its maker kept) and target,
        # attempt one more, 1 minute after the first loss and 5 after the second; a second mark, the third loss, a
        # cancel, a refusal, the skill's own failure, a timeout and another skill queue none; runner_claim() hands
        # out no job before its resume_after. Members read the columns, nobody signed in writes them (PRD 2809).
        run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/runner_resume.sql
```

3. Commit it as `ci(supabase): run the runner resume check (#2809)` with your own login, and push.
4. Or, instead: grant the Omni App `workflows: write` in its GitHub App settings, accept the new permission on the installation, and ask for the slice to be pushed again. Slice s4 of this PRD adds a check step too and will meet the same refusal.

## What I had to decide

Pushing a change to .github/workflows/supabase.yml from this session is refused: the GitHub App that pushes has no `workflows` permission (`refusing to allow a GitHub App to create or update workflow .github/workflows/supabase.yml without workflows permission`). The repository's rule is that a database check CI does not run proves nothing (conventions: a new database check runs in CI), and the plan's done-when for s1 asks for supabase/checks/runner_resume.sql to run as its own step of the supabase workflow. PRD 2676 s1-03 met the same refusal and was settled by a person adding the step.

## What I did meanwhile

The migration, supabase/checks/runner_resume.sql, the regenerated types, the kit's RESUMABLE_SKILLS and the runners' reads are pushed on feat/unlosable-jobs--s1. The check ran green here against a fresh local database with every migration applied, and red against three broken versions: no trigger (no resume queued), a trigger on any failure (a timeout resumed), and a claim that ignores resume_after (a resume handed out before its wait). The eleven other checks that touch runner jobs ran green too. The workflow step above is the only part not pushed.

## What it costs to change later

One step a person adds by hand; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether to grant the Omni App the workflows permission for good, or add such steps by hand each time, is a person's choice; PRD 2573 and PRD 2676 named the same grant as a manual step. (author)

````

<!-- /omni-outbox-settled: s1-01-resume-check-in-ci -->

<!-- omni-outbox-settled: s4-01-checkpoints-check-in-ci -->

## s4-01-checkpoints-check-in-ci — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-14T06:14:44Z
- Channel: feature pull request #2810
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2810#issuecomment-6872948576
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-11-13
- Slice: s4
- Wave: 3
- Stays here: a one-off CI step a person adds by hand; "ok" states no lasting rule

### The answer, as it was given

```text
ok
```

### The item, as it was raised

````text
---
id: s4-01-checkpoints-check-in-ci
prd: 2809
slice: s4
rank: human-action
bears-on: none
raised: 2026-11-13
wave: 3
---

## The question, in plain words

The database check that proves a saved job's work is kept private, and only by the runner that holds the job, is written and passes, but the build robot is not allowed to change the file that tells CI what to run. Can a person add that one step?

## The decision, in plain words

The check was left out of CI and everything else was pushed. Until a person adds the step, nothing in CI proves who may read and record a job's saved work.

## The intro, for fun

The privacy proof passes on the bench, but the robot still has no badge for the CI room.

## The punchline, for fun

Same hallway as last wave, same polite knock on the door.

## What a person must do

1. Check out the branch feat/unlosable-jobs--s4 (or the feature branch feat/unlosable-jobs once s4 is merged into it).
2. In .github/workflows/supabase.yml, in the check job, right after the step named "A lost runner job queues one resume, and no runner claims it before its wait" (the one running supabase/checks/runner_resume.sql), add this step:
   
   ```yaml
         - name: A runner job's save, its bucket, and who reads it
           # The bucket runner-checkpoints is private, 100 MB an object, bundles only, and no rule on storage.objects names
           # it. As the service role, runner_checkpoint_record() records a save for the runner that holds its job: local
           # with its size and a keep_until of 7 days at most, then portable once its bundle is in the bucket at the job's
           # own folder; it refuses another runner, a bundle not uploaded, another job's path or manifest, and 100 MB and
           # more. A member reads the rows, a non-member nothing; nobody signed in writes one or reaches a bundle (PRD 2809).
           run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/runner_checkpoints.sql
   ```
3. Commit it as `ci(supabase): run the runner checkpoints check (#2809)` with your own login, and push.
4. Or, instead: grant the Omni App `workflows: write` in its GitHub App settings, accept the new permission on the installation, and ask for the slice to be pushed again.

## What I had to decide

Add the step below to .github/workflows/supabase.yml (or grant the Omni App the workflows permission and ask for the slice to be pushed again).

## What I did meanwhile

The migration supabase/migrations/20270120103000_runner_checkpoints.sql, supabase/checks/runner_checkpoints.sql, the regenerated types, the route, the service and the kit's client are pushed on feat/unlosable-jobs--s4. The check ran green against a fresh local stack with every migration applied, and red against a record function with its runner guard removed (box-1 recorded the save of a job box-3 holds). runner_resume.sql and rls_membership_once.sql ran green beside it. The workflow step is the only part not pushed.

## What it costs to change later

One step a person adds by hand; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether to grant the Omni App the workflows permission for good, or add such steps by hand each time, is a person's choice; s1-01 of this PRD, PRD 2573 and PRD 2676 met the same refusal. (author)

````

<!-- /omni-outbox-settled: s4-01-checkpoints-check-in-ci -->

<!-- omni-outbox-settled: s5-02-chain-holds-claims-on-the-runner -->

## s5-02-chain-holds-claims-on-the-runner — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-14T06:14:44Z
- Channel: feature pull request #2810
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2810#issuecomment-6872948576
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-4
- Raised: 2026-11-13
- Slice: s5
- Wave: 4
- Stays here: the answer keeps option A as built; the takeover rule lives in the resume note and its code, and the answer adds nothing beyond it

### The answer, as it was given

```text
A. The lost job's runner releases nothing, the resume's note tells its session to take the claims over, and the resume releases what is left (built)
```

### The item, as it was raised

```text
---
id: s5-02-chain-holds-claims-on-the-runner
prd: 2809
slice: s5
rank: high
bears-on: BR-PRODUCT-4
raised: 2026-11-13
wave: 4
---

## The question, in plain words

When a job is lost and another runner picks up its work, how do we keep a third job from grabbing the same slices in between?

## The decision, in plain words

The lost job's runner no longer frees the slices that job was building, and the job that picks up the work is told they are its own to take over. Nothing on the server checks it.

## The intro, for fun

Someone left their towel on the sun lounger and went for a very long swim.

## The punchline, for fun

Only their twin is allowed to move the towel, and the twin has the note to prove it.

## The options, in plain words

A. The lost job's runner releases nothing, the resume's note tells its session to take the claims over, and the resume releases what is left (built)
B. The server records which chain holds a claim, and the claim check refuses any other job
C. Release the lost job's claims as before, and let the resume take them back as any stale claim

## What I had to decide

Keep A, or choose B: the server also records which chain holds each claimed slice, and the claim check refuses any other job's takeover, a larger change to the claim check and the skills.

## What I did meanwhile

runner.ts marks a job lost when the app refuses its report with `failed, runner lost` (api.ts carries the 409's words), and then releases none of its claims when its skill resumes and it was not the third attempt (chainCarriesOn in resume.ts); the sweep does the same for a stranded job, by the chain kept in ~/logs/job-<id>.chain.json. The resume note names the chain's earlier jobs and tells the session to take over a claim naming one of them. A job of a chain that ends releases its own claims and those of the earlier jobs.

## What it costs to change later

B is a new stored shape (a claim's chain on the server) and a change to the claim check and the claim mode of the pull request skill: a migration and three files outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A claim left unreleased reads as held, so another job may still take it over once it has been quiet past the stale-claim limit, before the resume starts: one to five minutes, against an hour today.
- (author) A job whose cancel was asked while its runner was silent ends lost on the app; its claims stay held until the stale-claim limit, since no resume is queued for it.

```

<!-- /omni-outbox-settled: s5-02-chain-holds-claims-on-the-runner -->
