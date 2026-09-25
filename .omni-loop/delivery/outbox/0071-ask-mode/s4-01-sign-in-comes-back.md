---
id: s4-01-sign-in-comes-back
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

A person who opens the page signed out must sign in and land back on the same questions, but the shared way back from the sign-in belongs to a later slice and always goes to the arcade. How should the page bring them back?

## The decision, in plain words

The page has its own way back from the Google sign-in: it returns the person to the same session, and shows why when the sign-in was refused. The arcade's sign-in is untouched.

## The intro, for fun

Stepping out to fetch your coat should not send you to the back of the queue.

## The punchline, for fun

So the page keeps its own coat check right by the door.

## The options, in plain words

A. The page has its own way back from the sign-in, straight to the same session, the option built.
B. Teach the shared way back to return to any page it is told, in the sign-in slice, and drop the page's own.
C. Finish the sign-in inside the page itself, which shows the signed-out card again for a moment on the way back.

## What I had to decide

s4's done-when: signed out, `/ask/<id>` shows a sign-in card, and after the sign-in it comes back to the same session. The galaxy's only sign-in return, `app/auth/callback`, always redirects to `/` (the arcade), and it belongs to s3, which adds its `?next=ask-cli` branch there; it is outside this slice's territory.

## What I did meanwhile

The sign-in card starts the galaxy's Google sign-in (Supabase Auth, `hd=vertuoza.com`) with `redirectTo` set to `/ask/<id>/callback`, a route under `app/ask/[session]/`. It exchanges the code for the session cookie and redirects to `/ask/<id>`, or to `/ask/<id>?signin_error=<reason>` when Google or Supabase refused the sign-in, which the card then shows; anything that is not a session id goes home. A signed-out visitor always gets the sign-in card first, so not found is only said to someone signed in, and the not-found card offers "Sign in with another account" (it signs out of the galaxy and reloads). The logic is `src/ask/page/sign-in.ts`, tested in `sign-in.test.ts`. `SignInCard` takes its return path as a prop, so s3's `/ask/signin` page can reuse it.

## What it costs to change later

One route file and one small function. If s3 generalises the shared callback to return to a given path, the card's return path changes and the route is deleted; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3 means to generalise the shared callback for every page, which would make this route redundant.
- (author) Whether production's Supabase redirect allow-list really covers every path on the host, as the galaxy README says it should (`https://<host>/**`): this route relies on it and it could not be checked here.
