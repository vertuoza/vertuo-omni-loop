# Settled outbox items — PRD 2608

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow -->

## s1-01-a-person-adds-the-tech-approval-check-to-the-workflow — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T10:03:57Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6628019789
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-11-03
- Slice: s1
- Wave: 1
- Stays here: a one-off step for this PRD, already on the feature branch; nothing lasting to record.

### The answer, as it was given

```text
ok
```

### The item, as it was raised

```text
---
id: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow
prd: 2608
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

The new database check that proves the Tech Approval rules only counts if the automatic checks run it, and the agent was refused permission to change the workflow that lists them. Can a person add that one step?

## The decision, in plain words

The slice ships the check without its workflow step. Until a person adds the step, the check runs only when someone runs it by hand, so the database could stop enforcing a rule without any check going red.

## The intro, for fun

The guard is hired and trained, but nobody may write it onto the rota.

## The punchline, for fun

Only a person holds the pen for that page.

## What a person must do

1. Open .github/workflows/supabase.yml on the branch feat/tech-approval--s1 (or the feature branch once it merged).
2. Right after the step named "A push that changes a pinned file voids the approval", add a step named "A Tech Approval before the product approval" whose run line is the same psql command as its neighbours, with -f supabase/checks/tech_approval.sql.
3. Commit and push it as yourself, and answer this item.

## What I had to decide

A person adds the step to the database workflow, on this slice's branch or the feature branch, before the feature pull request is marked ready.

## What I did meanwhile

The check passes against a fresh local database with every migration, and every other database check stays green; the pull request's own checks do not run it yet.

## What it costs to change later

One step of five lines in one workflow file; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The agent's GitHub App lacks the permission to change workflow files, so this is the one part of the slice it cannot push.

```

<!-- /omni-outbox-settled: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow -->

<!-- omni-outbox-settled: s1-02-an-early-product-request-still-reaches-the-bell -->

## s1-02-an-early-product-request-still-reaches-the-bell — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T10:02:16Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6627991725
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-11-03
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-126

### The answer, as it was given

```text
A. A. Record an early request; only the product approval waits (what was built).
```

### The item, as it was raised

```text
---
id: s1-02-an-early-product-request-still-reaches-the-bell
prd: 2608
slice: s1
rank: medium
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

If someone asks the product's approvers before the Tech Approval is given, should the database refuse that request, or record it and let the approvers' bell show it while their approval stays refused?

## The decision, in plain words

The database records it: the product's approvers see the request in their bell, but their approval is refused, naming who it waits on, until the Tech Approval is given. Keeping the terminal and the page from asking early is left to the slices that build them.

## The intro, for fun

Knocking on the second door before the first one opens is allowed; walking through is not.

## The punchline, for fun

The doorbell rings, the lock holds, and the sign says who has the key.

## The options, in plain words

A. A. Record an early request; only the product approval waits (what was built).
B. B. Refuse a product request while a requested Tech Approval is not given.

## What I had to decide

Keep asking open: only the approval itself waits. A later slice may refuse an early request with one more check in the same function.

## What I did meanwhile

A product approver asked early sees the request, presses approve, and reads that the PRD waits for the named person's Tech Approval.

## What it costs to change later

One check to add in the request function if early requests should be refused; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the product's approvers are asked once the Tech Approval is given, but does not say what an earlier request does (author).

```

<!-- /omni-outbox-settled: s1-02-an-early-product-request-still-reaches-the-bell -->

<!-- omni-outbox-settled: s1-03-the-tech-state-is-left-out-when-nobody-asked -->

## s1-03-the-tech-state-is-left-out-when-nobody-asked — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T10:02:16Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6627991725
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-11-03
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-127

### The answer, as it was given

```text
A. A. Leave the tech part out when nobody asked (what was built).
```

### The item, as it was raised

```text
---
id: s1-03-the-tech-state-is-left-out-when-nobody-asked
prd: 2608
slice: s1
rank: medium
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

When a PRD has no Tech Approval request, should the approval the terminal reads say nothing about it, or say there is none?

## The decision, in plain words

It says nothing: the tech part appears only once a Tech Approval was requested, so a PRD with no request reads exactly as it does today, for an older terminal too.

## The intro, for fun

Silence is the most backward-compatible answer there is.

## The punchline, for fun

Nobody asked, so nobody hears a word about it.

## The options, in plain words

A. A. Leave the tech part out when nobody asked (what was built).
B. B. Always send it, empty when nobody asked.

## What I had to decide

Keep the tech part absent with no request; it holds the login of the named person and one state of asked, approved or voided once there is one.

## What I did meanwhile

The later slices read a missing tech part as no Tech Approval requested.

## What it costs to change later

A constant to change in one function if an empty value is wanted instead; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec calls the field optional without saying whether it is absent or empty when nobody asked (author).

```

<!-- /omni-outbox-settled: s1-03-the-tech-state-is-left-out-when-nobody-asked -->

<!-- omni-outbox-settled: s2-01-a-person-with-no-row-is-also-emailed-when-their-approval-is-voided -->

## s2-01-a-person-with-no-row-is-also-emailed-when-their-approval-is-voided — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-a-person-with-no-row-is-also-emailed-when-their-approval-is-voided
prd: 2608
slice: s2
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

Should a person with no alert settings also get the email when a change voids their approval, or only the email for a new approval request?

## The decision, in plain words

The spec says email is on by default for everyone and a person with no row reads as on, but the plan only names the request email. I applied the same default to the voided-approval email, so both emails treat a person with no settings alike.

## The intro, for fun

One door now opens for everyone, so the side door should not stay locked.

## The punchline, for fun

Same default, same welcome.

## The options, in plain words

A. A. Both emails follow the default: a person with no row is emailed in both cases (as built).
B. B. Only the request email follows the default; the voided-approval email keeps needing a row with email on.

## What I had to decide

Whether the voided-approval email follows the same on-by-default rule as the request email.

## What I did meanwhile

The migration redefines both reads with the on-by-default rule, and the database check holds the request case for no row, email off and email on.

## What it costs to change later

One follow-up migration restores the old read of the voided-approval email; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the request email only; the spec's wording 'for everyone' is why I read it to cover the voided-approval email too.

```

<!-- /omni-outbox-settled: s2-01-a-person-with-no-row-is-also-emailed-when-their-approval-is-voided -->

<!-- omni-outbox-settled: s2-02-the-product-approvers-check-expects-email-on-by-default -->

## s2-02-the-product-approvers-check-expects-email-on-by-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-the-product-approvers-check-expects-email-on-by-default
prd: 2608
slice: s2
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

Is it fine that this slice also edited the older product approvers database check, which is outside its planned files?

## The decision, in plain words

Turning email on by default made one line of that older check wrong, because it still expected both alert switches off. I changed that one expectation to push off and email on, and nothing else in the file.

## The intro, for fun

A new default walked in and an old sign still said otherwise.

## The punchline, for fun

One line of the sign was repainted.

## The options, in plain words

A. A. Update the one expectation here (as built).
B. B. Revert it and fix it in a separate pull request, leaving CI red meanwhile.

## What I had to decide

Whether to update the older check inside this slice or leave it red for another slice.

## What I did meanwhile

Only the expected row and its failure message changed; the check passes against a fresh local database.

## What it costs to change later

One line in one check file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice does not list the older check; the change was needed to keep CI green.

```

<!-- /omni-outbox-settled: s2-02-the-product-approvers-check-expects-email-on-by-default -->

<!-- omni-outbox-settled: s3-01-the-plan-left-three-small-files-out -->

## s3-01-the-plan-left-three-small-files-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-the-plan-left-three-small-files-out
prd: 2608
slice: s3
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

The slice needed three small changes in files its plan did not list. Should they stay in this slice, or be moved out to a slice of their own?

## The decision, in plain words

They stay here: the two new calls the terminal makes, the help text for the new command, and the one read that would have dated a PRD's approval from its Tech Approval. Each is a few lines, and none of them could wait for another slice.

## The intro, for fun

The map showed the house, but the front door was just off the edge.

## The punchline, for fun

We stepped over the line for three small things and left a note on the mat.

## The options, in plain words

A. A. Keep the three small changes in this slice (what was built).
B. B. Move them to a slice of their own, and hold the terminal's request and the correct date until it merges.

## What I had to decide

Keep the three small changes outside the plan's list in this slice: the kit's one client gains two calls, the help names the new command, and the stage sync reads the product approval only.

## What I did meanwhile

Each change has its test. Nothing else outside the list was touched, and the wave's check will report the three files as outside the list, as it should.

## What it costs to change later

A few lines in three files to move, nothing stored; another slice could carry them at the price of waiting for it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's list has no file that lets the terminal call a new page route, so the request could not be sent without one of them.
- (author) A slice in the next wave owns the help file, so it merges this change in when it starts: a small overlap, not a conflict expected.

```

<!-- /omni-outbox-settled: s3-01-the-plan-left-three-small-files-out -->

<!-- omni-outbox-settled: s3-02-a-tech-approval-has-its-own-stream-events -->

## s3-02-a-tech-approval-has-its-own-stream-events — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-a-tech-approval-has-its-own-stream-events
prd: 2608
slice: s3
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

When a terminal follows a PRD's approval as it happens, how should it hear about a Tech Approval, so that a terminal with an older kit never takes one for the real approval?

## The decision, in plain words

A Tech Approval gets its own news with new names, which an older kit already ignores, so the news it knows stays about the product approval alone. A newer kit waits on the named person and asks no approver until they have given it.

## The intro, for fun

Two doors, two doorbells, and the old house only hears its own.

## The punchline, for fun

A stranger's bell can ring all day without opening your door.

## The options, in plain words

A. A. News of its own names, ignored by an older kit (what was built).
B. B. Send no live news of it, and have a newer kit look again every few seconds while it waits.

## What I had to decide

Tell the Tech Approval with news of its own names, and leave the existing names for the product approval alone.

## What I did meanwhile

An older kit keeps waiting for the product approval and never ends on a Tech Approval; it may still ask early, which is recorded and waits, as already settled. A newer kit names the person it waits on, and reads the state again after a cancelled approval, so the named person is asked first.

## What it costs to change later

A change in two small modules if another way of telling is wanted; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the approval's reply gains a tech part but does not say how the live news carries it.
- (author) The member list shows only people with a GitHub login, so no email is ever shown; a member with no login could not be picked from it, which should be rare as members sign in with GitHub.

```

<!-- /omni-outbox-settled: s3-02-a-tech-approval-has-its-own-stream-events -->

<!-- omni-outbox-settled: s5-01-tech-review-who-is-named-checked-in-terminal -->

## s5-01-tech-review-who-is-named-checked-in-terminal — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-tech-review-who-is-named-checked-in-terminal
prd: 2608
slice: s5
rank: medium
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

The tech review checks who is running it by their GitHub login in their own terminal, while only giving the approval is enforced by the server: is that enough?

## The decision, in plain words

The skill reads the login with GitHub's own command and refuses on a mismatch or when none can be read. Someone who edits their own copy of the skill could still run the review as another person, but they still could not give the approval, because the server only accepts it from the named person.

## The intro, for fun

The bouncer checks the guest list, but only at the front door of the building.

## The punchline, for fun

The vault still opens for the named person alone.

## The options, in plain words

A. A. The terminal check only: the skill reads the GitHub login and refuses a mismatch; the server enforces the approval.
B. B. Add a server check on who may push the review's changes to the PRD, in a later PRD.

## What I had to decide

Option A keeps the terminal check and relies on the server for the approval. Option B would add a server check on who pushes a tech-review commit, which needs a new rule outside this slice.

## What I did meanwhile

The review is refused for anyone whose GitHub login differs from the named one, and the approval stays with the named person.

## What it costs to change later

Option B costs a server rule and a migration; undoing option A later costs a line in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a review by the wrong person is worth blocking on a server (author)

```

<!-- /omni-outbox-settled: s5-01-tech-review-who-is-named-checked-in-terminal -->

<!-- omni-outbox-settled: s2-03-the-approval-requests-check-now-expects-no-row-to-be-emailed -->

## s2-03-the-approval-requests-check-now-expects-no-row-to-be-emailed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T14:08:08Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6632759449
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-04
- Slice: s2
- Wave: 2
- Became: BR-PRODUCT-128

### The answer, as it was given

```text
A. A. Keep the new expectation: no row is emailed, email off is not, email on is (as built).
```

### The item, as it was raised

```text
---
id: s2-03-the-approval-requests-check-now-expects-no-row-to-be-emailed
prd: 2608
slice: s2
rank: high
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

The database check that proves how approval requests reach people used to expect that a person with no alert settings got no email. Is it right that it now expects them to be emailed?

## The decision, in plain words

The spec turns email on by default for everyone, so that old expectation became wrong and I changed it, then added cases for a new row, a row with email off and a row with email on. The check sits beside the approval rules, so a person should confirm the change in what it proves.

## The intro, for fun

The rulebook's footnote changed, so the referee wants a witness.

## The punchline, for fun

Say yes and the new default is official.

## The options, in plain words

A. A. Keep the new expectation: no row is emailed, email off is not, email on is (as built).
B. B. Keep the old expectation and leave email off by default for people with no row.

## What I had to decide

Whether the check may expect an email for a person with no alert settings, as the spec's on-by-default rule says.

## What I did meanwhile

The check passes against a fresh local database; no approval rule other than the email default was touched.

## What it costs to change later

Restoring the old expectation is one edit to the check, together with the default's own rollback.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when says the check holds three cases; it does not say that the existing no-row expectation flips.

```

<!-- /omni-outbox-settled: s2-03-the-approval-requests-check-now-expects-no-row-to-be-emailed -->

<!-- omni-outbox-settled: s4-01-the-page-tests-of-the-approval-rules-gain-tech-approval-cases -->

## s4-01-the-page-tests-of-the-approval-rules-gain-tech-approval-cases — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T14:08:08Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6632759449
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-11-04
- Slice: s4
- Wave: 3
- Stays here: about how two test files were extended for this PRD; nothing lasting to record.

### The answer, as it was given

```text
A. A. Keep the extended tests: old cases unchanged, new fields empty without a request (as built).
```

### The item, as it was raised

```text
---
id: s4-01-the-page-tests-of-the-approval-rules-gain-tech-approval-cases
prd: 2608
slice: s4
rank: high
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

Two test files that prove approval rules on the page and in the bell gained Tech Approval cases and two new expected fields. Do they still prove the rules they are named for?

## The decision, in plain words

I added cases for requesting, giving and waiting on a Tech Approval, and the old expectations only gained two fields that read as empty for a PRD with no request. Nothing expected was removed, and the files sit beside the approval rules.

## The intro, for fun

The referee's notebook grew two pages, so the rulebook wants a witness.

## The punchline, for fun

Say yes and the notes count.

## The options, in plain words

A. A. Keep the extended tests: old cases unchanged, new fields empty without a request (as built).
B. B. Keep the old expectations untouched and put the Tech Approval cases in new test files.

## What I had to decide

Keep the tests as extended: every old case still holds, with the tech fields empty for a PRD with no request.

## What I did meanwhile

The page tests and the Waiting tests pass, and so does the whole suite; a PRD with no request renders as before.

## What it costs to change later

Restoring the old files is a revert of this slice's test edits, together with the page code they cover.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when does not say whether the existing view expectations may gain the new fields.

```

<!-- /omni-outbox-settled: s4-01-the-page-tests-of-the-approval-rules-gain-tech-approval-cases -->
