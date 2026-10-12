# Settled outbox items — PRD 1612

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-refused-reads-held -->

## s1-01-refused-reads-held — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-refused-reads-held
prd: 1612
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When the approval cannot be trusted for a reason other than a server outage, for example the approver has left the workspace, should the approval check on a pull request say held or failed?

## The decision, in plain words

It says held, like an outage: only a file that changed since approval turns the check red. The terminal still prints the exact reason.

## The intro, for fun

An approver walked out of the workspace and left their signature on the desk.

## The punchline, for fun

We put the signature in a drawer marked held, not in the bin.

## The options, in plain words

A. A. Held (neutral): only a drift fails, a server-side doubt never blocks a merge.
B. B. Failed: an approval whose approver left is not an approval, so the check is red until someone approves again.
C. C. Waiting (neutral), pointing at the PRD page to approve again.

## What I had to decide

Whether an approval whose approver left, or a reply the server refused, makes the check neutral (held) or failed.

## What I did meanwhile

The shared judge maps the refused state to held; the terminal command's lines and exit code are unchanged.

## What it costs to change later

One line in the verdict mapping and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names four states and lists only the server being unreachable as held; it does not say where a refused reading goes (author).

```

<!-- /omni-outbox-settled: s1-01-refused-reads-held -->

<!-- omni-outbox-settled: s2-01-judge-route-signature -->

## s2-01-judge-route-signature — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-judge-route-signature
prd: 1612
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

How does the server know that a request for a PRD's approval really comes from our GitHub App, when that request carries no body to sign?

## The decision, in plain words

The App signs the address it asks for, the page and the PRD named in it, with the same shared secret it already uses for stage updates. A signature for one PRD cannot read another, and there is no clock in it.

## The intro, for fun

A letter with no body still needs a seal on its envelope.

## The punchline, for fun

So the App signs the address and trusts the postman with the rest.

## The options, in plain words

A. A. Sign the path and query exactly as sent, with the stage-event secret, no timestamp (built).
B. B. Also sign a timestamp header and refuse requests older than a few minutes.
C. C. Give the judge route its own secret, apart from the stage-event one.

## What I had to decide

Whether the App signs only the address it asks for, or also a timestamp so an old request expires.

## What I did meanwhile

The judge route accepts any request whose signature matches the path and query exactly as sent, under the stage-event secret; the App's check (s3) must sign the same string.

## What it costs to change later

Adding a timestamp later is one header on each side and one check here, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A replayed request only re-reads the same approval record a member already sees on the PRD's page; whether that is acceptable was not asked.

```

<!-- /omni-outbox-settled: s2-01-judge-route-signature -->

<!-- omni-outbox-settled: s3-01-target-pr-judged-on-feature-pr -->

## s3-01-target-pr-judged-on-feature-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-target-pr-judged-on-feature-pr
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

A pull request in another repository that is part of a PRD holds none of the PRD's approved files. What should its approval check compare against?

## The decision, in plain words

It compares the approved files with the PRD's own open feature pull request in the PRD's repository. When that pull request is missing or cannot be read, the check is held, never failed.

## The intro, for fun

The target repository has the code, but the approved plan lives next door.

## The punchline, for fun

So the check knocks on the neighbour's door, and waits politely if nobody answers.

## The options, in plain words

A. A. Judge on the PRD's open feature PR head; held when it is missing or unreadable.
B. B. Judge on the PRD repository's default branch.
C. C. Post approved or waiting from the record alone, without comparing files, on a target PR.

## What I had to decide

Confirm the target PR's check is judged on the PRD's feature PR head, held when that PR cannot be found or read.

## What I did meanwhile

A target PR's check reads the PRD repository's open 'Closes #<n>' feature PR head through the same installation; its Details link carries that head's sha. No open feature PR, or a 403/404, posts the neutral held title.

## What it costs to change later

One function in apps/omni-app/src/approved-check/github.ts (featurePullOf) and the target branch of judgePull.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'compares each pinned file with the same file at the PR's head', which a target PR's head does not hold; this reading of it is the author's.

```

<!-- /omni-outbox-settled: s3-01-target-pr-judged-on-feature-pr -->

<!-- omni-outbox-settled: s3-02-drifted-title-wording -->

## s3-02-drifted-title-wording — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-drifted-title-wording
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The spec's table and its acceptance criteria word the red check's line two ways: the table ends it with 'or approve again', the criteria say it ends with the restore command. Which wording should the line carry?

## The decision, in plain words

The red check's line follows the spec's table word for word: it names the changed file, then says to run the restore command, or approve again.

## The intro, for fun

Two parts of the same spec described the same red line slightly differently.

## The punchline, for fun

The table won the coin toss, and the command is still right there in the line.

## The options, in plain words

A. A. The spec table's wording: '… · run omni approval restore <n>, or approve again'.
B. B. End with the command: '… · approve again, or run omni approval restore <n>'.

## What I had to decide

Keep the table's wording, or end the title with the restore command.

## What I did meanwhile

The failure title reads '≠ <file> · content · run omni approval restore <n>, or approve again'; the summary starts with the command.

## What it costs to change later

One constant in apps/omni-app/src/approved-check/verdict.ts and two test strings.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The two wordings in the spec were not reconciled by a person; the pick is the author's.

```

<!-- /omni-outbox-settled: s3-02-drifted-title-wording -->

<!-- omni-outbox-settled: s3-03-function-list-outside-territory -->

## s3-03-function-list-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-function-list-outside-territory
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Registering the new check changed how many background functions the App serves, and a test outside this slice's ground counts them. Was it fine to update that test?

## The decision, in plain words

Yes: the test that lists the App's functions, and the comment that names them, were updated to include the two new ones. Nothing else outside the slice's ground changed.

## The intro, for fun

Adding two helpers meant someone had to update the head count.

## The punchline, for fun

The roll call now has eight names instead of six.

## The options, in plain words

A. A. Update the function list test and the entry's comment.
B. B. Fold the rerun into the check as one function, and still update the test.

## What I had to decide

Confirm the two edits outside the territory.

## What I did meanwhile

apps/omni-app/src/outbox-check/inngest-route.test.ts lists approvedCheck and approvedRerun (function_count 12, 8 functions on a preview); apps/omni-app/entries/inngest.ts's header comment names them.

## What it costs to change later

Two lines in a test and two in a comment.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No gap beyond the territory itself.

```

<!-- /omni-outbox-settled: s3-03-function-list-outside-territory -->

<!-- omni-outbox-settled: s3-04-label-rerun-reach -->

## s3-04-label-rerun-reach — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-label-rerun-reach
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When a PRD is approved or its approval is voided, which pull requests should get their approval check run again, and how does the App recognise the approved label?

## The decision, in plain words

The App reacts only to the kit's default approved label name, and reruns the PRD's open feature pull request plus the target pull requests it can find in the same GitHub account.

## The intro, for fun

One label flips, and every pull request of the PRD should hear about it.

## The punchline, for fun

Everyone in the same account gets the memo; pen pals abroad wait for their next push.

## The options, in plain words

A. A. Default label name only; targets searched within the same account.
B. B. Forward every label change, and match the repository's own approved label in the rerun.
C. C. Search targets across every account the installation reaches.

## What I had to decide

Confirm the rerun's reach: the default label name only, and target PRs in the same account only.

## What I did meanwhile

The webhook reads no repository config, so a repository that renames labels.approved gets no label rerun (its PR events still run the check). Target PRs are found with GitHub search 'Part of <owner/repo>#<n>' is:pr is:open user:<owner>, filtered to bodies that start with that line.

## What it costs to change later

A filter in apps/omni-app/src/webhook/webhook.ts and the search query in apps/omni-app/src/approved-check/github.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Cross-account targets and renamed labels were not measured: no repository is known to use either today.

```

<!-- /omni-outbox-settled: s3-04-label-rerun-reach -->

<!-- omni-outbox-settled: s4-01-target-state-is-the-prds -->

## s4-01-target-state-is-the-prds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-target-state-is-the-prds
prd: 1612
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

On the approval proof page, what state should each linked pull request in another repository show?

## The decision, in plain words

Each open one shows the state the page reads for the whole PRD, since the approved plan lives in one place; a merged one shows merged.

## The intro, for fun

Three pull requests walk into a page and ask whether they are approved.

## The punchline, for fun

The page answers once for all of them, since they share one plan.

## The options, in plain words

A. A. Each open target shows the PRD's verdict read on this page; merged shows merged.
B. B. Each target shows its own check's state, read from the check run GitHub holds for it.
C. C. Show the target pull requests with their GitHub state only (open, draft, merged), no approval state.

## What I had to decide

A target PR's own head holds no plan files: they live in the PRD's home repository. The page judges the approval once, against the head it was opened with, and each open target PR shows that verdict; merged ones say merged, closed unmerged ones are left out. Target PRs are found among the product's other repositories, as the 50 most recent PRs whose body starts `Part of <home>#<n>`.
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Built in apps/galaxy/src/dossier/attestation/attestation.service.ts (targetRows) and attestation-github.ts (targets).

## What it costs to change later

A constant: reading each target's own omni/approved check run instead is one more GitHub read per target, in the same two files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The App's check on a target PR (s3) is not built yet: how it judges a target's head may differ from the page (author).
- A PRD whose target repository is not in its product's repositories shows no target (author).

```

<!-- /omni-outbox-settled: s4-01-target-state-is-the-prds -->

<!-- omni-outbox-settled: s4-02-github-call-sites-listed -->

## s4-02-github-call-sites-listed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-github-call-sites-listed
prd: 1612
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The new proof page reads the code host as the app does: may this slice add it to the list of places allowed to call the code host, a test outside its own folders?

## The decision, in plain words

Yes: the page's reader is added to that list as one more caller through the shared, budget-aware client, and nothing else in that test changed.

## The intro, for fun

The guest list for calling the code host had a new name scribbled at the bottom.

## The punchline, for fun

The bouncer checked: same door, same budget, same rules.

## The options, in plain words

A. A. List the attestation's reader as a new client call site.
B. B. Move the attestation's GitHub reads into the PRD page's existing reader, and list nothing new.

## What I had to decide

apps/galaxy/src/github-call-sites.test.ts lists every galaxy file that calls GitHub, and fails on a new one. The attestation's reader (apps/galaxy/src/dossier/attestation/attestation-github.ts) calls GitHub through @omni/github, so it is listed as `client`. The file is outside s4's territory.
Decided by: Jev (hardToRevert 0.64) · agent said false

## What I did meanwhile

One line added to the SITES map of apps/galaxy/src/github-call-sites.test.ts.

## What it costs to change later

One line to remove, or the reader moved into an already listed file (apps/galaxy/src/dossier/github/reader.ts).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory did not foresee the call-site guard (author).

```

<!-- /omni-outbox-settled: s4-02-github-call-sites-listed -->

<!-- omni-outbox-settled: s3-05-one-approved-gate-folded-into-1548 -->

## s3-05-one-approved-gate-folded-into-1548 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-05-one-approved-gate-folded-into-1548
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

PRD 1548 reached the main branch first with its own approved check, its own states and its own attestation page, on the same ground as this PRD. Which one stands, and how does this PRD fit in?

## The decision, in plain words

Folded in, as the people driving the loop decided for this run: PRD 1548's design is the base, with one approved check that now also judges a repository's PRD born on the server, at the pull request's head. There is one set of states, each named once: approved is building, waiting is pending, drifted stays drifted, an approver who left is refused, and an unreadable server is held.

## The options, in plain words

A. Keep it as built: one check and one set of states, PRD 1548's.
B. Keep it, but let a waiting pull request read neutral instead of failing.
C. Bring this PRD's attestation page back for repository PRDs, beside PRD 1548's.

## What I had to decide

Whether a pull request still waiting for approval should fail, as PRD 1548 says and this run kept, or only wait in neutral, as this PRD's spec first said.

## What I did meanwhile

A waiting PRD's check fails, and blocks a merge only where a repository made the check required.

## What it costs to change later

Turning waiting back to neutral is a one-line change in the check's mapping and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Restore, the check's name in the config, the rerun when the approved label changes and the guide are kept; PRD 1548's code was not rewritten, and its tests stand.
- The spec and the plan of this PRD were approved on the server and are pinned, so they were left as approved: their four-state table and their attestation page at its own address now read as history, and this item and the guide say what was built.
- The attestation page this PRD drew, with its head, its target pull requests and its copy button, is gone. A PRD born on the server of a repository shows its approval on the PRD page instead, and the check's summary names the head it read.

```

<!-- /omni-outbox-settled: s3-05-one-approved-gate-folded-into-1548 -->
