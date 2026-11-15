# Settled outbox items — PRD 2896

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-level-notes-wording -->

## s1-01-level-notes-wording — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-level-notes-wording
prd: 2896
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The drawer greys out the higher levels for a member who is not an owner, and the screen did not say what to write beside them. Is the wording right?

## The decision, in plain words

A short line under the choice says why a level is greyed out, naming the owner or the three roles it needs. Switching a needed role off while Works alone is chosen moves the choice to Own branch.

## The intro, for fun

Some doors need a key, and this one at least says whose.

## The punchline, for fun

A greyed-out choice with no reason is just a riddle.

## The options, in plain words

A. A. Keep the two lines as built.
B. B. Show no line: the disabled choice speaks for itself.

## What I had to decide

Read the two lines on the New virtual fleet drawer and keep or reword them in the fleet-new screen.

## What I did meanwhile

The lines ship as written; changing a word later is a one-line edit.

## What it costs to change later

A reword costs one constant in the drawer and one line in the screen file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The screen left the wording beside the disabled levels open (author).

```

<!-- /omni-outbox-settled: s1-01-level-notes-wording -->

<!-- omni-outbox-settled: s2-01-level-inherited-by-the-database -->

## s2-01-level-inherited-by-the-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-level-inherited-by-the-database
prd: 2896
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

A mission's brief may leave its level out. Who fills it in with the fleet's level: the skill that writes the brief, or the database when the brief is stored?

## The decision, in plain words

The database fills it in from the fleet when the brief names none, so a mission is never left without a level. The skill writes the level when it is told one, and otherwise the brief reads Reviews with you until the database stores it.

## The intro, for fun

A form left blank still gets a name on the door.

## The punchline, for fun

Better a default written down than a guess made later.

## The options, in plain words

A. A. The database fills the level in from the fleet (built).
B. B. The skill reads the fleet's level and writes it, with a new command and route.

## What I had to decide

Whether the skill must read the fleet's level itself, which needs a new way for the kit to read a fleet from the Omni page.

## What I did meanwhile

The database trigger takes the fleet's level when the brief has none, and the Missions tab shows the level the database stored.

## What it costs to change later

Reading the level in the skill later costs one command and one route; the trigger can stay as the fallback.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit has no command that reads a fleet from the Omni page, and the territory names none (author).

```

<!-- /omni-outbox-settled: s2-01-level-inherited-by-the-database -->

<!-- omni-outbox-settled: s2-02-prds-on-branch-read-from-events -->

## s2-02-prds-on-branch-read-from-events — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-prds-on-branch-read-from-events
prd: 2896
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Lowering a mission to Reviews with you is refused while PRDs sit on its branch. Where does the count of those PRDs come from before the branch exists?

## The decision, in plain words

The count reads the mission's join, drop and landing events, so it is zero today and the refusal starts to apply once the next slices record those events. The branch name in the message is the mission's number and its title in words.

## The intro, for fun

A guard posted before the door is built still stands in the right place.

## The punchline, for fun

The count is zero until someone actually joins the branch.

## The options, in plain words

A. A. Count from the join, drop and landing events (built).
B. B. Count the PRDs whose pull request targets the mission branch.

## What I had to decide

Whether to count PRDs another way, such as a stored branch name, once the branch is cut.

## What I did meanwhile

The refusal is written and tested on events a test records; no real mission can trip it yet.

## What it costs to change later

Changing where the count is read costs one function in the missions repository and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The event names prd-joined, prd-dropped and landed are the spec's; the database accepts them only once the branch slices add them (author).

```

<!-- /omni-outbox-settled: s2-02-prds-on-branch-read-from-events -->

<!-- omni-outbox-settled: s3-01-app-checks-on-mission-branch-prs -->

## s3-01-app-checks-on-mission-branch-prs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-app-checks-on-mission-branch-prs
prd: 2896
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The spec says the app's own checks (outbox, budgets, business laws) run on a pull request into a mission branch as on one into main. Which slice changes the webhook that decides this?

## The decision, in plain words

Only the checks workflow runs for pull requests into a mission branch in this slice. The app's own checks still skip them, because the webhook that picks pull requests lies outside every slice's territory.

## The intro, for fun

The guard at the main gate does not yet know the side door has a number.

## The punchline, for fun

Until someone tells the webhook, the side door is checked by the workflow alone.

## The options, in plain words

A. A. Leave the webhook; a later slice adds mission branches to its filter (built).
B. B. Add the filter now, in this slice, outside its territory.

## What I had to decide

Which later slice adds the mission branches to the webhook's list of pull requests that get the app's checks.

## What I did meanwhile

The checks workflow runs on pull requests into mission branches; the webhook is left as it is.

## What it costs to change later

Changing the webhook later costs one small filter and its tests, in a slice whose territory lists the webhook.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No slice's territory names the webhook file (author).

```

<!-- /omni-outbox-settled: s3-01-app-checks-on-mission-branch-prs -->

<!-- omni-outbox-settled: s3-02-branch-cut-by-the-first-run -->

## s3-02-branch-cut-by-the-first-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-branch-cut-by-the-first-run
prd: 2896
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The spec says Start refuses when the repository does not allow rebase merges. Start is a page and a route outside this slice, so where is the setting checked?

## The decision, in plain words

The mission's first run after Start cuts the branch and checks the setting. With rebase merges off it cuts nothing, sends no PRD, and the mission waits naming the setting.

## The intro, for fun

A door with no lock still needs someone to check it before the party.

## The punchline, for fun

Better a polite wait than a branch nobody can land.

## The options, in plain words

A. A. The mission's first run cuts the branch and checks the setting; the mission waits naming it (built).
B. B. The Start route checks the setting and refuses at once, the run only cuts.

## What I had to decide

Whether Start itself, in the page's route, should also refuse on the setting.

## What I did meanwhile

The mission's job asks GitHub through the app, cuts the branch from the default branch once, and leaves an existing branch untouched.

## What it costs to change later

Refusing in the route as well costs one call to GitHub in the Start route and one test; the run's check can stay as the second guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The territory names no file of the Start route (author).

```

<!-- /omni-outbox-settled: s3-02-branch-cut-by-the-first-run -->

<!-- omni-outbox-settled: s4-01-gate-reads-every-check -->

## s4-01-gate-reads-every-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-gate-reads-every-check
prd: 2896
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The merge gate needs every required check green, but a mission branch has no list of required checks. Which checks count, and what about one that was skipped?

## The decision, in plain words

Every check on the pull request's latest commit counts. A check that was skipped, cancelled or ended without a verdict holds the merge as not judged, so a pull request whose checks were all skipped waits for a person instead of joining.

## The intro, for fun

A guard with no list of names checks everybody at the door.

## The punchline, for fun

Better a guest kept waiting than a stranger let in.

## The options, in plain words

A. A. Every check on the head counts, and a skipped one holds the merge (built).
B. B. Every check counts, but a skipped one passes, as main's required checks treat it.
C. C. Only a list of required checks named in the repository's config counts.

## What I had to decide

Keep every check on the head as the gate's list, skipped ones held as not judged, or name a list of required checks for mission branches.

## What I did meanwhile

The gate reads every check run and commit status on the head, judges each name by its latest run that decided, and holds the merge on any red, unfinished or undecided one.

## What it costs to change later

Reading a named list instead costs one setting and one filter in the gate; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every required check, and the repository protects no mission branch, so there is no required list to read.
- (author) A pull request that changes only docs has its checks skipped on purpose; at with-you main lets it merge, while here it waits for a person.
- (author) The gate trusts any review that carries the Reviewer's marker; it cannot tell the Reviewer's account from a person's, since runners post with the account they run as.

```

<!-- /omni-outbox-settled: s4-01-gate-reads-every-check -->

<!-- omni-outbox-settled: s4-02-red-check-waits-named -->

## s4-02-red-check-waits-named — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-red-check-waits-named
prd: 2896
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The spec says a red check on a ready PRD goes back to the agent that looks after its pull request. Does the mission send that agent itself in this slice?

## The decision, in plain words

Not yet: a PRD with a red check stays off the mission branch, and the mission names the failing check as what it waits on. Nothing new is sent for it, and it joins once its checks are green.

## The intro, for fun

The bouncer says why you are not in, but does not fix your shoes.

## The punchline, for fun

Knowing what is red is half the repair.

## The options, in plain words

A. A. The PRD waits, naming the red check; nothing is sent (built).
B. B. The mission sends the pull request's care agent once per red head.

## What I had to decide

Keep naming the red check as what the PRD waits on, or have the mission send the pull request's care agent as a new step of its run.

## What I did meanwhile

The gate reads the pull request again on every run, a minute apart, and joins it once every check is green.

## What it costs to change later

Sending the care agent later costs one more step key and its tests in the supervisor; the database already accepts the job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The done-when of this slice asks only that the mission says what the PRD waits on; sending the care agent needs a step the run keys and the database's key shape do not have yet.

```

<!-- /omni-outbox-settled: s4-02-red-check-waits-named -->

<!-- omni-outbox-settled: s4-03-join-wired-outside-territory -->

## s4-03-join-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-join-wired-outside-territory
prd: 2896
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The merge into the mission branch only happens if the app's job runner is told about it, and that file lies outside this slice's ground. Should the slice change it?

## The decision, in plain words

Yes, by one line: the app's list of job handlers now hands the mission its merge, as the slice before it did for cutting the branch. Without that line the merge gate would be built and tested but never run.

## The intro, for fun

A new door is no use until someone tells the house it is there.

## The punchline, for fun

One line outside the fence, named so nobody trips on it.

## The options, in plain words

A. A. Change the one line in the app's job list (built).
B. B. Leave it to a later slice, so the merge never runs until then.

## What I had to decide

Keep the one-line change to the app's job list, or move the wiring into a slice whose ground holds that file.

## What I did meanwhile

The mission's job receives the merge gate's reads and the merge from the app's job list, beside the branch it already received.

## What it costs to change later

Undoing it is one line; the gate then never runs and a ready PRD waits for a person, as at with-you.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the file that lists the app's job handlers, and the slice before this one changed it the same way.

```

<!-- /omni-outbox-settled: s4-03-join-wired-outside-territory -->

<!-- omni-outbox-settled: s5-01-mission-branch-rebuild-by-hand -->

## s5-01-mission-branch-rebuild-by-hand — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-mission-branch-rebuild-by-hand
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

When the mission branch can only follow the default branch once its built files are rebuilt, the spec says a runner job does it. No skill a runner may take can rebase a mission branch, so who does it for now?

## The decision, in plain words

For now the mission waits on a person, naming the built files and saying to rebase the branch and rebuild them by hand, and nothing on the branch changes. A feature branch in the same case does get its runner job, through the skill that already looks after a pull request.

## The intro, for fun

The robot knows the shelf is crooked, but nobody gave it a screwdriver yet.

## The punchline, for fun

So it leaves a note on the shelf instead of guessing.

## The options, in plain words

A. A. The mission waits on a person for a conflict only in built files on its own branch; feature branches get their care job (built).
B. B. Add a runner skill now that rebases the mission branch and rebuilds its built files, with the lists of the Omni page and the database.
C. C. Rebase the mission branch keeping the default branch's built files, and let the next PRD's rebuild bring them up to date.

## What I had to decide

Keep the wait on a person until a later change gives runners a job that rebases a mission branch and rebuilds its built files, or ask for that job now.

## What I did meanwhile

The app tells a conflict only in built files apart from any other, on the mission branch and on each feature branch. A feature branch gets one care job per head of the mission branch; the mission branch itself waits on a person, saying which files and that no branch changed.

## What it costs to change later

Adding the job later costs one new runner skill, its place in the runner lists of the kit, the Omni page and the database, and swapping the wait for a send in the mission's run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A new runner skill must be added to three lists the tests hold equal (the kit's, the Omni page's and the database's); only the kit's is in this slice's ground.
- (author) Until then, criterion 8 holds for feature branches but not for the mission branch itself: in this repository almost every rebase conflicts in the built bundle, so a mission at Own branch waits on a person often.

```

<!-- /omni-outbox-settled: s5-01-mission-branch-rebuild-by-hand -->

<!-- omni-outbox-settled: s5-02-feature-branches-merged-not-rebased -->

## s5-02-feature-branches-merged-not-rebased — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-feature-branches-merged-not-rebased
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

The spec says each open feature branch of the mission is rebased onto the mission branch's new tip. Should the app rewrite those branches, or bring the new tip in by merging it?

## The decision, in plain words

The app brings the new tip into each feature branch by merging it, as GitHub's Update branch does, only while that branch's head is still the one it read. Only the mission branch itself is rebased, so it stays one commit per PRD.

## The intro, for fun

Two ways to catch a moving train: jump on it, or rebuild the station beside it.

## The punchline, for fun

The app jumps on, and leaves the station standing.

## The options, in plain words

A. A. Merge the new tip into each feature branch, under the lease of its head (built).
B. B. Rebase each feature branch onto the new tip and write it with force.

## What I had to decide

Keep merging the new tip into feature branches, or ask for a true rebase of each one, with a forced write under any work still on it.

## What I did meanwhile

A feature branch whose PRD has no job running is updated by merge when it is behind; its own commits and its slices' pull requests stay as they are, and it is squashed onto the mission branch when it joins, so the merge never reaches it.

## What it costs to change later

Switching to a rebase later costs one function in the mission's keeping up and its tests; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A feature branch here holds merge commits of its slices, which a rebase through GitHub's API cannot replay one by one; the skill that looks after a pull request already merges the mission branch in on a conflict.
- (author) A feature branch whose PRD has a job running is left to that job, so no write lands under an agent at work.

```

<!-- /omni-outbox-settled: s5-02-feature-branches-merged-not-rebased -->

<!-- omni-outbox-settled: s5-03-keep-up-wired-outside-territory -->

## s5-03-keep-up-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-keep-up-wired-outside-territory
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

Keeping the mission branch in step only happens if the app's job runner is told about it, and that file lies outside this slice's ground. Should the slice change it?

## The decision, in plain words

Yes, by one line: the app's list of job handlers now hands the mission its keeping up, beside the branch and the merge the two slices before it wired the same way.

## The intro, for fun

A new chore is no use until it is written on the fridge.

## The punchline, for fun

One line on the fridge, signed so nobody wonders who wrote it.

## The options, in plain words

A. A. Change the one line in the app's job list (built).
B. B. Leave it to a later slice, so the branch never follows until then.

## What I had to decide

Keep the one-line change to the app's job list, or move the wiring into a slice whose ground holds that file.

## What I did meanwhile

The mission's job receives its keeping up from the app's job list; without the line the mission branch would never follow the default branch.

## What it costs to change later

Undoing it is one line; the mission branch then stays where it was cut, as before this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the file that lists the app's job handlers, and slices s3 and s4 changed it the same way.

```

<!-- /omni-outbox-settled: s5-03-keep-up-wired-outside-territory -->

<!-- omni-outbox-settled: s5-04-rebase-not-recorded-yet -->

## s5-04-rebase-not-recorded-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-rebase-not-recorded-yet
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

The spec has the operation room record each rebase of the mission branch. The database accepts no rebase event yet, and this slice may not change it, so is a rebase recorded?

## The decision, in plain words

Not yet: a rebase writes no event, and only a conflict shows, as what the mission waits on, which the room already records. The slice that shows the rebases in the room adds the event.

## The intro, for fun

The branch moved house quietly, and forgot to send the postcard.

## The punchline, for fun

The neighbours only hear about it when the door sticks.

## The options, in plain words

A. A. Record no rebase until a slice adds the event kind (built).
B. B. Add the event kind now, in a migration outside this slice's ground.

## What I had to decide

Keep a rebase unrecorded until the slice that shows rebases in the operation room, or ask for the event kind now.

## What I did meanwhile

A rebase moves the mission branch and its feature branches silently; a conflict, a branch that cannot follow and a feature branch a person must fix are each said in what the mission waits on, which is recorded once per change.

## What it costs to change later

Recording rebases later costs one event kind in a migration, its database check, and one event in the mission's run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives slice s8 the operation room's rebase events, but neither s5 nor s8 holds the database's migrations in its ground: s8 will meet the same wall.

```

<!-- /omni-outbox-settled: s5-04-rebase-not-recorded-yet -->

<!-- omni-outbox-settled: s5-05-joins-held-while-behind -->

## s5-05-joins-held-while-behind — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s5
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-05-joins-held-while-behind
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

While the mission branch cannot follow the default branch, should a ready PRD still join it, and how close is the app's lease to git's own?

## The decision, in plain words

No PRD joins while the branch cannot follow; each waits, saying the branch must follow first, and joins once it does. The app writes the rebased branch only if its head, read again just before the write, is still the one it rebased.

## The intro, for fun

Nobody boards a train that is still looking for its track.

## The punchline, for fun

Once the track is found, everyone gets on.

## The options, in plain words

A. A. Hold every join while the branch cannot follow (built).
B. B. Let ready PRDs join a branch that lags behind.

## What I had to decide

Keep joins held while the branch cannot follow, or let PRDs join a branch that lags behind the default branch.

## What I did meanwhile

A conflict, a merge commit on the branch or a branch that moved meanwhile holds every join of that run; the rest of the mission carries on, and the next run, a minute on, reads the branch again.

## What it costs to change later

Letting joins through costs one condition in the mission's run and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) GitHub's REST API has no write that checks a branch's old head, so the lease is a read just before the forced write; only the mission's own run writes that branch, one run at a time.
- (author) The merges are made on a scratch branch named after the mission branch with --keep-up, removed at the end of each run; a deploy service watching every branch may build it.

```

<!-- /omni-outbox-settled: s5-05-joins-held-while-behind -->
