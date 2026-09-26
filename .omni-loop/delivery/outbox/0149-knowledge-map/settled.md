# Settled outbox items — PRD 149

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-graph-document-carries-loose-and-unserved -->

## s1-01-graph-document-carries-loose-and-unserved — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-01-graph-document-carries-loose-and-unserved -->

<!-- omni-outbox-settled: s1-02-knowledge-files-travel-with-every-server-route -->

## s1-02-knowledge-files-travel-with-every-server-route — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-knowledge-files-travel-with-every-server-route
prd: 149
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

A deployment of the web app must carry the knowledge files so both maps can read them. Should the files go only with the arcade and the knowledge page, or with every page the server renders?

## The decision, in plain words

They go with every page the server renders: the web framework matches page addresses loosely and cannot single out the home page. The files are a few kilobytes and are never sent to a browser.

## The intro, for fun

Packing the map in every suitcase is a little heavier, but nobody arrives without one.

## The punchline, for fun

A few kilobytes of extra luggage, and not one lost bag.

## The options, in plain words

A. Carry the knowledge files with every page the server renders, the option built.
B. Carry them only with the knowledge page, and let the arcade fetch its map from that page's address.

## What I had to decide

The plan says `next.config.mjs` traces the knowledge files for both routes up front. Next matches `outputFileTracingIncludes` keys with picomatch and `contains: true` (`node_modules/next/dist/build/collect-build-traces.js`), so the key `/` matches every route and no glob matches the home route alone.

## What I did meanwhile

One key, `'/'`, carries `.omni-loop/config.yml` and the registers under `product/`, `domains/` and `cross-domain/` (not the playbook, not the decision records) into every server function's trace, the arcade's `/` and the future `/knowledge` among them. On a local `pnpm galaxy:build`, the traces of `/`, an ask API route and a throwaway probe route calling the loader each list the four files, and the probe answered 58 entries and 26 links under `next start` (the probe was not committed). The loader's one request-time path carries `turbopackIgnore`: without it Turbopack warned that it would trace the whole repository into the route.

## What it costs to change later

Narrowing it later is a one-line change in `apps/galaxy/next.config.mjs`, or moving the graph behind its own route prefix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a Vercel function runs from the app's folder inside the traced tree, which the loader relies on to find the config by walking up; only a deployment shows it, and if not, both maps say the knowledge is out of reach.

```

<!-- /omni-outbox-settled: s1-02-knowledge-files-travel-with-every-server-route -->

<!-- omni-outbox-settled: s1-03-graph-summary-names-every-id -->

## s1-03-graph-summary-names-every-id — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-graph-summary-names-every-id
prd: 149
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The short summary of the knowledge map lists the rules that serve no principle. Should it name every one of them, or only the first few followed by an ellipsis, as the spec's example shows?

## The decision, in plain words

It names every one, so an agent reading the summary gets the whole answer. It also gives each pair of domains that share entries a line of its own, after the domains.

## The intro, for fun

An ellipsis is a polite way of saying the rest is somebody else's problem.

## The punchline, for fun

Here the rest gets named too, even when the line runs long.

## The options, in plain words

A. Name every entry, and give each pair of domains its own line, the option built.
B. Name the first few and end with an ellipsis, leaving the full list to the whole document.

## What I had to decide

The spec's example prints `loose entries (8): N-PRODUCT-1, N-PRODUCT-2, N-PRODUCT-3, …`, but does not say where the list is cut, nor whether cross-domain entries get a line of their own in the summary.

## What I did meanwhile

`omni kb graph` names every unserved principle and every loose entry, each list on one line, and prints a line per cross-domain pair (`<a>--<b>`) after the domains, in the same columns. On this repository the rest of the output matches the spec's example to the character: `kb graph — 1 domain, 58 entries, 26 links` and the product line.

## What it costs to change later

Cutting the list is a constant in `kit/bin/commands/kb.mjs` and one test in `kit/bin/kb.test.mjs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example may have been cut for the page rather than for the terminal.

```

<!-- /omni-outbox-settled: s1-03-graph-summary-names-every-id -->
