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
- Stays here: This is a slicing choice about which slice wires one field. The default-to-ordinary behaviour is transitional and holds no lasting product guarantee beyond the existing brief rules.

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
- Became: N-PRODUCT-26

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
- Stays here: A temporary wiring order between two slices of one wave, costing one line to change; nothing lasting about the product's behaviour to keep.

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
- Became: BR-PRODUCT-173

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
- Became: BR-PRODUCT-174

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
- Stays here: A one-line wiring choice outside territory; the lasting behaviour (resume once kit is at the fix's release) is already in BR-PRODUCT-139, nothing new to keep.

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
- Became: ADR-0171

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

<!-- omni-outbox-settled: s2-01-one-live-bug-team -->

## s2-01-one-live-bug-team — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-19T19:06:13Z
- Channel: feature pull request #3089
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3089#issuecomment-7019251473
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: P-PRODUCT-52
- Raised: 2026-11-19
- Slice: s2
- Wave: 1
- Became: BR-PRODUCT-171

### The answer, as it was given

```text
A. A. One live bug team across every workspace, a paused one counted (built).
```

### The item, as it was raised

```text
---
id: s2-01-one-live-bug-team
prd: 3088
slice: s2
rank: high
bears-on: P-PRODUCT-52
raised: 2026-11-19
wave: 1
---

## The question, in plain words

The spec says at most one bug team mission runs at a time, but not whether that limit counts every workspace together or each one apart, nor whether a paused team counts as running.

## The decision, in plain words

The database allows one bug team mission that is running, waiting or paused, across every workspace together. A draft or a stopped one does not count, so stopping the old team lets a new one start.

## The intro, for fun

Two bug teams on the same bug would race to fix it twice.

## The punchline, for fun

So the database keeps one team on duty, and a paused one still holds its seat.

## The options, in plain words

A. A. One live bug team across every workspace, a paused one counted (built).
B. B. One live bug team per workspace: two workspaces could each run a team and take the same bugs.
C. C. Count running and waiting teams only: a paused team gives up its seat, and resuming it after another started is refused.

## What I had to decide

Keep one live team across every workspace (A), or count each workspace apart (B), or count running and waiting only, letting a paused team be replaced (C). Each is one partial index in a follow-up migration.

## What I did meanwhile

A second bug team mission is refused when it starts while another, in any workspace, is running, waiting or paused.

## What it costs to change later

Switching later is one migration that swaps one partial index; no row changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The refusal tells a workspace that a team runs somewhere else, which P-PRODUCT-52 asks to keep deliberate; only the Omni Loop repository may run a team (the kit refuses others), so in practice one workspace meets it.
- (author) The App's Start must turn the refusal into a sentence naming why; that is the App's code, not this slice's.

```

<!-- /omni-outbox-settled: s2-01-one-live-bug-team -->

<!-- omni-outbox-settled: s4-01-release-event -->

## s4-01-release-event — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-19T19:06:13Z
- Channel: feature pull request #3089
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3089#issuecomment-7019251473
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: P-PRODUCT-52
- Raised: 2026-11-19
- Slice: s4
- Wave: 2
- Stays here: a setting of the registered Omni App (subscribe it to the release event), not a rule of the product

### The answer, as it was given

```text
A. Subscribe to the release event and sweep hourly as the backup (built).
```

### The item, as it was raised

```text
---
id: s4-01-release-event
prd: 3088
slice: s4
rank: high
bears-on: P-PRODUCT-52
raised: 2026-11-19
wave: 2
---

## The question, in plain words

To know a fix is released, the App has to hear about a published release, which it does not subscribe to today. Should it subscribe, or only look at releases when it sweeps?

## The decision, in plain words

The App's manifest now subscribes to the release event, and the App reads a published release at once. The hourly sweep reads the releases too, so a release the App missed is still caught within the hour.

## The intro, for fun

A bug is only fixed for people once it ships.

## The punchline, for fun

So the App now listens for the ship's horn, and checks the harbour every hour in case it slept through it.

## The options, in plain words

A. Subscribe to the release event and sweep hourly as the backup (built).
B. Do not subscribe: the hourly sweep alone reads the releases, so a fix reads fixed up to an hour late.
C. Read the release from the push of the version commit to the default branch, which the App already hears.

## What I had to decide

Whether to touch the App manifest (apps/omni-app/app.yml, outside this slice's territory) to add one event, or to leave it alone and accept a delay of up to an hour.

## What I did meanwhile

Added release to the manifest's events and to the webhook's handled events, and updated the manifest's test. Someone with the registered App's settings has to tick the release event; until then, only the sweep sees a release.

## What it costs to change later

Removing the event is one line in the manifest and one in the webhook; the sweep keeps working alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a bug turns fixed when the release is published but not whether the manifest may change in this slice.
- (author) The release event needs no new permission: the App already holds contents: write, and the event is ticked by hand in the registered App's settings, as the manifest's header says of every added event.

```

<!-- /omni-outbox-settled: s4-01-release-event -->

<!-- omni-outbox-settled: s5-01-rule-139-way-back -->

## s5-01-rule-139-way-back — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-19T19:06:13Z
- Channel: feature pull request #3089
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3089#issuecomment-7019251473
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-19
- Slice: s5
- Wave: 3
- Became: BR-PRODUCT-139

### The answer, as it was given

```text
A. Change the rule's text as the spec asks, and name the new tests that prove it (built).
```

### The item, as it was raised

```text
---
id: s5-01-rule-139-way-back
prd: 3088
slice: s5
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-19
wave: 3
---

## The question, in plain words

The rule on when a mission sends a stopped PRD again said a PRD stopped on an Omni Loop bug stays stopped until a person steps in. Should the rule now say such a PRD comes back by itself once the fix is released and its repository runs it?

## The decision, in plain words

The rule now says it: once the fix is released and the repository runs that release or a later one, the PRD goes again without spending a repair. With an older kit it waits for the kit to be updated, a paused or stopped mission waits for its own Resume, and a bug closed as not planned leaves the PRD stopped.

## The intro, for fun

A rule that said wait for a person now also says wait for the release.

## The punchline, for fun

The person still gets the last word, it just arrives on the release train.

## The options, in plain words

A. Change the rule's text as the spec asks, and name the new tests that prove it (built).
B. Keep the rule's old text and record the way back as a new rule of its own.

## What I had to decide

Whether the rule's text changes as the spec asks, or the way back becomes a rule of its own. The spec says the rule's text is updated in the same change; the plan says a slice that changes this rule or its proofs records a high item naming it.

## What I did meanwhile

Changed the rule's text, added the PRD's spec to its sources and the two new test files to its proofs. The tests prove the PRD goes again on a kit at the fix's version, waits on an older or unreadable kit, waits for the mission's Resume while paused or stopped, and stays stopped on a bug closed as not planned.

## What it costs to change later

Going back to the old text is one paragraph; the behaviour would then need its own rule, or the code taken back out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rule is not locked, so no owner's approval is required on GitHub; this item is the person's chance to say no.

```

<!-- /omni-outbox-settled: s5-01-rule-139-way-back -->

<!-- omni-outbox-settled: s5-03-held-missions-hear -->

## s5-03-held-missions-hear — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-19T19:06:13Z
- Channel: feature pull request #3089
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/3089#issuecomment-7019251473
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-19
- Slice: s5
- Wave: 3
- Became: BR-PRODUCT-172

### The answer, as it was given

```text
A. The team wakes each paused or stopped mission once; a Resume follows the bug (built).
```

### The item, as it was raised

```text
---
id: s5-03-held-missions-hear
prd: 3088
slice: s5
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-19
wave: 3
---

## The question, in plain words

A mission that stopped on an Omni Loop bug no longer wakes by itself, so it would never hear the bug was fixed. How does it learn, and what does a person's Resume do afterwards?

## The decision, in plain words

The bug team wakes each paused or stopped mission that waited on the bug once, and that mission writes the news in its own room, sending nothing until a person resumes it. After a Resume, a fixed bug still needs the repository's kit at the fix's version, a bug closed as not planned keeps the PRD stopped, and a bug still open goes again as before.

## The intro, for fun

A stopped mission sleeps soundly, even through good news.

## The punchline, for fun

So the bug team knocks once, leaves a note, and lets the person decide when to get up.

## The options, in plain words

A. The team wakes each paused or stopped mission once; a Resume follows the bug (built).
B. A paused or stopped mission hears nothing until a person resumes it, and a Resume sends the PRD again whatever the bug's state, as before.
C. The team writes the news into each waiting mission's room itself, without waking it.

## What I had to decide

How a stopped mission hears that its bug moved, since only a mission that runs or waits checks again each minute, and whether a Resume overrides the bug's state. The spec says a paused or stopped mission waits for its own Resume and the PRD then resumes by the same rule.

## What I did meanwhile

The team, after each of its runs, finds the paused or stopped missions holding a PRD on a bug that was fixed or will not be and that were not told yet, and wakes each by its own job; it writes nothing into another workspace's mission itself. The woken mission records the news once and stays as it was. A Resume follows the bug as described.

## What it costs to change later

Each part is a few lines: the wake is one step after the team's run, and the Resume rule is one check before the new round's.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Only a running team wakes these missions: with no bug team running, a stopped mission hears of the fix at its next Resume.
- (author) The spec does not say whether a Resume should override a bug closed as not planned; keeping it stopped follows the room's words, take this PRD by hand.

```

<!-- /omni-outbox-settled: s5-03-held-missions-hear -->
