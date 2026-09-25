# OMNI LOOP — the galaxy arcade

The web UI of the game layer: a retro arcade cabinet that shows the galaxy. Every PRD is a planet,
every slice a zone, every open question or bug an Entropy unit on its surface. Signing in with a
`@vertuoza.com` Google account makes you a **visitor**: you may look at the galaxy. Linking your
GitHub account, once, makes you a **player**: you pick a fleet, enter a name and build a hero, and
your pull requests score for that fleet. All from the keyboard (design:
[`docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md`](../../docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md)).

- 640×360 game pixels drawn on a canvas and scaled up by whole numbers with hard pixel edges (late
  GBA detail). Text sits on top in DOM on the same grid, so it stays crisp and readable by screen
  readers.
- Sprites (`packages/sprites`) are laid out as material shapes and finished by a forge
  (`forge.mjs`): a 4-tone ramp per material lit from the top left, and coloured outlines (the
  material's darkest tone on the lit side, near-black on the shadow side). Heroes are 32×32
  (OmniMan 32×48) with two idle frames: OmniMan in the navy-and-white suit, the fleet mascots
  (beaver, octopod, picsou, cia, pirate; the retired invincible), Entropy (24×24) recoloured per
  wound kind, 16×16 icons.
- Every player's hero is the OmniMan body (a girl or a boy, 32×48) recoloured: skin, hair, suit and
  cape are ramp swaps on one material each (`packages/sprites/src/heroes.mjs`). A fleet without a
  drawn mascot flies as a hero in its own colour.
- Planets are procedural: a dithered, lit, rotating sphere per PRD with oceans, shallows, forests,
  ice caps, drifting clouds, a five-band terminator and an atmosphere glow. The surface greens in
  patches as zones are secured; Entropy veins glow on barren ground. Lost planets turn to ash and
  embers, locked ones to stone, cross-sector ones get a ring.
- The music and sounds are generated in the browser, SNES style: two pulse leads, a triangle bass,
  noise drums and one echo (`src/arcade/sound.ts`), playing songs written as note strings
  (`src/arcade/score.ts`). No audio files.

## Screens

| Screen | What it shows |
|---|---|
| Boot → Title | "VERTUOZA presents", then an attract loop: logo, the story, the top five heroes (signed in) |
| Insert coin | Sign in with the Vertuoza Google account; any other domain is refused and says why |
| Press start | After coming back from Google: browsers play sound only after a key press |
| Link GitHub | Before playing, once: points are earned under the GitHub login, which only the linked identity sets. B visits only |
| Intro | First visit only, 20 s, skippable: OmniMan rises, three lines type in, the fleets flash in |
| Select your fleet | The fleets from `public.teams`, each with its own motif; A locks in with a fanfare. Also CHANGE FLEET, with a confirmation of where the points go |
| Enter your name | Up to 10 characters, typed or spun on a letter wheel, pre-filled from the Google first name |
| Build your hero | Girl or boy, skin, hair, suit (the fleet colour first) and cape; TAB for random |
| Ready / Welcome back | The launch after a first visit; a two-second welcome for returning players |
| Select mode | PLAY (visitors: links GitHub), Galaxy map, Fleets, Hall of Heroes, How to play, then My hero and Change fleet (players), Sign out |
| Galaxy map | Sectors as nebulae; planets by state, threat and wounds; red hyperlanes from a locked planet to its blockers; distress pulses |
| Planet | The planet with its Entropy in orbit and the fleets on station; tabs for status, zones by phase, Entropy (age, decay, bounty) and the event log |
| Fleets | A hero-select wall of the fleets with season points, streak, planets, crew (players by name) |
| Hall of Heroes | Season high-score table from `game/economy.mjs`, with each player's hero and name |
| How to play | The scoring rules, read from `game/rulebook.mjs` so they never drift |

Controls: the arrows move, **Enter** is START, **A** (or Z, Space) is A, **B** (or X, Esc) is B,
**Tab** is SELECT (random on the hero builder), **M** mutes: the keys the screens show are the keys
to press. On the name screen letters type instead: Backspace erases, Enter confirms, Escape goes
back. No step needs a mouse; clicks and taps still work (a key hint such as "[A] LINK GITHUB" is a
button too), and phones get an on-screen pad. Deep links: `#map`, `#fleets`, `#heroes`, `#briefing`, `#planet-2332`.

## How the data flows

```
GitHub ──pnpm game:project (game workflow, every 15 min)──▶ Supabase: ledger_events, sectors, teams, players
                                                                 │  row-level security: the crew reads,
                                                                 │  a player writes only their own row
                                                                 ▼
             apps/galaxy (Next.js, per request, as the signed-in player) ── buildGalaxy() ──▶ arcade (client)
                                                                 ▲
                              no Supabase configured ──▶ demo world → game/projector.mjs → events
```

`@omni/galaxy` (`packages/galaxy`) folds ledger events into the view. It never invents a number:
points and rankings come from `game/economy.mjs`, decay and threat weights from
`game/rulebook.mjs`, working hours from `game/calendar.mjs`. The demo galaxy is a fictional GitHub
snapshot run through the real projector, so demo events are exactly what `pnpm game:project` would
append.

Signed out, the page reads only the fleets (public) and plays the attract mode. Signed in with a
`@vertuoza.com` account, it reads the galaxy, the crew and the player's own row with the player's
session, so the database's policies decide what they see. `proxy.ts` refreshes the session before
each render; `app/auth/callback` turns Google's and GitHub's codes into that session and, after a
GitHub link, calls `link_github()`.

Nobody gets past INSERT COIN without signing in: the title asks for a coin until there is a
session, and every screen beyond it requires one (`allowed()` in `src/arcade/onboarding.ts`).

Without the Supabase variables, the app picks its mode in `src/data/mode.ts`:

- **Development** (`pnpm galaxy:dev`), or a build with `OMNI_LOOP_DEMO=1`: the demo galaxy, with
  sign-in and GitHub simulated and the player kept in the browser's storage
  (`src/arcade/account-demo.ts`). The single-file artifact plays the same way.
- **Any other build** (a Vercel deployment missing its variables, say): **closed**. The attract mode
  plays, and INSERT COIN says sign-in is not open yet. No simulated sign-in, and no galaxy data.

## Run it locally

From the repository root:

```bash
pnpm install
pnpm galaxy:dev          # http://localhost:3000, demo galaxy (no Supabase needed)
```

### With a local Supabase

Needs Docker and the Supabase CLI (`npx supabase`).

```bash
npx supabase start       # applies supabase/migrations and loads supabase/seed.sql (the demo galaxy)
npx supabase status      # prints the API URL, the anon key and the service_role key
cp apps/galaxy/.env.example apps/galaxy/.env.local   # paste the URL and both keys
pnpm galaxy:dev          # now reads from Supabase: the menu shows "SUPABASE LEDGER"
```

Signing in locally needs the Google and GitHub OAuth clients: export
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`,
`SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`, set `enabled =
true` on both providers in `supabase/config.toml`, and restart the stack. Both clients must accept
`http://127.0.0.1:54321/auth/v1/callback`. Without them, work on the demo galaxy instead.

`pnpm galaxy:seed` regenerates `supabase/seed.sql` from the demo world, dated now.

### Screenshots of every scene

`pnpm galaxy:shots` walks the demo galaxy from the keyboard in a headless Chromium, from the boot
through the joining flow to every screen of the menu, and saves a screenshot of each scene (the
title's three phases and the planet's four tabs each on their own) at three sizes: 393×700 upright
touch (an iPhone with Safari's bars), 852×393 sideways touch and 1440×900 with a mouse.

```bash
pnpm --filter @omni/galaxy-app exec playwright install chromium   # once: Playwright's Chromium
pnpm galaxy:dev          # in one terminal
pnpm galaxy:shots        # in another: apps/galaxy/shots/<width>x<height>/, which git ignores
```

- It prints every text element in the screen that renders below 8 CSS px at 393×700, with its
  scene. The list is a report, not a failure.
- Each screenshot is taken at the same moment of its scene on every run (the page's clock is
  Playwright's), so two runs can be compared screen by screen. Only the demo galaxy's own dates
  move, since it is dated now.
- The demo guest always has a `@vertuoza.com` account. To reach the "wrong cartridge" screen, the
  script makes it an account from another domain, in the browser only.
- Without `pnpm galaxy:dev` running, it stops and says so. `pnpm test` never starts it.

## Deploy to production

Supabase holds the game's data and is its source of truth; GitHub Actions migrates it and appends
to the ledger, and Vercel serves the arcade from it:

```
supabase workflow ── supabase db push, on merge to main ──┐
                                                          ├──▶ Supabase, Central EU (Frankfurt)
game workflow ────── pnpm game:project, every 15 minutes ──┘         │  the player's own session
                                                                     ▼
                                                      Vercel, fra1: apps/galaxy
```

### 1. Create the Supabase project

In the Vertuoza Supabase organisation, create a project in **Central EU (Frankfurt)**, next to the
Vercel region pinned in `vercel.json` (`fra1`). Keep the database password. Then note:

- the **project ref**: the `<ref>` in `https://<ref>.supabase.co`;
- the **publishable key** (or the legacy `anon` key): public by design, the web UI uses it;
- the **secret key** (or the legacy `service_role` key): it writes, so only GitHub Actions gets it;
- a **personal access token** (Account › Access Tokens), for the migrations workflow.

### 2. Give GitHub the project

Repository settings › Secrets and variables › Actions:

| Name | Kind | Value | Used by |
|---|---|---|---|
| `SUPABASE_PROJECT_ID` | variable | the project ref | both workflows; unset, the migrations skip their deploy |
| `SUPABASE_ACCESS_TOKEN` | secret | the personal access token | `supabase.yml` › deploy |
| `SUPABASE_DB_PASSWORD` | secret | the database password | `supabase.yml` › deploy |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | the secret key | `game.yml` › ledger and rankings |

### 3. Apply the migrations

Actions › **supabase** › Run workflow, on `main`. From then on, every merge to `main` that touches
`supabase/migrations/` applies them. A pull request that touches `supabase/` first proves they apply
to an empty database and runs `supabase/checks/access.sql` (who may read and write what). `db push`
never loads the demo seed.

### 4. Set up sign-in

1. **Google (GCP QA project)** › APIs & Services:
   - OAuth consent screen: **Internal** if the project belongs to the vertuoza.com Google Workspace
     organisation (then only its accounts can consent); app name `OMNI LOOP`.
   - Credentials › OAuth client ID › *Web application*, with the authorised redirect URI
     `https://<ref>.supabase.co/auth/v1/callback`.
2. **GitHub** › the vertuoza organisation › Settings › Developer settings › OAuth Apps › New:
   homepage the arcade's URL, callback `https://<ref>.supabase.co/auth/v1/callback`. Linking it is
   what makes a visitor a player, so the arcade needs it before anyone can play. (The installed
   GitHub App can serve instead: its Client ID, a client secret generated on its page, which is not
   the webhook secret, the same callback URL, and the *Email addresses: read* account permission.)
3. **Supabase** › Authentication:
   - Sign In / Providers: enable **Google** and **GitHub** with their client IDs and secrets.
   - Allow **manual linking** (players link GitHub to their Google sign-in).
   - URL Configuration: Site URL = the production arcade; Redirect URLs = `https://<production
     host>/**`, `https://*-<vercel-team>.vercel.app/**` (previews) and `http://localhost:3000/**`.
   - Hooks: **Before User Created** → Postgres function `public.hook_before_user_created` (it
     refuses any address outside `@vertuoza.com`; the database policies refuse them too).

### 5. Create the Vercel project

1. Add New › Project, import `vertuoza/vertuo-omni-loop`, and set **Root Directory** to
   `apps/galaxy`. Vercel detects the pnpm workspace and installs from the root. Keep "Include files
   outside the Root Directory" on (the app imports `game/` and `packages/`). Framework and region
   come from `vercel.json`.
2. Environment variables, for Production and Preview: `NEXT_PUBLIC_SUPABASE_URL` =
   `https://<ref>.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable key. Do not add
   the secret key. `NEXT_PUBLIC_*` values are inlined at build time: redeploy after changing them.
   Without them the deployment stays closed (nobody can enter); it never falls back to the demo.
3. Deploy. The page renders per request with the visitor's session. If Supabase cannot be read, the
   cabinet still plays its attract mode and says the galaxy is out of reach.

### 6. Fill the galaxy

Invite the crew to join (sign in, link GitHub, pick a fleet), put the real sectors in a migration,
then switch the game workflow on ([`game/README.md` › Setup](../../game/README.md#setup)): the first
poll backfills history with everyone's fleet as it stands.

### In production

- The ledger moves at most every 15 minutes (the game workflow's poll); every page load reads it.
- On Supabase's Free plan an idle project is paused after a week. Once the game runs, the 15-minute
  poll keeps it in use. The ledger now lives only in the database: the weekly backup artifact (or
  the Pro plan's point-in-time recovery) is what restores it.

## Share it without a server

```bash
pnpm galaxy:artifact     # apps/galaxy/artifact/dist/omni-loop.html
```

One self-contained HTML page (React from cdnjs, everything else inlined) that plays the demo galaxy,
joining flow included.

## Database

`supabase/migrations/`:

- `ledger_events` mirrors the event contract (`game/events.mjs`) one to one, with the same type
  check. A trigger refuses `UPDATE` and `DELETE`: the ledger is append-only.
- `sectors` hold the repositories; `teams` are the fleets and their look (label, colour, motto,
  mascot, order, `retired_at`). Both change by migration. A fleet is retired, never deleted.
- `players`: one per player, keyed by their auth user: arcade name, fleet (`team_since` stamped by
  a trigger, retired fleets refused), hero (preset numbers, checked by `valid_hero()`), and the
  GitHub login. A row may only be created once GitHub is linked (`my_github()` reads the caller's
  linked identity); the trigger copies the login from that identity, and `link_github()` refreshes
  it. The email stays in `auth.users`.
- Row-level security: `is_crew()` (a `@vertuoza.com` token) reads the galaxy and the players, so
  a visitor sees everything; a player with GitHub linked inserts their own row, and updates only
  its name, fleet and hero (column grants);
  anon reads only the fleets; the service role appends to the ledger and reads the roster.
- Explicit grants: Supabase projects created since 2026-05-30 no longer grant the API roles access
  to new tables. The local stack matches (`auto_expose_new_tables = false`), so a table added
  without its grants fails locally and in the pull request check, not in production.

## Known limits

- **Sealed zones are invisible.** The ledger records a zone from the moment it opens, so a planet
  shows the zones that have opened so far, not the whole plan.
- **The map fits one screen.** About eight planets per sector stay legible; beyond that the planets
  shrink. A scrolling map comes when the galaxy needs it.
- **Tiny type on phones held upright.** The screen is 16:9; turning the phone gives it the room.
- **A renamed GitHub account** keeps its old login in `players.github_login` (the spec lists refreshing it
  from `github_id` as later work).
