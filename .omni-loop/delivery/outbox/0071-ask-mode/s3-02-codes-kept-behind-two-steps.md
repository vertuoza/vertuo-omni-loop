---
id: s3-02-codes-kept-behind-two-steps
prd: 71
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec keeps the terminal's one-time sign-in codes where only the server's master key can reach them, but the site has no master key. How should the codes be kept safe?

## The decision, in plain words

Nobody reaches the codes directly. The site stores and uses them only through two narrow database steps: one that issues a code for the person who just signed in, and one that uses a code up, once.

## The intro, for fun

The spec asked for a safe that only the master key opens, in a house with no master key.

## The punchline, for fun

So the safe got two slots instead: one to drop a code in, and one to take it out, once.

## The options, in plain words

A. Keep the codes behind two narrow database steps, with no direct access for anyone signed in or not, the option built.
B. Give the site the master key on its server, and let only that key reach the codes, as the spec words it.
C. Keep the two steps, and also add a check run on every database change that proves nobody else reaches the codes.

## What I had to decide

The spec: "The CLI-code table is service-role only." The galaxy app holds only the anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): every ask call runs as the caller, and no service-role key is configured or read anywhere in `apps/galaxy`. Yet the callback must write a code, and `/api/ask/token` must read and delete it for a caller who is not signed in yet.

## What I did meanwhile

`ask_cli_codes` (migration `20260926100000_ask_cli_codes.sql`) has row-level security with no policy, and no grant to `anon` or `authenticated`; only `service_role` keeps it. Two `security definer` functions are the only other way in: `ask_cli_code_issue(p_code_hash, p_refresh_token)`, executable by `authenticated` and refused outside the crew, stores a code bound to `auth.uid()` for 2 minutes; `ask_cli_code_redeem(p_code_hash)`, executable by `anon` and `authenticated`, deletes the code's row and returns it, once. Expired rows go on either call. `/api/ask/token` then refuses an expired code, renews the refresh token, and refuses a sign-in that is not the code's owner's. Proved locally on an in-memory Postgres (PGlite) with a stand-in auth schema, every migration applied in order; no check file was added to `supabase/checks/`, which is outside this slice's paths.

## What it costs to change later

Moving to a service-role key later means a secret on the deployment, a server-only client, and a migration dropping the two functions; the table and the codes' shape stay.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a service-role key on the galaxy's server is wanted at all, which the spec's wording assumes
- whether the code table's grants should also be proved on every pull request, next to the ask sessions check, which lives outside this slice's paths
