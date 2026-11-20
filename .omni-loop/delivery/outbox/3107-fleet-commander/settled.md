# Settled outbox items — PRD 3107

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-types-and-ci-step-outside-territory -->

## s1-01-types-and-ci-step-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-types-and-ci-step-outside-territory
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The plan gave this slice its new table but not the two files every new table also needs: the generated list of the database's shapes and the line that runs its check on each pull request. Should the slice carry them?

## The decision, in plain words

The slice carries both: the regenerated list of shapes, exactly as the generator writes it, and one more step in the database workflow that runs the new check.

## The intro, for fun

The plan packed the table and forgot its passport and its boarding pass.

## The punchline, for fun

The slice brought both, so customs waves it through.

## The options, in plain words

A. A. As built: the slice carries the regenerated database types and the workflow step for its check.
B. B. The slice carries neither; the wave regenerates the types and adds the step after merging.
C. C. The slice carries the workflow step only; the types wait for the wave.

## What I had to decide

A keeps the database's shapes and its check in step with the table they describe, as ADR-0169 and the conventions form (a new database check runs in CI) already ask; B leaves both to the wave, which then regenerates and adds the step after merging. Sources: vertuo-omni-loop/ADR-0169, conventions form › A new database check runs in CI.

## What I did meanwhile

The sub-PR carries supabase/database.types.ts regenerated from main's migrations plus this slice's, and a new step in .github/workflows/supabase.yml running supabase/checks/commander_messages.sql.

## What it costs to change later

Undoing it is deleting one workflow step and regenerating one file: minutes, no data touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The local database was brought up to the branch's migrations with supabase migration up, not restarted fresh: the generated file adds only this slice's table and functions to main's, which the workflow's type check confirms on the feature pull request. (author)

```

<!-- /omni-outbox-settled: s1-01-types-and-ci-step-outside-territory -->

<!-- omni-outbox-settled: s1-02-reply-written-by-the-app-alone -->

## s1-02-reply-written-by-the-app-alone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-reply-written-by-the-app-alone
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The spec says who may read the Commander's thread but not who writes its replies. Should a reply be saved by the app alone, or by the member who asked, under their own sign-in?

## The decision, in plain words

A member's question is saved under their own sign-in, signed with their name; the Commander's reply is saved by the app alone, so no member can ever write words the Commander signs.

## The intro, for fun

Anyone could sign the Commander's name, if the pen were left on the desk.

## The punchline, for fun

The pen now stays in the app's pocket.

## The options, in plain words

A. A. As built: the question under the member's sign-in, the reply by the app alone.
B. B. Both under the member's sign-in, through a function that accepts one reply per question from its asker.

## What I had to decide

A keeps the Commander's signature trustworthy: only the app, after its model call and its link filter, writes a reply, and the database refuses a reply from anyone signed in. B writes the reply under the asker's own sign-in, as the Ask classifier writes its guessed category (BR-PRODUCT-40), which needs no service key but lets a member write a reply by hand. Sources: L-AIACT-1, never#10, vertuo-omni-loop/BR-PRODUCT-40, the missions' events, written by the service role alone.

## What I did meanwhile

Replies are written with the service role key the missions already use; a deployment without it answers that the Commander is not available there.

## What it costs to change later

Switching to B is one database function and one line of the app's wiring; no stored reply changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A reply's links are also held by the database to the app's own pages and GitHub, whoever writes it. (author)

```

<!-- /omni-outbox-settled: s1-02-reply-written-by-the-app-alone -->

<!-- omni-outbox-settled: s1-03-record-reads-waiting-and-ended-missions -->

## s1-03-record-reads-waiting-and-ended-missions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-record-reads-waiting-and-ended-missions
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

The spec has the Commander read the last events of each running mission. A mission waiting on a person, paused, or one that ended overnight is not running: should the Commander read its events too?

## The decision, in plain words

It reads the last 50 events of every mission that runs, waits or is paused, and of every mission that ended in the last 24 hours, with the jobs of all of them; the cap on one message's input still holds.

## The intro, for fun

A mission waiting on you is the one you most want to ask about.

## The punchline, for fun

Skipping it because it is not running would be like ignoring the patient in the waiting room.

## The options, in plain words

A. A. As built: missions that run, wait or are paused, and those that ended in the last 24 hours.
B. B. Running missions only, as the spec words it.
C. C. Running, waiting and paused missions, none that ended.

## What I had to decide

A answers what members ask most (what waits on me, what happened overnight, why did it stop), which a waiting, paused or just-ended mission holds; B reads running missions only, as the spec words it, and the Commander then answers that it found nothing about them.

## What I did meanwhile

The record holds every mission that runs, waits or is paused and those that ended in the last 24 hours, at most 50 events each, trimmed first when one message's input would pass 40,000 tokens.

## What it costs to change later

Narrowing it is one line of the rules; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's own example, PRD 2817 waiting on a review, is a mission that waits rather than runs. (author)

```

<!-- /omni-outbox-settled: s1-03-record-reads-waiting-and-ended-missions -->

<!-- omni-outbox-settled: s1-04-tab-words-not-in-the-spec -->

## s1-04-tab-words-not-in-the-spec — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-tab-words-not-in-the-spec
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

Three small things on the Commander tab the screens do not show: what the status line says when the fleet has no daily token limit, what a suggested question does when clicked, and how a source's own line is shown.

## The decision, in plain words

With no daily limit the status line says no daily token cap; clicking a suggested question asks it at once; and a source shows its record's own line when the pointer rests on it.

## The intro, for fun

Forty-one percent of no limit at all is a hard number to draw.

## The punchline, for fun

So the line just says there is no cap.

## The options, in plain words

A. A. As built: no daily token cap, a suggestion asks at once, the record line on hover.
B. B. The status line hides the tokens when there is no cap, and a suggestion only fills the box.
C. C. As A, with the record line also shown on tap, in a small popover.

## What I had to decide

A keeps each to the smallest change: words for a state the screens do not draw, one click for a first question, and the browser's own hover text; B and C name the other ways a person might prefer.

## What I did meanwhile

The tab shows these three as built; the rail, the Message fleet mode and the Notebooks button come with the later slices.

## What it costs to change later

Each is a line or two of the tab; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Design review: a source's record line shows on hover only, not on a tap on a phone; a tap opens the record itself. (author)
- Design review: the screens were judged from the source and the component renders, as the demo world has no Virtual Fleet and no preview of this slice is deployed. (author)

```

<!-- /omni-outbox-settled: s1-04-tab-words-not-in-the-spec -->

<!-- omni-outbox-settled: s1-05-model-id-allowed-in-agent-words-guard -->

## s1-05-model-id-allowed-in-agent-words-guard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-model-id-allowed-in-agent-words-guard
prd: 3107
slice: s1
rank: medium
bears-on: none
raised: 2026-11-20
wave: 1
---

## The question, in plain words

A test keeps the agent's brand name out of what a person reads, with a short list of places allowed to name it. Should the place that names the Commander's model join that list?

## The decision, in plain words

The Commander's model file joins the list, beside the business-law judge that calls the same model, with its reason: the model it calls, by its id. Nothing a person reads names it.

## The intro, for fun

The model has a name, and the guard at the door checks every name.

## The punchline, for fun

This one is on the guest list, with a note saying why.

## The options, in plain words

A. A. As built: the Commander's model file joins the guard's list, with its reason.
B. B. The Commander reuses the business-law judge's model constant, so no new place names the model.

## What I had to decide

A follows how the classifier, the suggestion and the business-law judge already name their models; B would hide the id from the guard, which only makes the check mean less (never#3).

## What I did meanwhile

The guard's list gains one line, outside the slice's planned territory, for the file that names the Commander's model.

## What it costs to change later

Removing the line is one edit, and the guard then fails until the model is named another way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The model's id is a constant in the code and never reaches a screen. (author)

```

<!-- /omni-outbox-settled: s1-05-model-id-allowed-in-agent-words-guard -->
