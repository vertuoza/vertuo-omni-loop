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
