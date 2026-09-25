---
id: s3-01-terminal-gets-its-own-sign-in
prd: 71
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a person signs the terminal in, should it share the sign-in their browser already has, or get one of its own?

## The decision, in plain words

The terminal always gets a sign-in of its own, through a fresh Google sign-in on the page, and the browser keeps its own untouched. Sharing one would sign one of them out the first time the other renews it.

## The intro, for fun

Two doors, one key, and a lock that changes itself every hour.

## The punchline, for fun

So the terminal got its own key cut, and nobody is left outside.

## The options, in plain words

A. The terminal always gets its own sign-in, through a fresh Google sign-in, the option built.
B. The terminal shares the browser's current sign-in when there is one and skips Google, accepting that one side may be signed out when the other renews.
C. The terminal shares the browser's sign-in, and automatic renewal of sign-ins is set up so that sharing never signs anyone out.

## What I had to decide

The spec says the callback hands the CLI a one-time code bound to the account, stored with a `refresh_token`, but not whose sign-in that token belongs to. The galaxy's Supabase Auth rotates refresh tokens (`enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10` in `supabase/config.toml`): if the browser's cookie session and the terminal held the same refresh token, the first to renew it would make the other's next renewal a reuse past the interval, which Supabase treats as theft and answers by revoking the whole session, on both sides.

## What I did meanwhile

`/ask/signin` always starts the Google sign-in (`hd=vertuoza.com`, `prompt=select_account`), even when the browser is signed in already. The callback's `?next=ask-cli` branch exchanges Google's code with a Supabase client that reads only the PKCE code-verifier cookie and writes no session cookie (`cliCallbackDeps` in `apps/galaxy/src/ask/cli-code-live.ts`), so the arcade's session is neither read, renewed nor replaced. That new session's refresh token is stored with the one-time code, and `/api/ask/token` renews it once when the code is redeemed, so the tokens the terminal keeps were never in the browser. An account outside the crew is refused on `/ask/signin` with the reason, its new session is ended, and nothing reaches the terminal.

## What it costs to change later

A change of two files: reusing the browser's session instead would read its cookies in the callback and skip the Google round trip. Nothing stored depends on the choice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person already signed in on the page will mind picking their Google account once more for the terminal
- whether the production Auth settings keep refresh-token rotation on, which is what makes sharing unsafe; they could not be read from here
