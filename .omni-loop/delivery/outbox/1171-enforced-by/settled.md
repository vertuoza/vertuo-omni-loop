# Settled outbox items — PRD 1171

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-removed-proof-reason -->

## s1-01-removed-proof-reason — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-removed-proof-reason
prd: 1171
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When the harvest refuses a proposed test because the change deleted it, how should it explain that?

## The decision, in plain words

It says the change removed that file, a third reason beside the two the design named, so a person sees exactly why the link was dropped.

## The intro, for fun

A test that was deleted cannot prove anything, however hard the model points at it.

## The punchline, for fun

So the harvest says so plainly: that one left with the change.

## The options, in plain words

A. A. Report a removed path with its own reason, "removed by #<pr>", and pass the status into the library so the app and the command share the rule.
B. B. Report a removed path as "no longer in the tree", keeping exactly the two reasons the spec names.
C. C. Have each caller drop removed paths before the library sees them, so a removed path reads as "not changed by #<pr>".

## What I had to decide

The spec names two reasons for dropping a proposed proof (not changed by the pull request, no longer in the tree) and says the callers keep only added, modified or renamed paths. It does not say whether a path the pull request removed is reported as one of those two or on its own.

## What I did meanwhile

The changed files reach the library with GitHub's status, removals included. A removed path is dropped with the reason "removed by #<pr>", a path the pull request did not change with "not changed by #<pr>", and a changed path missing from the tree with "no longer in the tree". The prompt lists only the added, modified and renamed paths.

## What it costs to change later

One reason string and the list of statuses in the writer, and the tests that pin them; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing in the spec or the knowledge says whether a third reason is wanted or whether the two named ones were meant to be the only ones.

```

<!-- /omni-outbox-settled: s1-01-removed-proof-reason -->

<!-- omni-outbox-settled: s1-02-app-bundle-rebuilt -->

## s1-02-app-bundle-rebuilt — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-app-bundle-rebuilt
prd: 1171
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

This slice changed shared code the app's built files are made from. Should it rebuild those files too, though they sit outside its agreed area?

## The decision, in plain words

Yes. It rebuilt them, unchanged in behaviour, so the full test run stays green; the next slice that changes the app rebuilds them again on top.

## The intro, for fun

Change the recipe and the cake on the shelf goes stale, even if nobody ordered a new one.

## The punchline, for fun

So this slice baked a fresh one, same taste, just today's date.

## The options, in plain words

A. A. Rebuild the app's bundle in this slice, in its own commit, so the preflight is green.
B. B. Leave the app's bundle stale here and let the second slice rebuild it, with this slice's preflight red until then.

## What I had to decide

The plan gives this slice the kit's bundle to rebuild but not the app's committed bundle, which is also built from the kit's library. The full test run checks that bundle against a fresh build, so leaving it stale turns the preflight red.

## What I did meanwhile

It ran the app's build script and committed the rebuilt bundle with nothing else, in its own commit. The app's own code is untouched: reading the pull request's files in the app stays the next slice's work.

## What it costs to change later

One generated file; the next slice that touches the app or the kit's library rebuilds it again, and a conflict there is settled by rebuilding.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's shared-ground note names only the kit's bundle; it does not say whether the app's bundle was meant to be left to the second slice.

```

<!-- /omni-outbox-settled: s1-02-app-bundle-rebuilt -->
