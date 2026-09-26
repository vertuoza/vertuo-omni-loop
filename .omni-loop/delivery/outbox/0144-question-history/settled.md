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

<!-- omni-outbox-settled: s3-01-classifier-model -->

## s3-01-classifier-model — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-classifier-model
prd: 144
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

Which model should sort each question into one of the six categories, and how long may it take before the question is left unsorted?

## The decision, in plain words

A small, cheap Claude model does the sorting, and gets fifteen seconds; a slower answer leaves the question unsorted, and people can sort it by hand.

## The intro, for fun

Somebody has to put every question in the right drawer, and it does not need to be the smartest in the room.

## The punchline, for fun

A quick glance and a label: fifteen seconds, then the drawer stays shut.

## The options, in plain words

A. A small Claude model with a 15-second limit, fixed in the code
B. The same, with the model named by an environment setting so it changes without a deploy
C. A larger model, for better sorting at a higher price per question

## What I had to decide

Which OpenRouter model the classifier calls, and its time limit.

## What I did meanwhile

The classifier calls anthropic/claude-haiku-4.5 through OpenRouter, at temperature 0, with a 15-second limit; both are constants in the galaxy's classifier.

## What it costs to change later

Changing either is one constant; no data moves, and rounds sorted so far keep their category.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names OpenRouter but no model, and no time limit (author)
- Whether that model id is enabled on the OpenRouter account behind OPENROUTER_API_KEY; a model it refuses leaves every round unsorted, silently (author)

```

<!-- /omni-outbox-settled: s3-01-classifier-model -->

<!-- omni-outbox-settled: s3-02-model-guess-never-overrides -->

## s3-02-model-guess-never-overrides — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-model-guess-never-overrides
prd: 144
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the model's guess arrives after a person has already sorted the question, which one wins, and whose account records the guess?

## The decision, in plain words

A person always wins: the model's guess is kept only while nobody has sorted the question. The guess is recorded in the name of the person who asked, since the app holds no key of its own.

## The intro, for fun

The robot and a human both reach for the same label maker.

## The punchline, for fun

The human keeps it, and the robot does not even get a turn.

## The options, in plain words

A. The guess is kept only while nobody sorted the question, recorded as the asker
B. The guess always replaces whatever is there, as the last word
C. The app records the guess with a key of its own, so nobody else can write it

## What I had to decide

How the model's category is written without a database key of the app's own, and whether it may replace a person's choice.

## What I did meanwhile

Nobody can write the category columns directly. One database function lets any member set or clear a category; a second records the model's guess, callable only by the session's owner, and only while nobody has set one. The galaxy calls it with the asker's own sign-in, after the response.

## What it costs to change later

Replacing the second function, or granting the app a key of its own, is one small migration; stored categories stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The session's owner could call the second function directly and label a round as sorted by the model; the category is still one of the six, and any member can change it (author)
- The spec says nothing about a guess arriving after a person sorted the round (author)

```

<!-- /omni-outbox-settled: s3-02-model-guess-never-overrides -->

<!-- omni-outbox-settled: s3-03-chip-names-who-by-role -->

## s3-03-chip-names-who-by-role — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-chip-names-who-by-role
prd: 144
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The chip on each question says who set its category: should it give that person's name, or only say whether it was the model, you, the owner or a teammate?

## The decision, in plain words

It says it by role: sorted by the model, set by you, set by the session owner, or set by a teammate. Clearing a category shows the question as unsorted, cleared by that person.

## The intro, for fun

A sticky note on every question, signed by somebody.

## The punchline, for fun

For now the signature reads teammate, which narrows it down to everyone.

## The options, in plain words

A. By role: the model, you, the session owner, or a teammate
B. By the person's player name, falling back to a teammate when they have none

## What I had to decide

How the chip names who set a question's category, when the page only knows an account's id.

## What I did meanwhile

The page compares the id with the viewer and the session's owner and prints a role; no name is looked up.

## What it costs to change later

Showing names later is a read of the workspace's players on the page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the chip shows who set it, without saying whether by name (author)
- A member who never joined the game has no player name to show, so names would need a fallback anyway (author)

```

<!-- /omni-outbox-settled: s3-03-chip-names-who-by-role -->

<!-- omni-outbox-settled: s4-01-teammates-named-by-email -->

## s4-01-teammates-named-by-email — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-teammates-named-by-email
prd: 144
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

To share a question, the owner picks a teammate from a list; should that list, and the note saying who answered first, show each teammate's email address to everyone in the workspace?

## The decision, in plain words

Yes: every member of a workspace sees the others by their arcade name when they picked one, and otherwise by their email address. Nobody outside the workspace sees the list.

## The intro, for fun

Picking a teammate from a list works best when the list has names on it.

## The punchline, for fun

Some people only ever gave us their email, so that is the name they get.

## The options, in plain words

A. Arcade name when there is one, otherwise the email address, shown to members of the same workspace only
B. Arcade name only, and members without one are not offered for sharing
C. Email address always, for everyone the same way

## What I had to decide

Whether members of a workspace may see each other's email addresses when sharing a question and reading who answered it, or only a name.

## What I did meanwhile

The share list and the already-answered note name each member by their arcade name, or by their email address when they have none; the list is given only to members of the same workspace.

## What it costs to change later

Showing only arcade names is a change to one database function and one line of the page; a member with no arcade name would then need another label.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says to pick a workspace member but not how a member is named, and many members have never picked an arcade name (author)
- The access rules so far let a person read only their own membership, so no page showed another member's email before this (author)

```

<!-- /omni-outbox-settled: s4-01-teammates-named-by-email -->

<!-- omni-outbox-settled: s4-02-for-me-count-on-every-page -->

## s4-02-for-me-count-on-every-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-for-me-count-on-every-page
prd: 144
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The count of questions waiting for someone sits in the header of every ask page; should it be read fresh each time a page opens, or refreshed while the page stays open?

## The decision, in plain words

It is read fresh each time an ask page opens, and not refreshed while the page stays open. The For me list itself is also read when it opens; reloading shows new questions.

## The intro, for fun

A little number in the corner that says someone needs you.

## The punchline, for fun

It only checks when you walk in, like a doorbell with a short memory.

## The options, in plain words

A. Read once when a page opens
B. Refresh the count and the list every few seconds while the page is open

## What I had to decide

Whether the For me count and list update on their own while a page stays open, or only when a page is opened or reloaded.

## What I did meanwhile

Every ask page reads the count once as it opens; For me reads its list once; the question page itself keeps refreshing every two seconds while open.

## What it costs to change later

Adding a refresh later is a small change to the header and the list; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the header shows the count but not whether it stays current, and Slack notifications come in the next PRD (author)
- Reading the count costs a few small database reads on every ask page load; its weight in production is not known yet (author)

```

<!-- /omni-outbox-settled: s4-02-for-me-count-on-every-page -->
