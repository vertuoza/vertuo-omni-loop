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
- Became: ADR-0070

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
- Stays here: These are local config-shape choices, each a few lines to change, and they guarantee nothing lasting about product behaviour that the knowledge base must keep.

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
- Became: ADR-0071

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
- Stays here: A scoping choice for this slice with a small, known follow-up; it sets no lasting rule or design, so it stays in the ledger.

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

<!-- omni-outbox-settled: s3-01-plan-rules-order-and-reach -->

## s3-01-plan-rules-order-and-reach — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s3
- Wave: 2
- Became: BR-PRODUCT-69, P-PRODUCT-61

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-plan-rules-order-and-reach
prd: 1089
slice: s3
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

When a part of the code must come first, or must be waited for by everything else, how does the plan check read 'first' across landings, and which slices does it apply the rules to?

## The decision, in plain words

A part that comes first must sit strictly before every other slice, a later landing counting as after; a slice in a later landing already waits for it; the file limit counts the paths a slice lists; and in a plan spanning several repositories, every row is checked against this repository's own rules until a later slice reads each target's.

## The intro, for fun

Being first sounds simple until two slices both stand in wave one.

## The punchline, for fun

Sharing the front of the queue counts as cutting in line.

## The options, in plain words

A. A. Keep it: strictly before, landing then wave; a later landing satisfies blocks all; the limit counts listed paths; every row meets this repository's flow for now.
B. B. Let a first part share its wave with the rest, only refusing a slice outside it in an earlier wave.
C. C. Compare waves only within one landing, ignoring the landing order for wave first and blocks all.

## What I had to decide

Whether a part that must come first may share its wave with others, and whether landings count in that order.

## What I did meanwhile

Built the plan rules that way in the plan check, with a test for each rule and its green counterpart, the spec's kernel and migrations example included.

## What it costs to change later

A constant change in the plan rules module and its tests: letting a first part share its wave, ignoring landings, or skipping target rows is a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the area's slices sit in a wave before every other slice, but not whether a shared wave is allowed, nor how landings order them.
- (author) Whether the file limit should count files rather than the path prefixes a territory lists: a plan names prefixes, so the check counts those.
- (author) Target rows of a plan repository's plan meet the plan repository's own areas until the slice that reads each target's flow lands.

```

<!-- /omni-outbox-settled: s3-01-plan-rules-order-and-reach -->

<!-- omni-outbox-settled: s4-01-flow-show-shapes -->

## s4-01-flow-show-shapes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s4
- Wave: 3
- Became: ADR-0072

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-flow-show-shapes
prd: 1089
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

How does a hook file say what it needs and how it ends, how are the slice's details put into its text, and what counts as a change from the loop's usual way of working?

## The decision, in plain words

A hook may open with a short header block, fenced or as its first lines; the slice's details replace names written in curly braces; its last line must be the verdict for that exact step; and naming the usual merge or the usual report setting is not shown as a change.

## The intro, for fun

A recipe card walks in and asks where to write the oven temperature.

## The punchline, for fun

On top, in braces, and the last line says whether dinner worked.

## The options, in plain words

A. A. Keep it: a fenced or first-paragraph header, {name} inputs, the verdict as the strict last line for that step, squash and report not shown as changes.
B. B. Require a fenced header only, and refuse a hook file without one.
C. C. Accept the verdict line anywhere in the output, the last one found winning, and print each area's own rules only in the differences.

## What I had to decide

Whether the hook file shape, the curly-brace inputs and the strict last-line verdict are the ones the team wants before the skills start following them in a later slice.

## What I did meanwhile

Built omni flow show and omni flow verdict that way, with snapshot tests of the spec's kernel and migrations example, and listed omni flow in the help beside the config guard of omni check.

## What it costs to change later

A constant change in kit/lib/flow/show.ts or kit/lib/flow/verdict.ts and their snapshots: another placeholder syntax, a looser verdict search or counting squash as a change is a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names a hook's front matter (omni-hook, inputs, verdict) but not its fence: both a --- block and a first paragraph of key: value lines are read, since the s1 fixture uses the latter.
- (author) The spec says a hook's inputs are filled in but not how a hook names one: {name} is used, as the branch templates do.
- (author) The spec writes not ok <hook> <why>; the verdict command knows only the point, so it prints the point.
- (author) A pass may carry text after pass (wave.merge's merged PR number), printed after ok; the spec does not say what ok prints then.
- (author) The spec's --path <p>… reads one path here; several would need a repeated flag the argument parser does not take.
- (author) Differences from the defaults list each area's rules with what it inherits, so the default area's rules show again under each inheriting area.

```

<!-- /omni-outbox-settled: s4-01-flow-show-shapes -->

<!-- omni-outbox-settled: s5-01-merge-gate-reading -->

## s5-01-merge-gate-reading — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s5
- Wave: 4
- Became: ADR-0073

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-merge-gate-reading
prd: 1089
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 4
---

## The question, in plain words

Before the loop merges a slice's pull request, which parts of the code does it hold it to, what counts as a green check or a person's approval, and how does it read a pull request in another repository?

## The decision, in plain words

The pull request meets the rules of every part its plan names and every part its changes reach; a passed, skipped or neutral check counts as green; only a person's latest review counts, never a bot's; and in another repository it asks that repository's pull request while still reading the rules of this one.

## The intro, for fun

A pull request knocks on the merge door and the doorman asks to see its whole family tree.

## The punchline, for fun

Cousins it never mentioned count too, and robots cannot vouch for it.

## The options, in plain words

A. A. Keep it: the plan's parts and the parts the changes reach, passed, skipped or neutral checks green, a person's latest review, and --repo asks the other repository while the rules come from this checkout.
B. B. Judge only by the parts the plan names, and count only a passed check as green.
C. C. Have --repo also read the target's committed rules from GitHub, so the plan repository can check a target's pull request without its worktree.

## What I had to decide

Whether the merge check should judge a pull request by the parts its changes reach as well as the parts its plan names, and whether reading a target repository's own rules belongs in this command or in the later slice that wires the targets.

## What I did meanwhile

Built omni flow check merge that way, with tests for each rule (approval, required checks, territory report and block, the open count, two merge methods, the default branch guard), and the merge command it prints with no flow is today's squash.

## What it costs to change later

A constant change in kit/lib/flow/merge-gate.ts and the check merge command in kit/bin/commands/flow.ts, with their tests: judging by the plan's parts alone, counting a skipped check as not green, or reading a target's own config is a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the rules of the slice's areas apply, not whether a change outside the territory brings its own area's rules: they do here, as the stricter reading.
- (author) A pull request whose head is no slice of a plan in the inbox is merged with its territory reported as unknown, and refused under territory: block.
- (author) The open count counts open sub-PRs into the same base whose slice, read from the plan, touches the area, this one included; one whose head is no slice is not counted.
- (author) --repo takes owner/name or a target's short name; the rules still come from this checkout's config, so in a target the command runs in the target's worktree, as the spec's section on several repositories asks. Reading the target's committed config from the plan repository is left to the slices that wire the targets.
- (author) omni help flow still lists show and verdict only: the help entries sit outside this slice's territory; the command's own usage line names check merge.

```

<!-- /omni-outbox-settled: s5-01-merge-gate-reading -->

<!-- omni-outbox-settled: s6-01-target-flow-copy-and-grading -->

## s6-01-target-flow-copy-and-grading — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s6
- Wave: 5
- Became: ADR-0074

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-target-flow-copy-and-grading
prd: 1089
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 5
---

## The question, in plain words

When a plan spans several repositories, where does the plan repository keep each target's own rules, which rules does a target without such a copy meet, and how is a target whose rules changed since then reported?

## The decision, in plain words

Each imported target's rules sit in a flow folder inside its copy, with its hook files beside them; a target with no copied rules is checked against the loop's usual rules only; and a target whose rules changed since they were copied is listed as out of date, the reason naming its rules.

## The intro, for fun

Three repositories walk into one plan, each carrying its own house rules.

## The punchline, for fun

Each now gets judged by its own rulebook, and a rulebook that changed gets flagged.

## The options, in plain words

A. A. Keep it: rules and hooks kept in the copy's flow folder, the usual rules for a target with no copied rules, rules read one repository at a time, and changed rules reported as an out-of-date target.
B. B. Grade a target with no copied flow against the plan repository's own flow, as before this slice.
C. C. Add a separate moved state to omni targets for a changed flow, apart from stale evidence.

## What I had to decide

Whether the copy's layout, the fallback for targets without a copied flow, the per-repository reading of rules across slices, and reporting a moved flow as an out-of-date target are what the team wants before the merge-wide skills follow them.

## What I did meanwhile

Built it that way: the copy holds flow/config.yml (the target's flow, landings and pr keys) and each hook file at its own path under flow/; omni plan check grades each repository's rows against its own flow, the plan repository's own rows against its own, and a target with no copied flow against the kit's defaults; omni flow show --repo reads the copy; omni targets reads an imported target stale with a 'flow moved since read at' detail when its committed flow or a hook file differs from the copy. To make the commands and the GitHub App use it, I changed a few files outside the slice's listed ground: the plan check and flow show commands, the App's inbox check (and its rebuilt bundle), and the two command test files.

## What it costs to change later

A constant change in kit/lib/plan-repo/copy-flow.ts, kit/lib/inbox/plan-grade.ts and kit/lib/plan-repo/targets.ts with their tests: another file name, grading targets without a copy against the plan repository's own flow, reading rules across repositories, or a separate moved state are each a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the copy lives under the copy's flow folder but not the file's name or how hook files are laid out: flow/config.yml and the hooks at their own repository paths under flow/ were chosen, and the mega-invade skill (slice s7) must write them that way.
- (author) The spec does not say what an own or none target's rows meet: the kit's defaults here, since the plan repository's areas name its own paths, not the target's.
- (author) Wave first, blocks all and landing alone now read the slices of one repository at a time; the spec does not say whether a target's kernel must come before slices of other repositories.
- (author) The done-when says moved; omni targets has no moved state, so the existing stale state carries it, its detail starting 'flow moved since read at'.
- (author) omni help flow still shows flow show without --repo: the help entries sit outside this slice's ground; the command's own usage line names it.

```

<!-- /omni-outbox-settled: s6-01-target-flow-copy-and-grading -->

<!-- omni-outbox-settled: s7-01-skill-points-placement -->

## s7-01-skill-points-placement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s7
- Wave: 6
- Became: ADR-0075

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-skill-points-placement
prd: 1089
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 6
---

## The question, in plain words

Where exactly do the loop's steps let a repository add its own instructions, which steps can never be swapped out, and what happens to a slice the merge check refuses?

## The decision, in plain words

The test point wraps the slice's own test runs while the full check before shipping always runs; a replacement way of opening pull requests applies to the main pull requests only, as the older setting did; and a slice the merge check refuses stays open, unlabelled, and is tried again on the next run.

## The intro, for fun

A repository asked to rewrite the rulebook, and the loop handed it a pencil with the safety page in ink.

## The punchline, for fun

It may add pages anywhere, but the safety chapter stays as it is.

## The options, in plain words

A. Keep it: the test point wraps the slice's test runs, the preflight and the merge gate are guards, a replace opener skips sub-PRs, and a refused merge waits unlabelled for the next run.
B. Let the test point replace the preflight too, so a repository can run only the slice's tests before shipping.
C. Let a replace opener open sub-PRs as well, and mark a refused merge stuck with the needs-fix label.

## What I had to decide

Whether the test point should also be able to replace the full check that runs before a slice ships, whether a replacement opener should open the small slice pull requests too, and whether a refused merge should wait quietly or be marked as stuck.

## What I did meanwhile

Wired every skill the catalog lists: do-work's test point wraps the test runs of its build step and its preflight stays a guard; pr.open's replace opens feature and standalone PRs only, the sub-PR claim keeps gh pr create with only before and after hooks, as pr.openWith did; wave merges only with the command omni flow check merge prints, and a not ok sub-PR is left open with no label, so the next run takes it as awaiting merge; plan.slice runs once per drafted row and plan.done after the PR opens.

## What it costs to change later

Small: a few sentences in kit/plugin/skills/do-work, pr and wave, and the regexes in kit/test/flow-points.test.ts; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's guard list does not name the preflight; it is kept a guard here so a replace hook cannot skip the check every sub-PR is graded by.
- (author) The spec does not say whether pr.open's replace opens a sub-PR; it does not here, so pr.openWith and pr.open.replace keep giving the same result (acceptance 10).
- (author) /omni:yolo-fix still finds the feature PR with --base and merges its rework sub-PRs with gh pr merge --squash: it is outside this slice's territory (settled item s2-01).
- (author) An input the CLI cannot fill without --prd and --slice ({prd}, {plan}, {pr}) is filled by the agent from the step, as each point's paragraph says.

```

<!-- /omni-outbox-settled: s7-01-skill-points-placement -->

<!-- omni-outbox-settled: s7-02-target-flow-read-in-clone -->

## s7-02-target-flow-read-in-clone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s7
- Wave: 6
- Became: ADR-0076

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-target-flow-read-in-clone
prd: 1089
slice: s7
rank: medium
bears-on: none
raised: 2026-10-06
wave: 6
---

## The question, in plain words

When the loop builds part of a feature in another repository, how does it read that repository's own rules without running its code, and what does it do when those rules changed since the plan was made?

## The decision, in plain words

The loop's own tool reads the other repository's rules from its local copy, never running that repository's code; a repository with no rules gets the usual ones; and rules that changed since planning are raised as a decision for a person, like any other change there.

## The intro, for fun

Visiting another house, the loop reads the rules pinned on its fridge, not the photo taken last month.

## The punchline, for fun

If the fridge note changed, it leaves a sticky note for the owner.

## The options, in plain words

A. Keep it: the plan repository's command reads each target's committed rules in its checkout, with a fallback to the usual rules and a decision raised when the rules moved.
B. Teach omni flow check merge and flow show to read a target's committed config from GitHub with --repo, and drop the step that runs inside the checkout.
C. Use the imported copy of each target's rules for building too, and refresh it before every run.

## What I had to decide

Whether reading a target's committed rules this way, by running the plan repository's command inside the target's checkout, is acceptable until the command can read a target's rules from GitHub directly.

## What I did meanwhile

In ultra-wave, do-work --target, pr --repo and ultra-yolo, a target's flow is read by the plan repository's omni run with the target's clone or slice worktree as its working directory; do-work --target calls flow show once per territory entry with --path; ultra-wave runs omni flow check merge there, the territory reading as unknown (reported, or refused under territory: block) since the target holds no plan; a target without a committed config is gated from the plan repository; ultra-yolo raises a medium <target>-flow-moved item for each target omni targets reports as flow moved; mega-invade writes the copy as flow/config.yml with hook files at their paths and redraws it on --sync; mega-brainstorm reads plan.slice from the copy as guidance only.

## What it costs to change later

Small: sentences in the ultra and target skills; a later CLI change letting omni flow check merge --repo read the target's committed config from GitHub would replace the cd step with one flag.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The guardrail says nothing runs in a target but its preflight; running the plan repository's own omni there reads files and runs none of the target's code, and the spec allows a target's hooks to be followed in its worktree.
- (author) omni flow check merge reads the slice's territory from the inbox of the repository it runs in: in a target there is none, so territory: block in a target refuses every sub-PR until the command learns to read the plan's territory with --repo.
- (author) A target with no committed config is gated from the plan repository, whose own areas then apply to the target's paths; with no flow in the plan repository that is the kit's default squash.
- (author) flow show --path takes one path, so a target slice with several territory entries calls it once per entry and follows each hook once.

```

<!-- /omni-outbox-settled: s7-02-target-flow-read-in-clone -->

<!-- omni-outbox-settled: s8-01-adr-number-and-guide-place -->

## s8-01-adr-number-and-guide-place — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s8
- Wave: 7
- Stays here: A local numbering and page-ordering choice, cheap to change, with no lasting product behaviour or architectural rationale to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-adr-number-and-guide-place
prd: 1089
slice: s8
rank: medium
bears-on: none
raised: 2026-10-06
wave: 7
---

## The question, in plain words

Which number does the new decision record take, now that the one the plan named is used, and where does the new guide page sit among the others?

## The decision, in plain words

The record takes the next free number on the main line, sixty-nine, and the new page sits right after the page on landings, which now points to it as the page to read next.

## The intro, for fun

The plan reserved seat sixty, and someone else was already sitting in it.

## The punchline, for fun

We took seat sixty-nine and left a note on the landings page saying where we went.

## The options, in plain words

A. A. Keep it: record 0069, and the flow page right after Landings, whose Next link points to it.
B. B. Keep record 0069, and put the flow page after Use cases, just before Troubleshooting.
C. C. Add a list of every record to the decision records' README, so the index the plan mentions exists.

## What I had to decide

Whether the record number sixty-nine and the guide page's place after Landings are what the team wants, given both touch ground the plan did not list.

## What I did meanwhile

Wrote .omni-loop/knowledge/adr/0069-a-repository-s-flow-may-replace-the-act-at-a-named-point-never-a-guard.md (main already holds 0060 to 0068), placed docs/guide/flow.md after landings in docs/guide/meta.json, and changed the Next link of docs/guide/landings.md, a file outside the slice's territory, to point to it. The ADR README holds no index, so it was left unchanged.

## What it costs to change later

A rename of one file and its two mentions, or moving one page in meta.json and its Next links with the guide tests; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names .omni-loop/knowledge/adr/0060-, written before 0060 to 0068 landed on main; the caller asked for the next free number.
- (author) Any new guide page changes the Next link of the page before it, so one file outside the territory changes whatever the place chosen.
- (author) The plan's done-when says the ADR index lists the record, but .omni-loop/knowledge/adr/README.md lists no record, so nothing was added there.

```

<!-- /omni-outbox-settled: s8-01-adr-number-and-guide-place -->
