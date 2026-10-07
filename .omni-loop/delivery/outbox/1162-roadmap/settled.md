# Settled outbox items — PRD 1162

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-roadmap-push-shape -->

## s2-01-roadmap-push-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-roadmap-push-shape
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The spec lists what a stored roadmap holds, but not its open questions, how a waiting PRD names what it waits on, or what a PRD whose work was closed without merging looks like. What should the app keep?

## The decision, in plain words

The app keeps each roadmap's open questions with any answer given, so the page can show them and the answer box; a waiting PRD keeps one line naming what it waits on plus its link; and a PRD can be marked closed, beside waiting, building, outbox, ready for a merge and merged.

## The intro, for fun

A roadmap walks into a database and asks for a table for its questions.

## The punchline, for fun

The database said yes, and kept a seat for the answers too.

## The options, in plain words

A. A. Store the questions with their answers on the roadmap, waits-on as a line and a link, and six states including closed (built).
B. B. Store no questions; the page reads them from the stored roadmap document and the answers from the roadmap's issue.
C. C. Keep the spec's five states and show a PRD closed unmerged as waiting, its line saying why.

## What I had to decide

Whether the stored roadmap carries its questions and answers, and whether `closed` is a state of its own.

## What I did meanwhile

The page (s5) and `omni roadmap push` (s6) build against this shape: `questions` on the roadmap, `waitsOn` and `waitsOnUrl` on each PRD, and six states.

## What it costs to change later

Changing it later is one migration on two tables nothing else reads, and the matching edits in the API's schema, s5's page and s6's push.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the page needs the phase's done-when line beside the milestone: the front matter has no field for it, so nothing stores it. (author)

```

<!-- /omni-outbox-settled: s2-01-roadmap-push-shape -->

<!-- omni-outbox-settled: s2-02-roadmap-any-member-pushes -->

## s2-02-roadmap-any-member-pushes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-roadmap-any-member-pushes
prd: 1162
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

A loop on the Omni page belongs to the person who runs it, and only they can update it. Should a roadmap work the same way, or belong to the whole workspace?

## The decision, in plain words

A roadmap belongs to its workspace: any member can update it, and the last person who did is recorded. Two people driving the same roadmap both keep its page current.

## The intro, for fun

Whose roadmap is it anyway? Everyone's, as it turns out.

## The punchline, for fun

The page just remembers who touched it last.

## The options, in plain words

A. A. Any member of the workspace updates it; the last pusher is recorded (built).
B. B. Only the person who first sent it updates it; anyone else is refused, as a loop is.

## What I had to decide

Whether any member of the workspace may update a roadmap, or only the person who first sent it.

## What I did meanwhile

Any member's `omni roadmap push` replaces the roadmap's document and PRD rows; the row keeps `pushed_by`.

## What it costs to change later

Restricting it later is one change to the database function, and a refusal the push command learns to print.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only roadmap_push() writes and members read; it does not say who among the members may push. (author)

```

<!-- /omni-outbox-settled: s2-02-roadmap-any-member-pushes -->

<!-- omni-outbox-settled: s3-01-consumes-is-direct-only -->

## s3-01-consumes-is-direct-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-consumes-is-direct-only
prd: 1162
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When one repository installs a second, and the second installs a third, should the plan check also refuse the first waiting on a change in the third?

## The decision, in plain words

The check only looks at the repositories a repository says it installs directly. A chain through a middle repository is not followed.

## The intro, for fun

Who installs whom, and does the grandparent count too?

## The punchline, for fun

For now the family tree stops at the parents.

## The options, in plain words

A. A. Direct only: a target is refused only for blockers in the targets its own consumes list names.
B. B. Follow the chain: a target also consumes what its consumed targets consume, and the check refuses those blockers too.

## What I had to decide

Whether the consumes rule follows chains of consumers or reads only the direct list.

## What I did meanwhile

Only direct consumes are refused; a person can list the third repository in the first one's consumes to get the refusal today.

## What it costs to change later

One small change in the plan check to walk the chain, and its tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a slice in a consumer blocked by a slice in a target it consumes; it does not say whether consumes is transitive (author)

```

<!-- /omni-outbox-settled: s3-01-consumes-is-direct-only -->

<!-- omni-outbox-settled: s4-01-consumer-rule-follows-blockers -->

## s4-01-consumer-rule-follows-blockers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-consumer-rule-follows-blockers
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When a roadmap has a project in a repository that installs another repository's package, which earlier projects must it come after?

## The decision, in plain words

It must come after every project it waits on, directly or through others, that changes the repository it installs from. Projects that do not wait on each other may still run side by side in the same wave.

## The intro, for fun

Two repositories, one package, and a question of who goes first.

## The punchline, for fun

Only the ones holding hands have to queue.

## The options, in plain words

A. A. Only the provider projects it waits on, directly or through others (built).
B. B. Every provider project of an earlier or the same wave, whether it waits on it or not.
C. C. Only the provider projects it waits on directly.

## What I had to decide

Whether the rule binds only the projects a consumer waits on (built), or every provider project against every consumer project of the roadmap, which would force all provider work before any consumer work.

## What I did meanwhile

The check refuses a consumer project whose wave is not after a provider project it waits on; unrelated projects in the two repositories run in parallel.

## What it costs to change later

Switching to the global reading is one extra loop in the roadmap grade and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's sentence reads either way; the narrower reading was taken because the wider one would refuse the spec's own example roadmap once crew consumes ai-domain (author).

```

<!-- /omni-outbox-settled: s4-01-consumer-rule-follows-blockers -->

<!-- omni-outbox-settled: s4-02-shipped-prd-still-counts -->

## s4-02-shipped-prd-still-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-shipped-prd-still-counts
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Once a project of a roadmap has shipped, does the roadmap check still accept its row?

## The decision, in plain words

Yes: a row passes when its project's folder is in the inbox or already shipped, and its spec is compared wherever it lives. Otherwise every roadmap would fail its check as soon as its first project merged.

## The intro, for fun

A roadmap that fails the moment it succeeds would be a strange reward.

## The punchline, for fun

Shipped projects keep their seat at the table.

## The options, in plain words

A. A. Inbox or shipped folder (built).
B. B. Inbox folder only, so a roadmap must be edited each time one of its projects ships.

## What I had to decide

Whether a roadmap row needs its project in the inbox only, as the spec words it, or in the inbox or the shipped folder (built).

## What I did meanwhile

The check reads each row's project from the inbox or the shipped folder; only a project with neither is refused.

## What it costs to change later

Narrowing it to the inbox is one condition in the roadmap reader and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says inbox folder; whether it meant to refuse shipped projects was not settled (author).

```

<!-- /omni-outbox-settled: s4-02-shipped-prd-still-counts -->

<!-- omni-outbox-settled: s4-03-repos-column-and-source -->

## s4-03-repos-column-and-source — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-repos-column-and-source
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

How strict is the roadmap file about which repositories each project names, and about saying where the roadmap came from?

## The decision, in plain words

In a plan repository every project must name at least one repository; outside one, a repositories column is refused. Saying where the roadmap was read from is optional, like the product and the target date.

## The intro, for fun

Every roadmap starts somewhere, but not every start has a link.

## The punchline, for fun

Pasted text gets to stay anonymous.

## The options, in plain words

A. A. Repositories required on every row of a plan repository; source optional (built).
B. B. Source required too, written as pasted for pasted text.
C. C. Repositories optional per row, a row without them read as the plan repository's own.

## What I had to decide

Whether the source line is required, and whether a plan repository's roadmap may leave a project's repositories empty.

## What I did meanwhile

A plan repository's roadmap needs its repositories column and a repository on every row; the source line may be left out.

## What it costs to change later

Making the source required, or relaxing the repositories rule, is one schema field or one condition and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists source beside the optional fields without saying it is optional; a roadmap from pasted text has no link to give (author).

```

<!-- /omni-outbox-settled: s4-03-repos-column-and-source -->

<!-- omni-outbox-settled: s5-01-answer-box-copies-the-command -->

## s5-01-answer-box-copies-the-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-answer-box-copies-the-command
prd: 1162
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The roadmap page's answer box should leave a person's answer on the roadmap's issue. Should the page post that comment itself, or hand the person the one line that posts it?

## The decision, in plain words

The box turns the answer into the one line that records it, with a copy button and a link to the roadmap's issue. The page does not post anything to GitHub yet.

## The intro, for fun

A text box that wants to talk to GitHub, but has nobody to pass the note to yet.

## The punchline, for fun

So it writes the note neatly and hands it to you to deliver.

## The options, in plain words

A. A. The box writes out the answer command to copy, and links the issue; posting from the page comes later
B. B. The page posts the comment itself now, through a new API route and the App's authorisation as the person
C. C. The box only links to the roadmap's issue, and the person writes the comment by hand

## What I had to decide

The spec says the page's answer box writes the same comment as `omni roadmap answer`. Posting from the page needs a write path to GitHub as the person (the GitHub App's authorisation, as the Outbox tab's Send does, through an API route) that is outside s5's territory, and the comment's marker is s6's (`kit/lib/roadmap/answers`), not built yet in wave 2.

## What I did meanwhile

`AnswerBox.tsx` shows a textarea for each unanswered `person` question; as the person types, it shows `omni roadmap answer <n> <Q> "<answer>"` with a Copy button, beside a link to the roadmap's issue. Nothing is written by the page.

## What it costs to change later

Small: a later slice swaps the box's copy step for a Send button posting through a new `/api/roadmaps/answer` route that reuses s6's marker; the box, its place on the page and the question model stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any workspace member may answer a person question from the page, or only some (author)
- Which GitHub account the page would post as: the person's, through the App's authorisation, is assumed (author)

```

<!-- /omni-outbox-settled: s5-01-answer-box-copies-the-command -->

<!-- omni-outbox-settled: s5-02-switch-test-lists-roadmaps -->

## s5-02-switch-test-lists-roadmaps — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-switch-test-lists-roadmaps
prd: 1162
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Adding the Roadmaps entry broke a check that lists every menu entry, in a file outside this slice's list. Fix it here, or leave it failing?

## The decision, in plain words

The check now lists the Roadmaps entry too. It is a one-line change to a test, made in this slice so everything stays green.

## The intro, for fun

One new menu entry, and a test somewhere was keeping count.

## The punchline, for fun

It now counts one more.

## The options, in plain words

A. A. Update the test's list in this slice
B. B. Leave it failing for a later slice to fix

## What I had to decide

`apps/galaxy/src/switch/switch.test.ts` pins the sidebar's in-app paths and checks each page exists. The plan gave s5 `headers.test.ts` but not this file; the Roadmaps entry makes it fail until `/roadmaps` is in its list.

## What I did meanwhile

Added `/roadmaps` between `/app/engineering` and `/prd` in that test's expected list; `app/roadmaps/page.tsx` exists, so its page check passes.

## What it costs to change later

None: a test's expected list. Reverting the entry reverts the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant to leave this file to another slice: no other slice of PRD 1162 touches the sidebar (author)

```

<!-- /omni-outbox-settled: s5-02-switch-test-lists-roadmaps -->
