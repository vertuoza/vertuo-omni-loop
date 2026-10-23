---
id: s1-01-settings-folder
prd: 2417
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Where in the workspace's settings repository do the shared rules for how agents work live?

## The decision, in plain words

In one folder of their own beside that repository's own knowledge, laid out like a knowledge folder, so a plan repository's own rules and the rules it sets for every repository never mix.

## The intro, for fun

Every workspace needs a shelf for the house rules, away from the books it reads itself.

## The punchline, for fun

We put the shelf up next door, so nobody mistakes the house rules for a diary.

## The options, in plain words

A. A. A settings folder of its own, beside the repository's own knowledge and laid out like it: the option built.
B. B. A folder inside the repository's own knowledge folder, so the knowledge base holds both and one tree shows them.
C. C. A folder at the repository's root, outside the kit's footprint, named by the workspace on the Omni page.

## What I had to decide

Whether the settings repository keeps its tech playbook at `.omni-loop/settings/` (`playbook/<form>.md`, the decisions form at `adr/README.md`), beside its own `.omni-loop/knowledge/`. Built that way in `kit/lib/omni-settings/layout.ts` (`SETTINGS_DIR`, `settingsFilePath`, `formOfSettingsPath`); the local copy at `.omni-loop/local/tree/omni-settings/` mirrors it path for path, and the kit's curated pages sit at `kit/templates/omni-settings/` in the same layout. A plan repository's own playbook is the plan repository level of the tree, so its settings folder cannot be its knowledge folder.

## What I did meanwhile

Slices s3 (the Omni page's read route), s5 (this repository's first settings pages) and s7 (the edit's pull request) all take the path from this one module, so moving the folder is one constant.

## What it costs to change later

Before s5 merges, one constant and its tests. After a workspace's settings repository holds pages there, moving it means moving their files in each settings repository too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the settings repository holds plain playbook files but names no folder; the plan asks for this choice to be recorded because the plan repository's own knowledge is another level.
- (author) Whether the settings folder should also hold the Omni settings level's product knowledge later (product registers) is left to the PRD that writes that side.
