# Settled outbox items — PRD 839

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-app-read-workspace-choice -->

## s1-01-app-read-workspace-choice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-app-read-workspace-choice
prd: 839
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When two workspaces both track the same repository, whose business should the canon check read?

## The decision, in plain words

It reads the business of the workspace whose GitHub organisation owns the repository, and otherwise the one that started tracking it first. The read also says when the claims or personas last changed, so the check can skip the model when nothing moved.

## The intro, for fun

Two workspaces, one repository, and only one business gets to judge the spec.

## The punchline, for fun

The owner of the house sets the rules at the table.

## The options, in plain words

A. The workspace of the organisation that owns the repository, then the oldest tracker.
B. Only the owning organisation's workspace; any other tracker reads as no business.
C. Read every tracking workspace and merge their claims.

## What I had to decide

Whether the owning organisation's workspace is the right one to judge a phase-0 spec when a repository is tracked twice.

## What I did meanwhile

The read picks the owning organisation's workspace, then the oldest tracker; it also carries the latest change time for the check's cache.

## What it costs to change later

Changing the pick is one line in the read's ordering, in a follow-up migration; no data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'by repository'; nothing in it settles a repository tracked by two workspaces (author).

```

<!-- /omni-outbox-settled: s1-01-app-read-workspace-choice -->

<!-- omni-outbox-settled: s3-01-canon-cache-in-instance -->

## s3-01-canon-cache-in-instance — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-canon-cache-in-instance
prd: 839
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Where should the canon check remember a verdict, so that re-running it on an unchanged spec does not ask the model again?

## The decision, in plain words

It remembers verdicts in the running App while it stays warm. A re-run shortly after costs nothing, but after a quiet spell the first run asks the model once more.

## The intro, for fun

The check has a good memory, as long as nobody lets it fall asleep.

## The punchline, for fun

After a nap it asks the same question once, politely.

## The options, in plain words

A. A. Remember verdicts in the running App only, lost on a cold start.
B. B. Store verdicts in a database table, kept across restarts.
C. C. Read the verdict back from the previous check run on the same commit.

## What I had to decide

Whether a verdict must be remembered across restarts of the App, which needs a new stored table, or whether remembering it while the App is warm is enough.

## What I did meanwhile

The verdict is kept in memory, keyed by the repository, the spec's fingerprint and the claims' latest change, up to 200 verdicts.

## What it costs to change later

Moving it to a stored table is a small migration and a new read and write in the canon module; nothing already stored moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for a cache but does not say where it lives, and the plan keeps this slice out of the database (author).

```

<!-- /omni-outbox-settled: s3-01-canon-cache-in-instance -->

<!-- omni-outbox-settled: s3-02-canon-small-model-fixed -->

## s3-02-canon-small-model-fixed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-canon-small-model-fixed
prd: 839
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Which model should the canon check ask, when the team has already chosen a bigger model for the retro?

## The decision, in plain words

The canon check always asks the same small, cheap model the business draft uses, whatever model the team set for the retro and the knowledge harvest.

## The intro, for fun

Two models live in the App: one writes essays, one reads specs.

## The punchline, for fun

The quick reader gets the spec; the essayist keeps the retro.

## The options, in plain words

A. A. Always the small model the business draft uses.
B. B. The retro's model setting when it is set, else the small model.
C. C. A setting of its own for the canon check.

## What I had to decide

Whether the canon check should follow the model setting the retro uses, or have its own setting.

## What I did meanwhile

It asks the small model named in the canon module, and ignores the retro's model setting.

## What it costs to change later

One constant, or one new setting read from the environment.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the small model through OpenRouter but names no setting to change it (author).

```

<!-- /omni-outbox-settled: s3-02-canon-small-model-fixed -->

<!-- omni-outbox-settled: s3-03-canon-one-persona-line -->

## s3-03-canon-one-persona-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-canon-one-persona-line
prd: 839
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When a spec breaks several claims, should each break get its own persona's objection, or should one persona speak for the whole spec?

## The decision, in plain words

One persona, the one the spec fits worst, gives a single line under all the breaks, so the Rewrite button can name that one person.

## The intro, for fun

Three breaks, a whole cast of personas, and only one microphone.

## The punchline, for fun

The most annoyed customer gets to speak first.

## The options, in plain words

A. A. One persona line for the whole spec.
B. B. One persona line under each break.

## What I had to decide

Whether the check lists one persona line per break or one for the whole spec.

## What I did meanwhile

The model names one persona and one line for the whole spec; the line is kept only when that persona exists in the business.

## What it costs to change later

A change to the model's answer shape and the summary lines in the canon module; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's verdict says each break lists one line from the persona it fits worst, which reads either way (author).

```

<!-- /omni-outbox-settled: s3-03-canon-one-persona-line -->
