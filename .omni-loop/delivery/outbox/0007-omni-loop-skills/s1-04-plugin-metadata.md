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
