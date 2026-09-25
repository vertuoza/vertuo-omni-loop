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
