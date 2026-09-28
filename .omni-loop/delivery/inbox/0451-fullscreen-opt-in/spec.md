---
prd: 451
title: Fullscreen is opt-in on desktop
blocked-by: none
spec: file
---

# Fullscreen is opt-in on desktop

**Date:** 2026-09-28 · **PRD:** #451 · **Touches:** the arcade's fullscreen rule
(`apps/galaxy/src/arcade/fullscreen.ts`), the arcade's root (`ArcadeApp.tsx`), its shell styles
(`shell.css`) and the fullscreen paragraph of `apps/galaxy/README.md`. No migration, no change to
the kit or to the GitHub App.

## Problem

The arcade asks the browser for fullscreen on the first key press, click or touch press of every
page load (`fullscreen.ts`). On a phone that is welcome: it hides the address bar and the Game Boy
fills the screen. On desktop it is annoying: a player who clicks once to look at the galaxy loses
their tabs and address bar, and must press Esc to get them back, on every page load. There is no
visible way to choose fullscreen; only F, which nothing on screen names.

## Solution

### 1. The rule asks on its own only on a phone

The fullscreen rule learns the arcade's form (`full`, `handheld` or `advance`, from `form.ts`).

- On `full` (a fine pointer: desktop), no press asks for fullscreen on its own: not the first key,
  not the first click, not the first touch press.
- On `handheld` and `advance` (touch: the Game Boy bodies), nothing changes: the first press of a
  page load asks, and once the player has left, the next press does not ask again.
- In every form, **F** still enters and leaves fullscreen (except on the name screen, where F types
  an F), and the Esc that leaves fullscreen is still never also B.
- A new press, `toggle`, is what the button sends: it enters fullscreen when off and leaves it when
  on, and the game never reads it.

### 2. A dim ⛶ button in the page's corner, on desktop only

On the `full` form, a small button with the ⛶ glyph sits in the bottom-right corner of the page,
outside the screen.

- It is dim (about 40% opacity) and turns fully opaque on hover and on keyboard focus.
- Its accessible name and its tooltip are "Full screen (F)".
- A mouse press on it takes no focus (as the key hints do), so Enter and Space keep meaning START
  and A afterwards.
- It is hidden while the page is fullscreen (Esc or F leave it), and never shown where the browser
  cannot go fullscreen (`document.fullscreenEnabled` false: an iframe without the permission).
- It is not drawn on `handheld` or `advance`.

## Decisions

- Desktop only: phones keep the first-press request, because there fullscreen is what makes the
  Game Boy fill the screen, and the complaint is about desktop.
- F is kept as the keyboard way in, and the button's tooltip names it.
- The button leaves the page's layout alone: it is positioned fixed over the page's corner, not a
  new row under the screen.
- The button hides while fullscreen rather than turning into an "exit" button: the browser already
  says how to leave (Esc), and F leaves too.

## User stories

- As a desktop player, I open the arcade and click around, and my browser window stays as it is.
- As a desktop player who wants the console feel, I see a small ⛶ in the corner, click it (or press
  F), and the arcade goes fullscreen; Esc brings me back, and the ⛶ shows again.
- As a phone player, my first tap still takes the Game Boy fullscreen, as today.

## Scope

In: the fullscreen rule and its tests, the button on the `full` form, its style, the README's
fullscreen paragraph.

Out: any change on the Game Boy bodies (no button there), remembering the choice across page
loads, fullscreen outside the arcade (the app pages, the dossier page).

## Test seams

Following `omni kb show testing`: tests live beside the code as `*.test.ts` and run with
`pnpm test`; none calls GitHub or Supabase.

- **The rule** (`fullscreen.test.ts`, through `fullscreenFor` with a fake page and clock): the
  form is an input of the press, so each case below is a unit test of the pure rule.
- **The button**: a component test of the button (or the piece of `ArcadeApp` that renders it) for
  its three states: shown on `full` when fullscreen is allowed and off; hidden while fullscreen;
  absent on `handheld` and `advance` and where fullscreen is not allowed. Clicking it sends one
  `toggle`.
- A manual browser check on desktop: open the arcade, click and press keys, the window stays; the
  ⛶ enters fullscreen; Esc leaves and the ⛶ comes back. The look (dim, bottom-right, not covering
  the screen) is checked by eye.

## Risks

Merging publishes a change to the galaxy arcade only (a Vercel project imported from this
repository, per `omni kb show releasing`); no database migration and no kit or plugin change.
Rollback is a revert of the feature PR. The risk is small: a desktop player who liked the automatic
fullscreen now has to press F or the button once.

## Acceptance criteria

1. On desktop (the `full` form), the first key press, click or touch press of a page load does not
   ask the browser for fullscreen, nor does any later press other than F or the button.
2. On `handheld` and `advance`, the first press of a page load still asks for fullscreen, and after
   the player leaves, the next press does not ask again (unchanged).
3. F still toggles fullscreen in every form except on the name screen, and the Esc that leaves
   fullscreen is still never also B (the existing tests still pass).
4. On desktop, a ⛶ button named "Full screen (F)" shows in the bottom-right corner of the page,
   outside the screen, dim until hovered or focused.
5. Clicking the button enters fullscreen; while fullscreen, the button is hidden; after leaving, it
   shows again.
6. The button does not render on `handheld` or `advance`, nor where `document.fullscreenEnabled` is
   false.
7. After clicking the button with the mouse, Enter and Space still act as START and A (the button
   takes no focus on a mouse press).
8. `apps/galaxy/README.md`'s fullscreen paragraph says the above.
