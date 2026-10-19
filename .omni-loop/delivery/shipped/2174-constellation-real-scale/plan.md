# Plan: The Constellation at real scale

PRD #2174, spec `spec.md` beside this plan. The feature branch `feat/constellation-real-scale` merges
into `main` with `Closes #2174`; each slice is a sub-PR from `feat/constellation-real-scale--<slice>`
into the feature branch, with `Part of #2174`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Each PRD's plan targets are stored once: `prd_targets`, written on each plan push, backfilled, read by members only, proven by its database check in CI | `supabase/migrations/` `supabase/checks/prd_targets.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` | — | 1 | deep |
| s2 | The seeded force layout with its separation pass: the same rows give the same map, and no label overlaps at 1, 5, 18 and 30 stars | `apps/galaxy/src/product-home/layout` | — | 1 | deep |
| s3 | The map's rule reads the targets: plan lines per pair (weights, in flight, outside the product), consumes apart, star weights, `?star=` and `?pair=`, Now capped at 8, placed by the layout; the demo's PRDs get targets | `apps/galaxy/src/product-home/` `apps/galaxy/app/app/products/[id]/[tab]/` | s1, s2 | 2 | build |
| s4 | The night sky: the tour's gradient, nebula and seeded field, glowing stars by weight, state rings, plan lines and consumes arrows as links, the three cards, no filter row, capped motion | `apps/galaxy/src/product-home/` | s3 | 3 | build |
| s5 | The Constellation back in the tab row, the guide's row describing plan lines, and the design form's Deliberate line for the night sky | `apps/galaxy/src/product-home/` `docs/guide/products.md` `.omni-loop/knowledge/playbook/design.md` | s4 | 4 | light |

**Shared ground.** `apps/galaxy/src/product-home/` is declared by s3, s4 and s5, and its prefix covers
s2's `apps/galaxy/src/product-home/layout`: they change the same files (`constellation.ts`,
`ConstellationTab.tsx`, `constellation.css`, `product-home.repository.ts`, `product-home.service.ts`,
`ProductHome.tsx`, `tabs.ts`) and the same tests (`constellation.test.ts`,
`constellation.render.test.ts`, `product-home.repository.test.ts`, `product-home.render.test.ts`,
`tabs.test.ts`), so they run in waves 1 to 4, one after another. s2 owns only `layout.ts` and
`layout.test.ts`, and runs beside s1, which touches nothing under `apps/`. The tab route
(`apps/galaxy/app/app/products/[id]/[tab]/`) is s3's alone. `supabase/database.types.ts` is s1's alone.

## Per slice: done when

### s1 (deep: a migration that rewrites a trigger's function and backfills every dossier)

- The migration takes the next free version after `main`'s newest (`node scripts/migration-order.ts`
  green), creates `prd_targets` (`dossier_id`, `workspace_id`, `repository`, primary key
  `(dossier_id, repository)`, indexed by `(workspace_id, repository)`), its row-level security (members
  of the dossier's workspace read; no client writes), and redefines `dossier_link_repositories()` to
  also replace the dossier's rows with its latest plan's resolved `## Repositories` names, never the home
  repository on its own account, for a dossier with or without a product; the product linking is
  unchanged (criterion 1).
- The migration backfills every dossier that has a plan version from its latest plan (criterion 1).
- `supabase/checks/prd_targets.sql`, its own step in the `supabase` workflow's `check` job: a plan
  naming two repositories writes those two and not the home repository; a newer plan replaces them; a
  name the workspace does not list writes nothing; the backfill covers a dossier pushed before the
  migration; a member of another workspace reads no row; a client cannot write one (criteria 1, 2).
- `supabase/database.types.ts` regenerated with the table.
- Its header names its rollback: a follow-up migration dropping `prd_targets` and restoring
  `dossier_link_repositories()` as `20261129100000_prd_product.sql` defines it.

### s2 (deep: the layout decides whether the tab is readable at all; `ui: yes`)

- `layoutOf(stars, lines, seed)` in `layout.ts` follows the spec's §3: the golden-angle spiral start,
  300 force steps with the spec's constants, then the separation pass; the sky is 960 wide and
  `max(500, 120 × ceil(n / 4))` tall; a name longer than 28 characters is measured at 28.
- `layout.test.ts`: two calls on the same input return the same points; **no two label boxes overlap
  and no label box covers a star, at 1, 5, 18 and 30 stars, with and without lines**; on average two
  stars a line joins sit closer than two it does not; every box stays 8 px inside the sky; the sky's
  height for 1, 18 and 30 stars (criterion 5).

### s3 (`ui: yes`)

- `product-home.repository.test.ts`: the `prd_targets` rows of the product's PRD dossiers are read
  against a stubbed client; an answer out of shape throws.
- `constellation.test.ts`: a PRD whose targets name two or more of the product's repositories draws
  one line per pair; a line's weight and its PRDs newest first; a line is in flight when one of its
  PRDs is; a target outside the product draws nothing and is counted on its star; a PRD with one target
  draws nothing; declared `consumes` stay as their own lines; star weights and their thirds; `?star=`
  and `?pair=` in either order, unknown values selecting nothing; no `?prd=`; Now holds the first 8 PRDs
  in flight, worst first, and counts the rest; the stars sit where `layoutOf` puts them (criteria 3, 4,
  7, 8).
- The tab route passes `pair` and `star`, and no longer `prd`.
- The demo product's PRDs carry targets, so its Constellation draws plan lines, one in flight.

### s4 (`ui: yes`)

- `constellation.render.test.ts`: the sky's gradient, nebula and seeded field (the same field for the
  same product); at most 60 field stars carry the twinkle class; star cores in three sizes; the state
  rings and only the on-you ring pulsing; the also-in halo `--plasma`; a docked core with no word on
  it; the name under each star and the role only when set; every star and plan line a link with its
  `<title>` (`<name> · <k> PRDs · ◆`, `<a> ↔ <b> · <k> PRDs`); in-flight lines `--cyan` with moving
  dots, the rest dim; consumes lines with an arrowhead; no filter row; the count and the `as of`
  stamp; the Now card's `+ <k> more on the Ledger →`; the star card's lines; the line card's PRDs with
  `in flight`; the no-line note (criteria 3, 4, 6, 7, 8, 9).
- The stylesheet: under `prefers-reduced-motion: reduce` nothing twinkles, pulses or flows; motion
  pauses while the page is hidden; the sky frame scrolls sideways below 600 px and the page does not
  (criteria 6, 11).
- `design-system.test.ts`, `page-width.test.ts` and `theme-tokens.test.ts` stay green: the galaxy
  colours come from `@omni/design`'s tokens.

### s5 (light: the row, a guide row and a form line; `ui: yes`)

- `tabs.ts` no longer hides `constellation`: `tabs.test.ts` and `product-home.render.test.ts` read
  Ledger, Constellation, PRDs, … again (criterion 10).
- `docs/guide/products.md` has the Constellation row again, describing the plan lines, the consumes
  arrows and the cards.
- The design form's **Deliberate** section gains the night sky: the Constellation's sky stays dark in
  every theme, in the galaxy colours, as HOME's starfield does.
