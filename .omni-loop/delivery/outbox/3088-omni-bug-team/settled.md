# Settled outbox items — PRD 3088

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-02-push-sends-kind -->

## s2-02-push-sends-kind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-PRODUCT-138
- Raised: 2026-11-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-push-sends-kind
prd: 3088
slice: s2
rank: medium
bears-on: BR-PRODUCT-138
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The database now files a bug team mission when the pushed brief says it is one, but the page's code that sends a brief today passes only its fleet, goal, measures, scope and mandate. No slice of the plan owns that code, so who makes it send the kind?

## The decision, in plain words

The database reads the kind from the brief, and reads an ordinary mission when the brief names none, so every push today works as before. A bug team brief stays refused for its empty scope until the page's code passes the kind on.

## The intro, for fun

The database learned a new word, but the messenger still leaves it out.

## The punchline, for fun

Until someone adds one field to the message, the bug team cannot be filed.

## The options, in plain words

A. A. The database reads the brief's kind, an ordinary mission when none; the page's push is left for a small extra slice (built).
B. B. The same, and the slice that wires the bug team's run also passes the kind in the page's push.

## What I had to decide

Add the kind to what the page's mission push sends, in a small extra slice of this PRD (A), or let the slice that wires the bug team's run take that one file on (B).

## What I did meanwhile

A push of a bug team brief is refused, naming its scope; every other mission push is unchanged.

## What it costs to change later

One field added to the brief the page sends, and its test; nothing in the database changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The brief's schema gains the kind in slice s1; whether the page's push then passes it depends on that file, which no territory of the plan holds.
- (author) A push never changes a mission's kind: the database refuses it naming the kind, which BR-PRODUCT-138's list of what a push updates leaves out.

```

<!-- /omni-outbox-settled: s2-02-push-sends-kind -->

<!-- omni-outbox-settled: s2-03-bug-fix-and-release-shape -->

## s2-03-bug-fix-and-release-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-bug-fix-and-release-shape
prd: 3088
slice: s2
rank: medium
bears-on: none
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The spec names a bug's fix pull request and the release that holds it, but not how each is stored, nor whether a bug may read fixed without its release.

## The decision, in plain words

A bug keeps its fix pull request as a number on the Omni Loop repository and its release as a plain version number with no leading v. A bug reads fixed only once its release is known.

## The intro, for fun

A version has many spellings, and only one of them is easy to compare.

## The punchline, for fun

So the database keeps the plain one and asks for it before saying fixed.

## The options, in plain words

A. A. A pull request number and a plain version, fixed needing its version (built).
B. B. The pull request's whole link, as a mission's repairs keep it.

## What I had to decide

Keep a number and a plain version, fixed needing its version (A), or keep the pull request's whole link as a mission's repairs do (B).

## What I did meanwhile

The App writes the pull request's number and the version without its v; the room adds the v back when it shows it.

## What it costs to change later

Changing the shape later is one migration and the App's two writers; no bug has a fix yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A mission's repairs keep their fix as a whole link; the bug reports keep their issue as a number on their repository, which this follows.

```

<!-- /omni-outbox-settled: s2-03-bug-fix-and-release-shape -->

<!-- omni-outbox-settled: s3-01-wire-the-team-read -->

## s3-01-wire-the-team-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-wire-the-team-read
prd: 3088
slice: s3
rank: medium
bears-on: none
raised: 2026-11-19
wave: 2
---

## The question, in plain words

The bug team needs to read on GitHub whether each bug's issue is still open and whether a person already has a fix open. The piece of the App that hands that reading to the mission belongs to the other slice of this wave, so who connects it?

## The decision, in plain words

The team's reading is built and tested, but not yet connected where the App starts its missions. Until it is, the bug team takes no bug and says that it cannot read the issues here.

## The intro, for fun

The team has its reading glasses, but they are still in the case.

## The punchline, for fun

One line in the App puts them on, and the team starts reading.

## The options, in plain words

A. A. The wave connects the reading in the App's job list once both slices merged (built: the reading, waiting for that line).
B. B. A later change connects it, and the bug team takes no bug until then.

## What I had to decide

Connect the team's reading in the App's job list after the wave merges (A), or leave it for a later change (B).

## What I did meanwhile

A bug team mission runs, keeps its budget, waits, and names why it takes no bug; every other mission works as before.

## What it costs to change later

One line in the App's job list, beside the other GitHub readers a mission gets; nothing else changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The line belongs to the file the other slice of this wave changes, so this slice left it alone to avoid a clash.
- (author) The line to add passes the team's reading, built from the App's GitHub access, to the mission handler, as its other GitHub readers are passed.

```

<!-- /omni-outbox-settled: s3-01-wire-the-team-read -->

<!-- omni-outbox-settled: s3-02-answered-bug-stays-asked -->

## s3-02-answered-bug-stays-asked — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-answered-bug-stays-asked
prd: 3088
slice: s3
rank: medium
bears-on: none
raised: 2026-11-19
wave: 2
---

## The question, in plain words

When a person answers the question of a bug the team set aside, the bug fix carries on as that person's own job. Should the team follow that job and show the bug as being fixed again?

## The decision, in plain words

The team does not follow it: the bug keeps reading as set aside until its fix is merged or its issue is closed, which the App reads from GitHub. The team never asks about that bug again and never takes it again on its own.

## The intro, for fun

The person answered, and the bug fix went back to work without telling the team.

## The punchline, for fun

The team only hears about it again once the fix lands.

## The options, in plain words

A. A. The answered bug fix stays the person's own job, and the bug reads set aside until GitHub moves it (built).
B. B. The team follows the job that carries the answer, and the bug reads as being fixed again.

## What I had to decide

Leave the answered bug fix as the person's own job, the bug read as set aside until GitHub moves it (A), or have the team find the job that carries the answer and show the bug as being fixed again (B).

## What I did meanwhile

A set-aside bug stays set aside after its answer; its fix pull request, once merged, moves it on as any fix does.

## What it costs to change later

Following the answer later is one more read at the team's wake, of the job that carried the answer on, and a bug moved back to being fixed; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The job that carries an answer on is sent as the person who answered and holds no mission, so it does not count toward the team's budget either.
- (author) The spec says the answer puts the bug back to being fixed; no slice of the plan names who reads that.

```

<!-- /omni-outbox-settled: s3-02-answered-bug-stays-asked -->

<!-- omni-outbox-settled: s3-03-cancelled-fix-set-aside -->

## s3-03-cancelled-fix-set-aside — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: P-PRODUCT-114
- Raised: 2026-11-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-cancelled-fix-set-aside
prd: 3088
slice: s3
rank: medium
bears-on: P-PRODUCT-114
raised: 2026-11-19
wave: 2
---

## The question, in plain words

The spec says a bug fix that ends with nothing the App can read spends one of its three tries and goes back in line. A bug fix a person cancelled ends that way too: should the team try it again?

## The decision, in plain words

A cancelled bug fix sets its bug aside for a person, spending no try, and the team never takes it again on its own. A person stopped it on purpose, and a mission never retries stopped work by itself.

## The intro, for fun

Someone pulled the plug on a bug fix on purpose.

## The punchline, for fun

So the team leaves the plug out until a person puts it back.

## The options, in plain words

A. A. A cancelled bug fix sets its bug aside for a person, no try spent (built).
B. B. A cancelled bug fix spends a try and its bug goes back in line, as a failure does.

## What I had to decide

Set a cancelled bug fix's bug aside for a person (A), or count it as a failed try and put the bug back in line (B).

## What I did meanwhile

A cancelled bug fix sets its bug aside, and the room says a person decides what comes next.

## What it costs to change later

One line of the team's reading of how a bug fix ended; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's rule for an ending the App cannot read was written for a failure, not for a person's cancel.
- (author) A mission of PRDs never sends a cancelled step again either: this follows it.

```

<!-- /omni-outbox-settled: s3-03-cancelled-fix-set-aside -->

<!-- omni-outbox-settled: s5-02-kit-read-wiring -->

## s5-02-kit-read-wiring — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-19
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-kit-read-wiring
prd: 3088
slice: s5
rank: medium
bears-on: none
raised: 2026-11-19
wave: 3
excuses: [apps/omni-app/src/jobs/pr-checks.ts]
---

## The question, in plain words

To resume a PRD once its bug is fixed, the App has to read which kit the customer's repository runs, and the place that hands each App job what it may read lies outside this slice. Should the slice add that one line?

## The decision, in plain words

Yes: the slice added one line there, so the mission job can read the kit a repository runs. Without it a PRD whose bug was fixed would always ask for a kit update and never resume.

## The intro, for fun

The App learned to read a kit version, but nobody had handed it the glasses.

## The punchline, for fun

One line later, it reads the label on the jar.

## The options, in plain words

A. Add the one line that hands the mission job its kit read (built).
B. Leave the file alone: a PRD whose bug was fixed always reads update the kit until a later change adds the line.

## What I had to decide

Whether to touch the file that builds the App's job handlers, outside this slice's territory, or ship a resume that cannot read the kit until a later change. Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Added the kit read to the mission job's dependencies, next to the bug team's issue read the previous wave added the same way. It reads only the repository's own bin file, near its start, and only while a PRD waits on a fixed bug.

## What it costs to change later

Removing it is one line; a PRD would then wait on the kit until a person updates and resumes it by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists the kit read in no slice's territory: the job handlers' file belongs to no slice of this PRD.

```

<!-- /omni-outbox-settled: s5-02-kit-read-wiring -->

<!-- omni-outbox-settled: s5-04-one-event-kind -->

## s5-04-one-event-kind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-19
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-one-event-kind
prd: 3088
slice: s5
rank: medium
bears-on: none
raised: 2026-11-19
wave: 3
---

## The question, in plain words

The room learns three things about a bug a mission waited on: it is fixed, it will not be fixed, or the PRD went again. Should all three use the one new kind of event the database has for this?

## The decision, in plain words

Yes: all three are bug-fixed events, each with its own sentence and a link to the public issue. The fix and the not-planned news come once per bug; the resume comes once, when the PRD is sent again.

## The intro, for fun

Three pieces of news, one envelope.

## The punchline, for fun

The letter inside says which one, so nobody has to guess from the stamp.

## The options, in plain words

A. All three as bug-fixed events, told apart by their sentence (built).
B. Add a fourth kind for the not-planned news and the resume, with a migration.

## What I had to decide

Which event kind carries the not-planned news and the resume, since the spec names only bug-fixed among the new kinds and the older kinds already have one-per-PRD meanings.

## What I did meanwhile

Recorded all three as bug-fixed, each keyed so a replay records none twice: the news by the first repair that met the bug, the resume by the step sent again. The room's slice reads them by their sentences.

## What it costs to change later

Splitting them later takes a migration widening the kinds and a change to the room's reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's section 7 names the three new kinds but not which one carries the not-planned news or the resume.

```

<!-- /omni-outbox-settled: s5-04-one-event-kind -->
