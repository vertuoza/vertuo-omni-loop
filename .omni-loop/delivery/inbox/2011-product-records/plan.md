# Plan: Roadmaps, bugs and knowledge move into the product

PRD #2011, spec `spec.md` beside this plan. The work lands in three stacked pull requests into `main`,
one per record that moves: roadmaps (roadmaps), bug records (bug-records), then knowledge packs with
the cross-product views (packs-and-views). The plan repository is kept, and the old way keeps working. Each landing's branch is
`feat/product-records-<n>of3-<name>`, and each PR body opens with `Closes #2011`. Each slice is a
sub-PR from `feat/product-records--<slice>` into its landing's branch, with `Part of #2011`.

Every migration only adds, and nothing reads a new table or column before its own landing: landing 1
adds the roadmap dossier kind, its counter, text PRD ids and the ladder step; landing 2 the Fixes rows
and the bug counter; landing 3 the knowledge packs and the product's plan repository name.

## Slices

| id | slice | territory | blocked by | wave | landing | tier |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | A roadmap can be a dossier of kind `roadmap` with a product id `<key>-R<n>` from its product's own counter, `roadmap_prds.prd` holds `912` or `mobile-12`, a roadmap push adds a version only where a file changed, and each product repository link stores its rollout ladder step (1 to 5) | `supabase/migrations/` `supabase/checks/roadmaps.sql` `supabase/checks/product_repositories.sql` `supabase/checks/dossiers.sql` `supabase/database.types.ts` | — | 1 | 1 | deep |
| s2 | `omni roadmap push --product <key> --new` creates `mobile-R<n>` and prints it; a later push adds versions; `omni roadmap check` checks rows against the product's repositories, never `plan.targets[]`; a roadmap born in git reads, pushes and grades as before | `kit/lib/roadmap/` `kit/lib/ids` `kit/bin/commands/roadmap.ts` `apps/galaxy/app/api/roadmaps/` `apps/galaxy/src/roadmap/` | s1 | 2 | 1 | build |
| s3 | A product roadmap's page shows every version of its document and rows, and is approved there with the seal of #1299/#1612; Work › Roadmaps lists it with its product | `apps/galaxy/app/roadmaps/` `apps/galaxy/src/dossier/page/Roadmap` `apps/galaxy/src/approval/` | s2 | 3 | 1 | build |
| s4 | `/omni:roadmap --product` and `/omni:mega-roadmap --product` write a product roadmap with no issue and no phase-0 PR, and `/omni:drive --roadmap mobile-R3` reads its rows from the server | `kit/plugin/skills/roadmap/` `kit/plugin/skills/mega-roadmap/` `kit/plugin/skills/drive/` `kit/plugin/skills/mega-drive/` `kit/test/roadmap-product.test.ts` | s2 | 3 | 1 | build |
| s5 | `fix_rows` holds a bug record's Fixes rows (order, repository, pull request, what changes, reproduction, guard, merged at), `products.bug_seq` hands out `<key>-B<n>`, and `fix_facts` reads its summary from the rows | `supabase/migrations/` `supabase/checks/fix_rows.sql` `supabase/checks/fix_facts.sql` `supabase/checks/dossiers.sql` `supabase/database.types.ts` | — | 1 | 2 | deep |
| s6 | `omni bug push --product <key>` creates `mobile-B<n>` with its rows, refusing by name a row whose repository is outside the product before any write; `omni bug` checks rows against the product's repositories | `kit/lib/bug/` `kit/lib/ids` `kit/bin/commands/bug.ts` `apps/galaxy/app/api/fixes/` `apps/galaxy/src/fixes/facts/` `apps/galaxy/src/fixes/rows` | s5 | 2 | 2 | build |
| s7 | A merged fix PR whose repository and number match a row stamps `merged_at` on it; the last one ships the record; a merge matching no row is kept as unmatched; a PR closed unmerged marks its row | `apps/omni-app/src/webhook/` `apps/omni-app/src/fix-rows/` `apps/omni-app/src/functions.ts` `apps/galaxy/app/api/fixes/stamp/` | s6 | 3 | 2 | deep |
| s8 | A product bug's page shows its Fixes rows with their state, `Ships on the last merge.` and each unmatched merge | `apps/galaxy/app/bugs/` `apps/galaxy/src/fixes/TimelinePane.tsx` `apps/galaxy/src/fixes/FixList` `apps/galaxy/src/fixes/render.test.ts` | s6 | 3 | 2 | build |
| s9 | `/omni:mega-bug-fix --product <key>` opens fix PRs whose body holds `Fixes mobile-B<n> · <link>` with the reproduction and guard lines, and opens no record PR and no plan-repository issue | `kit/plugin/skills/mega-bug-fix/` `kit/test/mega-bug-fix-product.test.ts` | s6 | 3 | 2 | build |
| s10 | `knowledge_packs` holds a repository's knowledge and flow files at a commit, each with its sha256, readable only by its workspace's members and tokens; a product records its plan repository | `supabase/migrations/` `supabase/checks/knowledge_packs.sql` `supabase/checks/products.sql` `supabase/database.types.ts` | — | 1 | 3 | deep |
| s11 | A merge touching a repository's knowledge folder or flow config makes the App snapshot them into a pack, at background priority | `apps/omni-app/src/knowledge-harvest/` `apps/omni-app/src/knowledge-pack/` `apps/omni-app/src/functions.ts` `apps/galaxy/app/api/knowledge-packs/` `apps/galaxy/src/knowledge-packs/` | s10 | 2 | 3 | deep |
| s12 | `omni kb pack get <repo>` writes the newest pack read-only under `.omni-loop/local/packs/<repo>@<sha>/` and prints its path, holds on the newest fetched pack when the server is down, and refuses a pack older than `read_at`; `/omni:do-work`, `omni plan check` and `omni flow --repo` read packs, and `/omni:mega-invade --product` writes no copies | `kit/lib/knowledge/packs` `kit/lib/knowledge/copies` `kit/lib/plan-repo/` `kit/bin/commands/kb.ts` `kit/bin/commands/flow.ts` `kit/bin/commands/plan.ts` `kit/plugin/skills/do-work/` `kit/plugin/skills/mega-invade/` | s11 | 3 | 3 | build |
| s13 | No `kit/` reader of `plan.targets[]` remains outside the code that finishes git-born records, and a guard test proves it; the old plan-repository way (roadmap push and grade, `omni bug` on a git bug record, an imported knowledge copy) is proven to work end to end | `kit/test/plan-targets-readers.test.ts` `kit/test/plan-repo-old-way.test.ts` `kit/bin/commands/next.ts` `kit/bin/commands/care.ts` | s12 | 4 | 3 | build |
| s14 | Work › Questions has an Inbox tab (today's ask-mode questions) and an Outbox tab listing every open outbox item of the workspace with its product, the viewer's first, filtered by product, answered in place as on the product's tab | `apps/galaxy/app/ask/` `apps/galaxy/src/ask/page/QuestionsTabs` `apps/galaxy/src/ask/page/tabs` `apps/galaxy/src/ask/page/Outbox` `apps/galaxy/src/outbox-items/` `apps/galaxy/src/nav/sidebar` | — | 1 | 3 | build |
| s15 | A product PRD's Outbox tab lists its items, open and settled, from the server's rows, answered in place with a person's sign-in; a repository PRD's tab reads as before | `apps/galaxy/src/dossier/page/OutboxPane` `apps/galaxy/src/dossier/page/outbox-` | s14 | 2 | 3 | build |
| s16 | Concepts filters by product, and Work › PRDs, Bug Fixes and Roadmaps show product items (`mobile-12`, `mobile-B74`, `mobile-R3`) with their product | `apps/galaxy/app/concepts/` `apps/galaxy/src/concepts/` `apps/galaxy/src/product-filter/` `apps/galaxy/app/prd/page.tsx` `apps/galaxy/app/roadmaps/page.tsx` `apps/galaxy/src/fixes/list` | — | 1 | 3 | build |
| s17 | A product's Repositories tab shows each repository's ladder step and lists what still lives in its plan repository, as information only, with no archive action | `apps/galaxy/src/product-repositories/` `apps/galaxy/app/app/products/[id]/repositories/` `apps/galaxy/app/api/products/archive/` `apps/omni-app/src/plan-archive/` `apps/omni-app/src/functions.ts` | s10, s11 | 3 | 3 | build |
| s18 | The guide and the apps' READMEs describe product roadmaps, bug records, knowledge packs, Questions › Inbox and Outbox, and that the plan repository is kept beside the product way | `docs/guide/roadmaps.md` `docs/guide/products.md` `docs/guide/several-repositories.md` `apps/galaxy/README.md` `apps/omni-app/README.md` | s13, s15, s17 | 5 | 3 | light |

**Shared ground.**

- `supabase/migrations/`, `supabase/checks/dossiers.sql` and `supabase/database.types.ts`: s1
  (landing 1), s5 (landing 2) and s10 (landing 3), apart by landing. Each migration is dated after the
  newest one on `main` when its slice is built.
- `kit/lib/ids`: s2 (landing 1) adds `<key>-R<n>`, s6 (landing 2) adds `<key>-B<n>`.
- `apps/galaxy/app/api/fixes/`: s6 (wave 2) creates the push route, s7 (wave 3) adds `stamp/`.
- `apps/galaxy/app/roadmaps/`: s3 (landing 1) owns the roadmap page; s16 (landing 3) touches only
  `apps/galaxy/app/roadmaps/page.tsx`.
- `apps/galaxy/src/fixes/`: s6 owns `facts/` and `rows`, s8 the page files, s16 `list`, apart by
  prefix and by landing.
- `apps/galaxy/src/outbox-items/` is s14's: s15 waits for it (wave 2) and reads it.
- `apps/omni-app/src/functions.ts`: s7 (landing 2) registers the stamp; in landing 3, s11 (wave 2)
  registers the snapshot; s17 (wave 3) registers nothing now that it has no archive job.
- The generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by each wave, never listed.

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | roadmaps | — |
| 2 | bug-records | landing 1 is deployed |
| 3 | packs-and-views | landing 2 is deployed |

## Per slice: done when

**s1** (deep: migration and counters)
- A migration adds the `roadmap` dossier kind, `products.roadmap_seq`, a text `roadmap_prds.prd`
  beside the integer one (back-filled), `roadmaps.dossier_id`, and `product_repositories.ladder_step`
  (1 to 5, default 1); it only adds.
- Two concurrent creates of a product roadmap get two different numbers with no gap
  (`supabase/checks/roadmaps.sql`).
- A push with one changed file adds one version of that file only.

**s2** (`ui: yes`)
- `omni roadmap push --product mobile --new` prints `mobile-R<n>`; `omni roadmap check` refuses a row
  naming a repository outside the product, by name; rows accept `912` and `mobile-12`.
- Every existing roadmap test passes unchanged for a roadmap born in git.

**s3** (`ui: yes`)
- The roadmap page lists every version, approves with the seal, and reads `building`, `held` or
  `drifted` as a PRD does; Work › Roadmaps lists `mobile-R3` with its product.

**s4**
- `/omni:roadmap --product mobile` and `/omni:mega-roadmap --product mobile` open no issue and no
  phase-0 PR; `/omni:drive --roadmap mobile-R3` reads its rows from the server
  (`kit/test/roadmap-product.test.ts`).

**s5** (deep: migration and counters)
- `fix_rows` and `products.bug_seq` exist, written only through their RPCs, read by the workspace's
  members; two concurrent bug creates get two numbers with no gap; `fix_facts` reads from rows.

**s6** (`ui: yes`)
- `omni bug push --product mobile` creates `mobile-B<n>` with its rows; a row naming a repository
  outside the product is refused by name and nothing is written.

**s7** (deep: webhook matching; `ui: yes`)
- Against a stubbed GitHub: a merged PR matching a row stamps it; the last stamp ships the record; a
  merge matching no row stamps nothing and is listed as `unmatched merge <repo>#<n>`; a PR closed
  unmerged leaves its row `closed, not merged` and the record open. Nothing merges anything.

**s8** (`ui: yes`)
- The bug page shows the rows with `open`, `merged`, `closed, not merged`, `Ships on the last
  merge.` and each unmatched merge, as the `bug-record` draft screen draws it.

**s9**
- `/omni:mega-bug-fix --product mobile` writes each fix PR body with `Fixes mobile-B<n> · <link>`,
  the reproduction line and the guard line, and opens no record PR
  (`kit/test/mega-bug-fix-product.test.ts`).

**s10** (deep: migration and access)
- `knowledge_packs` exists with per-file sha256 and the newest pack per link; a token of another
  workspace reads none (BR-PRODUCT-63); `products.plan_repository` exists.

**s11** (deep: snapshot on merge; `ui: yes`)
- A merge touching `.omni-loop/knowledge/` or the flow config writes a pack whose files hash to that
  commit's files; other merges write none; it runs in the installation's budget.

**s12**
- `omni kb pack get vertuo-api` writes and prints the folder; with the server unreachable it prints
  the newest fetched pack with its sha and age; a pack older than `read_at` stops `/omni:do-work` with
  `pack stale: <sha> < read_at <sha>`.

**s13**
- `kit/test/plan-targets-readers.test.ts` fails on any `plan.targets` reader outside the git-born
  record code, and passes.
- `kit/test/plan-repo-old-way.test.ts`, on a plan-repository fixture: a roadmap is pushed and graded,
  `omni bug` checks a git bug record's Fixes table, and an imported knowledge copy is read, all as
  before this PRD.

**s14** (`ui: yes`)
- Work › Questions shows Inbox and Outbox with counts; Outbox lists every open item of every product
  with its product, the viewer's first, filters by product, and an answer there is the one the
  product's tab records, given only by a person's sign-in (BR-PRODUCT-12, BR-PRODUCT-94).

**s15** (`ui: yes`)
- `/prd/<id>` of `mobile-12` lists its items in the Outbox tab, open and settled; a repository PRD's
  Outbox tab renders as before.

**s16** (`ui: yes`)
- Concepts has the product filter; Work › PRDs, Bug Fixes and Roadmaps list product items with their
  product under the existing filter.

**s17** (`ui: yes`)
- The Repositories tab shows the ladder and lists what still lives in the plan repository (a
  repository below step 5, an open record born in git), as information only; there is no archive
  action, and the App asks for no new permission.

**s18** (light: docs only)
- The guide's roadmaps, products and several-repositories pages, and both READMEs, describe what
  this PRD ships.
