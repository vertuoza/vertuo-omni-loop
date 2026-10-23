# Settled outbox items — PRD 2416

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-where-level-copies-lie -->

## s1-01-where-level-copies-lie — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-where-level-copies-lie
prd: 2416
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Where on a laptop does a repository keep its read copy of the plan repository's rules and of the workspace's settings rules?

## The decision, in plain words

Each sits in its own folder inside the repository's local, never-committed area, laid out like the repository's own knowledge folder. Nothing fills them yet: the next PRD writes the settings copy.

## The intro, for fun

Every family tree needs an address book for the relatives upstairs.

## The punchline, for fun

We wrote the addresses down; nobody has moved in yet.

## The options, in plain words

A. Two folders in the checkout's local area, laid out as a knowledge folder, read from the checkout's root: the option built.
B. Read the plan repository's level from its newest knowledge pack kept in the main checkout, once a repository can name its plan repository.
C. Commit the copies inside the repository's knowledge folder, so every clone reads the same text without a sync.

## What I had to decide

Where the two read copies above the repository live, and how they are laid out. Built: `.omni-loop/local/tree/plan-repo/` and `.omni-loop/local/tree/omni-settings/`, each a knowledge folder (`playbook/<form>.md`, `adr/README.md`), read from the checkout's own root (`kit/lib/knowledge-tree/levels.ts`). The checkout's local folder is git-ignored, so the copies are never committed (Never 6: the files themselves stay in their own repositories). A worktree reads its own local folder, as the product-knowledge cache does; the knowledge packs read the main checkout instead, which PRD #2417 may adopt when it writes the copy.

## What I did meanwhile

The folders are two constants in one module; a repository with neither copy reads every form exactly as before.

## What it costs to change later

Two path constants and their test; moving them is a one-line change before any copy is written.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how a target repository learns which repository is its plan repository, so something can fill its copy (author)
- whether a worktree should read the main checkout's copies, as the knowledge packs do (author)

```

<!-- /omni-outbox-settled: s1-01-where-level-copies-lie -->

<!-- omni-outbox-settled: s1-02-what-a-level-answers -->

## s1-02-what-a-level-answers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-what-a-level-answers
prd: 2416
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

When a repository leaves a rule unwritten, which of the higher levels' rules count as an answer, and how is a rule the repository marked as an open question shown?

## The decision, in plain words

Only written text from a higher level counts: an empty rule, an open question or a link to another file there is skipped, and the next level is read. When the repository itself left an open question, the higher level's text shows in place of the generic default and the question stays listed under it.

## The intro, for fun

Asking the grown-ups only helps when they actually answer.

## The punchline, for fun

A shrug from upstairs gets passed further up.

## The options, in plain words

A. Only a higher level's written text answers; a rule the repository left as an open question shows that text, tagged with its level, and keeps the question: the option built.
B. A rule the repository left as an open question keeps the generic default, and the higher levels answer only a rule the repository left empty.
C. A higher level's link to another file answers too, shown as the link it is and tagged with its level, even when the file cannot be read here.

## What I had to decide

What counts as a level's answer for a playbook section, and how a repository hole reads. Built (`kit/lib/playbook/resolve.ts`): a level's section answers only when it holds text; an empty one, a `TODO(human)`-only one (the plan's rule), a `See:` line, or a whole pointer form at that level falls through, because its path names the other repository's file, not this disk's. A repository section holding only `TODO(human)` lines keeps its questions and shows the nearest level's text in place of the kit default, labelled `[hole · plan repo]` or `[hole · omni settings]`; with no level answering it is `[hole]` as today. A level's text is never filled from the config. In `kb show --json`, a section answered by a level carries `source: plan-repo` or `omni-settings` and its tag in `label`; no new field is added, so a repository with no copy prints its JSON as before.

## What I did meanwhile

Every rule is a branch of one resolver function, proven by `kit/lib/playbook/resolve.test.ts`; nothing is stored.

## What it costs to change later

A change of mind is a few lines in the resolver and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a level's `See:` line should instead show the pointer text, or read the file from the copy when the copy holds it (author)

```

<!-- /omni-outbox-settled: s1-02-what-a-level-answers -->

<!-- omni-outbox-settled: s4-01-what-counts-as-a-contradiction -->

## s4-01-what-counts-as-a-contradiction — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-what-counts-as-a-contradiction
prd: 2416
slice: s4
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

When does a product rule written in a repository count as contradicting a rule of the levels above it, so that the knowledge check turns red?

## The decision, in plain words

Only when the repository reuses the number of a rule from above and changes what it says, or what sort of entry it is. A rule under a number of its own only adds and stays green; one that repeats the rule above word for word is fine too.

## The intro, for fun

Family rules: you can add your own, but you cannot rewrite grandma's.

## The punchline, for fun

Same name, different story, and the check calls it out.

## The options, in plain words

A. A. Same number with different words or a different sort of entry, while a repeat or a new number stays green: the option built.
B. B. Also flag a rule under a new number whose wording matches a higher rule's closely but says the opposite, judged by a language model.
C. C. Ask the person writing a rule to mark it with a line naming the higher rule it overrides or contradicts, and flag only those marked rules.

## What I had to decide

What counts as a contradiction between two levels' register entries, read from the registers' own fields only. Built (kit/lib/knowledge-tree/product.ts, wired into gradeKnowledge in kit/lib/knowledge/check-knowledge.ts): a lower level's entry carrying the id of a higher level's entry contradicts it when its kind differs, or else its statement differs once spacing is collapsed. Each pair is one red line naming both entries, their files and their levels, and what differs. Every pair is checked, the plan repository's copy against the Omni settings' copy as well as the repository against either, since the spec says a lower level never contradicts a higher one. Other fields (Serves, Enforced by, Locked, Governs, Proposed) are not compared: they say how a level proves or governs a rule, not what the rule is. A proposed higher entry counts like a confirmed one. An imported copy (ctx.copyOf) is never compared.

## What I did meanwhile

The check is one function over the parsed entries and one call in the grade; a repository with no level above it grades exactly as before.

## What it costs to change later

A different definition is a change to one comparison function and its tests; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether two repositories numbering their product rules independently can collide on an id with no intent to restate, which this definition reads as a contradiction
- (author) whether a contradiction between the plan repository's copy and the Omni settings' copy should turn this repository's check red, since neither copy is this repository's to fix
- (author) whether a higher entry still only proposed should bind the levels under it

```

<!-- /omni-outbox-settled: s4-01-what-counts-as-a-contradiction -->

<!-- omni-outbox-settled: s3-01-how-a-decision-shows-its-level -->

## s3-01-how-a-decision-shows-its-level — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-how-a-decision-shows-its-level
prd: 2416
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

When the decision list also holds records from the plan repository or the workspace settings, how does each record show where it comes from, and what happens to the repository's own numbering?

## The decision, in plain words

A record is tagged with its level in the list only once another level contributes one, so a repository with no other level prints exactly what it printed before. The repository's own records keep the next free number and are never renumbered by a record from above.

## The intro, for fun

A family album is easier to read when every photo says whose shelf it came from.

## The punchline, for fun

The tag only appears once there is a second shelf.

## The options, in plain words

A. A. Tag only when another level contributes, the repository's own untagged and without a level key: the option built.
B. B. Always tag every record, including a repository alone, and add a level key to every record in the JSON.
C. C. List other levels' records in a separate section under the repository's list.

## What I had to decide

Built: readDecisions returns the repository's records first, then each higher level's records whose number nothing nearer holds. A record read from another level carries a level key; the repository's own carries none, so the JSON of a repository alone is unchanged. The list prints a bracketed level after each title only when some record comes from another level. The repository's own records are cut to the latest 20 and every inherited one is listed. The shared numbers and the next free number stay the repository's own.

## What I did meanwhile

Everything is derived live from the folders; nothing is stored. Other readers of the records (the knowledge graph, the classifier) now also see inherited records when a copy exists.

## What it costs to change later

A change of mind is a few lines in the decisions reader and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the knowledge graph and the classifier should see inherited records or the repository's own only (author)
- whether a record from above that shares a repository record's number should be listed as shadowed instead of hidden (author)

```

<!-- /omni-outbox-settled: s3-01-how-a-decision-shows-its-level -->
