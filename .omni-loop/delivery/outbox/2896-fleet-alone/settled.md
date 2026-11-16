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

<!-- omni-outbox-settled: s10-02-fleet-settles-with-the-built-option-only -->

## s10-02-fleet-settles-with-the-built-option-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s10
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-02-fleet-settles-with-the-built-option-only
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

When the fleet answers a question for a mission, may it choose a different option than the one that was built, or only agree with what was built?

## The decision, in plain words

The fleet only agrees with what was built. A member who prefers another option answers no and says which, and the question goes to a person, so nothing has to be redone without a person deciding it.

## The intro, for fun

The committee can say yes to the soup, or send it back to the chef.

## The punchline, for fun

It cannot cook a new soup on its own.

## The options, in plain words

A. The fleet settles a question only with option A, as built; a member who wants another option answers no and it goes to a person (built).
B. The fleet may choose any offered option; another option than A is settled as drifted, and the mission sends the rework before the feature joins.

## What I had to decide

Which options the fleet's committee may settle a question with: only the one that was built, or any option the question offers.

## What I did meanwhile

Each member is asked whether it would settle the question with option A, as built; three yes settle it as agreed, and any other answer sends it to a person with every verdict.

## What it costs to change later

Option B lets the committee pick a letter and settles it as drifted, then the mission sends the rework: a change to the committee's question, the answer record and the supervisor's next step, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the item is settled with the option chosen, and does not say whether the fleet may choose an option other than what was built.
- (author) Whether a rework the fleet chose, with no person reading it, is wanted at the level that works alone.

```

<!-- /omni-outbox-settled: s10-02-fleet-settles-with-the-built-option-only -->

<!-- omni-outbox-settled: s10-03-item-score-is-jevs-or-unknown -->

## s10-03-item-score-is-jevs-or-unknown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s10
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-03-item-score-is-jevs-or-unknown
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

A question goes to a person when it is hard to undo. Where should that score come from, when the question itself carries none?

## The decision, in plain words

The score is Jev's confidence when Jev decided whether the choice is hard to undo; otherwise it is unknown, and an unknown score always goes to a person. Until a workspace turns Jev on, the fleet answers no question on its own.

## The intro, for fun

The bouncer only lets in guests whose age is written down.

## The punchline, for fun

Nobody wrote anything down yet.

## The options, in plain words

A. The score is Jev's confidence when present; no score sends the question to a person (built).
B. Each new question carries the agent's own judgement as a score, 1 or 0, read when Jev gave none.

## What I had to decide

Where the hard-to-revert score of a question comes from, for the mission's bound: Jev's confidence when present, or something the question would have to carry.

## What I did meanwhile

Jev's confidence is read from its line in the question; a question without one is sent to a person, whatever the members would say.

## What it costs to change later

Option B writes the agent's own hard-to-revert judgement into each new question, 1 when it judged it hard and 0 otherwise, and reads it here: a change to how questions are written, older questions staying unknown.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A question does not record whether the agent judged it hard to undo; only Jev's line carries a number.
- (author) Whether Jev's confidence is the score the spec means by a question's hard-to-revert score.

```

<!-- /omni-outbox-settled: s10-03-item-score-is-jevs-or-unknown -->

<!-- omni-outbox-settled: s10-04-item-on-a-business-law-goes-to-a-person -->

## s10-04-item-on-a-business-law-goes-to-a-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s10
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-04-item-on-a-business-law-goes-to-a-person
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

Should the fleet be allowed to answer a question that names a business law, when nothing tells it whether the answer breaks that law?

## The decision, in plain words

Any question that names a business law goes to a person. The spec only sends a person the laws judged broken, but no judge reads a single question, so the fleet cannot tell.

## The intro, for fun

The rulebook is on the table, but nobody brought the referee.

## The punchline, for fun

So the whistle goes to a person.

## The options, in plain words

A. A question naming a business law always goes to a person (built).
B. Only a business law the spec's judge found broken sends it to a person, as for a PRD's approval.

## What I had to decide

Whether a question bearing on a business law goes to a person always, or only when a judge said the law is broken, as for a PRD's approval.

## What I did meanwhile

Every question naming a business law, in its front matter or its words, goes to a person before any member votes.

## What it costs to change later

Option B needs a judgement of each question against the business laws, which nothing makes today: a new check, or reading the PRD's spec verdict instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The escalation list speaks of a business law judged red; the judge reads a PRD's spec, never one question.

```

<!-- /omni-outbox-settled: s10-04-item-on-a-business-law-goes-to-a-person -->

<!-- omni-outbox-settled: s10-05-fleet-answer-recorded-in-ledger-and-room -->

## s10-05-fleet-answer-recorded-in-ledger-and-room — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s10
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-05-fleet-answer-recorded-in-ledger-and-room
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

Where should the fleet's answer to a question be kept: in the mission's list of decisions like its approvals, or in the question's own record and the mission's history?

## The decision, in plain words

The answer is kept where every answer to a question is kept, with the question, the option and each member's verdict, and the mission's history says it was decided or sent to a person. It is not yet a row of the mission's list of decisions, which only takes approvals today.

## The intro, for fun

The minutes were written in the notebook, not yet typed into the binder.

## The punchline, for fun

Every word is there, just on a different shelf.

## The options, in plain words

A. The answer lives in the question's settled record and the mission's events; the decisions list keeps approvals only (built).
B. A migration lets the App write each answer to the decisions list too, beside the record.

## What I had to decide

Whether this slice writes the fleet's answers to the mission's decisions list, which needs a database change outside its ground, or keeps them in the question's record and the mission's events.

## What I did meanwhile

The answer, its option and the verdicts are in the PRD's settled questions; the mission records a decided or escalated event signed by the PM and agent; the committee's job is sent with no mission key and found again by its line, since the database's key shape holds no question.

## What it costs to change later

Option B is one migration (a writer for answers, a key shape for a question's committee) and the App calling it; answers given before it would not be in the list unless read back from the ledger.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names one decisions list for approvals and answers; the slice's ground holds no migration.
- (author) Whether the next slice, which lists every answer on the mission pull request and lets a person overturn one, prefers to read the list or the ledger.

```

<!-- /omni-outbox-settled: s10-05-fleet-answer-recorded-in-ledger-and-room -->

<!-- omni-outbox-settled: s10-06-committee-wired-outside-territory -->

## s10-06-committee-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s10
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-06-committee-wired-outside-territory
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

Two small changes landed outside this slice's ground so the fleet's answers can run at all: is that fine?

## The decision, in plain words

The terminal command the committee records with learned to read a question, and the App's job list now hands the missions the way to settle a question. Without them nothing in this slice would run.

## The intro, for fun

The new kitchen needed one extra plug in the hallway.

## The punchline, for fun

The electrician signed the hallway too.

## The options, in plain words

A. Both changes stay, so the fleet can answer questions (built).
B. Move them to a later slice whose ground names them, leaving this one unwired.

## What I had to decide

Whether to change the committee's terminal command and the App's wiring of the missions' job, both outside the slice's ground, or leave the answers unreachable.

## What I did meanwhile

The committee command takes an item and a bound beside an approval, with its tests; the App's job wiring passes the settlement to the missions' job, one line.

## What it costs to change later

Reverting is removing the item flag from the command and the one line of wiring.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's ground for this slice names the committee's skill and library but not its command, nor the App's job wiring.

```

<!-- /omni-outbox-settled: s10-06-committee-wired-outside-territory -->

<!-- omni-outbox-settled: s10-07-build-sent-again-once-questions-answered -->

## s10-07-build-sent-again-once-questions-answered — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s10
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-07-build-sent-again-once-questions-answered
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

Once the fleet has answered every question of a feature, how should the mission carry it on?

## The decision, in plain words

The mission sends the build again, once: with nothing left open it ships and goes to the reviewer, as any build does. After a second round of questions, a person carries it on.

## The intro, for fun

Homework checked, the student is sent back to class.

## The punchline, for fun

Twice at most, then the teacher steps in.

## The options, in plain words

A. Send the build again, once, then wait for a person (built).
B. Send the fix after the fleet's answers instead of the build.

## What I had to decide

What the mission sends once no high question of a feature is open at the level that works alone: the build again, the fix, or nothing until a person acts.

## What I did meanwhile

The build is sent again under the next run; a feature whose second run also ended on questions waits for a person once they are answered. It is also sent again when a person answered every question on the pull request.

## What it costs to change later

Sending the fix instead changes one line of the supervisor's next step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The page's own fix may also run when a person answers on the page, so a feature could be carried on twice.
- (author) The spec does not say what carries a feature on after the fleet answered.

```

<!-- /omni-outbox-settled: s10-07-build-sent-again-once-questions-answered -->

<!-- omni-outbox-settled: s12-01-one-pm-job-per-mission -->

## s12-01-one-pm-job-per-mission — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-01-one-pm-job-per-mission
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

How many times may a mission send its PM to write PRDs, and when does it pick a brainstorm over a roadmap?

## The decision, in plain words

A mission sends its PM once. It asks for a brainstorm when one PRD is left under the cap, and a roadmap when several are, so the PM never writes more than the cap allows.

## The intro, for fun

The PM gets one blank page per mission.

## The punchline, for fun

No second draft unless a person asks for one.

## The options, in plain words

A. A. One PM job per mission; brainstorm for one PRD left, roadmap for several (built).
B. B. Send the PM again after each job while the fleet added fewer than the cap.
C. C. Always send a roadmap and let it write one PRD or several.

## What I had to decide

Whether a mission may send its PM again when the first job wrote fewer PRDs than the cap, and whether the PM should choose brainstorm or roadmap itself.

## What I did meanwhile

The PM job's key is mission:<id>:pm:1, unique, so a replay never sends a second one. A job that failed or wrote nothing adds nothing, and the mission carries on with the PRDs it has.

## What it costs to change later

A constant in apps/omni-app/src/missions/pm.ts (PM_ROUND and the check on jobs already sent): a later round only needs a new round in the key, which the database already accepts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person expects the fleet to keep proposing PRDs until the cap is reached.

```

<!-- /omni-outbox-settled: s12-01-one-pm-job-per-mission -->

<!-- omni-outbox-settled: s12-02-pm-writes-nothing-where-phase0-is-a-pr -->

## s12-02-pm-writes-nothing-where-phase0-is-a-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-02-pm-writes-nothing-where-phase0-is-a-pr
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

What does the PM do for a mission whose repository approves its PRDs through a review pull request rather than on their page?

## The decision, in plain words

It writes nothing there. A PRD the fleet adds must be approved on its page, where the committee can approve it; one approved through a review pull request would wait for a person anyway.

## The intro, for fun

Some repositories only take paper forms.

## The punchline, for fun

The PM checks the counter before filling one in.

## The options, in plain words

A. A. Write nothing where phase 0 is a pull request (built).
B. B. Write each PRD on the server anyway, whatever the repository's phase 0.
C. C. Write it with a review pull request and let it wait for a person.

## What I had to decide

Whether the PM should write such PRDs on the server anyway, overriding the repository's phase 0, or write nothing as built.

## What I did meanwhile

The four skills' For a mission's PM section ends on the record line with no PRD when step 0 reads phase 0: pr; the mission page then names no PRD added by the fleet.

## What it costs to change later

One sentence in each of the four skills.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each PRD the fleet adds is born on the server; it does not say what happens in a repository whose phase 0 is a pull request.

```

<!-- /omni-outbox-settled: s12-02-pm-writes-nothing-where-phase0-is-a-pr -->

<!-- omni-outbox-settled: s12-03-pm-record-line-printed-by-the-skill -->

## s12-03-pm-record-line-printed-by-the-skill — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-03-pm-record-line-printed-by-the-skill
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

How does the PM tell the app which PRDs it wrote for the mission?

## The decision, in plain words

It ends its run on one line in a fixed shape that the app reads from the job's log. The app keeps at most the cap it sent, and a line it cannot read adds nothing.

## The intro, for fun

The PM leaves a sticky note on the way out.

## The punchline, for fun

The app only reads notes in the right handwriting.

## The options, in plain words

A. A. The skill prints the line itself (built).
B. B. A kit command prints it, as the committee's record command does.

## What I had to decide

Whether a kit command should print the line, as the committee's record is printed, instead of the skill writing it out.

## What I did meanwhile

kit/lib/virtual-fleet/pm.ts holds the line's shape (pmLine, pmRecordOf) and the App reads it with it. The skills write the line by hand, since the kit's commands were outside this slice's territory.

## What it costs to change later

One small command in kit/bin that calls pmLine, and one sentence in each of the four skills.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an agent writing the line by hand gets its shape right often enough; a wrong line adds nothing, which is safe but silent.

```

<!-- /omni-outbox-settled: s12-03-pm-record-line-printed-by-the-skill -->

<!-- omni-outbox-settled: s12-04-fleet-prds-kept-as-events-not-scope -->

## s12-04-fleet-prds-kept-as-events-not-scope — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-04-fleet-prds-kept-as-events-not-scope
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

Where does the app keep the PRDs the fleet added to a mission?

## The decision, in plain words

As entries in the mission's own history, one per PRD added and one per roadmap row the cap left out. The mission's written scope stays as the person wrote it, and the app adds the fleet's PRDs after it each time it reads the mission.

## The intro, for fun

The person's list stays in their handwriting.

## The punchline, for fun

The fleet's additions go in the margin.

## The options, in plain words

A. A. History entries only, the scope left as the person wrote it (built).
B. B. Also append them to the mission's scope.

## What I had to decide

Whether the fleet's PRDs should also be written into the mission's scope, so other readers see them without reading its history.

## What I did meanwhile

Two new kinds of mission event, prd-added and not-written, written by the service role; the supervisor widens the scope from them on every run and the Missions tab reads them.

## What it costs to change later

A database function that appends to missions.scope, and the readers that would then read the scope alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the mission page should list the fleet's PRDs inside the scope rather than on a line of their own.

```

<!-- /omni-outbox-settled: s12-04-fleet-prds-kept-as-events-not-scope -->

<!-- omni-outbox-settled: s12-05-pm-limit-wording-and-default-heroes -->

## s12-05-pm-limit-wording-and-default-heroes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-05-pm-limit-wording-and-default-heroes
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

What should the PM's limit say now that it chairs a committee that approves PRDs, and do existing PM heroes take the new words?

## The decision, in plain words

It now says the PM never approves a PRD it wrote, nor one outside a mission's committee. PM heroes whose limits are still the old default take the new words; a hero a person changed keeps what they wrote.

## The intro, for fun

The PM's job description got a new line.

## The punchline, for fun

Only the copies still on the template get reprinted.

## The options, in plain words

A. A. The new sentence, rewritten on PM heroes still at the default (built).
B. B. The new sentence for new heroes only.
C. C. Keep the old sentence: the committee approving is not the PM approving.

## What I had to decide

Whether the new words are right, and whether existing PM heroes should keep the old line until a person edits them.

## What I did meanwhile

The kit's roles and the database's defaults hold the same sentence, and the migration rewrites a PM's limits only while they equal the old default.

## What it costs to change later

One sentence in the kit's roles and a follow-up migration with the same sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person who wrote their own PM limit would want to be told the default changed.

```

<!-- /omni-outbox-settled: s12-05-pm-limit-wording-and-default-heroes -->

<!-- omni-outbox-settled: s12-06-runners-guide-names-the-pm-skills -->

## s12-06-runners-guide-names-the-pm-skills — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-06-runners-guide-names-the-pm-skills
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

May this slice change the guide's page on runners, which belongs to a later slice?

## The decision, in plain words

Yes, one paragraph: the guide's own test holds its list of the lines a runner takes equal to the kit's, so adding the four skills without it would have turned the build red. The paragraph also says only a mission sends them.

## The intro, for fun

The guide and the code keep each other honest.

## The punchline, for fun

Change one, and the other insists on a matching update.

## The options, in plain words

A. A. Change the paragraph here, outside the territory (built).
B. B. Leave the guide's test red until its own slice changes it.

## What I had to decide

Whether the paragraph should stay as written or wait for the guide's own slice to reword it.

## What I did meanwhile

Only the list of runner lines in docs/guide/runners.md and two sentences after it changed; the guide's Missions page is left to its own slice.

## What it costs to change later

One paragraph of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the guide's own slice would word the paragraph differently.

```

<!-- /omni-outbox-settled: s12-06-runners-guide-names-the-pm-skills -->

<!-- omni-outbox-settled: s12-08-terminal-send-refuses-pm-skills -->

## s12-08-terminal-send-refuses-pm-skills — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s12
- Wave: 12

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-08-terminal-send-refuses-pm-skills
prd: 2896
slice: s12
rank: medium
bears-on: none
raised: 2026-11-16
wave: 12
---

## The question, in plain words

May this slice change how the terminal sends a line to a runner, which lies outside its territory?

## The decision, in plain words

Yes, three lines: a line sent from a terminal belongs to no mission, so the terminal now refuses the PM's four writing skills before asking the app, as the app and the runner do. Without it the terminal's own tests turned red.

## The intro, for fun

The terminal learned the new door policy too.

## The punchline, for fun

Better told at home than turned away at the door.

## The options, in plain words

A. A. The terminal refuses them before any call, outside the territory (built).
B. B. Leave the terminal as it was and let the app refuse them, changing only the test's example.

## What I had to decide

Whether the terminal should refuse these lines itself, or leave the refusal to the app.

## What I did meanwhile

kit/bin/commands/runner-follow.ts calls missionRefusal before sending; kit/bin/commands/runner.test.ts expects the new refusal words for a brainstorm job claimed with no mission.

## What it costs to change later

Three lines of the send command and one expected sentence in its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the send command's help should name the four skills it refuses.

```

<!-- /omni-outbox-settled: s12-08-terminal-send-refuses-pm-skills -->

<!-- omni-outbox-settled: s14-01-own-branch-refused-in-the-app-not-the-database -->

## s14-01-own-branch-refused-in-the-app-not-the-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s14
- Wave: 13

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-01-own-branch-refused-in-the-app-not-the-database
prd: 2896
slice: s14
rank: medium
bears-on: none
raised: 2026-11-16
wave: 13
---

## The question, in plain words

Where should a mission in a plan repository be refused `own-branch`: in the database, or in the app's own rules?

## The decision, in plain words

In the app. The Missions tab offers no `own-branch` there, the level call and Start refuse it with `a mission branch holds one repository: use with-you or alone`, and the mission's run waits on that same line if one already sits at `own-branch`. The database has no new rule.

## The intro, for fun

One repository, one branch; a plan repository has many.

## The punchline, for fun

The door is locked in three places, the wall is untouched.

## The options, in plain words

A. Refuse in the app: the tab, the level call, Start and the run (built).
B. Add a database rule that reads the products' plan repositories.

## What I had to decide

Whether to add a migration. A plan repository is a product setting that can change after a mission is made, so a database rule would be stale anyway.

## What I did meanwhile

Built A; no migration. `omni mission` and the skill still write the level; the app refuses it on Start.

## What it costs to change later

Adding a database rule later is one migration; the app's checks can stay.

## What I could not know

(author) Whether the owner wants the refusal at brief-writing time too, which the kit cannot know without the product list.

```

<!-- /omni-outbox-settled: s14-01-own-branch-refused-in-the-app-not-the-database -->

<!-- omni-outbox-settled: s13-01-missions-page-rebuild-is-a-person -->

## s13-01-missions-page-rebuild-is-a-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s13
- Wave: 14

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s13-01-missions-page-rebuild-is-a-person
prd: 2896
slice: s13
rank: medium
bears-on: none
raised: 2026-11-16
wave: 14
---

## The question, in plain words

After a conflict in built files, should a job or a person rebuild the mission branch?

## The decision, in plain words

The page says a person rebuilds the branch, because that is what the feature branch does now. If a job later does it, this page changes with it.

## The intro, for fun

Two maps disagree about who fixes the bridge.

## The punchline, for fun

The page follows the road that is open today.

## The options, in plain words

A. A. The page says a person rebuilds the branch (as written).
B. B. The page says a job rebuilds the branch, as the spec asks, once the job exists.

## What I had to decide

Confirm that a person rebuilds the mission branch after a conflict only in built files, or ask for the job the spec describes and this page changes.

## What I did meanwhile

The page says a person rebuilds the branch, with no promise of a job.

## What it costs to change later

Changing the sentence costs one line on the Missions page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not run the rebase path in code. The line follows the slice brief, which says s5 left the job out.
- (author) The line that Works alone needs a PM, an Architect and a Reviewer comes from the spec. I did not check it against the drawer code.

```

<!-- /omni-outbox-settled: s13-01-missions-page-rebuild-is-a-person -->

<!-- omni-outbox-settled: s4-04-missions-check-learns-joins -->

## s4-04-missions-check-learns-joins — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-138
- Raised: 2026-11-15
- Slice: s4
- Wave: 4
- Stays here: agrees the missions check was extended; the rule it proves did not change

### The answer, as it was given

```text
A. A. Accept the changed check, extended to cover a PRD joining the branch (built).
```

### The item, as it was raised

```text
---
id: s4-04-missions-check-learns-joins
prd: 2896
slice: s4
rank: high
bears-on: BR-PRODUCT-138
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The database check that proves the product's rules for missions was changed so it also expects a PRD joining its mission's branch. Do you accept this change to the rule check?

## The decision, in plain words

The check was extended, not loosened: every old expectation still holds, the list of event kinds grows from twelve to thirteen, and a member now also reads a join event. The service role still writes every event and a member still writes none.

## The intro, for fun

The mission's diary learned one new word: joined.

## The punchline, for fun

Nobody tore out a page; the diary just got one more line.

## The options, in plain words

A. A. Accept the changed check, extended to cover a PRD joining the branch (built).
B. B. Undo it, and keep joins out of the mission's events.

## What I had to decide

Accept the changed check as built, or undo it and record joins in a way the old check accepts unchanged.

## What I did meanwhile

The check passes as changed, run against a local database with this PRD's migrations, and fails without this slice's migration.

## What it costs to change later

Undoing it means dropping the join event, which every later slice of this PRD reads to know what is on the mission branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The rules this check proves are proposed, not confirmed: no owner is named to approve them.
- (author) Raised high because a change to a rule's proof is a person's to accept; the kit ranks it medium on its own, as for PRD 2871.

```

<!-- /omni-outbox-settled: s4-04-missions-check-learns-joins -->

<!-- omni-outbox-settled: s9-01-fleet-approval-is-an-approval-row -->

## s9-01-fleet-approval-is-an-approval-row — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-APPROVALS-1
- Raised: 2026-11-15
- Slice: s9
- Wave: 9
- Became: BR-PRODUCT-144

### The answer, as it was given

```text
A. The fleet's approval is an approval row naming its fleet and its mission: the mission reads it for itself only, the build's approval check reads it for anyone (built).
```

### The item, as it was raised

```text
---
id: s9-01-fleet-approval-is-an-approval-row
prd: 2896
slice: s9
rank: high
bears-on: BR-APPROVALS-1
raised: 2026-11-15
wave: 9
---

## The question, in plain words

When the fleet's committee approves a PRD, should that approval also count outside the mission that asked for it?

## The decision, in plain words

The fleet's approval is written like a person's, naming the fleet and the mission, so the page shows it and a later change cancels it. The mission only trusts its own, but the build's approval check cannot tell who is building, so a person building the same PRD by hand would see it approved too.

## The intro, for fun

Three agents said yes, and now the whole office thinks the boss signed it.

## The punchline, for fun

The signature says fleet, at least, in large letters.

## The options, in plain words

A. The fleet's approval is an approval row naming its fleet and its mission: the mission reads it for itself only, the build's approval check reads it for anyone (built).
B. Keep the fleet's approval in the mission's decisions only, and teach the build's approval check to accept it for that mission's own jobs.

## What I had to decide

Whether a fleet's approval may read as given to a build outside its own mission, or only to the mission's own jobs.

## What I did meanwhile

It reads as given to any build of the PRD; another mission's supervisor reads it as none and asks its own committee or a person.

## What it costs to change later

Option B needs the kit's approval reader and the approval route to learn the job's mission, outside this slice's territory, and keeps the page's words to change too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person ever builds by hand a PRD that sits in a running mission at alone
- (author) whether the page's words read exactly Approved by fleet <key>: the page's own code (apps/galaxy/src/dossier/page/approval.ts) was not changed and prints the approver's login, fleet <key>

```

<!-- /omni-outbox-settled: s9-01-fleet-approval-is-an-approval-row -->

<!-- omni-outbox-settled: s9-04-runner-list-proofs-name-committee -->

## s9-04-runner-list-proofs-name-committee — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-19
- Raised: 2026-11-15
- Slice: s9
- Wave: 9
- Stays here: agrees two proofs now name the committee; neither rule changed

### The answer, as it was given

```text
A. The two proofs expect committee in the list, the rules' words unchanged (built).
```

### The item, as it was raised

```text
---
id: s9-04-runner-list-proofs-name-committee
prd: 2896
slice: s9
rank: high
bears-on: N-PRODUCT-19
raised: 2026-11-15
wave: 9
---

## The question, in plain words

The runner's list of the loop's own skills now holds the committee, and two tests proving rules about that list were changed to name it: do you agree?

## The decision, in plain words

The committee joins that list in the kit, the app and the database, and the tests proving a runner refuses any other line, and that a repository's own skill is never named like one of the loop's, now expect it there; neither rule's words changed.

## The intro, for fun

The guest list got one name longer, so the bouncer's checklist did too.

## The punchline, for fun

The door policy itself stayed exactly as strict.

## The options, in plain words

A. The two proofs expect committee in the list, the rules' words unchanged (built).
B. Keep committee off the runner's list, so a mission's committee needs a person at a terminal.

## What I had to decide

Whether the proofs of N-PRODUCT-19 and BR-PRODUCT-140 may expect committee among the loop's own skills.

## What I did meanwhile

kit/lib/runner/line.test.ts checks the committee's line is taken; apps/galaxy/src/runners/runners.skills.migration.test.ts counts committee among the skills added after its migration.

## What it costs to change later

Reverting is removing committee from the three lists and the two tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the committee should be sendable by a person from the Runners page too, as every skill on the list is

```

<!-- /omni-outbox-settled: s9-04-runner-list-proofs-name-committee -->

<!-- omni-outbox-settled: s10-01-fleet-answer-held-only-by-the-app-check -->

## s10-01-fleet-answer-held-only-by-the-app-check — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-5
- Raised: 2026-11-16
- Slice: s10
- Wave: 10
- Became: BR-PRODUCT-145

### The answer, as it was given

```text
A. The App's check on a pull request into the main branch holds each question the fleet answered; the terminal's check reads it as answered (built).
```

### The item, as it was raised

```text
---
id: s10-01-fleet-answer-held-only-by-the-app-check
prd: 2896
slice: s10
rank: high
bears-on: BR-PRODUCT-5
raised: 2026-11-16
wave: 10
---

## The question, in plain words

When the fleet answers a question for a mission, should the terminal's own check also keep the feature waiting before the main branch, or is the check the App runs on the pull request enough?

## The decision, in plain words

A question the fleet answered counts as answered for the mission's branch. The App's check on a pull request into the main branch still holds it until a person answers, but the check an agent runs in a terminal does not know where the pull request goes, so it reads the question as answered.

## The intro, for fun

The fleet signed the permission slip, but only for the school trip.

## The punchline, for fun

The main door still asks a grown-up.

## The options, in plain words

A. The App's check on a pull request into the main branch holds each question the fleet answered; the terminal's check reads it as answered (built).
B. The terminal's check learns the pull request's base too, and holds the fleet's answers toward the main branch the same way.

## What I had to decide

Whether a question the fleet answered keeps a feature a draft toward the main branch everywhere, or only in the App's check on the pull request. Bears on BR-PRODUCT-5, whose owner confirms the reading: changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## What I did meanwhile

The merge gate into the mission branch and the terminal's gate read a question the fleet answered as answered; the App's outbox check on a feature pull request into the main branch fails on it, naming each such question, unless a person applies the override label.

## What it costs to change later

Option B adds a base to the terminal's outbox check and has the skills that mark a pull request ready pass it: a few files of the kit, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a feature pull request of a mission ever goes to the main branch other than through the mission pull request: the PRD says it does not, unless a person retargets it.
- (author) Whether the owner reads BR-PRODUCT-5 as kept when the fleet's answer closes a question for the mission branch only, as the spec asks the owner to confirm.

```

<!-- /omni-outbox-settled: s10-01-fleet-answer-held-only-by-the-app-check -->

<!-- omni-outbox-settled: s11-01-overturned-answer-not-written-back -->

## s11-01-overturned-answer-not-written-back — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-12
- Raised: 2026-11-16
- Slice: s11
- Wave: 11
- Became: BR-PRODUCT-146

### The answer, as it was given

```text
A. The overturn is an event; the answered question is not put back on the feature branch (built).
```

### The item, as it was raised

```text
---
id: s11-01-overturned-answer-not-written-back
prd: 2896
slice: s11
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-16
wave: 11
---

## The question, in plain words

When a person overturns an answer the fleet gave, should the App also put the question back in the feature branch's outbox, or is a note in the mission's record enough?

## The decision, in plain words

An overturn is recorded as the person's own note beside the fleet's decision, which stays as it was, and the PRD leaves the mission branch if it had joined. The App does not put the answered question back on the feature branch: the person answers it on the pull request.

## The intro, for fun

The fleet wrote its answer in pen.

## The punchline, for fun

You may cross it out, but only in the margin.

## The options, in plain words

A. The overturn is an event; the answered question is not put back on the feature branch (built).
B. The App also writes a commit on the feature branch that opens the question again, from the settled list.

## What I had to decide

How far "reopens the item for that person" goes. Putting the question back needs a commit on the PRD's branch that reverses the fleet's settlement, which the slice's territory does not hold (the kit's outbox files and the settlement code belong to slice s10).

## What I did meanwhile

The decision stays as recorded and the person's overturn sits beside it; the PRD is dropped from the branch when it had joined, so it cannot join again until a person sends it again. The PRD's own pull request into the mission branch is where the person answers.

## What it costs to change later

Option B is one more function next to the App's settlement code and one call in the overturn's run: no stored shape changes.

## What I could not know

(author) The spec says an overturned answer "reopens the item for that person", and does not say whether the item must be a file on the branch again.

- (author) Whether answering on the pull request is enough for the person, or the item must reappear in the outbox folder.

```

<!-- /omni-outbox-settled: s11-01-overturned-answer-not-written-back -->

<!-- omni-outbox-settled: s11-02-overturn-needs-a-migration-and-a-client-call -->

## s11-02-overturn-needs-a-migration-and-a-client-call — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-12
- Raised: 2026-11-16
- Slice: s11
- Wave: 11
- Stays here: a territory call for this PRD only

### The answer, as it was given

```text
A. Add the migration and the client method here, flagged (built).
```

### The item, as it was raised

```text
---
id: s11-02-overturn-needs-a-migration-and-a-client-call
prd: 2896
slice: s11
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-16
wave: 11
---

## The question, in plain words

The overturn needed a new kind of event in the database and a new call in the terminal's client, both outside this slice's territory. Should they have waited for another slice?

## The decision, in plain words

I added one new kind of event to the database and one new call to the terminal's client, both outside this slice's territory. Nothing else outside the territory changed.

## The intro, for fun

The slice asked for a door and the wall was next door.

## The punchline, for fun

It knocked a small hole and left a note.

## The options, in plain words

A. Add the migration and the client method here, flagged (built).
B. Leave the overturn unrecorded and ask for a slice that owns them.

## What I had to decide

Without the event kind the database refuses an overturn, and without the client method the command cannot call the App. The plan's shared-ground note names the migration folder for other slices only.

## What I did meanwhile

The migration is additive and dated after the newest one on the feature branch; the check proves a member reads the event and nobody else writes it.

## What it costs to change later

Moving the two files into another slice later is a rename of ownership only.

## What I could not know

(author) Whether the plan's territory for s11 was meant to hold the event kind and the client call.

- (author) The owner's reading of the shared-ground note in the plan.

```

<!-- /omni-outbox-settled: s11-02-overturn-needs-a-migration-and-a-client-call -->

<!-- omni-outbox-settled: s11-03-decision-names-and-trust-line-from-events -->

## s11-03-decision-names-and-trust-line-from-events — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-12
- Raised: 2026-11-16
- Slice: s11
- Wave: 11
- Stays here: how this PRD names decisions, written in the mission command help and the guide

### The answer, as it was given

```text
A. Name by PRD number and item, read the lists from the events (built).
```

### The item, as it was raised

```text
---
id: s11-03-decision-names-and-trust-line-from-events
prd: 2896
slice: s11
rank: high
bears-on: BR-PRODUCT-12
raised: 2026-11-16
wave: 11
---

## The question, in plain words

How does a person name the decision they overturn, and where do the lists and the trust line get their numbers?

## The decision, in plain words

A person names an approval by its PRD's number, and an answer by its PRD's number and the question's name. The lists and the trust line are both read from the mission's own record of decisions and overturns.

## The intro, for fun

Every decision gets a name tag.

## The punchline, for fun

The tag is a number, a slash and a word.

## The options, in plain words

A. Name by PRD number and item, read the lists from the events (built).
B. Give each decision an id of its own in a new table.

## What I had to decide

The spec leaves `<decision>` open. Answers have no row of their own, only an event, so a table id would have needed a new stored shape.

## What I did meanwhile

An overturn of the same decision twice is refused; a decision made again later (a new committee) stands on its own. Events written before this slice keep no verdicts: their lines read `every member who sat answered yes`.

## What it costs to change later

Option B adds a table and a migration; the pure reader in `kit/lib/mission/overturn.ts` is the one place that changes.

## What I could not know

(author) Whether a person would rather paste a decision's link than type its name.

- (author) Whether the tab itself should offer the overturn, beside the pull request's list: the screen's open question names it.

```

<!-- /omni-outbox-settled: s11-03-decision-names-and-trust-line-from-events -->

<!-- omni-outbox-settled: s12-07-runner-refuses-pm-skills-off-a-mission -->

## s12-07-runner-refuses-pm-skills-off-a-mission — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-19
- Raised: 2026-11-16
- Slice: s12
- Wave: 12
- Stays here: agrees the proof holds the new refusal; the rule did not change

### The answer, as it was given

```text
A. A. The proof holds the new refusal, the rule's words unchanged (built).
```

### The item, as it was raised

```text
---
id: s12-07-runner-refuses-pm-skills-off-a-mission
prd: 2896
slice: s12
rank: high
bears-on: N-PRODUCT-19
raised: 2026-11-16
wave: 12
---

## The question, in plain words

The runner now also refuses the PM's four writing skills on any job that no mission at Works alone sent, and a test proving what the runner refuses gained that case: do you agree?

## The decision, in plain words

The four skills join the runner's list of the loop's own skills, so they are refused as a repository's own skill too, and the runner refuses them before any work starts unless the job carries a mission at Works alone. The rule's words did not change.

## The intro, for fun

Four new names on the guest list, with a plus-one rule.

## The punchline, for fun

They only get in when a mission walks them to the door.

## The options, in plain words

A. A. The proof holds the new refusal, the rule's words unchanged (built).
B. B. Keep the PM's skills off the runner's list, so a mission's PM needs a person at a terminal.

## What I had to decide

Whether the proof of N-PRODUCT-19 may hold the new refusal, and whether the rule's words should name it.

## What I did meanwhile

kit/lib/runner/runner.test.ts gains one case: a PM skill on a job of no mission, or of one below alone, ends failed before any worktree is made. Its helper takes the job's mission; every earlier case is unchanged.

## What it costs to change later

Removing the four skills from the three lists and the case from the test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person expects to send these skills to a runner by hand some day, which this refuses.

```

<!-- /omni-outbox-settled: s12-07-runner-refuses-pm-skills-off-a-mission -->

<!-- omni-outbox-settled: s1-02-fleet-level-extends-fleet-proofs -->

## s1-02-fleet-level-extends-fleet-proofs — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-GAME-2
- Raised: 2026-11-16
- Slice: s1
- Wave: 1
- Stays here: agrees the fleet proofs still prove the same rules

### The answer, as it was given

```text
A. A. The proofs hold the same rules, with the level added (built).
```

### The item, as it was raised

```text
---
id: s1-02-fleet-level-extends-fleet-proofs
prd: 2896
slice: s1
rank: high
bears-on: BR-GAME-2
raised: 2026-11-16
wave: 1
---

## The question, in plain words

Adding a level to every fleet changed the tests that prove how a fleet is made and who may change it: do you agree they still prove the same rules?

## The decision, in plain words

Every fleet is now made with a level, so the fleet tests pass the level with-you where they made a fleet, and new cases prove the level guard. No case that proves a fleet rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the level added (built).
B. B. Keep the old fleet proofs as they were and prove the level in separate tests only.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The fleet controller and repository tests, and the database check for fleets, were read for this by the person who finished the PRD, not by the law's owner.

```

<!-- /omni-outbox-settled: s1-02-fleet-level-extends-fleet-proofs -->

<!-- omni-outbox-settled: s14-02-plan-repository-extends-mission-proofs -->

## s14-02-plan-repository-extends-mission-proofs — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-137
- Raised: 2026-11-16
- Slice: s14
- Wave: 14
- Stays here: agrees the brief and approval proofs still prove the same rules

### The answer, as it was given

```text
A. A. The proofs hold the same rules, with the refusal cases added (built).
```

### The item, as it was raised

```text
---
id: s14-02-plan-repository-extends-mission-proofs
prd: 2896
slice: s14
rank: high
bears-on: BR-PRODUCT-137
raised: 2026-11-16
wave: 14
---

## The question, in plain words

Refusing own-branch in a plan repository added cases to the tests that prove what a valid brief is and who approves a PRD: do you agree they still prove the same rules?

## The decision, in plain words

Cases were added for the refusal only. No case that proves either rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the refusal cases added (built).
B. B. Move the refusal cases out to tests of their own.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The brief and mission service tests were read for this by the person who finished the PRD, not by the laws' owner.

```

<!-- /omni-outbox-settled: s14-02-plan-repository-extends-mission-proofs -->

<!-- omni-outbox-settled: s2-03-mission-level-extends-mission-proofs -->

## s2-03-mission-level-extends-mission-proofs — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-137
- Raised: 2026-11-16
- Slice: s2
- Wave: 2
- Stays here: agrees the brief and approval proofs still prove the same rules

### The answer, as it was given

```text
A. A. The proofs hold the same rules, with the new mandate fields added (built).
```

### The item, as it was raised

```text
---
id: s2-03-mission-level-extends-mission-proofs
prd: 2896
slice: s2
rank: high
bears-on: BR-PRODUCT-137
raised: 2026-11-16
wave: 2
---

## The question, in plain words

Adding a level and two bounds to a mission's mandate changed the tests that prove what a valid brief is and who approves a PRD: do you agree they still prove the same rules?

## The decision, in plain words

A mandate now also reads a level and two bounds, each with a default, so tests that read a whole mandate expect those defaults and new cases prove each field. No case that proves either rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the new mandate fields added (built).
B. B. Keep the old brief proofs as they were and prove the new fields in separate tests only.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The brief and mission service tests were read for this by the person who finished the PRD, not by the laws' owner.

```

<!-- /omni-outbox-settled: s2-03-mission-level-extends-mission-proofs -->

<!-- omni-outbox-settled: s3-03-mission-branch-extends-mission-proofs -->

## s3-03-mission-branch-extends-mission-proofs — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T12:57:41Z
- Channel: feature pull request #2897
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2897#issuecomment-6917059051
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-16
- Slice: s3
- Wave: 3
- Stays here: agrees the mission and config proofs still prove the same rules

### The answer, as it was given

```text
A. A. The proofs hold the same rules, with the mission branch cases added (built).
```

### The item, as it was raised

```text
---
id: s3-03-mission-branch-extends-mission-proofs
prd: 2896
slice: s3
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-16
wave: 3
---

## The question, in plain words

The mission branch added cases to the tests that prove a mission never resends a failed PRD and that the config refuses a bad signature: do you agree they still prove the same rules?

## The decision, in plain words

The supervisor's test mission now carries its level, and cases were added for the mission branch and for the new branch name in the config. No case that proves either rule was removed or loosened.

## The options, in plain words

A. A. The proofs hold the same rules, with the mission branch cases added (built).
B. B. Move the mission branch cases out to tests of their own.

## What I had to decide

Before the feature pull request is marked ready.

## What I did meanwhile

The proofs run as changed; nothing is held.

## What it costs to change later

Low: the change only adds cases and new arguments; undoing it means removing the new cases.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The supervisor, mission end-to-end and config tests were read for this by the person who finished the PRD, not by the laws' owner.

```

<!-- /omni-outbox-settled: s3-03-mission-branch-extends-mission-proofs -->
