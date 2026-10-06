# Settled outbox items — PRD 1089

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-area-inheritance -->

## s1-01-area-inheritance — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-area-inheritance
prd: 1089
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

When a part of the code has its own rules, how does it combine them with the rules for the whole repository, and where do the older 'land alone' paths sit among the named parts?

## The decision, in plain words

A part takes the whole repository's rules and adds its own, always keeping the stricter limit; it may pick its own merge method, and only a part that opts out of inheriting can loosen a limit. The older 'land alone' paths count as one more part, checked after every named one.

## The intro, for fun

Two rulebooks walk into the same folder, and both want the last word.

## The punchline, for fun

The stricter one wins, unless the folder politely asks to be left alone.

## The options, in plain words

A. Keep it: inherited rules combine like rules across areas, the stricter limit wins, and the old 'land alone' paths are checked after the named parts.
B. Let a part's own limits override the inherited ones, so a part can loosen a limit without opting out of everything.
C. Put the old 'land alone' paths first, so they always win over a named part that also matches them.

## What I had to decide

The spec says an area inherits the default area's rules unless it says inherit: false, and how rules combine across a slice's areas, but not how an area's own value meets an inherited one. I took the cross-area rule for inheritance too: the strictest limit, the union of requireChecks, approval and territory: block stick; an area's own merge method and its own replace hook win over the default's. inherit: false also drops the default area's hooks, not only its rules. landings.alone reads as an area named landings.alone placed after the declared areas, so a path a declared area claims follows that area's rules first.

## What I did meanwhile

Built resolveFlow and resolveTerritory that way, with table-driven tests for each case (an inheriting area cannot loosen maxFiles, inherit: false keeps its own rules and no hooks, the landings.alone area comes last).

## What it costs to change later

A constant change in kit/lib/flow/resolve.ts and its tests: letting an area's own limit override the inherited one, keeping default hooks under inherit: false, or putting the landings.alone area first is a few lines, no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person expects an area's own maxFiles to relax the repository's, as a CSS-like override, rather than inherit: false being the only way to loosen one

```

<!-- /omni-outbox-settled: s1-01-area-inheritance -->

<!-- omni-outbox-settled: s1-02-check-config-shape -->

## s1-02-check-config-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-check-config-shape
prd: 1089
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How does a team mark a hook as one only Claude reads, how big may a hook file be when nobody says, and does the config check run with every other check?

## The decision, in plain words

A Claude-only hook is written as its path plus a 'claude' mark; the size limit is optional and falls back to twenty kilobytes without appearing in the printed config; and the new config check runs on its own and inside the run of every check.

## The intro, for fun

A config file asked to be checked, and then asked who checks the checker.

## The punchline, for fun

Now it gets checked every time, with the others, whether it likes it or not.

## The options, in plain words

A. Keep it: the Claude mark sits on each hook, the size limit is optional with a quiet default, and the config check runs inside every full check.
B. Fill the size limit's default in the printed config, like the other limits, accepting one changed existing test.
C. Put the Claude mark on the whole point rather than on each hook, and keep the config check out of the full run.

## What I had to decide

The spec names alias: claude but not where it sits; I made a hook reference either a path or { path, alias: claude }, the latter also taking a slash command (pr.openWith's alias resolves to that). limits.hookMaxBytes is optional, not defaulted in the parsed config, so a config without it parses exactly as before and the existing limits test stays unchanged; the 20480 default lives in kit/lib/flow/schema.ts. omni check config is a new guard, and omni check all runs it first. To exit 1 on an invalid config, omni check now loads its own context: check config turns an invalid config into a red guard, every other guard still stops with exit 2 as before.

## What I did meanwhile

Built the guard, the alias form and the optional limit, each with tests in kit/bin/check-config.test.ts and kit/lib/flow/schema.test.ts.

## What it costs to change later

A constant change: defaulting hookMaxBytes in the schema (and updating one existing test), moving alias: claude onto the point, or leaving config out of check all are each a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether omni config should print hookMaxBytes with its default like the other limits

```

<!-- /omni-outbox-settled: s1-02-check-config-shape -->

<!-- omni-outbox-settled: s1-03-app-bundles-outside-territory -->

## s1-03-app-bundles-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-app-bundles-outside-territory
prd: 1089
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

This slice had to rebuild the GitHub app's bundled files, which its plan did not list. Should those files be part of every slice that changes the shared config reader?

## The decision, in plain words

I rebuilt the app's two bundled files in this slice, since the app carries the config reader inside them and the test suite refuses a stale copy, and committed them here rather than leaving the suite red.

## The intro, for fun

The plan said 'touch only these files', and the build politely disagreed.

## The punchline, for fun

Two bundles came along for the ride, freshly built and nothing else changed.

## The options, in plain words

A. Keep it: the slice that changes the shared config reader rebuilds the app's bundles too, as a generated change.
B. Leave the bundles stale in slices and rebuild them once on the feature branch before it is marked ready.

## What I had to decide

Changing kit/lib/config.ts makes apps/omni-app/api/github.mjs and apps/omni-app/api/inngest.mjs stale: apps/omni-app/src/vercel-functions.test.ts fails until node apps/omni-app/build.ts rebuilds them. The plan's territory for s1 lists kit/dist/omni.mjs but not these two. I rebuilt and committed them in s1, a generated change only, so the preflight is green. Later slices that touch what the app bundles (s3's plan grading, say) will meet the same.

## What I did meanwhile

Committed the two regenerated bundles in their own commit, nothing hand-edited.

## What it costs to change later

Nothing to undo: they are a build output; a later slice rebuilds them again. The plan's shared-ground note could name them for s3 and s6.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the plan meant the app bundles to stay out of every slice and be rebuilt once on the feature branch

```

<!-- /omni-outbox-settled: s1-03-app-bundles-outside-territory -->

<!-- omni-outbox-settled: s2-01-other-skills-find-by-base -->

## s2-01-other-skills-find-by-base — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-other-skills-find-by-base
prd: 1089
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

Three other loop commands (the wave, the rework run and the planner) still look for the feature pull request only when it targets the main branch, so they would not find one stacked on another pull request. Should they learn to find it too?

## The decision, in plain words

I taught only the build-everything command and the pull request command to find a stacked feature pull request, as this slice asks, and left the other three as they are, outside this slice.

## The intro, for fun

A pull request standing on another one's shoulders is easy to miss if you only look at the floor.

## The punchline, for fun

Two commands now look up; three still stare at their shoes.

## The options, in plain words

A. Keep the change to the two skills this slice owns; the other three keep their filter until a later slice widens them.
B. Fold the same change for the wave and the planner into the slice that already edits them (s7), and the rework run with it.
C. Open a follow-up fix that widens all three at once, with a test in the skill tests.

## What I had to decide

Whether the wave, the rework run and the planner should also find a stacked feature pull request, and in which slice.

## What I did meanwhile

A stacked feature pull request is found by the build-everything command and handled by the pull request command; the wave, the rework run and the planner look for it with a filter on the main branch and report none.

## What it costs to change later

Small: the same one-line change in three skill files, plus a check in the skill tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test guards the stacked wording in either skill: the skill tests sit outside this slice's territory (author).

```

<!-- /omni-outbox-settled: s2-01-other-skills-find-by-base -->
