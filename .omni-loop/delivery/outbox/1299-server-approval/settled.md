# Settled outbox items — PRD 1299

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-phase0-flag-database-check -->

## s1-01-phase0-flag-database-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-phase0-flag-database-check
prd: 1299
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Should the rule that only the workspace owner can switch where phase 0 is approved also be proven by the automatic database check that runs on every pull request?

## The decision, in plain words

The rule lives in the database and is covered by tests of the page and the route, but no database check proves it yet, because this slice was only allowed to touch the migration, the types and the galaxy files.

## The intro, for fun

A lock on the door, and nobody has rattled the handle yet.

## The punchline, for fun

The tests trust the lock; the database check would try it.

## The options, in plain words

A. Ship the flag without a database check of its own; the migration mirrors the tracked switch, which is already checked.
B. Add the owner-only, default-pr and unknown-repository cases to the repositories database check in a follow-up slice.

## What I had to decide

Whether a follow-up adds the owner-only and default-pr cases for the new flag to the repositories database check.

## What I did meanwhile

The migration refuses anyone but the owner exactly as the tracked switch does; the galaxy tests cover the refusal as the page and the route read it, against a stubbed database.

## What it costs to change later

Adding the check later is one small change to the database checks file, with no migration and no data change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No run of the migration against a local database in this slice: the supabase workflow applies it in CI (author)

```

<!-- /omni-outbox-settled: s1-01-phase0-flag-database-check -->

<!-- omni-outbox-settled: s4-01-phase0-in-the-spec-schema -->

## s4-01-phase0-in-the-spec-schema — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-phase0-in-the-spec-schema
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

A spec may now say it was born on the server, but the rule that lists what a spec may say lives in a file this slice was not given. Should it change that file?

## The decision, in plain words

Yes: the shared list of what a spec may say now accepts the one new value, server, and still refuses every other value by name.

## The intro, for fun

The plan handed us the keys to the wrong door, right next to the right one.

## The punchline, for fun

We used the right one and left a note on the fridge.

## The options, in plain words

A. A. Add an optional phase0 (server only) to the spec schema, as built
B. B. Strip phase0 inside the inbox guard alone and keep the schema as it was, so every other reader of the inbox would refuse a server-born spec
C. C. Leave phase0 refused and amend the plan first

## What I had to decide

Whether the slice may add the optional phase0 field to the shared spec schema, outside the territory the plan named.

## What I did meanwhile

The schema accepts phase0: server and refuses any other value; the inbox guard and every reader of the inbox read it as before.

## What it costs to change later

Undoing it is removing one optional field from the schema; nothing stored depends on it until a server-born PRD exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan named kit/lib/front-matter.ts, which only splits key: value lines; the strict schema that refuses unknown fields is kit/lib/schema/front-matter.ts. I read the plan's entry as a slip for that file.

```

<!-- /omni-outbox-settled: s4-01-phase0-in-the-spec-schema -->

<!-- omni-outbox-settled: s4-02-approval-route-shape -->

## s4-02-approval-route-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-approval-route-shape
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The page and the terminal must agree on how an approval is described before the page side is built. What does the page answer?

## The decision, in plain words

The page answers the PRD page's link and the approval in force, or none yet: who approved, whether they are still in the workspace, when, and each approved file with its kind, its place, its fingerprint and, when it can, its approved text. A PRD with no page is refused.

## The intro, for fun

Two teams are building a bridge from both banks at once.

## The punchline, for fun

This item is the drawing they both tape to the wall.

## The options, in plain words

A. A. This shape, the approved text optional, as built
B. B. The route sends a whitespace-free fingerprint beside each one instead of the text
C. C. Drop the whitespace-only wording and always say content

## What I had to decide

The reply shape of GET /api/dossiers/approval that slice s2 must honour, and how the kit pairs and words a drift.

## What I did meanwhile

The kit reads { url, approval: null | { approver: { login, member }, approvedAt, files: [{ kind, path, sha256, versionId, content? }] } }; a 404 (no dossier) reads as refused (404); any other shape as refused (malformed reply). Kinds the PRD folder keeps (spec, plan, before-after, voice) are paired by kind; any other kind (a scenario) is read at its pinned path. Whitespace only is told only when the route sends the approved text; without it a change says content. Either way it refuses.

## What it costs to change later

Each field is one line on both sides while neither has shipped; after s2 merges, a rename is a coordinated change to the route and the kit's schema.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the route answers the approver's login, membership, time and pinned files, but not the field names, the dossier link, nor how the kit can tell whitespace from content with only a hash. The optional approved text is my answer to the last.

```

<!-- /omni-outbox-settled: s4-02-approval-route-shape -->

<!-- omni-outbox-settled: s4-03-signed-out-is-held -->

## s4-03-signed-out-is-held — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-signed-out-is-held
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

When this computer is not signed in to the Omni page, or no page is set up, what should the check of a server-approved PRD say?

## The decision, in plain words

It holds the PRD as if the server could not be reached, with the same line, and adds one line saying why: no page set, or sign in first. It asks nothing of the server.

## The intro, for fun

Knocking on a door you have no key for looks a lot like knocking on a door nobody answers.

## The punchline, for fun

Either way you wait on the porch, but now a note says why.

## The options, in plain words

A. A. Held as unreachable, saying why, as built
B. B. Refused, as refused (no sign-in)
C. C. A sixth state, signed out

## What I had to decide

Which of the five states a missing sign-in or a missing Omni page reads as.

## What I did meanwhile

omni approval prints server unreachable · held, not failed, exits 1, and writes the reason on stderr; prdState gives the PRD the unreachable stage.

## What it costs to change later

Changing it is one branch in the approval reader and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's table names unreachable as no answer within 5 seconds and one token refresh, and refused as a non-member approver or an error from the page; a terminal never signed in is neither.

```

<!-- /omni-outbox-settled: s4-03-signed-out-is-held -->

<!-- omni-outbox-settled: s2-01-birthplace-from-the-spec -->

## s2-01-birthplace-from-the-spec — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-birthplace-from-the-spec
prd: 1299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

How does the page learn that a PRD was born on the server, so that only those PRDs can be approved there?

## The decision, in plain words

The page reads it from the first spec it receives: when that spec says it was born on the server, the PRD is marked so for good; any other first spec marks it as born in the repository. Nothing new has to be sent.

## The intro, for fun

Every PRD gets a birth certificate, and nobody had said who signs it.

## The punchline, for fun

The first spec signs it, and the ink never dries off.

## The options, in plain words

A. The database reads it from the first spec pushed, as built.
B. The kit's push sends the birthplace as its own field, and the brainstorm passes it.
C. The page sets it when the repository's phase 0 is on the server at the dossier's opening.

## What I had to decide

Whether the dossier's birthplace is read from the first pushed spec's front matter by the database, or sent as its own field of the push by the kit.

## What I did meanwhile

A trigger on new versions sets dossiers.birthplace from the first spec of a PRD dossier (server when its front matter says phase0: server, repo otherwise) and refuses any later change. Every existing PRD dossier with a spec is marked repo. The kit sends nothing new.

## What it costs to change later

Switching to a push field later is one optional field on the push and one line in the push function; the column and the set-once rule stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec writes the birthplace twice, in the front matter and on the dossier, but does not say which call carries it to the dossier. Reading it from the spec keeps the kit's push and the brainstorm skill (another slice) unchanged.

```

<!-- /omni-outbox-settled: s2-01-birthplace-from-the-spec -->

<!-- omni-outbox-settled: s2-02-scenarios-not-pinned -->

## s2-02-scenarios-not-pinned — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-scenarios-not-pinned
prd: 1299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

An approval should pin the scenarios too, but the page never receives a PRD's scenarios. What does an approval pin?

## The decision, in plain words

An approval pins the spec, the plan, the before and after page and the voice, the latest of each the page holds. Scenarios are not pinned until the page keeps them.

## The intro, for fun

The guest list says five guests, and only four ever reached the door.

## The punchline, for fun

We seated the four and kept the fifth chair ready.

## The options, in plain words

A. Pin the four kinds the page holds, as built.
B. Add a scenario kind to the push and the page first, then pin it.

## What I had to decide

Whether an approval waits for the page to keep scenarios, or pins the four kinds the page holds today.

## What I did meanwhile

dossier_approve pins the latest spec, plan, before-after and voice versions; the pinned files list is open, so a scenario kind can join it once the push carries one, and the kit already reads any other kind at its pinned path.

## What it costs to change later

Pinning scenarios later is adding their kind to the push, to the versions the page keeps and to the list the approval pins; approvals already written stay valid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the approval pins scenarios, but the dossier has no scenario kind and acceptance is off in this repository, so nothing sends one.

```

<!-- /omni-outbox-settled: s2-02-scenarios-not-pinned -->

<!-- omni-outbox-settled: s2-03-approval-database-check -->

## s2-03-approval-database-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-approval-database-check
prd: 1299
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The rules about who may approve and that an approval is never changed live in the database. Should the automatic database check prove them, even though that check sits outside this slice's files?

## The decision, in plain words

Yes: a new database check proves who may approve, what is refused and that approvals are only ever added, and the database workflow runs it on every pull request.

## The intro, for fun

A lock was fitted, and the plan forgot to order someone to rattle the handle.

## The punchline, for fun

We rattled it ourselves, and left a note on who did.

## The options, in plain words

A. Add the check and its workflow step in this slice, as built.
B. Leave them out and add them in a follow-up slice.

## What I had to decide

Whether this slice adds its own database check and its workflow step, outside the files the plan gave it.

## What I did meanwhile

supabase/checks/approvals.sql proves the birthplace, each refusal, the pinned files, the second approval and that nobody updates or deletes a row; one step of the supabase workflow runs it. Both are new lines that touch no other check.

## What it costs to change later

Removing them is deleting one file and one workflow step; nothing depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names the migration but neither supabase/checks/ nor the workflow, while its done-when asks that rows cannot be updated or deleted, which only a database check can show.

```

<!-- /omni-outbox-settled: s2-03-approval-database-check -->

<!-- omni-outbox-settled: s5-01-gates-read-the-checkout -->

## s5-01-gates-read-the-checkout — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-gates-read-the-checkout
prd: 1299
slice: s5
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

A PRD approved on the page keeps its files on its own feature branch until it ships. When someone looks at the overview or the loop's next step from a copy of the project that does not hold those files, should the PRD still show up?

## The decision, in plain words

The overview, the PRD lookup and the loop's next step judge a page-approved PRD from the files the person's own copy holds. A copy without them, the main line for example, does not show that PRD until it ships.

## The intro, for fun

A PRD that lives on its own branch is a bit like a cat: you only see it in the room it chose.

## The punchline, for fun

So the overview counts it where its files are, and nowhere else, until it ships.

## The options, in plain words

A. A. Judge a page-approved PRD from the copy's own files; a copy without them does not show it (built).
B. B. Read its files from its feature branch on the remote, so every copy shows it, at the cost of reading files from git in the approval reader.
C. C. Show it from any copy as waiting, without judging its files, until the copy holds them.

## What I had to decide

Whether the overview and the loop's next step must find a page-approved PRD on its feature branch from any copy, or only where the copy holds its folder, as built. The approval reader judges the files on disk, so reading them from a branch would change that reader too.

## What I did meanwhile

`omni prd`, `omni status` and `omni next` read a ◆ PRD's stage through `prdState()` from the checkout's own inbox folder. `omni status` adds the ◆ PRDs of the checkout's inbox to its overview (waiting for approval is PRD, approved is inbox, drifted, unreachable and refused are listed as held with their lines). `omni next <n>` on a checkout with no folder for n refuses as before. A ◇ PRD reads exactly as before and never calls the server.

## What it costs to change later

A constant change: reading the PRD folder from `<remote>/<feature branch>` instead of the working tree means `kit/lib/approval/approval.ts` hashing files from a git ref, plus the status facts listing each feature branch's inbox folders. No stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether /omni:drive runs `omni next` from a checkout of the feature branch or of the default branch for a ◆ PRD: if the latter, a ◆ PRD is invisible to the loop until s7's skills check out its branch.
- (author) `omni prd <n>` still exits 0 on every stage and prints `state: prd`, `drifted`, `unreachable` or `refused`; the skills (s7) read that line, as they read `state: inbox` today.

```

<!-- /omni-outbox-settled: s5-01-gates-read-the-checkout -->

<!-- omni-outbox-settled: s3-01-page-drift-by-version -->

## s3-01-page-drift-by-version — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-page-drift-by-version
prd: 1299
slice: s3
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The PRD page says an approved PRD has drifted when a newer version of one of the approved files was pushed. Should a file that was not part of the approval, pushed later, also count as drift?

## The decision, in plain words

Only the files the approval covered count. A newer version of any of them shows drifted and brings the Approve button back; a file pushed for the first time after the approval leaves the page saying approved.

## The intro, for fun

An approval is a photo of the files on the day it was taken.

## The punchline, for fun

Someone walking into the frame afterwards does not spoil the photo.

## The options, in plain words

A. Only the approved files count toward drift (built).
B. Any file of a kind the approval would pin today, pushed after the approval, also shows drifted.

## What I had to decide

Whether a file first pushed after the approval should also make the page say drifted.

## What I did meanwhile

The page compares each approved file with the newest version of the same kind and ignores kinds the approval did not cover.

## What it costs to change later

Changing it is one condition in the page's approval view and one test; nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say whether drift covers a kind the approval did not pin, such as a voice file pushed for the first time after it (author).

```

<!-- /omni-outbox-settled: s3-01-page-drift-by-version -->

<!-- omni-outbox-settled: s6-01-inbox-at-first-approval -->

## s6-01-inbox-at-first-approval — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-inbox-at-first-approval
prd: 1299
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When a PRD approved on its page is approved again after a change, which approval dates its arrival in the inbox?

## The decision, in plain words

The first approval dates it. A later approval does not move the date, the same way the first phase-0 merge dates a PRD born in the repository.

## The intro, for fun

A PRD can be approved twice, but it only walks into the inbox once.

## The punchline, for fun

So the first approval holds the door, and the second one just waves.

## The options, in plain words

A. A. The first approval dates the inbox, and a later one never moves it.
B. B. The approval in force (the latest) dates the inbox, moving it at each new approval.

## What I had to decide

Which approval dates a PRD's inbox stage when it was approved more than once.

## What I did meanwhile

The stage sync dates a server-born PRD's inbox at its earliest approval row.

## What it costs to change later

A constant: picking the latest row instead is a one-line change in the sync's read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says 'dated at its approval' without saying which one when there are several (author).

```

<!-- /omni-outbox-settled: s6-01-inbox-at-first-approval -->

<!-- omni-outbox-settled: s6-02-stage-forward-reads-approved-label -->

## s6-02-stage-forward-reads-approved-label — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-stage-forward-reads-approved-label
prd: 1299
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

How does the GitHub App learn, the moment it happens, that a PRD was approved on its page?

## The decision, in plain words

It reads the approved label being added to the PRD's issue, and dates the inbox at that moment, a second or so after the approval itself. When the label is missed, the 15-minute sync dates it at the approval's exact time.

## The intro, for fun

The approval happens on the page, but the App only hears what GitHub tells it.

## The punchline, for fun

Luckily the page leaves a label behind, like a note on the fridge.

## The options, in plain words

A. A. The App reads the approved label being added and forwards the inbox stage, as built.
B. B. The approval route on the page records the inbox stage itself, and the App reads no label.

## What I had to decide

Whether the App's live stage update for an approval rides on the approved label, or the page records the stage itself.

## What I did meanwhile

The App turns the approved label added to an issue into the PRD's inbox stage, dated at the issue's update time, with the PRD number standing in for its folder name.

## What it costs to change later

A constant: the page could record the stage directly instead, and the label reading would simply be removed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The label event carries no approval time, so the live date is the label's, a moment late, and the stage store keeps the first date it is given (author).
- A repository that renames its approved label gets the live update from the sync alone, as with renamed branch shapes (author).

```

<!-- /omni-outbox-settled: s6-02-stage-forward-reads-approved-label -->
