# Settled outbox items — PRD 1139

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-answers-after-build -->

## s1-01-answers-after-build — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-answers-after-build
prd: 1139
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When a person answers the open questions while slices are still being built, should the loop rework right away or finish building first?

## The decision, in plain words

The loop finishes building every slice first, then picks up the answers and reworks. Answers to decisions already adopted without asking are not yet read by this step.

## The intro, for fun

Someone answered while the builders were still hammering.

## The punchline, for fun

The loop reads the answers once the walls are up.

## The options, in plain words

A. Finish building first, then rework on the answers; objections to adopted decisions wait for the rework skill.
B. Rework as soon as an answer lands, even mid-build.
C. Finish building first, and also count objections to adopted decisions as answers.

## What I had to decide

Whether answers posted mid-build should interrupt the waves, and whether an objection to an adopted decision should wake the rework step.

## What I did meanwhile

The answer check only counts once every slice is merged, and it reads the open questions as they stand on the feature branch, matched against the replies on the feature PR. Objections to adopted decisions are left to the rework skill when it runs.

## What it costs to change later

Small: one condition in the verdict and one extra read of the settled ledger. No stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people often answer mid-build, and whether an objection to an adopted decision alone should start a rework.

```

<!-- /omni-outbox-settled: s1-01-answers-after-build -->

<!-- omni-outbox-settled: s1-02-wake-and-stuck -->

## s1-02-wake-and-stuck — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-wake-and-stuck
prd: 1139
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

How long should the loop sleep when it has to wait, and what should it do when a slice is stuck and nothing else can move?

## The decision, in plain words

It looks again in 5 minutes while checks run or GitHub cannot be read, and in 20 minutes while another session holds a slice. A stuck slice with nothing else to take parks the work on a person.

## The intro, for fun

Every loop needs a snooze button.

## The punchline, for fun

Five minutes for machines, twenty for people, a sticky note when truly stuck.

## The options, in plain words

A. 5 minutes for checks and GitHub, 20 for claims; a stuck slice parks on a person.
B. Shorter hints (2 and 10 minutes); a stuck slice parks.
C. The same hints, but a stuck slice waits instead of parking.

## What I had to decide

The wake hint for each kind of wait, in seconds, and whether a stuck slice parks or waits.

## What I did meanwhile

The hints are 300 seconds for running checks or an unreadable GitHub and 1200 for a claim held elsewhere; a stuck slice parks with the feature PR's link. A PRD with no plan or no feature PR yet is handed to yolo.

## What it costs to change later

A constant each; parking versus waiting is one row of the verdict.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How quickly checks usually finish here, and whether a stuck slice is ever unstuck without a person.

```

<!-- /omni-outbox-settled: s1-02-wake-and-stuck -->

<!-- omni-outbox-settled: s2-01-loop-silent-before-first-wake -->

## s2-01-loop-silent-before-first-wake — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-loop-silent-before-first-wake
prd: 1139
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When a loop has just started and has not yet said when it will wake next, how long do we wait before calling it silent?

## The decision, in plain words

We call it silent one hour after the last thing it told us, since a first round can build a whole wave before it reports back.

## The intro, for fun

A loop that never says goodnight is hard to call asleep.

## The punchline, for fun

So we give it one hour of benefit of the doubt.

## The options, in plain words

A. Silent one hour after its last push, the option built.
B. Silent five minutes after the start, like any missed wake, so the kit must send a wake with the start.
C. Never silent before the first wake: a person stops it by hand.

## What I had to decide

How long a loop with no next wake yet reads live before the Loop page shows it silent and a take-over is allowed.

## What I did meanwhile

One hour after its last push, the same rule in the database and on the page: one interval and one constant to change.

## What it costs to change later

One interval in the migration and one constant in the page's state rule.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec only defines silent as five minutes past the next wake, and says nothing of a loop before its first wake
- (author) a tick that runs longer than five minutes past its planned wake also reads silent while it works, as the spec's rule says; the kit could push a tick at the start of each action to avoid it

```

<!-- /omni-outbox-settled: s2-01-loop-silent-before-first-wake -->

<!-- omni-outbox-settled: s2-02-loop-park-and-stop -->

## s2-02-loop-park-and-stop — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-loop-park-and-stop
prd: 1139
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

What does it mean for a loop to park a PRD, and what happens to a loop once it has stopped?

## The decision, in plain words

Parking a PRD notes who it waits on and keeps the loop running; the loop ends parked when it stops with PRDs still waiting, and a stopped loop takes nothing more, so running it again starts a new loop.

## The intro, for fun

Every loop needs a way to say it is waiting on you.

## The punchline, for fun

Then it goes home, and tomorrow is a fresh loop.

## The options, in plain words

A. Park marks one PRD, stop ends the loop parked or stopped, an ended loop is never resumed: the option built.
B. Park ends the whole loop at once, as soon as any PRD waits on a person.
C. An ended loop can be resumed by its next run, keeping one loop and one ledger across stops.

## What I had to decide

Whether park ends the loop or only marks one PRD, whether a PRD that moves again leaves the parked list, and whether a stopped loop can be resumed.

## What I did meanwhile

Park marks one PRD and the loop carries on; a later round of that PRD takes it off the list; stop ends the loop parked or stopped; a push to an ended loop is refused, so the next run starts afresh. The app numbers each new plan version itself.

## What it costs to change later

The rules live in one database function and its fake; changing them is a new migration replacing that function, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says park and stop set the loop's state, and the Loop page's parked state means stopped with PRDs waiting; how a resumed run after a stop should read is not said

```

<!-- /omni-outbox-settled: s2-02-loop-park-and-stop -->
