# Settled outbox items — PRD 7

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-marketplace-settings-shapes -->

## s1-01-marketplace-settings-shapes — adopted

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
id: s1-01-marketplace-settings-shapes
prd: 7
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

What exact form must the repository settings take so that opening this repository offers the omni plugin?

## The decision, in plain words

The marketplace is registered by name, pointing at this repository as a local folder, and the plugin is switched on by its name and the marketplace name. This form was checked against the official reference and a real session start.

## The options, in plain words

A. Register the marketplace by name as a local folder source pointing at this repository, and switch the plugin on by name, the option built.
B. Point the settings at the marketplace file itself instead of at the folder.
C. Register nothing in the repository, and have each person add the marketplace by hand.

## What I had to decide

The shapes of `.claude-plugin/marketplace.json` and of the `extraKnownMarketplaces` / `enabledPlugins` entries in `.claude/settings.json` — the research disagreed (array or object; `directory` or `file` source).

## What I did meanwhile

Adopted the shapes the settings reference documents (https://code.claude.com/docs/en/settings-reference.md, `extraKnownMarketplaces` and `enabledPlugins`; and …/plugins/org.md, "Require plugins per repository"):

- `extraKnownMarketplaces` is an **object keyed by marketplace name**, each value `{ "source": { "source": "directory", "path": "./" } }`. `directory` takes a folder holding `.claude-plugin/marketplace.json`; `file` would take the path of that JSON file itself.
- `enabledPlugins` is an object `{ "omni@omni-loop": true }` (`<plugin>@<marketplace>`).
- `.claude-plugin/marketplace.json`: `name: "omni-loop"`, `owner.name`, `plugins: [{ name: "omni", source: "./kit/plugin" }]` — the entry name equals `plugin.json`'s `name`, as the docs require.

Verified by: `claude plugin validate kit/plugin` and `claude plugin validate .` (Claude Code 2.1.282) both print `✔ Validation passed with warnings` (the one warning: no `author`). Then a real load: a throwaway git repo holding copies of `.claude-plugin/`, `kit/plugin/` (plus a sample skill) and `.claude/settings.json`, with a throwaway `CLAUDE_CONFIG_DIR` whose `.claude.json` marks the folder trusted; one `claude -p` start (it stopped at "Not logged in", after the settings were applied) registered the marketplace — `claude plugin marketplace list` showed `omni-loop  Source: Directory (<repo>)`, `claude plugin list --json --available` listed `omni@omni-loop` with source `./kit/plugin`, and `claude plugin details omni@omni-loop` showed `omni 0.1.0 … Skills (1) hello`.

## What it costs to change later

Two JSON files (`.claude/settings.json`, `.claude-plugin/marketplace.json`); the plugin test guards the marketplace/plugin name agreement.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an interactive, logged-in session lists `/omni:<skill>` — the throwaway config had no login, so the listing itself was not seen; a person checks it once a skill lands in the main checkout.

```

<!-- /omni-outbox-settled: s1-01-marketplace-settings-shapes -->

<!-- omni-outbox-settled: s1-02-worktree-sessions-use-main-checkout -->

## s1-02-worktree-sessions-use-main-checkout — adopted

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
id: s1-02-worktree-sessions-use-main-checkout
prd: 7
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Which copy of the plugin does a session opened in a side working copy of this repository load?

## The decision, in plain words

It loads the plugin from the main working copy, whatever branch that copy is on, because the settings give a relative folder. This was kept, since an absolute folder would only work on one machine.

## The options, in plain words

A. Keep the relative folder, so every working copy loads the main copy's plugin, the option built.
B. Write an absolute folder, which only works on the machine it was written on.
C. Leave the settings out and load the plugin per session with a command-line flag.

## What I had to decide

The `path` of the `directory` marketplace source in `.claude/settings.json`: relative (`./`) or absolute.

## What I did meanwhile

Kept `"path": "./"`. The docs (…/plugins/org.md) say a relative `directory` or `file` path "resolves against your repository's main checkout. When you run Claude Code from a git worktree, the path still points at the main checkout."

Consequence for the dogfood: a wave subagent in a worktree runs the skills of the main checkout's current branch, not of its own branch; and until this slice reaches the branch the main checkout has out, a session there finds no `.claude-plugin/marketplace.json` and registers nothing. `claude --plugin-dir kit/plugin` loads a worktree's own copy when that matters.

## What it costs to change later

One line in `.claude/settings.json`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave skill will want a worktree to run its own branch's skills; nothing in the spec says so yet.

```

<!-- /omni-outbox-settled: s1-02-worktree-sessions-use-main-checkout -->

<!-- omni-outbox-settled: s1-03-prose-label-literals -->

## s1-03-prose-label-literals — adopted

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
id: s1-03-prose-label-literals
prd: 7
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the guard against repository-specific words in skill text also catch a label name written in plain text?

## The decision, in plain words

No, for now the skill text is checked with exactly the same patterns as the code, as asked. A label name written without quotes therefore passes.

## The options, in plain words

A. Check skill text with exactly the code's patterns, the option built.
B. Also forbid the default label names written without quotes, in skill text only.

## What I had to decide

Which patterns `kit/test/no-literals.test.mjs` applies to `kit/plugin/**/*.md`.

## What I did meanwhile

Applied the same `FORBIDDEN` list to skill prose; a Markdown provenance line (`<!-- Ported from vertuo-ai-domain@… -->`) is exempt like a `// Ported from` line.

The label patterns are `'outbox:go'` and `'pr:feature'` — quoted, as they would appear in JS. In prose a label is written `` `outbox:go` ``, which these patterns do not catch (the fixture in the test pins that behaviour). The `vertuo` and `docs/` patterns do catch prose.

## What it costs to change later

Two regexes in `kit/test/no-literals.test.mjs`, and one fixture line flipped.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a skill will ever legitimately need to write a label name in prose (for example, to explain a default) rather than read it through the config command.

```

<!-- /omni-outbox-settled: s1-03-prose-label-literals -->

<!-- omni-outbox-settled: s1-04-plugin-metadata -->

## s1-04-plugin-metadata — adopted

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
id: s1-04-plugin-metadata
prd: 7
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

What name, version and author details should the new plugin and its marketplace carry?

## The decision, in plain words

The marketplace is named after the loop, and the plugin starts at an early version with no author and no skills yet. The validator accepts that, warning only about the missing author.

## The options, in plain words

A. Name the marketplace after the loop, start the plugin at an early version, name no author and add no placeholder skill, the option built.
B. Add an author naming the company, and validate in strict mode.
C. Add a placeholder skill so the plugin is never empty.

## What I had to decide

The marketplace `name`, the plugin `version`, whether `plugin.json` names an `author`, and whether the empty plugin needs a placeholder skill.

## What I did meanwhile

- Marketplace `name: "omni-loop"` (settings key and `enabledPlugins` id `omni@omni-loop` follow it); `owner.name` is the GitHub organisation, since that file is this repository's own and outside `kit/`.
- `plugin.json`: `name: "omni"`, `version: "0.1.0"`, a description, **no `author`** — any author would be a repository literal inside `kit/`. `claude plugin validate` passes with that one warning, so the plugin test runs it without `--strict`.
- No placeholder skill: `claude plugin validate kit/plugin` passes with zero skills.

## What it costs to change later

A few fields in two JSON files, plus the settings key and `enabledPlugins` id if the marketplace is renamed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the kit will one day be published beyond this organisation, which would decide what author it should name.

```

<!-- /omni-outbox-settled: s1-04-plugin-metadata -->

<!-- omni-outbox-settled: s2-02-always-runs-the-recording-policy -->

## s2-02-always-runs-the-recording-policy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-always-runs-the-recording-policy
prd: 7
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should the command only run the recording policy when the file names a risk, or run it every time and let the safe defaults speak for a file that names none?

## The decision, in plain words

It always runs the recording policy, even for a file that names no risk at all, because every one of that policy's own inputs already has a safe default.

## The options, in plain words

A. Run the recording policy on every file, filling in its safe defaults, the option built.
B. Let a file name its own rank directly and skip the recording policy entirely when it does.

## What I had to decide

How a plain decision file, one naming no risk and no rank, still ends up with a rank.

## What I did meanwhile

The recording policy runs on every file, filling in its own safe defaults for whatever the file leaves out, rather than only running when a rank is missing.

## What it costs to change later

One condition to add back, guarding the policy call, if a later reviewer wants a file to be able to name its own rank directly instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the instruction naming this policy said it applies only when the file carries what it needs, and every one of that policy's inputs already defaults safely, so nothing rules out running it on every file

```

<!-- /omni-outbox-settled: s2-02-always-runs-the-recording-policy -->

<!-- omni-outbox-settled: s3-01-matchby-narrows-not-replaces-branch-match -->

## s3-01-matchby-narrows-not-replaces-branch-match — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-matchby-narrows-not-replaces-branch-match
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When deciding which pull request belongs to a slice, should the base-branch-or-label setting be the only rule, or just an extra check alongside matching the branch name itself?

## The decision, in plain words

The branch name always has to match the slice first; the base-branch-or-label setting is only an extra check on top of that, not a replacement for it.

## The options, in plain words

A. Keep the base-branch-or-label setting as a secondary filter alongside the head-branch match (what was built).
B. Make the base-branch-or-label setting the only rule, matching a slice by base branch or label alone, without checking the head branch name at all.

## What I had to decide

How `board.matchBy` (base vs label) combines with matching a pull request's head branch to a slice.

## What I did meanwhile

Treated `matchBy` as a secondary filter alongside an exact head-branch match, rather than the only way to find a slice's pull request — matching by branch name already ties a pull request to exactly one slice, so `matchBy` only narrows an ambiguity, it does not replace the branch check.

## What it costs to change later

Changing which check wins is a small, local change to the matching function; no stored data or file format changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec nor the plan says whether `matchBy` is the sole matching rule or a secondary filter alongside the head branch.

```

<!-- /omni-outbox-settled: s3-01-matchby-narrows-not-replaces-branch-match -->

<!-- omni-outbox-settled: s3-03-unknown-head-commit-date-reads-as-not-stale -->

## s3-03-unknown-head-commit-date-reads-as-not-stale — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-unknown-head-commit-date-reads-as-not-stale
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a pull request's head commit date cannot be read at all, should the board assume the claim has moved on so it is never called stale, or assume it has not so an old, quiet draft still gets flagged?

## The decision, in plain words

An unknown head commit date is treated as if the claim had moved on, so the slice is never marked stale on that signal alone.

## The options, in plain words

A. Missing head commit date reads as "moved on", so the slice is never marked stale on this signal alone (what was built).
B. Missing head commit date reads as no commit since the claim, so an old, untouched draft can still go stale even without this signal.

## What I had to decide

What the claimed-stale check does when a pull request payload carries no head commit date at all.

## What I did meanwhile

Read a missing head commit date as "assume it has moved on" — the safer direction, since this state exists to let the kit reclaim a cold claim on its own, and reclaiming a claim on a signal that was never actually confirmed risks taking work out from under someone still building it.

## What it costs to change later

Flipping the fallback is a small, local change with no format change; it only matters when a head commit date genuinely could not be read for an old, open draft.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The task names the head commit date as available only "if available", without saying what to assume when it is not; a first pass assumed the opposite (unknown counts as stale) before this round settled it the other way.

```

<!-- /omni-outbox-settled: s3-03-unknown-head-commit-date-reads-as-not-stale -->

<!-- omni-outbox-settled: s3-04-one-pr-per-slice-merged-then-freshest -->

## s3-04-one-pr-per-slice-merged-then-freshest — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-one-pr-per-slice-merged-then-freshest
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When more than one pull request matches the same slice, for example an old attempt plus a new one, which one should the board actually show?

## The decision, in plain words

A merged pull request always wins; otherwise the most recently updated one does.

## The options, in plain words

A. Merged wins, then most recently updated (what was built).
B. Always take the most recently opened pull request, merged or not.
C. Refuse to pick and report every candidate as a conflict for a person to resolve.

## What I had to decide

How to pick a single pull request for a slice when its branch name matches more than one candidate.

## What I did meanwhile

Preferred a merged match over any open one, and the most recently updated one among ties — a slice can only be building towards one outcome at a time, and a merge is the more final signal.

## What it costs to change later

Changing the tie-break rule is local to the one selection function; nothing downstream depends on which candidate was dropped.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the plan or spec says a slice's branch name could ever match more than one pull request, or how to choose when it does.

```

<!-- /omni-outbox-settled: s3-04-one-pr-per-slice-merged-then-freshest -->

<!-- omni-outbox-settled: s4-01-status-comment-marker -->

## s4-01-status-comment-marker — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-status-comment-marker
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

How should the agent find its own status comment on a pull request, so it rewrites that one and never another?

## The decision, in plain words

It looks for a hidden marker built from the configured marker prefix, and rewrites the first comment that carries it, or posts a new one when none does. Because the marker shares the outbox prefix, the reply reader already ignores it.

## The options, in plain words

A. Match the marker alone, first comment wins, the option built.
B. Match the marker and the configured bot user, so a pasted marker is never overwritten.
C. Add an omni command that upserts the status comment, and have the skill call it.

## What I had to decide

The status comment's marker and how `/omni:pr` upserts it, replacing upstream's `gh pr comment --edit-last`.

## What I did meanwhile

The marker is `<!-- <markers.prefix>-status -->`. The skill lists the PR's issue comments with `gh api ... --paginate --jq`, takes the first whose body contains the marker, and PATCHes it; otherwise `gh pr comment --body-file`. It does not filter by author. Sharing the prefix means `kit/lib/outbox/replies.mjs` skips it (it drops comments containing `markers.any`), so a status comment is never read as a reply.

## What it costs to change later

A few lines of `kit/plugin/skills/pr/SKILL.md`; existing comments with the old marker would be orphaned and a new one posted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a second agent or a person might paste the marker into a comment, which an author filter on `github.user` would guard against.
- Whether a later `omni` command should own the upsert instead of skill prose.

```

<!-- /omni-outbox-settled: s4-01-status-comment-marker -->

<!-- omni-outbox-settled: s4-02-checks-without-aggregate -->

## s4-02-checks-without-aggregate — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-checks-without-aggregate
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the repository has no branch protection and names no single summary check, which checks decide that a pull request is green?

## The decision, in plain words

Every check the pull request reports counts, except the outbox check, which is handled on its own. With a named summary check, only that one and the outbox check count.

## The options, in plain words

A. Every reported check except the outbox check counts, the option built.
B. Only the outbox check counts, so a repository without a summary check has no CI gate for agents.
C. Refuse to finish and report a human step asking for a summary check to be configured.

## What I had to decide

What `/omni:pr` counts as green when `ci.branchProtection` is false and `ci.aggregateCheck` is null (this repository's own case).

## What I did meanwhile

The lifecycle reads `gh pr checks <n> --json name,state,bucket`; with `ci.aggregateCheck` null, every reported check except `ci.outboxContext` stands in for it. An empty check list is read as a conflict, as upstream did.

## What it costs to change later

One paragraph of `kit/plugin/skills/pr/SKILL.md`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether repositories without an aggregate check run optional checks that should never block an agent.

```

<!-- /omni-outbox-settled: s4-02-checks-without-aggregate -->

<!-- omni-outbox-settled: s4-03-outbox-check-red-is-the-gate -->

## s4-03-outbox-check-red-is-the-gate — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-outbox-check-red-is-the-gate
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When the only red check on a pull request is the outbox check, should the agent try to fix it like any failing check?

## The decision, in plain words

No, the agent asks the kit for the outbox status and stops when only questions for a person remain, since that red check is the gate working. It never counts that as a failed attempt and never adds the override label.

## The options, in plain words

A. Stop and report when only person-answered items remain, the option built.
B. Treat it as any red check, counting attempts and ending in the needs-fix label.

## What I had to decide

How `/omni:pr` treats a red `ci.outboxContext`, which upstream folded into its single aggregate check.

## What I did meanwhile

A lifecycle row: only `ci.outboxContext` red → run `omni status <prd>`; red only for items a person must answer means say so in the status comment and stop; anything else is fixed through the outbox, never by `labels.outboxGo`. This matches spec §2 (`/omni:yolo` ends with the gate red when items are open).

## What it costs to change later

One table row of `kit/plugin/skills/pr/SKILL.md`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a stopped PR in this state should keep the in-progress label or drop it.

```

<!-- /omni-outbox-settled: s4-03-outbox-check-red-is-the-gate -->

<!-- omni-outbox-settled: s4-04-one-rerun-without-triage-page -->

## s4-04-one-rerun-without-triage-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-one-rerun-without-triage-page
prd: 7
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Without a written list of known flaky failures, when may the agent simply re-run a failed check instead of changing code?

## The decision, in plain words

Once per pull request, when the failure is plainly not the branch's doing, such as a runner, network or timeout failure in code the branch did not touch. That re-run still counts as one attempt.

## The options, in plain words

A. One re-run per PR when the failure is plainly unrelated, the option built.
B. No re-runs at all; every red check is fixed in code.
C. Add a config key naming a triage page, and allow a re-run only on a signature it lists.

## What I had to decide

The re-run rule of `/omni:pr`, since upstream's rule depended on its CI-triage page, which does not exist here.

## What I did meanwhile

On red: read `gh run view --log-failed`, compare against the branch's changed files since its merge base, allow one `gh run rerun --failed` per PR when unrelated, counted toward `limits.attempts`.

## What it costs to change later

One list in `kit/plugin/skills/pr/SKILL.md`; a config key if a triage page is wanted later.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether repositories adopting the kit will want a configured triage page, the way upstream had one.

```

<!-- /omni-outbox-settled: s4-04-one-rerun-without-triage-page -->

<!-- omni-outbox-settled: s5-01-in-wave-input -->

## s5-01-in-wave-input — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-in-wave-input
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

How does the slice builder know whether it is running on its own or as part of a wave, since that changes whether it settles routine decisions itself?

## The decision, in plain words

It is told explicitly: the wave passes a flag, and without that flag the builder assumes it runs alone and settles routine decisions on the spot.

## The options, in plain words

A. An explicit in-wave flag, absent by default so a lone run adopts, the option built.
B. An explicit adopt flag instead, off by default so nothing is adopted unless asked.
C. Infer it from context, as upstream did, with no flag at all.

## What I had to decide

The name and default of the input that switches do-work between running alone (medium items adopted with --adopt, full /omni:pr lifecycle) and running under /omni:wave (no --adopt, stop once the sub-PR is open, return the result shape). Built as `--in-wave`, absent by default.

## What I did meanwhile

Built `--in-wave` as the explicit input in kit/plugin/skills/do-work/SKILL.md; absent means alone.

## What it costs to change later

A rename of one flag in two skills (do-work and wave), no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person running do-work by hand would rather have medium items left open for review by default, as the wave does (author).

```

<!-- /omni-outbox-settled: s5-01-in-wave-input -->

<!-- omni-outbox-settled: s5-02-claim-first-alone -->

## s5-02-claim-first-alone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-claim-first-alone
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a person runs the slice builder by hand, should it first put up a draft pull request to show the slice is taken?

## The decision, in plain words

Yes: running alone, it opens the draft claim before building, so the rule that every slice is claimed first holds however the slice is started.

## The options, in plain words

A. Open the draft claim first when running alone, the option built.
B. Never claim from do-work; the claim is only ever the wave's job.
C. Claim only when the person asks for it.

## What I had to decide

Whether do-work, run alone, opens the draft sub-PR (the claim) through /omni:pr before building. Upstream left the claim to the wave; the spec's rule 6 says claim first for every skill.

## What I did meanwhile

Built it: step 1 of do-work opens the draft claim through /omni:pr when running alone and none exists; under --in-wave the wave has already claimed.

## What it costs to change later

One sentence in the skill; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a hand run is ever meant to stay private until pushed (author).

```

<!-- /omni-outbox-settled: s5-02-claim-first-alone -->

<!-- omni-outbox-settled: s5-03-drop-model-sizing -->

## s5-03-drop-model-sizing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-drop-model-sizing
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Should the slice builder keep the upstream advice on picking a cheaper model when it hands work to helpers?

## The decision, in plain words

No: a slice is built by one agent, and the wave already runs it two levels deep, so handing work further down is not something it should do.

## The options, in plain words

A. Drop the section, the option built.
B. Keep it only for a lone run, never under a wave.
C. Keep it as upstream wrote it.

## What I had to decide

Whether to port upstream's 'Right-Size The Model (When Delegating)' section into do-work.

## What I did meanwhile

Dropped it and recorded the drop in kit/porting/plugin--do-work.md.

## What it costs to change later

Re-adding one section of prose.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a hand-run do-work on a large slice should still be allowed to delegate (author).

```

<!-- /omni-outbox-settled: s5-03-drop-model-sizing -->

<!-- omni-outbox-settled: s5-04-wave-result-shape -->

## s5-04-wave-result-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-wave-result-shape
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

What does the slice builder hand back to the wave when it finishes, so the wave can decide what to merge?

## The decision, in plain words

The same short summary upstream used: the slice, whether it is done, stopped or blocked, its branch and pull request, whether its checks passed, and the decisions and risks it raised.

## The options, in plain words

A. Upstream's shape, with a none value for a repository with no preflight, the option built.
B. Upstream's shape plus a list of checks that did not run.
C. Free text only, parsed by the wave.

## What I had to decide

The result shape do-work returns under --in-wave, which /omni:wave (s8) consumes: kept upstream's { slice, status, branch, prUrl, preflight, summary, risks, items }, with preflight as green | red | none.

## What I did meanwhile

Wrote that shape into the skill's Under --in-wave section; s8 reads it.

## What it costs to change later

Changing the shape in do-work and wave together; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the wave also wants the checks that did not run as a field rather than in the summary (author).

```

<!-- /omni-outbox-settled: s5-04-wave-result-shape -->

<!-- omni-outbox-settled: s7-01-acceptance-from-scope-and-seams -->

## s7-01-acceptance-from-scope-and-seams — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-acceptance-from-scope-and-seams
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The planner must stop and ask when a PRD's acceptance criteria are missing, but our PRD write-ups often have no section by that name. What counts as acceptance criteria?

## The decision, in plain words

A PRD with no acceptance section still passes when its scope and test seams let every piece of work have a clear, checkable finish line. It stops and asks only when that finish line cannot be written.

## The options, in plain words

A. Acceptance section, else scope and test seams, graded by whether every slice's done-when is observable
B. Require a heading named Acceptance criteria in every spec; stop without it
C. Never stop; write the plan and raise the gap as an outbox item

## What I had to decide

Whether /omni:plan may read scope and test seams as acceptance criteria when the spec has no acceptance section, or must stop on every spec that lacks one.

## What I did meanwhile

The skill reads the acceptance section, else scope and test seams, and stops only when a slice's "done when" cannot be written as an observable condition.

## What it costs to change later

One paragraph of the skill; a later spec template with a mandatory acceptance section would make the fallback unused.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's own §2.1 does not say what a spec file must contain; PRD 7's spec has no acceptance section. (author)

```

<!-- /omni-outbox-settled: s7-01-acceptance-from-scope-and-seams -->

<!-- omni-outbox-settled: s7-02-one-slice-still-a-sub-pr -->

## s7-02-one-slice-still-a-sub-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-one-slice-still-a-sub-pr
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a PRD is small enough to be one piece of work, should it still go through a separate sub-change, or be built straight on the feature branch?

## The decision, in plain words

Even a one-piece PRD gets its own sub-change into the feature branch. That keeps a single path for building, checking and merging work.

## The options, in plain words

A. Always a sub-PR, one slice or many
B. A lone slice is built on the feature branch and the feature PR is its PR (upstream)

## What I had to decide

Whether a one-slice plan skips the sub-PR (upstream) or keeps it.

## What I did meanwhile

Every slice is a sub-PR, even when the plan has one slice, because /omni:do-work and /omni:wave only know the sub-PR path.

## What it costs to change later

One extra branch and PR for tiny PRDs; reverting means a one-slice path in do-work, wave and board.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Upstream built a lone slice on the feature branch; nothing in PRD 7's spec says which to keep. (author)

```

<!-- /omni-outbox-settled: s7-02-one-slice-still-a-sub-pr -->

<!-- omni-outbox-settled: s7-03-feature-pr-opened-claimed-not-watched -->

## s7-03-feature-pr-opened-claimed-not-watched — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-03-feature-pr-opened-claimed-not-watched
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

After the planner opens the draft feature change, should it stay and watch it, and what does its status say?

## The decision, in plain words

The planner opens the draft, says it is claimed with no pieces merged yet, and stops. The delivery run picks it up from there.

## The options, in plain words

A. Status claimed, stop, hand to /omni:yolo
B. Enter /omni:pr's lifecycle loop and watch until green (a draft runs no CI)
C. A new status state such as planned, added to /omni:pr

## What I had to decide

Whether /omni:plan leaves the feature PR with status claimed and stops, or enters /omni:pr's watch loop.

## What I did meanwhile

State claimed, slices 0 of total merged, labels as /omni:pr's feature kind; no check loop, never marked ready; /omni:yolo carries it on.

## What it costs to change later

A word in the status comment and one sentence in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- /omni:pr's state list has no plan-time state; claimed was chosen as the nearest. (author)

```

<!-- /omni-outbox-settled: s7-03-feature-pr-opened-claimed-not-watched -->

<!-- omni-outbox-settled: s7-04-existing-plan-kept -->

## s7-04-existing-plan-kept — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-04-existing-plan-kept
prd: 7
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

If a plan already exists for the PRD, for instance from the idea-to-PRD step, should the planner rewrite it or keep it?

## The decision, in plain words

It keeps the existing plan and changes only what the slicing rules and the plan check require. Work someone already reviewed is not thrown away.

## The options, in plain words

A. Keep an existing plan, repair only what the check or slice rules need
B. Always write a fresh plan over it
C. Stop and ask when a plan already exists

## What I had to decide

Whether /omni:plan keeps and repairs an existing plan.md, or always writes a fresh one.

## What I did meanwhile

An existing plan.md is kept and changed only as far as the slice rules and omni plan check require.

## What it costs to change later

One sentence in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- /omni:brainstorm (s11) is not built yet; whether it writes plan.md itself or follows /omni:plan is open. (author)

```

<!-- /omni-outbox-settled: s7-04-existing-plan-kept -->

<!-- omni-outbox-settled: s8-01-territory-graded-in-prose -->

## s8-01-territory-graded-in-prose — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-territory-graded-in-prose
prd: 7
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the wave merges a slice, how does it tell whether the slice stayed on the ground the plan gave it?

## The decision, in plain words

The wave itself compares the files the slice changed with the ground the slice declared, and only reports a stray file. A dedicated command could take this over later.

## The options, in plain words

A. Compare in the skill prose, report and never fail (built).
B. Add a territory subcommand to the check command in a follow-up slice, over the existing pure grader, and switch the skill to it.
C. Drop the per-slice check and rely on the plan check alone.

## What I had to decide

Upstream graded one slice's diff with a script (check-territory). The kit has the pure function territoryVerdict in kit/lib/inbox/territory.mjs, but no CLI exposes it, and s8's territory is the skill only. Either the skill does the comparison in prose, or a new `omni check territory` command is added.

## What I did meanwhile

The skill reads `gh pr diff <n> --name-only` and the slice row's `territory` from `omni board <prd> --json`; a path is inside when it starts with a territory entry or sits under the PRD's outbox dir. A breach is reported and the merge goes on. `omni plan check <prd>` runs once before merging.

## What it costs to change later

Low: adding the command later replaces one step of prose; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Spec §2.1 rule 3 (policy lives in code) argues for a CLI; no slice in PRD 7's plan owns it. (author)
- The prose rule counts the outbox dir as always inside; territoryVerdict does not know about it. (author)

```

<!-- /omni-outbox-settled: s8-01-territory-graded-in-prose -->

<!-- omni-outbox-settled: s8-02-wave-asks-nothing -->

## s8-02-wave-asks-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-wave-asks-nothing
prd: 7
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should the wave stop to ask a person about a serious decision a slice made, while that person might still be at the keyboard?

## The decision, in plain words

The wave never asks. It records every decision, accepts the minor ones and lists the serious ones for a person to answer on the pull request.

## The options, in plain words

A. Never ask; record and report (built).
B. Take an optional policy input, and ask about high and human-action items when it says so.
C. Ask when run directly by a person, never under /omni:yolo.

## What I had to decide

Upstream vertuo-parallel-wave carried a consultation policy: under vertuo-deliver it asked about high and human-action items in the prompt and settled the answers on the spot. PRD 7 ships only /omni:yolo, which asks nothing; /omni:deliver is out of scope (spec §4).

## What I did meanwhile

The consultation policy is dropped. High and human-action items stay open and are listed in the wave's report; the gate on the feature PR is where they are answered.

## What it costs to change later

Low: a later /omni:deliver can ask after the wave returns, from the report's items, without changing this skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person running /omni:wave directly would want to be asked is not settled by the spec. (author)

```

<!-- /omni-outbox-settled: s8-02-wave-asks-nothing -->

<!-- omni-outbox-settled: s8-03-adopt-then-check-on-feature-branch -->

## s8-03-adopt-then-check-on-feature-branch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-03-adopt-then-check-on-feature-branch
prd: 7
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

After a wave merges, in which order does it accept the minor decisions and run the final checks, and where does that change go?

## The decision, in plain words

The wave first accepts the minor decisions in one change made straight on the shared feature line, then runs the full checks once over everything. One check pass then covers both the merged work and the accepted decisions.

## The options, in plain words

A. Adopt, commit on the feature branch, then check once (built).
B. Check, adopt, commit, then check again.
C. Adopt through a small sub-PR of its own.

## What I had to decide

The brief lists the full preflight and `omni check all` on the feature branch first, then adopting medium items and committing. Adopting changes settled.md and removes item files, which the outbox guard inside `omni check all` grades too.

## What I did meanwhile

Step 5 runs `omni adopt <file>` for each medium item a merged slice returned, commits once directly on the feature branch (no PR), then runs the preflight, `commands.checks` and `omni check all`, then pushes. A refused adoption stays open and is reported.

## What it costs to change later

Low: reordering is a prose edit, and the commit reverts cleanly on the feature branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Committing directly on the feature branch, with no sub-PR, mirrors what PRD 7's human orchestrator did after wave 2; no written rule states it. (author)

```

<!-- /omni-outbox-settled: s8-03-adopt-then-check-on-feature-branch -->

<!-- omni-outbox-settled: s13-01-item-new-json-shape-and-input-flag-rename -->

## s13-01-item-new-json-shape-and-input-flag-rename — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s13
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s13-01-item-new-json-shape-and-input-flag-rename
prd: 7
slice: s13
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Once the outcome flag needed the name a caller already used for its input file, what should the input file's own flag be called, and should a bad option be caught before anything is written?

## The decision, in plain words

Two decisions, taken together: the input file flag is renamed so the outcome flag can keep the shorter name, and a raised item is now graded the same way the outbox check grades one, before anything is written or adopted.

## The options, in plain words

A. Rename the input file flag and give the outcome flag the shorter name, the option built.
B. Keep the input file flag's old name and give the outcome flag a longer, different name instead.

## What I had to decide

What the input file's own flag should be called once the outcome flag needs the name it used to hold, and whether a raised item should be graded before it is written or adopted.

## What I did meanwhile

Two decisions, side by side. First, the input file flag is renamed, and the outcome flag prints one JSON object with the outcome, the rank, the id, the file, whether it was adopted, and a reason. Second, a rendered item is now graded the same way the outbox check grades one, before anything is written or adopted, so a bad option or a below-floor rank is caught at the source.

## What it costs to change later

A caller still using the old input-file spelling gets a plain usage message naming what is missing, not the written item it expected; nothing is silently lost, but nothing is recorded either until that caller is updated to the new spelling.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a future caller would rather keep the old input flag name and give the outcome flag a different one instead

```

<!-- /omni-outbox-settled: s13-01-item-new-json-shape-and-input-flag-rename -->

<!-- omni-outbox-settled: s9-01-gate-red-stays-draft -->

## s9-01-gate-red-stays-draft — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s9
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-gate-red-stays-draft
prd: 7
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

When the build finishes but questions are still open, should the finished work be put up for review as ready, or stay a draft?

## The decision, in plain words

It stays a draft, with every open question posted on it. It becomes ready only once nothing is open and the work has been filed as shipped.

## The options, in plain words

A. Stay draft while the gate is red; ready only after ship (built).
B. Mark ready with the gate red, as upstream did, and ship later in yolo-fix; rule 7 would then apply to the merge, not to ready.
C. Mark ready with the gate red but add the needs-fix label so nobody merges it.

## What I had to decide

Upstream yolo marked the feature PR ready and stopped with the outbox check red, as its expected end state. Spec section 2.1 rule 7 (ship before ready) says ready comes only after omni ship, which refuses while items are open. Spec section 2's table row for yolo first said it ends ready with the gate red; commit ee15122 aligned it with rule 7.

## What I did meanwhile

The skill leaves the feature PR in draft when omni status is red, posts the questions with omni comment --pr, and reports that a person answers on the PR then runs yolo-fix. gh pr ready runs only on the green path, after ship is committed and pushed.

## What it costs to change later

Low: one paragraph of skill prose. The only effect is whether CI runs on the feature PR before the questions are answered.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Spec section 2's yolo row contradicted rule 7 until ee15122; upstream's ready-with-a-red-gate remains the alternative a reviewer may prefer. (author)
- A draft PR gets no CI run, so the feature is graded only by the local preflight until yolo-fix ships it. (author)

```

<!-- /omni-outbox-settled: s9-01-gate-red-stays-draft -->

<!-- omni-outbox-settled: s9-02-default-branch-conflict-to-a-person -->

## s9-02-default-branch-conflict-to-a-person — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s9
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-default-branch-conflict-to-a-person
prd: 7
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

When the finished work clashes with changes made meanwhile on the main line, should the robot sort out the clash itself or hand it to a person?

## The decision, in plain words

It sorts out clashes it is confident about, and hands any other to a person, leaving the work as a draft marked stuck.

## The options, in plain words

A. Resolve when confident, otherwise abort and hand to a person (built).
B. Always abort on any conflict and hand to a person.
C. Always resolve, as upstream did, and only go stuck when the preflight stays red.

## What I had to decide

Upstream yolo always merged the default branch into the feature branch at the finish and resolved any conflict inline. The pr skill resolves a conflicting PR itself, but leaves a merely behind PR into the default branch to a person. The dispatch for this slice said conflicts go to a person.

## What I did meanwhile

The finish step merges the default branch only when the feature branch is behind; a conflict it cannot resolve with confidence is aborted and the feature PR takes the pr skill's Stuck path naming the conflicting files.

## What it costs to change later

Low: one step of prose; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Confident is a judgement call; there is no kit rule for it. (author)

```

<!-- /omni-outbox-settled: s9-02-default-branch-conflict-to-a-person -->

<!-- omni-outbox-settled: s9-03-gate-without-changes -->

## s9-03-gate-without-changes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s9
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-03-gate-without-changes
prd: 7
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 5
---

## The question, in plain words

Before filing the work as shipped, should the final check also look for risky changes nobody explained, or only for open questions?

## The decision, in plain words

It looks only for open questions and for decisions that still need rework. Risky changes are already checked slice by slice while each piece is built.

## The options, in plain words

A. Gate on open items and unreworked drift only (built).
B. Gate with the changes range too, so unaccounted risky changes hold the ready step.

## What I had to decide

omni status can also grade unaccounted risky changes against the default branch (--changes or --base). Spec rule 7 names only open items and unreworked drift. Each slice runs omni check coverage before its sub-PR.

## What I did meanwhile

The gate is omni status with no range flag.

## What it costs to change later

Low: adding a flag to one command line in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the CI outbox workflow (not built yet) will pass a range, which would make the local gate and CI disagree. (author)

```

<!-- /omni-outbox-settled: s9-03-gate-without-changes -->

<!-- omni-outbox-settled: s10-01-reworks-driven-by-yolo-fix -->

## s10-01-reworks-driven-by-yolo-fix — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s10
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-reworks-driven-by-yolo-fix
prd: 7
slice: s10
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

When a person's answers mean some built decisions must be redone, should the fix step run that rework itself, or should the wave step be taught to run rework work too?

## The decision, in plain words

The fix step runs the rework itself, following the same claim, build and merge steps the wave step uses, because the wave step only knows the slices written in the plan.

## The options, in plain words

A. The fix step applies the wave step's claim, build and merge steps to the rework rows itself.
B. Teach the wave step and the board to take rework rows, and have the fix step invoke the wave step.
C. Write the reworks into the plan as extra slices, so the ordinary wave step picks them up.

## What I had to decide

Whether /omni:yolo-fix drives its rework slices by applying /omni:wave's steps 2 to 5 to the rows `omni rework plan --json` returns, or whether /omni:wave (or `omni board`) should learn to take a rework plan so the fix skill can simply invoke it, as upstream invoked its parallel-wave skill with a plan path.

## What I did meanwhile

kit/plugin/skills/yolo-fix/SKILL.md step 5 claims each rework through /omni:pr, dispatches one worktree subagent per rework with the item's brief, and merges and checks each wave exactly as /omni:wave sections 4 and 5 do, reading territory from each rework row.

## What it costs to change later

Prose only: rewrite step 5 of kit/plugin/skills/yolo-fix/SKILL.md to invoke /omni:wave once that skill (and `omni board`) accept rework rows; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether `omni board` should grow a rework mode was not explored (author).

```

<!-- /omni-outbox-settled: s10-01-reworks-driven-by-yolo-fix -->

<!-- omni-outbox-settled: s10-02-settle-sub-pr-branch-name -->

## s10-02-settle-sub-pr-branch-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s10
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-02-settle-sub-pr-branch-name
prd: 7
slice: s10
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

The answers a person gives on the feature pull request are recorded through a small separate pull request. What should its branch be called?

## The decision, in plain words

It is named like a slice branch, with the word settle in place of a slice number, so it sits beside the other slice branches of the same feature.

## The options, in plain words

A. Name it like a slice branch, with settle as the slice.
B. Add its own branch template to the configuration.

## What I had to decide

The branch name of /omni:yolo-fix's settle sub-PR: `branches.slice` with `{slice}` = `settle`, or a dedicated `branches.settle` template in config.

## What I did meanwhile

kit/plugin/skills/yolo-fix/SKILL.md step 3 cuts `branches.slice` filled with the topic and `settle`; the branch is deleted on merge, so a later run reuses the same name.

## What it costs to change later

One sentence in kit/plugin/skills/yolo-fix/SKILL.md, or a new `branches.settle` key in the config schema plus that sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a plan could ever name a slice `settle` and collide was not checked (author).

```

<!-- /omni-outbox-settled: s10-02-settle-sub-pr-branch-name -->

<!-- omni-outbox-settled: s11-01-before-after-always-written -->

## s11-01-before-after-always-written — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s11
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-01-before-after-always-written
prd: 7
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

When a change has nothing anyone can see, like a guard or a setting, should the idea still come with its today-and-after page?

## The decision, in plain words

Yes, always. A change with nothing visible gets a short page saying what changes and what stays the same, so the review packet always has the same three parts.

## The options, in plain words

A. Always write the page; a short text one when nothing is visible (built).
B. Add a flag to omni phase0 so a page-less PRD passes, and write no page as upstream did.
C. Write no page and accept the phase-0 check's not ok for that one missing kind.

## What I had to decide

Upstream brainstorming wrote no before/after page for a change with nothing to show, and said so. The kit's phase-0 command (omni phase0) grades a phase-0 pull request with phase0Verdict at its default needsBeforeAfter: true and offers no flag to turn it off, so a page-less phase-0 PR prints not ok. The skill cannot both follow upstream and leave the check green.

## What I did meanwhile

Step 5 of the brainstorm skill always writes before-after.html; for nothing visible it is a short today-beside-after page. The Handoff's Before/after line is always the repository path, never none.

## What it costs to change later

A constant: if the answer is B, omni phase0 gains a --no-before-after flag passing needsBeforeAfter: false, and step 5 goes back to writing no page and the Handoff saying none.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether reviewers find a text-only page useful or noise has not been tried (author).

```

<!-- /omni-outbox-settled: s11-01-before-after-always-written -->

<!-- omni-outbox-settled: s11-02-plan-reuses-brainstorm-worktree -->

## s11-02-plan-reuses-brainstorm-worktree — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s11
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-02-plan-reuses-brainstorm-worktree
prd: 7
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

When the idea session hands over to planning, should planning work in the same working copy the idea was written in, or open its own?

## The decision, in plain words

The same one. The idea session has just created the working copy for the feature, so planning continues there instead of trying to open a second copy of the same branch, which the tools refuse.

## The options, in plain words

A. Brainstorm tells plan to reuse its worktree; plan unchanged (built).
B. Change the plan skill's step 2 to detect a worktree already holding the branch, for every caller.
C. Brainstorm removes its worktree before handing over, so plan adds its own.

## What I had to decide

The plan skill's step 2 adds a worktree at worktrees/<topic> for the feature branch when it exists on the remote. The brainstorm skill has just created that exact worktree and pushed the branch, and git refuses a second worktree on a branch already checked out. Upstream brainstorming invoked its plan skill the same way and did not say.

## What I did meanwhile

Step 8 of the brainstorm skill follows /omni:plan from inside the feature worktree and tells it to use that worktree rather than add a second one. The plan skill itself is unchanged.

## What it costs to change later

A constant: if the answer is B, the plan skill's step 2 gains a line (a branch already checked out in a worktree is used there), and brainstorm's step 8 drops its sentence.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No live run of brainstorm then plan has happened yet (author).

```

<!-- /omni-outbox-settled: s11-02-plan-reuses-brainstorm-worktree -->

<!-- omni-outbox-settled: s11-03-phase-0-pr-follows-the-lifecycle -->

## s11-03-phase-0-pr-follows-the-lifecycle — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s11
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-03-phase-0-pr-follows-the-lifecycle
prd: 7
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

Once the review packet for an idea is opened as a pull request, should the agent watch its checks until green, or open it and walk away?

## The decision, in plain words

It watches it like any other pull request it owns: opened as a draft, checks watched, marked ready for review once green. A person still reviews and merges it.

## The options, in plain words

A. Follow /omni:pr's lifecycle: draft, watch, ready when green (built).
B. Open it ready for review and stop, as upstream did.
C. Open it as a draft and stop, leaving ready to the reviewer.

## What I had to decide

Upstream brainstorming opened the phase-0 pull request (not as a draft) and stopped. The pr skill built in s4 says a phase-0 PR is opened by /omni:brainstorm and follows its lifecycle with labels.phase0 and prLinks.phase0; that lifecycle opens a draft, watches CI, and marks a non-feature PR ready once green.

## What I did meanwhile

Step 9 of the brainstorm skill opens the phase-0 PR through /omni:pr's lifecycle; the person reviewing sees it only once its checks are green.

## What it costs to change later

A constant: if the answer is B, step 9 opens the PR ready for review with gh pr create and stops, and the pr skill's phase-0 sentence says so.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether this repository's CI runs anything on a docs-only pull request was not checked (author).

```

<!-- /omni-outbox-settled: s11-03-phase-0-pr-follows-the-lifecycle -->

<!-- omni-outbox-settled: s3-02-closed-pr-reads-as-dropped-claim -->

## s3-02-closed-pr-reads-as-dropped-claim — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-25T10:10:31Z
- Channel: feature pull request #9
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/9#issuecomment-5830656719
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Stays here: laws.source is "none", so there is no knowledge folder to file the board's closed-PR rule into
- Rank: high
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s3-02-closed-pr-reads-as-dropped-claim
prd: 7
slice: s3
rank: high
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

If a slice's sub pull request was closed without merging, should the slice look open again, as if nothing had claimed it, or should a person's deliberate close be respected instead?

## The decision, in plain words

A closed, unmerged pull request is treated as if it never existed — the slice becomes runnable or blocked again, which can override a person's deliberate decision to close it without merging.

## The options, in plain words

A. Treat a closed, unmerged pull request as no pull request at all (what was built) — the slice becomes runnable or blocked again, even after a person closed it on purpose.
B. Keep the closed pull request as the slice's match, so a slice a person closed on purpose never returns to runnable without a person clearing it by hand.

## What I had to decide

What board state a slice reads as when its only matched pull request was closed without merging.

## What I did meanwhile

Read a closed, unmerged pull request as a dropped claim: it is filtered out before matching, so the slice falls back to whatever its blockers say (runnable or blocked). No new state was added for this, and no signal distinguishes an abandoned automated attempt from a pull request a person closed on purpose.

## What it costs to change later

If a person closes a sub pull request on purpose to stop a slice from being retried, the next board run (and a wave built on it) reopens that slice anyway — reversing that requires a person to notice and act again, which is a real, ongoing cost, not a one-line code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec's five states nor the task's six name what happens to a closed-and-unmerged pull request, and nothing distinguishes a dropped automated claim from a person's deliberate close.

```

<!-- /omni-outbox-settled: s3-02-closed-pr-reads-as-dropped-claim -->
