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

<!-- omni-outbox-settled: s2-01-knowledge-that-crosses-domains-on-the-page -->

## s2-01-knowledge-that-crosses-domains-on-the-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-knowledge-that-crosses-domains-on-the-page
prd: 149
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Some knowledge sits between two domains, and a rule in one domain can serve a principle kept in another. How should the reading page show knowledge that crosses a domain's border?

## The decision, in plain words

The knowledge between two domains gets a tab of its own, drawn like a domain, with its pair named beside each entry. In a domain's list, a principle kept in another domain heads the group of the rules here that serve it, marked with the domain it lives in, and a link to one entry always opens it in its own tab.

## The intro, for fun

Borders are easy to draw on a map, and much harder to draw around an idea.

## The punchline, for fun

So the ideas that cross them get a tab of their own, passport included.

## The options, in plain words

A. A tab of its own for the knowledge between domains, and a principle kept in another domain heading the group of the rules here that serve it, the option built.
B. No tab between domains: show each shared entry in both of its domains, marked as shared.
C. Keep each domain's list to its own principles, and gather the rules that serve another domain's principle in a group of their own at the end.

## What I had to decide

The spec asks for a **Between domains** tab when cross-domain entries exist, but says nothing of its address, of what its diagram shows, or of how a domain's index groups a rule whose `Serves:` names a principle of another domain (or a principle that only other domains serve). This repository has only the `product` domain today, so none of it shows yet; it will as soon as a repository keeps domains.

## What I did meanwhile

The tab is addressed `?domain=cross-domain`, the folder's own name (`BETWEEN` in `apps/galaxy/src/knowledge/view.ts`). Its diagram is the same orrery, every cross-domain entry on its kind's orbit around a sun labelled `between`, and its panel adds a `Domains` row with the pair. In any tab, `indexOf` heads a group with a principle of another tab when an entry here serves it (the row tagged `in <domain>`, a link to that principle in its own tab), and a principle of this tab that only other tabs serve heads a group with no member here. An `?entry=` always wins over `?domain=`: an entry opens in its own tab, so a shared link never lands on the wrong one. `view.test.ts` and `render.test.ts` pin all of it on a fixture with a `billing` domain and one `billing--product` pair.

## What it costs to change later

A constant and one function: the `BETWEEN` key and `indexOf`'s foreign group heads, both in `apps/galaxy/src/knowledge/view.ts`, with their tests. A shared link to a between-domains entry keeps working if the key changes, because the entry decides the tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No repository with domains or cross-domain files was at hand: the grouping has only been seen on the test fixture, never on real registers.
- (author) A domain folder named cross-domain would share the tab's address; the kit does not forbid that name, and the domain's own tab would then be unreachable by address.

```

<!-- /omni-outbox-settled: s2-01-knowledge-that-crosses-domains-on-the-page -->

<!-- omni-outbox-settled: s2-02-the-list-is-the-way-in-for-the-keyboard -->

## s2-02-the-list-is-the-way-in-for-the-keyboard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-the-list-is-the-way-in-for-the-keyboard
prd: 149
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The diagram draws every entry as a small dot. Should a keyboard or a screen reader walk through the dots too, or reach the same entries through the list under the diagram?

## The decision, in plain words

The dots answer a mouse or a finger. The list under the diagram holds the same entries as links, grouped in an order that reads well, so the keyboard and screen readers use the list and skip the picture.

## The intro, for fun

Fifty-eight tiny planets in a ring make a lovely picture, and a very long walk for a keyboard.

## The punchline, for fun

So the keyboard takes the list, which goes to the same places in a straight line.

## The options, in plain words

A. The list is the way in for the keyboard and screen readers, and the dots answer a pointer, the option built.
B. Put every dot in the keyboard's path too, after the tabs and before the panel.
C. Let the arrow keys move between the dots once the diagram has focus, as the arcade's pad does.

## What I had to decide

The spec says an entry is selected "by its dot or its index row", and says nothing of reaching the SVG from the keyboard or a screen reader. With 58 dots here (and the 150 the layout is tested with), putting every dot in the tab order doubles each stop the index already offers, in an order (orbit by orbit, clockwise) that reads worse than the index's grouping by principle.

## What I did meanwhile

The figure (the SVG and its legend) is `aria-hidden`; each dot is an SVG `<a>` with `tabIndex={-1}`, its real address as `href`, and a `<title>` tooltip with its id and statement. Every index row is a real link carrying its kind and status in visually hidden text, and choosing one updates the panel, the diagram's selection ring and the address exactly as a dot does. On a phone, choosing brings the panel into view. The by-hand check clicked dots and rows at 1440×900 and tapped both at 393×700.

## What it costs to change later

A constant: drop `tabIndex={-1}` and `aria-hidden` in `apps/galaxy/src/knowledge/OrreryDiagram.tsx` and `KnowledgeMap.tsx`, and give the SVG an accessible name. No data and no address changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The page was not tried with a screen reader, only read through its markup and driven with a pointer in a headless browser.

```

<!-- /omni-outbox-settled: s2-02-the-list-is-the-way-in-for-the-keyboard -->

<!-- omni-outbox-settled: s3-01-up-moves-in-down-moves-out -->

## s3-01-up-moves-in-down-moves-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-up-moves-in-down-moves-out
prd: 149
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

In a system, the up and down buttons change orbit. Which one moves toward the sun, and which one away from it?

## The decision, in plain words

Up moves one orbit in, toward the sun, and down moves one orbit out, the same order the panel and the page's index read: principles first, then rules, then invariants.

## The intro, for fun

A solar system has no up or down, but a game pad insists on having both.

## The punchline, for fun

So up means toward the sun, the way every good story about stars begins.

## The options, in plain words

A. Up moves in, toward the sun; down moves out, the option built.
B. Up moves out, away from the sun; down moves in.
C. Up and down move to the next world in that direction on the screen, whatever its orbit.

## What I had to decide

The spec says ▲ and ▼ move to the planet on the next orbit in or out that is nearest in angle, but not which button goes which way. On screen neither reading is spatial: a world at the top of its orbit moves up to go out, one at the bottom moves up to go in.

## What I did meanwhile

▲ moves to the next orbit in and ▼ to the next orbit out, skipping an empty orbit, each to the world nearest in angle; at the innermost or outermost orbit the press does nothing. `orbitStep` in apps/galaxy/src/arcade/scenes/chart-layout.ts holds the mapping, the README says it, and chart-layout.test.ts pins it.

## What it costs to change later

Swapping the two is one sign in `orbitStep` and two words in the README and the scene's hint. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names both directions without mapping them to the two buttons.

```

<!-- /omni-outbox-settled: s3-01-up-moves-in-down-moves-out -->

<!-- omni-outbox-settled: s3-02-no-chart-does-not-open -->

## s3-02-no-chart-does-not-open — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-no-chart-does-not-open
prd: 149
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When there is no star chart to show, because the knowledge is out of reach or the shared single page carries none, what does choosing it on the menu do?

## The decision, in plain words

It does not open: it buzzes and says why for a moment, and its line on the menu already says so. Only a direct link to the star chart lands on it, and the star chart then says why it is empty.

## The intro, for fun

A telescope with its cap on can still tell you why you see nothing.

## The punchline, for fun

It just says so politely, instead of showing you a very dark sky.

## The options, in plain words

A. Neither case opens: the row and a toast say why, and a direct link shows the reason on the chart, the option built.
B. The artifact's row opens the chart scene, which says NO STAR CHART IN THIS BUILD; only out of reach refuses.
C. Both open the chart scene, which says why it is empty.

## What I had to decide

The spec says that without a graph the item reads OUT OF REACH and the scenes are not reachable, and that the single-file artifact's star chart reads NO STAR CHART IN THIS BUILD. It does not say whether the artifact's item opens a scene to say that, or refuses like the out-of-reach one, nor what the menu line reads in the artifact.

## What I did meanwhile

Without a graph the STAR CHART row reads OUT OF REACH (NOT IN THIS BUILD in the artifact); A buzzes and toasts THE STAR CHART IS OUT OF REACH or NO STAR CHART IN THIS BUILD, and stays on the menu (`doorOf` in scenes/menu.tsx). The `#chart` deep link, which reaches the chart only past the sign-in gate, shows the same reason on the chart scene itself (`ChartOverlay`). A crew member whose galaxy could not be read gets no graph either: the page hands it over only where it hands over the galaxy.

## What it costs to change later

Letting the artifact's row open the chart scene instead is one branch in `doorOf`. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the artifact's star chart reads NO STAR CHART IN THIS BUILD, without saying whether that is its menu line, a scene, or both.

```

<!-- /omni-outbox-settled: s3-02-no-chart-does-not-open -->

<!-- omni-outbox-settled: s3-03-reading-card-shows-cites-and-enforcement -->

## s3-03-reading-card-shows-cites-and-enforcement — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-reading-card-shows-cites-and-enforcement
prd: 149
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The reading card in the arcade shows a whole knowledge entry. Besides what the spec lists, should it also show what the entry cites and how it is enforced?

## The decision, in plain words

Yes: the card also lists the entries it cites, and how it is enforced when it is, so the arcade and the page tell the same whole story. An entry marked as not enforced says nothing about it.

## The intro, for fun

A good reading lamp shows the footnotes too, not just the headline.

## The punchline, for fun

And it skips the footnote that only says there is no footnote.

## The options, in plain words

A. Show what it cites, and how it is enforced when it is, the option built.
B. Keep to the spec's list: statement, Why:, serves, served by, PRD.
C. Show everything the page's panel shows, the file included.

## What I had to decide

The spec lists the card's content as the whole statement, Why:, what it serves, what serves it and the PRD it came from, while the acceptance criteria call it the whole entry, and the /knowledge page's panel also shows cites and Enforced by:. This repository's registers write 'Enforced by: unenforced' on unenforced entries.

## What I did meanwhile

`cardBlocks` in scenes/chart.tsx adds CITES (the ids, when there are any) and ENFORCED BY (the line as written, only when the entry is enforced), between what serves it and FROM PRD. The panel beside the diagram keeps to what the spec lists.

## What it costs to change later

Dropping either block is one line in `cardBlocks` and one assertion in chart.test.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's list of the card's content and the acceptance criteria's 'whole entry' differ by these two lines.

```

<!-- /omni-outbox-settled: s3-03-reading-card-shows-cites-and-enforcement -->
