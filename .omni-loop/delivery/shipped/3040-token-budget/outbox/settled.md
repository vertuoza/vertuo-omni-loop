# Settled outbox items — PRD 3040

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-budget-edge-rules -->

## s1-01-budget-edge-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-budget-edge-rules
prd: 3040
slice: s1
rank: medium
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

When both caps are reached at once, or a stop is still unanswered but the cap was raised some other way, or a raise was not enough, what should a mission do?

## The decision, in plain words

When both caps are reached, the fleet's cap is named first, so one stop pauses the whole fleet. A mission goes back to work as soon as every cap has room again, answered or not, and a raise that leaves no room asks once more.

## The intro, for fun

Two caps, one mission, and a meter that only goes up.

## The punchline, for fun

The fleet's cap speaks first, because it pauses everyone in one go.

## The options, in plain words

A. A. The fleet's cap first; room under every cap means the mission works again, answered or not; a raise that leaves no room asks again.
B. B. The mission's own cap first, so its own budget is the one the person sees when both are reached.
C. C. An unanswered stop holds the mission until a person answers it, even after the cap gained room.

## What I had to decide

Keep A, or pick B or C: each is a constant in one small function, changed in a line and a test.

## What I did meanwhile

The mission's run follows A: the fleet's cap first, room means work, a short raise asks again.

## What it costs to change later

Low: one pure function, no stored data depends on the order.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say which cap a stop names when both are reached at the same run.
- (author) The spec does not say what happens to an unanswered stop once a pushed brief raises the budget; the mission resumes, and the stop stays unanswered for the next slice to show or close.
- (author) A Resume tomorrow with no known oldest job waits a whole 24 hours from now, and never wakes before now.

```

<!-- /omni-outbox-settled: s1-01-budget-edge-rules -->

<!-- omni-outbox-settled: s3-01-budget-answer-wakes-the-missions -->

## s3-01-budget-answer-wakes-the-missions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-budget-answer-wakes-the-missions
prd: 3040
slice: s3
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

Once a person answers a paused mission's budget question, something must wake the missions it paused and write the person's answer in the room. The plan does not say which part does it.

## The decision, in plain words

The supervisor acts on the answer at each mission's next check: it resumes, sleeps until tomorrow or stops, and says so in the room. The person's own answer row, and waking the missions at once, are left to the Missions tab's answer, as its Pause and Resume do today.

## The intro, for fun

The question was answered, but the mission is still asleep.

## The punchline, for fun

Someone has to knock on the door after saying yes.

## The options, in plain words

A. A. The Missions tab's answer records the person's row and wakes every mission of the stop, and for a fleet's stop every paused mission of the fleet; the supervisor acts on it (built).
B. B. The supervisor also wakes the fleet's other paused missions when it reads an answer to a fleet's stop.
C. C. The database wakes the missions itself when an answer is written.

## What I had to decide

Keep A, so the Missions tab's answer records the person's row and wakes every mission of the stop, or pick another part to do it.

## What I did meanwhile

The supervisor reads the answer at the mission's next check and records only what it does about it: resumed, paused until a time, or stopped by the budget.

## What it costs to change later

Low: waking from the answer is one call per mission in the answer's route, as Resume makes today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's s4 owns the routes that answer a stop, so this slice could not write the person's answer row nor wake the missions from it.
- (author) A mission a fleet's stop did not name (a person had paused it), then resumed and held by that stop, wakes only if the answer wakes every paused mission of the fleet.

```

<!-- /omni-outbox-settled: s3-01-budget-answer-wakes-the-missions -->

<!-- omni-outbox-settled: s3-02-waiting-question-holds-the-mission -->

## s3-02-waiting-question-holds-the-mission — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-waiting-question-holds-the-mission
prd: 3040
slice: s3
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

Some cases are not settled by the spec: a paused mission back under its cap before anyone answers, a mission a person had paused when its fleet's cap was reached, and a stopped mission over a cap.

## The decision, in plain words

A mission the budget paused stays paused until its question is answered, even once back under the cap, and a fleet's stop names only the missions that run or wait. A mission a person paused, or a stopped one, is never asked about and sends nothing over a cap.

## The intro, for fun

The jar refilled overnight, but nobody said the word.

## The punchline, for fun

One question, one answer, and nobody resumes behind your back.

## The options, in plain words

A. A. A waiting question holds the mission until answered; a fleet's stop names the missions that run or wait; a paused or stopped mission is never asked (built).
B. B. A mission back under every cap resumes by itself, its question left open.
C. C. A fleet's stop also names the missions a person paused, so they read as paused by the budget.

## What I had to decide

Keep A, or let a paused mission resume by itself once it is back under every cap without an answer.

## What I did meanwhile

The supervisor tells a pause of its own from a person's by the order of the stop, its own pauses and the person's Pause, and never resumes a mission a person paused.

## What it costs to change later

Low: each case is one line of the run's budget rules and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's section 3 says a person picks Resume tomorrow to wake by itself, but not what happens when the window frees room with no answer.

```

<!-- /omni-outbox-settled: s3-02-waiting-question-holds-the-mission -->

<!-- omni-outbox-settled: s2-01-budget-answer-and-raise -->

## s2-01-budget-answer-and-raise — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-18T10:28:24Z
- Channel: feature pull request #3042
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3042#issuecomment-6975840807
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-12
- Raised: 2026-11-18
- Slice: s2
- Wave: 1
- Became: BR-PRODUCT-166

### The answer, as it was given

```text
A. Any member stops or resumes tomorrow; only an owner raises a cap, above the one reached; a started mission's budget is an owner's to change (built).
```

### The item, as it was raised

```text
---
id: s2-01-budget-answer-and-raise
prd: 3040
slice: s2
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-18
wave: 1
---

## The question, in plain words

The plan did not say who may answer a paused mission's budget question, or who may change a mission's budget once it runs. Who should?

## The decision, in plain words

Any member can stop the mission or resume it tomorrow, but only an owner can raise a cap, and only an owner changes a mission's budget once it has started. Each answer is given once by the person, never by the supervisor.

## The intro, for fun

A mission ran out of tokens and raised its hand.

## The punchline, for fun

Anyone may say stop, but only an owner may top up the jar.

## The options, in plain words

A. Any member stops or resumes tomorrow; only an owner raises a cap, above the one reached; a started mission's budget is an owner's to change (built).
B. Any member may answer in every way, raising a cap included.
C. Only an owner may answer a budget question at all.

## What I had to decide

Keep A, or pick who may raise a cap and who may answer.

## What I did meanwhile

The routes of the Missions tab call these rules as the signed-in person, so the database refuses whoever may not.

## What it costs to change later

Low: each rule is one line in a database function, changed by a small follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says an owner can raise a running mission's budget, but a member's push of the brief can still change its tokens, as it changes any of the mandate today (BR-PRODUCT-138).
- (author) The plan named no functions for setting a mission's budget or answering a stop, nor event kinds for the room's row; this slice added set_mission_tokens, answer_mission_budget_stop, the budget-stop and budget-answer event kinds, and the fleet count's oldest job end that Resume tomorrow needs, since only this slice may add a migration.

```

<!-- /omni-outbox-settled: s2-01-budget-answer-and-raise -->
