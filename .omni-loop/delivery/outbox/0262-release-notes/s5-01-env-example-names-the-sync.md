---
id: s5-01-env-example-names-the-sync
prd: 262
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

The app's example settings file says the database's secret key serves only the game's commands, yet the new publishing step uses that key too, plus a setting the file does not list. Should the file say so?

## The decision, in plain words

The file was left as it is, since no part of this work was given it. The app's guide now names both settings the publishing step reads, and where each comes from.

## The intro, for fun

A settings file swears the secret key has exactly one job, and a second job just walked in.

## The punchline, for fun

The guide now tells the whole story; the file catches up once someone may touch it.

## The options, in plain words

A. Leave the file as it is, and describe both settings in the app's guide only: the option built.
B. Change the file too: say the secret key also serves the publishing step, and add the project address it needs.

## What I had to decide

Whether `apps/galaxy/.env.example` should change. It says `SUPABASE_SERVICE_ROLE_KEY` is "Only for the `pnpm game:*` commands" and has no `SUPABASE_URL` line, while `pnpm releases:sync` (s4) reads both, from `apps/galaxy/.env.local` too, as the `game:*` scripts do. The file is outside every slice's territory in the plan, so s5 does not edit it. In my judgment it should change: someone copying it for a local sync would not learn that the sync needs `SUPABASE_URL` (the `NEXT_PUBLIC_` URL is not read), and the comment on the key is no longer true.

## What I did meanwhile

`apps/galaxy/README.md` (s5's ground) documents the sync's two variables in its Release notes section and under With a local Supabase (`SUPABASE_URL=http://127.0.0.1:54321 pnpm releases:sync`), and its secrets table names `releases.yml` beside `game.yml` for `SUPABASE_SERVICE_ROLE_KEY`. `.env.example` is unchanged.

## What it costs to change later

Option B is two comment lines and one empty `SUPABASE_URL=` line in `apps/galaxy/.env.example`, in a follow-up. No code, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan left the example settings file out of every slice on purpose.
