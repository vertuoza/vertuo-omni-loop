---
prd: 932
title: Select your app at sign-in
blocked-by: none
spec: file
---

# Select your app at sign-in

**Date:** 2026-10-02 · **PRD:** #932
**Touches:**
- `packages/design/src/sprites.mjs` (and its `.d.mts`, its test, the README's table): two new
  sprites, `code-mark` and `arcade-cabinet`
- `apps/galaxy/src/home/selector/` (new): the SELECT YOUR APP overlay, its styles, and `choice.ts`
- `apps/galaxy/src/home/sign-up.ts`, `apps/galaxy/src/home/Controls.tsx`,
  `apps/galaxy/src/home/poster/Poster.tsx`, `apps/galaxy/src/home/home.css`
- `apps/galaxy/src/data/sign-in.ts` (the landing after sign-in), `apps/galaxy/app/auth/callback/route.ts`

## Problem

On HOME, **SIGN UP WITH GITHUB** (`apps/galaxy/src/home/poster/Poster.tsx`) always lands the person
on the Arcade, `/play` (`app/auth/callback/route.ts`). People who came for the delivery tool, the
board on `/app`, have to find the Arcade's APP MODE row to leave the game. Nothing on HOME says the
product has two apps, and nothing lets a person say which one they want.

## Solution

A click on SIGN UP WITH GITHUB opens a full-screen **SELECT YOUR APP** overlay, drawn as a
fighting-game character select, before the GitHub sign-in starts:

- Two lit pedestals side by side: **OMNI APP**, drawn as a sober `</>` sprite, and **ARCADE**, drawn
  as a pixel arcade cabinet (a *borne*: marquee, glowing screen, joystick, buttons).
- A blinking **▼ P1** cursor over the selected one, which starts on **OMNI APP**, and a stat bar
  under it: `FOCUS ████████` for the Omni app, `FUN ████████` for the Arcade, with one line saying
  what each opens (the board, PRDs and the outbox; the galaxy game).
- Under both, in the middle, a **REMEMBER MY CHOICE** toggle, off every time the overlay opens.
- A click on a pedestal picks it, and so does Enter on the selected one. ← and → move the cursor,
  Tab moves between the pedestals and the toggle, and Esc closes the overlay without signing in.

The pick rides through the sign-in: the Omni app adds `next=app` to the callback address, and the
callback then lands the person on `/app`. The Arcade adds nothing, so it lands on `/play` as today.
When the toggle was on, the pick is saved in this browser under `omni-loop:app-choice`. A later
click on SIGN UP WITH GITHUB then skips the overlay and goes straight to GitHub with that pick. Under
the button, a small line says where it opens, `Opens the Omni app · change` or
`Opens the Arcade · change`. **change** clears the saved pick and opens the overlay.

HOME stays static. The overlay, the saved pick and the hint line are drawn in the browser, by the
client code that already answers the button (`Controls.tsx`).

## Decisions

- **The overlay comes before GitHub, not after.** The person picks, then signs in, and the callback
  lands them on the pick. Nothing shows a wrong page first, and the callback stays a redirect.
- **The saved pick lives in localStorage,** under `omni-loop:app-choice`, read and written in
  try/catch like `omni-loop:muted`. A browser that refuses storage still works: it shows the overlay
  every time.
- **REMEMBER MY CHOICE is a toggle, off by default,** armed before the pick. One click on a pedestal
  always goes, whether the toggle is on or not.
- **The way back is visible:** the hint line's **change**, under the button. There is no hidden
  shortcut.
- **The direction is the character select** (chosen over a split screen and two cards). The `</>`
  sprite is the serious one: two tones, cyan on slate, no face and no animation. All the play is on
  the cabinet.
- **The cursor starts on OMNI APP.** This settles the voice's objection: *persona:B-E DEv*
  objected, "A fighting-game screen between me and my board is exactly the fluff I expected: give me
  a one-keystroke way past it, and never show it to me twice." That was **accepted**: Enter alone
  opens the board, and the saved pick never shows the overlay again.
- **The landing is allowlisted.** A pure function in `src/data/sign-in.ts` turns `next` into a path:
  `app` gives `/app`, and anything else gives `/play`. The callback never redirects to a value
  taken from the address. `link` and `ask-cli` keep their own flows. Someone in no workspace still
  goes to `/signup`, and a failed sign-in still returns to `/play?signin_error=…`.
- **Without Supabase** (the demo), a pick goes straight to `/app` or `/play`, as SIGN UP WITH GITHUB
  goes to `/play` today.

## User stories

- As a developer who came for the board, I click SIGN UP WITH GITHUB, press Enter, sign in, and land
  on `/app`.
- As a player, I pick the ARCADE cabinet and land on `/play`, as today.
- As a returning visitor who turned on REMEMBER MY CHOICE, I click SIGN UP WITH GITHUB and go
  straight to GitHub, and I can read under the button where it will open.
- As someone who changed their mind, I click **change** and get the overlay back.

## Scope

In:
- the two sprites in `@omni/design`, with their test;
- the overlay, the toggle, keyboard and focus handling, and reduced motion;
- the saved pick and the hint line;
- `next=app` through the sign-up and the callback's allowlisted landing.

Out:
- the Arcade's own SELECT MODE screen and its APP MODE row, which are unchanged;
- the app's own sign-in card (`app/app/callback`), and the CLI sign-in (`next=ask-cli`);
- people who are already signed in arriving on HOME (no auto-redirect from HOME);
- any server-side storage of the pick.

## Test seams

Vitest, beside the code (`*.test.ts` under `apps/galaxy/src/`, `*.test.mjs` under
`packages/design/src/`). Every test runs without a DOM and without GitHub or Supabase, through the
ports these modules already take (`SignUpPorts`, a storage port like `StartPorts`).

- `selector/choice.test.ts` covers `choice.ts`:
  - reading, saving and clearing the pick;
  - a stored value that is not `app` or `arcade` reads as no pick;
  - storage that throws reads as no pick and saves nothing, without throwing;
  - the hint line's words for each pick.
- The selector's state as a pure reducer (`selector/state.ts`):
  - the cursor starts on `app`;
  - ← and → move it and wrap around;
  - the toggle starts off;
  - picking with the toggle on returns save-and-go, and with it off returns go only.
- `sign-up.test.ts` (extended):
  - an Omni app pick puts `next=app` on the callback address;
  - an Arcade pick adds nothing;
  - without Supabase, the pick goes to `/app` or to `/play`.
- `src/data/sign-in.test.ts` (extended) covers the landing function: `app` gives `/app`; `null`,
  `arcade`, `link` and any other string, including `//evil.example` and `https://…`, give `/play`.
- `packages/design/src/sprites.test.mjs` (extended): `code-mark` and `arcade-cabinet` exist, have
  two frames each of the declared size, use only palette colours, and `code-mark` has at most two
  tones besides its outline.
- `src/home/poster/contrast.test.ts` (extended): every text colour the overlay sets reads at 4.5:1
  or better on its background.
- A manual browser path, for the visual risk: open HOME, open the overlay, move with the keys, pick
  each pedestal, turn the toggle on, then use **change**.

## Risks

- **What a merge publishes:** the galaxy's HOME and its sign-in callback, and `@omni/design`'s
  sprites. There is no migration and no kit change.
- **A broken callback would block every sign-in from HOME.** The landing change is one allowlisted
  function with its own test, and `ask-cli`, `link` and `/signup` keep their branches. Rollback is
  reverting the feature PR: without `next=app`, every sign-in lands on `/play`, as today.
- **A pick saved by an older build:** an unknown value reads as no pick, so the overlay shows.
- **Overlay over the poster's PRESS START keys:** while the overlay is open, `Controls` lets it own
  the keyboard, so Enter picks instead of starting the game.

## Acceptance criteria

- Clicking SIGN UP WITH GITHUB on HOME with no saved pick opens the SELECT YOUR APP overlay. It shows
  OMNI APP with the `</>` sprite and ARCADE with the cabinet sprite, and the cursor is on OMNI APP.
- REMEMBER MY CHOICE is off each time the overlay opens.
- Pressing Enter at once starts the GitHub sign-in, and after it the person lands on `/app`.
- Picking ARCADE starts the sign-in, and after it the person lands on `/play`.
- ← and → move the cursor between the pedestals. Esc closes the overlay and starts no sign-in.
- With the toggle on, a pick is saved. The next click on SIGN UP WITH GITHUB starts the sign-in with
  no overlay, and the line under the button names the saved app.
- Clicking **change** clears the saved pick and opens the overlay.
- The callback never lands on a path other than `/app`, `/play` or `/signup` because of `next`.
- When storage is unavailable, the overlay still works and nothing is saved.
- With reduced motion, the cursor does not blink and nothing on the overlay moves.
