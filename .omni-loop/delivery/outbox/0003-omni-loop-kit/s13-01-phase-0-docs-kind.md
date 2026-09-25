---
id: s13-01-phase-0-docs-kind
prd: 3
slice: s13
rank: high
bears-on: none
raised: 2026-09-25
wave: 8
---

## The question, in plain words

May the documentation-only pull request that opens a feature also edit the knowledge folder and the decision records, or only the feature folder?

## The decision, in plain words

It may: edits to the delivery folder, the knowledge folder, the decision records, the glossary and the context files all count as documentation.

## The options, in plain words

A. Count knowledge, decision records, glossary and context edits as documentation, the option built.
B. Allow only the feature folder itself, so any knowledge edit needs its own pull request.

## What I had to decide

What `classifyPhase0Path` classes as `docs` versus `source` in a phase-0 pull request.

## What I did meanwhile

Kept upstream's `docs` kind: a path under `paths.delivery`, `layout.knowledgeRoot` or `layout.adrDir`, or equal to `paths.glossary` or one of `paths.context`, is docs; anything else not a PRD-folder or acceptance file is source.

## What it costs to change later

One classifier in `kit/lib/policy/phase-0.mjs` and its tests; narrowing it later only refuses more.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether reviewers want knowledge edits reviewed apart from the spec that motivated them.
