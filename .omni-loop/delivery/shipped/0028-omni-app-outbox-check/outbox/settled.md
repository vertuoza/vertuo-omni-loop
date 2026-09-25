# Settled outbox items — PRD 28

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-evaluate-reads-two-snapshots -->

## s1-01-evaluate-reads-two-snapshots — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-evaluate-reads-two-snapshots
prd: 28
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the check read the main branch's settings and the pull request's outbox from one combined copy of the files, or from two separate copies?

## The decision, in plain words

Two separate copies: one of the main branch's settings, one of the pull request's delivery folder. A settings file inside the pull request is simply never looked at, so a pull request cannot quietly rename the override label.

## The options, in plain words

A. Two copies, the main branch's settings and the pull request's outbox, as built.
B. One combined copy holding the main branch's settings next to the pull request's outbox.
C. Two copies, but the comment is worked out at posting time rather than during the check.

## What I had to decide

The spec's unit table says evaluate takes one folder, but decision 4 says config comes from base and delivery from head, and the test seams ask that a head which renames the override label leaves the verdict unchanged. One merged folder cannot hold both a base and a head config, so that test would have nothing to prove. The spec also does not say how evaluate learns which outbox comment already exists.

## What I did meanwhile

evaluate takes `base` (a folder holding the base branch's `.omni-loop/config.yml`, or nothing) and `head` (a folder holding `paths.delivery` at the head SHA); the kit's context is rooted at `head` with the config parsed from `base`. It also takes `comments` (the PR's existing comments) and returns `comment: { id, body }` (id null = create, else rewrite) or null, computed by running the kit's `upsertOutboxPrComment` against an in-memory client. s4's `snapshot` is called twice with its list of paths; s5 fetches the PR's comments in the evaluate step and s4's `publish` posts the plan.

## What it costs to change later

A constant-level change: if one merged folder is preferred, evaluate reads the config from the same root and the renamed-label test is dropped. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec author meant one folder built from two refs, or was describing the unit loosely.
- (author) Whether publish should re-list comments at post time instead of trusting the id evaluate saw; a marker comment created between the two would be duplicated.

```

<!-- /omni-outbox-settled: s1-01-evaluate-reads-two-snapshots -->

<!-- omni-outbox-settled: s1-02-evaluate-grades-changed-files-when-given -->

## s1-02-evaluate-grades-changed-files-when-given — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-evaluate-grades-changed-files-when-given
prd: 28
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the check is handed the list of files a pull request changed, should it also hold the pull request for risky changes nobody explained?

## The decision, in plain words

Yes, when the list is handed in: the check then holds the pull request exactly as the kit's full gate does, and names those changes in its title. When no list is handed in, it only looks at open questions and unfinished rework.

## The options, in plain words

A. Grade the changed files whenever they are handed in, as built.
B. Never grade them: the check looks only at open questions and unfinished rework, matching the conclusion table.
C. Grade them, and widen the copy to include the knowledge folder so every rule can fire.

## What I had to decide

The spec makes changed files an input to evaluate, and the kit's gate uses them for one thing only, the unaccounted-risky-change reason. But the spec's conclusion table names only open items and unreworked drift, and the gate as /omni:yolo runs it today does not grade the range.

## What I did meanwhile

evaluate passes `changes` straight to `gateResult` when given (default null, range not graded); an unaccounted change makes the check `failure` with 'n unaccounted risky changes' in the title, overridable by the label like the others. The Inngest function (s5) chooses whether to pass the compare endpoint's files.

## What it costs to change later

One argument: s5 passes the changed files or does not. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) With laws.source set to knowledge, the law-proof rule reads the knowledge folder, which the snapshot does not hold today, so that one rule would never fire from the app.
- (author) Whether the spec author wanted the app's gate to match /omni:yolo's (no range) or the kit's fullest gate.

```

<!-- /omni-outbox-settled: s1-02-evaluate-grades-changed-files-when-given -->

<!-- omni-outbox-settled: s2-01-empty-product-registers -->

## s2-01-empty-product-registers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-empty-product-registers
prd: 28
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Keeping the new decision record where the plan puts it makes the repository's knowledge check fail, because that check expects three product register files to exist alongside it. How should the check be kept green?

## The decision, in plain words

Three placeholder product register files were added, each saying it holds nothing yet, so the knowledge check passes without changing the kit or the repository's settings.

## The options, in plain words

A. A: Placeholder product registers, each saying it holds nothing yet (built).
B. B: Point the decision record folder outside the knowledge folder in this repository's settings and drop the placeholders.
C. C: Teach the knowledge check to skip grading when the laws come from nowhere and the folder holds only decision records.
D. D: Keep the decision record elsewhere, such as beside the PRD, and leave the knowledge folder absent.

## What I had to decide

Whether the knowledge folder should carry placeholder product registers, whether the decision records should live outside it, or whether the knowledge check should skip a folder holding only decision records.

## What I did meanwhile

The knowledge folder holds the decision record plus three placeholder product registers with no principles, rules or invariants; the knowledge check reports zero of each and passes.

## What it costs to change later

Deleting three small files and, if chosen, a one-line settings change or a small kit change with its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names only the decision record folder, so the three register files sit outside it.
- (author) Whether a later PRD will fill the product registers is not known.

```

<!-- /omni-outbox-settled: s2-01-empty-product-registers -->

<!-- omni-outbox-settled: s2-02-bundle-not-committed -->

## s2-02-bundle-not-committed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-bundle-not-committed
prd: 28
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plan says to rebuild the kit's single-file bundle and commit it, but the repository is set to never track that bundle. Should it be committed anyway?

## The decision, in plain words

The bundle was rebuilt and checked to build cleanly, but not committed, because the repository deliberately ignores it and this repository runs the kit from source.

## The options, in plain words

A. A: Rebuild to prove it builds, keep it untracked as the ignore rule says (built).
B. B: Lift the ignore rule and commit the bundle with every kit change.

## What I had to decide

Whether the built bundle should be tracked in this repository, which means lifting the ignore rule, or stay a build output produced on demand.

## What I did meanwhile

The bundle builds cleanly from the changed kit and stays untracked; this repository's own command runs the kit source directly, so it already sees the new default.

## What it costs to change later

Removing one ignore rule and committing one generated file, then rebuilding it on every kit change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an installed repository will copy the bundle from this repository's history or from a release build is not settled.

```

<!-- /omni-outbox-settled: s2-02-bundle-not-committed -->

<!-- omni-outbox-settled: s3-01-event-carries-pr-and-sha -->

## s3-01-event-carries-pr-and-sha — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-event-carries-pr-and-sha
prd: 28
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

What should the notice that asks for a check say, and what happens when someone presses Re-run on a check that belongs to several pull requests, or to none?

## The decision, in plain words

The notice names the repository, the pull request and the exact commit. A re-run asks for one check per pull request it belongs to, and for none when GitHub ties it to no pull request.

## The options, in plain words

A. A. One event per listed pull request, none when there is none, as built.
B. B. Look the pull request up by head SHA when the list is empty.
C. C. Carry the full pull request facts in the event instead of re-reading them.

## What I had to decide

The spec says a handled delivery becomes one Inngest event but does not fix the event's data, and a `check_run` payload lists zero or more pull requests (zero for a pull request opened from a fork).

## What I did meanwhile

`toCheckRequests` emits `{ installationId, owner, repo, repository, prNumber, headSha, trigger }` per pull request; `check_run.rerequested` yields one event per entry of `check_run.pull_requests` and none when it is empty. Base/head refs and labels are not carried: s5 reads the pull request fresh in its evaluate step, so a debounced run sees the latest state. A delivery without an installation is ignored with 200; an event that cannot be sent answers 502 so GitHub records a failed delivery.

## What it costs to change later

A change to the event's data shape between s3 and s5, both in `apps/omni-app`; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether fork pull requests should get a check on Re-run by looking the PR up from the head SHA.

```

<!-- /omni-outbox-settled: s3-01-event-carries-pr-and-sha -->

<!-- omni-outbox-settled: s3-02-manifest-host-placeholder -->

## s3-02-manifest-host-placeholder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-manifest-host-placeholder
prd: 28
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Which web address should the app's registration file send GitHub's notifications to, when the hosting project does not exist yet?

## The decision, in plain words

It names the address the hosting project will most likely get. The person who registers the app checks it against the real address first and corrects it if needed.

## The options, in plain words

A. A. The likely hosting address with a note to correct it, as built.
B. B. An obvious placeholder host that registration must replace.
C. C. A custom vertuoza domain chosen now.

## What I had to decide

The spec asks for a committed manifest holding the webhook URL, but the Vercel project is a human step not yet taken, so its production domain is unknown.

## What I did meanwhile

`apps/omni-app/app.yml` points `url` at `https://omni-loop.vercel.app` and `hook_attributes.url` at `https://omni-loop.vercel.app/api/github`, with a comment telling the registrant to replace the host. The shape test checks only that the hook path is `/api/github`.

## What it costs to change later

One constant in `app.yml`, edited before or after registration (the webhook URL can also be changed in the app's settings). No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Vercel project's real production domain.
- (author) Whether a custom domain under vertuoza is wanted instead of the hosting default.

```

<!-- /omni-outbox-settled: s3-02-manifest-host-placeholder -->

<!-- omni-outbox-settled: s4-01-publish-trusts-the-planned-comment -->

## s4-01-publish-trusts-the-planned-comment — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-publish-trusts-the-planned-comment
prd: 28
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the check writes its outbox comment on a pull request, should it look again, just before writing, for a comment it may have posted a moment earlier?

## The decision, in plain words

No: it writes to the comment it found when it started checking, and creates one only if there was none then. Two checks racing on a brand-new pull request could leave two comments; the short wait between events makes that rare.

## The options, in plain words

A. Trust the comment found during the evaluation, as built.
B. Look the comments up again just before writing, and rewrite the marker comment if one appeared.
C. Let the check post a comment only when the evaluation found one, and never create one.

## What I had to decide

Whether the comment is looked up again at posting time, or the one found during the evaluation is trusted.

## What I did meanwhile

publish takes evaluate's planned comment ({ id, body }) as is: PATCH by id, or POST when id is null. It re-reads only the pull request's head SHA, to skip the comment when the head moved on. startCheck is a separate export that creates the check run in_progress; publish completes it.

## What it costs to change later

One extra comment listing inside publish and a marker match; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the per-PR debounce in the Inngest function (slice s5) is enough to make a duplicate comment practically impossible.
- (author) Where the marker text should come from at posting time, since publish has no kit context of its own.

```

<!-- /omni-outbox-settled: s4-01-publish-trusts-the-planned-comment -->

<!-- omni-outbox-settled: s5-01-check-grades-changed-files -->

## s5-01-check-grades-changed-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-check-grades-changed-files
prd: 28
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Should the live check also hold a pull request for risky changes nobody explained, or only for open questions and unfinished rework?

## The decision, in plain words

It also holds it for unexplained risky changes: the app hands the pull request's list of changed files to the gate, as the spec's description of the check asks, so the check matches the kit's fullest gate.

## The options, in plain words

A. Pass the changed files, so unexplained risky changes also turn the check red, as built.
B. Never pass them: the check looks only at open questions and unfinished rework.
C. Pass them and widen the copy to the knowledge folder, so every rule can fire.

## What I had to decide

Whether the running check passes the pull request's changed files to the gate.

## What I did meanwhile

The evaluate step reads the compare endpoint (base...head, paginated, at most 3,000 files) and maps GitHub's file statuses to the one-letter shape the kit reads; evaluate hands them to gateResult. On a repository without config, nothing is compared.

## What it costs to change later

One argument in the evaluate step: pass null instead of the list. No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's conclusion table (open items and drift only) or its unit description (changed files from the compare endpoint) is the intent; the two disagree.
- (author) With laws.source set to knowledge, the law-proof rule reads the knowledge folder, which the snapshot does not hold, so that one rule never fires from the app.

```

<!-- /omni-outbox-settled: s5-01-check-grades-changed-files -->

<!-- omni-outbox-settled: s5-02-test-stub-ships-with-app -->

## s5-02-test-stub-ships-with-app — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-test-stub-ships-with-app
prd: 28
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Where should the pretend GitHub used by the app's tests live?

## The decision, in plain words

Beside the code it tests, in the app's own folder, since the slice may only touch that folder. It is never loaded by the running app.

## The options, in plain words

A. Keep it beside the tests in the app's source folder, as built.
B. Move it under the app's test folder with the fixtures.

## What I had to decide

Where the stubbed GitHub used by the outbox-check and end-to-end tests lives.

## What I did meanwhile

It is apps/omni-app/src/outbox-check/fake-github.mjs, imported only by tests; the test fixtures folder belongs to another slice's territory. The Inngest route uses the SDK's web-standard adapter on Vercel's Node runtime, and vercel.json only raises the functions' time limit to 60s.

## What it costs to change later

Moving one file and two imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the repository prefers test support under test/ once territories no longer apply.

```

<!-- /omni-outbox-settled: s5-02-test-stub-ships-with-app -->

<!-- omni-outbox-settled: s5-03-check-name-and-failure-lookup -->

## s5-03-check-name-and-failure-lookup — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-check-name-and-failure-lookup
prd: 28
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When something goes wrong before the check can be finished, how does the app find the check it started, and what name does a new check carry?

## The decision, in plain words

The check takes its name from the main branch's settings, and pressing Re-run starts a fresh check. If a run fails, the app marks every unfinished check of that name on the same commit as failed, or posts one already failed when it never got to start one.

## The options, in plain words

A. Name from base config, find open checks by name on failure, fresh check on Re-run, as built.
B. Always use the default name, so no read is needed before the check appears.
C. Store the check's id outside the run so the failure handler completes exactly that one.

## What I had to decide

How the failure handler finds the check run to complete, and where the check's name comes from at creation.

## What I did meanwhile

Step in-progress reads the pull request and snapshots the base config to name the check by ci.outboxContext (the kit default when absent or broken). The failure handler cannot see the run's step results, so it lists check runs by name on the head SHA, completes every one not yet completed as failure, and creates a completed failure when there is none; if GitHub cannot be read it falls back to the default name. Runs are debounced 5s per repo and PR (at most 1m), retried 3 times, and a snapshot over its bound is not retried.

## What it costs to change later

Constants and one helper inside the app's outbox-check folder; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether another app posting a check of the same name on the same commit is a real case; the handler skips any run GitHub refuses to let it write.
- (author) Whether the Inngest debounce key expression is accepted as written by the hosted service; the SDK test engine does not evaluate it.

```

<!-- /omni-outbox-settled: s5-03-check-name-and-failure-lookup -->
