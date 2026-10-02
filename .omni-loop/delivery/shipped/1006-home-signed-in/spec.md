---
prd: 1006
title: Home page shows who is signed in
blocked-by: none
spec: file
---

## Problem

HOME, the galaxy's front door at `/` (`apps/galaxy/src/home/Home.tsx`), is static: it reads no
cookie and no database, so it draws the same page for everyone. A person who is already signed in
therefore still sees **SIGN UP WITH GITHUB** twice, in the poster (`poster/Poster.tsx`, `SignUp`)
and in the order form (`spreads/OrderForm.tsx`). Nothing on the page tells them they are signed in,
and the one button that speaks to them asks them to do something they have already done.

## Solution

HOME stays static and the same for every visitor. Only in the browser, once the page is there,
`Controls` (`src/home/Controls.tsx`) reads the visitor's Supabase session with `createBrowserClient`,
as the Fleets and Ask pages already do. When there is a session, every sign-up slot (each element
carrying `HINT_SLOT_ATTR`) shows, in place of its SIGN UP WITH GITHUB button, a **signed-in pill**:
the visitor's avatar beside **CONTINUE YOUR GAME ▶**, a plain link to `/play`. `/play` already says
WELCOME BACK to a player and starts onboarding for a member who has no hero yet.

The avatar follows the app bar's order (`src/nav/UserMenu.tsx`): the visitor's **hero**, when they
have a player row in their workspace; otherwise their **GitHub photo** (`user_metadata.avatar_url`);
otherwise their **initial**. The photo or initial is drawn first, from the session alone. The hero
replaces it once the workspace and player reads return, and is drawn through `faceOf`
(`src/people/face.ts`) with the fleet's colour, as `viewerLive` draws it.

**No flash.** The page's first inline script (after the forwarding of old deep links) checks, before
anything paints, whether `document.cookie` holds a Supabase auth cookie (`sb-<ref>-auth-token`,
possibly chunked as `.0`, `.1`). When it does, it marks `<main class="home">` with
`data-session="pending"`. While that mark is set, CSS keeps each SIGN UP WITH GITHUB button's box
but hides it (`visibility: hidden`), so nothing jumps. `Controls` then settles the mark:

- a session read → `data-session="in"`, the pills are drawn and the buttons stay hidden;
- no session, a read error, the demo (no Supabase) → the mark is removed and the buttons show;
- no answer within 3 seconds → the mark is removed and the buttons show; a pill that arrives later
  still replaces them.

A visitor with no auth cookie never gets the mark: their page paints exactly as today.

The decision of what to draw lives in one pure unit, `src/home/signed-in.ts`: given the session's
user (or null) and the player read (hero and colour, or null), it returns the pill's data
(`{ name, face: hero | photo | initial }`) or null. `Controls` only reads, calls it and draws.

## Decisions

- **One label for everyone:** CONTINUE YOUR GAME, never START GAME or VIEW GAME. `/play` already
  tells a new member from a returning player, so the home page needs no player read to pick a label
  (the person chose this over a START/VIEW split and over a second OPEN THE APP button).
- **Hero first, then photo, then initial,** as the app bar draws it (the person chose this over the
  GitHub photo alone). The hero costs two reads from the browser (workspace, then player and fleets),
  which only signed-in visitors make.
- **The page stays static.** No cookie is read on the server and `app/page.tsx` stays prerendered;
  `home.test.ts`'s "reaches no Supabase at all" and "reading neither the session nor the arcade"
  stay true and green.
- **The voice's objection:** persona:F-E Developer objected that a swap after load would flash
  SIGN UP WITH GITHUB, then jump to the avatar. Settled `accepted`: the pre-paint cookie check holds
  the slot, keeping its size, until the session is known.
- **PRESS START stays** as it is, beside the pill.
- **The poster's quote stays:** "TO JOIN INSTANTLY, SIGN UP WITH GITHUB!" is static copy, left
  unchanged for everyone (see Scope).
- **No proof video** (the person said no).

## User stories

- As a signed-in player, I open the home page and see my hero and CONTINUE YOUR GAME where SIGN UP
  used to be, so I know I am signed in and get back to the game in one click.
- As a signed-in member with no hero yet, I see my GitHub photo and CONTINUE YOUR GAME, and the
  click takes me to the game's onboarding.
- As a visitor who has never signed in, I see the home page exactly as it is today.
- As a signed-in visitor on a slow connection, I never see SIGN UP flash and then jump into my
  avatar.

## Scope

In:

- the pre-paint cookie check and its `data-session` mark (`src/home/session-mark.ts`, inlined in
  `Home` next to the forwarding script);
- `src/home/signed-in.ts`, the pure decision, and the browser reads it needs (session, workspace,
  player, fleets) behind small ports so tests run on fixtures;
- the `SignedIn` pill, drawn by `Controls` through a portal into each sign-up slot, both slots;
- its CSS in `home.css` (avatar 28×28 pixel-edged, the pill on the home's existing tokens), and the
  hidden-but-sized rule for the pending mark.

Out:

- the poster's quote, and any other copy change on the signed-in home page;
- a sign-out or a user menu on the home page;
- the selector (SELECT YOUR APP) and the sign-up flow for signed-out visitors, unchanged;
- any server-side session read on `/`.

## Test seams

Vitest, beside the code, as `*.test.ts` under `apps/galaxy/src/home/`; no test calls Supabase
(`omni kb show testing`).

- `signed-in.test.ts`: null user → null; user with `avatar_url` → photo; user without one → initial
  from the name (then the login); a player with a hero → hero SVG through `faceOf`; a player whose
  hero is empty → photo; a player read that failed → photo.
- `session-mark.test.ts`: the cookie test on strings: `sb-abc-auth-token=…` and
  `sb-abc-auth-token.0=…` mark; no Supabase cookie, or an unrelated `sb-` cookie, does not.
- A rendered test (`renderToStaticMarkup`) of the pill: the avatar's three forms, the label, the
  `href` of `/play`, and an accessible name ("Continue your game as <name>").
- A test of the settling of the mark with fake ports and fake timers: session → `in`; null, an error
  or no Supabase → removed; 3 seconds without an answer → removed, then a late session still draws
  the pills.
- `home.test.ts` stays as it is: the server markup carries no pill and no `data-session`, and reaches
  no Supabase.

A manual browser path, as the playbook asks for visual risk: sign in on the local galaxy, open `/`,
and check that both slots show the pill and nothing flashes; sign out and check that the page is
today's.

## Risks

A merge ships `apps/galaxy`, deployed by Vercel from `main` (`omni kb show releasing`). Nothing
reaches the database: there is no migration and no stored shape.

- A signed-in visitor whose cookie is stale (expired, revoked) gets the pending mark and sees the
  button come back once the read fails: at worst a held space, never a missing button.
- A bug in the pending mark could hide SIGN UP WITH GITHUB for signed-out visitors. The 3-second
  release and the cookie-only trigger bound it; the settle test pins it.

Rollback: revert the feature PR's merge commit. HOME goes back to static markup only.

## Acceptance criteria

1. A visitor with no Supabase auth cookie sees HOME exactly as today: both SIGN UP WITH GITHUB
   buttons visible, no `data-session` mark, no pill.
2. A signed-in visitor sees, in both the poster's and the order form's sign-up slot, a pill with
   their avatar and CONTINUE YOUR GAME, and no SIGN UP WITH GITHUB button.
3. The pill is a link to `/play`, named "Continue your game as <name>" for screen readers.
4. A signed-in player with a hero sees their hero in the pill; a member with no hero sees their
   GitHub photo; a member with no photo sees their initial.
5. A signed-in visitor never sees SIGN UP WITH GITHUB painted before the pill: the slot keeps its
   size, empty, until the session is known.
6. When the session read fails, returns nothing, or takes longer than 3 seconds, SIGN UP WITH GITHUB
   shows as today.
7. On the demo (no Supabase configured), HOME is today's page.
8. The server render of `/` still reads no cookie and reaches no Supabase (`home.test.ts` green).
