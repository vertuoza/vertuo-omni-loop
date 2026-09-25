# OMNI LOOP — fleets, sign-in and heroes

**Date:** 2026-09-25
**Status:** approved 2026-09-25; being built on `claude/upbeat-edison-432oxq`
**Scope:** how a person joins the game (a team is a *fleet* in the game's words). They sign in with their Vertuoza Google account, pick a fleet,
enter a name and build a hero, all from the keyboard, to an SNES-style score. Supabase becomes the
game's single source of truth: sectors, fleets, players and the ledger. This replaces §4 (teams and
sectors) and §7.2 (storage) of [`2026-09-24-omni-plan-game-design.md`](2026-09-24-omni-plan-game-design.md).

## 1. Decisions

Settled in the brainstorm:

| # | Question | Decision |
|---|---|---|
| D1 | The fleets | BEAVER, OCTOPOD, PICSOU, C.I.A. and a new **PIRATES**. INVINCIBLE (`invincible-team`) is retired. The list will keep changing. |
| D2 | Where a player's fleet comes from | The arcade: the player picks it. Nobody edits GitHub teams any more. |
| D3 | Source of truth | Supabase, for everything: sectors, fleets, players, the ledger. `projects.yml`, the GitHub team reads and `game/ledger/` in git are retired. |
| D4 | Sign-in | Google OAuth through Supabase Auth, `@vertuoza.com` accounts only. The OAuth client lives in the GCP QA project. |
| D5 | Google ↔ GitHub | Linked once, in the arcade, with a GitHub OAuth step (Supabase identity linking). Points are earned by GitHub login, so the link is what ties a player to their score. |
| D6 | The name | Up to 10 characters, `A–Z 0–9 -`, typed or picked on a letter wheel. |
| D7 | Music and sounds | Written in code (Web Audio): an original SNES-flavoured score, no audio files. |
| D8 | Input | Every step is playable from the keyboard alone. Clicks and taps keep working; phones use the on-screen pad. |

Assumed while writing this; correct any of them in review:

| # | Assumption |
|---|---|
| A1 | "Invisible" in the request is `invincible-team`. |
| A2 | The galaxy is internal data (PRD titles, logins), so once sign-in exists, every read of it needs a signed-in `@vertuoza.com` account. Signed out, the cabinet plays its attract mode without data. |
| A3 | A player may change fleet at any time from the menu. Points already earned stay with the old fleet; only new events follow the player. |
| A4 | The hero builder also offers a skin tone. It was not in the request, but a hero builder without one leaves people out. |
| A5 | Adding or retiring a fleet is a SQL migration for now. No admin screen. |

## 2. The flow

```
BOOT ─▶ TITLE (attract) ─START─▶ signed in? ──no──▶ INSERT COIN ─A─▶ Google (hd=vertuoza.com) ─┐
                                    │ yes                                                      │
                                    ◀──────────────────────────────── back on /auth/callback ◀─┘
                                    ▼
                  a player with an active fleet? ──yes──▶ WELCOME BACK ─▶ SELECT MODE
                                    │ no
                                    ▼
    PRESS START ─▶ INTRO ─▶ SELECT YOUR FLEET ─▶ ENTER YOUR NAME ─▶ BUILD YOUR HERO ─▶ LINK GITHUB ─▶ READY ─▶ SELECT MODE
    (unlocks audio)                                                                   (A link · B later)
```

"No player yet" covers three cases: a first visit, a player who never finished onboarding (they resume
at the first missing step), and a player whose fleet was retired (they go straight to SELECT YOUR FLEET
with the line "YOUR FLEET WAS DISBANDED. CHOOSE A NEW ONE.").

### 2.1 Screens

| Screen | What happens | Keys | Sound |
|---|---|---|---|
| **Insert coin** | "SIGN IN WITH YOUR VERTUOZA ACCOUNT". A sends the player to Google, with `hd=vertuoza.com`. | A go · B back | coin drop |
| **Press start** | After the redirect the page is new, and browsers refuse audio until a key is pressed. One screen: "WELCOME, RECRUIT · PRESS START". | START | none (it's the gate) |
| **Intro** | About 20 s, skippable with START. Four Vertuoza stripes on black; starfield warp; OMNI-MAN rises with his plasma trail; three lines type in, one per bar: "ENTROPY IS WINNING." "THE GALAXY NEEDS HEROES." "CHOOSE YOUR FLEET."; the five mascots flash in, one per beat, each with its name. | START skip | intro theme |
| **Select your fleet** | The comic hero-select wall (the current `drawFleets` background). The selected mascot at 3× under a spotlight, name in the fleet colour, motto, crew count, season points. A locks in: the screen flashes the fleet colour, the mascot jumps, the name fills the screen, fanfare. | ◀ ▶ move · A lock in · B back | select loop; each fleet's motif on hover; fanfare |
| **Enter your name** | Classic arcade entry. 10 slots and a blinking cursor, a letter wheel below. Prefilled with the Google first name, in capitals, accents stripped (`Élodie` → `ELODIE`), cut to 10. | type, or ▲▼ spin · ◀ ▶ move · ⌫ erase · ENTER done · ESC back | name loop; blip per letter; buzz on an empty name |
| **Build your hero** | Left: the hero at 3× on a pedestal, idling, cape fluttering. Right: rows `BODY`, `SKIN`, `HAIR`, `SUIT`, `CAPE`, then `RANDOM` and `DONE`. It starts from a random look with the suit in the fleet colour. | ▲▼ row · ◀ ▶ value · TAB random · A on DONE | name loop continues; tick per change; whoosh on random |
| **Link GitHub** | "ONE LAST THING, PIERRE. LINK YOUR GITHUB SO YOUR PULL REQUESTS SCORE FOR PIRATES." A goes to GitHub and back: "LINKED AS @PDERVAL". B means later: the menu keeps a blinking `LINK GITHUB` until it's done. | A link · B later | coin + chime on success |
| **Ready** | The hero flies across the galaxy alongside the fleet mascot: "PLAYER 1 READY". | any key | launch sting |
| **Welcome back** | Two seconds: "WELCOME BACK, PIERRE", the hero and the mascot side by side. Then SELECT MODE. | any key skips | welcome jingle |

SELECT MODE gains `MY HERO` (name and builder), `CHANGE FLEET`, `LINK GITHUB` (until linked) and
`SIGN OUT`. Changing fleet reuses the select screen and ends on a confirmation: "YOUR FUTURE POINTS GO
TO PIRATES. YOUR PAST POINTS STAY WITH BEAVER. A CONFIRM · B CANCEL". The marquee shows
`P1 PIERRE · PIRATES` and the hero sprite.

Heroes appear in the Hall of Heroes (hero and name instead of the GitHub login; contributors who never
joined keep showing their login) and in a crew strip on the Fleets screen.

### 2.2 Keyboard only

Today `KEYS` maps `W A S D Z X J K` to moves and buttons, so on the name screen those letters would move
the cursor instead of typing. Each scene therefore declares an input mode:

- `pad` (every scene today): the current `KEYS` table.
- `text` (ENTER YOUR NAME only): `A–Z`, `0–9` and `-` type; letters with accents are folded (`é` → `E`);
  Backspace erases; Enter is START; Escape is B; the arrows keep their meaning. `M` types an M
  instead of muting.

No step needs a pointer. The only screens we don't control are Google's and GitHub's, and both work
from the keyboard. We don't send `prompt=select_account`, so a browser signed in to one Vertuoza account
goes straight through. The on-screen pad drives the letter wheel on phones.

## 3. The hero builder

One new sprite per body, `hero-girl` and `hero-boy`, 32×48 like `omni`, drawn in the same forge style:
the navy-and-white suit and the four Vertuoza stripes on the chest, plus a cape behind the body with a
two-frame flutter. The belt buckle takes the fleet colour. Every choice is a **recolour**, not new art.
`drawSprite` already takes a `tint` that swaps a material's 4-tone ramp (that's how Entropy is coloured
per wound kind), so each option is a ramp swap on one material:

| Row | Material | Choices |
|---|---|---|
| BODY | the sprite | GIRL, BOY (the silhouette and the hair shape differ) |
| SKIN | `S` | 6 tones |
| HAIR | `H` | 8: black, brown, auburn, blonde, ginger, silver, blue, pink |
| SUIT | `W` (main), `N` (trim) | 8 pairs: FLEET (the fleet's colour, the default), OMNI classic (white/navy), crimson, emerald, gold, violet, black, orange |
| CAPE | `P` (recoloured) | 9: none, and 8 colours |

The presets live in `@omni/sprites` (`HERO_PRESETS`). A player's hero is stored as indices, versioned so
presets can grow: `{ "v": 1, "body": "girl", "skin": 2, "hair": 5, "suit": 0, "cape": 3 }`. A test forges
every combination (2 × 6 × 8 × 8 × 9 = 6,912) and checks it renders.

Hair styles, masks and emblems are out of scope; the versioned shape leaves room for them.

## 4. Fleets: one row per team

A fleet is one row in `public.teams`: everything the arcade shows about it lives there, and
`FLEETS` in `apps/galaxy/src/arcade/fleets.ts` goes away.

| Column | Example | Notes |
|---|---|---|
| `name` | `pirates` | Primary key, slug. Stamped on ledger events. |
| `label` | `PIRATES` | What the arcade prints. |
| `color` | `#2fc6a4` | `#rrggbb`. Cards, chips, the belt buckle, the suit default. |
| `motto` | `Takes the zones nobody claims.` | The fleet card. |
| `mascot` | `pirate` | A sprite key. Unknown or null: the fleet is drawn as a hero in its own colour, so a new fleet needs **no art** to play. |
| `home` | a sector | As today. |
| `sort` | `50` | Order on the select wall. |
| `retired_at` | null | Retired fleets vanish from the select wall but still render in history. |

The starting roster:

| name | label | colour | mascot | motto |
|---|---|---|---|---|
| `beaver` | BEAVER | `#d08a4a` | `beaver` | Builds the dam. Secures the zone. |
| `octopod` | OCTOPOD | `#b07cff` | `octopod` | Eight arms, eight sub-PRs. |
| `picsou` | PICSOU | `#ffd84a` | `picsou` | Every coin counted twice. |
| `cia` | C.I.A. | `#9aa3c8` | `cia` | Knows every open question. |
| `pirates` | PIRATES | `#2fc6a4` | `pirate` | Takes the zones nobody claims. |

The `pirate` mascot, 32×32 like the others: a tricorn with a white skull, an eye patch, a red-and-white
striped shirt, a raised cutlass, and a parrot on the shoulder whose wings flap between the two frames.
Sea teal keeps it apart from Entropy red and from the other four fleets.

**How to add, change or retire a fleet.** Write a migration, open a PR, merge it. The `supabase`
workflow proves it applies, and the deploy job pushes it to production.

```sql
-- supabase/migrations/<timestamp>_fleet_<name>.sql
insert into public.teams (name, label, color, motto, mascot, home, sort)
values ('dragons', 'DRAGONS', '#ff6a3d', 'Breathes on stale PRs.', null, '<sector>', 60);

update public.teams set retired_at = now() where name = 'pirates';   -- retire
```

A fleet is never deleted: ledger events name it forever. Its players are asked to choose again the
next time they press START.

## 5. Data model

In Supabase, `public` schema. Each block below is a migration.

```sql
-- Fleets carry their look (§4). invincible-team is retired; pirates is added.
alter table public.teams
  add column label text, add column color text check (color ~ '^#[0-9a-f]{6}$'),
  add column motto text not null default '', add column mascot text,
  add column sort smallint not null default 0, add column retired_at timestamptz;

-- A player is a signed-in person. Their email stays in auth.users and is never copied here.
create table public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (display_name ~ '^[A-Z0-9-]{1,10}$'),
  team         text references public.teams (name) on update cascade,
  team_since   timestamptz,
  hero         jsonb not null,
  github_id    bigint unique,          -- set only by link_github()
  github_login text unique,            -- set only by link_github()
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

- A trigger stamps `team_since` and `updated_at`, and refuses a retired fleet.
- `link_github()` is `security definer`. It reads the caller's GitHub identity from `auth.identities`
  (`provider = 'github'`, `identity_data->>'user_name'`, `provider_id`) and writes `github_id` and
  `github_login` on the caller's row. Nobody can type a login, so nobody can claim someone else's
  score. A GitHub account already linked to another player is refused with a readable message.
- `sectors` becomes the truth for repositories (it was a copy of `projects.yml`). Real sectors are a
  migration too, and remain an open placeholder as before.
- `ledger_events` is unchanged: same columns, same type check, same append-only trigger.

### 5.1 Who may do what

`is_crew()` is true when the JWT's email ends in `@vertuoza.com`:
`(auth.jwt() ->> 'email') ilike '%@vertuoza.com'`.

| Table | anon | authenticated (crew) | service role (GitHub Actions) |
|---|---|---|---|
| `teams` | select (the attract mode draws the fleets) | select | all |
| `sectors`, `ledger_events` | nothing (**narrowed from today**) | select | select, insert (ledger: insert only) |
| `players` | nothing | select all rows; insert own row; update own `display_name`, `team`, `hero` (column grants) | select |

The migrations keep granting explicitly (`auto_expose_new_tables = false`), as today.

## 6. Sign-in and security

- **Google**: Supabase Auth's Google provider, with the client ID and secret from GCP QA.
  `signInWithOAuth({ provider: 'google', options: { queryParams: { hd: 'vertuoza.com' } } })`.
  `hd` only filters Google's account chooser, so the domain is enforced three times:
  1. the OAuth consent screen is **Internal**, if the GCP QA project belongs to the vertuoza.com
     Google Workspace organisation (only its accounts can consent);
  2. a Supabase **before-user-created** auth hook, a Postgres function in a migration, refuses any
     other domain, so the account is never created;
  3. every policy checks `is_crew()`.
- **GitHub link**: Supabase manual identity linking (`enable_manual_linking = true`), a GitHub OAuth app
  owned by the vertuoza org, `supabase.auth.linkIdentity({ provider: 'github' })`, then `rpc('link_github')`.
- **Sessions**: cookie sessions with `@supabase/ssr`. `/auth/callback` exchanges the code (PKCE) and
  returns to `/#continue`. Next 16 changed its request-interception and route conventions: read the
  guides in `node_modules/next/dist/docs/` before writing this (`apps/galaxy/AGENTS.md`).
- **The page** stops being prerendered. The server reads the session. Signed in, it loads the galaxy
  with the player's own session (RLS applies) and passes the player to the arcade. Signed out, it
  renders the arcade with the fleets only. As a side effect, the build no longer needs Supabase to be
  reachable.
- **Keys**: Vercel keeps only the publishable key; the secret key stays in GitHub Actions.
- **Demo mode** (no Supabase configured, and the single-file artifact): no sign-in. The whole onboarding
  still runs, against a guest player kept in `localStorage`, so UI work needs no backend at all.

## 7. The game pipeline on Supabase

```
GitHub ──pnpm game:project (Action, every 15 min)──▶ ledger_events (append-only)
               ▲ reads sectors, teams, players ◀──── Supabase ────┐
                                                                  ▼
                                   apps/galaxy on Vercel: per request, the player's session, RLS
```

- **Ledger store.** `game/ledger.mjs` becomes a store with one contract, `read()` and `append(events)`,
  and three implementations:
  - `supabaseLedger(db)`: insert with `on conflict do nothing`; the deterministic ids keep polls
    idempotent, exactly as today;
  - `fileLedger(dir)`: fixtures and offline runs;
  - `memoryLedger()`: tests.

  The pure core (projector, economy, planet state) does not change. The CLIs become async.
- **Config.** `loadProjects()` becomes `loadConfig(db)`. It returns the same shape (`sectors`, `teams`,
  `repos`, `sectorOf`, `homeOf`), built from `sectors`, `teams` and a roster of
  `players.github_login → team`. The roster read replaces the GitHub team reads and keeps rule F7: if
  the roster can't be read, nothing is appended.
- **Team stamps.** As today, an event is stamped with the contributor's fleet at the moment it's first
  appended, and never changes after that (A3). A contributor with no linked player has no fleet and
  scores individually (spec §8, unchanged).
- **Workflow.** The `ledger` job no longer commits: no `contents: write`, and `GAME_PUSH_TOKEN` is
  retired. It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `OMNI_GAME_TOKEN` no longer needs
  `members: read`. The `rankings` job folds the ledger from Supabase and posts, as today.
- **Backup.** Once the ledger lives only in the database, the team stamps can't be rebuilt from GitHub.
  So the `rankings` job also uploads a JSONL export (ledger, sectors, teams, players without emails)
  as a workflow artifact, kept 90 days. Supabase Pro's point-in-time recovery is the better answer if
  the budget allows it.
- **Retired:** `projects.yml`, `game/ledger/*.jsonl`, `game/season/*.json`, `pnpm galaxy:sync` and
  `apps/galaxy/scripts/sync-ledger.mjs`, the GitHub team reads in `game/sources/github.mjs`, and the
  Vercel ignored-build step (it only skipped ledger commits). `game:banner` folds the season from the
  ledger instead of reading `game/season/`; like every `game:*` command it needs
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `game:score --rankings <file>` writes the page the
  workflow posts.
- **Spec updates.** Principle 3 now reads: the ledger can be rebuilt from GitHub, except the fleet
  stamps, which the export keeps. §4 and §7.2 point here.

## 8. Sound

A small Web Audio engine in `apps/galaxy/src/arcade/music.ts`, next to today's `sound.ts`.

- **Voices**, SNES-flavoured: two pulse leads (25% and 12.5% duty, built as `PeriodicWave`s), a triangle
  bass, noise drums (a white-noise buffer through a band-pass filter), light vibrato, ADSR envelopes.
  A shared echo gives the SNES "room": a delay of about 180 ms with 0.3 feedback, low-passed around 3 kHz.
- **Sequencer**: a look-ahead scheduler (a 25 ms timer that schedules 100 ms ahead) playing patterns
  written as note strings, so the songs are short, reviewable text.
- **Tracks**: `intro` (heroic, about 24 bars, loops its last 8 while it waits), `select` (upbeat loop),
  `name` (calm loop, under the name entry and the builder), `fanfare` (fleet locked in),
  `welcome` (2 s), `launch` (READY).
- **Fleet motifs**, one per card on the select wall:

  | Fleet | Motif |
  |---|---|
  | BEAVER | two woody knocks and a low triangle hop |
  | OCTOPOD | a bubbly rising arpeggio with a pitch wobble |
  | PICSOU | a coin "ka-ching" and a shimmer |
  | C.I.A. | a muted three-note minor spy line |
  | PIRATES | a two-note "yo-ho" and a cannon thump |
  | new fleets | a motif generated from the fleet name, so it's stable |

- **New effects**: `coin`, `type`, `erase`, `buzz`, `random`, `lock-in`, `linked`.
- `M` mutes music and effects, with a short fade, and stays remembered per browser as today. Music
  starts only after a key press (§2.1, Press start).

## 9. Your part: setup outside the repository

1. **GCP QA** › APIs & Services:
   - OAuth consent screen: **Internal** if possible, app name `OMNI LOOP`.
   - OAuth client of type *Web application*, with these authorised redirect URIs:
     - `https://<ref>.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:54321/auth/v1/callback` (local stack)
2. **GitHub** › vertuoza org › Developer settings: an OAuth App with the same Supabase callback URL.
3. **Supabase** › Authentication:
   - Providers: Google and GitHub, with their client IDs and secrets.
   - Allow manual linking.
   - Site URL: the production Vercel URL.
   - Redirect URLs: production, `https://*-<vercel-team>.vercel.app/**` for previews, and `http://localhost:3000/**`.
   - Hooks: enable *before user created* on the function the migration ships.
4. **Local**: `supabase/config.toml` reads the Google and GitHub secrets from `env(...)`. Without them,
   use demo mode.

## 10. Testing

- **Sprites**: every hero combination forges (§3); the `pirate`, `hero-girl` and `hero-boy` sprites have
  two frames and stay inside their box, like the existing sprite tests.
- **Game**: the store contract runs against `memoryLedger` and `fileLedger`; the existing projector and
  economy tests run unchanged; `loadConfig` is tested on table rows, including a failed roster read (F7).
- **Database** (`supabase` workflow): `psql` checks under `set role` and `request.jwt.claims`:
  - an outsider's JWT reads nothing;
  - a crew JWT reads everything, updates its own `team`, but can't set its `github_login` or touch
    another player's row;
  - anon can't read the ledger;
  - a retired fleet is refused.
- **Arcade**: the onboarding is a pure state machine (`onboarding.ts`: session, player, fleet state →
  next screen) with unit tests for every branch in §2; the name-entry reducer is tested for typing,
  the wheel, folding, the 10-character cap and an empty name. The music's pattern parser is tested;
  how it sounds is a manual check.

## 11. Delivery, in order

1. **`feat(supabase)`**: fleet columns, PIRATES in, INVINCIBLE retired, `players`, `is_crew()`, the
   policies, the domain hook, `link_github()`, the workflow checks; the demo world (`packages/galaxy/src/demo.mjs`)
   and `supabase/seed.sql` switch INVINCIBLE for PIRATES.
2. **`feat(game)`**: the ledger store, `loadConfig`, the workflow without commits, the export; retire
   `projects.yml`, the sync and the season files; rewrite spec §4 and §7.2 and the READMEs.
3. **`feat(galaxy)`**: sign-in, the session-aware page, gated reads, the GitHub link step.
4. **`feat(arcade)`**: the onboarding screens, the input modes, the new menu entries.
5. **`feat(sprites)`**: `hero-girl`, `hero-boy`, the presets, the `pirate` mascot, the fleet-colour
   fallback.
6. **`feat(sound)`**: the engine, the tracks, the fleet motifs, the new effects.

Steps 4 to 6 run on the demo galaxy and can proceed in parallel with steps 1 to 3.

**Launch.** Deploy steps 1 to 3 and invite everyone to join (a Slack post with the URL). Fill in the
real sectors, then switch `GAME_ENABLED` on. The first poll backfills history with everyone's current
fleet. Anyone who joins later keeps their individual points for what came before, but not the fleet
points.

## 12. Later

- An admin screen for fleets (§4 is migrations until then).
- An announcer voice ("CHOOSE YOUR FLEET!") through the Web Speech API.
- Heroes flying on the planet screen, in place of the fleet mascots.
- Refreshing `github_login` from `github_id` when someone renames their GitHub account.
- Hair styles, masks, emblems.

## 13. Open points

- The real sectors and repositories. This was already an open placeholder; it is now a migration.
- Whether the GCP QA project belongs to the vertuoza.com Workspace organisation. If it does, the consent
  screen can be Internal (§6); if it doesn't, the hook and the policies still enforce the domain.
- The Supabase plan: Free works, but Pro adds point-in-time recovery, and the ledger now lives only
  there.
