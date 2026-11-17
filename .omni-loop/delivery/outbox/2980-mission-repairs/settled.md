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
