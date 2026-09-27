# OMNI LOOP — the galaxy arcade

The web UI of the game layer: a retro arcade that shows the galaxy. Every PRD is a planet,
every slice a zone, every open question or bug an Entropy unit on its surface. Signing in with a
`@vertuoza.com` Google account makes you a member of the `vertuoza` workspace and a **visitor**:
you may look at its galaxy. Linking your GitHub account, once, makes you a **player**: you pick a
fleet, enter a name and build a hero, and your pull requests score for that fleet. Every point also
counts as XP, which never resets, and levels open arcade games in the game room, the first of them
Entropy Invaders ([The game room](#the-game-room)). All from the keyboard on a computer, and from a
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
  (beaver, octopod, picsou, cia, pirate; the retired invincible), Entropy (24×24) recoloured per
  wound kind, 16×16 icons.
- Every player's hero is the OmniMan body (a girl or a boy, 32×48) recoloured: skin, hair, suit and
  cape are ramp swaps on one material each (`packages/design/src/heroes.mjs`). A fleet without a
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
| Boot → Title | "OMNI LOOP presents" and the Omni Loop crest, then an attract loop: the crest, the story, the top five heroes (signed in). A member sees their workspace's name, letter and colours (a Vertuoza member, "VERTUOZA presents" and the V); signed out, in demo mode, closed and in the artifact, the house brand, Omni Loop |
| Insert coin | Sign in with the Vertuoza Google account; any other domain is refused and says why, and a signed-in account that belongs to no workspace gets the "wrong cartridge" screen |
| Press start | After coming back from Google: browsers play sound only after a key press |
| Link GitHub | Before playing, once: points are earned under the GitHub login, which only the linked identity sets. B visits only |
| Intro | First visit only, 20 s, skippable: OmniMan rises, three lines type in, the fleets flash in |
| Select your fleet | The fleets from `public.teams`, each with its own motif; A locks in with a fanfare. Also CHANGE FLEET, with a confirmation of where the points go |
| Enter your name | Up to 10 characters, typed or spun on a letter wheel, pre-filled from the Google first name |
| Build your hero | Girl or boy, skin, hair, suit (the fleet colour first) and cape; TAB for random |
| Ready / Welcome back | The launch after a first visit; a two-second welcome for returning players |
| Level up | Before the menu, once per new level on this device: LEVEL UP! with a fanfare, the hero at 2× and the new XP bar, and NEW GAME UNLOCKED when a level climbed opened a game (A plays it at once, B goes on to the menu) |
| Select mode | PLAY (visitors: links GitHub), Galaxy map, Star chart, Fleets, Hall of Heroes, Games, How to play, then My hero and Change fleet (players), APP MODE (leaves the game for the app, after OPEN THE APP?), Sign out. A player's badge shows their level |
| Galaxy map | Sectors as nebulae; planets by state, threat and wounds; red hyperlanes from a locked planet to its blockers; distress pulses |
| Planet | The planet with its Entropy in orbit and the fleets on station; tabs for status, zones by phase, Entropy (age, decay, bounty) and the event log |
| Star chart | The knowledge base as space: a sun per domain, sized by the entries it holds, and a dotted lane for each cross-domain file ([The knowledge map](#the-knowledge-map)) |
| System | One domain as an orrery: its entries as worlds on still orbits, laws terraformed and proposed entries barren; the selected world's links, its panel, and the reading card |
| Fleets | A hero-select wall of the fleets with season points, streak, planets, crew (players by name) |
| Hall of Heroes | Season high-score table from `game/economy.mjs`, with each player's hero and name |
| Games | The game room: the player's level and XP bar, a cabinet per game (lit with the crew's top five, or dark with the level it opens at) and two SOON cabinets ([The game room](#the-game-room)) |
| Entropy Invaders | The first game: the player's own hero against a marching formation of alien Entropy, three lives, the score sent to the crew's table at game over |
| How to play | The scoring rules and LEVELS (what XP counts, the curve, the unlocks), read from `game/rulebook.mjs` so they never drift |

Deep links: `#map`, `#chart`, `#fleets`, `#heroes`, `#games`, `#briefing`, `#menu`, `#planet-2332`
(`src/arcade/deep-link.ts`). Each opens its screen past the boot and the title, and the address
follows the screen, so the menu reads `/#menu`: the game's home, where the app's Game mode lands.
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

Outside the arcade, the app (PRD 238): `/app`, its home, beside `/ask`, `/ask/for-me`, `/ask/history`
and `/knowledge`, all on the ask pages' reading surface, in light and dark. `/app` is a card per
section (`SECTIONS` in `src/switch/switch.ts`), each a link to its page; it reads nothing and opens
without signing in, and each page it opens signs the visitor in on its own. Every app page's header
links its `OMNI LOOP` mark to `/app` and ends with **Game mode**, which asks *Switch to game mode?*:
Switch opens `/#menu` in the same tab, and Stay, Esc or a click outside leaves the page as it was.

`/design` shows the design system, straight from `@omni/design`: every logo form, colour, type step,
sprite, pose and icon. It opens without signing in, and is not one of the app's pages.

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

**Fullscreen** (`src/arcade/fullscreen.ts`). The first key press, click or touch press of a page
load asks the browser for fullscreen, so the arcade runs like a console game with no tabs or
address bar.

- Esc leaves it and the scene stays: the Esc that leaves fullscreen is never also B. While
  fullscreen, B and X are the back keys; outside it, Esc still means B.
- Once the player has left, the next press does not ask again. **F** toggles fullscreen, in every
  form, except on the name screen, where F types an F. A new page load asks again on its first
  press.
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
- **The screen stays tappable**: key hints, menu rows, fleet cards, builder rows, planet tabs, the
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
                                                                 │  row-level security: a member reads their
                                                                 │  workspace, a player writes only their own row,
                                                                 │  and a score only through submit_score()
                                                                 ▼
             apps/galaxy (Next.js, per request, as the signed-in member, one workspace) ── buildGalaxy() ──▶ arcade (client)
                                                                 ▲
                              no Supabase configured ──▶ demo world → game/projector.mjs → events
```

`@omni/galaxy` (`packages/galaxy`) folds ledger events into the view. It never invents a number:
points and rankings come from `game/economy.mjs`, decay and threat weights from
`game/rulebook.mjs`, working hours from `game/calendar.mjs`, XP, levels and unlocks from
`game/experience.mjs` (the view's rules carry the rulebook's `xp` block, for How to play). The demo
galaxy is a fictional GitHub snapshot run through the real projector, so demo events are exactly
what `pnpm game:project` would append.

What the page reads is decided in `src/data/arcade.ts`, always with the visitor's own session, so
the database's policies decide what they see:

- **Signed out**, it reads nothing: the attract mode plays the built-in fleets (`demoFleets()`,
  Vertuoza's) under the house brand.
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
- **Crew means "has a workspace"**, never an email domain. A signed-in person who belongs to none
  yet is joined once by the page (`join_by_domain()`), so a session from before workspaces joins
  too; one who still belongs to none gets the "wrong cartridge" screen and reads nothing.
- **The database out of reach**: the attract mode, the built-in fleets, and "THE GALAXY IS OUT OF
  REACH". Nobody is turned away as an outsider when the page cannot tell.

`proxy.ts` refreshes the session before each render. `app/auth/callback` turns Google's and
GitHub's codes into that session and, after every sign-in, calls `join_by_domain()`, then, after a
GitHub link, `link_github()` (`src/data/sign-in.ts`). The terminal's sign-in (`omni signin`, the
callback's `next=ask-cli` branch) joins the same way before its one-time code is issued.

Nobody gets past INSERT COIN without signing in: the title asks for a coin until there is a
session, and every screen beyond it requires one (`allowed()` in `src/arcade/onboarding.ts`). A
game and the level-up also need GitHub linked: XP is earned under the GitHub login.

Without the Supabase variables, the app picks its mode in `src/data/mode.ts`:

- **Development** (`pnpm galaxy:dev`), or a build with `OMNI_LOOP_DEMO=1`: the demo galaxy, with
  sign-in and GitHub simulated and the player kept in the browser's storage
  (`src/arcade/account-demo.ts`). The guest borrows the XP of the demo world's highest-XP
  contributor, computed from the demo events by `experience()` (`demoXp()` in `src/data/xp.ts`), so
  the game room, the level-up and the game all show; their best scores stay in the browser's
  storage, the only line of the demo's crew table. The single-file artifact plays the same way.
- **Any other build** (a Vercel deployment missing its variables, say): **closed**. The attract mode
  plays, and INSERT COIN says sign-in is not open yet. No simulated sign-in, and no galaxy data.

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
in their light and dark themes: the top bar (`OMNI LOOP · Knowledge map`, the repository, a link to
the star chart at `/#chart`, the theme switch, Game mode), a tab per domain and **Between domains**
for the cross-domain entries, an SVG orrery laid out as in the arcade (a law a filled dot, a proposed entry
a hollow ring, each kind in its own colour), the selected entry's detail (statement, `Why:`, what it
serves and what serves it, what it cites, its PRD, how it is enforced, its file), and the index of
the domain grouped by principle, with its loose entries and unserved principles and a filter. A
selection is kept in the address, `/knowledge?domain=<name>&entry=<id>`, so a link to one entry can
be shared. On a phone the page stacks and scrolls down, never sideways.

**Where the data comes from.** The knowledge of the checkout the app is deployed from, read on the
server at request time through the kit's own register parser (`src/data/load-knowledge.ts`): no
Supabase table, no GitHub call. `next.config.mjs` traces the config and the register files into the
deployment, since nothing imports them. When they cannot be read, the loader logs why, both maps say
the knowledge is out of reach, and nothing else in the arcade changes.

**Who sees it.** Whoever sees the galaxy: a crew member (a member of a workspace) signed in, or the
demo in development. Anyone else's page carries no entry: in the arcade STAR CHART reads
`OUT OF REACH` and does not open (`app/page.tsx` hands the graph to the crew and the demo only);
`/knowledge` shows the sign-in card signed out, and a crew-only notice to an account in no workspace;
a build that is neither says the map is not open here. The single-file artifact never embeds a
knowledge base: its star chart reads `NO STAR CHART IN THIS BUILD`.

## The game room

Every point a player earns by delivering also counts as XP, and XP never resets: a new season
starts the Hall of Heroes again, never a level (PRD 160). The rules (what XP counts, the curve, the
cap and the level each game opens at) are the `xp` block of `game/rulebook.mjs`, applied by
`game/experience.mjs` ([`game/README.md` › XP, levels and unlocks](../../game/README.md#xp-levels-and-unlocks)).
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
  highlighted, and A · PLAY; a locked one is dark and shows the level it opens at; two dark SOON
  cabinets stand for the games to come, with no level. A visitor sees every cabinet locked and
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

## Run it locally

From the repository root:

```bash
pnpm install
pnpm galaxy:dev          # http://localhost:3000, demo galaxy (no Supabase needed)
```

### With a local Supabase

Needs Docker and the Supabase CLI (`npx supabase`).

```bash
npx supabase start       # applies supabase/migrations and loads supabase/seed.sql (the demo galaxy, in the vertuoza workspace)
npx supabase status      # prints the API URL, the anon key and the service_role key
cp apps/galaxy/.env.example apps/galaxy/.env.local   # paste the URL and both keys
pnpm galaxy:dev          # now reads from Supabase: the menu shows "SUPABASE LEDGER"
```

Signing in locally needs the Google and GitHub OAuth clients: export
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`,
`SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`, set `enabled =
true` on both providers in `supabase/config.toml`, and restart the stack. Both clients must accept
`http://127.0.0.1:54321/auth/v1/callback`. Without them, work on the demo galaxy instead.

`pnpm galaxy:seed` regenerates `supabase/seed.sql` from the demo world, dated now, in the `vertuoza`
workspace the migrations create.

### Screenshots of every scene

`pnpm galaxy:shots` walks the demo galaxy from the keyboard in a headless Chromium, from the boot
through the joining flow and the level-up (the demo guest's borrowed level, new in that browser) to
every screen of the menu, and saves a screenshot of each scene (the title's three phases, OPEN THE
APP? over the menu, the planet's four tabs, a system's reading card, and Entropy Invaders' score
table, play and pause each on their own; the star chart shows this checkout's knowledge) at three sizes: 393×700 upright
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
- A dev server on another port: `GALAXY_URL=http://localhost:3001/ pnpm galaxy:shots`.

## Deploy to production

Supabase holds the game's data and is its source of truth; GitHub Actions migrates it and appends
to the ledger, and Vercel serves the arcade from it:

```
supabase workflow ── supabase db push, on merge to main ──┐
                                                          ├──▶ Supabase, Central EU (Frankfurt)
game workflow ─ game:project + game:xp, every 15 minutes ──┘         │  the player's own session
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
   - Hooks: **Before User Created** → Postgres function `public.hook_before_user_created`. It
     refuses an address whose domain no workspace joins (`workspaces.join_domain`: today,
     `vertuoza.com` only), with a message that names no company. Keep the function's name: the
     setting points at it. The database policies refuse anyone who is not a member anyway.

### 5. Create the Vercel project

1. Add New › Project, import `vertuoza/vertuo-omni-loop`, and set **Root Directory** to
   `apps/galaxy`. Vercel detects the pnpm workspace and installs from the root. Keep "Include files
   outside the Root Directory" on (the app imports `game/` and `packages/`). Framework and region
   come from `vercel.json`.
2. Environment variables, for Production and Preview: `NEXT_PUBLIC_SUPABASE_URL` =
   `https://<ref>.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the publishable key. Do not add
   the secret key. `NEXT_PUBLIC_*` values are inlined at build time: redeploy after changing them.
   Without them the deployment stays closed (nobody can enter); it never falls back to the demo.
   Optionally `OPENROUTER_API_KEY`, an [OpenRouter](https://openrouter.ai) key, server only: ask mode
   then sorts each question into one of six categories (business, product, UX/UI, architecture,
   harness, other) a moment after it is asked. Without it, questions stay unsorted and nothing fails;
   anyone in the workspace can still sort them on the page.
3. Deploy. The page renders per request with the visitor's session. If Supabase cannot be read, the
   arcade still plays its attract mode and says the galaxy is out of reach.

### 6. Fill the galaxy

Invite the crew to join (sign in, link GitHub, pick a fleet). The real sectors are in a migration
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

## Share it without a server

```bash
pnpm galaxy:artifact     # apps/galaxy/artifact/dist/omni-loop.html
```

One self-contained HTML page (React from cdnjs, everything else inlined) that plays the demo galaxy,
joining flow included, and the game room: the guest borrows the demo world's highest XP and plays
Entropy Invaders, its best scores kept in that browser. It inlines the two pixel faces from
`@omni/design`; the display and body roles fall back to system faces there, to keep the page small.
It carries no knowledge base: its star chart reads `NO STAR CHART IN THIS BUILD`.

## Database

`supabase/migrations/`. Everything the game holds belongs to a **workspace**, and a person reaches
a workspace by being a **member** of it. Vertuoza is workspace #1.

- `workspaces`: `slug` (`vertuoza`), `name` (`Vertuoza`), `github_org` and `plan_repo` (the
  organisation the projector reads and the repository that carries the PRD issues), `join_domain`
  (`vertuoza.com`) and `theme`. The theme holds only the overrides of the arcade's colour tokens,
  e.g. `{"plasma": "#2fc6a4"}`; `valid_theme()` refuses anything but an object of known tokens
  with lowercase `#rrggbb` values. Vertuoza's is `{}`. The tokens are listed under
  [A workspace's look](#a-workspaces-look).
- `workspace_members`: who belongs where (`role` is `owner` or `member`, `joined_at`). A person may
  belong to several workspaces. `join_by_domain()`, called at sign-in, adds the caller to every
  workspace whose `join_domain` is the domain of their **confirmed** email, adds nothing twice, and
  returns the slugs of their workspaces, the one joined first first.
- `ledger_events` mirrors the event contract (`game/events.mjs`) one to one, with the same type
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
- Row-level security, by membership (`is_member(workspace)`): a member reads their workspaces,
  their own memberships, and their workspace's sectors, fleets, players, ledger, XP and high
  scores, and nothing of any other workspace. A member with GitHub linked inserts their own player
  row there, and updates only its name, fleet and hero (column grants). Anonymous visitors read
  nothing, fleets included. The service role reads everything, appends to the ledger, and writes
  workspaces, memberships, sectors, fleets and `player_xp`.
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
  The star chart shows this repository's knowledge only; each sector's repositories' is later work.
- **An iPhone keeps Safari's bars.** iPhone Safari offers web pages neither fullscreen nor
  vibration, so the Game Boy shows under the address bar and a press makes no buzz. A device that
  misreports its primary pointer gets the other form; the keyboard and taps work in both.
- **A renamed GitHub account** keeps its old login in `players.github_login` (the spec lists refreshing it
  from `github_id` as later work).
- **A score is what the browser sends.** `submit_score()` checks that the game is unlocked and holds
  the score to 0..9,999,999, but replays nothing, so a player could post any score up to the cap.
  A score is a bragging right on its cabinet and never earns points or XP.
