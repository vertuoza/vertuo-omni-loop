---
id: s2-02-joining-needs-service-key-at-runtime
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Joining someone to their org's workspace at sign-in must run with the database's most powerful key, so the website now needs that key where it runs. Is it fine for the website's server to hold it, and who puts it there?

## The decision, in plain words

The website's server reads that key only when someone signs in, never in the browser. Where the key is missing, sign-in still works but nobody joins a workspace, and the failure is written to the log.

## The intro, for fun

The bouncer can now add names to the guest list, but only with the manager's master key.

## The punchline, for fun

No key on the hook, and the bouncer just shrugs and lets people in to an empty room.

## The options, in plain words

A. A: galaxy's server holds the service role key, read in one server-only module (built)
B. B: a dedicated Postgres role with only the two sign-up functions, and its own key
C. C: move joining into a Supabase edge function that holds the key instead

## What I had to decide

Where galaxy's server gets the right to run join_workspaces_by_github(), which only the service role may run.

## What I did meanwhile

apps/galaxy/src/data/sign-in-live.ts builds a service-role client from NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only module) for that one call. Without the key, joining throws, is logged, and the sign-in carries on (ADR 0044). The key must be set on galaxy's Vercel project; .env.example and the README, which describe it, are s4's ground.

## What it costs to change later

A constant: the variable name, or a narrower Postgres role later, in one module.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the functions are service role only but not which key galaxy's runtime holds; s4 owns .env.example and the README that would document it
