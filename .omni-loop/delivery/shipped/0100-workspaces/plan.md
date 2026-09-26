# Workspaces: Vertuoza becomes the first of many — plan

**PRD:** #100 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/workspaces` →
`main` (`Closes #100`) · **Sub-PRs:** `feat/workspaces--<slice>` → the feature branch (`Part of #100`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Built after #94.** This PRD is blocked by #94, so every arcade path below is the layout #94
leaves behind:

- the scenes are split into `apps/galaxy/src/arcade/scenes/<group>.*`, and the boot screen and the
  title are in `scenes/attract.*`;
- the Game Boy bodies are `Handheld.tsx` and `Advance.tsx`, styled by `shell.css`;
- the cabinet and its deck emblem are gone.

If #94 lands a path differently, the slice follows the code, and the drift is an outbox item.

**The tracer is s1.** One forward migration gives the database its workspaces. `access.sql` proves,
on an empty database, that two workspaces cannot see each other and that Vertuoza is workspace #1.
Wave 2 points the two readers at it:

- the game scripts (s4) name their workspace;
- the arcade (s5) reads the signed-in member's workspace and hands its name and theme to the brand.

The look is built beside the tracer and meets it in wave 3:

- s2 draws the mark from a name, under the house brand;
- s3 makes the sprite forge's stripes tintable;
- s6 turns every colour into a theme token and applies the workspace's overrides.

Between s1 and wave 2, the feature branch's arcade and game scripts do not work against the new
schema. That is accepted: nothing ships before the feature PR, and `pnpm test` stays green
throughout, because no test calls Supabase.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Workspaces in the database: one forward migration drops the four game tables and rebuilds them with a workspace scope. It adds `workspaces`, `workspace_members`, `is_member()`, `join_by_domain()` and `valid_theme()`, redefines the sign-up hook, `link_github()` and `players_guard()`, and inserts Vertuoza and its six fleets. `access.sql` is rewritten for isolation; the demo seed and its generator fill the `vertuoza` workspace; the READMEs describe the new tables | `supabase/` `.github/workflows/supabase.yml` `apps/galaxy/scripts/seed.mjs` `apps/galaxy/scripts/sql.mjs` `apps/galaxy/README.md` `README.md` | — | 1 |
| s2 | The mark is the first letter of a name: a bar alphabet A to Z in the V's style, with today's V pixel for pixel, `markFor(name)` giving O for anything else, and a `Brand` (`{ name, theme }`) with the house brand `{ name: 'Vertuoza', theme: {} }` as the arcade's default. The boot screen draws the brand's letter, and "VERTUOZA" and "© 2026 VERTUOZA" come from the brand's name | `apps/galaxy/src/arcade/mark` `apps/galaxy/src/arcade/brand` `apps/galaxy/src/arcade/scenes/` `apps/galaxy/src/arcade/ArcadeApp.tsx` | — | 1 |
| s3 | The stripes are tintable: the sprite forge takes an optional override for its `FLAT` colours; with none, every sprite forges byte-identical to today | `packages/sprites/` | — | 1 |
| s4 | The game scripts name their workspace: `--workspace` or `OMNI_LOOP_WORKSPACE` on `game:project`, `game:score`, `game:banner` and `game:export`. The projector reads `github_org` and `plan_repo` from the workspace, `buildSnapshot()` loses its defaults, every Supabase read is filtered by workspace, appends use `on_conflict=workspace_id,id`, the export writes one workspace, and `game.yml` names `vertuoza` | `game/` `.github/workflows/game.yml` `README.md` | s1 | 2 |
| s5 | The arcade reads the member's workspace: the callback and the page call `join_by_domain()`, the page takes the workspace joined first, every loader filters by it, joining a fleet writes its `workspace_id`, "crew" means "has a workspace", signed out reads nothing, and the workspace's name and theme become the arcade's brand | `apps/galaxy/app/` `apps/galaxy/src/data/` `apps/galaxy/src/arcade/account-supabase.ts` `apps/galaxy/src/arcade/onboarding` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/arcade/ArcadeClient.tsx` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/README.md` | s1, s2 | 2 |
| s6 | A theme recolours the arcade: `theme.ts` lists every token with today's default (the `:root` colours, #94's body colours among them, the mark's gradient and shade, and the four stripes). A zod schema drops invalid entries with a warning, the resolved theme is set as CSS custom properties on the arcade's root, and the canvas, the mark and the forged sprites read it. A test holds the module's token names equal to `valid_theme()`'s | `apps/galaxy/src/arcade/theme` `apps/galaxy/src/arcade/arcade.css` `apps/galaxy/src/arcade/shell.css` `apps/galaxy/src/arcade/Handheld.tsx` `apps/galaxy/src/arcade/Advance.tsx` `apps/galaxy/src/arcade/Sprite.tsx` `apps/galaxy/src/arcade/fleets.ts` `apps/galaxy/src/arcade/builder.ts` `apps/galaxy/src/arcade/mark` `apps/galaxy/src/arcade/brand` `apps/galaxy/src/arcade/scenes/` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/package.json` `pnpm-lock.yaml` `apps/galaxy/README.md` | s1, s5, s2, s3 | 3 |

**Shared ground.**

- **`apps/galaxy/src/arcade/ArcadeApp.tsx`**: s2 (wave 1), s5 (wave 2) and s6 (wave 3). Each adds
  one thing:
  - s2, the `brand` prop, defaulting to the house brand, and its handing to the scenes;
  - s5, `workspace_id` on the player row `lockIn` writes;
  - s6, the theme's CSS custom properties on the root element and the stripe override for sprites.
- **`apps/galaxy/src/arcade/scenes/`**: s2 (wave 1: the boot's letter and the brand's name in the
  attract group) and s6 (wave 3: the canvas reads the resolved theme).
- **`apps/galaxy/src/arcade/mark` and `brand`**: s2 creates them (wave 1), with the
  brand's `theme` carried but not yet applied. s6 moves the mark's gradient onto theme tokens and
  applies the brand's theme (wave 3).
- **`apps/galaxy/README.md`**, in three waves:
  - s1, wave 1: the database section, and the deploy step naming the hook;
  - s5, wave 2: the data flow and the signed-out screen;
  - s6, wave 3: the theme.
- **`README.md`** (the repository's): s1 (wave 1: the sectors and fleets SQL example, now with
  `workspace_id`) and s4 (wave 2: the game commands with `--workspace`).

**Across PRDs.**

- **#94** is this PRD's blocker. Its files are the ground s2, s5 and s6 build on.
- **#71 (ask-mode)** builds in `apps/galaxy/app/` too (`app/ask/`, `app/api/ask/`, and the auth
  callback, which s5 also edits). Whichever PRD ships second merges `main` into its feature branch.
  #71's `is_crew()` becomes `is_member()` (the spec's Risks).
- **s6 adds `zod` to `apps/galaxy`.** If another PRD changes the arcade's dependencies meanwhile,
  the lockfile is regenerated with `pnpm install`, never by hand.

## Per slice: done when

- **s1:**
  - The supabase workflow's check applies every migration and the demo seed to an empty database,
    and `supabase/checks/access.sql` passes.
  - After the migration, `public.workspaces` holds `vertuoza` (`github_org 'vertuoza'`,
    `plan_repo 'vertuo-omni-plan'`, `join_domain 'vertuoza.com'`, theme `{}`), and its six fleets
    carry today's labels, colours, mottos, mascots and order, with `invincible-team` retired.
  - `access.sql` proves every criterion below; each failure stops the run with `FAIL:`.
    - **Isolation:** a member of one workspace reads zero rows of another from the six tables, and
      can neither insert a player row there nor join one of its fleets.
    - **Anonymous visitors** read no table.
    - **`join_by_domain()`:** a confirmed `@vertuoza.com` account joins `vertuoza`; an unconfirmed
      one, or another domain, joins nothing; a second call adds nothing.
    - **The hook** refuses a domain no workspace joins, with a message naming no company.
    - **Keys:** one GitHub login is a player in two workspaces but not twice in one, and one ledger
      `id` exists in two workspaces.
    - **The ledger** still refuses `UPDATE` and `DELETE`.
    - **`valid_theme()`** refuses an unknown token, a colour that is not `#rrggbb`, and a
      non-object.
    - **`link_github()`** refreshes every one of the caller's player rows.
  - `pnpm galaxy:seed` writes the demo galaxy's sectors and ledger into the `vertuoza` workspace.
  - The READMEs describe the workspace tables, membership, the rewritten hook and the new sectors
    SQL.
- **s2:**
  - `markFor('Vertuoza')` equals today's `MARK_RUNS`, pixel for pixel.
  - Every letter A to Z fits the 36×36 box.
  - `markFor('Acme')` is an A, `markFor('Élan')` an E, and `markFor('42 Labs')` and `markFor('')`
    are O.
  - With the house brand, the boot screen draws today's V with its reveal, and the boot and title
    read "VERTUOZA" and "© 2026 VERTUOZA": in demo mode, in the single-file artifact
    (`pnpm galaxy:artifact`) and signed out.
  - Given `{ name: 'Acme' }`, the boot draws an A and reads "ACME" and "© 2026 ACME".
- **s3:**
  - With no override, every sprite `@omni/sprites` forges is byte-identical to today's.
  - With `1` to `4` overridden, only the stripe pixels change colour.
- **s4:**
  - `pnpm game:project --workspace vertuoza` reads `github_org` and `plan_repo` from the workspace,
    and appends rows carrying its `workspace_id` with `on_conflict=workspace_id,id`.
  - Every game script exits non-zero with a message naming the problem, both when neither
    `--workspace` nor `OMNI_LOOP_WORKSPACE` is set and when the slug is unknown. `--workspace` beats
    the variable.
  - `buildSnapshot()` without `org` throws.
  - `loadConfig` and the ledger's `read()` carry `workspace_id=eq.<id>`.
  - `pnpm game:export <dir> --workspace vertuoza` writes `workspace.jsonl` and that workspace's four
    tables, and nothing of another.
  - `game.yml` sets `OMNI_LOOP_WORKSPACE: vertuoza`.
  - `game/README.md` and the repository's README show `--workspace`.
- **s5:**
  - **Joining:** after every sign-in the callback calls `join_by_domain()`. A signed-in person with
    no membership triggers one call from the page, so a session from before the migration joins.
  - **Which workspace:** the page uses the member's first-joined workspace (by `joined_at`, then
    `slug`), and every loader filters by its id.
  - **Joining a fleet** writes the player row with `workspace_id` and `user_id`.
  - **Crew:** `isCrewEmail()` is gone. A session with a workspace is crew; one without goes to the
    outsider screen (`onboarding.test.ts`).
  - **Signed out,** the page makes no database call and plays the built-in fleets.
  - **The brand:** the member's workspace name and theme reach the arcade as its brand.
  - **README:** the arcade README's data flow says so.
- **s6:**
  - **Defaults:** with theme `{}`, every colour is today's.
  - **Overrides:** with `plasma` and `plasma-dark` overridden, the arcade uses them, the Game Boy's
    body included.
  - **Stripes:** with `stripe-1` to `stripe-4` overridden, the heroes' stripes change and nothing
    else does.
  - **`theme.test.ts`:**
    - the defaults equal today's values;
    - every colour custom property on `arcade.css`'s `:root` is a token;
    - the token names in the latest migration defining `valid_theme()` are exactly the module's;
    - overrides apply;
    - an unknown token or a bad colour is dropped with a console warning, and its default kept.
  - **Mark colours:** the mark's gradient and shade come from `mark-1` to `mark-3` and
    `mark-shade-1` to `mark-shade-3`.
  - **README:** the arcade README documents the theme tokens and `workspaces.theme`.
  - **Checks:** `pnpm test` passes, and `pnpm --filter @omni/galaxy-app typecheck` is clean.
