---
id: s1-01-graph-document-carries-loose-and-unserved
prd: 149
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The knowledge map is printed as one document, and the spec names five parts of it. Should it also carry the list of rules that serve no principle and the list of principles nothing serves?

## The decision, in plain words

The document carries both lists beside the five parts. Each entry also carries its enforcement line as written and the domains it belongs to, so both maps and any agent read them without working them out again.

## The intro, for fun

A map that already circles the lonely islands saves every traveller from counting them twice.

## The punchline, for fun

Two extra lines on the legend, and nobody has to squint at the coastline.

## The options, in plain words

A. Carry both lists, the enforcement line and every entry's domains in the document, the option built.
B. Keep the document to the five parts the spec names, and let each map and agent work the lists out itself.
C. Carry the two lists as a mark on each entry instead of two lists beside the entries.

## What I had to decide

The spec's document names `version`, `repo`, `domains`, `entries` and `links`, yet it defines loose entries and unserved principles as part of the graph, and the `/knowledge` panel shows the `Enforced by:` line, which the `enforced` boolean alone cannot give. I also had to settle what a `Serves:` naming an existing rule (not a principle) makes an entry, and what to do with an entry whose kind cannot be read.

## What I did meanwhile

The document is `{ version: 1, repo, domains, entries, links, loose, unserved }`. Each entry carries `enforcedBy` (the line as written) beside `enforced`, and `domains` (its one domain, or a cross-domain entry's pair, with `domain: null`). Loose means no `serves` link: `Serves:` missing or naming anything but an existing principle, so every rule and invariant sits either under a principle or among the loose. An entry whose kind cannot be read (a cross-domain entry without a valid `Kind:`, which `omni check knowledge` refuses) is left out. `apps/galaxy/src/data/knowledge.ts` types the same shape.

## What it costs to change later

Dropping a field is a small change in `kit/lib/knowledge/graph.mjs` and the app's types, plus whatever s2 and s3 read from it. The five fields the spec names are unchanged, so `version` stays 1 either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists five top-level fields and also defines the two lists as part of the graph; it does not say whether the JSON carries them.
