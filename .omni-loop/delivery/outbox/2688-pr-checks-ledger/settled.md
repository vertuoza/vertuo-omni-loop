# Settled outbox items — PRD 2688

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-again-restarts-tries -->

## s1-01-again-restarts-tries — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-again-restarts-tries
prd: 2688
slice: s1
rank: medium
bears-on: none
raised: 2026-11-10
wave: 1
---

## The question, in plain words

When a check is asked again while it is running, does the new run start with all five tries, or only with the tries the old run left?

## The decision, in plain words

The new run starts fresh with all five tries, as a check asked again after it finished does, even when the old run had used its last try.

## The intro, for fun

A check gets a new push halfway through its own homework.

## The punchline, for fun

It starts the new homework with a full pencil case.

## The options, in plain words

A. Start the new run with all five tries, the option built.
B. Keep the old count, and end the check as a failure when the old run used its last try.

## What I had to decide

Whether a check that is asked again while it runs keeps counting its failed tries, or starts over for the newest state of the pull request.

## What I did meanwhile

It starts over: each newest state gets the full five tries, and the old run's tries stay in its history. The same holds when the old run was lost because its worker died.

## What it costs to change later

One line in each of two database functions, changed by a later migration that only replaces them; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the run is queued once more and due at once, and says nothing about its tries (author).
- Keeping the old count would leave a run that failed its 5th try with no try left, so it would have to end as a failure on a state nobody checked (author).

```

<!-- /omni-outbox-settled: s1-01-again-restarts-tries -->

<!-- omni-outbox-settled: s1-02-requeue-waits-five-seconds -->

## s1-02-requeue-waits-five-seconds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-requeue-waits-five-seconds
prd: 2688
slice: s1
rank: medium
bears-on: none
raised: 2026-11-10
wave: 1
---

## The question, in plain words

When a check that already finished is asked again, does it run at once, or after the same five-second pause a brand-new check waits?

## The decision, in plain words

It waits the same five seconds, so a burst of pushes on a pull request whose checks had finished still becomes one run on the latest state.

## The intro, for fun

A finished check hears three pushes in two seconds.

## The punchline, for fun

It waits for the drummer to stop before it plays.

## The options, in plain words

A. Wait five seconds, the option built.
B. Run at once, so a lone event on a finished check is answered five seconds sooner.

## What I had to decide

Whether a finished check, asked again, waits the short pause that gathers a burst of events into one run.

## What I did meanwhile

It waits five seconds, like a new check and like a waiting check that is asked again; a check asked while it runs still goes again at once when it ends.

## What it costs to change later

One value in one database function, changed by a later migration that only replaces it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's table gives the five seconds for a new check and a waiting one, and says only queued again for a finished one (author).

```

<!-- /omni-outbox-settled: s1-02-requeue-waits-five-seconds -->

<!-- omni-outbox-settled: s1-03-lost-last-try-runs-no-hook -->

## s1-03-lost-last-try-runs-no-hook — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-lost-last-try-runs-no-hook
prd: 2688
slice: s1
rank: medium
bears-on: none
raised: 2026-11-10
wave: 1
---

## The question, in plain words

When a check's run is cut off on its fifth and last try, before it could say how it went, who marks the check as failed on the pull request?

## The decision, in plain words

Nobody does yet: the failure step runs only when the fifth try ends with an error. A run cut off on its last try ends failed in the queue, and the health check raises an alert, but the check on the pull request stays in progress.

## The intro, for fun

The runner trips on the last lap, out of sight of the referee.

## The punchline, for fun

The scoreboard still says the race is on.

## The options, in plain words

A. Leave it to the health alert and the next push, the option built.
B. Have the sweep also close, as failed on the pull request, each failed check whose failure step never ran.

## What I had to decide

Whether a check whose last try was cut off should also be closed as failed on the pull request, and by which part of the system.

## What I did meanwhile

The queue marks it failed and the health check turns late, which opens an alert for the team; the check on the pull request stays in progress until the next push asks for it again.

## What it costs to change later

Closing it would take the regular sweep looking for failed checks it never closed, a change in a later slice or a follow-up, not in this one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec runs the failure step on the fifth try that throws, and says nothing of a fifth try that is cut off with no answer (author).
- The worker cannot run it: the cut-off try is noticed by the database at the next claim, not by the worker that was running it (author).

```

<!-- /omni-outbox-settled: s1-03-lost-last-try-runs-no-hook -->

<!-- omni-outbox-settled: s4-01-approved-failure-when-unsure -->

## s4-01-approved-failure-when-unsure — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-approved-failure-when-unsure
prd: 2688
slice: s4
rank: medium
bears-on: none
raised: 2026-11-10
wave: 2
---

## The question, in plain words

The approved check had no failure handler before, so the spec's one for it is new. When the check keeps failing and Omni cannot even tell whether the pull request belongs to an approved PRD, should it still mark the check as failed?

## The decision, in plain words

Yes: if the repository asks for the approved check and Omni cannot tell what the pull request is, the check ends as failed with the reason, rather than staying silent. It stays silent only when it knows the check does not apply.

## The intro, for fun

A smoke alarm that cannot tell whether it is a fire still rings.

## The punchline, for fun

A red check beats a check that never comes.

## The options, in plain words

A. A. Fail the check with the reason when the pull request cannot be classified (built).
B. B. Post nothing when the pull request cannot be classified, leaving the check missing on a pull request that may need it.

## What I had to decide

Pick which side an unreadable pull request falls on: a failed check (built) or no check at all.
Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

A pull request of no PRD in a loop repository could show a red approved check after five failed tries, only when GitHub itself kept failing.

## What it costs to change later

One boolean in the failure hook; flipping it is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says nothing for a pull request whose kind cannot be read (author).

```

<!-- /omni-outbox-settled: s4-01-approved-failure-when-unsure -->

<!-- omni-outbox-settled: s7-02-sweep-runs-every-kind -->

## s7-02-sweep-runs-every-kind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-sweep-runs-every-kind
prd: 2688
slice: s7
rank: medium
bears-on: none
raised: 2026-11-10
wave: 3
---

## The question, in plain words

The quarter-hourly sweep only knew how to run the knowledge pack's work, so it would have dropped a check's work and left the check hanging. Should it run every kind of work, though its file belongs to no slice of this wave?

## The decision, in plain words

The sweep now runs every kind of work with the same handlers the webhook uses. It is a two-line change outside this slice's own files.

## The intro, for fun

The night shift only knew one machine on the factory floor.

## The punchline, for fun

Now it knows all five, so nothing waits for the morning.

## The options, in plain words

A. A. As built: the sweep runs every kind of work, changed in this slice.
B. B. Undo it here and make it a slice of its own.

## What I had to decide

Answer A to keep it in this slice (apps/omni-app/src/jobs/sweep.ts wires liveWorkers), B to move it into a slice of its own before the feature pull request is ready.

## What I did meanwhile

The sweep runs the checks' work: retries, and work whose runner died, are picked up within 15 minutes.

## What it costs to change later

B costs one more sub-pull-request for the same two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gave the sweep to s6, which added the delayed post only; no slice was given the sweep's handlers, and its file is outside s7's territory.

```

<!-- /omni-outbox-settled: s7-02-sweep-runs-every-kind -->

<!-- omni-outbox-settled: s7-03-approval-label-looks-up-once -->

## s7-03-approval-label-looks-up-once — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-approval-label-looks-up-once
prd: 2688
slice: s7
rank: medium
bears-on: none
raised: 2026-11-10
wave: 3
---

## The question, in plain words

When the approval label changes on a PRD, the App looks up that PRD's open pull requests on GitHub once, right after answering, to re-run their approval checks. If GitHub refuses at that moment, should the App try again later, or wait for the next push?

## The decision, in plain words

The lookup runs once and a failure is written to the log. The next push, or a press of Re-run, brings the check back.

## The intro, for fun

The label changed, so someone has to knock on every open door.

## The punchline, for fun

They knock once; if nobody answers, the next push knocks again.

## The options, in plain words

A. A. As built: one lookup right after the answer, logged when it fails.
B. B. A job of its own for the label change, retried like any other, which then re-runs each pull request's check.

## What I had to decide

Answer A to keep it, or B to make the approval's re-run its own kind of job that retries (apps/omni-app/src/webhook/github-route.ts, approvedRerunJobs).
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

A label change re-runs the approval check on every open pull request of the PRD, unless GitHub refuses that one lookup.

## What it costs to change later

B is one more kind of job and its handler, with no stored data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says the webhook refreshes each pull request's approval job but not what happens when GitHub refuses the lookup.

```

<!-- /omni-outbox-settled: s7-03-approval-label-looks-up-once -->

<!-- omni-outbox-settled: s7-04-server-event-runs-checks-at-once -->

## s7-04-server-event-runs-checks-at-once — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-10
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-server-event-runs-checks-at-once
prd: 2688
slice: s7
rank: medium
bears-on: none
raised: 2026-11-10
wave: 3
---

## The question, in plain words

When the server says a product PRD changed, the App re-runs the checks of its pull requests. Should those checks run at once, or wait five seconds as they do after a push?

## The decision, in plain words

They run at once, inside the same background run, which already waits for a burst of server events to settle.

## The intro, for fun

The server rang the bell; the checks could answer now or after a short pause.

## The punchline, for fun

They answer now, since the bell already waited for the crowd.

## The options, in plain words

A. A. As built: the checks are due at once and run in the same background run.
B. B. The checks wait five seconds, and the next webhook or the sweep runs them.

## What I had to decide

Answer A to keep it, B to make them wait five seconds and leave them to the next webhook or the sweep (apps/omni-app/src/server-event/recheck.ts).
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

An approval, a void or an answered question turns the pull request's checks within seconds, with no new push.

## What it costs to change later

A constant: the wait given when the checks are queued.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says the recheck refreshes the jobs but not when they run.

```

<!-- /omni-outbox-settled: s7-04-server-event-runs-checks-at-once -->
