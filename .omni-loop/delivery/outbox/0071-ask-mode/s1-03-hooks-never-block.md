---
id: s1-03-hooks-never-block
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plugin's hooks run in every repository where the plugin is on, including ones without the loop, or with an older copy of it that knows nothing of ask mode. Should a hook that cannot run ever be allowed to block a person's message or question?

## The decision, in plain words

A hook that cannot run is ignored, so the person's message or question goes through exactly as it does today. The hooks stay silent in those repositories.

## The intro, for fun

A doorman who has lost his list should wave everyone in, not lock the building.

## The punchline, for fun

Nobody ever complained about a quiet doorman.

## The options, in plain words

A. A hook that cannot run is ignored and the person carries on, the option built.
B. Run the hooks exactly as the spec words them, and let an old install block messages until it is updated.

## What I had to decide

The spec's hook command is exactly `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" ask hook <kind>`. Run as is, it fails in a checkout with no `.omni-loop/bin/omni.mjs` (exit 1, an error line) and, worse, in a checkout whose installed bundle predates `omni ask`: that bundle prints its usage line and exits 2, and exit 2 from a `UserPromptSubmit` hook blocks and erases the person's prompt, from a `PreToolUse` hook it blocks `AskUserQuestion`. The plugin updates on its own, apart from each repository's bundle, so this would happen in every such repository.

## What I did meanwhile

Each command in `kit/plugin/hooks/hooks.json` ends with `|| true`. `omni ask hook` itself never exits non-zero for a hook kind it knows: it runs without a loaded context, so no repository, no config, a broken config or an unreachable server all end in exit 0 with no output. `kit/bin/ask-hook.test.mjs` runs each hooks.json command through `sh -c` in a checkout without the kit and in one whose omni exits 2, and gets exit 0 and no output from both.

## What it costs to change later

Removing `|| true` from three lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a hook that fails silently hides a broken install a person would rather hear about
