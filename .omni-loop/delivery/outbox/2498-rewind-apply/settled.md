# Settled outbox items — PRD 2498

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-outcome-note-shape -->

## s1-02-outcome-note-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-outcome-note-shape
prd: 2498
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

How long may the words of an outcome be: the name of the rule that already says it, and the question asked?

## The decision, in plain words

The name of a rule is one line of at most 200 characters. A question may take up to 2000 characters, on several lines if it needs them, so it can carry the option the agent would take.

## The intro, for fun

A rule's name should fit on a sticky note; a good question sometimes needs the whole napkin.

## The punchline, for fun

So the rule gets the sticky note, and the question gets the napkin.

## The options, in plain words

A. A rule of one line, 200 characters at most; a question of 2000 characters at most, on several lines, the option built.
B. Both one line of at most 500 characters, as a rejection's reason.
C. No limit beyond the column's 2000 characters for either.

## What I had to decide

The limits on the note of an outcome: the rule that already says it, and the question.
Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

rewind_finding_outcome() trims the note; an already said takes one line of at most 200 characters, a question at most 2000 characters on any number of lines; anything longer is refused (22023, note). The column refuses more than 2000 either way.

## What it costs to change later

A constant in the function and one column check; a follow-up migration changes either.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no written rule says how long a rule's id or a question to a person may be; 200 and 2000 follow the rewind's own limits (a reason of 500, a finding's text of 4000)

```

<!-- /omni-outbox-settled: s1-02-outcome-note-shape -->

<!-- omni-outbox-settled: s1-03-main-watch-types-test -->

## s1-03-main-watch-types-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-main-watch-types-test
prd: 2498
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

May this step change one line of an earlier feature's test, which lists every column of the findings table, so it names the three new columns?

## The decision, in plain words

Yes: the earlier test pins the exact list of a finding's columns, so the three new ones turned it red. Its expected list now names them, and nothing else in it changed.

## The intro, for fun

The old test knew every column by heart and panicked when three new ones walked in.

## The punchline, for fun

We introduced them properly, and it calmed down.

## The options, in plain words

A. Update the pinned list with the three columns, the option built.
B. Loosen the earlier test to check only the columns PRD 2410 added, so later columns never touch it again.

## What I had to decide

Whether a slice may update another feature's test that pins the columns of the table it extends.
Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

main-watch.migration.test.ts, outside this slice's territory, expects the generated row of rewind_findings with outcome, outcome_note and outcome_pr; a comment names PRD 2498 as their source.

## What it costs to change later

One line of a test; undoing it means loosening the test to the columns it owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no written rule says whether a slice may touch another feature's test that pins a shared table's columns

```

<!-- /omni-outbox-settled: s1-03-main-watch-types-test -->
