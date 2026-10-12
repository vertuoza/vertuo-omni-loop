# Plan: omni signin and setup-token by device code, from any machine

PRD #1660, spec beside this plan (`spec.md`). Two landings, each its own draft PR opening with
`Closes #1660`, stacked: `feat/signin-device-1of2-server` into `main`, then
`feat/signin-device-2of2-kit` into landing 1's branch. Each slice is a sub-PR from its slice branch
into its landing's branch, with `Part of #1660`.

## Slices

| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | A terminal can issue a device request and poll it: the table and its functions, the request's rules, `POST /api/ask/device` and `POST /api/ask/device/poll` answering pending, slow_down, expired and denied | `supabase/migrations/` `supabase/database.types.ts` `apps/galaxy/src/ask/device.` `apps/galaxy/src/ask/device-sql.test.ts` `apps/galaxy/app/api/ask/device/` | — | 1 | 1 |
| s2 | A person approves a `signin` request on `/ask/device` and the poll hands the one-time code over once: the page and its states, the callback's `device=` branch, the card's shorter sentence | `apps/galaxy/app/ask/device/` `apps/galaxy/src/ask/device-card` `apps/galaxy/app/auth/callback/` `apps/galaxy/src/ask/cli-code` | s1 | 2 | 1 |
| s3 | A `token` request is approved the same way and the poll hands the sealed kit token over once | `apps/galaxy/src/ask/kit-token` `apps/galaxy/app/auth/callback/` | s2 | 3 | 1 |
| s4 | `omni signin` takes the device flow in a remote session or with `--device`: the device module, the flow choice, the env variables, the error lines, the 404 fallback to the loopback | `kit/lib/ask/device` `kit/lib/env/` `kit/bin/commands/signin` `kit/bin/signin.test.ts` | — | 1 | 2 |
| s5 | The loopback flow prints the device link as a fallback and finishes on whichever comes back first; `--loopback` forces it | `kit/lib/ask/race` `kit/bin/commands/signin` `kit/bin/signin.test.ts` | s4 | 2 | 2 |
| s6 | `omni setup-token` takes the same flows, choice, flags and fallback; the kit README's sign-in paragraph says how | `kit/bin/commands/setup-token` `kit/README.md` | s4, s5 | 3 | 2 |

**Shared ground.** `apps/galaxy/app/auth/callback/` is s2's and s3's: s3 waits for s2 (waves 2 and
3). `kit/bin/commands/signin` and `kit/bin/signin.test.ts` are s4's and s5's: s5 waits for s4
(waves 1 and 2). `kit/dist/` is generated (`pnpm kit:build`) and listed by no slice: a kit slice
rebuilds it only to test, and the wave rebuilds it once after merging.

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | server | — |
| 2 | kit | landing 1 is deployed: the migration applied and the galaxy serving `/api/ask/device` |

## Per slice: done when

**s1**
- The migration creates `public.ask_cli_devices` with RLS on and no grant to `anon` or
  `authenticated`; only its functions write it; expired rows are cleared on each issue; it is dated
  after the newest migration on `main`.
- `POST /api/ask/device {purpose: signin}` answers `{device_code, user_code, url, interval: 3,
  expires_in: 600}`; the device code is 43 base64url characters and only its SHA-256 is stored;
  the user code is 8 characters of `BCDFGHJKLMNPQRSTVWXZ23456789` shown `XXXX-XXXX`.
- `purpose: token` is validated as `readTokenRequest` validates it (name, days 30/90/365,
  workspace); a malformed body or one over `MAX_TOKEN_BODY_BYTES` answers 400 or 413.
- `POST /api/ask/device/poll` answers `pending`, then `slow_down` (interval + 2) when polled sooner
  than its interval, `expired` after 10 minutes or for an unknown code, `denied` once denied.
- The service exposes approve (attach a payload once to a pending request), deny and find-by-user-
  code (case- and dash-blind), each tested; an approved request's payload is answered once and the
  row deleted in the same call.
- Every role sits in its suffixed file (contract, service, repository; the routes are controllers)
  and `scripts/layering-guard.test.ts` passes without a new baseline line.

**s2** (`ui: yes`)
- `/ask/device?user_code=<c>` shows `Sign a terminal in`, `Does your terminal show this code?`, the
  code, **Yes, sign it in** and *No, it's not mine*, as the before/after page and the `ask-device`
  draft draw them.
- Yes opens `CliSignInCard` with the callback `?next=ask-cli&device=<c>`; No marks the request
  denied and shows `Nothing was signed in`; an expired, unknown or used code shows `This link has
  expired`; no code shows the box, which takes the code with or without the dash, in any case.
- The callback's `device=` branch joins, links and issues the one-time code as the `port=` branch
  does, attaches it to the pending request, spends the PKCE cookie, and redirects to
  `/ask/device?done=1` (`Back to your terminal`); it never redirects to `127.0.0.1`. A request no
  longer pending attaches nothing and shows the expired state.
- A poll after approval answers `{status: approved, code}` once, and that code redeems through
  `POST /api/ask/token {code, repo}` unchanged.
- The sign-in card's `signin` sentence reads `The terminal gets its own sign-in.`; the word pass
  finds nothing on the page's screens.

**s3**
- `/ask/device` for a `token` request shows the card's token wording (its name and lifetime).
- The callback's `device=…&purpose=token` branch mints the kit token as the loopback branch does and
  attaches it sealed with the server's key (`kitBox`); it is never in a URL, a log or a cookie.
- A poll answers `{status: approved, token, expires_at}` once, unsealed, and deletes the row.

**s4**
- `chooseFlow` gives `device` with `CLAUDE_CODE_REMOTE`, `SSH_CONNECTION`, `SSH_TTY` or
  `CODESPACES` set, or on Linux with neither `DISPLAY` nor `WAYLAND_DISPLAY`; `loopback` otherwise;
  `--device` forces the device flow. The variables are read in `kit/lib/env/read.ts` only.
- `omni signin` in the device flow prints `Sign in at <ask.url>/ask/device?user_code=<c>` and
  `Check that the page shows <c>. Waiting (10 min)…` before polling, opens no browser, honours
  `slow_down`, trades the code with `POST /api/ask/token {code, repo}` and prints `signedInLine`.
- Denied, expired and unreachable end with `omni signin: the sign-in was refused in the browser`,
  `omni signin: the sign-in link expired: run omni signin again` and `omni signin: unreachable`,
  each exit 1.
- A 404 from `/api/ask/device` prints `this Omni page has no device sign-in yet: using the browser
  on this machine` and runs the loopback.
- `pnpm mutation:changed --base origin/<landing 2 branch>` leaves no survivor in `kit/lib/env/`.

**s5**
- On the loopback flow, `omni signin` also prints `Browser didn't open, or it's on another machine?
  <device link>  (code <c>)`; finishing either signs in, and the other is closed (listener stopped,
  polling ended); `--loopback` forces this flow in a remote session.
- When the device request cannot be issued (404 or unreachable), the fallback line is left out and
  the loopback runs alone, as today.

**s6**
- `omni setup-token` takes the device flow in a remote session or with `--device`, the loopback
  with its fallback otherwise, with the same lines, and ends by printing the token, its expiry and
  the line to paste it by; the token is kept nowhere.
- The kit README's sign-in and setup-token paragraphs name the device flow, the flags and when
  each flow is chosen.
