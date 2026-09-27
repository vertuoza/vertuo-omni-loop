---
id: s1-03-session-refresh-still-runs-on-home
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The front page reads no account and no database, but the step that keeps a signed-in player's session fresh still runs before every page, the front page included: should the front page be taken out of it?

## The decision, in plain words

It was left as it is: a visitor with no session triggers no call, and a signed-in player's session is only refreshed, never read by the front page.

## The intro, for fun

The front page promised not to peek at anyone's badge.

## The punchline, for fun

The doorman still polishes badges on the way in, though.

## The options, in plain words

A. Leave the session refresh running on every page, the front page included: what is built.
B. Take the front page out of the session refresh, so it never reaches the database.
C. Take every public page out of the session refresh: the front page and the design page.

## What I had to decide

Whether the session-refresh proxy should skip `/` so HOME never causes a request to Supabase, even for a signed-in player.

## What I did meanwhile

apps/galaxy/proxy.ts is unchanged and still matches `/`. With no Supabase settings it does nothing, and with no session cookie Supabase's client answers without a network call; a signed-in player opening HOME still has their session refreshed. HOME itself (app/page.tsx) imports nothing from Supabase and builds as static.

## What it costs to change later

Excluding `/` later is one pattern added to the proxy's matcher in apps/galaxy/proxy.ts, outside this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether 'makes no request to Supabase' in the acceptance criteria covers the proxy's refresh for a signed-in visitor (author)
- Not checked against a live Supabase that a cookie-less getUser makes no request (author)
