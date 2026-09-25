# Settled outbox items — PRD 39

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-unknown-default-branch-left-to-schema -->

## s1-01-unknown-default-branch-left-to-schema — adopted

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
id: s1-01-unknown-default-branch-left-to-schema
prd: 39
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When neither GitHub nor the local copy can say which branch is the main one, what should the installer write down?

## The decision, in plain words

It writes nothing for it, so the loop assumes the usual name, main. The person reviewing the new settings file before committing it sees the assumption and can correct it.

## The options, in plain words

A. Leave the default branch out so the schema default applies, and write an unknown slug as null (built).
B. Write the currently checked-out branch as the default branch.
C. On a terminal, ask for the default branch; otherwise leave it out.

## What I had to decide

What repo.defaultBranch (and repo.slug) become in the written config when gh cannot answer and origin/HEAD is not set.

## What I did meanwhile

repo.defaultBranch is left out of the written config, so the schema default applies; an unknown slug is written as null, which the schema allows and which every command already fills from the origin remote at load time.

## What it costs to change later

A few lines in the config writer; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the current branch, or a prompt on a terminal, would be a better guess than the schema default was not settled by the spec.

```

<!-- /omni-outbox-settled: s1-01-unknown-default-branch-left-to-schema -->

<!-- omni-outbox-settled: s1-02-kit-home-from-git-remote -->

## s1-02-kit-home-from-git-remote — adopted

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
id: s1-02-kit-home-from-git-remote
prd: 39
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the installer is run from a developer's copy of the kit instead of the one-line install, it has to tell the person which one line to run instead. Where should it get the kit's own address from?

## The decision, in plain words

It reads the address from the copy's own link to GitHub, and the packaged installer records that same address when it is built, so the address is written in one place only: wherever the kit is really fetched from.

## The options, in plain words

A. Read the kit address from the kit checkout's origin remote, recorded in the bundle at build time (built).
B. Write the address once as a constant in the build script and inject it into the bundle, and have source read it from there too.
C. Read it from the repository field of the package description that the last slice adds.

## What I had to decide

Whether the kit's own repository address (used in the npx line the refusal prints, and later in the closing steps) is read from the kit checkout's origin remote — at build time for the bundle, at run time from source — or written as one constant in the kit.

## What I did meanwhile

kit/build.mjs reads `git remote get-url origin` of the kit checkout and records the slug in the bundle's `__OMNI_BUNDLE__` marker; from source, kit/lib/init/bundle.mjs reads the same remote at run time. The no-literals guard forbids the literal in kit/lib and kit/bin, which is why no constant was written there.

## What it costs to change later

One function (kitHome) and the define in kit/build.mjs: swapping in a constant elsewhere is a few lines, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A bundle built in a clone whose origin is a fork records the fork; whether s3's drift test should pin the slug instead is not settled here.
- (author) The spec says the App slug and marketplace names are constants in init; this slice only needed the kit address, so s3 still chooses where those live.

```

<!-- /omni-outbox-settled: s1-02-kit-home-from-git-remote -->
