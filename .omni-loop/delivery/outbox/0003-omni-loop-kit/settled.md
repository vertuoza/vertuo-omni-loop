# Settled outbox items — PRD 3

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-config-literal-exemptions -->

## s1-01-config-literal-exemptions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-config-literal-exemptions
prd: 3
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

May the one file that defines the default settings spell out the default label and branch names that every other file must not?

## The decision, in plain words

Yes, that one file may, because it is where the defaults live; every other rule of the guard still applies to it.

## The options, in plain words

A. Let the settings file spell out its own defaults, the option built.
B. Build the default names from pieces so no file ever spells them out.

## What I had to decide

Whether the no-literals guard exempts `kit/lib/config.mjs` from the label patterns and the `docs/` pattern.

## What I did meanwhile

Exempt `kit/lib/config.mjs` from `'outbox:go'`, `'pr:feature'` and `docs/` only (the branch default `docs/phase-0-{topic}` is a branch name, not a path).

## What it costs to change later

Two entries in `kit/test/no-literals.test.mjs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a future default in the settings file could hide a real path behind the same exemption.

```

<!-- /omni-outbox-settled: s1-01-config-literal-exemptions -->

<!-- omni-outbox-settled: s15-02-github-client-in-bin -->

## s15-02-github-client-in-bin — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s15
- Wave: 10

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s15-02-github-client-in-bin
prd: 3
slice: s15
rank: medium
bears-on: none
raised: 2026-09-25
wave: 10
---

## The question, in plain words

Where should the code that talks to the code-hosting service live?

## The decision, in plain words

Only in the command-line layer; the library reads and writes files and never reaches the network.

## The options, in plain words

A. Keep the network client in the command-line layer, the option built.
B. Let library modules call the network client directly.

## What I had to decide

Where `ghClient` lives.

## What I did meanwhile

`kit/bin/github.mjs` holds it; `kit/lib` receives an injected client and does no network I/O, so its tests need no network.

## What it costs to change later

Moving it back is a file move plus imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later phase needs the library to page through results itself.

```

<!-- /omni-outbox-settled: s15-02-github-client-in-bin -->

<!-- omni-outbox-settled: s3-01-tracked-files-need-git -->

## s3-01-tracked-files-need-git — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-tracked-files-need-git
prd: 3
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Should the checks work in a copy of the repository that is not under version control?

## The decision, in plain words

No: the kit only runs inside a repository under version control, so the fallback that walked plain folders was dropped.

## The options, in plain words

A. Require version control and drop the plain folder walk, the option built.
B. Keep a plain folder walk for copies without version control.

## What I had to decide

Whether `trackedFiles(ctx)` keeps upstream's non-git walk fallback.

## What I did meanwhile

Dropped it: `loadContext` already refuses outside a git repository.

## What it costs to change later

One function in `kit/lib/check-report.mjs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether anyone runs the checks on an exported tarball.

```

<!-- /omni-outbox-settled: s3-01-tracked-files-need-git -->

<!-- omni-outbox-settled: s6-01-adopt-needs-prd-folder -->

## s6-01-adopt-needs-prd-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-adopt-needs-prd-folder
prd: 3
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

What should happen when a decision is recorded for a feature that has no folder in this repository?

## The decision, in plain words

It is refused with a one-line message naming the feature, the same way settling one is refused.

## The options, in plain words

A. Refuse it with a one-line message, the option built.
B. Create an outbox folder for it anyway.

## What I had to decide

Whether `adoptItem` throws when `ctx.layout.outboxDir(prd)` is null.

## What I did meanwhile

It throws `PRD <n> has no inbox or shipped folder`, as `settleItem` does; the CLI turns it into a one-line exit 2.

## What it costs to change later

One guard in `kit/lib/outbox/settle.mjs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an outbox should ever exist for a feature that has no inbox folder yet.

```

<!-- /omni-outbox-settled: s6-01-adopt-needs-prd-folder -->

<!-- omni-outbox-settled: s9-01-override-label-on-gate-result -->

## s9-01-override-label-on-gate-result — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s9
- Wave: 8

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-override-label-on-gate-result
prd: 3
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 8
---

## The question, in plain words

When the gate is waved through by a label, should its report name the label that did it?

## The decision, in plain words

Yes, the report names the configured label, so whoever reads the log sees what let the gate pass.

## The options, in plain words

A. Carry the configured label on the gate result and print it, the option built.
B. Print a generic override line without the label.

## What I had to decide

Whether `gateResult` carries `overrideLabel` for `formatReport`.

## What I did meanwhile

`gateResult` returns `overrideLabel` (`ctx.config.labels.outboxGo`); `formatReport` prints `<label> — override in effect`.

## What it costs to change later

One field on the result in `kit/lib/outbox/status.mjs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the log reader ever needs more than the label, such as who applied it.

```

<!-- /omni-outbox-settled: s9-01-override-label-on-gate-result -->
