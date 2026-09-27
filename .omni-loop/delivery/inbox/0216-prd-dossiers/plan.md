# Plan: PRD dossiers

PRD #216, spec beside this plan (`spec.md`). The feature branch `feat/prd-dossiers` merges into
`main` through the feature PR, whose body says `Closes #216`. Each slice is a sub-PR from
`feat/prd-dossiers--<slice>` into the feature branch, whose body says `Part of #216`. It is built
once PRD 144 (Question history, #147) has merged into `main` and been merged into the feature
branch: s3 and s6 read its `claude_session_id`, `prd` and workspace-wide read.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A draft opens and a push lands versions. Covers: the `dossier.enabled` switch; `omni dossier open`, `push` and `status`, with the pure parts in `kit/lib/dossier` and the local file shared by every worktree; the contract's two calls on the fake server and in the galaxy; the `dossiers` migration (tables, `dossier_open()`, `dossier_push()`, the version rule, access rules); its access checks and their step in the `supabase` workflow; ADR-0002's contract section; the rebuilt bundle | `kit/lib/dossier/` `kit/lib/config` `kit/lib/ask/client` `kit/bin/commands/dossier.mjs` `kit/bin/commands/index.mjs` `kit/bin/dossier.test.mjs` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` `supabase/migrations/20260928090000_dossiers` `supabase/checks/dossiers.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/store` `apps/galaxy/app/api/dossiers/` `.omni-loop/knowledge/adr/0002-` | — | 1 |
| s2 | The page to share. Covers: `/prd/<id>` with its sign-in and callback, the header and Copy link, the Spec and Plan tabs rendered by `markdown-it` with raw HTML off, the Before/after tab on the sandboxed route with its CSP and the `sandbox` iframe, the version picker, not found for a non-member, and the opener's delete of a draft | `apps/galaxy/app/prd/` `apps/galaxy/src/dossier/page/` `apps/galaxy/src/dossier/markdown` `apps/galaxy/src/dossier/store` `apps/galaxy/package.json` `pnpm-lock.yaml` | s1 | 2 |
| s3 | The questions that shaped it. Covers: the `dossier_rounds()` migration (brainstorm rounds by Claude session and time window, delivery rounds by `prd` and home repository, security invoker), its access checks, and the Questions tab with each round's answer, who answered and after how long, its category, and brainstorm or delivery | `supabase/migrations/20260928100000_dossier_rounds` `supabase/checks/dossiers.sql` `apps/galaxy/src/dossier/store` `apps/galaxy/src/dossier/page/` `apps/galaxy/app/prd/` | s2 | 3 |
| s4 | The history, filtered by repository. Covers: the `dossier_list()` migration (each dossier's repositories — home, its questions' and its planet's regions — its latest versions, question counts and last activity), its access checks, and `/prd`, newest activity first, filtered by repository and by draft or PRD, searched by title, each row opening `/prd/<id>` | `supabase/migrations/20260928110000_dossier_list` `supabase/checks/dossiers.sql` `apps/galaxy/src/dossier/store` `apps/galaxy/src/dossier/page/` `apps/galaxy/app/prd/` | s3 | 4 |
| s5 | Two small skills, followed by the brainstorm and the plan. Covers: `/omni:dossier-open` and `/omni:dossier-push`; the brainstorm's step 0, 7 and 9 calls and the plan's call after it pushes `plan.md`; their porting notes; the kit README's lines; and this repository's `dossier: { enabled: true }` | `kit/plugin/skills/dossier-open/` `kit/plugin/skills/dossier-push/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/porting/plugin--brainstorm.md` `kit/porting/plugin--plan.md` `kit/README.md` `.omni-loop/config.yml` | s1 | 2 |
| s6 | The planet's DOSSIER tab. Covers: the per-planet read in `arcadeFor` (its dossier's latest versions, question counts and last three answers), the fifth tab in the wide and tall grids, START opening `/prd/<id>`, NO DOSSIER YET and DOSSIERS OUT OF REACH, demo dossiers for the demo world and the artifact (without OPEN), the galaxy README's pages, tab and tables, and the manual acceptance recorded with screenshots | `apps/galaxy/src/arcade/scenes/planet` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/data/arcade` `apps/galaxy/src/data/dossiers` `apps/galaxy/app/page.tsx` `apps/galaxy/artifact/` `apps/galaxy/README.md` | s3, s4 | 5 |
| s7 | The fallback reads each repository's delivery folders. Covers: `pnpm game:dossiers` (config and switch per repository, one tree call on the default branch, only changed blobs fetched, dossiers found or created, versions by the same rule with source `github` and the commit), its step in the game workflow after `game:project`, and the game README's outputs | `game/dossiers/` `game/cli/dossiers.mjs` `package.json` `.github/workflows/game.yml` `game/README.md` | s1 | 2 |

**Shared ground.** The galaxy's dossier layer and the access checks are reached by several slices,
so those slices run one wave apart:

- `apps/galaxy/src/dossier/store` is declared by s1, s2, s3 and s4, in waves 1, 2, 3 and 4.
- `apps/galaxy/src/dossier/page/` and `apps/galaxy/app/prd/` are declared by s2, s3 and s4, in
  waves 2, 3 and 4.
- `supabase/checks/dossiers.sql` is declared by s1, s3 and s4, in waves 1, 3 and 4: each appends its
  own checks. s1 adds its step to the `supabase` workflow, so s3 and s4 add none.
- `kit/bin/commands/index.mjs` (the command table) and `kit/dist/omni.mjs` are declared by s1 alone.
  Rebuild the bundle with `pnpm kit:build` from the merged source, never by hand.
- Wave 2 runs s2 (galaxy pages), s5 (the kit's skills) and s7 (the game's fallback) together: their
  territories do not meet. The root `package.json` (s7) and `apps/galaxy/package.json` (s2) are
  different files, and s7 adds a script only, so `pnpm-lock.yaml` stays s2's.

Every migration has its own file prefix, timestamped after PRD 144's
`20260927120000_ask_shares.sql`, in slice order.

The ordering has reasons behind it:
- s2, s5 and s7 follow s1: the page reads its tables, the skills name `omni dossier` (the plugin
  test refuses a command the CLI does not have), and the fallback calls its version rule.
- s3 follows s2: the Questions tab is a tab of s2's page.
- s4 follows s3: the list's question counts and repositories come from `dossier_rounds()`.
- s6 follows s3 and s4: the tab reads `dossier_list()` for the latest versions and counts, and
  `dossier_rounds()` for the last three answers. It ends the PRD, so it carries the manual
  acceptance.

## Per slice: done when

**s1: a draft opens and a push lands versions**
- `dossier.enabled` defaults to `false`; `true` with `ask.url: null` reads as off; a non-boolean is
  refused (`kit/lib/config.test.mjs`).
- Reading a folder returns the three kinds with their hashes and sizes, the title from the front
  matter, and skips a missing file and a file over 512 KiB, naming it.
- The draft is chosen by session id, or else the only unnumbered entry. With several and no session
  id, none is chosen, and an entry numbered for another PRD is ignored. The local file is found from
  a worktree, and a half-written or missing one reads as empty.
- Through `main()` against the fake server: `open` prints a link and records the draft, and `push`
  prints `added: …`. A second identical push adds nothing. `off` makes no call. No sign-in, a 401
  after one refresh, an unreachable server and a 413 each exit 1 with their line within 15 seconds.
  The session id is sent only when `CLAUDE_CODE_SESSION_ID` is set.
- The API opens a draft and pushes with and without one. It numbers a draft, merges a draft into a
  dossier keyed the same, and adds a version only when the hash, computed from the content, differs
  from the latest. It answers 400, 401, 403, 404, 413 (a 2 MiB body, a 512 KiB artifact) and 503 as
  ADR-0029 says.
- `supabase/checks/dossiers.sql`, run by the `supabase` workflow, proves:
  - A member reads, and a member of another workspace reads nothing.
  - Versions cannot be updated or deleted.
  - Only the opener deletes a draft, and nobody deletes a numbered dossier.
  - `dossier_push()` refuses a non-member and adds nothing for an unchanged file.
- ADR-0002's contract section names the two calls. `no-game-words` stays green, `pnpm test` is
  green, and the bundle is rebuilt.

**s2: the page to share**
- `/prd/<id>` shows `PRD #n` or DRAFT, the title, the repository chips, who opened it and when, and
  Copy link. A member of another workspace, or someone signed out after sign-in, gets not found.
- The Spec and Plan tabs render markdown with the front matter as a line above. Raw HTML in the
  markdown shows as text.
- The Before/after tab shows an `<iframe sandbox="allow-scripts">` onto
  `/prd/<id>/v/<version>/page`. That route answers with the spec's CSP and
  `X-Content-Type-Options: nosniff`, and not found to a non-member.
- The version picker lists versions newest first with their date and source (`Pierre (kit)`,
  `commit a1b2c3d (github)`). An artifact with no version yet says so.
- The opener of a draft sees Delete and can delete it; nobody sees it on a numbered dossier.
- Light, dark and system themes, and component tests for each state.

**s3: the questions that shaped it**
- `dossier_rounds()` returns the brainstorm rounds (same Claude session, asked between this dossier's
  opening and that session's next dossier) and the delivery rounds (`prd` = the number, session repo
  = the home repository). Each has its rule, and a round matched by both is returned once, as
  brainstorm.
- The access checks prove that it returns nothing a caller could not read under PRD 144's rules, and
  nothing to a member of another workspace.
- The Questions tab shows each round's question, options, answer, who answered and after how long,
  its category, and `brainstorm` or `delivery`, with answered out of asked in the tab's label.

**s4: the history, filtered by repository**
- `dossier_list()` returns each dossier of the caller's workspaces with its repositories (the home
  repository, its questions' repositories, and for the plan repository's PRDs its planet's regions
  as `<github_org>/<region>`), its latest version of each kind, its question counts and its last
  activity.
- `/prd` lists them newest activity first. Filtering by a repository keeps each dossier whose
  repositories include it, so a dossier with three repositories shows under each. It also filters
  by draft or PRD, and a search finds a dossier by a word of its title. Each row opens `/prd/<id>`.
- The access checks prove that a member of another workspace lists nothing.

**s5: two small skills**
- `/omni:dossier-open` and `/omni:dossier-push` parse, name only `omni dossier`, report each exit
  code as the spec's table says, and never stop the skill that follows them.
- The brainstorm follows `/omni:dossier-open` at step 0 and `/omni:dossier-push` at steps 7 and 9.
  The plan follows `/omni:dossier-push` after it pushes `plan.md`. The porting notes record both
  changes.
- `kit/test/plugin.test.mjs`, `no-game-words` and `no-literals` stay green.
- The kit README names the command, the switch and the two skills. This repository's config sets
  `dossier: { enabled: true }`, and `omni config dossier.enabled` prints `true`.

**s6: the planet's DOSSIER tab**
- The planet screen's tabs read `STATUS · ZONES · ENTROPY · LOG · DOSSIER`, and ◀ ▶ and A turn
  through all five.
- DOSSIER shows each artifact's latest version and date, `n asked · n answered` and the last three
  answered questions on one line each, and `[START] OPEN` (a key and a tap) opens `/prd/<id>` in a
  new tab.
- A planet without a dossier shows `NO DOSSIER YET`. A failed read shows `DOSSIERS OUT OF REACH`,
  and the rest of the planet is unchanged.
- The wide and the tall layouts show the same rows, and `planet.test.ts` and `grid.test.ts` pass.
  The demo world has demo dossiers, and the artifact shows them without the OPEN hint.
- The galaxy README describes `/prd`, `/prd/<id>`, the DOSSIER tab and the dossier tables.
- Manual acceptance, recorded with screenshots in the sub-PR:
  - A brainstorm with ask mode on shows its questions on the draft, marked brainstorm.
  - A push numbers the draft and shows v1.
  - A changed spec shows v2.
  - The link opens for another member of the workspace.
  - The planet's tab opens the page.
  - `CLAUDE_CODE_SESSION_ID` equals the `claude_session_id` PRD 144 stored for the same terminal.

**s7: the fallback**
- With `gh` outputs as fixtures, a tree listing fetches only the blobs a dossier has not stored, and
  a second run with no change adds nothing.
- A repository with no config, or with the switch off, is skipped. A folder whose name does not
  parse and a file over 512 KiB are skipped and logged, and nothing fails the run.
- A new folder creates its dossier, titled from the spec's front matter or else the topic, with
  versions of source `github` carrying the branch head's commit. A file changed on the default
  branch adds one version.
- The game workflow's `ledger` job runs `pnpm game:dossiers` after `game:project`, and the game
  README lists dossiers among its outputs.
