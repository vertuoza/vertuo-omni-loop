---
prd: 149
title: Knowledge map — each domain a star system, in the arcade and on a plain page
blocked-by: none
spec: file
---

# Knowledge map — each domain a star system, in the arcade and on a plain page

**Date:** 2026-09-26 · **PRD:** #149 · **Changes:** the kit (`omni kb graph`), the web app
(`apps/galaxy`: a star chart in the arcade and a `/knowledge` page) and the sprites (a sun) · **Does
not change:** the knowledge files, the registers' format, Supabase, the game's rules, the GitHub App

## Problem

A repository's knowledge base is a set of Markdown registers: principles (`P-…`), business rules
(`BR-…`) that each serve one principle through their `Serves:` line, and invariants (`N-…`), grouped
in `product/` and in one folder per domain under `domains/`. Today they can only be read file by
file, or one entry at a time with `omni knowledge <id>`:

- **Nobody sees its shape.** This repository's `product/` alone holds 58 entries (24 principles,
  26 rules, 8 invariants), and 57 of them are still proposed. Which principles carry many rules,
  which carry none, which rules serve nothing, how much of it is law: none of that is visible
  without reading 618 lines and counting by hand.
- **The game does not know it exists.** The OMNI LOOP arcade shows delivery (sectors of
  repositories, a planet per PRD), but the knowledge the loop harvests from every merged PRD
  (PRD 82) never appears in it, although it is the loop's most lasting output.
- **Agents have no map either.** A coding agent must read what a change touches before it decides
  (the briefing). It can print one entry, but it cannot ask "what serves `P-PRODUCT-3`?" or "what
  does this domain hold?" in one call.

## Solution

One graph, built by the kit from its own parser, shown twice in the web app.

### 1. The graph: `omni kb graph`

`omni kb graph [--json]` reads the knowledge folder through the kit's one register parser
(`readKnowledge`, `kit/lib/knowledge/registers.mjs`) and builds a graph:

- **A domain** for `product/` and for each folder under `domains/`: its name, its code, its scope
  (`product` or `domain`), and its counts: principles, rules, invariants, laws and proposed.
- **An entry** for every principle, rule and invariant: its id, kind, domain, statement, `Why:`
  (principles), status (`proposed` when it carries a `Proposed:` line, else `law`), the principle it
  serves (raw, as written), whether it is enforced, the PRD its `Source:` names, and its file.
- **A cross-domain entry** (`X-A-B-n`, in `cross-domain/<a>--<b>.md`) is an entry whose `domains`
  are the pair, and no single domain.
- **Links,** each `{ from, to, kind }`, only between two entries that exist:
  - `serves`: from a rule or an invariant to the principle its `Serves:` line names.
  - `cites`: from an entry to another entry whose id its statement or `Why:` names.
- **Loose entries** are rules and invariants whose `Serves:` is missing or names no entry. **Unserved
  principles** are principles no entry serves.

With `--json` it prints the whole graph as one JSON document (`version: 1`, `repo`, `domains`,
`entries`, `links`), the shape both maps and any agent read. Without it, a summary:

```text
kb graph — 1 domain, 58 entries, 26 links
  product    24 principles · 26 rules · 8 invariants    1 law · 57 proposed
  unserved principles: none
  loose entries (8): N-PRODUCT-1, N-PRODUCT-2, N-PRODUCT-3, …
```

(Today every rule serves a principle, and no invariant names one.)

An absent knowledge folder is an empty graph, never an error. The kit names no game word: it speaks
of domains, entries and links.

### 2. The star chart, in the arcade

A new menu item, **STAR CHART**, opens two new scenes. The hint beside it reads
`<n> SYSTEMS · <m> WORLDS`.

**`chart`: every domain a sun.** A starfield, and one sun per domain, sized by how many entries it
holds (within a fixed smallest and largest size), each labelled with its name and counts. A
cross-domain file draws a dotted lane between its two suns, labelled with its entry count. The title
reads `STAR CHART · <repository>`. The D-pad moves the cursor between suns, A enters the sun's
system, B returns to the menu. With one domain, as today, its sun sits in the middle.

**`system`: one domain as an orrery.** The domain's sun in the middle of the diagram, and three
orbits around it: **principles on the inner orbit, rules on the middle one, invariants on the
outer one.** Every entry is a planet on its kind's orbit, in id order, drawn by the arcade's own
planet renderer and seeded by its id:

- A **law** is a terraformed world: oceans and forests, as a secured planet on the galaxy map.
- A **proposed** entry is a barren world, not yet terraformed. A person confirming it (removing its
  `Proposed:` line) terraforms it on the next load.

Orbits hold still, so a planet stays where the D-pad and a tap expect it; the spheres still turn.
When an orbit cannot seat its planets at the smallest spacing, it spills onto one more orbit of the
same kind, further out, and the planets shrink down to a smallest size; every entry is always shown.

- **Moving.** ◀ and ▶ move to the previous and next planet on the same orbit. ▲ and ▼ move to the
  planet on the next orbit in or out that is nearest in angle. A tap selects the planet under it.
- **The selected planet** gets the cursor ring, and its links are drawn: a line to the principle it
  serves, and lines to every entry that serves it.
- **The panel** beside the diagram (wide) or under it (tall) shows the selected entry's id, its
  kind, `LAW` or `PROPOSED`, its statement cut to fit, and `SERVES <id>` or `SERVED BY <n>`.
- **A** opens the **reading card** over the scene: the whole statement, `Why:`, what it serves,
  what serves it, and the PRD it came from, paged with ▲ and ▼ when it is longer than the card.
  **B** closes the card; B with no card open returns to the chart.

Both scenes have a wide (640×360) and a tall (320×288) layout, as every scene must since PRD 94, and
the screenshot script walks them.

**Who sees it.** The arcade receives the graph only where it receives the galaxy: a crew member
signed in, or the demo in development. For anyone else the item reads `OUT OF REACH` and the scenes
are not reachable, and the page's HTML carries no entry. The shareable single-file build
(`pnpm galaxy:artifact`) never embeds a knowledge base: its star chart reads
`NO STAR CHART IN THIS BUILD`.

### 3. The knowledge map, a plain page: `/knowledge`

The same graph as a reading surface, beside the `/ask` pages, for when a person wants to read
rather than play. It uses the `/ask` pages' surface: the same theme tokens (light and dark), faces
and theme switch.

- **The top bar:** `OMNI LOOP · Knowledge map`, the repository, and the theme switch.
- **Domain tabs,** one per domain, each with its entry count, plus **Between domains** when
  cross-domain entries exist.
- **The diagram:** an SVG orrery of the selected domain, laid out as in the arcade: the sun in the
  middle, principles on the inner orbit, rules in the middle, invariants outside. A law is a filled
  dot, a proposed entry a hollow ring. Each kind has its own colour, and each colour holds at least
  3:1 against the page's ground in both themes. Every `serves` link is drawn faintly; the selected
  entry's links are drawn strong.
- **The detail panel** of the selected entry: its id, kind, status, statement, `Why:`, `Serves:`
  (a link to that entry), served by (links), cites (links), the PRD it came from (a link to its
  issue on GitHub), `Enforced by:`, and its file.
- **The index,** under the diagram: every entry of the domain grouped by the principle it serves,
  each principle followed by its rules and invariants, then the loose entries, then the unserved
  principles marked as such. A filter box narrows the index by id or words and dims every dot that
  does not match.
- **Selecting** an entry, by its dot or its index row, updates the address to
  `/knowledge?domain=<name>&entry=<id>`, so a link to one entry can be shared; opening that address
  selects it.
- **On a phone** the diagram takes the full width and the panel follows it; the page scrolls
  vertically and never sideways.

**Who sees it**, exactly as the arcade: in the Supabase build, signed out gets the sign-in card that
comes back to `/knowledge`; signed in without a crew account gets a notice that the map is for the
crew; the crew gets the map. In development without Supabase it shows the local checkout's
knowledge; any other build says the map is not open here.

### 4. Linked both ways

The page's top bar links to the arcade's star chart (`/#chart`, a new deep link), and the star
chart's footer names the page: `READ IT AT /KNOWLEDGE`. The arcade's README describes the star
chart, the page, where their data comes from, and who sees them.

### Where the data comes from

The app reads the knowledge of the checkout it is deployed from, on the server, through the kit's
graph builder (`apps/galaxy` already depends on the root package and transpiles it). The config and
the knowledge folder are traced into the deployment with Next's `outputFileTracingIncludes`, so a
Vercel function has the files it reads. When the folder or the config cannot be read, the loader
returns no graph and logs why: the star chart and the page say the knowledge is out of reach, and
nothing else in the arcade changes.

## Decisions

These were taken without asking, under `/omni:yolo` with no PRD yet (the brainstorm's questions
were answered from the request and the code). A person reviews them on the phase-0 PR.

1. **One PRD for the graph and its two maps; two follow-ups split out.** The request holds three
   independent parts. Visualisation comes first, as the request says. **The MCP server** that lets
   a coding agent walk the graph, and **each sector's repositories' knowledge in the arcade**, are
   follow-up PRDs. `omni kb graph --json` is the seam both will read.
2. **"The Omni Loop app" is the web app's plain reading surface**, a page like `/ask`, at
   `/knowledge`. The GitHub App (`apps/omni-app`) has no pages to put a map on.
3. **Every entry is a planet; its kind is its orbit.** Principles are planets too, on the inner
   orbit, because a rule's `Serves:` link needs both its ends on the map.
4. **Law is terraformed, proposed is barren**, reusing the arcade's own planet look: confirming an
   entry visibly terraforms it. On the page: filled against hollow.
5. **The kit builds the graph from its one parser.** The registers' parser says nothing else may
   read that Markdown, so the app imports the kit's builder rather than parsing the files itself.
6. **The app reads the checkout it is deployed from, at request time, from traced files.** No
   Supabase table and no GitHub call. That keeps PRD 100's workspace schema untouched and the game's
   boundary as it is: it only reads.
7. **Crew only, like the galaxy.** The graph reaches a browser only past the same gate. The
   single-file artifact never embeds one.
8. **Decision records are not planets.** They belong to the repository, not to a domain, and
   `omni kb show decisions` lists them. They can join the graph later.
9. **Two link kinds: `serves` and `cites`.** Cross-domain entries are lanes between suns.
10. **Orbits hold still;** only the spheres turn, so the D-pad and taps hit what they see.
11. **Every entry is always shown.** A crowded orbit spills outward and planets shrink; nothing is
    paged away or dropped.

## User stories

1. As a person who keeps the knowledge base, I open the star chart and see each domain as a sun,
   sized by what it holds, with the product's sun among them.
2. As that person, I enter the product system and see at a glance which worlds are terraformed
   (laws) and which are barren (proposed), and which principles have no rule circling near them.
3. As that person, I move to a rule and see the line to the principle it serves, and press A to read
   it whole.
4. As a crew member at a desk, I open `/knowledge`, pick a domain, filter for "outbox", and share
   the link to `BR-PRODUCT-3` in a review.
5. As a coding agent, I run `omni kb graph --json` and find every rule serving the principle my
   change bears on, in one call.
6. As a visitor without a crew account, I never see the knowledge base: not in the arcade, not on
   the page, not in the HTML.

## Scope

**In:**

- `kit/lib/knowledge/graph.mjs`, pure: the graph from what `readKnowledge` returns.
- `omni kb graph [--json]`, the kit README's paragraph on it, and the rebuilt `kit/dist/omni.mjs`.
- In `apps/galaxy`: the graph's types and pure helpers (`src/data/knowledge.ts`), the server-only
  loader (`src/data/load-knowledge.ts`), and the tracing of the config and the knowledge folder in
  `next.config.mjs`.
- The `/knowledge` page (`app/knowledge/`, `src/knowledge/`), with its sign-in return route.
- The STAR CHART menu item, the `chart` and `system` scenes (wide and tall), the reading card,
  `drawSun` in `@omni/sprites`, the arcade page passing the graph, the artifact passing none, and
  the screenshot script walking the two scenes.
- The `#chart` deep link, the links between the page and the arcade, and the arcade README.

**Out:**

- **An MCP server** serving the graph to coding agents: a follow-up PRD.
- **Other repositories' knowledge** (each sector's): the game's projector would read them and a
  table scoped by workspace would hold them. A follow-up PRD, once PRD 100 is merged.
- **Decision records and playbook forms** in the graph.
- **Editing** anything from either map, or confirming a proposed entry from them.
- **Any change to** the knowledge files, the registers' format, `omni kb status`, the skills,
  Supabase, the game's rules or the GitHub App.
- **A graph library** (d3, a force layout, three.js): both layouts are the pure, hand-written orbit
  layout, like the galaxy map's.

## Test seams

Everything below runs in `pnpm test` (vitest), on fixtures. No test calls GitHub or Supabase
(`omni kb show testing`).

| Unit | What the tests pin |
|---|---|
| `kit/lib/knowledge/graph.mjs` | On a fixture with a product folder, two domains and one cross-domain file: every entry appears once with its kind, domain, status and PRD; a `Serves:` naming an existing principle is one `serves` link, one naming nothing is no link and a loose entry; an id cited in a statement is one `cites` link, a self-citation none; counts per domain; unserved principles; an absent folder is an empty graph |
| `omni kb graph` (`kit/bin/kb.test.mjs`, through `main()` on `makeRepo()`) | `--json` prints one document with `version: 1` and the repository's slug; the text summary prints the domain line, the unserved principles and the loose entries; an extra argument is a usage error (exit 2) |
| `src/data/load-knowledge.ts` | On a temporary checkout: returns the graph; returns `null`, logging, when the config or the folder is missing |
| `src/data/knowledge.ts` | The systems in order; each domain's orbits by kind in id order; served-by lookup; the filter matching id and words |
| The page's access rule | Demo gives the local graph; closed gives the not-open notice; signed out gives the sign-in card; signed in without crew gives the crew-only notice; crew gives the map |
| The page, rendered with `renderToStaticMarkup` on a fixture graph | Every entry in the index, grouped by principle; the selected entry's panel; the crew-only and sign-in states carry no statement and no entry id |
| The page's kind colours | Each is at least 3:1 against the ground in the light and the dark theme |
| The orbit layout (`system`, wide and tall) | With this repository's graph and with a synthetic domain of 150 entries: every entry seated, all inside the diagram's region, no two planets overlapping; a crowded orbit spills outward |
| The D-pad on `system` and `chart` | ◀▶ walk an orbit and wrap; ▲▼ reach the nearest in angle; from any planet every planet is reachable |
| The scenes | `drawFrame` draws `chart` and `system` on both grids (the recorder context); both are listed as tall; the text layers render the panel, the card and the empty and out-of-reach states |
| `menuItems` | STAR CHART is listed, after GALAXY MAP |
| `drawSun` | Draws within its size on the recorder context, the same frames for the same seed |

**The visual check.** `pnpm galaxy:shots`, against `pnpm galaxy:dev` on the demo, walks `chart`
and `system` at the three sizes PRD 94 uses (393×700 touch, 852×393 touch, 1440×900 mouse), and
reports any text under 8 CSS px. Each arcade slice attaches its screenshots to its sub-PR. Each push
runs `pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build`.

## Risks

- **What a merge publishes.** `kit/dist/omni.mjs` changes, so the one-line install hands out
  `omni kb graph`. The arcade is a Vercel project imported from this repository; whether a merge to
  `main` deploys it is still an open question in `omni kb show releasing`. If it does, the crew sees
  the star chart and the page at once.
- **Private knowledge.** The knowledge base is internal. The gate is the galaxy's own, the page's
  signed-out and non-crew states are tested to carry no entry, and the artifact embeds none.
- **Tracing on Vercel.** If the knowledge files are not traced into the deployment, both maps say
  the knowledge is out of reach; nothing breaks. The build's trace is checked locally.
- **Merge conflicts with PRD 100** (#101, ready for review). It changes `app/page.tsx`,
  `ArcadeApp.tsx`, `ArcadeClient.tsx`, `scenes/common.ts`, the menu and the arcade README. Whichever
  merges second meets the other's changes; this PRD keeps its own changes to those files to a few
  lines.
- **Big knowledge bases.** Orbits spill and planets shrink down to a floor; the layout is tested at
  150 entries in one domain. Far beyond that, planets touch. Paging is left for when it happens.
- **Rollback.** Revert the feature PR. It changes no data, no schema and no stored shape; the
  knowledge files are only read.

## Acceptance criteria

1. **The graph.** In this repository, `omni kb graph --json` prints one JSON document with
   `version: 1`, the repository's slug, the domain `product` with its counts, every entry
   `omni kb status` counts, and one `serves` link per rule or invariant whose `Serves:` names an
   existing principle. `omni kb graph` prints the summary: the domain line, the unserved principles
   and the loose entries. In a repository without a knowledge folder, both print an empty graph and
   exit 0.
2. **The page, for the crew.** Signed in with a crew account, `/knowledge` shows the product
   domain's diagram with every entry as a dot on its kind's orbit (filled for laws, hollow for
   proposed), the index grouped by principle, and the first principle selected.
3. **Selecting on the page.** Clicking a dot or an index row selects that entry: its links are drawn
   strong, the panel shows its statement, `Why:`, serves, served by, cites, PRD link, enforcement
   and file, and the address becomes `/knowledge?domain=product&entry=<id>`. Opening that address
   selects the same entry.
4. **Filtering.** Typing `outbox` in the filter leaves only the entries whose id or words match in
   the index, and dims every other dot.
5. **Nobody else reads it.** Signed out, `/knowledge` shows the sign-in card, which returns to
   `/knowledge`. Signed in without a crew account, it shows the crew-only notice. In neither state
   does the HTML contain an entry's id or statement. In a build with no database, it says the map is
   not open here.
6. **Themes and phones.** The page follows the light and dark themes and the theme switch. At
   393×700 it has no horizontal scroll, the diagram fits the width, and the page scrolls down to the
   index.
7. **The star chart.** In the arcade, signed in as crew or on the demo, the menu lists STAR CHART
   after GALAXY MAP, with `<n> SYSTEMS · <m> WORLDS`. It opens `chart`, with one sun per domain; A
   enters `system`, where every entry is a planet on its kind's orbit, laws terraformed and proposed
   barren.
8. **Moving in a system.** ◀▶ walk the orbit, ▲▼ change orbit to the nearest planet in angle, a tap
   selects; the selected planet shows its links and the panel. A opens the reading card with the
   whole entry, ▲▼ page it, B closes it, and B again returns to the chart, and again to the menu.
9. **Both grids.** `chart` and `system` are drawn on the tall grid on a phone held upright and on
   the wide grid elsewhere; `pnpm galaxy:shots` walks both at the three sizes and reports no text
   under 8 CSS px.
10. **Out of reach.** Signed out or without a crew account, STAR CHART reads `OUT OF REACH` and does
    not open, and the arcade page carries no graph. The single-file artifact's star chart reads
    `NO STAR CHART IN THIS BUILD`.
11. **Linked.** The page's top bar opens `/#chart`, which lands on the star chart; the star chart's
    footer names `/KNOWLEDGE`. The arcade README describes both, their data and who sees them.
12. **Done.** `pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build` are green;
    `kit/dist/omni.mjs` is rebuilt; after the build, the traces of `/` and `/knowledge` list the
    knowledge folder's register files.
