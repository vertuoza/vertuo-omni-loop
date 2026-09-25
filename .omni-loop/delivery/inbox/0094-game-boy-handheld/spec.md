---
prd: 94
title: A Game Boy on phones, the screen alone on desktop
blocked-by: none
spec: file
---

# A Game Boy on phones, the screen alone on desktop

**Date:** 2026-09-25 · **PRD:** #94 · **App:** `apps/galaxy` (the OMNI LOOP arcade) · **Changes:** the
arcade cabinet around the screen, on every device; the game itself does not change

## Problem

On a phone the arcade is close to unusable. The whole page is one arcade cabinet, built for a
landscape monitor, squeezed into a portrait phone:

- **The text is too small to read.** The screen is a fixed 640×360 grid, scaled to fit the width that
  is left. Measured in Chromium at 393×700 (an iPhone with Safari's bars), that is 361 / 640 ≈
  **0.56×**, so the 8px labels the screens use everywhere (hints, footers, stats) render at about
  **4.5px**. The bezel is then 24px wider than its slot and runs off both sides. The README already
  lists it as a known limit: "Tiny type on phones held upright".
- **Sideways is no better.** At 852×393 the screen still gets 0.56×, and it overlaps the marquee
  above it and the deck plates below it: the fitting never lets the screen go below 200px tall, and
  the marquee, the plates and the pad take 234px of the 393.
- **The controls do not fit.** The on-screen pad (`.pad` in `arcade.css`) fills its column with no
  room to spare, and the SELECT and START labels set its width: on the iPhone in the report, the A
  button is cut off at the right edge.
- **The controls do not feel like controls.** The D-pad is four 32px squares, below a comfortable
  thumb size, with no arrows on them. Every control fires on `click`, so on release, after the
  browser's tap handling. Holding a direction does nothing more than one tap does. A double tap can
  zoom the page.
- **Half the phone is empty.** The marquee, the gap above and below the screen, and a line that reads
  "TURN YOUR PHONE SIDEWAYS FOR THE FULL SCREEN" take the room the screen needs.
- **Phones cannot mute.** Sound toggles with the M key, and the plate that shows it is hidden on
  portrait phones.

On a computer the opposite holds: players have a keyboard, so the cabinet around the screen (the
marquee, the deck plates, the side art, the bezel) is decoration that keeps the screen smaller than
the window.

## Solution

The arcade picks one of three **forms** from the device, and draws each scene on one of two **grids**.
The game itself does not change: its state, what each action does, the joining flow, the accounts
and Supabase stay as they are. A form only picks the body around the screen and the grid inside it.

| Form | When | Body | Grid |
|---|---|---|---|
| `full` | The primary pointer is fine (a mouse or a trackpad) | None: the screen alone, filling the window | wide |
| `handheld` | Otherwise, with the viewport at least as tall as it is wide | A Game Boy, held upright | tall |
| `advance` | Otherwise, with the viewport wider than it is tall | A Game Boy Advance style wide body | wide |

- The **wide** grid is today's 640×360.
- The **tall** grid is 320×288: a Game Boy screen (160×144, 10:9) at 2×.

### `full`: the screen alone

The screen scales to fill the window at the largest size that keeps its 16:9 shape, fractions
allowed, centred, with `--void` bars on the two sides it does not reach. There is no frame, no
marquee, no deck plate, no side art and no on-screen pad: the keyboard is the controller, and the
key hints on the screens say what to press, as today.

The first key press or click of a page load also asks the browser for fullscreen, so the arcade
runs like a console game with no tabs or address bar. Browsers keep Esc for leaving fullscreen: the
Esc that leaves it never also counts as B. While fullscreen, B and X are the back keys; outside it,
Esc still means B. Once a player has left fullscreen, the arcade does not ask again on the next key.
F toggles fullscreen, except on the name screen, where F types an F. A new page load (after a
sign-in round trip, say) asks again on its first press.

### `handheld`: the Game Boy

The body fills the phone edge to edge, so the phone is the Game Boy. From top to bottom:

1. **The lens.** A dark navy bezel with the Game Boy's large rounded bottom-right corner. A stripe
   label across its top reads `OMNI LOOP · GALAXY COLOR`. On its left, a power LED, lit while sound is
   on. The tall screen sits inside, with the CRT lines it has today.
2. **The wordmark.** `OMNI LOOP` in the pixel face, with the season beside it.
3. **The controls.**
   - A D-pad cross on the left: 132px across, 44px arms, an arrow embossed on each arm.
   - A and B on the right, 60px each, on the diagonal (B low left, A high right), labelled under them.
     A is red (`--red`), B is plasma (`--plasma`), as today.
   - SELECT and START centred below, as angled pills with the label under each, each at least 44px
     tall to touch.
   - The speaker grille at the bottom right, labelled SOUND.

The body is galaxy purple, a gradient from `--plasma-dark` to `--plasma`. The controls keep their
size, and the lens takes the height that is left, so the screen shrinks on a short phone rather than
pushing a control off the screen. The notch, the Dynamic Island and the home indicator are kept
clear with the `env(safe-area-inset-*)` insets.

### `advance`: the Game Boy Advance body

The same parts, laid out wide: the D-pad on the left wing with SELECT and START under it, A and B on
the right wing with the grille under them, and the lens in the middle with the wide grid. It has no L
or R shoulder buttons: the game has no L or R action, and a button that does nothing would confuse.
The safe-area insets are kept clear on both sides.

### The controls

One set of controls serves both bodies. Each control sends the same action a key does (`up`, `down`,
`left`, `right`, `a`, `b`, `start`, `select`), through the same `act()`.

- **Fires on touch-down.** Controls act on `pointerdown`, not `click`.
- **The D-pad is one rocker.**
  - The direction comes from where the finger is relative to the cross's centre.
  - Less than 10px from the centre, in straight-line distance, is a dead zone: no direction.
  - Outside it, the axis with the larger offset wins, and a tie goes to the vertical axis. The game
    has no diagonals.
  - Sliding the finger to another arm without lifting fires the new direction at once. Sliding back
    into the dead zone stops without firing.
- **Hold to repeat.** A held direction fires once, again after 400 ms, then every 120 ms until it is
  released. A, B, START and SELECT fire once per press, never repeating, as with the keyboard.
- **Several fingers.** Each pointer is its own press: the D-pad and A can be held at the same time.
- **Feedback.**
  - A pressed part sinks and darkens.
  - Where the browser offers `navigator.vibrate`, each press buzzes for 10 ms. iPhone Safari has no web
    vibration, and stays silent.
  - The game's own move and select sounds play as they do today.
- **Sound.** Tapping the grille toggles sound, and the LED follows. It is the same setting M toggles,
  kept under the same `omni-loop:muted` key in the browser's storage.
- **The screen stays tappable.** Key hints ("[A] LINK GITHUB"), menu rows, fleet cards, builder rows,
  planet tabs and planets on the map keep working with a tap. The map's hit test uses the grid the
  screen is drawn on.
- **Nothing else moves.**
  - On `handheld` and `advance` the page never scrolls or zooms: no pinch, no double-tap zoom, no
    pull-to-refresh, no rubber band.
  - It never selects text or shows the long-press menu.
- **Fullscreen on touch.** The first press of a page load asks for fullscreen where the browser allows
  it (Chrome on Android, an iPad), which hides the browser's bars. iPhone Safari does not allow it for
  web pages, and keeps its bars. As on desktop, a player who leaves fullscreen is not pulled back
  until the next page load.
- **The keyboard still works** in every form: a Bluetooth keyboard on a tablet drives the Game Boy.

### Hints name the buttons you have

The arcade's rule is that the keys a screen shows are the keys to press. On `handheld` and `advance`,
the Game Boy's buttons are the keys:

| Hint today | On `handheld` and `advance` |
|---|---|
| ENTER | START |
| TAB, and "RANDOM (TAB)" | SELECT, and "RANDOM (SELECT)" |
| ⌫ ERASE | B ERASE |
| TYPE OR | dropped: there is no keyboard to type on |
| A, B, START, ▲▼, ◀▶ | unchanged |

On `full`, every hint stays as it is today.

### The tall grid, scene by scene

All 19 scenes get a tall layout: `boot`, `title` (its three phases: title, story, high scores),
`coin`, `away`, `outsider`, `gate`, `intro`, `select`, `name`, `hero`, `link`, `ready`, `welcome`,
`menu`, `map`, `planet` (its four tabs), `fleets`, `heroes`, `briefing`.

- A tall layout shows **the same information** as the wide one. It may rearrange it: stack what sits
  side by side, or split a long list into pages the D-pad turns. It drops nothing.
- **The smallest type** on the tall grid is 8 grid px in the pixel face (Press Start 2P) and 15 grid
  px in the text face (Jersey 10).
- **The canvas** draws a scene through `drawFrame` with the grid, and each scene's text layer is
  positioned per grid by a class on the screen element.

**Shell first.** The list of scenes that have a tall layout starts empty. A scene not on it is drawn
on the wide grid and letterboxed inside the Game Boy's lens, so the Game Boy ships with every scene
reachable, and each scene moves to the tall grid in its own slice. The PRD is done when all 19 are
on the list.

### Retiring the cabinet

The marquee, the deck plates (with the Vertuoza emblem), the side art, the bezel, the `.pad`
controller and the "turn your phone sideways" line are removed. `full` needs none of them, and the
two bodies bring their own. The arcade README's controls, screens and known limits follow.

## Decisions

1. **The pointer picks the form, not the screen size.** A fine primary pointer means a keyboard
   player (`full`); anything else is touch (`handheld` or `advance`, by orientation). Tablets are
   touch, so an iPad gets the Game Boy. A touchscreen laptop's primary pointer is its trackpad, so it
   gets `full`.
2. **Two grids, not a responsive screen.** Every scene is authored for exactly 640×360 or 320×288, so
   type and sprites stay on a pixel grid. There is no fluid layout inside the screen.
3. **The tall grid is 320×288.** It fills a 393px-wide phone at about 1.05×, which puts the arcade's
   type at its designed size. A 16:9 screen in a portrait phone cannot.
4. **Tall layouts drop nothing.** Everything a wide scene shows is reachable on its tall layout.
5. **Shell first, with a letterboxed fallback.** The bodies ship before the tall layouts, and no scene
   is ever unreachable while the layouts land.
6. **The controls fire on `pointerdown`.** The D-pad reads the finger's offset from its centre, with
   a dead zone under 10px, and a tie goes to the vertical axis.
7. **Hold to repeat is 400 ms, then every 120 ms,** for directions only.
8. **A 10 ms buzz where the browser offers one,** and silence where it does not.
9. **Sound toggles on the grille,** with the LED as its indicator, sharing M's saved setting.
10. **Hints name the pad buttons** on `handheld` and `advance`; `full` keeps the keyboard's.
11. **Fullscreen is asked on the first press of each page load, and never forced back.** F toggles it
    on `full`, except on the name screen. The Esc that leaves fullscreen is never also B. A refused
    request is ignored silently.
12. **`full` fills the window,** fractional scale allowed, letterboxed with `--void`.
13. **Galaxy purple.** The body goes from `--plasma-dark` to `--plasma`, with a navy lens, a red A and a
    plasma B. The screen stays in full colour, so fleet colours read.
14. **No Nintendo marks.** The shell's words are the arcade's own: `OMNI LOOP`, `GALAXY COLOR`,
    `SOUND`. No Nintendo name, logo or label text appears.
15. **No L or R buttons** on `advance`.
16. **The cabinet is retired** on every device.

## User stories

1. As a player who opens the arcade on a phone held upright, I hold a Game Boy: a screen I can read
   without zooming, and a D-pad, A, B, SELECT and START under my thumbs, all on screen.
2. As that player, I hold ▼ to run down a list, and slide my thumb from ◀ to ▲ without lifting it, as
   on a real D-pad.
3. As that player, I turn my phone sideways and get a Game Boy Advance, on the same screen and in the
   same place. Turning back is just as seamless.
4. As that player, I tap the speaker to mute the music on the train.
5. As a player on a computer, my first key press puts the galaxy fullscreen, and the screen fills my
   monitor with nothing around it.
6. As that player, I press Esc to get my browser back without leaving the screen I was on, and F to
   go fullscreen again.
7. As a player on an iPad, I get the Game Boy with a large screen.
8. As a player with a screen reader, the controls announce themselves as Up, Down, Left, Right,
   "A, confirm", "B, back", Select and Start, and the screen's text is still text.

## Scope

**In:**

- The three forms and `formFor()`.
- The two grids and `gridFor()`, with the letterboxed fallback.
- The `handheld` and `advance` bodies.
- The shared controls: `pointerdown`, the D-pad rocker, hold to repeat, several fingers, the buzz and
  the grille's sound toggle.
- Fullscreen on the first press, and F.
- The hint wording per form.
- Tall layouts for all 19 scenes.
- Retiring the cabinet.
- The arcade README.
- A screenshot script for the visual check: `apps/galaxy/scripts/shots.mjs`, run as
  `pnpm galaxy:shots`. It opens the demo galaxy in Playwright at the three sizes under **Test seams**,
  walks every scene, saves a screenshot of each, and reports any text in the screen that renders
  below 8 CSS px on `handheld`.

**Out:**

- **Installing to the home screen (a web app manifest).** Apps added to the iPhone home screen keep
  their own sign-in storage, and the Google and GitHub redirects are unreliable there. That needs its
  own PRD.
- **A four-shade green Game Boy palette:** it would erase the fleet colours.
- **L and R buttons.**
- **The phone's own keyboard for name entry.** The D-pad spins the letter wheel, as the joining
  design already says (design D8).
- **Any change to the game's rules, its data, sign-in, Supabase or the GitHub App.**
- **The single-file artifact's own build (`pnpm galaxy:artifact`).** It renders the same arcade, so
  it gets the forms, and a fullscreen request refused inside its iframe is ignored.

## Test seams

Unit tests are vitest files beside the code in `apps/galaxy/src/arcade/`, all pure, run by `pnpm test`.
No test calls Supabase or GitHub.

| Unit | What the tests pin |
|---|---|
| `formFor({ finePointer, width, height })` | A mouse gives `full` at every size. Touch at 393×852 and 820×1180 gives `handheld`; touch at 852×393 and 1180×820 gives `advance`. A square touch viewport gives `handheld` |
| The D-pad direction, from an offset `(dx, dy)`, y pointing down | Each arm; `(9, 0)` gives nothing and `(10, 0)` gives right; `(20, 20)` gives down (a tie); `(20, 19)` gives right |
| Hold to repeat, with fake timers | One press fires once, again at 400 ms, then every 120 ms. Release stops it. Changing direction restarts it. A, B, START and SELECT never repeat |
| The fullscreen rule | The first press asks. After the player leaves, the next press does not ask. F asks again. A new page load asks. A refusal leaves no error. F on the name screen types |
| The hint wording | Each hint on `handheld` and `advance` maps as the table in **Hints name the buttons you have**; `full` returns today's hint unchanged |
| `gridFor(form, scene)` | `full` and `advance` give wide. `handheld` gives tall for a listed scene, and wide letterboxed for any other. **In the final slice:** every `SceneName` is listed |
| The tall map layout | With the demo galaxy, every planet sits inside 320×288 with its radius, no two overlap, and `neighbour` reaches every planet from any planet |

The keyboard's table, `keys.test.ts`, passes unchanged.

**The visual check.** There is no component-test setup in this repository, so the look of each scene
is checked in a browser, as `omni kb show testing` asks for visual risk. `pnpm galaxy:shots` runs
against `pnpm galaxy:dev`, on the demo galaxy, at three sizes:

- 393×700 upright touch (an iPhone with Safari's bars)
- 852×393 sideways touch
- 1440×900 with a mouse

Each slice attaches the screenshots of the scenes it touches to its sub-PR. Each push runs
`pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build`.

## Risks

- **What a merge publishes.** The arcade is a Vercel project imported from this repository. The
  playbook's releasing form still asks whether a merge to `main` deploys it to production (a
  `TODO(human)` in `omni kb show releasing`). If it does, a merge changes the arcade for every player
  at once, on every device.
- **Rollback.** Revert the feature PR. The PRD changes no data, no schema, no stored shape and no
  shared contract. The one stored value it touches, `omni-loop:muted`, keeps its key and meaning.
- **Desktop players lose the cabinet.** This is deliberate (decision 16), and the first key press
  going fullscreen may surprise someone once. Esc gives the browser back at once.
- **Browsers differ.**
  - iPhone Safari has neither fullscreen nor vibration for web pages, so an iPhone keeps Safari's bars
    and presses make no buzz.
  - A device can misreport its primary pointer, which gives it the other form. The keyboard and taps
    work in both, so the arcade stays playable.
- **Two layouts per scene from now on.** Every new scene needs a wide and a tall layout. The
  completeness test in the final slice makes a missing one fail `pnpm test`.
- **Fractional scaling.** `full` and the lens scale by fractions, so some game pixels are one device
  pixel wider than others. It is the same trade-off the screen makes today.

## Acceptance criteria

1. **Desktop.** With a mouse at 1440×900:
   - The page shows only the screen, 1440×810, centred, with no marquee, deck plate, side art, bezel or
     pad.
   - The first key press asks for fullscreen.
   - In fullscreen, Esc leaves it and the scene does not change.
   - The next key press does not ask again, and F does.
2. **Upright.** With touch at 393×700:
   - The page shows the Game Boy.
   - The tall screen renders at 1.0× or more.
   - The D-pad, A, B, SELECT, START and the grille are all fully inside the viewport.
   - Each D-pad arm and each pill is at least 44px on its short side, and A and B are 60px.
3. **Sideways.** With touch at 852×393, the page shows the `advance` body with the wide screen between
   the wings, every control fully inside the viewport.
4. **Rotating.** Rotating between criteria 2 and 3 keeps the scene, the selection, the planet tab and
   the name being entered.
5. **Every scene is readable upright.** At 393×700 with touch, all 19 scenes (the title's three phases
   and the planet's four tabs included) are drawn on the tall grid. Each shows the same information
   as its wide layout. `pnpm galaxy:shots` reports no text in the screen below 8 CSS px.
6. **Hold to repeat.** Holding ▼ on the menu moves once, again after 400 ms, then every 120 ms, and
   stops on release. Holding A presses A once.
7. **The rocker.** Sliding a finger from ◀ to ▲ on the D-pad without lifting moves left, then up.
8. **Sound.** Tapping the grille mutes the sound and turns the LED off. Tapping it again brings both
   back. The setting survives a reload, and is the same one M toggles.
9. **Hints.** On `handheld` and `advance`, no hint names ENTER, TAB, ESC, ⌫ or TYPE. The name screen
   reads "B ERASE" and "START DONE", and the hero builder reads "RANDOM (SELECT)". On `full` the hints
   read as today.
10. **Nothing else moves.** On `handheld` and `advance`, swiping, pinching and double-tapping neither
    scroll nor zoom the page, and a long press selects no text.
11. **The keyboard.** Every key in `keys.ts` still works in every form, and `keys.test.ts` passes
    unchanged.
12. **Done.**
    - `pnpm test`, the arcade's `typecheck` and `pnpm galaxy:build` are green.
    - The arcade README describes the three forms and the controls.
    - The README no longer lists "Tiny type on phones held upright" as a known limit.
