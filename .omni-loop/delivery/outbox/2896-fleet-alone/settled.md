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

<!-- omni-outbox-settled: s6-01-landing-recorded-as-merged -->

## s6-01-landing-recorded-as-merged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-landing-recorded-as-merged
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The spec has the mission record each landing. The database accepts no landing event yet, and this slice may not change it, so how is a landing recorded?

## The decision, in plain words

Each PRD the mission pull request carried to the main branch is recorded as merged, linking that pull request, which the database already accepts. The mission reads it as shipped from then, and the slice that shows landings in the operation room adds the landing event.

## The intro, for fun

The PRDs reached home, and the diary wrote merged because it has no word for landed yet.

## The punchline, for fun

Same trip, one word short in the dictionary.

## The options, in plain words

A. Record each landed PRD as merged, linking the mission pull request (built).
B. Add a landing event kind now, in a migration outside this slice's ground.

## What I had to decide

Keep a landing recorded as one merged event per PRD until a slice adds the landing event kind, or ask for the event kind now.

## What I did meanwhile

A landing writes one merged event per PRD, signed by the supervisor and linking the mission pull request; the event takes the PRD off the mission branch and the mission reads it as shipped from that moment.

## What it costs to change later

Recording landings with their own event later costs one event kind in a migration, its database check, and one event in the mission's run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives slice s8 the operation room's landing events, but neither s6 nor s8 holds the database's migrations in its ground, as slice s5 found for rebases.

```

<!-- /omni-outbox-settled: s6-01-landing-recorded-as-merged -->

<!-- omni-outbox-settled: s6-02-mission-pull-request-wired-outside-territory -->

## s6-02-mission-pull-request-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-mission-pull-request-wired-outside-territory
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The mission pull request is only opened if the app's job runner is told about it, and that file lies outside this slice's ground. Should the slice change it?

## The decision, in plain words

Yes, by one line: the app's list of job handlers now hands the mission its pull request and the Omni page's address, as the slices before it did for the branch, the merge and the rebase.

## The intro, for fun

The new door is built; someone still has to tell the house it is there.

## The punchline, for fun

One line outside the fence, named so nobody trips on it.

## The options, in plain words

A. Change the one line in the app's job list (built).
B. Leave it to a later slice, so the mission pull request never opens until then.

## What I had to decide

Keep the one-line change to the app's job list, or move the wiring into a slice whose ground holds that file.

## What I did meanwhile

The mission's job receives the mission pull request's reads and writes from the app's job list, beside the branch, the merge and the rebase it already received.

## What it costs to change later

Undoing it is one line; the mission pull request then never opens and no landing is read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives no slice the file that lists the app's job handlers, and slices s3, s4 and s5 changed it the same way.

```

<!-- /omni-outbox-settled: s6-02-mission-pull-request-wired-outside-territory -->

<!-- omni-outbox-settled: s6-03-landing-knowledge-branch-name -->

## s6-03-landing-knowledge-branch-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-landing-knowledge-branch-name
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The knowledge pull request of a landing needs a branch name, and the spec names none. Which name does it take?

## The decision, in plain words

The repository's knowledge branch shape, filled with the word landing and the mission pull request's number, so two landings of one mission never share a branch and each gets its own pull request.

## The intro, for fun

Every delivery needs a label on the box.

## The punchline, for fun

This one says which truck brought it.

## The options, in plain words

A. Name it after the landing's pull request (built).
B. Name it after the mission, so a mission landed in parts shares one knowledge branch.

## What I had to decide

Keep the branch named after the landing's pull request, or name it after the mission so its landings share one branch.

## What I did meanwhile

A landing's harvest commits on a branch named by the knowledge branch shape with landing and the mission pull request's number.

## What it costs to change later

A different name later is one constant; branches already opened keep theirs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's naming table has no row for a landing's knowledge branch.

```

<!-- /omni-outbox-settled: s6-03-landing-knowledge-branch-name -->

<!-- omni-outbox-settled: s6-04-retros-of-a-landing-not-yet -->

## s6-04-retros-of-a-landing-not-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-04-retros-of-a-landing-not-yet
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

A retro today starts only from a feature pull request merged into the main branch, which a PRD of a mission never has. Does this slice start each PRD's retro when a landing brings it to the main branch?

## The decision, in plain words

Not yet: a landing starts no retro, and a PRD built on a mission branch gets none until a later slice starts one per PRD from the landing. The knowledge harvest, which the plan asks of this slice, does run once per landing.

## The intro, for fun

The team crossed the finish line together, and nobody has asked them yet how the race went.

## The punchline, for fun

The interview is booked, just not for today.

## The options, in plain words

A. Start no retro from a landing in this slice (built).
B. Start one retro per PRD the landing carried, in this slice.

## What I had to decide

Leave the retros of a landing to a later slice, or have this slice start one retro per PRD a landing carried.

## What I did meanwhile

A landing's retro job ends skipped, as it does for any pull request that is not a feature pull request; nothing is posted on the mission pull request.

## What it costs to change later

Starting them later costs a retro read that takes a feature pull request merged into a mission branch, with the landing's merge as its clock, and one retro job per PRD of the landing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when for s6 names the knowledge pull request but not the retros, and no later slice names them either.
- (author) A PRD's release note, which the spec also starts at the landing, reads the same merge and was not checked here.

```

<!-- /omni-outbox-settled: s6-04-retros-of-a-landing-not-yet -->

<!-- omni-outbox-settled: s6-05-shipped-date-on-the-page -->

## s6-05-shipped-date-on-the-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-05-shipped-date-on-the-page
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

The Omni page dates a PRD's shipped stage by its feature pull request's merge, which for a mission's PRD is its join to the mission branch, before it landed. Should this slice change how the page dates it?

## The decision, in plain words

No: the code that dates the stages lies outside this slice's ground. The mission itself reads each PRD as shipped only from its landing, and the page shows shipped only once the PRD is on the main branch, but dated at its join.

## The intro, for fun

The parcel arrived on Tuesday, and the receipt says Monday, the day it left the warehouse.

## The punchline, for fun

Right parcel, right door, the wrong day on the stamp.

## The options, in plain words

A. Leave the page's date as it is, outside this slice (built).
B. Change the stage sync now, outside this slice's ground, to date shipped by the landing.

## What I had to decide

Leave the page's shipped date at the join until a slice whose ground holds the stage sync dates it by the landing, or change it now outside this slice's ground.

## What I did meanwhile

The mission records each landed PRD as merged at the moment it read the landing; the page's stage sync still dates shipped by the feature pull request's merge.

## What it costs to change later

Dating it by the landing later costs reading the mission pull request's merge time in the stage sync, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No slice of the plan holds the stage sync of the Omni page in its ground.

```

<!-- /omni-outbox-settled: s6-05-shipped-date-on-the-page -->

<!-- omni-outbox-settled: s6-06-landing-closes-prd-issues -->

## s6-06-landing-closes-prd-issues — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-06-landing-closes-prd-issues
prd: 2896
slice: s6
rank: medium
bears-on: none
raised: 2026-11-15
wave: 6
---

## The question, in plain words

A mission's feature pull request merges into the mission branch, which closes no issue, where one merged into the main branch closes its PRD's. Should the mission pull request close each PRD's issue when it lands?

## The decision, in plain words

Yes: its body ends with the repository's own closing line for each PRD on it, read from the main branch's settings, so each issue closes at the landing, as it does today when a feature pull request lands. A repository without that line gets none.

## The intro, for fun

Every ticket gets its stamp, just at the gate where the train really arrives.

## The punchline, for fun

Closed on arrival, not on boarding.

## The options, in plain words

A. Close each PRD's issue when the mission pull request lands (built).
B. Close nothing: a person closes each PRD's issue.

## What I had to decide

Keep the closing lines in the mission pull request's body, or close nothing and leave each PRD's issue for a person to close.

## What I did meanwhile

The mission pull request's body lists one closing line per PRD on the branch, filled from the main branch's feature link setting.

## What it costs to change later

Dropping the lines later is one change to the body and its tests; issues already closed stay closed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a PRD is shipped at its landing but does not say whether its issue closes then.

```

<!-- /omni-outbox-settled: s6-06-landing-closes-prd-issues -->

<!-- omni-outbox-settled: s7-01-dropped-prd-waits-for-a-person -->

## s7-01-dropped-prd-waits-for-a-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 7

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-dropped-prd-waits-for-a-person
prd: 2896
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 7
---

## The question, in plain words

A dropped PRD must stay dropped until a person sends it again, but the spec does not say how a person sends it again. What happens to a dropped PRD in the meantime?

## The decision, in plain words

A dropped PRD never joins the branch again by itself and the mission says it waits on a person for it. How a person sends it again is left for a later slice.

## The intro, for fun

Dropped is easy; picking it back up is a different conversation.

## The punchline, for fun

It sits on the bench with its feature pull request reopened.

## The options, in plain words

A. A dropped PRD waits on a person, and sending it again comes later.
B. A dropped PRD rejoins at once when its reopened pull request passes the gate.

## What I had to decide

A PRD whose latest event is prd-dropped reads as dropped: it is never merged into the branch, and the mission waits naming it, until a later event joins it again.

## What I did meanwhile

Its feature pull request is reopened against the branch so a person can see and rework it.

## What it costs to change later

Adding a way to send it again later is a new command and one event, with no change to what is built here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a dropped PRD is dropped until a person sends it again, with no command or button for it.

```

<!-- /omni-outbox-settled: s7-01-dropped-prd-waits-for-a-person -->

<!-- omni-outbox-settled: s7-02-red-branch-names-the-last-joined-prd -->

## s7-02-red-branch-names-the-last-joined-prd — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 7

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-red-branch-names-the-last-joined-prd
prd: 2896
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 7
---

## The question, in plain words

When the mission branch's checks go red, which PRD does the mission name as the one to drop?

## The decision, in plain words

The mission names the PRD that joined the branch last, since the red head is its commit, and gives the drop line for it. A person may still drop another one.

## The intro, for fun

The last one through the door gets the blame.

## The punchline, for fun

Detectives call it the usual suspect.

## The options, in plain words

A. Name the PRD that joined last.
B. Name every PRD on the branch and let a person pick.

## What I had to decide

A red head of the mission branch names the PRD that joined last and holds every further join until the checks are green again or a PRD is dropped.

## What I did meanwhile

The check runs of the head are read once per run, and a head with no finished failure reads as not red.

## What it costs to change later

Finding the first PRD whose commit turned the checks red means reading the checks of each commit, which is one function to change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the PRD after a join but not how to find it when the red comes from a rebase or a late check.

```

<!-- /omni-outbox-settled: s7-02-red-branch-names-the-last-joined-prd -->

<!-- omni-outbox-settled: s7-03-drop-needs-events-and-wiring-outside-territory -->

## s7-03-drop-needs-events-and-wiring-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s7
- Wave: 7

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-drop-needs-events-and-wiring-outside-territory
prd: 2896
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 7
---

## The question, in plain words

Dropping a PRD needs new kinds of mission event, a call from the terminal and one line wiring the drop into the job list, none of them in the slice's territory. Were they right to change?

## The decision, in plain words

A new database migration lets a mission record that a drop was asked for and done, the terminal's client gets one call for it, and the job list gets the new drop step. Each is small and only adds.

## The intro, for fun

To take a PRD off the branch you first have to be allowed to say so.

## The punchline, for fun

Four paths outside the fence, each one just a door.

## The options, in plain words

A. Keep the additive migration, client call and job wiring as built.
B. Record a drop another way, with no new event kind, and rework the slice.

## What I had to decide

Add supabase/migrations/20270123120000_mission_drops.sql and its proof in supabase/checks/missions.sql, add dropMission to kit/lib/ask/client.ts, and wire missionDrops in apps/omni-app/src/jobs/pr-checks.ts, all outside the slice's territory.

## What I did meanwhile

The three event kinds are additive, the client call is one method, and the wiring is one line, the same as s4 to s6 did.

## What it costs to change later

Reverting means a follow-up migration that only works while no drop is recorded, and removing one method and one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave the slice no migration, client or job-list path, yet a drop must be recorded and reachable from the terminal.

```

<!-- /omni-outbox-settled: s7-03-drop-needs-events-and-wiring-outside-territory -->

<!-- omni-outbox-settled: s8-01-room-shows-no-rebase-row-yet -->

## s8-01-room-shows-no-rebase-row-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s8
- Wave: 8

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-room-shows-no-rebase-row-yet
prd: 2896
slice: s8
rank: medium
bears-on: none
raised: 2026-11-15
wave: 8
---

## The question, in plain words

The operation room now shows a row for each join, drop and landing, but the branch being brought up to date with the default branch leaves no record to show. Should the next slice that touches the App record one?

## The decision, in plain words

The room draws the rows the App already writes. A rebase of the mission branch writes no row today, and adding one needs a database change and an App change, both outside this slice, so the room shows no rebase row yet.

## The intro, for fun

The branch keeps up with the main road, and nobody writes it down.

## The punchline, for fun

The room can only show what the diary says, so the diary needs a new line.

## The options, in plain words

A. A. Leave the room without a rebase row for now (built).
B. B. Add a branch-rebased event kind to the database and the supervisor, then the room shows it.

## What I had to decide

Add a branch-rebased event kind and have the supervisor record it once per rebase; the room then gives it the state word Rebased.

## What I did meanwhile

The room shows joins, drop requests, drops and landings. The Branch line on the Missions tab says whether the branch is up to date or behind, read from what the supervisor says it waits on.

## What it costs to change later

A constant and a state word in the room, plus one event kind in the database check and the supervisor: small, and nothing stored depends on it yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the room records a rebase once, but names no event kind for it; the App writes none today.

```

<!-- /omni-outbox-settled: s8-01-room-shows-no-rebase-row-yet -->

<!-- omni-outbox-settled: s9-02-committee-wired-outside-territory -->

## s9-02-committee-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s9
- Wave: 9

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-committee-wired-outside-territory
prd: 2896
slice: s9
rank: medium
bears-on: none
raised: 2026-11-15
wave: 9
---

## The question, in plain words

The new committee command and its runner line had to be listed in two places outside this slice's ground. Is that acceptable?

## The decision, in plain words

Two one-line changes outside the slice: the list of the kit's commands now names the committee command, and the guide's Runners page names the committee among the lines a runner takes, since a test holds that page to the runner's list.

## The intro, for fun

The new colleague needed a badge and a line in the phone book.

## The punchline, for fun

Both took one line, and nobody else moved desks.

## The options, in plain words

A. Keep the two one-line changes outside the territory (built).
B. Move them to a slice whose territory holds the command table and the guide.

## What I had to decide

Whether the command table and the guide's runner list may each take the one line the committee needs, outside s9's territory.

## What I did meanwhile

kit/bin/commands/index.ts registers omni committee; docs/guide/runners.md lists /omni:committee.

## What it costs to change later

Reverting either is one line; without them the command does not exist and the guide's test fails.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s13 rewrites the guide's Missions page and may want the committee described there as well

```

<!-- /omni-outbox-settled: s9-02-committee-wired-outside-territory -->

<!-- omni-outbox-settled: s9-03-committee-members-use-role-defaults -->

## s9-03-committee-members-use-role-defaults — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s9
- Wave: 9

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-03-committee-members-use-role-defaults
prd: 2896
slice: s9
rank: medium
bears-on: none
raised: 2026-11-15
wave: 9
---

## The question, in plain words

Should each committee member run on the agent and model its fleet's hero was given, or on its role's default?

## The decision, in plain words

Each member runs on its role's default agent and model (the PM, the Architect and the Reviewer all on the strongest model today), since the runner's job does not yet carry the fleet's own hero settings. The red business law and a waiting Tech Approval are read when the decision is recorded, not before the members run: they still send the PRD to a person.

## The intro, for fun

The committee showed up in the default uniforms.

## The punchline, for fun

Same faces, same rules, the tailoring comes later.

## The options, in plain words

A. Members run on their role's defaults; the business-law verdict and the Tech Approval are checked when the decision is recorded (built).
B. Carry each hero's agent and model, and the business-law verdict, in the committee's job before any member runs.

## What I had to decide

Whether the committee job must carry each hero's own agent and model, and the business-law verdict, before any member runs.

## What I did meanwhile

omni committee check names each member with its role's defaults; the database escalates a red business law or a waiting Tech Approval when it records the decision.

## What it costs to change later

Carrying the heroes' settings means the job line or the runner's claim naming them: a later slice's change, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a hero a person set to another model should be honoured for its vote

```

<!-- /omni-outbox-settled: s9-03-committee-members-use-role-defaults -->
