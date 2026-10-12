# Settled outbox items — PRD 1726

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-law-word-means-locked-weight-unchanged -->

## s1-01-law-word-means-locked-weight-unchanged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-law-word-means-locked-weight-unchanged
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Now that a law means a locked rule, should a decision that bears on a principle or an ordinary rule still be ranked high, as it is today?

## The decision, in plain words

Yes for now: only the word changed, so a law is a locked rule and nothing else is called one. What gets ranked high, and what the review gate asks of a rule, stay as they were.

## The intro, for fun

One word, three meanings, one rename.

## The punchline, for fun

The word moved house; the furniture stayed put.

## The options, in plain words

A. A. Keep the high floor for every confirmed principle, rule and law; reserve the word law for locked entries only.
B. B. Floor only rules and laws high; a decision bearing on a principle gets its own rank.
C. C. Floor only locked laws high; rules and principles rank like any other decision.

## What I had to decide

Whether items bearing on a principle or an unlocked rule keep their high floor, now that only locked entries are called laws.

## What I did meanwhile

The registers now have one law test: a locked rule or invariant. A second test, for confirmed rules, keeps the rule-level gate and the high floor exactly as before. The review gate now uses that shared test instead of its own copy. The status and graph counts that still say law for every confirmed entry are left for slices s2 and s5.

## What it costs to change later

One line in the floor check and its tests; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says law means one thing everywhere, but also that the rules keep their gate; it does not say whether a principle still floors an item high.
- (author) kb status, the knowledge graph and knowledge judge still count every confirmed entry as a law; their files belong to s2 and s5.

```

<!-- /omni-outbox-settled: s1-01-law-word-means-locked-weight-unchanged -->

<!-- omni-outbox-settled: s1-02-how-a-lock-line-is-read -->

## s1-02-how-a-lock-line-is-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-how-a-lock-line-is-read
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

How strict should the knowledge check be about a lock line that is badly written, or that sits beside other lines that contradict it?

## The decision, in plain words

Strict: a badly written lock still counts and is refused until fixed, and so is a lock on a rule still marked proposed or whose test is only promised. Owners are written without the at sign, and a copy of another repository's knowledge is never asked about the cap or the owners.

## The intro, for fun

A lock scribbled in pencil is still a lock.

## The punchline, for fun

Better a red check today than a quiet law nobody guards.

## The options, in plain words

A. A. Fail closed: a malformed lock counts and is refused; lock beside Proposed: is refused; pending is no test; owners without @.
B. B. Lenient: a malformed lock is ignored with a warning, pending counts as a test, and owners may carry @.

## What I had to decide

How a malformed or contradictory Locked: line is read and graded.

## What I did meanwhile

A malformed Locked: line reads as locked with no owner and no date, counts against the cap and is refused. Locked: beside Proposed: is refused. Enforced by: pending counts as no test. laws.owners refuses a name written with @. An imported copy skips the cap and owners checks, as it skips requireProof.

## What it costs to change later

A constant or a branch each in the register reader and the knowledge check, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists what a lock must carry but not how a malformed lock line, or a lock beside Proposed:, is read.
- (author) Whether a pending law issue counts as the test a lock needs is not settled; I read a lock as needing a real test path.

```

<!-- /omni-outbox-settled: s1-02-how-a-lock-line-is-read -->

<!-- omni-outbox-settled: s1-03-coverage-helper-outside-territory -->

## s1-03-coverage-helper-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-coverage-helper-outside-territory
prd: 1726
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Was it right to touch the review gate's file, which belongs to a later slice, to share the new definition of a law?

## The decision, in plain words

Yes, with the smallest possible change: the gate now asks the shared rule test instead of keeping its own copy, and it behaves exactly as before.

## The intro, for fun

Two copies of one definition always drift apart.

## The punchline, for fun

So one of them retired early.

## The options, in plain words

A. A. Swap the private helper for the shared one in s1, behaviour unchanged.
B. B. Leave the review gate's own copy alone and let the later slice make the swap.

## What I had to decide

Whether s1 may swap decision-coverage.ts's private law test for the shared one, outside its territory.

## What I did meanwhile

decision-coverage.ts imports isConfirmedRule from the registers in place of its own isLaw; its tests pass unchanged. Slice s3 builds law-locked in that file next wave.

## What it costs to change later

Reverting is one import and five lines in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when asks both files to agree, but its territory for s1 does not list decision-coverage.ts.

```

<!-- /omni-outbox-settled: s1-03-coverage-helper-outside-territory -->

<!-- omni-outbox-settled: s2-01-governs-is-a-path-pattern-not-a-glob -->

## s2-01-governs-is-a-path-pattern-not-a-glob — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-governs-is-a-path-pattern-not-a-glob
prd: 1726
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The list of files a rule governs is written in the same pattern language the flow areas already use, so a wildcard written as two stars is refused; is that the right language?

## The decision, in plain words

Yes: one pattern language for the whole kit, as the spec asks, even though the spec's own examples were written with two-star wildcards.

## The intro, for fun

Two ways to say every file in this folder walked into a kit.

## The punchline, for fun

Only one of them already had a key to the door.

## The options, in plain words

A. Regular expressions, the flow areas' own matcher, a glob refused by omni check knowledge (built).
B. Globs: translate ** and * to a regular expression before matching, the flow areas keeping theirs.
C. Both: a pattern containing ** read as a glob, anything else as a regular expression.

## What I had to decide

Whether a Governs line is read as the flow areas read their paths (a regular expression, such as ^kit/lib/outbox/) or as a glob (kit/lib/outbox/**), the spec asking for both: the flow matcher, and examples written as globs.

## What I did meanwhile

Governs patterns are matched by the flow areas' own resolver (resolveFlow and areaOf), and omni check knowledge refuses any pattern that does not compile as a regular expression, naming it and showing the ^kit/lib/outbox/ shape. The s1 test fixture that wrote kit/lib/advisor/** now writes ^kit/lib/advisor/.

## What it costs to change later

A constant: switching to globs is a translation function in disclose.ts and the check's message; no entry in this repository carries Governs yet, so no data moves. Once s6 writes Governs on 108 entries, a switch would rewrite those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says Governs reuses the flow areas' matcher and also shows kit/lib/outbox/** as an example; the two cannot both hold, since ** does not compile as a regular expression.
- (author) A slice's territory is a list of path prefixes; --slice matches each prefix and every tracked file under it, so a pattern naming one file still meets the slice that owns its folder.

```

<!-- /omni-outbox-settled: s2-01-governs-is-a-path-pattern-not-a-glob -->

<!-- omni-outbox-settled: s2-02-a-locked-law-needs-a-thesis -->

## s2-02-a-locked-law-needs-a-thesis — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-a-locked-law-needs-a-thesis
prd: 1726
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Once a person locks a first law, the knowledge check now fails until the one-page summary for newcomers exists and lists it; is that strict enough, or too strict?

## The decision, in plain words

Strict: a law nobody can read about on the newcomer page is a law a newcomer will break, so the page must exist as soon as one law does.

## The intro, for fun

A law was locked, and the welcome page had not been written yet.

## The punchline, for fun

Newcomers rarely break rules they were told about.

## The options, in plain words

A. Refuse a lock with no thesis or no laws section, and a law line with no 'If broken:' (built).
B. Grade the thesis only when it exists, and never its line shape.

## What I had to decide

Whether omni check knowledge refuses a repository that locks a law but has no thesis (or a thesis with no laws section), the spec only saying it refuses a laws section naming an unlocked id or missing a locked one.

## What I did meanwhile

With no law locked, nothing is asked of the thesis. With one locked, a missing thesis, a thesis with no '## The laws' section, a law line naming an unlocked id, a locked law left out, and a law line with no 'If broken:' are each refused with their own message. An imported copy is never asked. The briefing ends with the thesis's laws section, or with the locked laws read from the registers when the thesis has none.

## What it costs to change later

A constant: dropping the missing-thesis refusal is two early returns in thesis.ts. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Requiring 'If broken:' on each law line follows the spec's line shape; the spec does not say the check enforces it.
- (author) omni kb laws says who must approve a change from laws.owners, not from the CODEOWNERS file, which s4 writes from the same setting.

```

<!-- /omni-outbox-settled: s2-02-a-locked-law-needs-a-thesis -->

<!-- omni-outbox-settled: s3-01-approval-on-the-latest-commit -->

## s3-01-approval-on-the-latest-commit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-approval-on-the-latest-commit
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When an owner approves a change to a locked law and someone pushes again afterwards, should the approval still count?

## The decision, in plain words

No: only an approval given on the latest commit counts, so every push after it asks the owner to approve again.

## The intro, for fun

An owner said yes, then the branch moved on.

## The punchline, for fun

A yes is for the change they saw, not for the next one.

## The options, in plain words

A. Only an approval of the latest commit counts (built).
B. Any standing approval counts, whatever was pushed after it.
C. An approval counts until a later push changes a file that fired the rule.

## What I had to decide

Whether an approving review of an older commit of the pull request still clears law-locked once new commits are pushed.

## What I did meanwhile

approversOf (apps/omni-app/src/outbox-check/law-locked.ts) keeps each reviewer's latest standing review (approved, changes requested or dismissed; a comment changes nothing) and counts it only when its commit_id is the head SHA being checked. The end-to-end test pins that an approval of an older commit leaves the check red.

## What it costs to change later

One comparison in approversOf: dropping the commit test makes any standing approval count, with its test updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says only an approving review clears it; it does not say which commit the review must be of.
- (author) A feature PR gets pushes from waves and from pr-care after the owner approved; each one asks the owner again, as GitHub's own 'dismiss stale approvals' setting would.

```

<!-- /omni-outbox-settled: s3-01-approval-on-the-latest-commit -->

<!-- omni-outbox-settled: s3-02-teams-never-clear-a-law -->

## s3-02-teams-never-clear-a-law — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-teams-never-clear-a-law
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the owners file names a team rather than a person for a locked law, should a team member's approval clear the change?

## The decision, in plain words

Not yet: only a person named directly counts, because the app is not allowed to read who belongs to a team, so a law owned by a team alone stays red.

## The intro, for fun

The owners file says 'the core team', and the app cannot see who that is.

## The punchline, for fun

When in doubt, the door stays shut.

## The options, in plain words

A. Only a person named directly clears a law; a team owner alone keeps it red (built).
B. Ask for the members permission and let any member of an owning team clear it.
C. Refuse a team in laws.owners, so the CODEOWNERS block only ever names persons.

## What I had to decide

How law-locked treats a CODEOWNERS owner that is a team (@org/team) or an e-mail, which no review can be matched to without reading team membership.

## What I did meanwhile

isPersonOwner (kit/lib/codeowners.ts) counts only @login owners; a file owned by teams or e-mails alone is held as 'no CODEOWNER', red and naming the law. The app's manifest asks for no members permission, so team membership cannot be read.

## What it costs to change later

Reading team membership needs the App's members:read permission (an org admin re-approves it) and one call per team owner; the matching itself is one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says laws.owners holds logins or teams, but not how a team's approval is checked.
- (author) laws.owners is not read by the gate: CODEOWNERS on the base branch is, as the spec says.

```

<!-- /omni-outbox-settled: s3-02-teams-never-clear-a-law -->

<!-- omni-outbox-settled: s3-03-each-file-by-its-own-owner -->

## s3-03-each-file-by-its-own-owner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-each-file-by-its-own-owner
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When a change to a locked law touches several files with different owners, must one person own all of them, or may each file be approved by its own owner?

## The decision, in plain words

Each file may be approved by its own owner, the way GitHub reads owners: the check turns green once every file has an approval from someone who owns it.

## The intro, for fun

Two files, two owners, one locked law.

## The punchline, for fun

Everyone signs for their own corner.

## The options, in plain words

A. Each file approved by one of its own owners (built).
B. One approver who owns every file the law's change touched.

## What I had to decide

Whether law-locked needs one person listed for every file that fired it, or an owner's approval per file.

## What I did meanwhile

lawsAwaitingOwners (kit/lib/outbox/decision-coverage.ts) judges each law alone and holds it while any file that fired it has no approval from one of that file's own person owners. With laws.owners writing one owner list for the whole CODEOWNERS block (s4), both readings agree.

## What it costs to change later

One rule in lawsAwaitingOwners: asking for one approver common to every file is an intersection instead of a per-file test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's words 'a person whom CODEOWNERS lists for every file' read either way.

```

<!-- /omni-outbox-settled: s3-03-each-file-by-its-own-owner -->

<!-- omni-outbox-settled: s3-04-unnamed-branches-not-graded -->

## s3-04-unnamed-branches-not-graded — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-unnamed-branches-not-graded
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Should the lock on a law also hold a pull request whose branch the loop does not recognise, which today gets no outbox check at all?

## The decision, in plain words

Not in this slice: the lock holds every pull request the check already grades (features, fixes, knowledge and test pull requests), and a pull request on an unrecognised branch still gets a skipped check.

## The intro, for fun

The guard checks every door with a name on it.

## The punchline, for fun

The side door with no name is still a side door.

## The options, in plain words

A. Lock every pull request the check grades; others stay skipped (built).
B. Also grade any pull request into the default branch for locked laws, red when one is changed without approval.

## What I had to decide

Whether law-locked runs on pull requests into the default branch the check skips today: a branch matching no branches.* shape, a feature branch with no PRD folder, and a target or product feature PR whose check defers elsewhere.

## What I did meanwhile

withLawGate runs after evaluate in evaluateAt (apps/omni-app/src/outbox-check/outbox-check.ts), reached only by a gated pull request: feature, fix, knowledge and enforce PRs. checkTarget still posts a skipped check on any other pull request, before any knowledge is read (issue 876 keeps those from ever going red).

## What it costs to change later

Grading a skipped pull request for locked laws means reading the base's knowledge in the in-progress step and turning a skipped check red there; issue 876's never-red promise would be amended.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'every kind, knowledge and enforce PRs included'; it does not name branches the loop does not know.
- (author) Until it is closed, renaming a branch out of the loop's shapes skips the lock; branch protection requiring a CODEOWNER review closes it on GitHub's side.

```

<!-- /omni-outbox-settled: s3-04-unnamed-branches-not-graded -->

<!-- omni-outbox-settled: s3-05-law-lock-outside-accounts -->

## s3-05-law-lock-outside-accounts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-05-law-lock-outside-accounts
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Should the new law lock be a separate check that only an owner's approval clears, kept apart from the list of risky changes an agent explains in writing?

## The decision, in plain words

Yes: the lock is its own rule, so no written explanation or answered question can ever clear it, and the local coverage check does not list it.

## The intro, for fun

Some doors open with a note; this one needs a key.

## The punchline, for fun

No note, however well written, turns a lock.

## The options, in plain words

A. A separate rule only an approval clears, outside the accounts (built).
B. One more risky rule the accounts list, always refused as accounted, so the local check names it too.

## What I had to decide

Whether law-locked joins riskyChanges' rules (and so the accounts, the coverage check and the kit's gate) or stays a separate list only the app's outbox check reads.

## What I did meanwhile

lockedLawChanges and lawsAwaitingOwners are exported beside riskyChanges in kit/lib/outbox/decision-coverage.ts but are not in RULE_IDS; the account format and omni check coverage are unchanged. A locked law moved to another register file, its words kept, counts as changed.

## What it costs to change later

Adding it to the risky list later is one rule and an account refusal, plus a local reading of approvals the kit does not have today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the rule runs in decision-coverage and in the app's check; it does not say the accounts should see it.
- (author) Locally, an agent learns of a locked law only from the app's check, until s5's skills read omni kb laws.

```

<!-- /omni-outbox-settled: s3-05-law-lock-outside-accounts -->

<!-- omni-outbox-settled: s3-06-manifest-test-outside-territory -->

## s3-06-manifest-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-06-manifest-test-outside-territory
prd: 1726
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

This slice changed one test outside the files it was given, the one that lists which GitHub events the app reacts to; is that acceptable?

## The decision, in plain words

Yes: that test lists every event the app reacts to, and reacting to reviews is what this slice adds, so the list gained one line.

## The intro, for fun

A guest list had to grow by one name.

## The punchline, for fun

The new guest was invited by the spec.

## The options, in plain words

A. Keep the one-line change to the manifest test (built).
B. Move the expectation into the webhook's own tests and leave the manifest test as it was.

## What I had to decide

Whether to edit apps/omni-app/test/app-yml.test.ts, outside s3's territory, whose HANDLED expectation must name pull_request_review once the webhook handles it.

## What I did meanwhile

The test's HANDLED expectation gained pull_request_review: ['submitted', 'dismissed'], its title says so; nothing else in it changed. The manifest (app.yml) already subscribes to pull_request_review, so no permission or event was added; its header comment, which lists the actions the app acts on, was left as it is.

## What it costs to change later

Nothing to undo: the line follows the webhook's table.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s3 names apps/omni-app/test/fixtures/ but not this test, which the spec's re-run on reviews cannot avoid.

```

<!-- /omni-outbox-settled: s3-06-manifest-test-outside-territory -->
