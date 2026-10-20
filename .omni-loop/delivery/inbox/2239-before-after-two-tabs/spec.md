---
prd: 2239
title: The before/after page in two tabs — Functional & design, and Technical
blocked-by: none
spec: file
phase0: server
---

# The before/after page in two tabs

**Date:** 2026-10-20 · **PRD:** #2239 · **Follows:** PRD 1584 (design memory, round 3), which split the
page into a Functional part and a Pixel perfect part. **Compared with:** PRD 0117 of
`vertuoza/vertuo-automation-plan` (fiscal years per subsidiary), whose page showed each repository's
table and GraphQL API as TODAY / AFTER code blocks, and `vertuo-backend-php`'s `plan-brief` skill, whose
brief gives a GraphQL change table and a before/after SDL block per type. **Touches:** a new
`kit/lib/before-after/` module, `kit/templates/before-after/page.html`, two new `omni` verbs,
`kit/lib/inbox/check-inbox.ts`, the skills `brainstorm` (step 5 and **Rework**) and `mega-brainstorm`
(step 6), `omni help`, and the rebuilt `kit/dist/`. **Out of scope:** the Omni page's iframe and its
sandbox policy (`apps/galaxy/src/dossier/page/sandbox.ts`), the word pass, the pixel-perfect review, and
every page already written.

## Problem

The before/after page is what a reviewer reads to approve a PRD before a line is built. Since PRD 1584,
its technical half reads worse than it did.

- **The technical part lost its shape.** Step 5 asks for a "Functional" part showing "the flow, the
  data, the exchange", and nothing more precise. A recent page (a quote's send history) gives each
  repository a "Today" and an "After" column of bullets in prose: `sendCount: Int (nullable) on
  QuoteBase, mapped from devis_nb_send…`. PRD 0117's page, written before that split, showed the
  `fiscalDate` table as a TODAY / AFTER code block, with the added column and index in green, and the
  `fiscalYears` query and `fiscalYearCreate` mutation as code, today beside after.
- **No fixed place for anything.** A reviewer who wants to know whether a PRD adds a column, or breaks
  a GraphQL client, reads the whole page each time: the sections, their order and their names change
  from one PRD to the next.
- **Product and technique are mixed.** The product reader (a PM, a designer) and the technical reader
  (a back-end or front-end developer, a lead) scroll through each other's half.
- **No diagram can be trusted to render.** The Omni page shows the page in an iframe whose policy
  allows no request at all (`default-src 'none'`, `apps/galaxy/src/dossier/page/sandbox.ts`), so a
  Mermaid script from a CDN never runs there, and Mermaid inlined is several times the
  `limits.beforeAfterMaxBytes` cap (512 000 bytes). Diagrams today are SVG the agent draws by hand.
- **Nothing checks it.** `omni check inbox` grades the page's size, and nothing else.

## Solution

### 1. Two tabs

Every new page holds two tabs, in this order: **Functional & design** (open when the page loads) and
**Technical**. The tabs work in CSS alone (two radio inputs and labels); an inline script only makes
`#technical` in the address open the second one. Each tab is a `<section data-tab="functional">` or
`<section data-tab="technical">`. The page's head carries `<meta name="omni-before-after" content="2">`,
which marks it as a page of this shape.

**Functional & design**, one block per service the PRD touches (`data-service="<name>"`):

- **Functional** (`data-section="functional"`): today beside after, in product words: the journey,
  what the person sees or gets. No identifier a product reader would not use.
- **Pixel perfect** (`data-section="pixel-perfect"`): the marked screens, today beside after, exactly
  as step 5 writes them now (`data-screen`, `data-primary`, the word pass, the drafts); or the one line
  `Pixel perfect: no screen changes`.

**Technical:**

- **Flow** (`data-section="flow"`), once for the page: a Mermaid `sequenceDiagram` or `flowchart` of
  the exchange between services, each datastore and each third party named. N/A when one service
  exchanges with nothing new.
- **Deploy order** (`data-section="deploy"`), once for the page: the order the services and
  migrations ship in, when there are several services or a migration. N/A otherwise.
- Then one block per service touched (`data-service="<name>"`), headed by its name and a badge of its
  role (`BACK-END`, `FRONT-END`, `DATABASE`, `CLI`, …), holding three sections:
  - **Database** (`data-section="db"`): a Mermaid `erDiagram` of the tables created, altered or
    dropped, and the parent each hangs off when the spec names it, listing only the columns the
    design names, each marked `+ added`, `- dropped` or `~ altered · was <old>`. Then, per table, a
    TODAY | AFTER code block of the table, an added line `add` (green), a removed line `del` (red,
    struck), an untouched one `ctx` (muted). Then the change table: `table · change · detail`, a row
    that needs a coordinated deploy (a dropped or renamed column, a column narrowed or made `NOT
    NULL`, a `NOT NULL` column added with no default) first, with a `coordinated deploy` badge.
  - **API / schema** (`data-section="api"`): the change table `element · kind · before · after ·
    service`, one row per element (a new type is one row), `kind` one of `added`, `changed`,
    `deprecated`, `removed`, a breaking row first with a `breaking` badge. Then, per touched type, at
    most six, breaking first, a BEFORE | AFTER block in the schema's own language (GraphQL SDL, an
    OpenAPI fragment, a TypeScript signature, a CLI's usage line), only the touched lines, `# …`
    standing for the rest, `# new type` in BEFORE for a created one and `# removed` in AFTER for a
    removed one.
  - **Behaviour** (`data-section="behaviour"`): the readers and writers whose result changes though
    their signature does not (PRD 0117's "Readers that look up the fiscal year containing a date"),
    today beside after, as a query or code.

A change is **breaking** when it removes an element, changes the type of an output, an argument or an
input field, changes an output's nullability, or adds a required argument or input field. A
deprecation never is. A repository's conventions pages may make the rule stricter, never looser: the
page follows them and says which page it followed under the table.

**Section states.** Every section carries `data-state`, one of three:

| state | when | body |
|---|---|---|
| `filled` | the design covers it | the content |
| `na` | the change does not touch it | `N/A — <one-line reason>` |
| `gap` | it applies, and the design does not settle it | `To settle — <what is missing, one line>` |

A service whose `db`, `api` and `behaviour` sections are all `na` shows them as the one line
`<service>: no technical change` (each section still in the page, with its state, collapsed into that
line), so a front-end-only PRD's Technical tab is not a wall of N/A.

**Service.** In `/omni:brainstorm`, a service is a deployable part of the repository, named as its
architecture form names it (here: `kit`, `galaxy`, `omni-app`, `supabase`). In `/omni:mega-brainstorm`,
it is a repository, headed by its name and its role.

### 2. `omni before-after new`

```
omni before-after new <n> --services <name>,<name>…
```

Writes `before-after.html` into PRD n's inbox folder from the kit's skeleton
(`kit/templates/before-after/page.html`, bundled into `kit/dist`): the head and its meta, the styles
(light and dark, the `add`, `del`, `ctx` lines, the badges, the tabs), the two tabs, and for each named
service its blocks with every section as `<!-- FILL -->`. It refuses, writing nothing, when the folder
does not exist, when a page is already there (unless `--force`), or when `--services` is missing or
empty. The skills write the page through it and never name the skeleton's path.

### 3. `omni before-after render`

```
omni before-after render <n>
```

Replaces each `<pre class="mermaid">` of PRD n's page with the SVG Mermaid draws for it, inline, the
source kept in a `data-source` attribute of a wrapper so a later render can redraw it. It draws in a
headless Chromium from the Playwright the repository installed, found the way the pitch's capture finds
it (`kit/lib/pitch/providers/capture/playwright.ts`), which loads one pinned Mermaid version from
jsDelivr: network is needed when the page is written, never when it is read. It prints one line per
diagram, `rendered <section> of <service>`, and exits 0.

- No Playwright, or Chromium does not start: exit 1, the page untouched, and the line
  `cannot render the diagrams: <why>. Install it: pnpm add -D playwright && pnpm exec playwright install chromium`.
- A diagram Mermaid refuses: exit 1, naming its section, service and Mermaid's first error line; the
  other diagrams are still drawn.

When a diagram cannot be drawn at all, the skill turns that section into `gap`, `To settle — diagram
not rendered: <why>`, with the source kept as text in a `<details>`, never as `<pre class="mermaid">`.

### 4. `omni check inbox`

For a page whose head carries `<meta name="omni-before-after" content="2">`, `omni check inbox` (and so
the phase-0 grading of the GitHub App, which reads the same rules) adds these violations, each naming
the file:

- a tab missing: `before-after.html: no "technical" tab`;
- a `data-section` inside a tab with no `data-state`, or a state other than `filled`, `na`, `gap`;
- a `<!-- FILL -->` left;
- a `<pre class="mermaid">` left: `before-after.html: 2 diagrams not rendered (omni before-after render 2239)`;
- a `src` or `href` that loads a resource (`<script src>`, `<link rel="stylesheet">`, `<img src>` that
  is not `data:`).

A page without the meta is graded as today, on its size alone: no PRD already in an inbox turns red.

### 5. The skills

- `/omni:brainstorm` step 5 is rewritten around the two tabs: it runs `omni before-after new` with the
  services the design touches, fills each section in one of its three states, runs
  `omni before-after render`, then the word pass. The pixel-perfect rules (the design form, the design
  memory, the marks, the drafts) move under the Pixel perfect section unchanged. With the design flag
  off, the Pixel perfect section is `na`, `N/A — design craft is off here`.
- **Rework** writes the page the same way. A reworked PRD whose page has no meta keeps its old shape,
  unless the person asks for the new one.
- `/omni:mega-brainstorm` step 6: one service per repository, `--services` taking the repositories the
  design touches, in the order the plan builds them.
- `omni help before-after` describes both verbs.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | CLI | `omni before-after new`, `omni before-after render` | no written convention: follows `omni pitch probe` and `omni design words`, a noun then a verb (`kit/bin/commands/pitch.ts`) |
| vertuo-omni-loop | kit library | `kit/lib/before-after/` | no written convention: follows `kit/lib/visual/`, one folder per feature |
| vertuo-omni-loop | kit defaults | `kit/templates/before-after/page.html` | no written convention: follows `kit/templates/playbook/` |
| vertuo-omni-loop | page | `data-tab`, `data-service`, `data-section`, `data-state` | no written convention: follows `data-screen` and `data-primary` (`design.words` in `.omni-loop/config.yml`) |
| vertuo-omni-loop | page | `<meta name="omni-before-after" content="2">` | no written convention |

## Decisions

1. **Diagrams: written as Mermaid, rendered to inline SVG by `omni`.** Chosen by the person over SVG
   drawn by hand (uneven), opening the iframe's policy to a Mermaid script (it loosens PRD 216's
   sandbox, and the page opened on GitHub or locally would draw nothing) and no diagram at all.
2. **Enforced: a skeleton and a check.** Chosen by the person over a skeleton alone and over skill text
   alone (what drifted).
3. **The check reads only pages of the new shape.** The meta marks them; pages already written pass as
   today. Approved by the person with section 2.
4. **The voice: Irisa objected** (`persona:Irisa`): a PM who does not master the technical harness
   should not land on a wall of N/A, nor click to see what the PRD changes for the customer.
   **Settled: accepted.** The Functional & design tab opens first, and a service with no technical
   change shows one line.
5. **Mermaid is loaded from jsDelivr when the page is rendered, at one pinned version.** The kit does
   not bundle Mermaid (its size, and `kit/dist` is committed). Reversible: a later PRD may vendor it.
6. **Six types at most per API section**, breaking first; the change table still lists every element.
   `plan-brief` stops at four; a multi-repository PRD often touches more.
7. **The breaking rule is the kit's own, generic**, not `vertuo-backend-php`'s ADR-0001: a target's
   conventions may make it stricter.
8. **Proof video: none** (the person said no).

## User stories

- As a PM reviewing a PRD, I open its page and read, on the first tab, what changes for the person who
  uses the product, and the screens today beside after, with no table or column name in my way.
- As a back-end developer, I open the Technical tab and see, per service, each table's columns today
  beside after with the added ones in green, and each GraphQL type's fields before and after, the
  breaking ones first.
- As a lead engineer, I see the flow between the services and the deploy order on one diagram before
  I read any service.
- As the agent writing the page, I start from a skeleton, fill each section in one of three states,
  render the diagrams with one command, and `omni check inbox` tells me what I left out.

## Scope

In: the skeleton, `omni before-after new` and `render`, the new rules of `omni check inbox` for
pages that carry the meta, the rewritten step 5 and Rework of `/omni:brainstorm`, step 6 of
`/omni:mega-brainstorm`, `omni help`, the rebuilt `kit/dist`.

Out: rewriting pages already written; the Omni page and its sandbox; the word pass and the
pixel-perfect review (they read `data-screen` and `data-primary`, which stay); `/omni:think-big`'s
`vision.html`; `/omni:visual-fix` and `/omni:bug-fix` pages; vendoring Mermaid.

## Test seams

Following `omni kb show testing`: a parser or a pure module gets a unit test, a command a test through
`main()` on a fixture repository (`makeRepo()` from `kit/test/fixture.ts`).

- **The page's grading** (`kit/lib/before-after/`, pure): fixture pages for each rule: a good page; a
  missing tab; a section with no state and with an unknown state; a `<!-- FILL -->` left; a
  `<pre class="mermaid">` left; an external `src`; a page without the meta (graded on its size only).
- **`omni check inbox`** through `main()`: a folder whose page breaks a rule is red and names it; the
  inbox folders already in the repository stay green.
- **`omni before-after new`** through `main()`: it writes a page `omni check inbox` accepts once the
  FILL markers are replaced; it refuses a missing folder, an existing page without `--force`, and an
  empty `--services`.
- **`omni before-after render`**: the browser is a provider passed in, as the pitch's capture is; a
  fake one returns a fixed SVG, so the test proves the replacement, the `data-source`, the lines it
  prints, the refusal with no browser, and a refused diagram among good ones. No test starts
  Chromium or reaches the network.
- **The bundle**: `kit/test/dist.test.ts` stays green after `pnpm kit:build`.
- **Mutation**: `kit/lib/inbox/` is delivery core: `pnpm mutation:changed` on the slice that changes it.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the kit. The one-line install and the plugin
  marketplace hand out the new verbs, the skeleton and the new skill text to every repository on its
  next update. Rollback: revert the merge; pages written in the new shape stay readable, and the old
  check ignores the meta.
- **A repository with no Playwright** cannot render a diagram: its pages carry the diagram as a `gap`
  with its source in text. Said once by `render`, with the install line.
- **Network when the page is written**: rendering fetches Mermaid from jsDelivr. A run with no network
  gets the same `gap`.
- **The page grows**: inline SVG is larger than the Mermaid source. Three diagrams of a usual PRD stay
  far under the 512 000-byte cap; the size check stands.
- **The GitHub App's phase-0 grading** reads the same rules: a ◇ repository's phase-0 PR whose page
  carries the meta and breaks a rule turns red, which is what the rule is for.
- The locked laws: none touched.

## Acceptance criteria

1. `omni before-after new 2239 --services kit` writes a page whose head carries the meta, with the two
   tabs in order, Functional & design first and open, and one block per service in each tab.
2. Opened on the Omni page, the page shows the Functional & design tab; clicking Technical shows the
   flow, the deploy order and each service's Database, API / schema and Behaviour sections, with no
   network request.
3. A Database section shows, per table, a TODAY | AFTER code block whose added lines are green and
   removed lines red and struck, under an `erDiagram` drawn as inline SVG.
4. An API / schema section shows the `element · kind · before · after · service` table with breaking
   rows first and badged, then a BEFORE | AFTER block per type, `# …` for untouched lines.
5. A service whose three technical sections are N/A shows `<service>: no technical change` on one line.
6. `omni before-after render <n>` replaces every `<pre class="mermaid">` with inline SVG and exits 0;
   with no Playwright it exits 1 with the install line and leaves the page untouched.
7. `omni check inbox` refuses a page carrying the meta that lacks a tab, has a section without a
   valid state, keeps a `<!-- FILL -->` or a `<pre class="mermaid">`, or loads an external resource,
   each violation naming the file; a page without the meta is graded on its size only.
8. `/omni:brainstorm` step 5 and `/omni:mega-brainstorm` step 6 write the page through
   `omni before-after new` and `render`, and the word pass still reads the Pixel perfect section's
   marked screens.
