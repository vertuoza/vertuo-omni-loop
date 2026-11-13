# Settled outbox items — PRD 2779

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-agent-link-reads-enthusiastic -->

## s1-01-agent-link-reads-enthusiastic — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-agent-link-reads-enthusiastic
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

The old word is kept only for older terminals that read the business. Should agents connected through the agent link, and the review check on pull requests, also be sent the old word, or the new one?

## The decision, in plain words

They read the new word, enthusiastic. Only the terminal's business read sends the old word back, and only to a kit that does not ask for the new one.

## The intro, for fun

One persona, two words for how happy they are.

## The punchline, for fun

Only the oldest readers still hear the old word.

## The options, in plain words

A. A. The agent link and the review check read enthusiastic; only the terminal's business read sends excited to an older kit.
B. B. The agent link also sends excited unless it is asked for the new word.
C. C. Every read sends excited unless asked, the review check included.

## What I had to decide

Keep A when agents on the link and the review check may read enthusiastic. Pick B when they too must read excited unless they ask, which adds the same switch to the agent link.

## What I did meanwhile

Agents on the link read enthusiastic, neutral or skeptical. The review check passes the stance as plain text, so any word reads.

## What it costs to change later

B is a small change to the agent link's read, a few lines and a test; nothing is stored differently either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the old-kit switch for the terminal's business read only; it says nothing of the agent link or the review check (author).
- The review check reads any stance word as text, so it needs nothing either way.

```

<!-- /omni-outbox-settled: s1-01-agent-link-reads-enthusiastic -->

<!-- omni-outbox-settled: s1-02-unchanged-edit-not-recorded -->

## s1-02-unchanged-edit-not-recorded — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-unchanged-edit-not-recorded
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When someone saves a persona without changing any of its fields, should the knowledge history still get a line saying it was edited?

## The decision, in plain words

No line is added when nothing changed. A save that changes at least one field adds one line, with the persona before and after, as Legal and Glossary changes already do.

## The intro, for fun

Saving a persona you did not touch is a very calm afternoon.

## The punchline, for fun

The history writes down changes, not sighs.

## The options, in plain words

A. A. A save that changes no field adds no line to the history.
B. B. Every save adds a line, even when nothing changed.

## What I had to decide

Keep A when the history should hold real changes only, as it does for Legal entries and terms. Pick B when every save must be on record, even one that changed nothing.

## What I did meanwhile

Adding, deleting and bringing back a persona always add a line; an edit adds one only when a field changed.

## What it costs to change later

B drops one comparison in the database's edit function and one line of its check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says an edit appends an edited event, and does not say what a save with no change does (author).
- Legal and Glossary edits already skip a save that changed nothing, which this follows.

```

<!-- /omni-outbox-settled: s1-02-unchanged-edit-not-recorded -->

<!-- omni-outbox-settled: s1-03-find-by-exact-name -->

## s1-03-find-by-exact-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-find-by-exact-name
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When an agent edits a persona by its name from the terminal, should the name match exactly, capital letters included, or should Sam and sam count as the same persona?

## The decision, in plain words

The name must match exactly, once the spaces around it are dropped. Sam finds Sam, and sam finds no one, so an edit never lands on a persona it was not meant for.

## The intro, for fun

Sam, sam and SAM walk into a product.

## The punchline, for fun

Only one of them answers to the name on the door.

## The options, in plain words

A. A. The name matches exactly, capitals included, after trimming the spaces around it.
B. B. The name matches without regard to capitals.
C. C. Exact first, then without capitals when exact finds no one.

## What I had to decide

Keep A when an exact name is safest, since names are not unique. Pick B when a person should not have to remember capitals; two personas that differ only by capitals then count as several, and the agent is sent to the page.

## What I did meanwhile

An edit by name finds the one live persona of that exact name in the product. None says so with the name and the product; several sends the person to the Knowledge tab.

## What it costs to change later

B changes one comparison in the database's find function and two lines of its check; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says an edit finds the persona by its name in the product, and does not say whether capitals count (author).
- The database tells none and several apart with two different refusal codes, which the terminal's slice turns into its 404 and 409.

```

<!-- /omni-outbox-settled: s1-03-find-by-exact-name -->

<!-- omni-outbox-settled: s1-04-rename-keeps-changed-date -->

## s1-04-rename-keeps-changed-date — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-rename-keeps-changed-date
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When the update moves every excited persona to enthusiastic, should each persona's last-changed date move to the day of the update, or stay the day a person last changed it?

## The decision, in plain words

The last-changed date stays as a person left it. The move is still written in the knowledge history, one line per persona, saying it was excited before and enthusiastic after, and that no person made it.

## The intro, for fun

Nobody edited these personas, yet their word changed overnight.

## The punchline, for fun

The history knows; the date shown on the page does not pretend.

## The options, in plain words

A. A. The changed date stays as a person left it; the history records the move.
B. B. The changed date becomes the day of the update, as well as the history line.

## What I had to decide

Keep A when the page's changed date should mean a person changed it. Pick B when it should show every change, the update's included.

## What I did meanwhile

Each moved persona keeps its changed date, and gains one history line, by no one. The way the update moves them stays in the database, so its check can prove it again on fresh rows.

## What it costs to change later

B is one more column set in the update's move, before it ships; after it ships, a new migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the move is recorded with no person, and says nothing of the changed date the page shows (author).
- Keeping the move as a function the update calls once lets the database check prove it on rows stored the old way; it is never run by anyone signed in.

```

<!-- /omni-outbox-settled: s1-04-rename-keeps-changed-date -->

<!-- omni-outbox-settled: s2-01-stances-param-in-shared-client -->

## s2-01-stances-param-in-shared-client — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-stances-param-in-shared-client
prd: 2779
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

The page's shared connection code now sends the new request word for every read of the business, not only the one command the plan named. Is that the right place for it?

## The decision, in plain words

The word was added once in the shared connection code, so the terminal command and the knowledge reads both get the renamed stance, instead of copying the connection code into the command.

## The intro, for fun

One small word, and every reader now asks for the new vocabulary.

## The punchline, for fun

Old kits keep their old word, and nobody gets left saying excited.

## The options, in plain words

A. A. Send stances=2 from the shared client, as built.
B. B. Send it only from the business command, with its own copy of the call.

## What I had to decide

Edit kit/lib/ask/client.ts readBusiness to send stances=2, outside slice s2's territory. Every caller (omni business show, kb) reads both stance words, so none can break.

## What I did meanwhile

The shared code sends stances=2 and every reader accepts enthusiastic and excited.

## What it costs to change later

A different answer means moving one query parameter into the business command only; a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test calls the shared client with the old kit's own client code, so the compat test strips the parameter by hand (author).

```

<!-- /omni-outbox-settled: s2-01-stances-param-in-shared-client -->
