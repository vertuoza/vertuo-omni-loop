# Settled outbox items — PRD 2270

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-switch-owner-only -->

## s1-01-switch-owner-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-switch-owner-only
prd: 2270
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Who may turn Fix on a runner once answered on or off for a repository? The spec says whoever may change the other repository switches, but anyone in the team changes Public ideas while only the owner changes Phase 0 on the server.

## The decision, in plain words

Only the workspace's owner can change it, the same as Phase 0 on the server, because it decides whether work starts with nobody pressing a button.

## The intro, for fun

Two switches, two different gatekeepers, and a third switch asking which one to copy.

## The punchline, for fun

We copied the stricter one; loosening a lock is easier than explaining why it was loose.

## The options, in plain words

A. Only the workspace's owner changes it, like Phase 0 on the server (built).
B. Any member of the workspace changes it, like Public ideas.
C. Only the owner turns it on, but any member may turn it off.

## What I had to decide

Whether turning the automatic fix on or off is the owner's call alone, or anyone's in the team.

## What I did meanwhile

Only the owner can change the switch; everyone else sees it as it stands. It starts on for every repository.

## What it costs to change later

A follow-up database change rewrites who the switch's save function lets through; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which of the two existing switches the spec meant as the model (author)

```

<!-- /omni-outbox-settled: s1-01-switch-owner-only -->

<!-- omni-outbox-settled: s1-02-sync-does-not-decide -->

## s1-02-sync-does-not-decide — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-sync-does-not-decide
prd: 2270
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Should the background check that runs every 15 minutes also start the fix once the answers are in, or only a new comment or change on GitHub?

## The decision, in plain words

Only a new comment or change on GitHub starts the fix for now. The spec names the 15-minute check as a second chance, but that check lives in a part of the code this slice was not given.

## The intro, for fun

The spec promised a backup alarm clock; the clock sits in another room this slice may not enter.

## The punchline, for fun

Every answer is itself a comment, so the main alarm rings almost every time anyway.

## The options, in plain words

A. Only a new comment or change on GitHub starts the fix (built).
B. The 15-minute check starts it too, added as a follow-up in its own part of the code.

## What I had to decide

Whether the 15-minute check should also start the fix, as a follow-up in its own part of the code.

## What I did meanwhile

The fix starts after the comment that completes the answers. If that one read fails, the next comment on the pull request starts it.

## What it costs to change later

A small follow-up hands the same decision to the 15-minute check after it reads each PRD; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often the read after the last answer fails in practice (author)

```

<!-- /omni-outbox-settled: s1-02-sync-does-not-decide -->

<!-- omni-outbox-settled: s1-03-unlisted-repository-off -->

## s1-03-unlisted-repository-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-unlisted-repository-off
prd: 2270
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

A runner can work on a repository the team never added on its Repositories settings page, so that repository has no switch at all. Should the fix start by itself there?

## The decision, in plain words

No: a repository with no switch is treated as switched off, so nothing starts by itself where no person can see or turn the switch off.

## The intro, for fun

The switch is on by default, but some repositories never got a switch to begin with.

## The punchline, for fun

No switch, no surprise: the runner waits for the button instead.

## The options, in plain words

A. A repository missing from the settings page reads as switched off (built).
B. It reads as switched on, the default of a listed repository.

## What I had to decide

Whether a repository missing from the settings page behaves as switched on, like a new one, or as switched off.

## What I did meanwhile

On such a repository the job keeps waiting until someone sends the fix by hand, or the owner adds the repository to the settings page.

## What it costs to change later

Changing it is one line in the decision; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many repositories run jobs without being on the settings page (author)

```

<!-- /omni-outbox-settled: s1-03-unlisted-repository-off -->

<!-- omni-outbox-settled: s2-01-fix-with-answers-route -->

## s2-01-fix-with-answers-route — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fix-with-answers-route
prd: 2270
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The plan's Fix with answers button has no home in its slice: the route that sends a job and the rules that queue a fix both live in another slice's files. Where should the button's server side live?

## The decision, in plain words

The button calls a new route of its own, which reuses the automatic fix's rules with one small addition, so a person pressing it queues exactly the fix the page would have queued, in their own name, even with the repository's switch off.

## The intro, for fun

A button was drawn, but the wires behind it ran through someone else's walls.

## The punchline, for fun

So it got its own door, and borrowed the key.

## The options, in plain words

A. A. A new route in this slice's own folder, reusing the continuation's rules with a small addition in the runners service (as built).
B. B. Extend the send route and its contract with an optional continuation link, as the spec words it.
C. C. Show the button only and queue the fix without a link, so no shared file changes.

## What I had to decide

Whether the send route should take the link instead of a route of its own, and whether the page may show Answered with the button while the repository's switch is on.

## What I did meanwhile

The button posts to /api/runners/jobs/<id>/fix; the answers are read again from the PRD's stored snapshot on the server, never taken from the browser.

## What it costs to change later

Switching to the send route later means moving one function and one test, and dropping one route.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 lists only the page and the runners' API routes, while the spec says the send route takes the link: that route's contract and service belong to s1 (author).

```

<!-- /omni-outbox-settled: s2-01-fix-with-answers-route -->
