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

<!-- omni-outbox-settled: s2-01-app-bundle-rebuilt-again -->

## s2-01-app-bundle-rebuilt-again — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-app-bundle-rebuilt-again
prd: 1171
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

This slice changed the app's harvest, and the app's built file is made from it. Should it rebuild that file too, though it sits outside its agreed area?

## The decision, in plain words

Yes. It rebuilt that file in a commit of its own, with nothing else in it, so the full test run stays green.

## The intro, for fun

The recipe changed again, so the cake on the shelf went stale again.

## The punchline, for fun

Same bakery, same oven, one more fresh cake.

## The options, in plain words

A. Rebuild the app's bundle in this slice, in its own commit, so the preflight is green.
B. Leave the app's bundle stale and let the feature branch rebuild it once, with this slice's preflight red until then.

## What I had to decide

Whether a slice that changes the app's code also rebuilds the app's committed bundle when the plan leaves that bundle out of its territory.

## What I did meanwhile

It ran the app's build script on top of the first slice's rebuild and committed the regenerated bundle alone, in its own commit. The app's own source changes stay inside the slice's folder.

## What it costs to change later

One generated file; any later change to the app or the kit's library rebuilds it again, and a conflict there is settled by rebuilding.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's shared-ground note says this slice never touches a bundle; it names only the kit's bundle, not the app's, which the full test run also checks against a fresh build.

```

<!-- /omni-outbox-settled: s2-01-app-bundle-rebuilt-again -->

<!-- omni-outbox-settled: s3-01-rules-count-reads-the-base -->

## s3-01-rules-count-reads-the-base — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-rules-count-reads-the-base
prd: 1171
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Should the count of proven rules in the status screen come from the shared main line, or from the copy on the person's own computer?

## The decision, in plain words

It counts the rules on the shared main line as last fetched, like every other number on that screen, so a rule edited locally shows up only once it is merged.

## The intro, for fun

Two copies of the rules exist: the one everyone shares and the one on your desk.

## The punchline, for fun

The status screen counts the shared one, so it never brags about homework not handed in.

## The options, in plain words

A. A. Count the rules on the shared main line as last fetched, like the rest of the screen (built).
B. B. Count the rules in the local copy, so an unmerged edit shows at once.
C. C. Show both counts when they differ.

## What I had to decide

Whether the rules count follows the rest of the status screen and reads the shared main line, or reads the local copy instead.

## What I did meanwhile

The count reads the main line as last fetched, the same place the delivered bar reads.

## What it costs to change later

Switching to the local copy is a few lines in one function; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the count covers 'the registers' without saying which copy; reading the main line follows the status screen's existing rule that it never reads the working tree. (author)

```

<!-- /omni-outbox-settled: s3-01-rules-count-reads-the-base -->
