# Knowledge map — plan

**PRD:** #149 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/knowledge-map` →
`main` (`Closes #149`) · **Sub-PRs:** `feat/knowledge-map--<slice>` → the feature branch
(`Part of #149`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Build order:**
- **Wave 1 is the tracer.** s1 makes the graph exist end to end: the kit builds it from its one
  parser and prints it (`omni kb graph`, `--json`), and the web app can load it on the server, typed,
  with the files traced into a deployment.
- **Wave 2** shows it twice, on two sides that share no file: the plain `/knowledge` page (s2) and
  the arcade's star chart (s3).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The graph exists: `kit/lib/knowledge/graph.mjs` builds, from what `readKnowledge` returns, the domains with their counts, every entry (kind, domain, statement, why, status law or proposed, serves, enforced, PRD, file; cross-domain entries with their pair), the `serves` and `cites` links between existing entries, the loose entries and the unserved principles; `omni kb graph` prints the summary and `omni kb graph --json` the whole document (`version: 1`, `repo`, `domains`, `entries`, `links`); an absent folder is an empty graph; the kit README's paragraph; `kit/dist/omni.mjs` rebuilt; in `apps/galaxy`, the graph's types and pure helpers (`src/data/knowledge.ts`: systems, orbits by kind in id order, served-by, the filter) and the server-only loader (`src/data/load-knowledge.ts`: the graph of the deployed checkout through the kit, `null` and a log line when the config or the folder cannot be read), with the config and the knowledge folder traced by `outputFileTracingIncludes` in `next.config.mjs` | `kit/lib/knowledge/graph.` `kit/bin/commands/kb.` `kit/bin/kb.test.mjs` `kit/README.md` `kit/dist/omni.mjs` `apps/galaxy/src/data/knowledge.` `apps/galaxy/src/data/load-knowledge.` `apps/galaxy/next.config.mjs` | — | 1 |
| s2 | The plain page: `/knowledge` on the ask pages' reading surface (their theme tokens, faces and theme switch), gated like the galaxy (demo reads the local checkout, closed says the map is not open here, signed out gets the sign-in card that returns to `/knowledge` through its own callback route, signed in without crew gets the crew-only notice, the crew gets the map); the top bar (`OMNI LOOP · Knowledge map`, the repository, a link to `/#chart`, the theme switch); domain tabs with counts and **Between domains** when there are cross-domain entries; the SVG orrery (principles inner, rules middle, invariants outer; law filled, proposed hollow; a colour per kind at 3:1 or more against the ground in both themes; faint `serves` links, strong for the selection); the detail panel; the index grouped by principle with loose entries and unserved principles; the filter; selection kept in `?domain=&entry=`; phone width stacks and scrolls vertically | `apps/galaxy/app/knowledge/` `apps/galaxy/src/knowledge/` | s1 | 2 |
| s3 | The star chart: `drawSun` in `@omni/sprites`; the STAR CHART menu item after GALAXY MAP with `<n> SYSTEMS · <m> WORLDS`, `OUT OF REACH` without a graph; the `chart` scene (a sun per domain sized by its entries, labels and counts, dotted cross-domain lanes, the D-pad between suns, A into the system, B to the menu, the footer naming `/KNOWLEDGE`) and the `system` scene (the orbit layout with spilling orbits and shrinking planets, laws terraformed and proposed barren, ◀▶ along an orbit, ▲▼ to the nearest in angle, taps, the selection's links, the panel, the reading card paged by ▲▼), both on the wide and the tall grid and gated like the map; the arcade page passing the graph to the crew and the demo only, the artifact passing none (`NO STAR CHART IN THIS BUILD`); the `#chart` deep link; the screenshot script walking both scenes; the arcade README describing the star chart, the `/knowledge` page, their data and who sees them | `apps/galaxy/src/arcade/` `packages/sprites/src/` `apps/galaxy/app/page.tsx` `apps/galaxy/artifact/` `apps/galaxy/scripts/shots.mjs` `apps/galaxy/README.md` | s1 | 2 |

**Shared ground.** None. s1 alone owns `apps/galaxy/src/data/knowledge.` and
`apps/galaxy/src/data/load-knowledge.`; s2 and s3 only import them. s2 owns the page's two folders,
s3 the arcade, the sprites, the arcade page, the artifact, the screenshot script and the README, so
the two wave-2 slices never touch the same path. `apps/galaxy/next.config.mjs` is s1's alone: it
traces the knowledge files for both routes up front.

## Per slice: done when

**s1**
- On a fixture knowledge folder (a `product/` folder, two domains and one cross-domain file), the
  graph holds every entry once with its kind, domain, status and PRD; a `Serves:` naming an existing
  principle is one `serves` link; one naming nothing is no link and a loose entry; an id cited in a
  statement or `Why:` is one `cites` link, a self-citation none; each domain's counts are right; a
  principle nothing serves is listed as unserved (AC 1).
- `omni kb graph --json` on a `makeRepo()` fixture prints one JSON document with `version: 1` and the
  fixture's slug; `omni kb graph` prints the domain line, the unserved principles and the loose
  entries; an extra argument exits 2; a repository without a knowledge folder prints an empty graph
  and exits 0 (AC 1).
- In this repository, `node .omni-loop/bin/omni.mjs kb graph --json` lists the `product` domain,
  every entry `omni kb status` counts, and 26 `serves` links (AC 1).
- The loader returns the graph for a temporary checkout, and `null` with one logged line when the
  config or the knowledge folder is missing. The helpers' tests pin the systems' order, the orbits
  by kind in id order, served-by and the filter.
- `kit/test/no-game-words.test.mjs` and `kit/test/no-literals.test.mjs` stay green; `pnpm test`
  passes with `kit/dist/omni.mjs` rebuilt; the arcade's `typecheck` and `pnpm galaxy:build` pass
  (AC 12).

**s2**
- The access rule, as a pure function: demo gives the local graph; closed gives the not-open
  notice; signed out gives the sign-in card returning to `/knowledge`; signed in without crew gives
  the crew-only notice; crew gives the map (AC 5).
- Rendered with `renderToStaticMarkup` on a fixture graph: every entry in the index grouped by
  principle, then the loose entries and the unserved principles; the first principle selected by
  default; the entry named by `?entry=` selected, with its statement, `Why:`, serves, served by,
  cites, PRD link, enforcement and file in the panel (AC 2, AC 3).
- The crew-only and sign-in states' markup holds no entry id and no statement (AC 5).
- The filter matches ids and words and marks every other dot dimmed (AC 4).
- Each kind colour holds at least 3:1 against the ground in the light and the dark theme (AC 6).
- By hand, on `pnpm galaxy:dev` (demo): clicking a dot and an index row updates the address; at
  393×700 the page has no horizontal scroll and scrolls down to the index; screenshots in both
  themes attached to the sub-PR (AC 3, AC 6).
- `pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build` pass, and the build's trace of
  `/knowledge` lists `.omni-loop/knowledge/product/rules.md` (AC 12).

**s3**
- The orbit layout, on the wide and the tall grid, with this repository's graph and with a
  synthetic domain of 150 entries: every entry seated, inside the diagram's region, no two planets
  overlapping; a crowded orbit spills outward (AC 7).
- On `system`, ◀▶ walk the orbit and wrap, ▲▼ reach the nearest planet in angle on the next orbit,
  and every planet is reachable from any planet; on `chart`, the D-pad reaches every sun (AC 8).
- `drawFrame` draws `chart` and `system` on both grids on the recorder context; both scenes are
  listed as tall; the text layers render the panel, the reading card (paged), the out-of-reach and
  the no-chart states (AC 7–10).
- `menuItems` lists STAR CHART after GALAXY MAP; without a graph it reads `OUT OF REACH` and does
  not open; the arcade page passes no graph to anyone but the crew and the demo (AC 7, AC 10).
- `drawSun` draws within its size, the same for the same seed.
- `/#chart` lands on the star chart; the chart's footer names `/KNOWLEDGE`; the arcade README
  describes the star chart, the `/knowledge` page, where their data comes from and who sees them
  (AC 11).
- `pnpm galaxy:shots` walks `chart` and `system` at 393×700, 852×393 and 1440×900 and reports no
  text under 8 CSS px; the screenshots are attached to the sub-PR (AC 9).
- `pnpm test`, the arcade's `typecheck`, `pnpm galaxy:build` and `pnpm galaxy:artifact` pass, and
  the build's trace of `/` lists `.omni-loop/knowledge/product/rules.md` (AC 12).
