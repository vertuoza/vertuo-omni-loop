# Settled outbox items — PRD 144

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-session-repo-sent-from-mode -->

## s1-01-session-repo-sent-from-mode — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-session-repo-sent-from-mode
prd: 144
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Switching ask mode on must now tell the server which repository the session is for, but the file that opens the session was not in this slice's list of files. Should the slice change it?

## The decision, in plain words

Yes: the step that switches ask mode on now sends the repository name along with the session title, a one-line change. Nothing else in that file changed.

## The intro, for fun

The repository name needed a lift to the server, and the car was parked one street over.

## The punchline, for fun

We borrowed it for one line and put the keys back.

## The options, in plain words

A. Change the one line so switching ask mode on sends the repository name with the session
B. Leave that step alone, and have the server take the repository name from the session's first question instead

## What I had to decide

Keep the one-line change outside the listed files, or move the sending of the repository elsewhere.

## What I did meanwhile

Sessions opened from now on carry their repository; the next slice uses it to pick the session's workspace.

## What it costs to change later

Undoing it is removing one argument; the server treats the field as optional.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 names the client and the hook but not kit/lib/ask/mode.mjs, where `omni ask on` opens the session (author)

```

<!-- /omni-outbox-settled: s1-01-session-repo-sent-from-mode -->

<!-- omni-outbox-settled: s1-02-branch-kept-on-the-session -->

## s1-02-branch-kept-on-the-session — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-branch-kept-on-the-session
prd: 144
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The design keeps the branch and the Claude session on the whole ask session, but they arrive with each question and can change while ask mode stays on. Which one should the session keep?

## The decision, in plain words

The session keeps the latest one a question named. A question that names none leaves it as it was, so every question of the session shows the latest branch.

## The intro, for fun

A session can hop branches mid-conversation, like a squirrel that forgot where it buried lunch.

## The punchline, for fun

We write down the tree it is sitting in right now.

## The options, in plain words

A. Keep the latest branch and Claude session on the session, updated by each question that names them
B. Also record the branch and the Claude session on each question, so an older question keeps its own

## What I had to decide

Keep the latest branch on the session, or record the branch on each question as well.

## What I did meanwhile

The context line of each question shows the session's latest branch and Claude session.

## What it costs to change later

Moving them onto each question later is two optional columns and a small change to the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's data section puts branch and claude_session_id on ask_sessions, while the session open sends only the repo (author)

```

<!-- /omni-outbox-settled: s1-02-branch-kept-on-the-session -->

<!-- omni-outbox-settled: s1-03-price-table-values -->

## s1-03-price-table-values — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-price-table-values
prd: 144
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The cost shown on each question comes from a price list the app keeps. Which prices, and what about a model the list does not know?

## The decision, in plain words

The list holds the public list prices per million tokens for current and recent Claude models, with cache reads at a tenth of the input price and cache writes at one and a quarter times it unless a model's own price says otherwise. A model not on the list shows no cost.

## The intro, for fun

Every question now wears a little price tag, like a sweater in a very thoughtful shop.

## The punchline, for fun

Tags for sweaters we have never seen stay blank.

## The options, in plain words

A. Public list prices per model, no cost for an unknown model
B. The same list, with an unknown model priced like the closest known family

## What I had to decide

Confirm the prices, and whether a model missing from the list should show no cost or a guess.

## What I did meanwhile

Costs are estimates for the models on the list, and blank for any other.

## What it costs to change later

Changing a price is editing one line of the list; nothing stored needs a migration, but costs already recorded keep the old price.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No billing source was checked for negotiated or partner prices; the list is first-party list prices (author)

```

<!-- /omni-outbox-settled: s1-03-price-table-values -->

<!-- omni-outbox-settled: s2-02-session-of-owner-in-no-workspace -->

## s2-02-session-of-owner-in-no-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-session-of-owner-in-no-workspace
prd: 144
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Every session now belongs to a team space that only its members read. What happens to a session opened earlier by someone who belongs to no space at all?

## The decision, in plain words

It is kept, with no space, and nobody can read it, its owner included, until a person moves it by hand. Nothing is deleted.

## The intro, for fun

Some old questions arrived at the party after everyone had left.

## The punchline, for fun

We kept their coats; nobody can see them from the door.

## The options, in plain words

A. Keep them, hidden from everyone, until a person moves them
B. Delete them as the change runs
C. Let their owner keep reading them, and nobody else

## What I had to decide

Keep such sessions hidden, delete them, or let their owner still read them.

## What I did meanwhile

Such sessions stay stored and hidden from everyone.

## What it costs to change later

Letting the owner read them later is one line added to a reading rule; deleting them later is one statement.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one has checked whether any stored session belongs to an owner in no workspace; the change runs the same either way (author)

```

<!-- /omni-outbox-settled: s2-02-session-of-owner-in-no-workspace -->
