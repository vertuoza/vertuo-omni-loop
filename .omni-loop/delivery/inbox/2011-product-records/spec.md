---
prd: 2011
title: Roadmaps, bugs and knowledge move into the product
blocked-by: none
spec: file
phase0: server
---

# Roadmaps, bugs and knowledge move into the product

**Date:** 2026-10-15 · **PRD:** #2011 · **From:** concept #1269, area `product-records`, after PRDs
#1299, #1322, #1364, #1548 and #1612 · **Touches:** `supabase/migrations/` (roadmap dossiers, fix
rows, bug ids, knowledge packs, the ladder step), `kit/` (`omni roadmap`, `omni bug`, `omni kb pack`,
the remaining `plan.targets[]` readers), `apps/omni-app` (the merge webhook stamping fix rows, the
pack snapshot), `apps/galaxy` (the roadmap and bug pages, Questions › Inbox and Outbox, the PRD
page's outbox, the product filter on Concepts, what still holds a plan repository), `kit/plugin/skills/` (`roadmap`,
`mega-roadmap`, `mega-bug-fix`, `mega-invade`, `do-work`, `drive`), and the docs.

## Problem

After #1548 a multi-repository PRD lives on its product, but three records can still only live in a
plan repository (concept #1269, the rollout ladder's step 5):

- **Roadmaps.** `roadmap.md` is a git file under `<inbox>/roadmaps/<nnnn>-<topic>/`, numbered by an
  issue, reviewed in a phase-0 PR. `omni roadmap push` copies it to `roadmaps.document`, one text
  column that every push overwrites (BR-PRODUCT-81), so the server keeps no version. A row's
  `roadmap_prds.prd` is an integer, so a product PRD (`mobile-12`) cannot be on a roadmap.
- **Bug records.** `/omni:mega-bug-fix` writes `<delivery>/bugs/<nnnn>-<slug>/bug.md` with a
  `## Fixes` table and closes the issue with a record PR that merges last. The rows exist only in
  the markdown version of the bug dossier; nothing knows when a row's PR merged.
- **Knowledge.** A target with `knowledge: imported` is copied into `<knowledge>/repos/<name>/`, and
  `/omni:mega-invade` copies its flow config to `repos/<name>/flow/`. `/omni:do-work`, `plan check`
  and `omni flow --repo` read those copies. Two copies of the same truth drift; no knowledge pack
  exists anywhere.

And a live gap: under `plan: { product }`, `plan.targets[]` parses to `[]`
(`kit/lib/config.ts`), so the roadmap grade and push (`kit/lib/roadmap/grade.ts`, `push.ts`) and
`omni bug`'s Fixes check (`kit/lib/bug/fixes.ts`) already fail in a product checkout (1364's settled
item `s4-01`).

**Seeing everything in one place.** The person asked that, whatever moves into products, everyone
can still see every PRD, every bug, every visual fix and every question in one place: people work
across products. Today Work › PRDs, Bug Fixes, Visual Updates and Roadmaps list the whole workspace
with a product filter (#1364 s12). Three gaps remain: Work › Questions opens only the ask-mode
pages, so the outbox questions (decisions agents took alone) are visible only inside each product's
Questions tab; a PRD page's Outbox tab reads only GitHub, so a product PRD's outbox rows show on its
product and not on its own page; Concepts has no product filter.

## Solution

A repository at **step 5** of the rollout ladder (Roadmaps & bug records) has its new roadmaps and
bug records **born on the server**, in its product, the way #1299 made phase 0 born on the server.
A record keeps its birthplace for life: one born in git finishes in git, and stepping a repository
back down changes only where new records are born.

**1. A roadmap is a dossier.**

- `dossiers.kind` gains `roadmap`, and a roadmap gets a product id `<key>-R<n>` (`mobile-R3`), from
  its product's own counter.
- Its document, PRD rows, human work and prerequisites are versions of the dossier: every push adds
  a version where a file changed, as a PRD's dossier does, and the page shows every version.
- `roadmap_prds.prd` holds text: `912` for a repository PRD or `mobile-12` for a product PRD.
- It is approved on its page, with `omni wait approval` and the seal of #1299/#1612. It has no issue
  and no phase-0 PR.
- `/omni:roadmap --product <key>` and `/omni:mega-roadmap --product <key>` write it with
  `omni roadmap push --product <key> --new`; `/omni:drive --roadmap mobile-R3` reads its rows from
  the server; `omni roadmap check` checks rows against the product's repositories, never
  `plan.targets[]`.
- A roadmap born in git keeps `roadmap.md`, its issue and `roadmaps.document`, as today.

**2. A bug record has Fixes rows.**

- A product bug gets the id `<key>-B<n>` (`mobile-B74`), from `products.bug_seq`, its own counter,
  readable apart from PRDs.
- `fix_rows` holds one row per fix: order, repository (one of the product's), pull request, what
  changes, reproduction, guard, merged at. `omni bug push --product <key>` writes them; `omni bug`
  checks each row's repository against the product's repositories, never `plan.targets[]`.
- **Every fix PR's body carries the record**: `Fixes mobile-B74 · <link>`, then its reproduction and
  guard lines, so `git log` and blame still lead to the why (the voice's objection, accepted).
- The merge webhook (omni-app's merged `pull_request.closed`) stamps `merged_at` on the row whose
  repository and PR match. When every row is merged, the record is shipped. No record PR, and no
  issue in a plan repository.
- `fix_facts` reads its summary from the rows.

**3. Knowledge is served as packs.**

- On a merge that touches a repository's knowledge folder or flow config, the App's knowledge
  harvest asks the server to snapshot them: a `knowledge_packs` row holds the repository, the commit
  sha, each file with its sha256, and which pack is the newest for each product link.
- `omni kb pack get <repo>` writes the newest pack to
  `.omni-loop/local/packs/<repo>@<sha>/`, read-only and ignored by git, and prints that path.
- `/omni:do-work`, `omni plan check` and `omni flow --repo` read the pack of an imported target,
  never a `repos/<name>/` copy. `/omni:mega-invade --product` stops writing those copies.

**4. One place for everything, across products.**

- Work › PRDs, Bug Fixes, Visual Updates and Roadmaps stay lists of the whole workspace, each item
  showing its product, with the product filter of #1364. Product PRDs (`mobile-12`), product bugs
  (`mobile-B74`) and product roadmaps (`mobile-R3`) appear in them beside repository ones.
- **Work › Questions has two tabs.** **Inbox:** today's ask-mode questions, put to you (with
  Shared with me). **Outbox:** every open outbox item of the workspace, across every product and
  every repository, with the product column and filter, those waiting on the viewer first, answered
  in place the way a product's Questions tab answers them (#1548). History stays.
- A PRD's page shows its own outbox, whoever holds it: its Outbox tab (`OutboxPane.tsx`), which
  reads a repository PRD's items from GitHub today, also reads a product PRD's `outbox_items` rows
  (#1548), open and settled, answered in place.
- Concepts gets the product filter.
- Each product tab stays the same list with its product picked: no second copy of anything.

**5. The plan repository stays, and the old way keeps working.**

- A plan repository is never archived by the loop. Its roadmaps, bug records and imported knowledge
  copies keep working exactly as today, side by side with the product way: a repository below step 5
  stays on the old way, and a record born in git finishes in git.
- A product's Repositories tab shows, as information only, each repository's ladder step and what
  still lives in its plan repository (`vertuo-web · step 3`, `roadmap 0412 · born in git, open`). It
  offers no archive action, and the App gets no new GitHub permission.

## Decisions

- **Born on the server, per repository** (the person, over "git stays the truth" and "one import at
  once"): same rule as #1299's phase 0, so a repository can step back down and nothing in flight
  tears.
- **One PRD for all three moves** (the person).
- **The plan repository is kept, and the old way keeps working** (the person, 2026-10-16, during
  the build): the archive action of the first version of this spec is dropped, so the App needs no
  administration permission; the Repositories tab only shows what still lives in the plan repository.
- **The cross-product view is the existing Work pages plus a filter** (the person), not a new
  unified feed.
- **Questions holds an Inbox and an Outbox tab, and each PRD page shows its outbox** (the person).
- **Bug ids are `<key>-B<n>`** (the person), a counter per product apart from PRDs.
- **Roadmap ids are `<key>-R<n>`**: taken without asking, to match the bug id; the most reversible
  choice, since no roadmap is born on the server before this ships.
- **A stale pack is refused, never used** (approved in the design's section 3): when the newest
  pack is older than the link's `read_at`, `/omni:do-work` stops the slice saying
  `pack stale: <sha> < read_at <sha>`.
- **The voice's objection** (persona:B-E DEv, at the design): "My bugs get fixed in my repository.
  If the record of why lives only on a website, I won't read it, and next year nobody finds why that
  guard exists." Settled **accepted**: every fix PR body carries the record's link, reproduction
  and guard lines.
- **Ladder storage**: when #1364/#1548 already store a repository's ladder step, it is reused;
  otherwise a `ladder_step` (1 to 5) is added on the product link. The first slice that needs it
  checks which, and says so.

## User stories

- As **Paul**, a PM across products, I open Work › Questions › Outbox and answer every decision
  waiting on me, whichever product it belongs to, without opening each product.
- As **Irisa**, I write the Mobile roadmap from `/omni:roadmap --product mobile`, approve it on its
  page, and `/omni:drive --roadmap mobile-R3` builds it, with no plan repository.
- As a **back-end developer**, I read why a guard exists from my fix PR's body and `git log`, not
  only from the record's page.
- As the **Lead Engineer**, I filter Work › Bug Fixes by product, or see them all, and know each
  record closes itself when its last fix merges.
- As an agent building a slice, I read an imported target's knowledge from a pack fetched at its
  `read_at`, never a stale copy.

## Scope

In:

- The roadmap dossier kind, `<key>-R<n>`, text PRD ids in roadmap rows, versioned roadmap pushes,
  approval on its page.
- `fix_rows`, `<key>-B<n>`, `omni bug push --product`, the merge webhook stamping rows, the record
  closing itself, the fix PR body lines.
- `knowledge_packs`, the snapshot on merge, `omni kb pack get`, the pack readers in do-work,
  plan check and flow.
- Every remaining `plan.targets[]` reader moved to the product's repositories, except the code that
  finishes records born in git.
- Questions › Inbox and Outbox, the PRD page's outbox, the Concepts product filter, product ids in
  the workspace lists.
- The Repositories tab's ladder and the list of what still lives in the plan repository.
- Proof that the old plan-repository way still works end to end.
- The skills (`roadmap`, `mega-roadmap`, `mega-bug-fix`, `mega-invade`, `do-work`, `drive`) and the
  user guide.

Out:

- The Constellation tab (concept area `constellation-tab`).
- Moving records already born in git to the server: they finish where they were born.
- Archiving or deleting a plan repository: the loop never does either.
- Visual fixes change nothing here: they are already dossiers with a product.

## Test seams

Per `omni kb show testing`: tests beside the code, no test calls GitHub or Supabase.

- **Kit, pure modules:** the `<key>-R<n>` and `<key>-B<n>` id parsers (valid and refused forms), the
  Fixes row matcher, the pack hasher, the stale-pack rule.
- **Kit, commands through `main()` on a fixture repository** (`kit/test/fixture.ts`):
  `omni roadmap push --product … --new`, `omni bug push --product …`, `omni bug` checking rows against
  the product's repositories, `omni kb pack get` against a fake server, including held mode.
- **Database:** migration checks under `supabase/` with realistic rows: the counters hand out no gap
  and no duplicate under two concurrent creates; a roadmap push adds a version only when a file
  changed.
- **The App end to end, against a stubbed GitHub:** a merged PR stamps its row; the last one ships
  the record; a merge matching no row stamps nothing.
- **Galaxy page tests:** Questions › Inbox and Outbox, the PRD page's outbox, the Concepts filter,
  product ids in each workspace list, the Repositories tab's ladder and plan-repository list.
- **A guard test:** no reader of `plan.targets[]` remains outside the code that finishes git-born
  records.
- **The old way, end to end:** from a plan-repository fixture, a roadmap is pushed and graded, `omni
  bug` checks a git bug record's Fixes table, and an imported knowledge copy is read, all as today.
- **Mutation:** `pnpm mutation:changed` on every delivery-core file changed (`kit/lib/ids.ts`,
  `kit/lib/inbox/`, `kit/lib/config.ts`).

## Risks

Per `omni kb show releasing`, a merge to `main` publishes the database (migrations applied to
production), the kit (`kit/dist/omni.mjs` and the plugin) and the two apps.

- **The database:** every migration only adds (a dossier kind, `fix_rows`, `knowledge_packs`, two
  counters, a text column beside the integer `prd`, maybe `ladder_step`). Rollback: drop them before
  any record is born on the server; after that, keep them.
- **The kit:** git-born roadmaps and bugs keep today's code; only a repository at step 5 reaches the
  new path. Rollback: revert the kit release and step repositories back down.
- **The App:** the webhook only stamps a row whose repository and PR match exactly; a misfire leaves
  a record open, never ships it early. Snapshots run on merge events, at background priority in the
  installation's budget.
- **The rules this changes** (rules, not locked laws): BR-PRODUCT-81 (a roadmap push replaces the
  document: now it adds a version, for server-born roadmaps), BR-PRODUCT-84 (a row's project is in
  the inbox or shipped folder: now also a product PRD on the server), BR-PRODUCT-85 (a repositories
  column only in a plan repository: now also in a product roadmap). Each is reworded in the same
  slice that changes its behaviour.

The locked laws it touches:

- BR-PRODUCT-5: a feature stays a draft while any question is open. If the Outbox tab let a feature
  go ready with open items, a person could merge work whose decisions nobody answered. Changing it
  needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-12: an answer never changes after it is given. Answering from the Outbox tab and the PRD
  page must write the same immutable answer as the product's tab, or nobody can tell what was
  decided. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-94: a terminal token can never mark an answer as given on the page. The new answer
  places must accept only a person's sign-in, or an agent could answer in a person's name. Changing
  it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent link reads only repositories in its own workspace. `omni kb pack get` must
  serve only packs of the token's workspace, or an agent could read another team's knowledge.
  Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-15: only a person merges into the main branch. The record closing itself must never
  merge anything, or unreviewed work reaches every user. Changing it needs @pierrederval
  to approve the pull request on GitHub.

None of these laws changes: the design must keep each, and its test must stay green.

## Acceptance criteria

1. `omni roadmap push --product mobile --new` from a product checkout creates `mobile-R<n>`, the next
   number for Mobile; two creates at once get two different numbers with no gap. A second push with
   one changed file adds one version of that file only.
2. A roadmap row accepts `912` and `mobile-12`; `omni roadmap check` refuses a row naming a repository
   outside the product, by name.
3. A roadmap born in git still reads, pushes and grades exactly as before; its existing tests pass
   unchanged.
4. `omni bug push --product mobile` creates `mobile-B<n>` with its Fixes rows; a row naming a
   repository outside the product is refused by name, and nothing is written.
5. When the App sees a fix PR merged whose repository and number match a row, that row shows
   `merged`; when the last row merges, the record shows `shipped`. A merge that matches no row
   changes nothing and is listed on the record's page as `unmatched merge <repo>#<n>`; a PR closed
   unmerged leaves its row `closed, not merged` and the record open.
6. `/omni:mega-bug-fix --product mobile` opens fix PRs whose body holds `Fixes mobile-B<n> · <link>`,
   the reproduction line and the guard line, and opens no record PR.
7. After a merge touching `vertuo-api`'s knowledge folder, `omni kb pack get vertuo-api` writes a
   folder whose files hash to that commit's files and prints its path; with the server unreachable it
   prints the newest pack already fetched with its sha and age; when the newest pack is older than
   the link's `read_at`, `/omni:do-work` stops with `pack stale: <sha> < read_at <sha>`.
8. A token of another workspace gets no pack of this one.
9. In a product checkout, no `kit/` reader of `plan.targets[]` remains outside the git-born record
   code; the guard test proves it.
10. Work › Questions shows an Inbox and an Outbox tab; Outbox lists every open outbox item of every
    product with its product, the viewer's first, filters by product, and answering there is the
    same answer the product's tab records.
11. A product PRD's page (`/prd/<id>` of `mobile-12`) lists its outbox items in its Outbox tab, open
    and settled, from the server's rows; a repository PRD's Outbox tab reads as before; answering
    there needs a person's sign-in.
12. Work › PRDs, Bug Fixes and Roadmaps show product items (`mobile-12`, `mobile-B74`, `mobile-R3`)
    with their product, and Concepts filters by product.
13. A product's Repositories tab shows each repository's ladder step and lists what still lives in
    its plan repository, with no archive action; from a plan-repository checkout, a roadmap push and
    grade, `omni bug` on a git bug record and an imported knowledge copy all work as before this
    PRD, proven by tests.
