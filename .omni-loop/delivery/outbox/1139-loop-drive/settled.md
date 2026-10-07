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

<!-- omni-outbox-settled: s3-01-plan-kept-in-checkout -->

## s3-01-plan-kept-in-checkout — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-plan-kept-in-checkout
prd: 1139
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Where does the loop keep its plan between rounds, and what happens when a round starts and no plan was made yet?

## The decision, in plain words

The plan is kept on the computer running the loop, every version of it. A round that finds no plan makes the first version itself, and naming exactly the plan's PRDs follows the plan too.

## The intro, for fun

A plan nobody can find is just a nice thought.

## The punchline, for fun

So it lives right next to the loop, versions and all.

## The options, in plain words

A. A. One local file per checkout with every version; a round with no plan makes version 1; numbers equal to the plan's PRDs follow it.
B. B. The same file, but a round with no plan refuses and asks for the plan to be made first.
C. C. Keep the plan only in the Omni app, read back on each round.

## What I had to decide

Where the frozen plan lives so each later round reads it, whether a round may make the first version on its own, and whether naming PRDs follows the kept plan or asks for one answer per PRD.

## What I did meanwhile

Every version of the plan is kept in one file in the checkout's local folder, ignored by version control, beside the other local state. Making a plan starts the file over at version 1. A round with no number and no kept plan makes version 1 from your PRDs. Numbers that are exactly the kept plan's PRDs follow it; any other numbers get one answer per PRD, as before.

## What it costs to change later

Small: one file path and two conditions in the command. The loop push slice reads the same file; moving it later means changing both readers, with nothing stored anywhere else.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the plan is saved as version 1 and kept under the local folder, but does not name the file or say which slice writes it; the loop push slice also keeps the loop's id there.
- (author) Whether a loop on one computer should resume a plan made on another is not said; the file is per checkout.

```

<!-- /omni-outbox-settled: s3-01-plan-kept-in-checkout -->

<!-- omni-outbox-settled: s3-02-plan-step-order -->

## s3-02-plan-step-order — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-plan-step-order
prd: 1139
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When two PRDs need the same files, which one goes first, and what is one step of the plan?

## The decision, in plain words

One step is one wave of one PRD, plus a last step that finishes it. The PRD with the lower number goes first, except that a PRD with a stuck slice gives way, and a PRD waiting on a person is passed over while the others carry on.

## The intro, for fun

Two PRDs reach for the same file at once.

## The punchline, for fun

The older one goes first, unless it is stuck in traffic.

## The options, in plain words

A. A. A step per wave plus a finish step; lower number first, stuck PRDs give way; parked PRDs passed over.
B. B. The PRD closest to shipping goes first in a collision.
C. C. A parked PRD holds every later step, and the loop stops at the first parked step.

## What I had to decide

The size of a step, the order between two PRDs whose slices share ground, and what the loop does with the steps of a PRD parked on a person.

## What I did meanwhile

Each PRD's waves become steps in order, then one finish step for the gate and review. Between PRDs, blockers come first, then PRDs with no stuck slice, then the lower number. A step already merged orders nothing. A parked PRD's steps are passed over, and steps that come after them wait; when nothing else can move, the loop stops and says what each PRD waits on.

## What it costs to change later

Small: the order is one sort key in the plan and one rule in following it; plans are recomputed, nothing stored needs moving.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec replaced 'closest to shipping first' with a frozen plan but did not say which PRD goes first in a collision; the lower number is a stand-in for the older PRD.
- (author) The spec says the first step not done is taken; passing over a parked PRD's steps is read from the stop rule, which needs every PRD parked or done.

```

<!-- /omni-outbox-settled: s3-02-plan-step-order -->

<!-- omni-outbox-settled: s5-01-loop-plan-shape-read -->

## s5-01-loop-plan-shape-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-loop-plan-shape-read
prd: 1139
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The Loop page draws each loop's plan, but the plan itself is being written by a part built at the same time. Which shape of plan should the page expect?

## The decision, in plain words

The page expects a list of numbered steps, each naming its PRD, its slice or what it runs, the step it waits on and why, and whether it may run beside another. A plan in any other shape is shown as unreadable, while the ledger and parked PRDs still show.

## The intro, for fun

Two teams building a bridge from both banks hope to meet in the middle.

## The punchline, for fun

This item is the chalk line on the river where they agreed to meet.

## The options, in plain words

A. The page reads numbered steps with prd, slice, wave, action, after (prd, slice, reason) and beside, and shows any other shape as unreadable
B. The page waits for the kit's shape and is changed to read whatever s3 pushes
C. The kit pushes a plan already laid out per PRD for display, and the page draws it without reading steps

## What I had to decide

Whether the kit's loop plan should be pushed as `{steps: [{step, prd, slice?, wave?, action?, after?: {prd, slice?, reason}, beside?}]}`, the shape the page reads.

## What I did meanwhile

The page reads that shape; a plan in another shape shows 'This plan cannot be read here.' and nothing else breaks.

## What it costs to change later

A constant: the reader is one zod schema in `apps/galaxy/src/loop/page/view.ts` (`readPlan`); matching another shape changes that schema only, no migration, since the app stores the plan as it came.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s3 builds `omni next --plan` in the same wave, so its actual JSON could not be read; s3 and s4 should push this shape, or this reader should follow theirs

```

<!-- /omni-outbox-settled: s5-01-loop-plan-shape-read -->

<!-- omni-outbox-settled: s5-02-loop-page-signed-out -->

## s5-02-loop-page-signed-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-loop-page-signed-out
prd: 1139
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The plan says a signed-out visitor to the Loop page sees the demo, while the spec says the page loads like the Engineering page, which shows a sign-in card. Which should a signed-out visitor see?

## The decision, in plain words

A signed-out visitor sees the same sign-in card as on the Engineering page; the demo loops show only where every page shows its demo.

## The intro, for fun

The plan and the spec walked into the same room and pointed at different doors.

## The punchline, for fun

The page took the door every other board already uses.

## The options, in plain words

A. Signed out, the sign-in card, as on the Engineering page
B. Signed out, the demo loops, so a visitor sees what the page shows

## What I had to decide

Whether `/app/loop` signed out shows the sign-in card (as built) or the demo loops.

## What I did meanwhile

Signed out, `/app/loop` and `/app/loop/<id>` show the sign-in card through `MemberGate`; the demo shows in development or under `OMNI_LOOP_DEMO=1`.

## What it costs to change later

A constant: one branch of `viewOf` in `apps/galaxy/app/app/loop/page.tsx` and `[id]/page.tsx` decides it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's 'signed out shows the demo' may have meant the demo session; nobody could be asked

```

<!-- /omni-outbox-settled: s5-02-loop-page-signed-out -->

<!-- omni-outbox-settled: s5-03-switch-test-outside-territory -->

## s5-03-switch-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-switch-test-outside-territory
prd: 1139
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Adding the Loop entry to the menu also changed a test that lists every menu entry, in a file the plan had not given this part. Is that change fine here?

## The decision, in plain words

The slice added the Loop page's address to that test's list, the one change needed to keep it true, and nothing else in that file.

## The intro, for fun

Hang a new picture in the hall and the inventory list needs one more line.

## The punchline, for fun

The line was added; no other picture moved.

## The options, in plain words

A. Keep the one-line change in this slice
B. Move it into a separate change outside the slice

## What I had to decide

Whether `apps/galaxy/src/switch/switch.test.ts`, outside s5's territory, may carry the one added `/app/loop` path.

## What I did meanwhile

It does: one path added to the expected list of sidebar entries, which the test checks each open a page that exists.

## What it costs to change later

A constant: one line of a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan listed `apps/galaxy/src/switch/headers.test.ts` but not its sibling `switch.test.ts`, which lists the same entries

```

<!-- /omni-outbox-settled: s5-03-switch-test-outside-territory -->
