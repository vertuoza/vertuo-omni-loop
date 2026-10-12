---
prd: 1628
title: Sign in from a cloud session
blocked-by: none
spec: file
---

# Sign in from a cloud session

**Date:** 2026-10-11 · **PRD:** #1628 · **After:** PRD #71 (`omni signin`), PRD #459 (where a
repository's calls go), PRD #855 (agent tokens) · **Touches:** `supabase/migrations/` (a `kit` scope
on `agent_tokens`, its expiry and its stored session), `apps/galaxy` (`POST /api/ask/token` taking a
token, the token's sign-in round trip, a **Terminal tokens** section on your own profile page),
`kit/lib/env/read.ts` (the `OMNI_TOKEN` group), `kit/lib/ask/` (`signedInClient` reading it),
`kit/bin/commands/` (`omni setup-token`, and what `signin`, `whoami`, `signout` and `statusline`
say under a token), the README's environment list, and the guide (a **Cloud sessions** page).
**Out of scope:** a device-code sign-in, write access for PRD #855's read-only business links,
GitHub credentials (a cloud session brings its own), a token not tied to a person (a service
account), and changing the cloud environment's network settings, which only the person can do.

## Problem

`omni signin` is the only way to sign the kit in to the Omni page. It opens a browser on the
laptop, catches the callback on `127.0.0.1:<port>`, and keeps a Supabase session
(`access_token`, `refresh_token`, `expires_at`) in `~/.config/omni/credentials.json`.

A Claude Code cloud session (claude.ai/code, the mobile app) has no browser and no home folder
that lasts: every session starts in a fresh container. The kit is never signed in there, so
everything that goes through `signedInClient` stops: ask mode, `omni dossier push`,
`omni wait approval`, `omni approval flag`, `omni product which`, `omni business show`,
`omni proof`, `omni roadmap`, `omni loop`, `omni targets`. Delivery that only needs the repository
and GitHub still runs, so a PRD gets built while its page, its questions and its approvals go
silent. This PRD was itself brainstormed in a cloud session, where the phase-0 flag, the product,
the personas and the dossier could not be read for exactly this reason.

Copying `credentials.json` into an environment variable does not work. The access token lasts an
hour, and the refresh token rotates: the first renewal from one container ends the copy everywhere
else, the laptop's sign-in included (the two-holder risk `apps/galaxy/src/ask/cli-code.ts` already
names).

Other CLIs solve this one way: the browser sign-in is for laptops, and a long-lived personal token,
made once and read from an environment variable, is for CI and cloud containers. `claude
setup-token` / `CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`, `VERCEL_TOKEN` and `SUPABASE_ACCESS_TOKEN` all
work like this.

## Solution

### 1. The token: a `kit` scope on agent tokens

PRD #855's `agent_tokens` already holds what a personal token needs: one row per token, its maker
and workspace, only its SHA-256 hash and last four characters, revocation by the maker or an owner,
at most 20 live tokens a person, and a token that stops working when its maker leaves the
workspace. This PRD adds to it, rather than adding a second table:

- `scope`: `business` (today's read-only links, and the default for every existing row) or `kit`.
- `expires_at`: required for a `kit` token, null for a `business` one (PRD #855's decision 11 is
  unchanged for business links).
- `session`: for a `kit` token only, the refresh token of the Supabase session the token unlocks
  (section 2), encrypted with a server-only key, never readable through any policy or function a
  member can call.

A `kit` token is `omk_` followed by 32 random bytes, base64url (business links keep `omb_`), shown
once. It acts **as its maker**, in its workspace, with the same rights the maker has on the Omni
page and nothing more. Its expiry is 30, 90 or 365 days, 90 by default. The 20-live-token limit
counts both scopes together. A `kit` token never reads through `business_for_token()`, and a
`business` link never signs the kit in.

### 2. Making a token is a dedicated sign-in

A token unlocks a Supabase session of its own, never the browser's or the laptop's. Making one goes
through the same round trip as `omni signin` (`/ask/signin` → GitHub → the auth callback's
`ask-cli` branch), which already makes a fresh session without keeping it in the browser's cookies.
A new `purpose=token` on that round trip (with the token's name and expiry) makes the callback, in
place of a one-time code for the terminal:

1. make the token's random value and its `kit` row (hash, last four, name, expiry);
2. store that fresh session's refresh token, encrypted, in the row's `session`;
3. hand the token back once: to the terminal's loopback listener for `omni setup-token`, or shown
   on the profile page for **Make a token**.

### 3. The exchange: token in, short session out

`POST /api/ask/token` takes a third body, `{omni_token, repo?}`, beside `{code, repo?}` and
`{refresh_token}`. The server:

1. hashes the token and finds its live `kit` row, locking the row for the rest of the exchange;
2. checks it is not revoked, not past `expires_at`, and that its maker is still a member;
3. renews the stored session itself, and writes the new refresh token back to `session`;
4. answers as the other two bodies do, `repo` placed the same way (PRD #459), but with no refresh
   token:

```json
{ "access_token": "…", "refresh_token": null, "expires_at": 1760000000,
  "login": "…", "email": "…", "workspace": { "slug": "vertuoza", "name": "Vertuoza" } }
```

Only the server ever holds the refresh token, so rotation never ends anyone's session: any number
of containers share one `OMNI_TOKEN`. The row lock puts two exchanges arriving at once one after the
other. The access token is a real Supabase session for the maker, so every row-level policy sees the
maker exactly as on a laptop. `last_used_at` is written as for business links, at most once a
minute.

A token that does not work answers 401 `{error, reason}`, `reason` one of `revoked`, `expired`
(with the date), `not-a-member` (with the workspace), `unknown`; the body never echoes the token.

**Revoking** a `kit` token (`agent_token_revoke()`, by its maker or an owner) also signs its stored
session out and clears `session`, so the token stops at once and every access token it handed out
stops at its next call that renews, at most one hour later.

### 4. The kit: `OMNI_TOKEN`

- **The group.** `kit/lib/env/read.ts` gets an `OMNI_TOKEN` group, one variable, which must match
  `^omk_[A-Za-z0-9_-]{43}$`. A malformed value stops the command with the usual one line naming the
  variable, never its value (ADR-0057). The README's `omni:env-variables` list gains it.
- **The one door.** `signedInClient` (`kit/lib/ask/credentials.ts`) builds its token store from
  `OMNI_TOKEN` when it is set: it trades the token on first use, keeps the access token in memory,
  and trades again when it is about to expire or a call answers 401. It never reads or writes
  `~/.config/omni/credentials.json`. Unset, nothing changes. **`OMNI_TOKEN` wins over the file**,
  as `GH_TOKEN` wins over `gh`'s stored login.
- **`omni setup-token [--name <name>] [--days 30|90|365]`.** It runs the round trip of section 2
  from the terminal (the browser, the loopback listener, as `omni signin` does), then prints the
  token once, its expiry, and the line
  `Paste it as OMNI_TOKEN=<token> in your cloud environment's variables.`
  `--name` defaults to `terminal <yyyy-mm-dd>`; `--days` to 90.
- **Under a token,** every command that reports the sign-in says so:
  - `omni signin` prints `signed in by OMNI_TOKEN as <login> — <owner/repo> goes to <workspace>`
    and opens no browser;
  - `omni whoami` prints `<login> (OMNI_TOKEN ··<last four>)`;
  - `omni signout` prints `OMNI_TOKEN is set in this environment: revoke it on your profile page`
    and exits 1, deleting nothing;
  - the status line shows `token ··<last four>` where it shows the sign-in today.
- **Errors**, one line each, exit 1, naming the variable and never its value:
  - `OMNI_TOKEN expired on <date>: make a new one with omni setup-token`
  - `OMNI_TOKEN was revoked: make a new one with omni setup-token`
  - `OMNI_TOKEN: <login> is no longer a member of <workspace>`
  - `OMNI_TOKEN: cannot reach <host>: allow it in your environment's network access`
- **Never leaked.** The kit never prints, logs or writes the token, in `.omni-loop/local/` or
  anywhere else; at most its last four characters appear.

### 5. The profile page: Terminal tokens

On your own profile page (`/app/people/<your login>`), under **Alerts**, a **Terminal tokens**
section; nobody else's profile shows it.

- **Make a token**: a name and an expiry (30, 90 or 365 days), then the round trip of section 2. It
  comes back on the same page with the token shown once in a copy field, its expiry, and the line
  *Paste it as `OMNI_TOKEN=` in your cloud environment.* A reload never shows it again.
- **The list**: your live `kit` tokens, newest first: name, `··` and the last four, made, last
  used (or `never`), expires, and **Revoke** (with a confirmation).
- An owner sees and revokes every member's `kit` tokens where PRD #855 already lists every link.

### 6. The guide: Cloud sessions

`docs/guide/cloud.md`, linked from Install and Join a team:

1. Make a token: `omni setup-token` on your laptop, or **Make a token** on your profile page.
2. In Claude Code on the web or the app, create or edit a cloud environment:
   - **Environment variables:** `OMNI_TOKEN=omk_…`, and any optional group from the README.
   - **Network access:** **Custom**, allowing the host of the repository's `ask.url`
     (`www.omni-loop.xyz` here), and `openrouter.ai` when `OPENROUTER_API_KEY` is set; or **Full**.
3. Start a session on the repository; `omni whoami` prints `(OMNI_TOKEN ··<last four>)`.

It also says what needs no setting up: GitHub, which the session reaches through Claude's GitHub
connection.

## Decisions

1. **A personal token, not a device code.** A cloud session starts empty every time; a device code
   would be typed again in each one. The person chose the token, after `claude setup-token`.
2. **A scope on `agent_tokens`, not a new table.** Hash-only storage, revocation, the 20 limit and
   the membership rule are PRD #855's, already proven by `supabase/checks/agent_tokens.sql`.
3. **The server holds the session and renews it.** With refresh-token rotation, two holders end
   each other's session (`cli-code.ts`); one holder, the server, never does. Rejected: a JWT the
   server signs itself with the project's secret, which bypasses Supabase Auth and depends on a key
   format hosted Supabase is moving away from.
4. **Making a token is a sign-in round trip.** The callback already makes a fresh session no
   browser keeps; reusing it needs no admin API and no email address (GitHub lets a person keep
   theirs private).
5. **`kit` tokens expire; business links still do not.** A token that writes as a person does not
   live forever. 90 days by default, as the person approved.
6. **`OMNI_TOKEN` wins over `credentials.json`,** as `GH_TOKEN` wins over `gh`'s login: the
   environment is the more deliberate choice.
7. **Two ways to make one, one token.** `omni setup-token` mirrors `claude setup-token`; the
   profile page serves a person with no terminal at hand. Both make the same row.
8. **No proof video** (the person said no).

## User stories

- As a **member working from Claude Code on the web or my phone**, I paste one variable into my
  cloud environment once, and every session after that pushes dossiers, sends ask-mode questions
  and waits for approvals as me.
- As a **member**, I see which tokens I made, when each was last used and when it expires, and I
  revoke one in a click when it leaks or I stop using it.
- As a **workspace owner**, I revoke any member's token, and a member who leaves the workspace
  loses every token they made.
- As a **member on a laptop**, nothing changes: `omni signin` works as it does, and a token I make
  never ends my laptop's sign-in.

## Scope

In:
- the migration (`scope`, `expires_at`, `session`; the exchange's and the revocation's database
  side), and its checks;
- `/api/ask/token`'s `{omni_token}` body; the `purpose=token` round trip;
- `OMNI_TOKEN` in the kit: the env group, `signedInClient`, `omni setup-token`, and the
  `signin`, `whoami`, `signout` and status-line lines;
- the profile page's **Terminal tokens** section;
- `docs/guide/cloud.md`, the README's environment list, links from Install and Join a team.

Out: listed under **Out of scope** at the top.

## Test seams

Following `omni kb show testing`: everything on fixtures, nothing calls GitHub or Supabase.

- **Database** (`supabase/checks/agent_tokens.sql`, extended): making a `kit` token, the 20 limit
  across both scopes, refusal past `expires_at`, revocation by the maker and by an owner clearing
  `session`, refusal once the maker leaves, a `kit` token refused by `business_for_token()`, a
  `business` link refused by the exchange, no member able to read `session`.
- **Server** (vitest beside `apps/galaxy/src/ask/cli-code.ts`, on its fake deps): `{omni_token}`
  answers an access token and `refresh_token: null`; the stored session is renewed and written
  back; each refusal gives its `reason`; the token appears in no response and no log line; two
  exchanges at once renew once each, in order.
- **Kit** (vitest, `kit/lib/env/read.test.ts`, `kit/lib/ask/*.test.ts`, the commands through
  `main()` on a fixture repository): `OMNI_TOKEN` wins over `credentials.json` and leaves it
  untouched; the kit trades again on expiry and on a 401; each error line; the `signin`, `whoami`,
  `signout`, `setup-token` and status-line lines; a malformed value stops the command; a sweep of
  every line those tests print finds no token past its last four.
- **Profile page** (component tests of the section): the list, the token shown once, **Revoke**'s
  confirmation, the section absent on someone else's profile.
- **Mutation:** `kit/lib/env/` is delivery core: run `pnpm mutation:changed` after its tests.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the migration reaches production through
  the `supabase` workflow; the kit's `bin` and plugin change what the install hands out; the galaxy
  app's route and profile section deploy with it.
- **A leaked token acts as its maker** for up to its expiry. Mitigated by: hash-only storage, last
  four and last use shown, revocation that stops the stored session at once, expiry, and no token
  in any output.
- **The stored session is a secret at rest.** It is encrypted with a server-only key, never
  readable through a policy or a member's function; losing the key only forces everyone to make new
  tokens.
- **Rollback:** `update public.agent_tokens set revoked_at = now(), session = null where scope =
  'kit';` stops every kit token at once; the kit falls back to `credentials.json` when `OMNI_TOKEN`
  is unset; a follow-up migration drops the three columns. Business links are untouched by either.

## Acceptance criteria

1. A member makes a `kit` token with `omni setup-token` and with **Make a token** on their profile
   page; each is shown once, then listed with its name, last four, made, last used and expiry; a
   reload never shows it again.
2. With `OMNI_TOKEN` set and no `credentials.json`, `omni whoami`, `omni dossier push`,
   `/omni:ask on` and `omni wait approval` work in a fresh container, as the token's maker.
3. Two containers using the same token for more than an hour both keep working, and the maker's
   laptop sign-in is untouched.
4. A revoked token, an expired one, and one whose maker left the workspace each fail on the next
   exchange with their one-line reason; after revocation, no call succeeds once the access token in
   hand (at most one hour) runs out.
5. A `kit` token cannot read through `business_for_token()`, and a `business` link is refused by
   `POST /api/ask/token`.
6. With both `OMNI_TOKEN` and `credentials.json` present, the token is used and the file is neither
   read nor changed; with `OMNI_TOKEN` unset, every command behaves as before this PRD.
7. A malformed `OMNI_TOKEN` stops the command with one line naming the variable; no line, response,
   log or file the kit or the server writes holds a token beyond its last four characters.
8. `omni signout` under a token deletes nothing and says to revoke it on the profile page.
9. The **Terminal tokens** section shows on your own profile only; an owner revokes a member's
   `kit` token where business links are listed.
10. `docs/guide/cloud.md` walks a member from no token to `omni whoami` printing
    `(OMNI_TOKEN ··<last four>)`, and is linked from Install and Join a team.
