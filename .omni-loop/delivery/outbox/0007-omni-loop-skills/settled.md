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
