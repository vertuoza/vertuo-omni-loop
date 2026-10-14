# Settled outbox items — PRD 1934

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-help-count-test -->

## s1-01-help-count-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-help-count-test
prd: 1934
slice: s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Adding the new command meant changing the number of commands that a help test counts, in a test file the slice's plan did not list. Is that small change outside the slice's area fine?

## The decision, in plain words

The count in that test went from 57 to 58 commands, and nothing else in the file changed. Without it the whole test run stays red.

## The intro, for fun

One new command walked in, and the head count at the door was off by one.

## The punchline, for fun

Someone had to update the guest list, and the guest list was in the next room.

## The options, in plain words

A. Keep the count at 58 in this slice, the one change outside its area (built).
B. Move the count change into a slice of its own, merged with this one.
C. Widen the plan's area for this slice to include the help table's test, after the fact.

## What I had to decide

Whether a slice that adds a command may update the help table's command count, which lives in a test file beside the help entries but not listed in the slice's area.

## What I did meanwhile

The count reads 58 and the help table test is green; the rest of that test file is untouched.

## What it costs to change later

One number in one test; no behaviour depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists the help entries and the help command's test but not the help table's own test, which counts every command; whether it was left out on purpose is not settled (author).

```

<!-- /omni-outbox-settled: s1-01-help-count-test -->

<!-- omni-outbox-settled: s1-02-tier-unknown-agent -->

## s1-02-tier-unknown-agent — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-tier-unknown-agent
prd: 1934
slice: s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

When someone asks which model a tier runs on for a coding agent the kit does not know, should the answer be an error, or simply 'use the terminal's model'?

## The decision, in plain words

It is an error that names the unknown agent, the same way an unknown tier is refused. A misspelled agent name then shows up at once instead of quietly running every slice on the terminal's model.

## The intro, for fun

A stranger asked which model to use, and the kit asked for their name first.

## The punchline, for fun

Better a polite no at the door than a silent mix-up inside.

## The options, in plain words

A. Refuse an unknown agent, exit 2, naming it (built).
B. Print inherit for an unknown agent, exit 0, as for a known agent with no row.

## What I had to decide

What the tier command does when the agent it is given is none of the agents the kit knows; the spec only says what an unknown tier does.

## What I did meanwhile

An unknown agent exits 2 with a line naming it and the agents the kit knows; a known agent with no row in the config prints inherit, as the spec says.

## What it costs to change later

One branch in one command: turning the error into inherit is a two-line change and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the exit for an unknown tier but not for an unknown agent; the wave always passes its own agent, so the case only arises from a typo (author).

```

<!-- /omni-outbox-settled: s1-02-tier-unknown-agent -->

<!-- omni-outbox-settled: s2-01-tier-tests-beside-the-commands -->

## s2-01-tier-tests-beside-the-commands — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-tier-tests-beside-the-commands
prd: 1934
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The spec asked for the new tier tests in two test files that also prove existing rules. Should they live there, or beside the commands people run?

## The decision, in plain words

I put the tests beside the plan check and board commands instead, so the files that prove existing rules stay untouched and no rule review is triggered.

## The intro, for fun

Two test files guard old rules like museum pieces, so the new tests found another room.

## The punchline, for fun

Same checks, different shelf, and no alarm went off.

## The options, in plain words

A. A. Keep the tier tests in the command and parser test files, as built.
B. B. Move them into the lib test files the spec named, with a high item accounting for the law-proof change.

## What I had to decide

Where the slice's tests for the tier column live: in the two rule-proving test files the spec named, or in the command tests and the parser tests.

## What I did meanwhile

The tier column is proven by kit/lib/inbox/territory.test.ts (parsing, unknownTiers), kit/bin/plan.test.ts (plan check passes deep, build, light, blank and em dash, refuses fast by slice and value) and kit/bin/board.test.ts (board --json gives each slice its tier or null). kit/lib/inbox/plan-grade.test.ts and kit/lib/board.test.ts are unchanged: omni check coverage reads any edit to them as a change to a law's proof, which only a high item can account for.

## What it costs to change later

A constant: moving the tests into the lib test files later is a copy and an account, no code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the coverage check should treat an added test in a rule-proving file as a law change at all is a question for the check, not this slice (author).

```

<!-- /omni-outbox-settled: s2-01-tier-tests-beside-the-commands -->

<!-- omni-outbox-settled: s2-02-one-test-line-outside-the-territory -->

## s2-02-one-test-line-outside-the-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-one-test-line-outside-the-territory
prd: 1934
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

Giving every slice a tier made one older test, outside this slice's ground, stop compiling. Was it right to add the one missing line there?

## The decision, in plain words

I added the one line that test needed, saying its slices advise no tier, rather than making the tier optional on every slice.

## The intro, for fun

A new field arrived and one old test forgot to set a place for it at the table.

## The punchline, for fun

One chair added, nobody else moved.

## The options, in plain words

A. A. Keep the tier always present, with the one fixture line outside the territory, as built.
B. B. Make the tier optional on a slice and drop the fixture line.

## What I had to decide

Whether to make a slice's tier always present (as the spec's done-when writes it) and add `tier: null` to the one hand-built fixture in kit/lib/flow/plan-rules.test.ts, or make the field optional and leave that file alone.

## What I did meanwhile

The tier is always present on a parsed slice, and kit/lib/flow/plan-rules.test.ts gains the line `tier: null,` in its slice builder: a territory breach of one line, reported at merge, changing no assertion.

## What it costs to change later

A constant: making the field optional later is a one-word type change and dropping that line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the s3 slice or a later PRD builds more slices by hand in tests, which would each need the same line (author).

```

<!-- /omni-outbox-settled: s2-02-one-test-line-outside-the-territory -->
