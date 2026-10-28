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
- Stays here: A field-length limit set by a constant and one column check, cheap to change by migration; a local implementation choice with no lasting product guarantee.

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
- Stays here: A one-line test update for this feature's new columns; a local choice with no lasting rule, and no entry in the knowledge base covers it.

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
- Stays here: A temporary display condition awaiting the next slice's approve route change; it is mostly about copy on a card and holds nothing lasting.

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

<!-- omni-outbox-settled: s1-01-outcome-recorded-by-member -->

## s1-01-outcome-recorded-by-member — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-27T15:58:21Z
- Channel: feature pull request #2499
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2499#issuecomment-6446794738
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Stays here: an access detail of one function, `rewind_finding_outcome`, which its migration already states; BR-PRODUCT-63 is unchanged
- Rank: high
- Bears on: BR-PRODUCT-63
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
A. The service role or any signed-in member of the finding's workspace, the option built.
```

### The item, as it was raised

```text
---
id: s1-01-outcome-recorded-by-member
prd: 2498
slice: s1
rank: high
bears-on: BR-PRODUCT-63
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Who may write down what became of an approved finding: only the Omni App and the agent working for the team, or any member of the team too?

## The decision, in plain words

The Omni App, or anyone signed in as a member of the finding's team, since the agent on a runner signs in as the member who made its token. Each finding still takes one outcome, once.

## The intro, for fun

An agent and its maker walk into a database, and the database cannot tell which one knocked.

## The punchline, for fun

So both get in, and whoever writes first writes for good.

## The options, in plain words

A. The service role or any signed-in member of the finding's workspace, the option built.
B. The service role only: the s2 endpoint checks the caller is a member, then records the outcome as the service role.
C. Only a session made by a kit token: the database reads the token behind the session, which needs the kit token's session to carry its id.

## What I had to decide

Whether a member signed in by hand may record a finding's outcome, or only the App and the runner's agent.
Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

rewind_finding_outcome() lets in the service role or a signed-in member of the finding's workspace; anyone else is refused (42501). An outcome is written once, so a member cannot rewrite what the agent recorded, nor the reverse.

## What it costs to change later

Narrowing it later is one follow-up migration replacing the function's first check; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec names an agent link, but an agent link (omb_) is read-only and a runner's omni command signs in through a kit token as its maker, so no database check tells the agent from the member

```

<!-- /omni-outbox-settled: s1-01-outcome-recorded-by-member -->

<!-- omni-outbox-settled: s3-01-line-names-the-prd -->

## s3-01-line-names-the-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s3
- Wave: 3
- Became: ADR-0131

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-line-names-the-prd
prd: 2498
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

When a member approves a lesson nobody wrote down, the job sent to the runner names the PRD and the finding, where the spec names the finding alone. Is that right?

## The decision, in plain words

The job names the PRD first, then the finding. The agent can only read a finding through its PRD, and the Runners page files a job under the PRD its line names first, so the job shows with the PRD's other work.

## The intro, for fun

The spec gave the runner a finding's name and nothing else, like a parcel with no street.

## The punchline, for fun

So we wrote the street on it too, and the postman stopped circling.

## The options, in plain words

A. The PRD's number, then the finding's id, the option built.
B. The finding's id alone, as the spec words it, with a new kit command and route that read one finding by its id.

## What I had to decide

Whether the runner's line for an approved knowledge finding names the PRD as well as the finding.

## What I did meanwhile

Approve queues `/omni:rewind-apply <prd> <finding id>` (rewind.approval.ts); the skill, the help entry and the guide take `<prd> <finding>`. The line still carries no text of the finding, as the spec asks. A glossary or Legal finding that names no term or code also goes to the skill, which asks one question for it (the product's knowledge is not a file of the repository).

## What it costs to change later

One line in the approve plan, the skill's input section, one help entry and two lines of the guide; no stored data changes, and a job already queued runs as it was sent.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec words the line `/omni:rewind-apply <finding id>`, but `omni rewind facts` reads findings by PRD and the kit has no way to read one finding by its id
- (author) the spec does not say where a glossary or Legal finding that names no term or code goes once nothing queues /omni:knowledge-add

```

<!-- /omni-outbox-settled: s3-01-line-names-the-prd -->

<!-- omni-outbox-settled: s3-02-outside-territory-facts-and-card -->

## s3-02-outside-territory-facts-and-card — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s3
- Wave: 3
- Stays here: The question is whether one step may reach outside its given ground. That is a one-off delivery choice, and the label wording is copy, not a lasting product guarantee.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-outside-territory-facts-and-card
prd: 2498
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

This step changed two small things the earlier step built, outside the ground it was given. May it?

## The decision, in plain words

Yes: what the kit prints of a finding now keeps its id and whether it is settled, so the agent finds its finding and never settles one twice. The card says the rule is being proposed only on findings sent to the agent, not on glossary or Legal ones.

## The intro, for fun

The new agent got its job and found the address book had torn out every name.

## The punchline, for fun

So it glued the names back in, and tidied the card on the way out.

## The options, in plain words

A. Change both here, each with its test, the option built.
B. Leave both as they were for a follow-up step: until then the skill cannot find its finding, and glossary and Legal cards keep the note.

## What I had to decide

Whether a step may change two files of the earlier step, each with its test, to finish its own job.

## What I did meanwhile

kit/lib/rewind/facts.ts keeps each finding's `id` and `outcome` in `omni rewind facts --json` (tested in kit/bin/rewind.test.ts); MainPane.tsx shows `Proposing the rule…` only when `proposesRule()` of rewind.approval.ts says Approve queued the skill (tested in MainPane.test.ts). This settles what s2-01 left for this step.

## What it costs to change later

Two lines of code and two tests; undoing either is a revert of its line, and no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives kit/lib/rewind/ and the Main tab's card to s2 only, but the skill cannot find its finding without the id, and s2-01 left the card's note for this step

```

<!-- /omni-outbox-settled: s3-02-outside-territory-facts-and-card -->
