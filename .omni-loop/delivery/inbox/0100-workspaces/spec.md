---
prd: 100
title: Workspaces — Vertuoza becomes the first of many
blocked-by: [94]
spec: file
---

# Workspaces: Vertuoza becomes the first of many

**Date:** 2026-09-25 · **PRD:** #100 · **Touches:** `supabase/`, `game/`, `apps/galaxy`,
`packages/sprites` · **Blocked by:** #94 (the Game Boy), whose body this PRD themes

This is the first of four PRDs that open Omni Loop to companies other than Vertuoza:

1. **This one.** Workspaces in the database, and the workspace's look (its mark and its theme).
   Nothing changes for Vertuoza: it becomes workspace #1 and looks and plays exactly as today.
2. **Open sign-up.** Any Google or GitHub account signs in and creates a workspace, and the
   signed-out screens become Omni's.
3. **Workspace setup.** The GitHub App is made public, each installation belongs to a workspace,
   repositories are picked as sectors, the projector polls every workspace with its installation
   token, and the theme is edited from the setup page.
4. **Editable fleets,** and solo play without a fleet.

## Problem

Everything the game knows is global, and the only door is an email domain.

- **Every key is global.** `sectors.name`, `teams.name` and `ledger_events.id` are primary keys on
  their own (`supabase/migrations/20260925080000_galaxy_ledger.sql`). `players.id` *is* the sign-in
  (`auth.users.id`, `20260925150000_fleets_and_players.sql`), so a person can be one player,
  once, anywhere. `players.github_id` and `github_login` are unique across the whole table.
- **Access is one email check, repeated four times:**
  - `is_crew()` checks the token's email `like '%@vertuoza.com'`;
  - `hook_before_user_created` refuses every other domain;
  - the arcade's `isCrewEmail()` (`apps/galaxy/src/data/supabase-server.ts`);
  - the Google sign-in's `hd: 'vertuoza.com'`.

  A second company has nowhere to go.
- **Two companies would silently erase each other's history.** Event ids carry no organisation
  (`planet:<prd>:charted`, `zone:<repo>:<prd>:<slice>:claimed`, `game/projector.mjs`). The ledger
  appends with `on_conflict=id` and `resolution=ignore-duplicates` (`game/sources/supabase.mjs`).
  So a second workspace's PRD #12, or its repository called `api`, is dropped without an error.
- **The organisation is a literal.** `buildSnapshot()` defaults to `org = 'vertuoza'` and
  `planRepo = 'vertuo-omni-plan'` (`game/sources/github.mjs`), and no command overrides it.
- **The look is a literal.**
  - The V mark is one module (`apps/galaxy/src/arcade/mark.ts`), drawn on the deck
    (`VertuozaMark` in `ArcadeApp.tsx`) and on the boot screen (`drawBoot` in `scenes.ts`).
  - "VERTUOZA" and "© 2026 VERTUOZA" are typed into `screens.tsx`.
  - The four brand stripes on every hero's suit are `FLAT` colours the sprite forge never tints
    (`packages/sprites/src/forge.mjs`).
  - The arcade's colours are fixed custom properties on `:root` (`arcade.css`).

## Solution

A **workspace** owns everything the game holds: its fleets, sectors, players and ledger, its GitHub
organisation, its mark and its colours. A person reaches a workspace by being a **member** of it.
Vertuoza is workspace #1.

### Workspaces and members

Two new tables:

```sql
public.workspaces
  id           uuid primary key default gen_random_uuid()
  slug         text not null unique  check (slug ~ '^[a-z0-9-]{2,32}$')   -- 'vertuoza'
  name         text not null         check (char_length(name) between 1 and 40) -- 'Vertuoza'
  github_org   text                  -- 'vertuoza': the owner of the repositories the projector reads
  plan_repo    text                  -- 'vertuo-omni-plan': the repository that carries the PRD issues
  join_domain  text unique           -- 'vertuoza.com': confirmed accounts of this domain join by themselves
  theme        jsonb not null default '{}' check (public.valid_theme(theme))
  created_at   timestamptz not null default now()

public.workspace_members
  workspace_id uuid not null references public.workspaces on delete cascade
  user_id      uuid not null references auth.users on delete cascade
  role         text not null default 'member' check (role in ('owner', 'member'))
  joined_at    timestamptz not null default now()
  primary key (workspace_id, user_id)
```

- A person may belong to **several** workspaces.
- `role` is what membership is. Nothing in this PRD reads `owner`; PRD 2 creates a workspace with
  one.

### The game's tables, scoped by workspace

| Table | Today | After |
|---|---|---|
| `sectors` | PK `name` | `workspace_id` → workspaces; PK `(workspace_id, name)` |
| `teams` (the fleets) | PK `name`; `home` → `sectors(name)` | PK `(workspace_id, name)`; `(workspace_id, home)` → `sectors` |
| `players` | PK `id` → `auth.users`; `team` → `teams(name)`; `github_id`, `github_login` unique | `user_id` replaces `id`; PK `(workspace_id, user_id)` → `workspace_members` on delete cascade; `(workspace_id, team)` → `teams`, still nullable; `unique (workspace_id, github_id)`, `unique (workspace_id, github_login)` |
| `ledger_events` | PK `id`; indexes `(at, id)`, `(planet, at)` | PK `(workspace_id, id)`; indexes `(workspace_id, at, id)`, `(workspace_id, planet, at)` |

Everything else each table holds stays: its columns and checks, `valid_hero()`, the rule that a fleet
is retired and never deleted, and the trigger that refuses `UPDATE` and `DELETE` on the ledger.
`ledger_events.team` stays a stamp, not a foreign key.

**The workspace is a storage column, never an event field.** The event contract (`game/events.mjs`),
the event ids, the projector, the economy, the rulebook and `@omni/galaxy` do not change. Two
workspaces may each hold a `planet:12:charted`.

### Access

"Your email ends in `@vertuoza.com`" becomes "you are a member of this workspace".

- **`is_member(workspace uuid)`**, stable and security definer, is true when a
  `workspace_members` row exists for `auth.uid()`. `is_crew()` is dropped.
- **`join_by_domain()`**, an RPC and security definer, adds the caller as a `member` of every
  workspace whose `join_domain` is the domain of their email.
  - It acts only when that email is **confirmed** (`auth.users.email_confirmed_at is not null`).
  - It is idempotent, and returns the slugs of the workspaces the caller belongs to.
  - The auth callback calls it after every sign-in, beside `link_github()`. The page also calls it
    once when a signed-in person has no membership, so a session that predates the migration joins
    too.
- **`hook_before_user_created`** keeps its name and signature, so the dashboard's hook setting still
  points at it.
  - It refuses an account when **no workspace's `join_domain`** is the domain of its email.
  - With Vertuoza alone, that is today's rule. PRD 2 opens it.
  - Its message names no company: `OMNI LOOP is not open to <domain> yet.`
- **`link_github()`** refreshes the GitHub id and login on **every** player row of the caller, one
  per workspace.
- **`players_guard`** refuses a retired fleet of the row's own workspace, stamps `team_since`, and on
  insert copies the GitHub id and login from `my_github()`, never from the client. `my_github()` is
  unchanged.

Row-level security, with explicit grants (`auto_expose_new_tables = false` stays):

| Who | May |
|---|---|
| Anonymous | **Nothing.** Today it reads the fleets; after, no grant on any table |
| Signed in | Read the workspaces they belong to (`is_member(id)`) and their own membership rows (`user_id = auth.uid()`) |
| A member of W | Read W's `ledger_events`, `sectors`, `teams` and `players` (`is_member(workspace_id)`), and nothing of any other workspace |
| A member of W, GitHub linked | Insert their own player row in W: `user_id = auth.uid()`, `is_member(workspace_id)`, `exists (select 1 from my_github())`. Column grants: insert `(workspace_id, user_id, display_name, team, hero)`, update `(display_name, team, hero)` of their own row only |
| Service role | Read every table; insert into `ledger_events` (never update or delete); write `workspaces`, `workspace_members`, `sectors` and `teams` |

Workspaces, memberships, sectors and fleets are written only by the service role or a migration.
PRDs 2 to 4 open them to their owners.

### Vertuoza, workspace #1

The migration inserts the workspace:

- `slug 'vertuoza'`
- `name 'Vertuoza'`
- `github_org 'vertuoza'`
- `plan_repo 'vertuo-omni-plan'`
- `join_domain 'vertuoza.com'`
- `theme '{}'`

It then inserts today's six fleets into it, with the same labels, colours, mottos, mascots and
order: `beaver`, `octopod`, `picsou`, `cia`, `pirates`, and `invincible-team`, still retired. As
today, no sectors are inserted: the real ones come in a later migration.

### The workspace's look

**The mark is the first letter of the workspace's name.**

- A bar alphabet, A to Z, in `apps/galaxy/src/arcade/mark.ts`, drawn in the V's style:
  - horizontal pills, 6 pixels tall, with the same stepped caps;
  - on the same 36-pixel grid;
  - with the same left-to-right gradient and one-pixel shade.
- The **V is today's V**, the same `MARK_RUNS`, pixel for pixel. Other letters may space their rows
  differently to stay legible.
- The letter is the first character of `name`, upper-cased, taken without accents. A name that
  does not start with A to Z gets **O**, for Omni.
- No column holds the letter.
- The boot screen draws whichever letter it is given, from one `{ size, runs, stops, shade }`
  value, with its row-by-row reveal kept. #94 retires the deck plates and their emblem. Any other
  place that draws the mark after #94 reads the same value.

**A theme is a set of named colour tokens.** One module (`apps/galaxy/src/arcade/theme.ts`) lists
every token and its default, which is today's value:

| Tokens | Today's source |
|---|---|
| Every colour custom property on the arcade's `:root`: `void`, `deep`, `cab`, `navy`, `navy-dark`, `white`, `dim`, `plasma`, `plasma-dark`, `yellow`, `gold`, `red`, `cyan`, `green`, and any colour #94 adds there for the Game Boy's body | `arcade.css` |
| `mark-1`, `mark-2`, `mark-3` and `mark-shade-1`, `mark-shade-2`, `mark-shade-3`: the mark's gradient and its shade | `MARK_STOPS`, `MARK_SHADE` in `mark.ts` |
| `stripe-1` to `stripe-4`: the four stripes on every hero's suit | `FLAT` 1 to 4 in `forge.mjs` |

- **Storing a theme.** `workspaces.theme` holds **only the overrides**, e.g.
  `{ "plasma": "#2fc6a4", "plasma-dark": "#178a80" }`.
  - `valid_theme()` in the database refuses anything but an object whose keys are known tokens and
    whose values are `#rrggbb`.
  - A zod schema in the app does the same. There, an invalid entry is **dropped with a console
    warning** and its default applies, so a colour never breaks the cabinet.
  - Vertuoza's theme is `{}`.
- **Applying a theme.** The resolved theme is written as CSS custom properties on the arcade's root
  element. The canvas scenes and the mark read the same resolved values.
- **The stripes.** The sprite forge takes an optional colour override for its `FLAT` entries, and
  the arcade passes `stripe-1` to `stripe-4`. Forged with no override, every sprite is identical
  to today's.
- **Fonts** are not tokens.
- **Keeping the list whole.** Every colour custom property on `:root` must be a token, so the
  Game Boy's body colours are themeable the day #94 adds them.

**The house brand** is one constant in the arcade: `{ name: 'Vertuoza', theme: {} }`.

- The signed-out screens, demo mode and the single-file artifact use it.
- A signed-in member sees their workspace's brand.
- "VERTUOZA" on the boot screen and "© 2026 VERTUOZA" on the title are rendered from the brand's
  name.
- PRD 2 turns the house brand into Omni's.

### The arcade

**Signed in**

- `page.tsx` reads the person's memberships and uses **the workspace they joined first** (by
  `joined_at`, then `slug`). PRD 2 adds switching between workspaces.
- Every loader in `src/data/load-galaxy.ts` (galaxy, fleets, crew, me) filters by that workspace.
- Joining a fleet (`lockIn` in `ArcadeApp.tsx`) writes `workspace_id` with the player row.
- `isCrewEmail()` is removed, and "crew" means "has a workspace". A signed-in person with no
  workspace gets today's outsider screen.

**Signed out**

- The page reads nothing from the database.
- The attract mode plays the built-in fleets, as the error path already does (`demoFleets()`, which
  match Vertuoza's fleet rows), under the house brand.

**Unchanged**

- The sign-in copy ("SIGN IN WITH YOUR VERTUOZA ACCOUNT", the outsider text) and `hd:
  'vertuoza.com'` stay: PRD 2 rewrites sign-in.
- The joining flow, the screens and the controls.

### The game scripts

- **Picking the workspace.**
  - `game:project`, `game:score`, `game:banner` and `game:export` take `--workspace <slug>`,
    falling back to `OMNI_LOOP_WORKSPACE`.
  - With neither set, they exit non-zero and say so. With an unknown slug, they exit non-zero and
    name it.
  - `.github/workflows/game.yml` sets `OMNI_LOOP_WORKSPACE: vertuoza`.
- **Reading GitHub.**
  - The projector reads `github_org` and `plan_repo` from the workspace row.
  - `buildSnapshot()` loses its `'vertuoza'` and `'vertuo-omni-plan'` defaults: called without
    them, it throws.
  - A workspace without a `github_org` is refused by `game:project` and `game:banner`.
- **Reading and writing Supabase.** `game/sources/supabase.mjs` filters every read (`loadConfig`,
  the ledger's `read()`) by `workspace_id=eq.<id>`. It appends each row with its `workspace_id`,
  and `on_conflict=workspace_id,id`.
- **Exporting.** `game:export <dir>` writes one workspace: `workspace.jsonl` (its row) beside that
  workspace's `ledger_events`, `sectors`, `teams` and `players`.
- **Unchanged.** The token (`OMNI_GAME_TOKEN`) and the rankings issue. PRD 3 moves to installation
  tokens and loops over every workspace.
- **The local seed.** `pnpm galaxy:seed` writes the demo galaxy's sectors and ledger into the
  `vertuoza` workspace, which the migration has already created.

### The migration

One new, forward migration, `supabase/migrations/<timestamp>_workspaces.sql`, in five steps:

1. **Drops** `ledger_events`, `players`, `teams` and `sectors` (with their policies, grants and
   triggers), and the functions only they use: `is_crew()` and `players_guard()`.
2. **Creates** `workspaces`, `workspace_members`, `valid_theme()` and `is_member()`.
3. **Recreates** the four tables as above.
4. **Redefines** `hook_before_user_created()`, `link_github()` and `players_guard()`, and adds
   `join_by_domain()`.
5. **Inserts** Vertuoza and its fleets.

The four earlier migrations stay as history. The `supabase` workflow applies it on merge, as it
applies every migration. `auth.users` is untouched.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Four PRDs: workspaces and look (this one), open sign-up, workspace setup, editable fleets and solo play. | Each subsystem ships and is reviewed alone; the database is the one the other three need. |
| D2 | A person may belong to several workspaces; a player is per `(workspace, person)`; a GitHub login is unique per workspace. | Cheap now, expensive after launch: a freelancer, or anyone testing a second workspace. |
| D3 | A forward migration drops and rebuilds the four game tables; production's rows are not carried over. | Production holds nothing worth keeping, and the release path (`supabase db push` on merge) needs no manual step. Squashing would need a hand reset of production; altering in place is the most intricate SQL, spent on nothing. |
| D4 | The mark is the first letter of the workspace's name, A to Z, in the V's bar style; otherwise O. | One rule serves every company; Vertuoza keeps its V pixel for pixel; no mark to upload or store. |
| D5 | A theme is the arcade's colour tokens with today's defaults; a workspace stores only its overrides, checked in the database and in the app. | A settings page (PRD 3) writes one JSON object; Vertuoza's `{}` is today's look; an unknown key can never slip in. |
| D6 | Blocked by #94. | #94 is rebuilding the cabinet (`ArcadeApp.tsx`, `arcade.css`) now; building on the finished Game Boy themes its body instead of fighting it. |
| D7 | Anonymous visitors read nothing; signed out, the attract mode plays the built-in fleets under the house brand. | With several workspaces, a public fleets table would list every company's fleets. The built-in fleets are Vertuoza's, so signed-out looks as today. |
| D8 | Signed in, the arcade shows the workspace the person joined first. | Only Vertuoza exists until PRD 2, which brings switching and the URL for it. |
| D9 | Joining by email domain, on a confirmed email only, through `join_by_domain()` called at sign-in. | Keeps today's rule for Vertuoza, stricter than today's (which trusts the token's email), and needs no trigger on `auth.users`. |
| D10 | The workspace is a storage column, not an event field. | The projector, the economy, the rulebook and `@omni/galaxy` stay untouched; ids stay readable. |
| D11 | The game scripts take one workspace (`--workspace`, `OMNI_LOOP_WORKSPACE`); no default. | The personal token reads one organisation. Looping over workspaces waits for installation tokens (PRD 3). A missing workspace fails loudly instead of writing the wrong one. |

## User stories

- As a **Vertuoza player**, I sign in with my Google account as before, pick a fleet, name and hero
  again once, and from then on the arcade looks, plays and scores exactly as it did.
- As a **member of one workspace**, I never see another workspace's fleets, sectors, players or
  planets, whatever I ask the database.
- As **whoever builds open sign-up (PRD 2)**, I create a workspace with one insert, and it is
  isolated, drawn with its own letter, and coloured by its theme, without touching Vertuoza.
- As **whoever builds the setup page (PRD 3)**, I change a workspace's Game Boy colours by writing
  `workspaces.theme`, and the database refuses a token or a colour that does not exist.
- As **the game workflow**, I poll, score and back up the `vertuoza` workspace, and fail loudly when
  no workspace is named.

## Scope

**In:**

- **Database:** the two new tables; the four game tables scoped by workspace; `is_member()`,
  `join_by_domain()` and `valid_theme()`; the redefined hook, `link_github()` and `players_guard()`;
  Vertuoza and its fleets.
- **Access checks:** `supabase/checks/access.sql`, rewritten for workspaces.
- **Game:** `--workspace` on the four game scripts; the workspace's organisation in the projector;
  workspace-scoped reads, appends and export; `game.yml` naming the workspace.
- **Arcade:** the bar alphabet and the letter mark; the theme module, its schema and its CSS
  variables; the tintable stripes in the sprite forge; the house brand; the workspace-scoped
  loaders and joining.
- **Local seed:** the seed and its generator, in the `vertuoza` workspace.
- **READMEs:** `apps/galaxy/README.md` (the database section, the screens table, the deploy steps)
  and `game/README.md`, where they describe what changes.

**Out:**

- **PRD 2:** sign-in with any Google or GitHub account, creating a workspace, invitations,
  switching between workspaces and a URL per workspace, the signed-out Omni brand, and the sign-in
  copy.
- **PRD 3:** the setup page and any settings screen (the theme editor included), making the GitHub
  App public, installation tokens, and polling several workspaces.
- **PRD 4:** creating, editing or leaving fleets from the arcade, and solo play.
- **Not planned:** a working calendar per workspace (the calendar stays `Europe/Brussels`), fonts
  or sprite ramps beyond the four stripes as tokens, and anything in `apps/omni-app` or `kit/`.
- **No data move:** carrying production's rows over (D3).

## Test seams

- **Database: `supabase/checks/access.sql`.** The `supabase` workflow runs it on every pull request
  that touches `supabase/`, after the migrations and the seed apply to an empty database. It stays
  one transaction, rolled back, with every failure a `FAIL:` exception.
  - **Kept, rekeyed by workspace:** every existing case (the crew reads, a player writes only their
    own row and never their GitHub login, the service role appends and never rewrites, the hook).
    The anonymous case now expects **nothing** readable, fleets included.
  - **Isolation, new:** a second workspace, and a member of each.
    - A member of one reads zero rows of the other from each of the six tables.
    - They cannot insert a player row in the other workspace.
    - They cannot join a fleet of the other workspace (the foreign key refuses it).
  - **Keys, new:**
    - The same GitHub login is a player in two workspaces.
    - The same GitHub login twice in one workspace is refused.
    - The same ledger `id` exists in two workspaces.
  - **`join_by_domain()`, new:**
    - A confirmed `@vertuoza.com` account joins `vertuoza`.
    - An unconfirmed one joins nothing.
    - A second call adds no row.
    - Another domain joins nothing.
  - **Theme, new:** `valid_theme()` refuses an unknown token, a colour that is not `#rrggbb`, and a
    value that is not an object.
- **Unit tests (vitest).** They never call GitHub or Supabase (the playbook's rule): `fetch` and `gh`
  are stubbed, as today.
  - **`game/sources/supabase.test.mjs`:**
    - every read carries `workspace_id=eq.<id>`;
    - appends carry `workspace_id` and `on_conflict=workspace_id,id`;
    - an unknown slug throws.
  - **Game arguments:**
    - `--workspace` beats `OMNI_LOOP_WORKSPACE`;
    - neither set, or an unknown slug, is an error naming what is missing;
    - `buildSnapshot()` without `org` throws.
  - **`apps/galaxy/src/arcade/mark.test.ts`:**
    - V equals today's runs;
    - every letter A to Z stays inside the 36×36 box;
    - `Élan` gives E, and `42 Labs` and the empty string give O.
  - **`apps/galaxy/src/arcade/theme.test.ts`:**
    - the defaults equal today's values;
    - every colour custom property in `arcade.css`'s `:root` is a token;
    - the token names `valid_theme()` accepts, in the latest migration that defines it, are exactly
      the module's;
    - overrides apply;
    - invalid entries are dropped and their defaults kept.
  - **`packages/sprites`:**
    - with no override, every sprite forges byte-identical to today;
    - a stripe override changes only the stripe pixels.
  - **`apps/galaxy/src/arcade/onboarding.test.ts`:**
    - a session with a workspace is crew;
    - a session without one goes to the outsider screen.
- **By eye.** Vertuoza signed out and signed in, on the desktop and Game Boy forms, before and
  after: the same screens. A themed `Acme` workspace, created by SQL on a local stack, shows an A
  and its own Game Boy colours.

## Risks

- **What a merge publishes.** The `supabase` workflow's `deploy` job applies the migration to
  production. The four game tables are dropped and rebuilt, so every player, fleet, sector and
  ledger row goes. This is accepted (D3). `auth.users` is untouched: people sign in again,
  `join_by_domain()` puts them back in Vertuoza, and they pick a fleet, name and hero again.
- **The gap between merge and migration.** Code and schema land a few minutes apart.
  - A game poll in that gap fails loudly and the next one succeeds.
  - An arcade deployed before the migration shows its existing "THE GALAXY IS OUT OF REACH" screen
    for those minutes.
  - Switch the repository variable `GAME_ENABLED` off before merging, and back on once the
    `supabase` workflow's deploy is green.
- **The sign-up hook.** If the migration renamed it or changed its signature, the dashboard's
  **Before User Created** setting would point at nothing and every sign-in would fail. The migration
  keeps `public.hook_before_user_created(jsonb)` as it is named today, and `access.sql` calls it.
- **Rollback.** Migrations only go forward: reverting the pull request does not recreate what was
  dropped. The rollback is to revert the code **and** add a forward migration that restores the
  single-workspace schema (the end state of the four earlier migrations). Before merging, run
  `pnpm game:export backup/` (today's export reads today's schema).
- **PRD #71 (ask-mode, in the inbox)** plans its sign-in page and tables on `is_crew()` and
  `@vertuoza.com`. Once this ships, `is_crew()` no longer exists, and #71's spec must use
  `is_member()`. This PRD does not edit #71's spec.
- **The token list lives in two places:** `theme.ts` and `valid_theme()`. Adding a token later means
  a migration as well, and `theme.test.ts` fails until both lists agree.
- **PRD #94** reshapes the same arcade files. This PRD is blocked by it (D6), and themes whatever
  colours it leaves on `:root`.

## Acceptance criteria

1. **The migrations apply.** On an empty database, every migration and the demo seed apply, and
   `supabase/checks/access.sql` passes in the `supabase` workflow.
2. **Vertuoza exists.** After the migration, `public.workspaces` holds one row, `vertuoza`, with
   `github_org 'vertuoza'`, `plan_repo 'vertuo-omni-plan'`, `join_domain 'vertuoza.com'` and theme
   `{}`. Its six fleets carry today's labels, colours, mottos, mascots and order, and
   `invincible-team` is retired.
3. **Workspaces are isolated.** A member of one workspace reads no row of another from
   `workspaces`, `workspace_members`, `sectors`, `teams`, `players` or `ledger_events`, and cannot
   insert a player row in it.
4. **Anonymous visitors read nothing.** Signed out, no table of the game is readable.
5. **Joining needs a confirmed email.** A confirmed `@vertuoza.com` account that signs in becomes a
   `member` of `vertuoza`. An unconfirmed one, or another domain, joins nothing. Signing in again
   adds nothing.
6. **The sign-up hook** still refuses an address whose domain no workspace joins, and its message
   names no company.
7. **Keys are per workspace.** One GitHub login can be a player in two workspaces, and not twice in
   one. One ledger `id` can exist in two workspaces. A player cannot join a fleet of another
   workspace.
8. **The ledger stays append-only,** as today.
9. **The game scripts need a workspace.** `pnpm game:project --workspace vertuoza` reads the
   organisation and the plan repository from the workspace, and appends rows carrying its
   `workspace_id`. Without `--workspace` or `OMNI_LOOP_WORKSPACE`, or with an unknown slug, every
   game script exits non-zero with a message naming the problem.
10. **The export is per workspace.** `pnpm game:export <dir> --workspace vertuoza` writes
    `workspace.jsonl` and that workspace's four tables, and nothing of another.
11. **The mark is the name's first letter.** For a workspace named `Vertuoza`, the boot screen
    (and any other place that draws the mark) draws the same V as today, pixel for pixel. For a
    workspace named `Acme`, it draws an A in the same style. For a name that does not start with A
    to Z, it draws an O.
12. **A theme recolours the arcade.** For a workspace whose theme overrides `plasma` and
    `plasma-dark`, the arcade (the Game Boy's body included) uses those colours. With theme `{}`,
    every colour is today's. The database refuses an unknown token or a colour that is not
    `#rrggbb`. The app drops such an entry with a warning and keeps its default.
13. **The stripes are tintable.** With no override, every sprite forges exactly as today. With
    `stripe-1` to `stripe-4` overridden, only the stripe pixels change.
14. **Vertuoza looks as today.** Signed out, signed in, in demo mode and in the single-file
    artifact, the screens show what they showed before this PRD: "VERTUOZA PRESENTS", the V, "©
    2026 VERTUOZA" and the same colours.
15. **Crew means membership.** A signed-in person without a workspace sees the outsider screen. A
    member plays the joining flow as today, and their player row carries their workspace.
16. **`pnpm test` passes.**
