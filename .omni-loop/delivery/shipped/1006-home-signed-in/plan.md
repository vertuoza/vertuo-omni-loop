# Plan: the home page shows who is signed in

PRD #1006 is specified in `spec.md`, next to this plan. The feature branch `feat/home-signed-in`
merges into `main` through the feature PR (`Closes #1006`). Each slice is a sub-PR from
`feat/home-signed-in--<slice>` into the feature branch (`Part of #1006`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A signed-in visitor sees, in both sign-up slots, the signed-in pill: their GitHub photo, or their initial, beside CONTINUE YOUR GAME, a link to /play. The pure decision lives in `signed-in.ts`, the browser's session read sits behind a port in `session-read.ts`, the `SignedIn` pill is drawn by `Controls` through a portal into each slot, and its CSS is in `home.css` | `apps/galaxy/src/home/signed-in` `apps/galaxy/src/home/session-read` `apps/galaxy/src/home/SignedIn` `apps/galaxy/src/home/Controls.tsx` `apps/galaxy/src/home/home.css` | — | 1 |
| s2 | No flash: the pre-paint cookie check marks `<main class="home">` `data-session="pending"` while a Supabase auth cookie exists, CSS holds each SIGN UP WITH GITHUB button's box hidden while the mark is set, and `Controls` settles the mark: `in` on a session, removed on none, an error, the demo or 3 seconds without an answer | `apps/galaxy/src/home/session-mark` `apps/galaxy/src/home/Home.tsx` `apps/galaxy/src/home/Controls.tsx` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/home.test.ts` | s1 | 2 |
| s3 | The hero comes first: once the workspace and player reads return, the pill's photo or initial is replaced by the player's hero, drawn through `faceOf` in the colour of the player's fleet, in the same order as the app bar | `apps/galaxy/src/home/signed-in` `apps/galaxy/src/home/session-read` | s1 | 2 |

**Shared ground.** s1 and s2 both declare `Controls.tsx` and `home.css`: s1 draws the pill there
and s2 settles the pending mark there, so s2 builds in wave 2, after s1 has merged. s1 and s3 both
declare `signed-in` and `session-read`: s3 adds the hero to the decision and the player read to the
port, so it also builds in wave 2. s2 and s3 share nothing. s3 leaves `Controls` unchanged,
because the pill already draws whatever face `signed-in.ts` returns, and s2 leaves both of s3's
files unchanged, so the two build side by side. `home.test.ts`, which guards that the server
render reaches no Supabase, belongs to s2 alone: s2 is the only slice that changes `Home.tsx`, the
markup that test reads. s1 and s3 only add what runs in the browser.

## Per slice: done when

**s1**

- `signed-in.test.ts` passes on fixtures: a null user gives null; a user with `avatar_url` gives a
  photo face; a user without one gives an initial, from the name and otherwise from the login.
- A rendered test of `SignedIn` shows the photo and initial forms and the label CONTINUE YOUR GAME.
  It shows an `href` of `/play` and the accessible name "Continue your game as <name>".
- With a session (a fake port), both the poster's and the order form's slots show the pill and not
  the SIGN UP WITH GITHUB button. With no session, a read error, or no Supabase (the demo), they
  show the button as today.
- No test calls Supabase. `pnpm test` is green.

**s2**

- `session-mark.test.ts` passes. `sb-abc-auth-token=…` and `sb-abc-auth-token.0=…` mark the page;
  a cookie string with no Supabase auth cookie, or with an unrelated `sb-` cookie, does not.
- A settle test with fake ports and fake timers: a session sets `data-session="in"`; null, an error
  or no Supabase removes the mark; 3 seconds without an answer removes it, and a late session still
  draws the pills.
- While the mark is `pending`, the SIGN UP WITH GITHUB button keeps its box and is not visible
  (`visibility: hidden`). With no mark, the page is today's.
- `home.test.ts` still proves that the server markup carries no pill and no `data-session` and
  reaches no Supabase. `pnpm test` is green.
- Manual browser path: signed in on the local galaxy, open `/`; both slots show the pill and nothing
  flashes. Signed out, the page is today's.

**s3**

- `signed-in.test.ts` gains three cases. A player with a hero gives a hero face drawn through
  `faceOf`, with the fleet's colour. A player whose hero is empty gives the photo. A player read
  that failed gives the photo.
- The session-read port's test, on fixtures, reads the workspace, then the player and fleets, in
  the order `viewerLive` reads them. It returns null on any failure.
- With a fake port that returns a hero, the pill first shows the photo, then the hero.
  `pnpm test` is green.
