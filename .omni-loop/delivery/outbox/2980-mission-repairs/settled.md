# Settled outbox items — PRD 2980

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-fingerprint-computed-again-by-the-app -->

## s1-01-fingerprint-computed-again-by-the-app — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-fingerprint-computed-again-by-the-app
prd: 2980
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

When a repair names the cause of a failure, should the Omni App trust the cause's label the runner wrote, or work it out again itself?

## The decision, in plain words

The Omni App works the label out again from the cause's own words every time, so one cause always gets one label and a runner can never dodge the limit of three repairs by writing a new one.

## The intro, for fun

Every failure gets a name tag, and the question is who is allowed to write it.

## The punchline, for fun

The runner fills in the tag, and the App checks the handwriting.

## The options, in plain words

A. The App computes the fingerprint again from the retro and keeps its own, a sha256 in 64 hex characters (built).
B. The App keeps the fingerprint the runner wrote, as long as it is 64 hex characters.
C. The App refuses a record whose fingerprint differs from its own computation, which then reads as unreadable and spends one repair.

## What I had to decide

Whether the record line's fingerprint is taken as the runner wrote it, or computed again from the retro's class, place and signature when the App reads it, and the fingerprint's shape.

## What I did meanwhile

A fingerprint is a sha256 in lowercase hex, 64 characters. repairLine() requires the runner's fingerprint to be of that shape and to agree with its retro's, then replaces it with fingerprint(retro), in the record, the retro and the report alike, so the cap counts what the App computed.

## What it costs to change later

A constant: drop the recomputation in repairLine() and the record keeps the runner's value. The 64-character shape is what s2's mission_repairs and omni_bug_reports columns must hold; changing it later is a column check, not a data migration, while the tables are empty.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the retro holds the fingerprint but not how a runner computes it: no omni command in any slice's territory prints one, so s3's skill must write some 64-hex value, which the App then replaces.
- (author) The fingerprint's length is not in the spec; s2 builds the column in the same wave and was not yet started when this was chosen.

```

<!-- /omni-outbox-settled: s1-01-fingerprint-computed-again-by-the-app -->

<!-- omni-outbox-settled: s1-02-public-report-scrubs-wide-and-strict-record -->

## s1-02-public-report-scrubs-wide-and-strict-record — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-public-report-scrubs-wide-and-strict-record
prd: 2980
slice: s1
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

How much should the public bug report cut from an error message, and how strict should the App be with a repair's record before it trusts it?

## The decision, in plain words

The report cuts wide: every path, file name, repository name, login, email, link, commit hash and any name of the workspace the App knows, keeps the command without its arguments and at most 300 characters; a record that contradicts its own retro is read as unreadable.

## The intro, for fun

A bug report going public is like a postcard: anyone at the sorting office can read it.

## The punchline, for fun

So we write the weather and leave the home address off.

## The options, in plain words

A. Scrub wide, keep the command alone, cut at 300 characters, and read a self-contradicting record as unreadable (built).
B. Scrub only the spec's list (paths, repository names, logins, emails, URLs, tokens), keep the command's arguments, and read any well-formed record.
C. Scrub wide but read a self-contradicting record by trusting its retro over its other fields.

## What I had to decide

What scrub() removes beyond the spec's list, which fields it reduces, and which inconsistencies make repairLine() read a record as unreadable.

## What I did meanwhile

scrub() also takes the names the caller knows the workspace by (owner, repositories, logins) and removes them wherever they stand; it removes bare file names with a code extension, commit hashes and ids; it keeps only the leading skill or omni command (/omni:yolo, omni runner work), never its arguments; and it cuts the message at 300 characters. It refuses on any leftover path, email, URL, login or token-shaped string. repairLine() reads as unreadable a record whose class or fingerprint differs from its retro's, a fix on a class other than code, or a report on a class other than omni-loop or whose message is not clean.

## What it costs to change later

Constants and patterns in kit/lib/repair/sensitive.ts and scrub.ts, and four refinements in line.ts: each loosens with a one-line change and no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Over-scrubbing loses words a maintainer would want, such as Node.js read as a file name; nothing in the spec weighs a useful report against a safe one, so it leans safe.
- (author) An unreadable record spends one repair (spec section 4), so a strict reader charges the runner's mistakes to the cause's budget.

```

<!-- /omni-outbox-settled: s1-02-public-report-scrubs-wide-and-strict-record -->

<!-- omni-outbox-settled: s2-01-repair-in-the-database-first -->

## s2-01-repair-in-the-database-first — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-repair-in-the-database-first
prd: 2980
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
excuses: [apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts, apps/galaxy/src/virtual-fleets/roles-sql.test.ts, supabase/checks/virtual_fleets.sql]
---

## The question, in plain words

The plan asked this step to let a runner take a repair job, but the app's and the kit's lists of runner jobs can only name a repair once the repair skill itself exists, which a later step writes. How much of it belongs here?

## The decision, in plain words

The database side is done here: it knows a repair is one of the loop's own jobs, gives it a place at the front of the queue and lists it among the Engineer's skills. The app and the kit learn the name with the step that writes the skill, and a test holds the two sides together until then.

## The intro, for fun

The guest list says Repair is coming, but Repair has not been born yet.

## The punchline, for fun

So the doorman learns the name today, and the badge is printed the day Repair shows up.

## The options, in plain words

A. A. The database knows repair now, and the app, the kit and the guide learn it with s3, held together by two tripwire tests: the option built.
B. B. Leave repair out of the database here, and let s3 add the lists and a second migration of its own.
C. C. Write a placeholder repair skill here so every list can name it at once.

## What I had to decide

Whether the database may know the repair job one step before the app and the kit do, and whether the three test files this step changed outside its ground stay as changed.

## What I did meanwhile

The migration adds repair to the database's list of the loop's own skills and to the Engineer's default skills (an Engineer still on its default takes it), takes a PRD's repair job under the key mission:<id>:prd:<n>:repair:<k>, and claims it with the resumes, before any fresh job. The app's list (RUNNER_SKILLS), the kit's (RUNNABLE_SKILLS), the kit's roles and the guide's Runners sentence stay as they were: the guide's guard refuses a skill with no folder, and s3 makes the folder. Two tests that hold the database's lists to the app's and the kit's now expect them plus repair, so adding repair to one side alone still fails, and adding it where s3 adds it fails until those two lines read equal again. Outside the plan's ground: runners.ultra-skills.migration.test.ts and roles-sql.test.ts (they named the PM's migration as the newest) and supabase/checks/virtual_fleets.sql (a new Engineer's skills).

## What it costs to change later

A constant: s3 adds repair to RUNNER_SKILLS, RUNNABLE_SKILLS, the Engineer in kit/lib/virtual-fleet/roles.ts, the guide's Runners sentence and runners.skills.migration.test.ts's addedLater list, and turns the two tripwire lines back to plain equality. No migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s3's territory holds kit/lib/virtual-fleet/roles but not kit/lib/runner/line.ts, apps/galaxy/src/runners/ or docs/guide/runners.md, so s3 will cross its ground too
- (author) where in the Engineer's list repair sits: last, here, which s3's kit list must match

```

<!-- /omni-outbox-settled: s2-01-repair-in-the-database-first -->

<!-- omni-outbox-settled: s2-02-repair-round-given-by-the-supervisor -->

## s2-02-repair-round-given-by-the-supervisor — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-repair-round-given-by-the-supervisor
prd: 2980
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

Each cause may be repaired three times per round, and a person's Resume opens a new round. Who says which round a repair belongs to?

## The decision, in plain words

The mission's supervisor names the round on each repair it records. The database counts three per cause inside whatever round it is given, and nine for the whole mission across every round, so even a wrong round never lets a mission run more than nine repairs.

## The intro, for fun

Three tries per round sounds fair, until someone gets to decide when a round starts.

## The punchline, for fun

So the referee may call a new round, but the clock on the wall still stops at nine.

## The options, in plain words

A. A. The supervisor names the round, and the database caps three per cause within it and nine in all: the option built.
B. B. The mission keeps its own round counter, which Resume moves, and the database fills the round itself.
C. C. No rounds in the database: it caps nine per mission only, and the three per cause is the supervisor's alone.

## What I had to decide

Whether the round stays a number the supervisor gives, or becomes the mission's own counter that the database moves on each Resume.

## What I did meanwhile

mission_repairs.round is an integer, 1 by default, given on insert. The database refuses a 4th repair of one fingerprint in the same mission and round, and a 10th repair of the mission in all rounds, a lost repair apart. Nothing in the database opens a round: the Resume of a stopped PRD (s5, s6) passes the next round.

## What it costs to change later

A small migration: a repair_round column on missions, moved by Resume, and the budget trigger reading it instead of the caller's number. The rows already written keep their round.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says a Resume opens a new round but not whether it is the mission's Resume or a stopped PRD's
- (author) today a mission's Resume moves a paused mission only, so the round cannot hang on it yet

```

<!-- /omni-outbox-settled: s2-02-repair-round-given-by-the-supervisor -->

<!-- omni-outbox-settled: s2-03-how-a-repair-ends -->

## s2-03-how-a-repair-ends — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-how-a-repair-ends
prd: 2980
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The spec names a repair ending fixed or not fixed, and says a lost repair spends nothing. How does a repair end when it stops the work instead, or when its runner is lost for good?

## The decision, in plain words

A repair ends one of four ways: fixed, not fixed, stopped (it handed the work to a person or reported an Omni Loop bug) or lost. A lost one gives its turn back, so the next repair of the same cause takes its place; the other three count against the three and the nine.

## The intro, for fun

Every repair gets a last line, even the ones that wandered off mid-sentence.

## The punchline, for fun

And the one that wandered off does not count against anybody.

## The options, in plain words

A. A. Four endings, where a lost repair spends nothing and a stopped one spends one: the option built.
B. B. A stopped repair spends nothing either, like a lost one.
C. C. Only the spec's two endings; a lost repair's row is deleted instead.

## What I had to decide

Whether stopped and lost are the right two words beside the spec's fixed and not fixed, and whether a stopped repair should count against the budget.

## What I did meanwhile

mission_repairs.outcome takes fixed, not fixed, stopped or lost, null while it runs; the database dates its end, and once set nothing of the row changes. The budget counts every repair but the lost ones, and a lost one's number is free again.

## What it costs to change later

A constant: the outcome's check and the budget trigger's one condition, changed in a small migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether a person or omni-loop repair, which ends the PRD, spends one of the three

```

<!-- /omni-outbox-settled: s2-03-how-a-repair-ends -->

<!-- omni-outbox-settled: s3-02-repair-skill-no-cli -->

## s3-02-repair-skill-no-cli — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-repair-skill-no-cli
prd: 2980
slice: s3
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

The repair skill cannot call a kit command to compute a cause's fingerprint or to scrub its public report, because none exists. Is that acceptable for now?

## The decision, in plain words

The skill has the runner compute the fingerprint and write the report by hand, and the App computes and scrubs again, so a mistake never reaches the public repository. For a PRD that spans repositories, the skill follows the multi-repository bug fix, which takes no base branch yet.

## The intro, for fun

The recipe is written down, but nobody built the kitchen gadget yet.

## The punchline, for fun

For now the cook does the sums by hand.

## The options, in plain words

A. A. The skill works by hand and the App checks again, as built.
B. B. A later slice adds the omni repair commands and the base branch for the multi-repository bug fix.

## What I had to decide

Whether to add omni repair commands (retro check, fingerprint, scrub) and a base branch to the multi-repository bug fix in a later slice.

## What I did meanwhile

The skill describes each step in words and relies on the App's second computation and second scrub, so nothing unsafe is sent.

## What it costs to change later

A later slice adds the commands and the skill swaps its words for them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives this slice the skill folder and the bug fix only, not the command table or the multi-repository bug fix.

```

<!-- /omni-outbox-settled: s3-02-repair-skill-no-cli -->

<!-- omni-outbox-settled: s5-02-repair-fix-landing-rules -->

## s5-02-repair-fix-landing-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-repair-fix-landing-rules
prd: 2980
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

When a repair's fix cannot go onto the mission's branch, should the work stop or wait, and what should it say?

## The decision, in plain words

A fix whose checks failed, that was closed, or that the merge refused stops the work and says why in the words the merge gave; a fix still being checked, or still a draft, waits. The files in conflict are not listed, since the merge does not name them.

## The intro, for fun

The fix knocked on the branch's door, and the door had opinions.

## The punchline, for fun

Now it leaves a note saying which opinion it was.

## The options, in plain words

A. Red, closed or refused stops the PRD with the merge's reason; a draft or running checks wait.
B. A conflicting fix is compared with the mission branch to name its files before the PRD stops.
C. A red fix waits too, until a person or a later run makes it green.

## What I had to decide

How judgeFix (apps/omni-app/src/missions/repair.ts) and land (repair-run.ts) treat a code repair's fix pull request. Merged into the mission branch: landed, the step goes again. Green, open, not a draft, into the mission branch: squash-merged through the joins' merge, never into the default branch. A failed check, a closed pull request, another base, or a merge GitHub refuses: the PRD stops, saying why. A draft, a check still running or not judged, or no check at all: it waits, read again each run. A mission at with-you has no branch of its own, so its code fix stops the PRD. The spec asks that a conflict name its files, as a landing does; GitHub's merge refusal gives a reason, not files, so the PRD names that reason. The fix's reviews and outbox are not read: it is a bug fix, not a PRD.

## What I did meanwhile

Built as decided and tested (supervisor.repair.test.ts, repair.test.ts). A fix that waits is read again every run, so one a person repairs lands on its own.

## What it costs to change later

Each rule is one line of judgeFix; naming the files would read the fix's conflict through the keeping-up compare, a change in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a conflicting fix stops the PRD and names its files, and the merge refusal names none.

```

<!-- /omni-outbox-settled: s5-02-repair-fix-landing-rules -->

<!-- omni-outbox-settled: s5-03-repair-budget-counting -->

## s5-03-repair-budget-counting — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-repair-budget-counting
prd: 2980
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

Three counting questions the spec left open: when does a new round of repairs start, how is a repair whose report cannot be read counted, and what happens to a repair of a cause that already used its three?

## The decision, in plain words

A new round starts each time a person resumes a mission that had stopped, and a repair that left no readable report counts against the PRD it repaired, so three of those stop it. A cause that already used its three is found out only once its retro runs, so that retro still runs and nothing it proposes is applied.

## The intro, for fun

Counting to three sounds easy until someone asks which three.

## The punchline, for fun

The abacus now has a rule for every bead.

## The options, in plain words

A. A round per Resume of a stopped mission, unreadable repairs counted per PRD, and a 4th retro that runs and applies nothing.
B. The repair skill is told which causes are spent and stops after its retro, so no fix pull request is opened for them.
C. Every Resume opens a round, a paused mission's included.

## What I had to decide

Three choices in apps/omni-app/src/missions/repair.ts and repair-run.ts. The round is roundOf(events): 1, and one more for each resumed event that follows the mission's own stopped event, since the database takes the round from the supervisor. A record line that cannot be read, a repair job that failed, or a record naming another mission or PRD is kept under one fingerprint per PRD (unreadableFingerprint), ends not fixed and spends one of the mission's 9; three such in a round stop that PRD. The supervisor cannot know a failure's fingerprint before its retro, so a 4th failure of a spent cause still sends a repair: its retro runs, the database refuses its row, and the PRD stops with the cause, what was tried, the proposed fix and how to resume; a fix pull request that repair opened is never landed.

## What I did meanwhile

Built as decided: the caps hold in the supervisor and in the database alike, and every count is tested on the fake fleet (repair.test.ts).

## What it costs to change later

Each is a constant or one function: the round rule, the fingerprint an unreadable record is kept under, or passing the spent fingerprints to the repair skill so it stops after its retro.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a 4th failure of a repaired cause sends no repair, but the cause is known only from the retro the repair writes, so the retro runs once more.
- (author) The spec does not say whether a Resume after a pause opens a round.

```

<!-- /omni-outbox-settled: s5-03-repair-budget-counting -->

<!-- omni-outbox-settled: s5-04-repair-resume-and-report-names -->

## s5-04-repair-resume-and-report-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-repair-resume-and-report-names
prd: 2980
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

After a person resumes a mission, what happens to work its repair stopped for a person or for an Omni Loop bug, and which names does the public bug report hide?

## The decision, in plain words

In the new round that work runs its step again, since the person has acted, and while a repair runs the mission's status line says so. The public report hides the owner and name of every repository of the workspace and every person named on the mission's history, on top of what the first scrub removes.

## The intro, for fun

A person said carry on, and the mission wondered how far back to rewind.

## The punchline, for fun

One step back, and the names stay home.

## The options, in plain words

A. The step again after a Resume, names from repositories and the mission's events, repairing shown in the status line.
B. A new repair after a Resume, and every workspace member's login read for the scrub.

## What I had to decide

Three choices of apps/omni-app/src/missions/. In a newer round, a PRD whose repair ended stopped (a person's question, an Omni Loop bug, a code cause with no fix) is sent its step again rather than a new repair. scrub()'s known list is the mission's repository, every repository of the workspace (owner and name) and the logins on the mission's events (store.names), not every member of the workspace, which the App's mission store does not read. A repairing PRD is named in the mission's waiting_on, as a provider-limit wait is, so a waits event may say a PRD is repairing.

## What I did meanwhile

Built as decided and tested on the fake fleet (repair.test.ts, store.repair.test.ts).

## What it costs to change later

Each is a line: send a repair instead of the step after a Resume, read the workspace's members' logins too, or leave repairing out of waiting_on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what a Resume does to a PRD stopped by a person's question or an Omni Loop bug.
- (author) The slice's notes ask for the workspace's login names, and the mission store reads no member list.

```

<!-- /omni-outbox-settled: s5-04-repair-resume-and-report-names -->

<!-- omni-outbox-settled: s6-01-resume-moves-a-stopped-mission -->

## s6-01-resume-moves-a-stopped-mission — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-resume-moves-a-stopped-mission
prd: 2980
slice: s6
rank: medium
bears-on: none
raised: 2026-11-17
wave: 4
---

## The question, in plain words

The Stopped block offers Resume, and until now only a paused mission could resume: may Resume also carry a stopped mission on?

## The decision, in plain words

Resume now moves a stopped mission back to running, which opens a new round where each cause gets three repairs again, and the page shows the button only once a stopped mission has repairs to explain.

## The intro, for fun

The Resume button waited at the door of a room only paused missions could enter.

## The punchline, for fun

Now a stopped mission gets a key too, but only one with a story to tell.

## The options, in plain words

A. A. Resume moves a stopped mission too, through the existing route.
B. B. A stopped mission is taken by hand only, and the block names Resume without a button.

## What I had to decide

The spec says Resume of a stopped mission opens a new round, and the supervisor already counts a Resume that follows a stop as a new round, but the Resume route took paused missions only. I added stopped to the statuses Resume moves, inside the missions folder, and the Missions tab and Operation room show the button only for a stopped mission whose repairs explain the stop.

## What I did meanwhile

Built as the spec asks: Resume in the Stopped block calls the existing resume route.

## What it costs to change later

Reverting is one word in the table of moves, and the Resume button then shows but the route answers that a stopped mission cannot resume.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not name the route Resume uses for a stopped mission.

```

<!-- /omni-outbox-settled: s6-01-resume-moves-a-stopped-mission -->

<!-- omni-outbox-settled: s6-02-waits-on-omni-loop-without-met-by-count -->

## s6-02-waits-on-omni-loop-without-met-by-count — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-17
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-17
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-waits-on-omni-loop-without-met-by-count
prd: 2980
slice: s6
rank: medium
bears-on: none
raised: 2026-11-17
wave: 4
---

## The question, in plain words

The page for a PRD that waits on an Omni Loop bug draws how many missions met it, but a workspace cannot read that count: may the page leave it out?

## The decision, in plain words

The Waits on Omni Loop line names the bug and links it, and leaves out the line saying how many missions met it, because that count lives in a table no signed-in person can read.

## The intro, for fun

The page wanted to say how many missions shared its bad luck.

## The punchline, for fun

The count lives behind a door that rightly stays locked.

## The options, in plain words

A. A. The line names and links the bug, with no count.
B. B. The App writes the count onto the event, and the page shows Met by n missions.

## What I had to decide

The before and after page draws Met by 2 missions under the bug link, but the count is a column of the Omni Loop bug table, which names no workspace and which nobody signed in may read. I linked the issue from the bug-reported event and left the count out, instead of reading the table with a service key.

## What I did meanwhile

Built as the spec asks for the link and the state word, without the count.

## What it costs to change later

Adding it later is a read of a count the App would copy onto the bug-reported event, then one line on each page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say where a workspace reads the count from.

```

<!-- /omni-outbox-settled: s6-02-waits-on-omni-loop-without-met-by-count -->
