---
prd: 1660
title: omni signin and setup-token by device code, from any machine
blocked-by: none
spec: file
phase0: server
---

# omni signin and setup-token by device code, from any machine

**Date:** 2026-10-12 · **PRD:** #1660 · **After:** PRD 71 (`omni signin`), PRD 1628 (kit tokens,
`omni setup-token`) · **Touches:** a new migration (`ask_cli_devices`), `apps/galaxy/src/ask/` (a
new `device.ts` with its repository and live wiring, small changes to `cli-code.ts` and
`kit-token.ts`), `apps/galaxy/app/api/ask/device/` (two routes), `apps/galaxy/app/ask/device/` (one
page), `apps/galaxy/app/auth/callback/route.ts` (the `device=` branch), `kit/lib/ask/` (a new
`device.ts` beside `loopback.ts`), `kit/lib/env/read.ts` (the remote-session variables),
`kit/bin/commands/signin.ts` and `setup-token.ts`, and the kit README's sign-in paragraph.
**Out of scope:** `/api/ask/token` (unchanged), `OMNI_TOKEN` and its exchange (unchanged), the
Make a token button on the profile page (unchanged), ask mode itself, and any other sign-in of the
galaxy.

## Problem

`omni signin` and `omni setup-token` finish by a loopback: the Omni page sends the browser to
`http://127.0.0.1:<port>/callback?state=<s>&code=<c>` (or `&token=<omk_…>`), where the terminal
listens. The browser always reads `127.0.0.1` as its own computer. When the terminal runs anywhere
else (a Claude Code cloud session, an SSH box, a devcontainer, a Codespace) the browser lands on
"This site can't be reached" and the terminal waits five minutes for nothing. The only way through
today is to copy that failed address back into the terminal's machine by hand, or to make a kit
token on the profile page and set `OMNI_TOKEN` as a secret.

Tried on 2026-10-12 from a Claude Code cloud session: the GitHub sign-in and the one-time code
worked, and the code came back on `ERR_CONNECTION_REFUSED`. Everything before the last redirect
already works without the terminal; only the hand-over needs the terminal's machine.

## Solution

A **device sign-in** (the RFC 8628 shape `gh auth login` and `vercel login` use): the terminal
asks the Omni page for a request, prints a link and a short code, and polls the page until the
person approves the request in any browser. The browser never talks to the terminal.

### The flow

```
terminal                               Omni page                              browser
POST /api/ask/device ───────────────▶  a device request (pending, 10 min):
  {purpose: signin | token,              sha256(device_code), user_code, purpose and its fields
   name?, days?, workspace?}
◀── {device_code, user_code: WXYZ-4821,
     url: <ask.url>/ask/device?user_code=WXYZ-4821, interval: 3, expires_in: 600}

prints the link and the code                                            opens the link
                                       /ask/device: "Your terminal shows WXYZ-4821?"
                                       Yes → the existing sign-in card (CliSignInCard)
                                       /auth/callback?next=ask-cli&device=WXYZ-4821[&purpose=token]
                                         the same join and link; the same one-time code (signin)
                                         or kit token (token), attached to the request
                                       → "Back to your terminal" · "Signed in. Close this tab."
POST /api/ask/device/poll {device_code} every `interval` seconds
  → {status: pending} | {status: slow_down, interval} | {status: expired} | {status: denied}
  → {status: approved, code}                     (signin)
  → {status: approved, token, expires_at}        (token)
     handed over once: the request is then deleted
signin: POST /api/ask/token {code, repo}   unchanged from PRD 71
```

### The server

- **`public.ask_cli_devices`**, RLS on and closed to `anon` and `authenticated` like
  `ask_cli_codes`: `device_hash` (SHA-256 of the device code, primary key), `user_code` (unique
  while pending), `purpose` (`signin` | `token`), the token's `name`, `days` and `workspace` when
  `purpose` is `token`, `status` (`pending` | `approved` | `denied`), the approved payload (the
  one-time code for `signin`, the kit token sealed with the server's key for `token`), `interval`,
  `last_polled_at` and `expires_at` (10 minutes). Expired rows are cleared on each issue.
- **`POST /api/ask/device`** issues a request. The device code is 32 random bytes, base64url,
  stored only as its SHA-256. The user code is 8 characters from an alphabet without look-alikes
  (`BCDFGHJKLMNPQRSTVWXZ23456789`), printed `XXXX-XXXX`, matched without case or dash. The body
  is validated as `/ask/signin?purpose=token` validates its query today (`readTokenRequest`), and
  limited to `MAX_TOKEN_BODY_BYTES`.
- **`POST /api/ask/device/poll`** answers by status. A poll sooner than `interval` after the last
  one answers `slow_down` and adds 2 seconds to the interval. An approved request answers its
  payload once and is deleted in the same call; any later poll on that device code answers
  `expired`.
- **`/ask/device`** shows the code and asks whether the terminal shows it. **Yes** opens the
  existing `CliSignInCard`, its return path the callback with `device=<user_code>` in place of
  `port` and `state`. **No** marks the request `denied`. With no code in the link, the page shows
  a box to type it. Its words are the before/after page's: "Does your terminal show this code?",
  **Yes, sign it in**, *No, it's not mine*, "Nothing was signed in" · "Got this link from someone?
  Ignore it.", "This link has expired" · "Run `omni signin` again.", "Back to your terminal" ·
  "Signed in. Close this tab." (the word pass holds each sentence to 7 words).
- **The callback's `device=` branch** runs what the `port=` branch runs today, the join
  (`joinBeforeIssue`), the one-time code (`ask_cli_code_issue`) or the kit token's minting, then
  attaches the payload to the pending request and redirects to `/ask/device?done=1`. A request that
  is no longer pending (expired, denied, already approved) attaches nothing, and the page says so.

### The kit

- **`kit/lib/ask/device.ts`**: `startDevice({askUrl, purpose, …, fetch})` issues the request, and
  `poll()` waits on it with the interval the page gives, honouring `slow_down`, until approved,
  expired, denied or its own wait (the request's `expires_in`). It is to the device flow what
  `startLoopback` is to the loopback, and gives the same `code` (or `token`) promise and `close()`.
- **Which flow.** `chooseFlow(env, platform)` gives `device` when `CLAUDE_CODE_REMOTE`,
  `SSH_CONNECTION`, `SSH_TTY` or `CODESPACES` is set, or on Linux with neither `DISPLAY` nor
  `WAYLAND_DISPLAY`; `loopback` otherwise. `--device` and `--loopback` force one. The variables
  are read in `kit/lib/env/read.ts`, the one module that reads `process.env`.
- **The device flow** prints, before anything waits:

  ```
  Sign in at <ask.url>/ask/device?user_code=WXYZ-4821
  Check that the page shows WXYZ-4821. Waiting (10 min)…
  ```

  and opens no browser.
- **The loopback flow** prints its link as today, starts a device request too, and prints it as
  the fallback:

  ```
  Sign in in your browser: <ask.url>/ask/signin?port=…&state=…
  Browser didn't open, or it's on another machine? <ask.url>/ask/device?user_code=WXYZ-4821  (code WXYZ-4821)
  ```

  It finishes on whichever comes back first; the other is closed (the listener stopped, the
  polling ended). When the device request cannot be issued (an older page answers 404, or the page
  is unreachable), the fallback line is left out and the loopback runs alone, as today.
- **On a 404 under the device flow** (a page from before this PRD), the kit says
  `this Omni page has no device sign-in yet: using the browser on this machine` and runs the
  loopback.
- **What follows is unchanged:** `signin` trades the code with `POST /api/ask/token {code, repo}`,
  writes `~/.config/omni/credentials.json` and prints `signedInLine`; `setup-token` prints the
  token, its expiry and the line to paste it by, and keeps it nowhere.

## Decisions

- **Device flow, picked up by polling** (approach A of three). Rejected: a paste-back page like
  `gcloud --no-browser` (keeps the copy-paste, and a Claude Code session has no interactive stdin),
  and a push over Supabase Realtime (a long-lived connection through the cloud proxy, and sign-in
  tied to Realtime, to save about 3 seconds).
- **Chosen by the environment, with flags** (the person's answer): auto-detection as above,
  `--device` and `--loopback` to force one.
- **Link and a code to match** (the person's answer): the link carries the request, and the page
  shows the code and asks whether the terminal shows it before any sign-in. A link someone else
  sent shows a code the person's own terminal does not show, and **No** refuses it.
- **Both commands** (the person's answer): `omni signin` and `omni setup-token` take the device
  flow in this PRD.
- **The voice's objection, accepted.** Lead Engineer: two sign-in flows, chosen by a guess about
  the environment, leave a team stuck when the guess is wrong. Met by printing the device link as
  a fallback on the loopback flow, so a wrong guess never strands anyone; the cost is one device
  request per local sign-in, which expires unused.
- **The one-time code and `/api/ask/token` stay as they are.** The device flow changes only how
  the code reaches the terminal, so the terminal still gets a sign-in of its own, never the
  browser's (PRD 71).
- **A kit token waits sealed.** Between approval and pick-up the token is held only sealed with
  the server's key (`kitBox`), and deleted when picked up or when the request expires; it is never
  logged and never in a URL.
- **10 minutes, 3-second interval.** Twice the loopback's 5-minute wait, because the person may
  open the link on another device; the interval and `slow_down` follow RFC 8628.
- **The sign-in card's sentence is cut** to "The terminal gets its own sign-in." on the `signin`
  purpose, for the word pass (7 words at rest); its title, its button and its `token` wording stay.
- **No proof video** (the person's answer).

## User stories

1. As a developer in a Claude Code cloud session, I run `omni signin`, open the printed link on my
   laptop, confirm the code, sign in, and the session is signed in without my pasting anything
   back.
2. As a developer on an SSH box, I run `omni setup-token` and get my kit token in the terminal the
   same way.
3. As a developer on my laptop whose browser opened on the wrong profile or not at all, I use the
   fallback link the terminal printed, and the sign-in finishes.
4. As anyone who receives a sign-in link they did not ask for, I see a code my terminal does not
   show, press No, and nothing is signed in.
5. As a developer whose kit is newer than the Omni page, `omni signin` still signs me in by the
   loopback.

## Scope

In: the table and its functions, the two routes, the `/ask/device` page, the callback's `device=`
branch, the kit's device module, the flow choice and its flags in `signin` and `setup-token`, the
env variables, tests for each, and the kit README's sign-in paragraph.

Out: any change to `/api/ask/token`, `OMNI_TOKEN`, the profile page's token, ask mode, or the
galaxy's own sign-in; a QR code; approving from the Omni app's menu without the link.

## Test seams

Every test runs on fixtures: none calls Supabase or GitHub (testing playbook).

| risk | test |
|---|---|
| the request's rules: code shapes and alphabet, case- and dash-blind matching, 10-minute expiry, approved once, picked up once, `slow_down`, `denied` | unit tests of `apps/galaxy/src/ask/device.ts`, valid and invalid inputs |
| the two routes: body validation, size limit, every response shape, 404 / 410 / 429 | route tests on a fake store, as `cli-code.test.ts` does |
| the callback's `device=` branch: payload attached, no `127.0.0.1` redirect, PKCE cookie spent, a non-pending request attaches nothing | extends `cli-code.test.ts` and `kit-token.test.ts` |
| the migration: RLS closed, only the functions write, rows deleted on pick-up and on expiry | a `device-sql.test.ts` in the shape of the folder's `*-sql.test.ts` |
| the page's states: pending, Yes, No, expired or unknown, typed code, done | page tests beside the page |
| `chooseFlow`: each variable, `DISPLAY` / `WAYLAND_DISPLAY` by platform, both flags | unit test in `kit/lib/ask/device.test.ts` |
| the commands: device output, polling with `slow_down`, expired / denied / unreachable lines, 404 falls back to loopback, the fallback link, first finisher wins and the other closes | `main()` with an injected `fetch` and short `waitMs`, in `signin.test.ts` and `setup-token.test.ts` |
| `kit/lib/env/` gains variables: it is mutation core | `pnpm mutation:changed` on the slice |

## Risks

- **What merging publishes:** the galaxy's two new routes and page on its next production deploy,
  the migration on the next `supabase db push`, and the kit in the next `chore(release)` version.
  The kit is backward compatible (a page without the routes falls back to the loopback), and the
  page is forward compatible (an older kit never calls the routes), so the two can ship in either
  order. The migration must run before the galaxy deploy that calls it.
- **Rollback:** revert the feature PR. The table is new and nothing else reads it; a later
  migration drops it.
- **Phishing:** a device link sent by someone else is the attack device flows carry. Met by the
  code to match and the **No** button; the page never signs in without the click.
- **Polling load:** one request every 3 seconds for at most 10 minutes per sign-in, with
  `slow_down` for a client that polls faster.
- **A wrong guess:** met by the fallback link and the two flags.

## Acceptance criteria

1. In a Claude Code cloud session without `OMNI_TOKEN`, `omni signin` prints a link and a code
   without opening a browser; after the person confirms the code and signs in on any device, it
   prints `signed in as <login> — <owner/repo> goes to <workspace>` and exits 0, with no paste.
2. In the same session, `omni setup-token` prints its token, its expiry and the line to paste it
   by after the same approval, and keeps the token nowhere.
3. `omni signin --device` on a laptop takes the device flow; `omni signin --loopback` in a cloud
   session takes the loopback.
4. On a laptop, `omni signin` prints the loopback link and the device fallback link; finishing
   either signs in, and the other stops waiting.
5. Pressing **No** on `/ask/device` ends the terminal's wait with
   `omni signin: the sign-in was refused in the browser`, exit 1, and signs nothing in.
6. A request not approved within 10 minutes ends with
   `omni signin: the sign-in link expired: run omni signin again`, exit 1; its link then shows the
   expired page.
7. An approved request's code or token is handed over once: a second poll answers `expired`, and
   the database keeps no row for it.
8. Against an Omni page without the device routes, `omni signin` in a cloud session says the page
   has no device sign-in yet and runs the loopback.
9. A device code is stored only as its SHA-256, and a kit token waiting for pick-up only sealed;
   neither appears in a log or a URL.
