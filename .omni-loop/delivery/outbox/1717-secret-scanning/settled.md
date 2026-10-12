# Settled outbox items — PRD 1717

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-security-report-summary-line -->

## s2-01-security-report-summary-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-security-report-summary-line
prd: 1717
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The spec says the daily watch titles its issue with what is wrong, but not where that wording comes from, nor how the check finds which repository to read.

## The decision, in plain words

The check ends its report with one summary line, green or red with what is wrong, for the watch to reuse as its issue title. It reads the repository name from the loop's settings file on its own, so the watch can run it without installing anything first.

## The intro, for fun

Every alarm needs a headline, and this one writes its own.

## The punchline, for fun

One line to read, and nothing to install before reading it.

## The options, in plain words

A. A. One summary line last, and the repository name read directly from the settings file, with nothing to install (built)
B. B. No summary line: the watch builds its own title from the report's lines
C. C. Read the settings file with the loop's shared reader, which needs an install before each daily run

## What I had to decide

Keep the summary line as the last line of the report, in the shape security settings: green, or security settings: red: followed by each problem; the watch slice uses it as its issue title. Keep reading the repository name directly from the settings file.

## What I did meanwhile

The watch slice can take the last line of the report as the issue title, after the words Security settings.

## What it costs to change later

Changing the wording later is one line in the check and one in its tests; switching to the shared settings reader means installing the tools before every daily run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The watch slice is not built yet, so whether it will use the summary line as its title is not proven here.

```

<!-- /omni-outbox-settled: s2-01-security-report-summary-line -->

<!-- omni-outbox-settled: s3-01-security-watch-red-run-and-title -->

## s3-01-security-watch-red-run-and-title — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-security-watch-red-run-and-title
prd: 1717
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The spec says the daily watch opens or updates one issue when something is wrong, but not whether the run itself should also show as failed, what time it runs, or whether the issue's title changes when the problem changes.

## The decision, in plain words

The watch runs every morning before the working day, and a bad day also shows as a failed run. When the issue is already open, the new report is added as a comment and the title stays as it was first written.

## The intro, for fun

An alarm that rings once a day had better ring before the coffee.

## The punchline, for fun

The headline stays put; the news goes in the comments.

## The options, in plain words

A. Daily at 06:17 UTC, the run fails on red, the open issue keeps its first title (built)
B. The run stays green on red: the issue is the only signal
C. As A, and the open issue's title is rewritten to the latest problem on each red day

## What I had to decide

Keep the daily run at 06:17 UTC, fail the run on red as well as opening or updating the issue, and leave an open issue's title as first raised while each new report is commented on it.

## What I did meanwhile

The workflow is built that way, with a small first job that only says whether the read token is set, because a job's condition cannot read a secret directly.

## What it costs to change later

Each choice is one line of the workflow and its test: the time, the final failing step, or an extra title edit when commenting.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a red day should also fail the run; its risk about an expiring token turning one daily run red suggests it should, so it does.

```

<!-- /omni-outbox-settled: s3-01-security-watch-red-run-and-title -->

<!-- omni-outbox-settled: s4-01-agents-md-push-protection-line -->

## s4-01-agents-md-push-protection-line — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-agents-md-push-protection-line
prd: 1717
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The repository's short guide for agents repeats the list of things never to do. Should it also say never to get around the check that refuses a push holding a secret?

## The decision, in plain words

The new rule went only into the briefing, which agents are told to read first and which wins over the guide. The guide was left as it is, because this piece of work may not change it.

## The intro, for fun

One list of rules, two places it is written down.

## The punchline, for fun

Copies drift apart the moment nobody is looking.

## The options, in plain words

A. The rule lives in the briefing only, as built.
B. Add the same line to the guide's Never list too, in a follow-up change.

## What I had to decide

Choose A to keep the rule in the briefing only, or B to add the same line to the guide's list in a small follow-up change.

## What I did meanwhile

Agents read the briefing before any change, so they meet the rule; an agent that reads only the guide would not.

## What it costs to change later

B is one line in one file, undone just as easily.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether AGENTS.md is meant to mirror every Never line of the briefing, or only a selection, is not written down anywhere I read (author).

```

<!-- /omni-outbox-settled: s4-01-agents-md-push-protection-line -->
