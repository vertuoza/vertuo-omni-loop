# OMNI LOOP — the galaxy arcade

The web UI of the game layer: a retro arcade that shows the galaxy. Every PRD is a planet,
every slice a zone, every open question or bug an Entropy unit on its surface. Signing in with
GitHub makes you a member of the workspace of every GitHub org of yours that has Omni Loop installed
(the `vertuoza` workspace, for the vertuoza org), and a **player** at once: you pick a
fleet, enter a name and build a hero, and your pull requests score for that fleet. Every point also
counts as XP, which never resets (it restarted at 0 once, at PRD 728's fresh start, keeping every
game already unlocked: [`game/README.md` › The fresh start](../../game/README.md#the-fresh-start)),
and levels open arcade games in the game room: Entropy Invaders from LV 1, then SUPER OMNI WORLD
from LV 2 ([The game room](#the-game-room)). All from the keyboard on a computer, and from a
Game Boy's buttons on a phone (design:
[`docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md`](../../docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md)).

- Game pixels drawn on a canvas, on one of two grids (wide 640×360 or tall 320×288, see
  [Three forms, two grids](#three-forms-two-grids)), and scaled to fit with hard pixel edges (late
  GBA detail). Text sits on top in DOM on the same grid, so it stays crisp and readable by screen
  readers.
- The look comes from one package, `@omni/design` (`packages/design`, see
  [its README](../../packages/design/README.md)): the colours as `tokens.css`, the fonts as
  `fonts.css` served from this origin (no Google Fonts), the Omni Loop crest, and the sprites.
  `src/design-system.test.ts` fails when a copy creeps back: a stylesheet here declaring its own
  colour on `:root`, a page linking Google Fonts, or a file importing the old `@omni/sprites`.
- Sprites (`@omni/design`) are laid out as material shapes and finished by a forge
  (`forge.mjs`): a 4-tone ramp per material lit from the top left, and coloured outlines (the
  material's darkest tone on the lit side, near-black on the shadow side). Heroes are 32×32
  (OmniMan 32×48) with two idle frames, and OmniMan also points, cheers and runs: OmniMan in the navy-and-white suit, the fleet mascots
  (the library `MASCOTS`: a beaver, an octopus, a duck, a spy, a pirate and a caped hero), Entropy
  (24×24) recoloured per wound kind, 16×16 icons. A fleet's flavour (its sprite, its motif, its
  HOME card's rule) is keyed by its mascot, never by its name: a workspace names its own fleets.
- Every player's hero is the OmniMan body (a girl or a boy, 32×48) recoloured: skin, hair, suit and
  cape are ramp swaps on one material each (`packages/design/src/heroes.ts`). A fleet without a
  drawn mascot flies as a hero in its own colour.
- Planets are procedural: a dithered, lit, rotating sphere per PRD with oceans, shallows, forests,
  ice caps, drifting clouds, a five-band terminator and an atmosphere glow. The surface greens in
  patches as zones are secured; Entropy veins glow on barren ground. Lost planets turn to ash and
  embers, locked ones to stone, cross-sector ones get a ring.
- The music and sounds are generated in the browser, SNES style: two pulse leads, a triangle bass,
  noise drums and one echo (`src/arcade/sound.ts`), playing songs written as note strings
  (`src/arcade/score.ts`). No audio files.

## HOME at `/`, the arcade at `/play`

`/` is **HOME**, Omni Loop's front door, drawn as a retro print ad (PRD 261) that says what the loop
is worth (PRD 285). It is a static page: it reads no session and no database, and looks the same to
every visitor. Its parts live in `src/home/` (`app/page.tsx` renders them), top to bottom:

1. **The poster** (`src/home/poster/`): the kicker THE DELIVERY FRAMEWORK FOR CODING AGENTS, the
   page's one headline **AGENTS SHIP. YOU STEER.**, the pitch, the promise strip (ONE FOLDER IN, ONE
   FOLDER OUT · EVERY DECISION WRITTEN DOWN · A PERSON ALWAYS MERGES), OmniMan, the disabled sign-up,
   the invaded planet, the crest and PRESS START.
2. **What's in it for you?**: three cards, HEAD OF ENGINEERING, DEVELOPER and PRODUCT MANAGER, each a
   promise and three proofs, all visible.
3. **Strategy guide: the loop, level by level**: seven levels, SET UP to SHIP and the KNOWLEDGE bonus,
   with OmniMan running the path and the LOOP LINGO sidebar.
4. **You see everything**: six bullets; the release notes one links to `/releases`.
5. **Easy in, easy out**: the four GET IN steps, and GET OUT: delete `.omni-loop/` and commit.
6. **High scores: the loop built this**: FEATURES SHIPPED, SLICES MERGED and DECISIONS ADOPTED,
   counted from `.omni-loop/delivery/shipped/` when the page is built (`src/home/scores.ts`).
7. **The game: Entropy you can see**: why the game exists, and the demo world's invented fleets as
   trading cards.
8. **Join the loop!**: the order form, with PRESS START and the Konami tip.

Each spread is its own component under `src/home/spreads/`, composed by `Spreads.tsx`. HOME links
nowhere but `/play` and `/releases`.

**LOOP LINGO** (`src/home/lingo.ts`) keeps HOME in plain words. It glosses the five loop terms HOME
uses (HARNESS, PRD, SLICE, WAVE, OUTBOX) and names the loop words it never says (phase-0, worktree,
sub-PR, dossier, territory, yolo). Its guard, `lingo.test.ts`, renders HOME and reads the text a
visitor reads, leaving out `<code>`, `<kbd>`, the fleet cards and the sidebar itself: every term it
finds must be glossed, every gloss used, and no banned word said. A new sentence that trips it is
reworded, or its term added to the sidebar.

Shared, a link to `/` previews as the ad: the title `OMNI LOOP · AGENTS SHIP. YOU STEER.`, its
description, and an Open Graph image of the crest and AGENTS SHIP. YOU STEER. on the starfield
(`app/opengraph-image.tsx`, drawn from `src/home/share.tsx`).

The arcade is at **`/play`** (`app/play/page.tsx`), in the same modes as before. Signing in with
GitHub and signing out come back to `/play`; a visitor whose orgs have no workspace yet signs up at
`/signup` ([Sign-in and sign-up](#sign-in-and-sign-up)).

The arcade's deep links are forwarded: HOME sends `/#map`, `/#chart`, `/#fleets`, `/#heroes`,
`/#games`, `/#briefing`, `/#menu` and `/#planet-<n>` on to `/play` with the same hash before it
paints (`src/home/forward.ts`), so an old bookmark still opens its screen. Any other hash stays on
HOME.

## Screens

| Screen | What it shows |
|---|---|
| Boot → Title | "OMNI LOOP presents" and the Omni Loop crest, then an attract loop: the crest, the story, the top five heroes (signed in). A member sees their workspace's name, letter and colours (a Vertuoza member, "VERTUOZA presents" and the V); signed out, in demo mode, closed and in the artifact, the house brand, Omni Loop |
| Insert coin | Sign in with GitHub; a signed-in account that belongs to no workspace gets the "wrong cartridge" screen, which points at `/signup` |
| Press start | After coming back from GitHub: browsers play sound only after a key press |
| Intro | First visit only, 20 s, skippable: OmniMan rises, three lines type in, the fleets flash in |
| Select your fleet | The fleets from `public.teams`, each with its own motif; A locks in with a fanfare. Also CHANGE FLEET, with a confirmation of where the points go |
| Enter your name | Up to 10 characters, typed or spun on a letter wheel, pre-filled from the account's first name |
| Build your hero | Girl or boy, skin, hair, suit (the fleet colour first) and cape; TAB for random |
| Ready / Welcome back | The launch after a first visit; a two-second welcome for returning players |
| Level up | Before the menu, once per new level on this device: LEVEL UP! with a fanfare, the hero at 2× and the new XP bar, and NEW GAME UNLOCKED when a level climbed opened a game (A plays it at once, B goes on to the menu) |
| Select mode | PLAY (visitors: links GitHub), Galaxy map, Star chart, Fleets, Hall of Heroes, Games, How to play, then My hero and Change fleet (players), APP MODE (leaves the game for the app, after OPEN THE APP?), Sign out. A player's badge shows their level |
| Galaxy map | Sectors as nebulae; planets by state, threat and wounds; red hyperlanes from a locked planet to its blockers; distress pulses |
| Planet | The planet with its Entropy in orbit and the fleets on station; tabs for status, zones by phase, Entropy (age, decay, bounty), the event log and its PRD's dossier (the latest version of each artifact, the questions asked and answered, the last three answers; START opens its page, [PRD dossiers](#prd-dossiers)) |
| Star chart | The knowledge base as space: a sun per domain, sized by the entries it holds, and a dotted lane for each cross-domain file ([The knowledge map](#the-knowledge-map)) |
| System | One domain as an orrery: its entries as worlds on still orbits, laws terraformed and proposed entries barren; the selected world's links, its panel, and the reading card |
| Fleets | A hero-select wall of the fleets with season points, streak, planets, crew (players by name) |
| Hall of Heroes | Season high-score table from `game/economy.ts`, with each player's hero and name |
| Games | The game room: the player's level and XP bar, a cabinet per game (lit with the crew's top five, or dark with the level it opens at) and a SOON cabinet ([The game room](#the-game-room)) |
| Entropy Invaders | The first game: the player's own hero against a marching formation of alien Entropy, three lives, the score sent to the crew's table at game over |
| SUPER OMNI WORLD | The second game, from LV 2: a side-scrolling platformer over three stages, the score sent at game over or WORLD CLEAR |
| How to play | The scoring rules and LEVELS (what XP counts, the curve, the unlocks), read from `game/rulebook.ts` so they never drift |

Deep links: `#map`, `#chart`, `#fleets`, `#heroes`, `#games`, `#briefing`, `#menu`, `#planet-2332`
(`src/arcade/deep-link.ts`). Each opens its screen past the boot and the title, and the address
follows the screen, so the menu reads `/play#menu`: the game's home, where the app's Game mode lands
(its `/#menu` forwarded from HOME).
Signed out, they land on INSERT COIN; a planet's link, which needs the galaxy, starts at the boot
where the page holds none.

**OPEN THE APP?** APP MODE and the Game Boy's GAME ▮▯ APP switch open one confirm over whatever scene
is showing: OPEN THE APP?, *QUESTIONS AND KNOWLEDGE, AS PAGES*, [A] YES and [B] NO. It is an overlay,
not a scene, laid out on both grids (`src/arcade/leave.ts` decides, `leave.tsx` draws). A or START
opens `/app` in the same tab; B closes it on the scene exactly as it was, its selection, page and tab
included; nothing else is read while it is up. Entropy Invaders pauses first, so B comes back to the
pause, and the screens that move on by themselves wait under it. On the name screen it takes the
keys: A, Z, Space, K and Enter say yes, B, X, Esc, J and Backspace say no. The single-file artifact
has no app: neither the row nor the switch shows.

Outside the arcade, the app (PRD 238): `/app`, its home, beside `/ask`, `/ask/for-me`, `/ask/history`,
`/knowledge` and `/releases`, all on the ask pages' reading surface, in three themes: **Omni**, the
default, HOME's palette (the void, the cabinet's navy, comic yellow), then **Light** and **Dark**
(PRD 284). The theme switch reads `Omni · Light · Dark`; only colours change between them, and a
choice of Light or Dark is remembered in the browser, Omni being the absence of one. `/app` is **your
dashboard** (PRD 328), beside the Fleet and Workspace boards (PRD 572, [Your dashboard: Home, Fleet
and Workspace](#your-dashboard-home-fleet-and-workspace)): your hero, fleet, season points and
places, Waiting for you, then your numbers and your team's. The sidebar groups the pages as
**Dashboard** (Home, Fleet, Workspace, Engineering), **Work** (PRDs, Questions, Knowledge), **Settings** (Fleets, Repositories)
and **Omni** (`src/nav/sidebar.ts`). It asks you to sign in, and each page
it links to signs the visitor in on its own, except `/releases`, which is public
([Release notes](#release-notes)). Every app page's header
links its `OMNI LOOP` mark to `/app` and ends with **Game mode**, which asks *Switch to game mode?*:
Switch opens `/#menu` in the same tab, and Stay, Esc or a click outside leaves the page as it was.

`/design` shows the design system, straight from `@omni/design`: every logo form, colour, type step,
sprite, pose and icon. It opens without signing in, and is not one of the app's pages. `/prd` lists
the workspace's PRD dossiers and `/prd/<id>` is one PRD's page to share, both for the workspace's
members ([PRD dossiers](#prd-dossiers)).

## Three forms, two grids

The arcade takes one of three forms, picked from the device by `formFor()` in `src/arcade/form.ts`.
The pointer picks the form, not the screen size: a fine primary pointer means a keyboard player.
A form only picks the body around the screen, the grid inside it and the keys the hints name; the
game is the same in all three.

| Form | When | Body | Grid |
|---|---|---|---|
| `full` | The primary pointer is fine: a mouse or a trackpad, a touchscreen laptop included | None: the screen alone, filling the window at the largest 16:9 size, fractions allowed, centred between `--void` bars | wide |
| `handheld` | Touch, with the viewport at least as tall as it is wide: a phone or a tablet held upright | A Game Boy, edge to edge: the navy lens (its `OMNI LOOP · GALAXY COLOR` stripe and power LED), the wordmark with the season and the GAME ▮▯ APP switch at its right end, the D-pad, B and A, SELECT and START, and the speaker grille | tall |
| `advance` | Touch, with the viewport wider than it is tall: a phone or a tablet held sideways | A Game Boy Advance style wide body: the D-pad with SELECT and START on the left wing, A and B with the grille on the right and the GAME ▮▯ APP switch under it, the lens between them. No L or R: the game has no L or R action | wide |

- **The two grids.** The wide grid is 640×360. The tall grid is 320×288: a Game Boy screen (160×144)
  at 2×, which puts the arcade's type at its designed size on a phone held upright. Each layout is
  authored for exactly 640×360 or 320×288, with no fluid layout inside the screen, so type and
  sprites stay on a pixel grid.
- **Which grid a scene gets.** `gridFor()` in `src/arcade/grid.ts`: tall on `handheld` for a scene
  its group lists in `TALL_SCENES` (`src/arcade/scenes/<group>.ts`), wide otherwise. A wide scene
  on the Game Boy is letterboxed inside its tall lens. All 24 scenes are listed, and `grid.test.ts`
  fails when a scene is not, so a new scene needs a wide and a tall layout.
- **A tall layout drops nothing.** It shows what the wide one shows, stacked or split into pages:
  the Hall of Heroes (four to a page), How to play (one section a page) and the game room (one
  cabinet a page) show "PAGE n/N", and ◀ ▶ turn them, round from the last to the first. On the
  fleet select screen and the fleets wall, the cards shown follow the cursor. Its smallest type is
  8 grid px in Press Start 2P and 15 in Jersey 10.
- **The bodies.** On a Game Boy the controls keep their size and the lens takes the height that is
  left, so a short phone gets a smaller screen, never a control off the edge. The notch and the
  home indicator are kept clear. The page holds still: no scroll, no zoom, no pull-to-refresh, no
  text selection and no long-press menu.
- **The planet's tabs** are five on both grids, `STATUS · ZONES · ENTROPY · LOG · DOSSIER`: the tall
  grid shows each tab's rows as the wide one does, in its smaller type.
- **Turning the phone** swaps the body and keeps the scene, the selection, the planet tab and the
  name being entered. The server cannot know the device, so the page arrives as `full` and a phone
  takes its body as the page starts. A game of Entropy Invaders keeps the field it started on,
  letterboxed, until it ends; the next game takes the grid of the moment.

### Controls

**The keyboard**, in every form (a Bluetooth keyboard drives the Game Boy too): the arrows move,
**Enter** is START, **A** (or Z, Space) is A, **B** (or X, Esc) is B, **Tab** is SELECT (random on
the hero builder), **M** mutes: the keys the screens show are the keys to press. On the name screen
letters type instead: Backspace erases, Enter confirms, Escape goes back. No step needs a mouse;
clicks and taps still work (a key hint such as "[A] LINK GITHUB" is a button too).

**Fullscreen** (`src/arcade/fullscreen.ts`). On a phone (`handheld` and `advance`), the first key
press, click or touch press of a page load asks the browser for fullscreen, so the Game Boy runs
like a console game with no tabs or address bar. On desktop (`full`), no press asks on its own: a
click or a key leaves the browser window as it is, and the player opts in with **F** or the ⛶
button.

- **The ⛶ button** (`src/arcade/FullscreenButton.tsx`), on desktop only: a dim button in the page's
  bottom-right corner, outside the screen, named "Full screen (F)", fully lit on hover and on
  keyboard focus. A click sends a `toggle` press; a mouse press takes no focus, so Enter and Space
  keep meaning START and A. It hides while the page is fullscreen and comes back once Esc or F
  leaves it; it is never drawn on the Game Boy bodies, nor where the browser refuses fullscreen.

- **F** toggles fullscreen, in every form, except on the name screen, where F types an F.
- Esc leaves it and the scene stays: the Esc that leaves fullscreen is never also B. While
  fullscreen, B and X are the back keys; outside it, Esc still means B.
- On a phone, once the player has left, the next press does not ask again; a new page load asks
  again on its first press.
- A `toggle` press enters fullscreen when off and leaves it when on; the game never reads it.
- A refused request is ignored: no error, no toast. iPhone Safari has no fullscreen for web pages,
  and the single-file artifact's frame may refuse it.

**The Game Boy's pad**, on `handheld` and `advance` (`src/arcade/Controls.tsx`). Each control sends
the action its key does, through the same `act()`, and is a button a screen reader names (Up, Down,
Left, Right, "A, confirm", "B, back", Select, Start, Sound).

- **Touch-down.** A control fires as the finger lands (`pointerdown`), not on release, darkens while
  pressed, and buzzes for 10 ms where the browser offers `navigator.vibrate` (not iPhone Safari).
- **The D-pad is one rocker** (`dpad.ts`). The direction is where the finger is from the cross's
  centre: under 10 px is a dead zone, then the axis with the larger offset wins, and a tie goes to
  the vertical axis. Sliding to another arm without lifting fires it at once; sliding back to the
  centre stops.
- **Hold to repeat** (`repeat.ts`). A held direction fires once, again after 400 ms, then every
  120 ms until it is released. **A**, **B**, **SELECT** and **START** fire once per press, as with the
  keyboard.
- **Several fingers.** Each finger is its own press: the D-pad and A can be held together.
- **The speaker grille is the sound switch.** A tap toggles the sound, the same setting M toggles,
  saved under `omni-loop:muted`; the LED on the lens is lit while sound is on.
- **The GAME ▮▯ APP switch leaves for the app** (`AppSwitch`), a slide switch in the body's colours,
  a nod to the handheld's power switch: at the right end of the wordmark row upright, under the
  grille at the foot of the right wing sideways. It fires on touch-down and buzzes like the pad, but
  it is no pad action: the game never reads it and no hint names it. On any scene, the boot included,
  it opens OPEN THE APP?, and its knob shows APP while the confirm is up. Upright, a long season label
  is cut with an ellipsis before the switch leaves the body. A screen reader names it "Switch to the
  app".
- **Hints name the pad's buttons.** On `handheld` and `advance` a hint reads START for ENTER, SELECT
  for TAB and B for ⌫ or ESC, and drops "TYPE OR": there is no keyboard to type on. The name
  screen reads "B ERASE" and "START DONE", the hero builder "RANDOM (SELECT)". On `full` hints read
  the keyboard's keys, as they always have (`hintKey()` in `src/arcade/keys.ts`).
- **The screen stays tappable**: key hints (the DOSSIER tab's `[START] OPEN` among them), menu rows, fleet cards, builder rows, planet tabs, the
  game room's cabinets, planets on the map, and the star chart's suns and worlds, whose hit tests
  run in the pixels of the grid the scene is drawn on.

**Held buttons, in a game** (`src/arcade/held.ts`). The menus read a press, once, through `act()`,
and keep doing so. Entropy Invaders also reads what is held, through a second channel beside it:
the set of buttons held, from key down to key up and from a finger's touch-down to its lift or its
cancel, several at once.

- Hold ◀ ▶ to move and A to fire, together: from the keyboard, or on the pad with a finger on the
  D-pad and one on A (`handheld` and `advance`).
- During a game the D-pad stops repeating and the keyboard's own key repeat is ignored, so a held
  direction reads as held. START pauses, and so does B; from the pause, A or START resumes and B
  goes back to the game room. M still mutes.
- A window that loses focus, or a hidden tab, never hears its keys and fingers go up: the set is
  cleared, and a game pauses.

## How the data flows

```
GitHub ──pnpm game:project (game workflow, every 15 min)──▶ Supabase: ledger_events, sectors, teams, players
       then pnpm game:xp, from the whole ledger ──────────▶           player_xp
       then pnpm game:contributions, the last 40 days ────▶           contributions
                                                                 │  row-level security: a member reads their
                                                                 │  workspace, a player writes only their own row,
                                                                 │  and a score only through submit_score()
                                                                 ▼
             apps/galaxy (Next.js, per request, as the signed-in member, one workspace) ── buildGalaxy() ──▶ arcade (client)
                                                                 ▲
                              no Supabase configured ──▶ demo world → game/projector.ts → events
```

`@omni/galaxy` (`packages/galaxy`) folds ledger events into the view. It never invents a number:
points and rankings come from `game/economy.ts`, decay and threat weights from
`game/rulebook.ts`, working hours from `game/calendar.ts`, XP, levels and unlocks from
`game/experience.ts` (the view's rules carry the rulebook's `xp` block, for How to play). The demo
galaxy is a fictional GitHub snapshot run through the real projector, so demo events are exactly
what `pnpm game:project` would append. Its fleets are invented too (`demoFleets()`): no workspace's
own, and nobody's but the demo mode's, HOME's and the artifact's.

What the page reads is decided in `src/data/arcade.ts`, always with the visitor's own session, so
the database's policies decide what they see:

- **Signed out**, it reads nothing: the attract mode plays under the house brand with no fleet, its
  title reading NO FLEETS YET — RAISE YOUR OWN! over the mascot parade.
- **Signed in**, it reads the person's memberships and plays **the workspace they joined first**
  (by `joined_at`, then `slug`; PRD 2 brings switching). Every loader in `src/data/load-galaxy.ts`
  (the galaxy, the fleets, the crew, the player's own row) filters by that workspace, and its
  `name` and `theme` reach the arcade as its brand (`src/arcade/brand.ts`): the name gives the
  boot its letter and its words, the theme its colours ([A workspace's look](#a-workspaces-look)).
  Joining a fleet writes the player row with that `workspace_id` and the person's `user_id`
  (`src/data/players.ts`).
- **With GitHub linked**, it also reads their `player_xp` row in that workspace, by lower-cased
  login (`src/data/xp.ts`), and each game's crew table from `arcade_scores`: its top five with the
  players' names and heroes, and their own best (`src/data/scores.ts`). Each is read on its own,
  after the galaxy: when one fails, the galaxy stays, and the arcade says XP OUT OF REACH (and shows
  no level) or SCORES OUT OF REACH (and the game still plays). Without GitHub, it reads neither.
- **The planets' dossiers**, for every member, visitor or player (`src/data/dossiers.ts`): the
  workspace's plan repository from `workspaces`, the ids of its PRDs' dossiers from `dossiers`, then,
  for each planet that has one, `dossier_list(p_dossier)` (its latest version of each kind, its
  question counts) and `dossier_rounds(p_dossier)` (its last three answered rounds), one dossier at a
  time, never the whole list. Read on its own after the galaxy, like XP: when it fails, the galaxy
  stays and the DOSSIER tab says DOSSIERS OUT OF REACH; one planet's dossier out of reach leaves the
  others shown.
- **Crew means "has a workspace"**, never an email domain. Joining happens at sign-in, where
  GitHub's token is at hand ([Sign-in and sign-up](#sign-in-and-sign-up)); a signed-in person who
  belongs to none gets the "wrong cartridge" screen, pointing at `/signup`, and reads nothing.
- **The database out of reach**: the attract mode and "THE GALAXY IS OUT OF REACH", with no fleet:
  never the demo's. Nobody is turned away as an outsider when the page cannot tell.

`proxy.ts` refreshes the session before each render. `app/auth/callback` turns GitHub's code into
that session and settles the sign-in (`src/data/sign-in.ts`); the terminal's sign-in (`omni signin`,
the callback's `next=ask-cli` branch) settles it the same way before its one-time code is issued.

Nobody gets past INSERT COIN without signing in: the title asks for a coin until there is a
session, and every screen beyond it requires one (`allowed()` in `src/arcade/onboarding.ts`). A
game and the level-up also need GitHub linked: XP is earned under the GitHub login.

Without the Supabase variables, the app picks its mode in `src/data/mode.ts`:

- **Development** (`pnpm galaxy:dev`), or a build with `OMNI_LOOP_DEMO=1`: the demo galaxy, with
  sign-in and GitHub simulated and the player kept in the browser's storage
  (`src/arcade/account-demo.ts`). The guest borrows the XP of the demo world's highest-XP
  contributor, computed from the demo events by `experience()` (`demoXp()` in `src/data/xp.ts`), so
  the game room, the level-up and the game all show; their best scores stay in the browser's
  storage, the only line of the demo's crew table. Four of the demo world's planets carry demo
  dossiers (`demoDossiers()` in `src/data/dossiers.ts`), and the rest none, so every state of the
  DOSSIER tab shows. The single-file artifact plays the same way.
- **Any other build** (a Vercel deployment missing its variables, say): **closed**. The attract mode
  plays, and INSERT COIN says sign-in is not open yet. No simulated sign-in, and no galaxy data.

## Sign-in and sign-up

GitHub is the only way in (PRD 359). Every sign-in surface (the arcade, `/ask`, the terminal's code
card, `/knowledge`, the dossiers) starts GitHub's sign-in with the `read:org` scope
(`src/data/sign-in-github.ts`), and the database's sign-up hook refuses any other provider with
"Omni Loop signs in with GitHub only." A GitHub account with no public email signs up all the same.

**At every sign-in** the callback settles it (`settleSignIn()` in `src/data/sign-in.ts`), each step
best effort (ADR 0044: a failure is logged, and the sign-in carries on):

1. **Joining by org.** With the provider token Supabase hands back, galaxy reads the person's login
   and orgs from GitHub once (`src/data/github-orgs.ts`); the token is never stored. The service
   role's `join_workspaces_by_github()` makes them a member of every workspace whose `github_org` is
   one of those logins, in any case, and that has an installation of the App.
2. **Completing sign-up requests.** Each pending request of theirs whose org they still belong to
   and that now has the App installed (read with the App's JWT) becomes a workspace:
   `create_workspace_from_installation()` makes them its owner, or a member of the one the org's
   owner made first. The request is then gone.
3. **Linking GitHub** (`link_github()`): every account is a player at once.

**Signing up** is installing the omni-loop App (`apps/omni-app/app.yml`, public). `/signup` links to
its install page on GitHub (`GITHUB_APP_SLUG`). GitHub then sends the visitor to the App's setup
URL, `/signup/installed`:

```
/signup ── github.com/apps/<slug>/installations/new ── pick an org or your own account, pick repos
   ▼
/signup/installed?installation_id=…&setup_action=install|request
   │  never trusted alone: the visitor signs in with GitHub again (silent, the scopes are granted)
   ▼
/signup/installed/callback ── src/signup/installed.ts, finishSetup():
   ├─ install : the installation, fetched with the App's JWT (src/signup/github-app.ts); its
   │            account must be the visitor's own login (a solo workspace) or one of their orgs;
   │            create_workspace_from_installation() ──▶ /play, as the new workspace's owner
   │            (a member, when the account had a workspace already)
   └─ request : the visitor is not the org's admin, and GitHub names no org: a sign-up request for
                each of their orgs without the App ──▶ /signup?waiting=<orgs>, "Waiting for <org>'s owner"
```

Anything else ends on `/signup?error=<reason>`, and creates nothing: an address GitHub did not send,
an installation GitHub does not know, one on an account the visitor neither is nor belongs to,
GitHub or the database out of reach. A workspace's slug and name are its account's login (the slug
lowercased, numbered when taken); it starts empty, with no sectors and no fleets of its own.

Sign-up's writes, the service role's only, go through `src/signup/store.ts`; the App's id and key
(`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`) and the service role's key are server only, read in
`src/data/sign-in-live.ts`, and no client component imports them (`src/signup/SignupScreen.test.ts`
checks).

## A workspace's look

A workspace's brand (`src/arcade/brand.ts`) is its name and its theme. The name gives the mark its
letter and the boot and the title their words; the theme gives the arcade its colours. Signed out,
in demo mode and in the single-file artifact, the arcade wears the house brand: Omni Loop
(`OMNI_LOOP` in `@omni/design`), theme `{}`. The boot and the title draw its crest in place of a
letter, and the page title, the favicon (`app/icon.ts`, the crest's own 16×16 drawing) and
`themeColor` come from it. A workspace keeps its own mark: a member of Vertuoza sees the V.

**The tokens** are listed once in `src/arcade/theme.ts`. Their defaults are `@omni/design`'s
colours (the mark's gradient and the stripes aside), the arcade as it always looked, so the theme
`{}` changes nothing.

| Tokens | What they colour |
|---|---|
| `void`, `deep`, `cab`, `navy`, `navy-dark`, `white`, `dim`, `plasma`, `plasma-dark`, `yellow`, `gold`, `red`, `cyan`, `green` | the screens, their panels and words, and the canvas |
| `body-mid`, `body-ink`, `body-ink-soft`, `body-lens-1`, `body-lens-2`, `body-lens-text`, `body-led-off`, `body-pad-1`, `body-pad-2`, `body-pad-arrow`, `body-pad-down-1`, `body-pad-down-2`, `body-a-shine`, `body-b-shine`, `body-pill-1`, `body-pill-2`, `body-grille` | the Game Boy's body (`shell.css`): its shell runs from `plasma` through `body-mid` to `plasma-dark`, A is `red` with `body-a-shine`, B is `plasma` with `body-b-shine` |
| `mark-1`, `mark-2`, `mark-3`, `mark-shade-1`, `mark-shade-2`, `mark-shade-3` | the mark's gradient, left to right, and its shade |
| `stripe-1` to `stripe-4` | the four stripes on every hero's suit (the sprite forge's flat colours `1` to `4`) |

**Storing a theme.** `workspaces.theme` holds only the tokens a workspace overrides, each a
lowercase `#rrggbb` colour:

```sql
update public.workspaces set theme = '{"plasma": "#2fc6a4", "plasma-dark": "#178a80", "body-mid": "#22a890"}'
 where slug = 'acme';
```

`valid_theme()` refuses an unknown token, any other colour, and anything but an object. The arcade
reads the theme leniently (`parseTheme()`, a zod schema): an unknown token, or a colour that is not
lowercase `#rrggbb`, is dropped with a console warning and its default applies, so a colour never
breaks the arcade.

**Applying it.** The resolved theme is written as CSS custom properties on the arcade's root element
(`.shell`), over the defaults `@omni/design/tokens.css` declares on `:root` (`arcade.css` imports
it and declares no colour of its own). The canvas scenes draw with the
same values (`FrameState.theme`), the mark with `mark-*`, and every sprite, on the canvas and in the
panels, wears `stripe-*`. Fonts are not tokens.

**Adding a token** takes three places: its colour in `@omni/design` (then
`pnpm --filter @omni/design tokens` regenerates `tokens.css`; unless only the canvas draws it), its
name in `theme.ts`, and `valid_theme()`'s list, in a new migration. `src/arcade/theme.test.ts` fails until the three agree, and while `shell.css` or a canvas
scene writes a token's colour as a literal.

## Your dashboard: Home, Fleet and Workspace

The sidebar's **Dashboard** group (PRD 572) holds three boards, each a page rendered per request as
the signed-in person, the way `/prd` does, so row-level security and the two dashboard functions
decide what each read returns:

| Page | Its scope | Its People table |
|---|---|---|
| **Home**, `/app` (`app/app/page.tsx`, `Dashboard.tsx`) | *you*: your login's merges and PRD events, your own questions | **Your team**: every member of your fleet, 0s kept, you marked. A solo player or a member with no player row sees their own row, and *No fleet of your own. See a fleet's board on Fleet* (`home/team.ts`) |
| **Fleet**, `/app/fleet` (`fleet/`) | *a fleet*: the logins of the roster's members in that fleet | that fleet's members |
| **Workspace**, `/app/workspace` (`board/workspace.ts`, `board/WorkspaceScreen.tsx`) | *the workspace*: every row, a non-member's merges included (they count in the tiles, the charts and the repositories, and get no row) | every member |

`/app` is the app's home (PRD 238): both sides land on it, the arcade's APP MODE row and GAME ▮▯ APP
switch, and every app page's `OMNI LOOP` mark. Above its board it keeps **you** (`YouBlock.tsx`,
`you.ts`): your hero, drawn on the server as a pixel SVG in your fleet's colour, your name (the page's
one `h1`), your fleet, your season's points and your two places, *You #7 of 23 · BEAVER #2 of 5*; then
**Waiting for you** (`counts/`), right now, linking to `/ask/for-me` when every question waiting was
shared with you, and to `/ask` otherwise. The individuals and fleets rankings, the Outbox settled tile,
the week of merges and the season's counts left Home with PRD 572: the People tables list everyone,
and the fleet ranking is on Workspace.

`/app/fleet` shows your fleet by default and any fleet by `?fleet=<name>`, under a picker of every
fleet of the workspace whose links keep the period (`fleet/pick.ts`). The fleet's place in the
season's fleet ranking shows beside its name. With no fleet of your own and no `?fleet`, or a
`?fleet` that names no fleet, the page shows the picker and *Pick a fleet to see its board*; a
workspace with no fleet says *This workspace has no fleet yet*, linking to Settings › Fleets
(`/app/settings/fleets`). `/app/workspace` adds, below its board, the season's fleet ranking: every
fleet the season knows, by points.

**A board** (`board/Board.tsx`), top to bottom, the same on the three pages:

1. **The period switch**: **7 days** (the default), **30 days**, **Season**, a link each, kept in the
   URL as `?period=7d|30d|season` with the rest of the query; an unknown value reads as 7 days
   (`board/period.ts`, `board/links.ts`). Every period is a run of Brussels days ending today, today
   last; the season is the UTC calendar month the game scores (`seasonBounds()` in `season.ts`), its
   days up to today.
2. **Four tiles**, one row: **PRs merged**; **PRDs**, three numbers in one tile, *drafted · in
   progress · shipped*; **Repositories**, those with at least one merged PR or PRD event in the scope
   and the period; **Questions answered**. A 0 shows as 0, and no tile is ever hidden.
3. **Two per-day charts**: **PRs merged per day**, and **PRD events per day**, stacked by stage with a
   legend. Inline SVG drawn on the server, no chart library, no script (`board/chart.ts`); a screen
   reader reads a list of the days and their counts in their place.
4. **People**: name (the player's display name, else the account's name, else the GitHub login),
   fleet (its label in its colour, or SOLO), season points, PRs merged, PRDs (drafted, in progress,
   shipped, credited to the PRD's author) and questions answered. Every member in the scope, 0s kept,
   sorted by PRs merged, then points, then name; your row marked. A member with no GitHub login shows
   a dash in the columns GitHub counts (`peopleRows` in `board/tally.ts`). This is what lists a member
   who merges and answers but has no points, or no player row, yet.
5. **Repositories involved**: each repository with its PRs merged and PRD events in the period, most
   active first.

**PRD stages are events**, not a daily snapshot: *drafted* when the `omni:prd` issue opened, *in
progress* when its phase-0 PR merged, *shipped* when its feature PR merged, each credited to the PRD
issue's author, whoever built it.

**Where each number is read from.** `board/load.ts` runs four reads in parallel, as the signed-in
person, each on its own, then filters them to the scope in pure functions (`board/tally.ts`); logins
match ignoring case:

| On the board | Read from |
|---|---|
| who is a member: People's names, logins and fleets; a fleet's logins | `workspace_roster(workspace)`: every `workspace_members` row, with the player's display name else the account's full name, the GitHub login in lower case (`players.github_login`, else the linked GitHub identity), the avatar and `players.team`; no email, and nothing to a non-member |
| PRs merged, PRDs, Repositories, both charts, the repositories involved, People's PRs and PRDs | `contributions` of the workspace over the period's days: kind `pr-merged`, and `prd-opened`, `prd-started`, `prd-shipped` for the three stages, written by `pnpm game:contributions` at each poll ([`game/README.md` › Contributions](../../game/README.md#contributions)) |
| Questions answered, People's questions | `answered_counts(workspace, from, to)`: the `ask_rounds` answered in the window in this workspace's sessions, a count per `answered_by` and nothing else, to a member only |
| People's points, the fleets' colours, a fleet's place, the fleet ranking | `loadGalaxy`, the ledger folded by `buildGalaxy` as `/play` does, read once |
| Home's hero block | your `players` row and the galaxy, as above |
| Waiting for you | `readTabs` and `readForMe`, the ask pages' own readers, counted as those pages show them |

**Its situations**, decided once by each page: the **demo** (development, or a build with
`OMNI_LOOP_DEMO=1`) shows every part on the demo world, with a demo roster over its heroes (two
members with no points, one of them with no fleet) and made-up, fixed contributions and answers
(`board/demo.ts`); a build with **no database** says the dashboard is not open here; **signed out**,
only a sign-in card, which comes back through `/app/callback` (`src/data/sign-in.ts`); an account in
**no workspace**, *Your account is not in a workspace*, with **Switch account**. **A read that
fails** leaves only the parts drawn from it saying *Couldn't load this. Reload in a moment.*, its
error logged on the server, and the rest renders.

**Numbers that read 0 for now.** Season points and places come from the ledger, whose projector
reads each repository's `docs/inbox/*.md` and the plan repository's PRD issues only
(`game/sources/github.ts`), while the kit writes `.omni-loop/delivery/{inbox,shipped}/`: they read
0 for most people until a later PRD teaches the projector the kit's delivery folders, and the boards
show activity beside them. The merges and PRD stages read 0 while the game workflow is off, and the
stages cover the poller's 40-day window only.

**The code.** `src/dashboard/` holds Home (`Dashboard.tsx`, `DashboardScreen.tsx`, `load.ts`,
`demo.ts`, `home/`), the board every page draws (`board/`) and Fleet (`fleet/`); `rankings/` ranks
the fleets. Every part keeps one contract (`part.ts`): its value, or `'unreadable'`. The pages add
no script beyond the sign-in card's button and the app bar's controls, their styles use the ask
pages' tokens only (`src/design-system.test.ts`), and nothing is wider than a 393 px window.

**Fleets** moved under **Settings** with PRD 572: the page is `/app/settings/fleets`, and
`/app/fleets` answers with a permanent redirect there, the query kept (`app/app/fleets/route.ts`).

### Engineering, and Settings › Repositories (PRD 612)

**Settings › Repositories** (`/app/settings/repositories`, `src/repositories/`) lists the
workspace's repositories (`public.repositories`), each with a **Tracked** switch and its last
collection. The workspace's owner adds one with **Add repository**, which lists what the workspace's
Omni App installation can see and is not listed yet, and switches tracking through the owner-only
`add_repository()` and `set_repository_tracked()`; every other member reads the list. A repository
the App cannot read shows *Omni App has no access*, with a link to the installation's settings on
GitHub. Vertuoza, and only Vertuoza, starts with six tracked repositories; any other workspace starts
with none. omni-app's `prStats` Inngest function collects the tracked repositories every 15 minutes
into `pull_requests` and `pull_request_reviews` ([`apps/omni-app/README.md`](../omni-app/README.md)).

**Dashboard › Engineering** (`/app/engineering`, `app/app/engineering/page.tsx`,
`src/engineering/`) is every member's, and counts the tracked repositories only: switching one off
takes it out of every number at the next page load, and switching it back brings its history back.
Under the same period switch as the other boards (`?period=7d|30d|season`), top to bottom:

1. **Six tiles**: PRs opened, PRs merged, open now, median time to merge, commits, lines +/−.
2. **Omni Loop**: the share of merged PRs Omni-man signed (*1 of 2 merged PRs signed by Omni-man
   (50%)*), their median time to merge beside the rest's, and their lines; beside it, **PRs merged per
   day**, the part Omni-man signed stacked apart, drawn as the other boards' charts are.
3. **Repositories**: every tracked repository, 0s kept, with opened, merged, open now, median time to
   merge, commits and lines; each heading a link that sorts by it, kept as `?sort=` (merged, most
   first, by default; the median fastest first).
4. **Most opened**, **most merged** (who pressed Merge) and **most reviews**: five people each, most
   first, ties in login order. Bots (a login ending in `[bot]`) and Omni-man are left out of these
   lists, and still count everywhere else.

The counting rules (`src/engineering/tally.ts`): *opened* by `opened_at` in the period, credited to
the author; *merged* by `merged_at` in the period, credited to `merged_by`; *open now* is every PR
neither merged nor closed, whatever the period; *time to merge* is `merged_at − opened_at`, a median
over the PRs merged in the period; commits and lines are summed over those PRs; a *review* counts
once per reviewer per PR, on its first date, never by the PR's author. Every base branch counts.
`src/engineering/load.ts` reads, as the signed-in person, the tracked repositories, then their PRs
opened, merged or still open in the window and their reviews, a thousand rows at a time. With no
tracked repository the page says *No tracked repositories yet → Settings → Repositories*; a read that
fails leaves the board saying it could not load. The demo draws a made-up board (`src/engineering/demo.ts`).

### Settings › Jev (PRD 812)

**Settings › Jev** (`/app/settings/jev`, `src/jev/settings/`) lets a workspace's owner hand some of
the loop's decisions to Jev, TypeSafe AI's model for typed questions. The owner switches Jev on and
pastes the workspace's TypeSafe API key: `POST /api/jev/key` tests it with one call to Jev, and only
if that call answers, seals it with AES-256-GCM under `SECRETS_MASTER_KEY` (`src/jev/secret-box.ts`)
and stores it through the owner-only `set_jev_key()`. A refused key shows TypeSafe's reason and
nothing is stored. The page then shows only the key's last four. Switching Jev off (`DELETE
/api/jev/key`, `remove_jev_key()`) removes the key and sets every decision Off. Members see whether
Jev is on, never the key. Nobody signed in reads `public.workspace_secrets`; only Galaxy's server,
with the service role, reads a sealed key, to call Jev (`src/jev/client.ts`: the pinned `jev-1.13.0`,
5 s, no retry, every token in what it sends masked). Each decision's mode, threshold and confidence
floor live in `public.jev_decisions`, every call in `public.jev_calls`
(`supabase/migrations/20261022090000_jev_decisions.sql`, proven by `supabase/checks/jev.sql`).

Without `SECRETS_MASTER_KEY` (32 random bytes, base64: `openssl rand -base64 32`), the page says *Jev
is not available on this deployment* and nothing can be saved. Losing it makes every stored key
unreadable: each call then fails, today's path decides, and the owner pastes the key again.

## The knowledge map

The repository's knowledge base (`.omni-loop/knowledge`: its principles, business rules and
invariants, in `product/` and one folder per domain) is shown twice, in the arcade and on a plain
page (PRD 149). Both read one graph: the one `omni kb graph --json` prints.

**The star chart, in the arcade.** STAR CHART sits on the menu after GALAXY MAP, with
`<n> SYSTEMS · <m> WORLDS` beside it.

- `chart`: a sun per domain (`drawSun` in `@omni/design`), sized by how many entries it holds, each
  labelled with its name and count; a dotted lane between two suns for each cross-domain file,
  labelled with its entry count. One domain sits in the middle. The D-pad moves between suns, A
  enters one, B goes back to the menu. The footer names the page: `READ IT AT /KNOWLEDGE`.
- `system`: one domain as an orrery (`src/arcade/scenes/chart-layout.ts`). Principles circle on the
  inner orbit, rules on the middle one, invariants on the outer one, each in id order clockwise from
  the top, drawn by the galaxy map's planet renderer and seeded by their id. A law is terraformed,
  oceans and forests; a proposed entry is barren, and confirming it (removing its `Proposed:` line)
  terraforms it on the next load. Orbits hold still, so a world stays where the D-pad and a tap
  expect it; only the spheres turn. An orbit that cannot seat its worlds spills onto one more of its
  kind, further out, and every world shrinks down to a floor: every entry is always shown (tested at
  150 entries in one domain).
- **Moving in a system.** ◀ ▶ walk the orbit and wrap; ▲ moves in and ▼ out, to the world nearest in
  angle on the next orbit; SELECT goes to the next world; a tap selects a world, and a tap on the
  selected one reads it. The selected world shows a line to the principle it serves and lines from
  every entry that serves it, and the panel (beside the diagram on the wide grid, under it on the
  tall one) shows its id, kind, `LAW` or `PROPOSED`, its statement and `SERVES <id>` or
  `SERVED BY <n>`. **A** opens the reading card: the whole statement, `Why:`, what it serves, what
  serves it, what it cites, how it is enforced and the PRD it came from, paged with ▲ ▼. **B** closes
  the card, B again goes back to the chart, and again to the menu.

**The knowledge page, `/knowledge`.** The same graph as a reading surface beside the `/ask` pages,
in their Omni, Light and Dark themes: the top bar (`OMNI LOOP · Knowledge map`, the repository, a link to
the star chart at `/#chart`, the theme switch, Game mode), a tab per domain and **Between domains**
for the cross-domain entries, an SVG orrery laid out as in the arcade (a law a filled dot, a proposed entry
a hollow ring, each kind in its own colour), the selected entry's detail (statement, `Why:`, what it
serves and what serves it, what it cites, its PRD, how it is enforced, its file), and the index of
the domain grouped by principle, with its loose entries and unserved principles and a filter. A
selection is kept in the address, `/knowledge?domain=<name>&entry=<id>`, so a link to one entry can
be shared. On a phone the page stacks and scrolls down, never sideways.

**The repository menu.** The page opens on the checkout the app is deployed from. When the crew's
workspaces have other repositories set up with Omni Loop, a **Repository** menu takes the place of
the repository's chip: the deployed checkout first, then, by name and each once, every repository
that the Omni Loop App (omni-loop-invader) installation of one of the viewer's workspaces reaches
and that carries a `.omni-loop/config.yml` on its default branch (what `omni init` and
`/omni:invade` leave); archived repositories are left out. Picking one opens
`/knowledge?repo=<owner/name>` on its first domain, and every address on the page keeps the `repo`,
so a link to one of its entries can be shared; the star chart link is shown for the deployed
checkout only, which is all the arcade charts. The menu is a GET form with a **Show** button, so it
works before any script runs. A repository the menu does not offer is never read: `?repo=` naming
one says it is not on the menu. A repository set up without knowledge yet says so, and that
`/omni:invade` proposes some. The demo in development, with no database, offers no menu.

**Where the data comes from.** The deployed checkout's knowledge is read on the server at request
time through the kit's own register parser (`src/data/load-knowledge.ts`): no Supabase table, no
GitHub call. `next.config.mjs` traces the config and the register files into the deployment, since
nothing imports them. When they cannot be read, the loader logs why, both maps say the knowledge is
out of reach, and nothing else in the arcade changes. Another repository's is read from GitHub as
the Omni Loop App (`src/knowledge/github.ts`), with the App's `GITHUB_APP_ID` and
`GITHUB_APP_PRIVATE_KEY`: the menu lists the repositories of each of the viewer's workspaces'
installation (the one it stored, else the App's installation on its GitHub org, else on that user
account), a hundred per page and at most ten pages, checking fifty configs per GraphQL call, and a
picked repository's `product/`, `domains/` and `cross-domain/` registers, under the knowledge folder
its config names, are read in one more call at its default branch's tip and built into the same
graph by the same parser (`graphOfTexts` in `kit/lib/knowledge/graph.ts`). The token stays in
server memory; the listing is kept five minutes per installation and a graph one minute per
repository. Without the App's credentials, or when the workspaces or GitHub cannot be read, the menu
offers only what it could read (the log says why), and the deployed checkout is always there.

**Who sees it.** Whoever sees the galaxy: a crew member (a member of a workspace) signed in, or the
demo in development. Anyone else's page carries no entry: in the arcade STAR CHART reads
`OUT OF REACH` and does not open (`app/page.tsx` hands the graph to the crew and the demo only);
`/knowledge` shows the sign-in card signed out, and a crew-only notice to an account in no workspace;
a build that is neither says the map is not open here. The single-file artifact never embeds a
knowledge base: its star chart reads `NO STAR CHART IN THIS BUILD`.

## The game room

Every point a player earns by delivering also counts as XP, and XP never resets: a new season
starts the Hall of Heroes again, never a level (PRD 160). The rules (what XP counts, the curve, the
cap and the level each game opens at) are the `xp` block of `game/rulebook.ts`, applied by
`game/experience.ts` ([`game/README.md` › XP, levels and unlocks](../../game/README.md#xp-levels-and-unlocks)).
The game workflow writes each login's XP, level and unlocked games to `player_xp` at every poll
(`pnpm game:xp`); the arcade reads that row and shows the level it holds. Where the workflow is
off, no row exists, and every player sees NO XP YET.

- **GAMES** sits on the menu after HALL OF HEROES, for everyone signed in. Its hint reads
  `LV 3 · 1 game unlocked`, or why there is no level, and a NEW tag shows beside it until the room
  is first opened on this device. A player's badge adds the level, `P1 INKY · OCTOPOD · LV 3`: never
  before the first point, nor when XP could not be read. Like the galaxy's screens, the room opens
  only once the galaxy is loaded.
- **`games`**, the room (`src/arcade/games/room.ts`): the level, the XP bar and the XP to the next
  level (`LV 3 · 180 / 300 XP`, `120 XP to LV 4`), then a cabinet per game in the registry
  (`src/arcade/games/index.ts`). A lit cabinet shows the crew's top five, the player's own line
  highlighted, and A · PLAY; a locked one is dark and shows the level it opens at (SUPER OMNI WORLD:
  `REACH LV 2 TO PLAY`); a dark SOON cabinet stands for the game to come, with no level. A visitor sees every cabinet locked and
  "LINK GITHUB TO EARN XP", a player with no XP yet "NO XP YET · SCORE YOUR FIRST POINT", and XP that
  could not be read "XP OUT OF REACH". The wide grid stands the three cabinets side by side, ◀ ▶
  choosing; the tall grid shows one a page.
- **`levelup`** (`src/arcade/levelup.ts`): arriving at the menu by any route, a player whose level
  is higher than the one last celebrated on this device (`omni-loop:level-seen:<login>` in browser
  storage) sees LEVEL UP! first. When a level climbed since then opened a game their row holds
  unlocked, it adds NEW GAME UNLOCKED: A plays it at once, B goes on to the menu; with no game, A goes
  on. Either key saves the level as celebrated, so a new device plays it once more; storage that
  refuses plays it once a page load. It never plays on XP it could not read, and reduced motion
  stills its rays and flashes.
- **`invaders`**, Entropy Invaders: the player's own hero, in their fleet's colours, flies along the
  ground against a formation of alien Entropy that marches side to side, steps down at each edge
  and fires back: 5 rows × 10 and four shields on the wide grid, 5 × 6 and three on the tall one.
  Each row is one wound kind, the one that pays most on top, and each alien pays its kind's close
  value from the rulebook (`woundClose`); the game opens on that score table for three seconds (A
  starts at once). The shields wear away under fire from both sides, and each cleared wave starts
  faster. The hero has three lives: the game ends when they are gone, or when the formation reaches
  the hero's row. Its sounds are the synth's: a marching bass that speeds up with the formation,
  fire, hit, hero hit, a cleared wave and the game over. The engine is pure and seeded
  (`src/arcade/games/invaders.ts`: `newGame()`, `step()`, `press()`, its speeds in `FIELDS` and
  the constants above it), and the scene draws it.
- **The score.** At game over the score is sent once through the account's `submitScore()` (in
  Supabase, `submit_score()`), 0 included; once it is saved, the cabinet's top five is read again.
  The screen says SAVING SCORE…, then NEW BEST, YOUR BEST n, or SCORE NOT SAVED, where A retries
  once and B goes back to the room; otherwise A, B or START go back. Playing never earns points or
  XP.
- **`platformer`**, SUPER OMNI WORLD (PRD 817), opened at LV 2 (`xp.unlocks.platformer` in the
  rulebook): an original side-scrolling platformer in the SNES style, on Phaser 4, which is imported
  only when the game opens (`src/arcade/platformer/PlatformerScreen.tsx`, the one way in; a failed
  import says `GAME DID NOT LOAD · A TO RETRY`). The player's own hero runs (◀ ▶, B held to run),
  jumps higher the longer A is held, stomps Entropy blobs, takes coins and bumps `?` blocks, over
  three stages played in order: **1-1** grass, **1-2** underground and **1-3** the castle, each in
  its own palette of `@omni/design` tiles (`STAGE_PALETTES`) and with its blobs in a wound kind's
  colours. The stages are text maps in `src/arcade/platformer/stages.ts`, checked by its test (one
  start, one flag, 18 equal rows, known characters, no pit wider than a run-jump). Three lives: a
  blob, a pit or the 300-second clock costs one and restarts the stage, the score kept. A coin is
  10, a stomp 50, and each second left at the flag 10. A stage clear goes on to the next stage on
  A; 1-3's flag shows WORLD CLEAR. The rules (`rules.ts`, `session.ts`) have no Phaser in them;
  Phaser does the physics and the drawing and reports what happened. It is silent. At the game over
  or WORLD CLEAR the score is sent once under `platformer`, with the same SAVING SCORE…, NEW BEST,
  YOUR BEST n or SCORE NOT SAVED (A retries once) as Invaders.
- **The play dock**, the corner Game Boy that plays while Claude works (PRD 757,
  `src/play-dock/`): below LV 2 it goes straight into Entropy Invaders; from LV 2 it opens on a
  picker, `ENTROPY INVADERS` and `SUPER OMNI WORLD`, ▲ ▼ to choose, A to play, B to fold. B on a
  game's ready, pause or game-over screen goes back to the picker, and the last choice is
  remembered for the tab's session. A question on the page pauses the game at once and only START
  resumes it. The dock does not send SUPER OMNI WORLD's score.

## PRD dossiers

The galaxy keeps one **dossier** per PRD (PRD 216): its artifacts (`spec.md`, `plan.md` and
`before-after.html` from the PRD's delivery folder), every version of each, the repositories
involved, and the questions that shaped it. The kit fills it from the terminal (`omni dossier open`
at the brainstorm's start and `omni dossier push <n>` after each push, through `POST /api/dossiers` and
`POST /api/dossiers/push`, ADR-0002's contract), and the game workflow's `pnpm game:dossiers` reads
each repository's default branch for whatever the kit did not send ([`game/README.md`](../../game/README.md)).
A repository opts in with `dossier: { enabled: true }` in its `.omni-loop/config.yml`.

**`/prd`, the history.** Every dossier of the signed-in person's workspaces, newest activity first
(its latest version, question or answer, or its opening or numbering). Each row shows `#n` or
DRAFT, the title, its repository chips, which artifacts it has and their latest version, and the
questions answered out of asked, and `n open` when its outbox has open questions (PRD 251, read
through the same cached GitHub reader as the Outbox tab).
Filters: **Needs an answer** (`?needs=answer`, only the rows with open questions), a repository (a dossier shows under each of its repositories: its home repository, its
questions' repositories and, for a PRD of the plan repository, its planet's regions), draft or PRD,
and a search over the words of the titles. Each row opens `/prd/<id>`.

**`/prd/<id>`, the page to share.** The header reads `PRD #n` or DRAFT, the title, the repository
chips, who opened it and when (or that it was read from GitHub), and **Copy link**. Its tabs:
**Before/after**, **Spec**, **Plan** (markdown rendered by `markdown-it` with raw HTML off, the front
matter as a line above), **Questions** (each round's questions, options and answer, who answered
and after how long, its category, and `brainstorm` or `delivery`) and **Outbox**, with `n open` in
its label ([The Outbox tab](#the-outbox-tab-prd-251)). Each artifact tab has a version
picker, newest first (`v3 · 27 Sep · Pierre (kit)`, `v4 · 28 Sep · commit a1b2c3d (github)`); the
tab and the version live in the address (`?tab=spec&v=2`). The opener of a draft may delete it;
nobody deletes a numbered dossier.

- **The before/after page runs sandboxed**, served from `/prd/<id>/v/<n>/page` with
  `Content-Security-Policy: sandbox allow-scripts; default-src 'none'; …` and
  `X-Content-Type-Options: nosniff`, and shown in an `<iframe sandbox="allow-scripts">`: an anonymous
  origin, with no cookies and no network, even opened on its own.
- **Who reads it.** A member of the dossier's workspace, signed in with the arcade's GitHub sign-in
  (each page has its own callback, `/prd/callback` and `/prd/<id>/callback`). Anyone else, a
  member of another workspace included, gets not found, in the words a dossier that never was gets.
  Omni, Light and Dark themes, Omni the default, as the `/ask` pages.
- **Without a database**, in development, both pages play a demo dossier.

### The Outbox tab (PRD 251)

A person answers the PRD's outbox questions on `/prd/<id>?tab=outbox`, beside what they are about,
as well as on the feature pull request or at the end of `/omni:yolo`. Every door ends as the
person's own reply on the feature pull request, so `/omni:yolo-fix` settles it like any other
(ADR-0052).

- **What it shows** is read from GitHub, as the omni-loop App, by PRD 426's reader
  (`src/dossier/github/reader.ts`, cached 60 seconds per dossier); nothing of the outbox is stored.
  The open questions carry the outbox comment's numbers (`Q1`, `Q19`), as the pull request shows
  them: a decision card with its options as a radio group, A marked `built · recommended`, an
  optional reason, its `bears-on` chips linking to `/knowledge` and a details disclosure; a
  human-action card with its steps, then **Done** or **Not done**, which needs a reason. Each
  pending answer (the kit's `planReplies` run on the pull request's comments: what it said, who,
  where from its door line, and when; the latest answer wins) shows on its card, which can be
  answered again. Then two collapsed groups: *Adopted unless you object*, each with **Object**, and
  *Settled*. Item text is rendered with the dossier's markdown renderer, raw HTML off.
- **The context rail.** On a wide screen, the questions sit beside a rail that switches between
  Before/after (the sandboxed frame), Spec and Brainstorm (the dossier's brainstorm rounds, each
  question with its answer). On a tall one the rail is a Context disclosure above the questions.
- **The toolbar.** **Select every recommendation** picks A on every open decision and never marks a
  human action done. **Send n answers** posts the picks. Picks survive a reload (the browser's
  storage, a convenience only).
- **The states:** no outbox yet; nothing waiting on you; read-only once the pull request merged or
  closed (what was still open was adopted); GitHub out of reach (the other tabs unchanged);
  signed out, or not a member of the workspace, read-only with *Sign in with GitHub to answer
  here*; and, without a database, a demo outbox with Send off.

**Send** posts the reply as the person, never as the App's bot:

1. `POST /api/outbox/send` (`src/outbox/send.ts`), as the signed-in person, who must be a member of
   the dossier's workspace, reads the outbox fresh from GitHub (not from the cache) and checks each
   pick against it. A pick whose question was settled meanwhile is dropped, and the tab names it.
   The kit's reply writer (`kit/lib/outbox/answers.ts`) writes the reply, and it is recorded as a
   send, a row of `outbox_sends`.
2. The person goes through GitHub's authorisation of the omni-loop App (`GITHUB_APP_CLIENT_ID`),
   whose `state` names the send and carries a nonce, also held in a short-lived, http-only cookie;
   only the nonce's hash is stored. A person who authorised it before comes straight back.
3. `/prd/github/callback` checks the nonce and that the send is the caller's and not yet posted,
   trades the code for a user token (`GITHUB_APP_CLIENT_SECRET`), posts the reply once, drops the
   token (never stored, logged or sent to the browser), records the comment's link and author, or
   the error, clears the dossier's cached summary, and goes back to the tab: *Sent as @login*, the
   link, and `/omni:yolo-fix <n>` to copy; the answers just sent show as pending at once. GitHub
   brings the person back only to a host listed as a callback URL in the App's settings, so a
   preview deployment cannot send.
4. An author GitHub does not list as `OWNER`, `MEMBER` or `COLLABORATOR` is reported: `omni replies`
   will not count that reply. Any failure (the authorisation refused, a wrong `state`, GitHub down,
   no access, the pull request gone) posts nothing, keeps the picks and names why.

**The routes.**

| Route | What it does |
|---|---|
| `POST /api/outbox/send` | Send's first half, above: answers `{ send, authorize, dropped }`, or 503 *not open here* without the App's client id and secret. |
| `GET /api/outbox/send?id=<send>` | A send's outcome, for its owner's Outbox tab. |
| `GET /prd/github/callback` | Send's second half, above. |
| `/prd/at/<owner>/<repo>/<n>` | The short address the outbox comment links (with `answers.enabled` on and `ask.url` set): redirects to that PRD's Outbox tab as the signed-in person, or not found (a dossier of another workspace included). Signed out, the sign-in card, back through `/prd/at/<owner>/<repo>/<n>/callback`. |

**The planet's DOSSIER tab.** The planet screen's fifth tab, after LOG. A planet's dossier is the one
whose home repository is the workspace's plan repository (`<github_org>/<plan_repo>`) and whose number
is the planet's PRD.

- It shows each artifact with its latest version and date (`V3 · 24 SEP`, or NONE YET), the rounds
  asked and answered (`12 ASKED · 11 ANSWERED`, a round counting once, as the Questions tab counts it)
  and the last three answered, newest first: each round's first question and its answer on one line,
  cut to fit, with `+n` when the round held more questions.
- **`[START] OPEN`** opens `/prd/<id>` in a new browser tab; a tap on the hint does the same. On every
  other tab, and where there is nothing to open, START goes back to the map as it always has. The
  tabs still turn with ◀ ▶ and A.
- A planet without a dossier shows NO DOSSIER YET; when the dossiers could not be read, DOSSIERS OUT
  OF REACH, and the rest of the planet is unchanged.
- The wide and the tall grids show the same rows. The demo world's planets carry demo dossiers; the
  single-file artifact shows them without the OPEN hint, since it has no page to open.
- **In the demo**, a planet's OPEN opens the pages' demo dossier, whichever planet it was pressed on.

## PRD stages (PRD 587)

Where each PRD is (PRD, inbox, building, outbox, shipped, retro) is stored in `public.prd_stages`,
one row per stage with the date it was reached, and each PRD folder's topic in `public.prd_topics`.
The pages read them and never wait on GitHub. Two ways in write them, as the service role:

- **The sync, every 15 minutes, is the truth.** The `stages` workflow
  (`.github/workflows/stages.yml`) calls `POST /api/stages/sync` with
  `Authorization: Bearer <STAGES_SYNC_SECRET>` and fails when the reply is not 2xx. For each
  workspace, galaxy lists the repositories its App installation reaches that carry a
  `.omni-loop/config.yml`, and reads each through the App (`src/stages/sync/github.ts`): its config,
  the PRD folders in `inbox/` and `shipped/` on its default branch, the issues carrying `labels.prd`,
  its pull requests, and when an open feature PR was marked ready. `src/stages/sync/core.ts` turns
  that into stages, each dated by its own event (the issue's creation, the phase-0 merge, the first
  slice PR merged into the feature branch, the feature PR's ready time, its merge, the retro PR's
  creation). A folder in `inbox/` or `shipped/` whose PR is not found is recorded at the sync's time.
  A repository that cannot be read is logged and skipped, and the others still land. A stage keeps
  its first date, so a rerun writes nothing new. The reply names the stages and topics per
  repository, and what was skipped and why.
- **Stage events, between two syncs.** omni-app posts a signed stage event to
  `POST /api/stages/event` when a phase-0, slice, feature or retro PR moves, signed with
  `STAGE_EVENT_SECRET`.

While either secret is missing on galaxy, its route refuses every call (401), and stages come from
the other way in. Where each is set: [Deploy to production](#deploy-to-production), steps 2 and 5.

## Release notes

Every PRD the loop ships carries a release note (PRD 262): a `release.md` beside its spec, a title and
a one-paragraph description written for anyone outside, which the loop writes at ship and the feature
PR's reviewer approves (`omni check releases` grades it). Once the PRD is on `main`, the sync stamps it
with a version, `0.0.<n>`, once and for good, and `/releases` lists every release, week by week.

```
main ── a push under .omni-loop/delivery/shipped/ ──▶ releases workflow: pnpm releases:sync
                                                             │  the service role: adds a row per PRD shipped
                                                             ▼  since, refreshes a changed note's text
                                             Supabase: public.releases (anyone reads it)
                                                             │  the publishable key, no session
                                                             ▼
                                   /releases, regenerated at most every 5 minutes, no sign-in
```

**`/releases`, the page.** Public and indexed: no sign-in, no cookie read, and a title, a
description, a canonical address and Open Graph tags, with no `noindex`. The app bar reads
`OMNI LOOP · Releases`, then the theme switch and Game mode, and `/app` has a card for it, **Release
notes**.

- **Weeks** start on Monday, in Brussels time (`src/releases/weeks.ts`), newest first, each headed
  `Week of <Monday>`, and the releases inside a week run newest first. Each shows its version, its
  day, `PRD <n>` as plain text (never a link: the repository is private), its title and its
  description.
- **Release 0.0.1**, the initial release, gathers the 21 PRDs shipped from 24 to 27 September 2026. It
  is dated by the latest of them and shows `Initial release`, its headline and intro, then a line per
  PRD in PRD order.
- **The four newest weeks are open**; each older one is a native `<details>` whose summary counts its
  releases and PRDs. No script: every word is in the page.
- **Each release has an anchor**, its version: `/releases#0.0.3` opens on it, and its version links to
  it. A browser that honours it opens the folded week around it (Chromium does).
- **Its words** live in `src/releases/words.ts`: the heading, its line, the initial release's headline
  and intro, and the unavailable message.
- **Modes** (`src/data/mode.ts`): with Supabase, it reads `public.releases` with the publishable key and
  no session (`src/releases/store.ts`). In development, or a build with `OMNI_LOOP_DEMO=1`, it shows a
  built-in sample (`src/releases/demo.ts`: the real initial release, then sample releases over five
  weeks, so the oldest folds). Closed, it says *Release notes are unavailable right now.*
- **A failed read** (`src/releases/page/source.ts`) never fails the build: while building, the page is
  built with the unavailable line and the reason is logged. After that, it never replaces a good page:
  the read throws, Next keeps serving the last page it rendered, and it tries again on a later
  request. A visitor never reads an error's detail.

**`pnpm releases:sync`, the sync** (`scripts/releases-sync.ts`, its rules in `src/releases/`). It
reads this checkout's shipped folders through the kit (the config, the layout and the note parser)
and `git`, reads the table, and writes:

1. A PRD already in the table keeps its release number and date forever; only its title and
   description are refreshed from its note, so a typo is fixed by a pull request.
2. A note pinned `version: 0.0.1` gets release 1.
3. Every other shipped PRD with no row gets the next number, from 2, in the order its shipped folder
   first reached `main`, the lower PRD number first on a tie.
4. Its date is the committer date of the first commit on `main` that holds its shipped `spec.md`.
5. A shipped PRD with no note is published under its spec's title with an empty description.
6. It never deletes a row, and the database lets it neither renumber nor redate one.

Every number comes from `main`'s history, so emptying the table and syncing again rebuilds the same
rows. A note that breaks the rules stops the whole sync, which writes nothing and exits 1 until a pull
request fixes it. It needs `SUPABASE_URL` (the project's URL, not the `NEXT_PUBLIC_` one) and
`SUPABASE_SERVICE_ROLE_KEY`, and names the one missing; `pnpm releases:sync` also reads them from
`apps/galaxy/.env.local`, as the `game:*` commands do. Run it on a checkout of `main` with its whole
history: locally, `npx supabase status` prints both values.

**`.github/workflows/releases.yml`** runs it on a push to `main` that touches
`.omni-loop/delivery/shipped/**` (or the workflow), after every successful `supabase` run on `main` (so
the first sync follows the migration that creates the table), and by hand. It checks out `main`'s
whole history, runs one sync at a time (`group: releases`), and uses the same project and secret key
as the game workflow. It stays off while `SUPABASE_PROJECT_ID` is unset, and it shares nothing with the
game: deleting `game/` leaves it working.

## Run it locally

From the repository root:

```bash
pnpm install
pnpm galaxy:dev          # http://localhost:3000: HOME; the demo galaxy at /play, its dashboard at /app (no Supabase needed)
```

### With a local Supabase

Needs Docker and the Supabase CLI (`npx supabase`).

```bash
npx supabase start       # applies supabase/migrations and loads supabase/seed.sql (the demo galaxy, in the vertuoza workspace)
npx supabase status      # prints the API URL, the anon key and the service_role key
cp apps/galaxy/.env.example apps/galaxy/.env.local   # paste the URL and both keys
pnpm galaxy:dev          # now reads from Supabase: the menu shows "SUPABASE LEDGER"
SUPABASE_URL=http://127.0.0.1:54321 pnpm releases:sync   # fills public.releases from this checkout, on main
```

`/releases` reads `public.releases` as soon as the two public variables are set: empty until the sync
has run, it says no release is published yet. The sync writes with the service role's key, which it
reads from `.env.local` like the `game:*` commands, and the project's URL as `SUPABASE_URL`.

Signing in locally needs a GitHub OAuth client: export `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` and
`SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`, set `enabled = true` on the GitHub provider in
`supabase/config.toml`, and restart the stack. The client must accept
`http://127.0.0.1:54321/auth/v1/callback`. Joining by org also needs the service role's key in
`.env.local`, and signing up a GitHub App of your own (its id, slug and private key, see
`.env.example`) whose setup URL is `http://localhost:3000/signup/installed`. Without them, work on the
demo galaxy instead.

`pnpm galaxy:seed` regenerates `supabase/seed.sql` from the demo world, dated now, in the `vertuoza`
workspace the migrations create, with the demo world's invented fleets.

### Screenshots of every scene, and of `/app`

`pnpm galaxy:shots` walks the demo galaxy from the keyboard in a headless Chromium, from the boot
through the joining flow and the level-up (the demo guest's borrowed level, new in that browser) to
every screen of the menu, and saves a screenshot of each scene (the title's three phases, OPEN THE
APP? over the menu, the planet's first four tabs (not yet DOSSIER), a system's reading card, and
Entropy Invaders' score table, play and pause each on their own; the star chart shows this
checkout's knowledge) at three sizes: 393×700 upright
touch (an iPhone with Safari's bars), 852×393 sideways touch and 1440×900 with a mouse.

Then it opens `/app`, the dashboard the demo draws, signed in as its *you*, picks Omni, Light and
Dark on the app bar's theme switch (a finger on the two touch sizes, the mouse on a computer), and
saves the whole page in each, at the same three sizes (`34-app-omni.png` to `36-app-dark.png`).

```bash
pnpm --filter @omni/galaxy-app exec playwright install chromium   # once: Playwright's Chromium
pnpm galaxy:dev          # in one terminal
pnpm galaxy:shots        # in another: apps/galaxy/shots/<width>x<height>/, which git ignores
```

- It prints every text element in the screen (on `/app`, the page) that renders below 8 CSS px at
  393×700, with its screenshot. The list is a report, not a failure.
- `/app` wider than its window, which a person would have to scroll sideways, fails the run: it names
  the elements past the right edge, and saves the screenshot all the same.
- Each screenshot of the arcade is taken at the same moment of its scene on every run (the page's
  clock is Playwright's), so two runs can be compared screen by screen. Only the demo galaxy's own
  dates move, since it is dated now. `/app` is drawn on the server, with its clock: its week of
  merges moves with the day it is shot on.
- The demo guest is always a member of a workspace. To reach the "wrong cartridge" screen, the
  script makes it an account in no workspace, in the browser only.
- Without `pnpm galaxy:dev` running, it stops and says so. `pnpm test` never starts it.
- A dev server on another port: `GALAXY_URL=http://localhost:3001/ pnpm galaxy:shots`.

## Deploy to production

Supabase holds the game's data and is its source of truth; GitHub Actions migrates it and appends
to the ledger, and Vercel serves the arcade from it:

```
supabase workflow ── supabase db push, on merge to main ──┐
game workflow ─ game:project + game:xp, every 15 minutes ─┼──▶ Supabase, Central EU (Frankfurt)
releases workflow ─ releases:sync, when a PRD ships ──────┘          │  the player's own session;
                                                                     │  nobody's, for /releases
                                                                     ▼
                                                      Vercel, fra1: apps/galaxy
                                                                     ▲
stages workflow ─ POST /api/stages/sync, every 15 minutes ───────────┘  galaxy reads GitHub as the App
```

### 1. Create the Supabase project

In the Vertuoza Supabase organisation, create a project in **Central EU (Frankfurt)**, next to the
Vercel region pinned in `vercel.json` (`fra1`). Keep the database password. Then note:

- the **project ref**: the `<ref>` in `https://<ref>.supabase.co`;
- the **publishable key** (or the legacy `anon` key): public by design, the web UI uses it;
- the **secret key** (or the legacy `service_role` key): it writes, so only GitHub Actions and
  galaxy's server get it, never a browser;
- a **personal access token** (Account › Access Tokens), for the migrations workflow.

### 2. Give GitHub the project

Repository settings › Secrets and variables › Actions:

| Name | Kind | Value | Used by |
|---|---|---|---|
| `SUPABASE_PROJECT_ID` | variable | the project ref | the three workflows; unset, the migrations skip their deploy and the sync stays off |
| `SUPABASE_ACCESS_TOKEN` | secret | the personal access token | `supabase.yml` › deploy |
| `SUPABASE_DB_PASSWORD` | secret | the database password | `supabase.yml` › deploy |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | the secret key | `game.yml` › ledger and rankings; `releases.yml` › sync |
| `GALAXY_URL` | variable | the production arcade's URL, `https://<production host>` | `stages.yml`; unset, the stages sync stays off |
| `STAGES_SYNC_SECRET` | secret | the same value as galaxy's `STAGES_SYNC_SECRET` (step 5) | `stages.yml` › sync |

### 3. Apply the migrations

Actions › **supabase** › Run workflow, on `main`. From then on, every merge to `main` that touches
`supabase/migrations/` applies them. A pull request that touches `supabase/` first proves they apply
to an empty database and runs `supabase/checks/access.sql` (who may read and write what). `db push`
never loads the demo seed. Each successful run on `main` is followed by the releases workflow, which
fills `public.releases` for `/releases` ([Release notes](#release-notes)).

### 4. Set up sign-in

1. **GitHub** › the vertuoza organisation › Settings › Developer settings › OAuth Apps › New:
   homepage the arcade's URL, callback `https://<ref>.supabase.co/auth/v1/callback`. It is the only
   way in. (The omni-loop GitHub App can serve instead: its Client ID, a client secret generated on
   its page, which is not the webhook secret, the same callback URL, and the *Email addresses: read*
   account permission.)
2. **The omni-loop GitHub App** (`apps/omni-app`, registered from `app.yml`) › its settings page:
   make it **public** (Advanced › Make public), and set its **Setup URL** to
   `https://<production host>/signup/installed` with *Redirect on update* on. Note its **App ID**
   and its public **slug** (`github.com/apps/<slug>`), and generate a **private key** (a `.pem`) for
   galaxy.
3. **Supabase** › Authentication:
   - Sign In / Providers: enable **GitHub** with its client ID and secret, and disable **Google**.
   - URL Configuration: Site URL = the production arcade; Redirect URLs = `https://<production
     host>/**`, `https://*-<vercel-team>.vercel.app/**` (previews) and `http://localhost:3000/**`.
     The `/**` covers `/signup/installed/callback`, where sign-up signs the visitor in again.
   - Hooks: **Before User Created** → Postgres function `public.hook_before_user_created`. It
     lets in an account made by the GitHub provider, with or without an email, and refuses every
     other with "Omni Loop signs in with GitHub only." Keep the function's name: the setting points
     at it. The database policies refuse anyone who is not a member anyway.

### 5. Create the Vercel project

1. Add New › Project, import `vertuoza/vertuo-omni-loop`, and set **Root Directory** to
   `apps/galaxy`. Vercel detects the pnpm workspace and installs from the root. Keep "Include files
   outside the Root Directory" on (the app imports `game/` and `packages/`). Framework and region
   come from `vercel.json`.
2. Environment variables, for Production and Preview: `NEXT_PUBLIC_SUPABASE_URL` =
   `https://<ref>.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable key.
   `NEXT_PUBLIC_*` values are inlined at build time: redeploy after changing them. Without them the
   deployment stays closed (nobody can enter); it never falls back to the demo.
   Then, server only (never with a `NEXT_PUBLIC_` name): `SUPABASE_SERVICE_ROLE_KEY` = the secret
   key, which joins people by org and makes workspaces at sign-up; and the App's `GITHUB_APP_ID`,
   `GITHUB_APP_SLUG` and `GITHUB_APP_PRIVATE_KEY` (the whole `.pem`; on one line, each line break
   written `\n`). Without the secret key, sign-in works but nobody joins a workspace; without the
   App's three, `/signup` says sign-up is not open here.
   Optionally `OPENROUTER_API_KEY`, an [OpenRouter](https://openrouter.ai) key, server only: ask mode
   then sorts each question into one of six categories (business, product, UX/UI, architecture,
   harness, other) a moment after it is asked. Without it, questions stay unsorted and nothing fails;
   anyone in the workspace can still sort them on the page.
   For Send on the Outbox tab (PRD 251), two more, server only: `GITHUB_APP_CLIENT_ID` and
   `GITHUB_APP_CLIENT_SECRET`, the omni-loop App's Client ID and a client secret generated on its
   settings page. Then, in the App's settings, add the callback URL
   `https://<galaxy host>/prd/github/callback`, beside any it already lists (a GitHub App keeps
   several). Without the two variables, the tab still reads the questions and Send says sending is
   not open here; without the callback URL, Send fails with GitHub's reason.
   For the PRD stages (PRD 587), two secrets, server only, each a long random string
   (`openssl rand -hex 32`): `STAGES_SYNC_SECRET`, the same value as the repository's Actions secret
   of that name (step 2), which the `stages` workflow sends to `/api/stages/sync`; and
   `STAGE_EVENT_SECRET`, the same value as on omni-app, which signs its stage events to
   `/api/stages/event`. Without one, its route refuses every call and stages come from the other way
   in ([PRD stages](#prd-stages-prd-587)).
   For Jev (PRD 812), one more, server only: `SECRETS_MASTER_KEY`, 32 random bytes in base64
   (`openssl rand -base64 32`), which encrypts each workspace's TypeSafe key. Without it,
   Settings › Jev says Jev is not available on this deployment and every decision is made as before
   ([Settings › Jev](#settings--jev-prd-812)).
3. Deploy. The page renders per request with the visitor's session. If Supabase cannot be read, the
   arcade still plays its attract mode and says the galaxy is out of reach. `/releases` reads the
   database at build time instead, as nobody, and again at most every 5 minutes.

### 6. Fill the galaxy

Invite the crew to join (sign in with GitHub, pick a fleet). The real sectors are in a migration
(`supabase/migrations/20260926160000_vertuoza_sectors.sql`: `omni-core`, `ai-nebula`, `flow-rim`);
add a sector or a repository with a migration of its own. Then switch the game workflow on ([`game/README.md` › Setup](../../game/README.md#setup)): the first
poll backfills history with everyone's fleet as it stands.

### In production

- The ledger moves at most every 15 minutes (the game workflow's poll), and each player's XP with
  it; every page load reads them.
- On Supabase's Free plan an idle project is paused after a week. Once the game runs, the 15-minute
  poll keeps it in use. The ledger and the crew's high scores now live only in the database: the
  weekly backup artifact (or the Pro plan's point-in-time recovery) is what restores them.
  `player_xp` rebuilds from the ledger at the next poll.
- `/releases` keeps serving its last good render while the project is paused or out of reach, and
  the releases workflow fails loudly in Actions until it wakes. `public.releases` rebuilds from
  `main`'s history: empty it and run the sync.

## Share it without a server

```bash
pnpm galaxy:artifact     # apps/galaxy/artifact/dist/omni-loop.html
```

One self-contained HTML page (React from cdnjs, everything else inlined) that plays the demo galaxy,
joining flow included, and the game room: the guest borrows the demo world's highest XP and plays
Entropy Invaders, its best scores kept in that browser. It inlines the two pixel faces from
`@omni/design`; the display and body roles fall back to system faces there, to keep the page small.
It carries no knowledge base: its star chart reads `NO STAR CHART IN THIS BUILD`. Its planets carry
the demo dossiers, with no OPEN hint: there is no page to open.

## Database

`supabase/migrations/`. Everything the game holds belongs to a **workspace**, and a person reaches
a workspace by being a **member** of it. Vertuoza is workspace #1.

- `workspaces`: `slug` (`vertuoza`), `name` (`Vertuoza`), `github_org` and `plan_repo` (the
  organisation the projector reads and the repository that carries the PRD issues),
  `github_installation_id` and `github_account_type` (the omni-loop App installation it owns, on an
  `Organization` or a `User`'s own account; members join by org only once it is set) and `theme`. The theme holds only the overrides of the arcade's colour tokens,
  e.g. `{"plasma": "#2fc6a4"}`; `valid_theme()` refuses anything but an object of known tokens
  with lowercase `#rrggbb` values. Vertuoza's is `{}`. The tokens are listed under
  [A workspace's look](#a-workspaces-look).
- `workspace_members`: who belongs where (`role` is `owner` or `member`, `joined_at`). A person may
  belong to several workspaces. `join_workspaces_by_github(user, logins)`, run by galaxy's server at
  sign-in as the service role only, adds the person to every workspace with an installation whose
  `github_org` is one of their GitHub logins, adds nothing twice, and returns the slugs of their
  workspaces, the one joined first first.
- `create_workspace_from_installation(user, installation, login, type)`, the service role's only,
  run by `/signup` once it has checked the installation with GitHub: one workspace per GitHub account
  (a replayed installation or an account that has one already joins it as a member, recording the
  installation when it had none), else a new, empty one with the person as its owner.
- `signup_requests`: `(user_id, github_org, created_at)`, a visitor waiting for their org's owner to
  install the App. Its own person reads it; only the service role writes it.
- `ledger_events` mirrors the event contract (`game/events.ts`) one to one, with the same type
  check, plus the `workspace_id` it is stored under: the workspace is a storage column, never an
  event field, so two workspaces may each hold a `planet:12:charted` (key `(workspace_id, id)`). A
  trigger refuses `UPDATE` and `DELETE`: the ledger is append-only.
- `sectors` hold the repositories; `teams` are the fleets and their look (label, colour, motto,
  mascot, home sector, order, `retired_at`). Both belong to a workspace, keyed by
  `(workspace_id, name)`, and change by migration. A fleet is retired, never deleted.
- `players`: one per member and workspace (`workspace_id`, `user_id`): arcade name, fleet of that
  workspace (`team_since` stamped by a trigger, retired fleets refused), hero (preset numbers,
  checked by `valid_hero()`), and the GitHub login, unique within a workspace. A row may only be
  created once GitHub is linked (`my_github()` reads the caller's linked identity); the trigger
  copies the login from that identity, and `link_github()` refreshes it on every player row of the
  caller. Leaving a workspace removes its player row. The email stays in `auth.users`.
- `player_xp`: each login's XP, level and unlocked games in a workspace, one row per login the
  ledger names, player or not (key `(workspace_id, github_login)`, the login lower-cased; `level` 0
  before the first point; `computed_at`). The game workflow rewrites every row at each poll
  (`pnpm game:xp`): the rules live in JavaScript, never in SQL, and `unlocked` only ever grows.
- `arcade_scores`: each player's best at each arcade game, key `(workspace_id, user_id, game)`,
  with `best` (0 to 9,999,999) and `at`, when it was set. It hangs off the player row, so a player's
  scores go with it when they leave the workspace. Nobody writes it directly.
- `submit_score(workspace, game, score)`, security definer, is the only way a score goes in. It
  refuses a caller with no player row in the workspace (a visitor, a member of another workspace,
  anyone signed out), a game their `player_xp.unlocked` does not hold, and a score outside
  0..9,999,999. It keeps the higher of the stored best and the score, and returns the best as
  stored.
- `contributions` (PRD 328): who authored each pull request merged into a sector repository's
  default branch (`kind` `pr-merged`, `at` when it merged) and who opened each `omni:prd` issue
  (`prd-opened`, `at` when it was opened), key `(workspace_id, kind, repo, number)`, with the
  author's `login` in lower case. The game workflow upserts the last 40 days at each poll
  (`pnpm game:contributions`); `/app`'s week and PRDs created read it. It is not the ledger: a row
  can be rewritten or deleted and the table dropped, and it rebuilds from GitHub within its window,
  so the backup leaves it out. A member reads their workspace's rows, and only the service role
  writes; `supabase/checks/contributions.sql` proves both on every pull request that touches
  `supabase/`.
- `dossiers` (PRD 216): one per PRD, keyed by `(workspace_id, home_repo, prd)`; `home_repo` is the
  repository whose issue the PRD is, `owner/name` in lower case, and `prd` is null while the dossier
  is a draft (`numbered_at` is set with it). Also its `title`, `opened_by` (null when the fallback
  created it), `claude_session_id` (the brainstorm's Claude Code session) and `created_at`.
- `dossier_versions`: every version of a dossier's artifacts, stored whole: `kind` (`spec`, `plan` or
  `before-after`), `content` (at most 512 KiB), its `sha256` (computed by the database, never taken
  from the request), `bytes`, `source` (`kit` or `github`), `uploaded_by` or the `commit_sha` and
  `git_blob` it was read at, and `created_at`. A version's number is its place among its kind's. A
  version is added only when its hash differs from the latest of its kind, and never edited.
- `dossier_open()` and `dossier_push()`, security definer, are the only way the signed-in write
  them: each checks the caller is a member of the workspace; the push finds the dossier (the draft
  named, else the one keyed by repository and PRD, else a new one), numbers a draft, merges it into a
  dossier the fallback already made, and adds versions through `dossier_add_version()`, the version
  rule the service role calls too. A member reads their workspace's dossiers and versions; the opener
  deletes their own draft, and nobody deletes a numbered dossier.
- `dossier_rounds(p_dossier)` and `dossier_list(p_dossier default null)`, security invoker, read the
  questions without copying them: the rounds of a dossier's brainstorm (its Claude session, from its
  opening to that session's next dossier) and of its delivery (its PRD number in its home
  repository), each with its rule; and each dossier with its repositories, its latest version of
  each kind, its question counts and its last activity. PRD 144's access rules decide what comes
  back. `supabase/checks/dossiers.sql` proves the dossiers' rules on every pull request that touches
  `supabase/`.
- `releases` (PRD 262): one row per shipped PRD, key `prd`, with its `release` number (shown as
  `0.0.<release>`; 1 is the initial release, shared, and every number above 1 is one PRD's own, a
  partial unique index), `released_at` (when its shipped folder first reached `main`), and its note's
  `title` and `description` (empty while it has no note). It belongs to no workspace: **anyone reads
  it**, signed in or not, for `/releases`. Only the service role writes it, through the sync: it adds
  rows and updates `title` and `description` only (column grants), and nobody deletes a row but a
  person in the database. `supabase/checks/releases.sql` proves both on every pull request that
  touches `supabase/` ([Release notes](#release-notes)).
- `outbox_sends` (PRD 251): each reply the Outbox tab posts as a person (`dossier_id`, `pr_number`,
  `reply`, the nonce's hash, then `posted_at`, `comment_url`, `login`, `counted` or `error`). Its
  owner, a member of the dossier's workspace, inserts it and reads it, and records its outcome once
  through `outbox_send_done()`. Nobody else reads it, nobody updates it otherwise, and nobody
  deletes it. The outbox itself is never stored: the page reads it from GitHub (ADR-0052).
  `supabase/checks/outbox_sends.sql` proves these rules in the `supabase` workflow.
- Row-level security, by membership (`is_member(workspace)`): a member reads their workspaces,
  their own memberships, and their workspace's sectors, fleets, players, ledger, XP, high scores
  and contributions, and nothing of any other workspace. A member with GitHub linked inserts their
  own player row there, and updates only its name, fleet and hero (column grants). Anonymous
  visitors read nothing but `releases`, fleets included. The service role reads everything, appends
  to the ledger, and writes workspaces, memberships, sectors, fleets, `player_xp` and
  `contributions`, and adds releases.
- Explicit grants: Supabase projects created since 2026-05-30 no longer grant the API roles access
  to new tables. The local stack matches (`auto_expose_new_tables = false`), so a table added
  without its grants fails locally and in the pull request check, not in production. The
  workspaces migration, and the game room's two after it, also revoke every grant before they
  grant, so a project that still grants new tables by default ends up the same.
- `supabase/checks/access.sql` proves all of this on every pull request that touches `supabase/`,
  with a second workspace beside Vertuoza.

## Known limits

- **Sealed zones are invisible.** The ledger records a zone from the moment it opens, so a planet
  shows the zones that have opened so far, not the whole plan.
- **The map fits one screen.** About eight planets per sector stay legible; beyond that the planets
  shrink. A scrolling map comes when the galaxy needs it.
- **A system fits one screen.** Past about 150 entries in one domain on the Game Boy held upright,
  worlds reach their smallest size and start to touch; paging comes when a knowledge base needs it.
  The star chart shows this repository's knowledge only; `/knowledge`'s repository menu reads the
  others, and the arcade charting them is later work.
- **An iPhone keeps Safari's bars.** iPhone Safari offers web pages neither fullscreen nor
  vibration, so the Game Boy shows under the address bar and a press makes no buzz. A device that
  misreports its primary pointer gets the other form; the keyboard and taps work in both.
- **A renamed GitHub account** keeps its old login in `players.github_login` (the spec lists refreshing it
  from `github_id` as later work).
- **A score is what the browser sends.** `submit_score()` checks that the game is unlocked and holds
  the score to 0..9,999,999, but replays nothing, so a player could post any score up to the cap.
  A score is a bragging right on its cabinet and never earns points or XP.
