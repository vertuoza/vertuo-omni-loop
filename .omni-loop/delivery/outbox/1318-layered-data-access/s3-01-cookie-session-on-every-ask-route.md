---
id: s3-01-cookie-session-on-every-ask-route
prd: 1318
slice: s3
rank: high
bears-on: ADR-0095
raised: 2026-10-09
wave: 3
---

## The question, in plain words

The spec lets the page answer, share, give up on, close and sort questions with its own sign-in. Should the page's sign-in also be accepted by the terminal's other ask calls?

## The decision, in plain words

Every ask call the terminal makes now also accepts the page's own sign-in when no terminal token is sent, since they all share one entrance; an answer marked as given on the page is taken only from the page's sign-in.

## The intro, for fun

One key was cut for five doors, and it turned out to fit the whole corridor.

## The punchline, for fun

The terminal's key still opens every one of them first.

## The options, in plain words

A. As built: every ask call accepts the page's sign-in when no terminal token is sent.
B. Only the calls the page makes (answer, delete, sort, share, upload) accept the page's sign-in; the others keep asking for the terminal's token.

## What I had to decide

Whether the cookie session is read only on the answer, share, abandon, close and category routes, or on every route that goes through src/ask/api.ts's signIn (opening a session, asking a round, waiting, the workspace lookup, the delete). It is read on every one, only when the request carries no Authorization header; a bearer token is always read first. An answer with via "page" is refused with a token and taken from a cookie session only.

## What I did meanwhile

A same-site page could open a session or ask a round as the signed-in person; the Supabase cookies are SameSite=Lax, so another site's form posts carry none.

## What it costs to change later

Limiting the cookie to some routes is a flag on each handler in api.ts: no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the answer, share, abandon, close and category routes and does not say whether the others must refuse a cookie.
