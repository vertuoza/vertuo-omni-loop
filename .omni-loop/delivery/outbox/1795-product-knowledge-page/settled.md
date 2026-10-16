# Settled outbox items — PRD 1795

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-legal-source-free-text -->

## s1-01-legal-source-free-text — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-legal-source-free-text
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec says a Legal entry's source law is a link, but its own example is the name of a law and an article. Should the page insist on a web link?

## The decision, in plain words

Any one line of up to 500 characters is accepted as the source law, a link or the law's name, so the spec's own example fits.

## The intro, for fun

A law can live at a web address or on page 53 of a thick book.

## The punchline, for fun

We took both, and the book did not complain.

## The options, in plain words

A. Any one line: a link or the name and article of the law.
B. Only a web address starting with http:// or https://.

## What I had to decide

Answer A to keep the free line, or B to accept only a web address.

## What I did meanwhile

The database takes any one line of text as the source; nothing checks that it is a web address.

## What it costs to change later

Requiring a link later is one changed check in a new migration; entries already stored without a link would then need editing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the people who write Legal entries keep their sources online or cite printed codes (author)

```

<!-- /omni-outbox-settled: s1-01-legal-source-free-text -->

<!-- omni-outbox-settled: s1-02-legal-entry-owner-default -->

## s1-02-legal-entry-owner-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-legal-entry-owner-default
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Each Legal entry names an owner who answers for it. When nobody picks one, who is it?

## The decision, in plain words

The person who writes the entry owns it; for an entry that came from a proposal, the person who proposed it, unless they named someone else.

## The intro, for fun

Every rule of law needs somebody who will pick up the phone about it.

## The punchline, for fun

Whoever writes it down answers the phone, at least until they hand it over.

## The options, in plain words

A. The writer, or the proposer, owns the entry unless someone else is named.
B. The product's Legal owner owns every new entry unless someone else is named.

## What I had to decide

Answer A to keep the writer as the owner, or B to make the product's Legal owner the owner of every new entry.

## What I did meanwhile

A new entry with no owner given is owned by its writer, or by its proposer once approved; anyone allowed can change the owner later.

## What it costs to change later

Changing the default later touches one function; entries already stored keep the owner they got.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a product's Legal owner wants to answer for every entry by default (author)

```

<!-- /omni-outbox-settled: s1-02-legal-entry-owner-default -->

<!-- omni-outbox-settled: s1-03-named-owner-who-left -->

## s1-03-named-owner-who-left — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-named-owner-who-left
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

If the person named as the Legal or Glossary owner leaves the team, who may decide its entries and proposals?

## The decision, in plain words

Someone who left no longer counts as named, so while nobody named is still on the team, the team's owners decide, as they do before anyone is named.

## The intro, for fun

The Glossary owner moved to another company and took the keys with them.

## The punchline, for fun

The spare keys were with the team's owners all along.

## The options, in plain words

A. A person who left names nobody: the team's owners decide until someone new is named.
B. A person who left still holds the kind: nobody decides until a team owner names someone new.

## What I had to decide

Answer A to keep this, or B to keep the departed person named so that only a team owner naming someone new unlocks it.

## What I did meanwhile

Only named people who are still members of the team count; the page shows no owner for a kind whose named person left.

## What it costs to change later

Changing it later is one function; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often a named owner leaves without a successor being named (author)

```

<!-- /omni-outbox-settled: s1-03-named-owner-who-left -->

<!-- omni-outbox-settled: s1-04-naming-an-owner-is-logged -->

## s1-04-naming-an-owner-is-logged — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-naming-an-owner-is-logged
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The spec lists what the knowledge history records, but naming an owner or a delegate is not on the list. Should naming someone be recorded too?

## The decision, in plain words

Naming, changing or clearing an owner or a delegate is recorded in the history as a change of its own, with who was named before and after.

## The intro, for fun

A history that forgets who held the pen is only half a history.

## The punchline, for fun

So the pen gets a line of its own too.

## The options, in plain words

A. Naming an owner or a delegate is recorded in the history.
B. The history records only changes to entries and proposals.

## What I had to decide

Answer A to keep naming in the history, or B to leave it out.

## What I did meanwhile

The history has one more kind of change, named, beside added, edited, retired, removed, proposed, approved and rejected.

## What it costs to change later

Dropping it later means a migration that stops writing these rows; rows already written stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone will read the history of who was named, beside the entries' history (author)

```

<!-- /omni-outbox-settled: s1-04-naming-an-owner-is-logged -->

<!-- omni-outbox-settled: s1-05-app-read-knowledge-version -->

## s1-05-app-read-knowledge-version — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-app-read-knowledge-version
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The phase-0 check must judge a spec again when a Legal entry changes. Where does it learn that something changed?

## The decision, in plain words

The business read the phase-0 check uses also answers the number of the product's newest knowledge change, so the check can key its stored verdict on it.

## The intro, for fun

A judge who never hears that the law changed keeps ruling by the old one.

## The punchline, for fun

Now the judge finds a note on the desk each morning.

## The options, in plain words

A. The phase-0 check's business read carries the newest knowledge change.
B. The phase-0 check asks for the newest knowledge change in a read of its own.

## What I had to decide

Answer A to keep the number in that read, or B to have the check ask for it separately.

## What I did meanwhile

The read the phase-0 check uses carries one more field beside the Legal entries and the glossary; the terminal's and agents' read does not.

## What it costs to change later

Moving it later is one function and the check's read; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How slice s7 will build its cache key; it is designed for this field but not yet built (author)

```

<!-- /omni-outbox-settled: s1-05-app-read-knowledge-version -->
