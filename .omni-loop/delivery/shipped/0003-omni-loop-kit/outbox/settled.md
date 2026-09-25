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

<!-- omni-outbox-settled: s13-01-phase-0-docs-kind -->

## s13-01-phase-0-docs-kind — agreed

- Verdict: agreed
- Approved by: claude-code-session (delegated by pierre-derval)
- Approved at: 2026-09-25
- Channel: PRD issue #3
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/issues/3#issuecomment-5828428950
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s13
- Wave: 8

### The answer, as it was given

```text
ok — option A, as built (delegated answer; see the comment on #3).
```

### The item, as it was raised

```text
---
id: s13-01-phase-0-docs-kind
prd: 3
slice: s13
rank: high
bears-on: none
raised: 2026-09-25
wave: 8
---

## The question, in plain words

May the documentation-only pull request that opens a feature also edit the knowledge folder and the decision records, or only the feature folder?

## The decision, in plain words

It may: edits to the delivery folder, the knowledge folder, the decision records, the glossary and the context files all count as documentation.

## The options, in plain words

A. Count knowledge, decision records, glossary and context edits as documentation, the option built.
B. Allow only the feature folder itself, so any knowledge edit needs its own pull request.

## What I had to decide

What `classifyPhase0Path` classes as `docs` versus `source` in a phase-0 pull request.

## What I did meanwhile

Kept upstream's `docs` kind: a path under `paths.delivery`, `layout.knowledgeRoot` or `layout.adrDir`, or equal to `paths.glossary` or one of `paths.context`, is docs; anything else not a PRD-folder or acceptance file is source.

## What it costs to change later

One classifier in `kit/lib/policy/phase-0.mjs` and its tests; narrowing it later only refuses more.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether reviewers want knowledge edits reviewed apart from the spec that motivated them.

```

<!-- /omni-outbox-settled: s13-01-phase-0-docs-kind -->

<!-- omni-outbox-settled: s14-01-ship-needs-committed-tree -->

## s14-01-ship-needs-committed-tree — agreed

- Verdict: agreed
- Approved by: claude-code-session (delegated by pierre-derval)
- Approved at: 2026-09-25
- Channel: PRD issue #3
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/issues/3#issuecomment-5828428950
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s14
- Wave: 9

### The answer, as it was given

```text
ok — option A, as built (delegated answer; see the comment on #3).
```

### The item, as it was raised

```text
---
id: s14-01-ship-needs-committed-tree
prd: 3
slice: s14
rank: high
bears-on: none
raised: 2026-09-25
wave: 9
---

## The question, in plain words

Should the ship step refuse to run until the settled answers are saved in history, and should it ever save the move itself?

## The decision, in plain words

It refuses while the delivery folder has unsaved changes, and it never saves the move itself: a person reviews and commits it.

## The options, in plain words

A. Refuse until the delivery folder is committed, and leave the move for a person to commit, the option built.
B. Commit whatever is pending in the delivery folder first, then move and commit the move too.
C. Move anyway and leave any pending changes mixed into the same unsaved change.

## What I had to decide

What `omni ship` does on a dirty `paths.delivery`, and whether it commits.

## What I did meanwhile

`applyShip` refuses when `git status --porcelain -- <paths.delivery>` is non-empty ("uncommitted changes under <delivery> — commit the settle first"; `omni ship` exits 2, one line). It stages the `git mv` and rewrites, and never commits. yolo-fix commits the settle before shipping.

## What it costs to change later

Small: the refusal is one check in `kit/lib/delivery/ship.mjs`; committing would add a commit author and message convention the kit does not have yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether phase-3 skills will always commit the settle before calling ship, or expect ship to do it.

```

<!-- /omni-outbox-settled: s14-01-ship-needs-committed-tree -->

<!-- omni-outbox-settled: s15-01-check-all-skips-coverage -->

## s15-01-check-all-skips-coverage — agreed

- Verdict: agreed
- Approved by: claude-code-session (delegated by pierre-derval)
- Approved at: 2026-09-25
- Channel: PRD issue #3
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/issues/3#issuecomment-5828428950
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s15
- Wave: 10

### The answer, as it was given

```text
ok — option A, as built (delegated answer; see the comment on #3).
```

### The item, as it was raised

```text
---
id: s15-01-check-all-skips-coverage
prd: 3
slice: s15
rank: high
bears-on: none
raised: 2026-09-25
wave: 10
---

## The question, in plain words

When the full check runs without a copy of the main branch to compare against, should it skip the coverage part or fail?

## The decision, in plain words

It skips the coverage part and says so in one line, so a fresh repository with no remote still checks clean.

## The options, in plain words

A. Skip the coverage part with a one-line note when the main branch is missing, the option built.
B. Fail the whole check until the main branch is fetched, so coverage can never be skipped in silence.

## What I had to decide

What `omni check all` does when `<repo.remote>/<repo.defaultBranch>` does not resolve: skip `coverage` or exit non-zero.

## What I did meanwhile

`check all` runs inbox, outbox and knowledge always, and coverage only when the ref exists; otherwise it prints `coverage: skipped — no <ref>`. `check coverage` alone with no ref exits 2 naming the ref. An explicit `--base` that does not resolve is always an error.

## What it costs to change later

One branch in `kit/bin/commands/check.mjs`. The phase-2 outbox workflow must fetch the base (fetch-depth 0 or an explicit fetch) or coverage is skipped in CI; making it fatal later is a one-line change plus the fixture tests that rely on a remote-less repo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any CI this kit is installed into checks out without the base branch, which would make the skip silent in practice.

```

<!-- /omni-outbox-settled: s15-01-check-all-skips-coverage -->

<!-- omni-outbox-settled: s4-01-knowledge-ids-in-every-profile -->

## s4-01-knowledge-ids-in-every-profile — agreed

- Verdict: agreed
- Approved by: claude-code-session (delegated by pierre-derval)
- Approved at: 2026-09-25
- Channel: PRD issue #3
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/issues/3#issuecomment-5828428950
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
ok — option A, as built (delegated answer; see the comment on #3).
```

### The item, as it was raised

```text
---
id: s4-01-knowledge-ids-in-every-profile
prd: 3
slice: s4
rank: high
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should a decision be able to point at an entry in the knowledge folder even when that folder is not where this repository's rules come from?

## The decision, in plain words

Yes: an entry is found whenever the knowledge folder exists, but it only forces a decision to be treated as serious when the rules come from that folder.

## The options, in plain words

A. Find knowledge entries in every setup, and raise the seriousness only when the rules come from the knowledge folder, the option built.
B. Find knowledge entries only when the rules come from the knowledge folder, and refuse them everywhere else.

## What I had to decide

Whether `laws.resolve` accepts a knowledge id when `laws.source` is not `knowledge`.

## What I did meanwhile

`resolve()` resolves knowledge ids whenever `ctx.layout.knowledgeRoot` exists (refusing only a missing folder or an unknown id); `floorsHigh` stays tied to `laws.source`. `check-inbox` grades `areas:` the same way. `Became:` write-back therefore works in every profile.

## What it costs to change later

One condition in `kit/lib/laws.mjs` and one in `kit/lib/inbox/check-inbox.mjs`; reverting refuses `Became:` ids outside the knowledge profile again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a repository with laws.source none will keep a knowledge folder at all, or treat it as unused.

```

<!-- /omni-outbox-settled: s4-01-knowledge-ids-in-every-profile -->
