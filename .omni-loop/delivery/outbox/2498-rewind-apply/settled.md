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

<!-- omni-outbox-settled: s2-01-proposing-the-rule-note -->

## s2-01-proposing-the-rule-note — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-proposing-the-rule-note
prd: 2498
slice: s2
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

Until the rule is written, an approved finding that came from knowledge nobody wrote down shows the note that the rule is being proposed. Should a finding about a glossary term or a Legal entry, which never gets a rule written this way, show it too?

## The decision, in plain words

Any approved finding that started in knowledge and has no outcome yet shows the note, as the spec words it, since the card cannot tell a glossary or Legal finding from a playbook one.

## The intro, for fun

A card promises a rule is on its way, and for some findings nobody is walking there.

## The punchline, for fun

So the promise stands until the next slice learns who is going.

## The options, in plain words

A. A. Show it on every approved knowledge finding with no outcome, the option built.
B. B. Show it only when Approve queued the rewind-apply skill, which needs the finding to carry what Approve sent.
C. C. Show it on none until the skill exists, so nothing promises a rule that no one is writing.

## What I had to decide

Whether the note appears on every approved knowledge finding with no outcome, or only on those that queue the rewind-apply skill.
Decided by: Jev (hardToRevert 0.52) · agent said false

## What I did meanwhile

The card shows Proposing the rule... on every approved finding with origin knowledge and no outcome, as the spec words it. A glossary or Legal finding files its proposal and never records an outcome, so it keeps the note until the approve route changes in the next slice.

## What it costs to change later

Narrowing it is one condition in the card, once the approve route says which findings queue the skill; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the finding the card receives does not say whether Approve queued the skill or filed a proposal, and the spec words the note for every approved knowledge finding

```

<!-- /omni-outbox-settled: s2-01-proposing-the-rule-note -->
