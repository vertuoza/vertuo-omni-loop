# Plan: Sign in from a cloud session

PRD #1628, specified in `spec.md` beside this plan. The feature branch `feat/cloud-sign-in` goes into
`main` through one feature PR (`Closes #1628`). Each slice is a sub-PR from
`feat/cloud-sign-in--<slice>` into the feature branch (`Part of #1628`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A `kit` token is made by the sign-in round trip (`purpose=token`), its session stored encrypted in its `agent_tokens` row, and `POST /api/ask/token` trades `{omni_token}` for an access token of at most one hour with no refresh token, refusing a revoked, expired or ex-member token with its reason; revoking clears the stored session | `supabase/migrations/20261204090000_kit_tokens` `supabase/database.types.ts` `supabase/checks/agent_tokens.sql` `apps/galaxy/src/ask/` `apps/galaxy/app/api/ask/token/` `apps/galaxy/app/auth/` `apps/galaxy/app/ask/` `apps/galaxy/src/env` `apps/galaxy/.env.example` | — | 1 |
| s2 | With `OMNI_TOKEN` set, every kit command signs in from it, trading it again on expiry or a 401, never touching `credentials.json`; `omni signin`, `whoami`, `signout` and the status line say so; a malformed or failing token stops with its one line; the README lists the variable | `kit/lib/env/` `kit/lib/ask/credentials` `kit/lib/ask/client-tokens` `kit/lib/ask/client.` `kit/bin/commands/signin` `kit/bin/commands/statusline` `README.md` | — | 1 |
| s3 | `omni setup-token [--name] [--days]` runs the token round trip from the terminal and prints the token once with its expiry and the paste line | `kit/bin/commands/setup-token` `kit/bin/commands/index.ts` `kit/lib/ask/loopback` `kit/lib/help/` | s1, s2 | 2 |
| s4 | Your own profile shows **Terminal tokens**: your live kit tokens with **Revoke**, and **Make a token** with a name and an expiry, the token shown once on return; an owner revokes any member's kit token where links are listed | `apps/galaxy/src/profile/` `apps/galaxy/src/agent-connect/tokens/` `apps/galaxy/app/app/people/` `.omni-loop/knowledge/design/screens/profile` | s1 | 2 |
| s5 | The guide's **Cloud sessions** page walks a member from no token to `omni whoami` printing `(OMNI_TOKEN ··<last four>)`, linked from Install and Join a team | `docs/guide/cloud.md` `docs/guide/meta.json` `docs/guide/install.md` `docs/guide/join.md` | s2, s3, s4 | 3 |

**Shared ground.** No prefix is declared by two slices. `kit/lib/ask/` is split by file: s2 owns
`credentials`, `client-tokens` and `client.`, s3 owns `loopback`. The galaxy side is split by
folder: s1 owns `apps/galaxy/src/ask/` (the exchange and the round trip), s4 owns
`apps/galaxy/src/profile/` and `apps/galaxy/src/agent-connect/tokens/` (the list, making and
revoking from the page). `kit/dist/` is generated and listed nowhere: each kit slice rebuilds it only
to test.

## Per slice: done when

**s1** (`ui: yes`)
- A new migration, dated after every migration on `main`, adds `scope` (`business` default, `kit`),
  `expires_at` and `session` to `agent_tokens`; `supabase/checks/agent_tokens.sql` proves: making a
  `kit` token, the 20 limit across both scopes, refusal past `expires_at`, refusal once the maker
  leaves, revocation by the maker and by an owner clearing `session`, no member able to read
  `session`, a `kit` token refused by `business_for_token()`.
- The sign-in round trip with `purpose=token`, a name and an expiry makes the row and hands the
  token back once, to the loopback or to the page; the token is stored as its hash and last four.
- `POST /api/ask/token {omni_token, repo?}` answers `{access_token, refresh_token: null,
  expires_at, login, email, workspace}`, `expires_at` at most one hour ahead and never past the
  token's; the stored session is renewed under a row lock and written back; a `business` link is
  refused.
- Each refusal answers 401 with `reason` `revoked`, `expired`, `not-a-member` or `unknown`; no
  response and no log line holds the token (vitest on `cli-code.ts`'s fake deps).
- The key that encrypts `session` is a server-only variable in `src/env.ts` and `.env.example`; with
  it unset, the `{omni_token}` body answers that kit tokens are not set up here.

**s2**
- `kit/lib/env/read.ts` has the `OMNI_TOKEN` group (`^omk_[A-Za-z0-9_-]{43}$`); a malformed value
  stops the command with one line naming the variable; `kit/lib/env/docs.ts` and the README's
  `omni:env-variables` list carry it.
- `signedInClient` signs in from the token when it is set, trades it again on expiry and on a 401,
  and neither reads nor writes `credentials.json` (a fixture home proves the file untouched); unset,
  every existing test passes unchanged.
- `omni signin`, `omni whoami`, `omni signout` and the status line print the spec's lines under a
  token; each error line of the spec is printed for its 401 reason or an unreachable host.
- A sweep over every line these tests print finds no token beyond its last four.
- `pnpm mutation:changed` reports no survivor in the changed `kit/lib/env/` code.

**s3**
- `omni setup-token` opens the round trip with `purpose=token`, catches the token on the loopback,
  and prints it once with its expiry and `Paste it as OMNI_TOKEN=<token> in your cloud
  environment's variables.`; `--name` defaults to `terminal <yyyy-mm-dd>`, `--days` to 90 and
  accepts only 30, 90 or 365.
- `omni help` lists it; a run through `main()` on a fixture repository, with a fake browser and a
  fake fetch, proves each line.

**s4** (`ui: yes`)
- On your own profile, **Terminal tokens** lists your live kit tokens newest first (name, `··` and
  last four, Made, Used or Never used, Expires) with **Revoke** behind a confirmation; nobody else's
  profile shows the section (component tests).
- **Make a token** with a name and 30, 90 or 365 days runs the round trip and comes back with the
  token shown once in a copy field; a reload never shows it again.
- At 20 live tokens, **Make a token** says the limit is reached.
- An owner sees and revokes members' kit tokens where business links are listed.
- The built screen matches the `profile` draft in `.omni-loop/knowledge/design/screens/`, and the
  draft is brought up to what was built.

**s5**
- `docs/guide/cloud.md` holds the three steps of the spec's section 6 and what needs no setting up,
  with the real lines `omni setup-token` and `omni whoami` print; `meta.json` lists it after `join`;
  Install and Join a team link to it.
