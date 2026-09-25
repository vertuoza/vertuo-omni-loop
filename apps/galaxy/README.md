# OMNI LOOP — the galaxy arcade

The web UI of the game layer: a retro arcade cabinet that shows the galaxy. Every PRD is a planet,
every slice a zone, every open question or bug an Entropy unit on its surface. View only for now;
login comes later.

- 640×360 game pixels drawn on a canvas and scaled up by whole numbers with hard pixel edges (late
  GBA detail). Text sits on top in DOM on the same grid, so it stays crisp and readable by screen
  readers.
- Sprites (`packages/sprites`) are laid out as material shapes and finished by a forge
  (`forge.mjs`): a 4-tone ramp per material lit from the top left, and coloured outlines (the
  material's darkest tone on the lit side, near-black on the shadow side). Heroes are 32×32
  (OmniMan 32×48) with two idle frames: OmniMan in the navy-and-white suit, the five fleets
  (beaver, octopod, picsou, cia, invincible-team), Entropy (24×24) recoloured per wound kind, 16×16 icons.
- Planets are procedural: a dithered, lit, rotating sphere per PRD with oceans, shallows, forests,
  ice caps, drifting clouds, a five-band terminator and an atmosphere glow. The surface greens in
  patches as zones are secured; Entropy veins glow on barren ground. Lost planets turn to ash and
  embers, locked ones to stone, cross-sector ones get a ring.

## Screens

| Screen | What it shows |
|---|---|
| Boot → Title | "VERTUOZA presents", then an attract loop: logo, the story, the top five heroes |
| Select mode | Galaxy map, Fleets, Hall of Heroes, How to play |
| Galaxy map | Sectors from `projects.yml` as nebulae; planets by state, threat and wounds; red hyperlanes from a locked planet to its blockers; distress pulses |
| Planet | The planet with its Entropy in orbit and the fleets on station; tabs for status, zones by phase, Entropy (age, decay, bounty) and the event log |
| Fleets | A hero-select wall of the five fleets with season points, streak, planets, crew |
| Hall of Heroes | Season high-score table from `game/economy.mjs` |
| How to play | The scoring rules, read from `game/rulebook.mjs` so they never drift |

Controls: arrows or WASD move, **Enter** is START, **Z**/**Space** is A, **X**/**Esc** is B, **Tab**
cycles, **M** mutes. Clicks and taps work everywhere, and phones get an on-screen pad. Deep links:
`#map`, `#fleets`, `#heroes`, `#briefing`, `#planet-2332`.

## How the data flows

```
game/ledger/*.jsonl ──pnpm galaxy:sync──▶ Supabase: ledger_events, sectors, teams
                                                │  anon key, read only (RLS)
                                                ▼
                         apps/galaxy (Next.js, server) ── buildGalaxy() ──▶ arcade (client)
                                                ▲
                  no Supabase configured ──▶ demo world → game/projector.mjs → events
```

`@omni/galaxy` (`packages/galaxy`) folds ledger events into the view. It never invents a number:
points and rankings come from `game/economy.mjs`, decay and threat weights from
`game/rulebook.mjs`, working hours from `game/calendar.mjs`. The demo galaxy is a fictional GitHub
snapshot run through the real projector, so demo events are exactly what `pnpm game:project` would
append.

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

Load the real ledger instead of the demo: fill `projects.yml`, run `pnpm game:project`, then
`pnpm galaxy:sync`. The sync is idempotent (deterministic ids, `ON CONFLICT DO NOTHING`).
`pnpm galaxy:seed` regenerates `supabase/seed.sql` from the demo world, dated now.

## Deploy on Vercel

1. Import the repository in Vercel and set **Root Directory** to `apps/galaxy`. Vercel detects the
   pnpm workspace and installs from the root.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production and Preview).
   Without them the deployment shows the demo galaxy.
3. Apply the migrations to the hosted project: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`.
4. Keep the service role key out of Vercel. Only `pnpm galaxy:sync` needs it; run it wherever the
   ledger is written (for example as a step after `pnpm game:project` in `.github/workflows/game.yml`,
   with the key as a repository secret).

The page revalidates every 60 seconds; the ledger moves at most every 15 minutes.

## Share it without a server

```bash
pnpm galaxy:artifact     # apps/galaxy/artifact/dist/omni-loop.html
```

One self-contained HTML page (React from cdnjs, everything else inlined) that plays the demo galaxy.

## Database

`supabase/migrations/20260925080000_galaxy_ledger.sql`:

- `ledger_events` mirrors the event contract (`game/events.mjs`) one to one, with the same type
  check. A trigger refuses `UPDATE` and `DELETE`: like the ledger, it is append-only.
- `sectors` and `teams` mirror `projects.yml` and are replaced on every sync.
- Row-level security: `anon` and `authenticated` may `select`; nobody but the service role writes.
  When login arrives, narrow the `select` policies to `authenticated`.

## Known limits

- **Sealed zones are invisible.** The ledger records a zone from the moment it opens, so a planet
  shows the zones that have opened so far, not the whole plan.
- **The map fits one screen.** About eight planets per sector stay legible; beyond that the planets
  shrink. A scrolling map comes when the galaxy needs it.
- **Tiny type on phones held upright.** The screen is 16:9; turning the phone gives it the room.
