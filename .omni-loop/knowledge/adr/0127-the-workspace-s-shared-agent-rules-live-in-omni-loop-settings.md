# ADR-0127 — The workspace's shared agent rules live in .omni-loop/settings/, beside the repository's own knowledge

**Status:** adopted · **Date:** 2026-10-23 · **PRD:** #2417 · **Decided:** nobody — adopted when raised (medium), 2026-10-23 · **Merged:** @pierrederval, 2026-10-23, PR #2479

## Context

Whether the settings repository keeps its tech playbook at `.omni-loop/settings/` (`playbook/<form>.md`, the decisions form at `adr/README.md`), beside its own `.omni-loop/knowledge/`. Built that way in `kit/lib/omni-settings/layout.ts` (`SETTINGS_DIR`, `settingsFilePath`, `formOfSettingsPath`); the local copy at `.omni-loop/local/tree/omni-settings/` mirrors it path for path, and the kit's curated pages sit at `kit/templates/omni-settings/` in the same layout. A plan repository's own playbook is the plan repository level of the tree, so its settings folder cannot be its knowledge folder.

## Decision

A settings repository keeps the playbook it sets for every repository in .omni-loop/settings/, laid out like a knowledge folder and apart from its own .omni-loop/knowledge/, so its own rules and the shared ones never mix.

The option chosen: A. A. A settings folder of its own, beside the repository's own knowledge and laid out like it: the option built.

## Consequences

Before s5 merges, one constant and its tests. After a workspace's settings repository holds pages there, moving it means moving their files in each settings repository too.

## Source

`.omni-loop/delivery/shipped/2417-tech-defaults/outbox/settled.md`, entry `s1-01-settings-folder`
