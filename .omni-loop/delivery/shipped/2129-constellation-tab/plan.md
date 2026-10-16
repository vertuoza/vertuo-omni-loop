# Plan: The Constellation tab

PRD #2129, spec `spec.md` beside this plan. The feature branch `feat/constellation-tab` merges into
`main` with `Closes #2129`; each slice is a sub-PR from `feat/constellation-tab--<slice>` into the
feature branch, with `Part of #2129`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The Constellation tab draws the product's repositories as stars (role, ◆/◇, also in, docked) and its declared `consumes` as edges, in a fixed layout, with its two empty states, second in the tab row | `apps/galaxy/src/product-home/` `apps/galaxy/app/app/products/[id]/[tab]/` | — | 1 | build |
| s2 | The Ledger's states on the map: what each PRD touches, each star's state worst first, what crosses each edge, the `?prd=` filter, the `?star=` card, the *Now in* card and the motion, off under reduced motion | `apps/galaxy/src/product-home/` `apps/galaxy/app/app/products/[id]/[tab]/` | s1 | 2 | deep |
| s3 | A docked star's tether to each open phase-0 pull request of the product's PRDs, and the demo product's four repositories showing every state | `apps/galaxy/src/product-home/` | s2 | 3 | build |
| s4 | The guide's table of the product home's tabs gains the Constellation row | `docs/guide/products.md` | — | 1 | light |

**Shared ground.** `apps/galaxy/src/product-home/` is declared by s1, s2 and s3: they change the same
files (`constellation.ts`, `ConstellationTab.tsx`, `constellation.css`, `product-home.repository.ts`,
`product-home.service.ts`, `ProductHome.tsx`) and the same tests (`constellation.test.ts`,
`constellation.render.test.ts`, `product-home.repository.test.ts`, `product-home.render.test.ts`,
`tabs.test.ts`), so they run one after another, in waves 1, 2 and 3. `apps/galaxy/app/app/products/[id]/[tab]/`
(the route, which passes `prd` and `star`) is declared by s1 and s2, in waves 1 and 2. s4 shares no
ground and runs beside s1.

## Per slice: done when

### s1 (`ui: yes`)

- `tabs.test.ts`: the tab row reads Ledger, Constellation, PRDs, Ideas, Roadmap, Bug fixes, Visual
  fixes, Questions, Repositories & approvers, and Constellation's address is
  `/app/products/<id>/constellation` (criterion 1).
- `product-home.repository.test.ts`: the product's links (`repository`, `role`, `consumes`), the other
  products of those repositories with their names, and each repository's `phase0` are read against a
  stubbed client; an answer out of shape throws.
- `constellation.test.ts`: one star per linked repository with its role, phase 0 and "also in"
  (sorted); one edge per `consumes` entry, consumer to provider (criterion 2); a star with phase 0
  `pr` is docked; two calls on the same rows place every star at the same point, the most consumed at
  the centre, ties by name (criterion 7); no repository, and repositories with no `consumes`, give
  the two empty states (criterion 8).
- `constellation.render.test.ts`: each star is a link `?star=<owner/name>` labelled with its name and
  role, `DOCKED` on a docked star, the "also in" halo, the legend, the `as of HH:MM UTC` stamp, the
  `read only` chip, and the empty states' words and links to Repositories & approvers (criteria 5, 8).
- `design-system.test.ts`, `page-width.test.ts` and `theme-tokens.test.ts` stay green: every colour is
  a reading token, the page has no horizontal scroll at 393 px, only the sky's frame scrolls
  (criterion 10).
- No GitHub call and no write: the reads go through the product home's repository as the member
  (criterion 11).

### s2 (deep: which PRDs touch which repository, and the order of states, decide what the map tells; `ui: yes`)

- `constellation.test.ts`: a PRD touches its home repository, a repository where it has a stage row,
  and one where its feature branch or a landing has an open pull request; a shipped PRD or one at
  retro touches nothing; a star's state is drifted over on-you over building over quiet
  (criterion 3); each edge counts and lists the PRDs in flight touching both ends (criterion 2);
  `?prd=<dossier>` keeps that PRD's stars and edges lit and fades the rest, `?star=<owner/name>`
  selects one star, and unknown values change nothing (criterion 6).
- `constellation.render.test.ts`: the filter chips, `Everything` first, the one in force
  `aria-current`; the rings in `--ask-green`, `--ask-yellow` and `--ask-red`; the edge labels
  `<consumer> → <provider> · <k> PRDs in flight` and `· nothing in flight`; dots only on edges between
  two building stars; the *Now in <product>* card worst first, its PRDs linking to their PRD pages;
  the star card's role, phase 0, also in, consumes, consumed by and now, with `Ledger rows →` and
  `Its links →` (criteria 3, 6).
- The stylesheet stops the pulse and hides the dots under `prefers-reduced-motion: reduce`, and only
  an on-you ring pulses (criterion 9).

### s3 (`ui: yes`)

- `product-home.repository.test.ts`: the workspace's open pull requests whose head is
  `docs/phase-0-<topic>` of a product PRD's topic are read; an answer out of shape throws.
- `constellation.test.ts`: a docked star carries one tether per open phase-0 pull request in its
  repository; a docked star with none carries no tether; a non-docked star never carries one
  (criterion 4).
- `constellation.render.test.ts`: each tether reads `◇ <repo>#<n> · phase 0` and links to the pull
  request on GitHub; the *Now in* card lists each docked star with its phase-0 pull requests
  (criterion 4).
- `demoProductHome('demo-product-1')` has four linked repositories (`acme/widgets`,
  `acme/widgets-api`, `acme/widgets-web` docked with an open phase-0 pull request, `acme/auth` also
  in a second product) and PRDs touching them, so the demo's Constellation shows building, waits on
  you, drifted, docked and also in; a render test of the demo's tab proves each is drawn.

### s4 (light: one table row in the guide)

- `docs/guide/products.md`'s table of the product home's tabs has a **Constellation** row, second,
  saying it shows the product's repositories as stars, their declared `consumes` as lines and what is
  building, waits on you, drifted or docked on them, read only.
- `pnpm check:changed` is green on the guide (its docs checks included).
