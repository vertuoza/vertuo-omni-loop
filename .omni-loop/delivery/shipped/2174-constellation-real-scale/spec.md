---
prd: 2174
title: The Constellation at real scale
blocked-by: none
spec: file
phase0: server
---

# The Constellation at real scale

**Date:** 2026-10-19 · **PRD:** #2174 · **Reworks:** PRD #2129 (`constellation-tab`, concept #1269), hidden
by #2166 · **Touches:** `supabase/migrations/` (one table, its backfill, the plan-push step),
`supabase/checks/`, the `supabase` workflow, `apps/galaxy/src/product-home/` (the reads, the map, a
layout, the tab), the design form, `docs/guide/products.md`.

## Problem

PRD 2129 shipped a Constellation tab that is unusable on a real product. On Vertuoza (18 repositories,
no declared `consumes`, about 15 PRDs in flight), reproduced with an 18-repository fixture:

- **The layout breaks past about 8 repositories.** A fixed 960 × 500 sky with two rings (radii 120 and
  215) puts stars about 84 px apart while their labels are about 180 px wide: names, `no role` and
  `DOCKED` print over one another. 2129's spec called a product of more than 16 repositories rare.
- **It draws no line.** Lines come only from declared `consumes`, and Vertuoza declares none, so the
  map says nothing about how its repositories work together, the reason the tab exists.
- **A wall of chips.** One full-title chip per PRD in flight pushes the map below the fold.
- **Colours that mislead.** The "also in" halo is dashed yellow, the tour's colour for "waits on you";
  `DOCKED` is on two thirds of the stars, so it says nothing.
- **Not the concept's sky.** 2129 drew it with the reading pages' tokens: hollow circles on a flat
  panel, nothing of the concept tour's night sky.

#2166 took the tab out of the row; its address still answers.

What the product does know: a multi-repository PRD's plan names the repositories it targets, in its
`## Repositories` table (a plan repository's PRDs, such as nimbus-plan's, and product PRDs
like `mobile-12`). The latest plan of every PRD is on its dossier (`dossier_versions`, kind `plan`),
and the database already parses that table on every plan push (`plan_repository_names()`, called by
`dossier_link_repositories()` from the `dossier_versions_product` trigger), but only to link the
repositories to the product; nothing keeps them per PRD.

## Solution

**1. Each PRD's targets, stored once** (one migration, `supabase/migrations/<next>_prd_targets.sql`).

- A table `prd_targets`: one row per PRD dossier and repository, `dossier_id` and `repository`
  (`owner/name`), with `workspace_id`, primary key `(dossier_id, repository)`, indexed by
  `(workspace_id, repository)`.
- **Written on each plan push.** `dossier_link_repositories()` already resolves the latest plan's names
  to `owner/name` (under the home repository's owner, else the workspace's only repository of that
  name). It now also replaces the dossier's `prd_targets` rows with the repositories the plan's
  `## Repositories` table names, resolved, for any dossier, with or without a product. The home
  repository is **not** added: a plan repository's PRDs have it as their home, and it would tie the plan
  repository to every target; a plan repository names itself in that table only when a slice lands in
  it. The resolution is unchanged, and so is the product linking it already does.
- **Backfilled once** by the migration, for every dossier with a plan version, from its latest plan.
- **Read** by every member of the dossier's workspace, under the same rule as `dossiers`; written only
  by that step (security definer), never by a client.
- A shipped PRD's plan no longer changes, so its rows never change after it ships: the page reads rows,
  never plan text.

**2. The map's rule** (`apps/galaxy/src/product-home/constellation.ts`, pure, reworked):

- **Stars:** one per repository linked to the product, as in 2129 (role, phase 0, also in, docked, its
  tethers), and its **weight**, the number of the product's PRDs whose targets include it.
- **Plan lines:** every PRD of the product (shipped, or in flight on the Ledger) whose targets name two
  or more of the product's repositories draws one line per pair of them. A line's **weight** is how
  many PRDs share the pair, and it lists them, newest first. A line is **in flight** when one of its
  PRDs is in flight. A target outside the product's repositories draws nothing, and the star card
  counts it (`1 target outside the product`). A PRD with fewer than two targets draws no line.
- **Declared `consumes`** stay, drawn apart: one thin line per entry, consumer to provider.
- **Star states** as in 2129 (drifted, on you, building, quiet, worst first), from the Ledger.
- **Selection:** `?star=<owner/name>` selects a star, `?pair=<owner/name>,<owner/name>` a plan line (in
  either order); an unknown value selects nothing. The PRD filter (`?prd=`) is gone.
- **Now:** the PRDs in flight touching a star, worst first, the first 8, and how many more.

**3. The layout** (`apps/galaxy/src/product-home/layout.ts`, pure, new): a seeded force layout computed
on the server.

- Stars start on a seeded spiral (the seed is the product's id), then run a fixed 300 steps: every pair
  of stars repels, every plan line pulls its two ends together by its weight, a weak pull holds all
  toward the centre, and each star's label box (its name at 13 px mono, measured as 7.8 px a character
  plus its star, 66 px tall from 24 px above the star's centre) repels every other one.
- Then a **separation pass** that only separates: each pair of overlapping boxes moves apart by its whole
  overlap along the shorter axis, every box kept 8 px inside the sky, until none overlaps (at most 400
  rounds). A prototype of exactly this gave no overlap at 1, 5, 18 and 30 stars, with and without
  lines, and drew the "after" of the before/after page. Its constants, which the slice starts from:
  repulsion `26000 / d²` between stars; a line pulls `0.004 × min(weight, 6) × (d − 150)`; the centre
  pulls `0.004` across and `0.008` down; a step moves a star at most `30 × (1 − step / 300) + 2` px; the
  spiral start is the golden angle (2.4 rad) with radius `40 + 54 × √i`, flattened to 0.7 vertically.
- The sky is 960 wide; its height is `max(500, 120 × ceil(n / 4))` for `n` stars, so a product of 18
  repositories gets 600 and one of 30 gets 960.
- The same rows always give the same map. No randomness outside the seed, no time.

**4. The night sky** (`ConstellationTab.tsx`, `constellation.css`), the concept tour's look:

- **The sky:** a deep radial gradient of the galaxy colours `@omni/design` already exports (`--void`,
  `--deep`, `--starfield`), a faint nebula of `--plasma`, `--cyan` and `--magenta` at low opacity, and a
  field of background stars placed by `makeStarfield()` with the product's id as seed. It is dark in
  Omni, Light and Dark alike; the text inside it uses the galaxy colours. The design form's
  **Deliberate** section gains this line, as HOME's starfield has one.
- **Stars:** a glowing core (a radial gradient) in three sizes by weight (light, medium, heavy: the
  thirds of the product's weights); its state ring around it: `--green` building, `--yellow` waits on
  you (the only thing that pulses), `--red` drifted; a star also in another product wears a dashed
  `--plasma` halo; a docked star's core is `--slate`, with no word on it. Under it, its name; its role
  only when it has one. Each star carries a `<title>`, `<name> · <k> PRDs · ◆` (or `◇`), and is a link (`?star=`), 44 px
  or larger to tap.
- **Plan lines:** curves 1.5 to 5 px wide by weight; a shipped-only line dim `--dim`, an in-flight one
  `--cyan`, with three dots moving along it. Each is a link (`?pair=`) with a `<title>`
  (`nimbus-apps ↔ nimbus-backend-php · 7 PRDs`). **Consumes lines:** 1 px `--slate`, an arrowhead at
  the provider.
- **Motion, capped** (the voice): at most 60 background stars twinkle, CSS only; the motion pauses
  while the tab is hidden; under `prefers-reduced-motion: reduce` nothing twinkles, pulses or flows.
- **Above the sky:** the lede *How the product looks now.*, the count `18 repositories · 42 lines`, and
  `as of HH:MM UTC`. No filter row.
- **Legend**, under the sky: building, waits on you, drifted, docked · phase 0 by pull request, also in
  another product, a plan line (PRDs that changed both), a consumes line.
- **Side card**, beside the sky from 900 px, under it below:
  - nothing selected: **Now in <product>**, the first 8 PRDs in flight worst first, each linking to
    its PRD page, then `+ <k> more on the Ledger →`; then each docked star with its phase-0 pull
    requests;
  - a star: its card as in 2129 (role, phase 0, also in, consumes, consumed by, now), plus `lines`
    (its plan lines, heaviest first, each linking to `?pair=`) and, when any, `<k> targets outside
    the product`;
  - a line: its two repositories, then every PRD sharing it, newest first, each linking to its PRD
    page and marked `in flight` when it is.
- **No line at all:** the stars draw, and under the legend *No PRD's plan names two repositories yet.*
- **Below 600 px** the sky is drawn 680 px wide inside its own frame, which scrolls sideways and opens
  centred; the page never scrolls sideways.

**5. Back in the row.** The last slice removes `constellation` from `HIDDEN` in `tabs.ts`, so the tab
is second in the row again, and restores its row in `docs/guide/products.md`, describing the plan lines.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | database | `prd_targets` (`dossier_id`, `workspace_id`, `repository`) | `product_repositories` ← `supabase/migrations/20261129090000_product_repositories.sql:25` |
| vertuo-omni-loop | migration | `<next>_prd_targets.sql`, the next free version after `main`'s newest | conventions › A new migration takes the next free version ← `.omni-loop/knowledge/playbook/conventions.md` |
| vertuo-omni-loop | database check | `supabase/checks/prd_targets.sql`, its own step in the `supabase` workflow | conventions › A new database check runs in CI ← `.omni-loop/knowledge/playbook/conventions.md` |
| vertuo-omni-loop | arcade service | `layoutOf`, `PlanLine`, `ConsumesLine`, `weight` | no written convention: follows `apps/galaxy/src/product-home/constellation.ts` (`constellationOf`, `Edge`, `Star`) |
| vertuo-omni-loop | arcade storage | `StoredTarget`, `TARGET_COLUMNS` | `StoredPull`, `PULL_COLUMNS` ← `apps/galaxy/src/product-home/product-home.repository.ts:94` |
| vertuo-omni-loop | route query | `?pair=` | `?star=` ← `apps/galaxy/app/app/products/[id]/[tab]/page.tsx:32` |
| vertuo-omni-loop | library screen | `product-constellation` (its draft brought up to this design) | `.omni-loop/knowledge/design/screens/product-constellation.md` |

## Decisions

- **Lines from the plans' targets** (the person): "look at the PRD that touched multiple repo based on
  the plan (as in automation plan for example, it has the targets)". 2129's declared-only rule drew
  nothing on a product that declares no `consumes`.
- **Stored once per PRD, not parsed per page load** (the person asked whether one function would be
  fast enough, and noted a shipped PRD's plan no longer moves): a function re-parsing every PRD's
  latest plan would run megabytes of plan text through regular expressions on each visit. The rows are
  written in the step that already resolves them on every plan push, and backfilled once.
- **Every shipped PRD, and those in flight** (the person: "all shipped PRD for now"; the in-flight ones
  added to answer the Lead Engineer's objection, below).
- **Declared `consumes` kept, drawn apart** (the person).
- **A seeded force layout** (the person), with a label-overlap check in its tests at 1, 5, 18 and 30
  repositories: the check 2129 lacked.
- **The tour's night sky** (the person), a deliberate exception to the reading-page tokens, recorded
  in the design form; dark in every theme.
- **No PRD filter** (the person): selecting a star or a line is enough.
- **The voice's objections:**
  - persona:Lead Engineer, on section 1: *"If the lines only count shipped work, the map shows last
    quarter's coupling, not what my teams are touching this week."* Settled `accepted`: PRDs in flight
    draw their lines too, brighter, with moving dots.
  - persona:F-E Developer, on section 2: *"A permanently dark, animated sky dropped into my Light theme
    looks like the arcade leaking into the app. And if it animates a few hundred SVG nodes on every
    visit, I'll feel it on my laptop."* Settled `accepted` in part: the sky stays dark (the person's
    choice), the motion is capped at 60 twinkling stars, CSS only, paused while the tab is hidden, none
    under reduced motion.
- **`?pair=` for a line's card** (agent, the most reversible): the B-E DEv objection 2129 accepted
  (a line must say what crosses it) holds for plan lines, and a link keeps the tab server-rendered.
- **The label width is estimated, not measured** (agent): 7.8 px a character of 13 px JetBrains Mono,
  so the server needs no font metrics; a name longer than 28 characters is cut with `…` and its
  `<title>` keeps it whole.
- **The home repository is not a target** (agent, found while drawing the after): a plan repository's
  PRDs are homed in it, so counting it would make nimbus-plan the hub of every line.
- **A PRD without a pushed plan draws no line** (agent): a PRD shipped before plans were pushed to its
  dossier has none, and nothing is read from git.
- **Screens:** the draft `product-constellation` is brought up to this design; no locked screen is
  touched.

## User stories

- As a PM of Vertuoza (persona:Irisa, persona:Paul - Product Manager), I open Constellation and see my
  18 repositories, none hidden under another's name, and which ones our PRDs change together.
- As a lead engineer (persona:Lead Engineer), I see the bright lines where work is in flight this week,
  over the dim history of what changed together.
- As a back-end developer (persona:B-E DEv), I tap the line between my API and the web app and read
  the seven PRDs that changed both.
- As a front-end developer (persona:F-E Developer), the tab stays quiet on my laptop and still under
  reduced motion.

## Scope

In:

- the migration (table, row-level security, the plan-push step writing it, the backfill), its check in
  `supabase/checks/` and its step in the `supabase` workflow, `supabase/database.types.ts` regenerated;
- the read of `prd_targets` in `product-home.repository.ts`, the reworked `constellation.ts`, the new
  `layout.ts`, `ConstellationTab.tsx`, `constellation.css`, `?pair=` in the tab route;
- the demo product's PRDs given targets, so `pnpm galaxy:dev` shows plan lines;
- the design form's Deliberate line, the draft screen, the guide's row, the tab back in the row.

Out:

- reading plans from git for PRDs whose dossier has no plan;
- co-sign per edge (the concept's later opt-in); any edit from the tab;
- a Constellation across products.

## Test seams

Following `omni kb show testing`: tests beside the code, on fixtures; no test calls GitHub or Supabase.
The database check runs against the local Supabase in CI.

- **`supabase/checks/prd_targets.sql`:** pushing a plan whose `## Repositories` names two repositories
  writes those two, and not the home repository; a new plan version replaces them; a name the workspace does not
  list writes nothing; the backfill writes the latest plan's rows for a dossier pushed before the
  migration; a member of another workspace reads no row; a client cannot write one.
- **`layout.test.ts`:** the same rows give the same points on two calls; **no two label boxes overlap,
  and no label box covers a star, at 1, 5, 18 and 30 stars**, with and without lines; heavier lines
  end closer than unlinked stars on average; the sky's height follows `max(500, 120 × ceil(n / 4))`.
- **`constellation.test.ts`:** a pair per two targets, weights, the newest-first list of a line; a line
  in flight when one of its PRDs is; a target outside the product dropped and counted; a PRD with one
  target drawing nothing; consumes lines apart; `?star=` and `?pair=` (either order, unknown); Now
  capped at 8 with the rest counted; star weights and their thirds.
- **`product-home.repository.test.ts`:** the `prd_targets` read against a stubbed client; an answer
  out of shape throws.
- **`constellation.render.test.ts`:** the sky's layers (gradient, nebula, field), at most 60 twinkling
  stars, the reduced-motion rule, no filter row, the count, every star and line a link with a
  `<title>`, the three cards, the no-line note.
- **`tabs.test.ts`** and `product-home.render.test.ts`: Constellation second in the row again.
- The guards hold: `design-system.test.ts` (the galaxy colours are `@omni/design`'s), `page-width`,
  `theme-tokens`, `scripts/migration-order.ts`.

## Risks

**What merging publishes** (releasing › What a merge publishes): the merge applies the migration to
production through the `supabase` workflow's `deploy` job, then deploys `apps/galaxy`. The backfill
reads every dossier's latest plan once, inside the migration.

**Rollback:** revert the merge commit, and add a follow-up migration that drops `prd_targets` and
restores `dossier_link_repositories()` as `20261129100000_prd_product.sql` defines it. Nothing else
reads the table. Hiding the tab again is the one-line `HIDDEN` change #2166 made.

- **The migration must be the newest when it merges** (conventions › A migration stays the newest
  until it merges): re-date it after `main`'s newest before the feature PR is marked ready.
- **The backfill's cost:** one pass over the latest plan of each dossier; plans are at most tens of
  kilobytes, so it runs in seconds.
- **A long name** is cut at 28 characters on the sky; its card and `<title>` keep it whole.
- **Motion:** capped and stopped as the voice asked.

The locked laws: `omni kb laws --paths` on the files this design changes or adds says no rule governs
them; of the repository's 20 locked laws, the two closest:

- N-PRODUCT-17: if a secret reached the browser, anyone opening the arcade could read a key that
  controls the database. The tab renders on the server as the member and the table is read under
  row-level security with the member's own sign-in. Changing it needs @pierrederval to approve the
  pull request on GitHub.
- BR-PRODUCT-63: if a read crossed workspaces, another team's PRDs could show on the map. `prd_targets`
  is read under the dossiers' workspace rule, and its check proves a stranger reads nothing. Changing it
  needs @pierrederval to approve the pull request on GitHub.

## Acceptance criteria

No harness: acceptance is off in this repository; each criterion becomes ordinary tests.

1. Pushing a plan whose `## Repositories` names repositories writes one `prd_targets` row per
   resolved repository, never the home repository on its own account; a newer plan replaces them; the migration backfills
   every dossier that has a plan.
2. A member reads the targets of their workspace's PRDs and no other's; no client writes one.
3. On a product, every PRD (shipped or in flight) whose targets name two or more of its repositories
   draws one line per pair; a line's width grows with the PRDs sharing it; a line one PRD in flight
   shares is bright with moving dots, the others dim.
4. Declared `consumes` draw as thin arrowed lines, apart from the plan lines.
5. At 18 and at 30 repositories, no two labels overlap and no label covers a star; two loads place every
   star at the same point.
6. The sky is the tour's night sky in every theme, at most 60 background stars twinkle, and under
   `prefers-reduced-motion: reduce` nothing moves.
7. There is no PRD filter. `?star=` opens a star's card with its lines; `?pair=` opens a line's card
   listing every PRD sharing it, newest first, in flight marked; unknown values select nothing.
8. *Now in <product>* lists at most 8 PRDs in flight, worst first, then how many more, linking to the
   Ledger.
9. With repositories but no line, the stars draw with *No PRD's plan names two repositories yet.*
10. The Constellation is second in the product home's tab row again, and the guide describes it.
11. At 393 px wide the page has no horizontal scroll (only the sky's frame scrolls); the tab makes no
    GitHub call and changes nothing.
