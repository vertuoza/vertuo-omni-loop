# Bug 1014: CONTINUE YOUR GAME skips the SELECT YOUR APP picker

## Triage

- **Domain:** galaxy home page: sign-up and SELECT YOUR APP (PRD 932, PRD 1006)
- **Risk:** medium — signed-in visitors can no longer pick the Omni app from their main home-page button and always land in the Arcade; the workaround is PRESS START or typing /app (Jev, 0.98)
- **Regression:** yes — da1de7b1 `feat(galaxy): home page shows who is signed in (#1007)` swapped SIGN UP WITH GITHUB, which opens SELECT YOUR APP, for a plain link to /play

## Reproduction

- **File:** `apps/galaxy/src/home/SignedIn.test.ts`
- **Red:** AssertionError: expected '<a class="home-signed-in" href="/play…' to match /^<a [^>]*data-press-start=""/

## Fix

The signed-in pill was a plain link to /play, so a click left HOME without opening SELECT YOUR APP. The pill now carries the PRESS START mark, so `Controls` answers it as PRESS START: it opens the picker, or goes where a remembered pick says. Its href stays /play for a page without JavaScript.

## Guard

`apps/galaxy/src/home/press-start-guard.test.ts` reads HOME's components and fails on any element that links to the game (`href={PLAY}`, `href={PLAY_HREF}` or `"/play"`) without the PRESS START mark. It fails on main's `SignedIn.tsx` and passes on the fix.

## Mutation

not set here
