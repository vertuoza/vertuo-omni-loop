---
prd: 2129
title: The Constellation tab
blocked-by: none
spec: file
phase0: server
---

# The Constellation tab

**Date:** 2026-10-16 · **PRD:** #2129 · **From:** concept #1269, area `constellation-tab`, after PRDs
#1299, #1322, #1364, #1548, #1612 and #2011 · **Touches:** `apps/galaxy` (the product home's tabs,
its reads, a new tab), `docs/guide/products.md`.

## Problem

A product's home (`/app/products/<id>`, PRD 1364) lists what waits on whom, row by row: the Ledger, the
PRDs, the fixes, the questions. Nothing on it shows the product as a whole: which repositories it
holds, which of them consume which, where work is building right now, which repository still opens
docs-only phase-0 pull requests, and which is shared with another product. The facts exist on the
server (`product_repositories.consumes`, `repositories.phase0`, the stages, approvals, voids, outbox
and open pull requests the Ledger already reads), but a member has to assemble them from the
Repositories & approvers tab and the Ledger in their head.

The concept's vision (#1269, C, "The Ledger, under Products") gives the product a **Constellation**
tab: "a read-only 'how this product is looking' view: repositories are stars, `consumes` edges are
lines, and building slices move along them. A flag-off repository is docked, tethered to its phase-0
PR. Only what waits on the viewer pulses." The person made it a tab, not the front door.

## Solution

A new tab, **Constellation**, second in the product home's tab row (Ledger, Constellation, PRDs, Ideas,
Roadmap, Bug fixes, Visual fixes, Questions, then Repositories & approvers), at
`/app/products/<id>/constellation`. Read only: it picks, creates and changes nothing. Server-rendered per
request as the signed-in member, like every other tab, with no client script and no GitHub call.

**1. What it reads** (`product-home.repository.ts`, as the signed-in person, so row-level security has the
last word), beside what the Ledger already reads:

- the product's links, `product_repositories` of this product: `repository`, `role`, `consumes`;
- the other products each of those repositories is linked to: their `product_repositories` rows
  joined to `products.name`, for the "also in" mark;
- `repositories.phase0` (`pr` or `server`) of each linked repository;
- the workspace's open pull requests whose head is a phase-0 branch of a product PRD's topic
  (`docs/phase-0-<topic>`, the kit's default shape, read with the topics the Ledger already reads),
  for the docked tether.

**2. One pure function builds the map**, `constellationOf(home, rows, filter)` in
`apps/galaxy/src/product-home/constellation.ts`. No rule lives in the reads or the drawing:

- **Stars:** one per linked repository: its name, its role (or none), its phase 0 (◆ `server`,
  ◇ `pr`), and the other products it is also in, by name, sorted.
- **Edges:** one per entry of a link's `consumes`, from the consumer to the provider, as its owners
  declared them on Repositories & approvers. Nothing is inferred. Each edge carries **what crosses it
  now**: the PRDs on the Ledger (not shipped, not at retro) that touch both of its ends, counted and
  listed.
- **What a PRD touches:** a repository where it has a stage row (`prd_stages`), or where its feature
  branch (or one of its landings) has an open pull request. Its home repository always counts.
- **A star's state**, the worst of the PRDs touching it, in this order:
  1. `drifted`: a ◆ PRD touching it whose approval a push voided (the Ledger's `drifted`);
  2. `on-you`: a PRD touching it is on the Ledger's *On you* lane, so it waits on the viewer. Only
     this state moves on the page (it pulses);
  3. `building`: a PRD touching it is at `building`;
  4. `quiet`: none of these.
  A star whose phase 0 is `pr` is also **docked**, whatever its state: it carries a tether to each of
  its open phase-0 pull requests (`◇ <repo>#<n> · phase 0`), linked to GitHub.
- **Layout:** fixed, with no physics and no randomness, so a reload never moves a star. Stars are
  ranked by how many links consume them (most first), ties by name; the first sits at the centre of a
  960 × 500 sky, the rest on one ring around it (two rings past 8 stars), evenly spaced, in rank order
  starting at the top. Edges are quadratic curves bent away from the centre, so two edges between the
  same pair never overlap.
- **The filter:** `?prd=<dossier>` lights one PRD: its stars and the edges between them keep their
  colour, every other star and edge fades. An unknown value reads as no filter. `?star=<owner/name>`
  selects one star; an unknown value selects none.

**3. How it draws** (`ConstellationTab.tsx`, `constellation.css`), every colour a token of
`src/ask/theme-tokens.ts`, so it reads in Omni, Light and Dark:

- Under the tabs, the lede *How the product looks now.*, the chip `read only` on the sky, and the stamp
  `as of HH:MM UTC`, the time the request was rendered.
- **The filter row:** `Everything`, then one chip per PRD on the Ledger, newest first, each a link
  that sets `?prd=` (the chip in force marked `aria-current`).
- **The sky:** an inline SVG on `--ask-sunk`, with `role="img"` and an `aria-label` naming the
  product and its counts. Each star is a link (`?star=`), 44 px or larger to tap, labelled with its
  name and role. Its ring tells its state: `--ask-green` building, `--ask-yellow` on you (the
  Ledger's own colour for what waits on a person), `--ask-red` drifted; a docked star is drawn hollow
  in `--ask-muted` with the word `DOCKED` and its dashed tether; a star also in another product wears
  a dashed `--ask-plasma` halo. An edge is `--ask-line-strong`; an edge between two building stars
  carries three dots moving from consumer to provider. Its label reads
  `<consumer> → <provider> · <k> PRDs in flight` (`· nothing in flight` at zero).
- **The legend**, under the sky: building, waits on you, drifted, docked · phase 0 by pull request,
  also in another product.
- **The side card**, beside the sky from 900 px, under it below:
  - no star selected: **Now in <product>**, one line per PRD on the Ledger touching any star, worst
    state first (drifted, on you, building, the rest), each `<n> <state word> · <its stars>` linking
    to its PRD page; then one line per docked star with its phase-0 pull requests; then *Read only. Links live on
    Repositories & approvers.*
  - a star selected: its name, then `role`, `phase 0` (`◆ approved on the PRD page` or
    `◇ docs-only phase-0 pull request`), `also in` (the products, or `no other product`),
    `consumes` and `consumed by` (each edge with what crosses it now), and `now` (the PRDs touching
    it, each with its state word, linking to its PRD page); then `Ledger rows →` (the Ledger)
    and `Its links →` (Repositories & approvers). And the line *Read only.*
- **Motion** (the pulse of an on-you ring, the dots on building edges) is CSS only, and stops under
  `prefers-reduced-motion: reduce`: the ring holds its colour, the dots are not drawn.
- **Below 600 px** the sky is drawn 680 px wide inside its own frame, which scrolls sideways and opens
  centred, as the tour does; the page itself never scrolls sideways, and the side card sits under the
  legend.
- **Empty states:** no repository linked: *No repository is in this product yet.* and the link
  *Add one on Repositories & approvers*, and no sky. Repositories but no `consumes` declared: the stars
  alone, and under the legend *No repository consumes another yet.* and the link *Declare edges on
  Repositories & approvers*.

**4. The demo.** `demoProductHome('demo-product-1')` gains four linked repositories (`acme/widgets`,
`acme/widgets-api`, `acme/widgets-web` with phase 0 `pr` and an open phase-0 pull request,
`acme/auth` also in a second product), their `consumes`, and its PRDs touching them, so
`pnpm galaxy:dev` and the screenshot script show every state.

**5. The guide.** `docs/guide/products.md`'s table of the product home's tabs gains the Constellation
row.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | arcade route | `constellation` (tab id and segment) | `ORDER` and `TABS` ← `apps/galaxy/src/product-home/tabs.ts:10` |
| vertuo-omni-loop | arcade service | `constellationOf`, `Constellation`, `Star`, `Edge`, `StarState` | no written convention: follows `apps/galaxy/src/product-home/product-home.service.ts` (`Ledger`, `LedgerRow`, `LedgerState`) |
| vertuo-omni-loop | arcade storage | `StoredLink`, `StoredOtherLink`, `StoredPhase0` and their `*_COLUMNS` | `StoredPull`, `PULL_COLUMNS` ← `apps/galaxy/src/product-home/product-home.repository.ts:94` |
| vertuo-omni-loop | arcade component | `ConstellationTab.tsx`, `constellation.css` | no written convention: follows `apps/galaxy/src/product-home/HomeTabs.tsx` and `product-home.css` |
| vertuo-omni-loop | ids | `prd: PrdNumber`, `pr: PrNumber` | conventions › Naming ← `.omni-loop/knowledge/playbook/conventions.md` |
| vertuo-omni-loop | library screen | `product-constellation` | no written convention: follows `.omni-loop/knowledge/design/screens/product-repositories.md` |

## Decisions

- **Edges are the declared `consumes`, not inferred** (the person, against the concept's "inferred from
  merged PRs"). The tab stays a pure read of rows that exist; nobody draws edges by hand there, owners
  declare them on Repositories & approvers. Inferring co-change edges is left out.
- **No "visiting" star** (the person). PRD 1364 made a repository many-to-many with products, and
  `consumes` links only repositories of the same product (`product_repositories_consumes_linked`), so
  nothing is a guest. A repository also linked to other products is marked *also in X, Y* instead.
- **The tour's full live state** (the person): building ring, the pulse for what waits on the
  viewer alone, drifted, docked with its tether, the PRD filter, dots on building edges, all motion off
  under reduced motion.
- **Refreshed on load, with an `as of` stamp** (the person): no polling, no GitHub call. The App quota
  is the concept's pain.
- **The voice's objection, accepted.** persona:B-E DEv objected: *"A starfield with particles is the
  fluff I expected from this tool. Unless a line tells me which repository breaks when another
  changes, I won't open this tab twice."* Settled `accepted`: every edge says what crosses it now
  (`· 2 PRDs in flight`), and the star card lists `consumes` and `consumed by` with them.
- **The sky uses the reading tokens, not the tour's own night sky** (agent, the most reversible):
  the design form says the app pages use Ask's tokens and the galaxy's colours "only as signals", so
  the sky is `--ask-sunk` in every theme and the stars' colours are the Ledger's state colours. In Omni
  `--ask-yellow` is magenta: on-you reads magenta there, as it does on the Ledger.
- **Links, not script, for the filter and the selection** (agent): `?prd=` and `?star=` keep the tab
  server-rendered, shareable and usable without JavaScript, like the other tabs.
- **The phase-0 tether reads the kit's default branch shape** `docs/phase-0-<topic>` (agent): the
  server holds no per-repository branch config; a repository with another shape shows docked with no
  tether.
- **No co-sign per edge.** The concept leaves it for later, as an opt-in.
- **Screens:** the "after" is a new draft library screen, `product-constellation`; no locked screen
  is touched.

## User stories

- As a PM (persona:Irisa, persona:Paul - Product Manager), I open my product's Constellation tab and see
  which of its repositories are building, which one waits on me, and which still review phase 0 by pull
  request, without reading the Ledger row by row.
- As a lead engineer (persona:Lead Engineer), I filter on one PRD and see the repositories and edges it
  crosses.
- As a back-end developer (persona:B-E DEv), I tap my API's star and read which repositories consume it
  and how many PRDs in flight cross each of those edges.
- As a member of two products, I see that a repository is also in the other one.

## Scope

In:

- the `constellation` tab in `tabs.ts`, its segment matched by the existing `[tab]` route, which passes
  `prd` and `star` from the search parameters;
- the four reads in §1 in `product-home.repository.ts`, their zod schemas, and the rows passed to the
  service;
- `constellation.ts` (the pure map), `ConstellationTab.tsx`, `constellation.css`, the dispatch in
  `ProductHome.tsx`;
- the demo's repositories (§4), the guide's row (§5), the draft screen `product-constellation`.

Out:

- inferred edges; co-sign per edge; a client-side refresh or polling; editing anything from the tab;
- a Constellation across products or across the workspace;
- any migration: no table, column or function changes.

## Test seams

Following `omni kb show testing`: tests beside the code under `apps/galaxy/src/`, on fixtures, never
calling GitHub or Supabase.

- **`constellation.test.ts`** (the rule, a pure module): the stars and their roles, phase 0 and
  "also in"; one edge per `consumes` entry, consumer to provider; what a PRD touches (stage row, open
  feature PR or landing, home repository); a star's state, worst first (drifted over on-you over
  building), a shipped PRD touching nothing; docked with and without an open phase-0 PR; what crosses
  an edge; the layout the same on two calls and by rank; `?prd=` and `?star=` with known and unknown
  values; the two empty states.
- **`product-home.repository.test.ts`** (storage): the new reads against a stubbed client, an answer
  out of shape throwing, as the existing reads are tested.
- **`constellation.render.test.ts`** (the tab, as `product-home.render.test.ts` renders): the filter
  chips and `aria-current`, a star as a link with its label, the card with and without a selection,
  the empty states' words and links, the edge labels, `DOCKED` and its tether, the reduced-motion rule
  in the stylesheet.
- **`tabs.test.ts`**: the tab second in the row, at `/constellation`.
- The existing guards hold it: `design-system.test.ts` (no colour of its own), `page-width.test.ts`
  (the full width), `theme-tokens.test.ts`.

## Risks

**What merging publishes:** a merge to `main` deploys `apps/galaxy` to production (releasing ›
What a merge publishes): every product home gains the tab. No migration, no kit change, no App change.
**Rollback:** revert the merge commit; the release deploys the arcade without the tab. Nothing is
stored, so nothing is left behind.

- **A read row-level security refuses** (another product's links): the "also in" mark would read
  empty, never wrong. The reads go as the signed-in member, so a member sees only what they may.
- **Many repositories:** past 16 stars the labels crowd. The rings keep stars apart; a product of more
  than 16 repositories is rare today and its stars still draw, labels shortened to the repository's
  name.
- **Motion:** the pulse and the dots are CSS only and stop under reduced motion.

The locked laws: `omni kb laws --paths` on the files this design changes or adds says no rule governs
them; it lists the 20 locked laws of the repository, each of which needs @pierrederval to approve a
pull request that changes it. The two closest to this tab:

- N-PRODUCT-17: if a secret reached the browser, anyone opening the arcade could read a key that
  controls the database. The tab renders on the server as the member and sends no key; changing the
  law needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-63: if an agent link read repositories outside its workspace, another team's work could
  leak. The tab reads only as the signed-in member, through row-level security; changing the law needs
  @pierrederval to approve the pull request on GitHub.

The others (BR-PRODUCT-3, 5, 6, 12, 28, 29, 39, 59, 64, 94, N-PRODUCT-3, 4, 7, 8, 13, 14, 15, 16) are
not touched by this design.

## Acceptance criteria

No harness: acceptance is off in this repository; each criterion becomes ordinary tests.

1. A product home's tab row reads Ledger, Constellation, PRDs, Ideas, Roadmap, Bug fixes, Visual
   fixes, Questions, Repositories & approvers, and Constellation opens `/app/products/<id>/constellation`.
2. The tab draws one star per repository linked to the product and one edge per declared `consumes`
   entry, from consumer to provider, each edge labelled with how many PRDs in flight touch both ends.
3. A star touched by a PRD at `building` has a green ring; by a PRD on the viewer's *On you* lane, a
   pulsing ring in the Ledger's waiting colour; by a ◆ PRD whose approval was voided, a red ring;
   drifted wins over on-you, which wins over building.
4. A repository whose phase 0 is `pr` shows `DOCKED`, with a tether to each open phase-0 pull request
   of the product's PRDs in it, linked to GitHub.
5. A repository also linked to another product wears the "also in" halo, and its card names those
   products.
6. `?prd=<dossier>` keeps that PRD's stars and edges lit and fades the rest; `?star=<owner/name>`
   opens that star's card (role, phase 0, also in, consumes, consumed by, now); unknown values change
   nothing.
7. Two loads of the same rows place every star at the same point.
8. With no repository linked, the tab says so and links to Repositories & approvers; with no
   `consumes`, it draws the stars and says where to declare edges.
9. Under `prefers-reduced-motion: reduce`, nothing on the tab moves.
10. At 393 px wide the page has no horizontal scroll (only the sky's own frame scrolls) and the side
    card sits under the sky; every colour is a reading token, in Omni, Light and Dark.
11. The tab makes no GitHub call and changes nothing.
