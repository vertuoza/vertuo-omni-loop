---
id: s5-01-terraform-config-proposal-is-its-own-commit
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the setup skill learns better values for the repository's settings, how should it put them to the person who reviews its work?

## The decision, in plain words

It changes the settings file in the same review request, as a separate change the reviewer can accept or drop on its own, and lists each new value with the file that shows it.

## The options, in plain words

A. The settings change is its own step inside the one review request, which lists each value and the file that shows it.
B. The settings stay untouched, and the review request only lists the suggested values for a person to copy in by hand.
C. The settings change is folded into the same step as the knowledge pages.

## What I had to decide

The spec's step 6 says `/omni:terraform` proposes config "as a diff", and step 7 says it opens "one docs-only pull request". It does not say whether that diff is committed on `branches.terraform` or only shown in the body, nor whether `.omni-loop/config.yml` counts as docs. The before/after page shows `config.yml` gaining "values terraform learned", and s7's done-when says "the config proposals applied". It also does not say whether an empty `commands.checks` list counts as unset, for "a command that is `null`".

## What I did meanwhile

Step 5 of `kit/plugin/skills/terraform/SKILL.md` edits `.omni-loop/config.yml`, runs `omni config` and `omni check all`, and commits the change alone as `chore(config): …`. Step 6's docs-only check allows only files under the front door and the config file, and the body's `## Config` lists each key, old to new, with its evidence. A key that turns `omni check all` red is left out and named. An empty `commands.checks` counts as unset.

## What it costs to change later

A constant: a few lines of skill prose, before or after merge. No stored data depends on it; a terraform pull request already opened keeps its shape until the next run rewrites it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the docs-only pull request was meant to carry the settings file, or Markdown pages alone: the before/after page shows the settings gaining values, but not through which change.
