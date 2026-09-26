# Ask mode — Claude's questions on a clean web page — plan

**PRD:** #71 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/ask-mode` → `main`
(`Closes #71`) · **Sub-PRs:** `feat/ask-mode--<slice>` → the feature branch (`Part of #71`).

Any decision taken without asking is an outbox item. The spec's contract table (the calls under
`/api/ask/*`, the `answers` shape, the status values) is the seam between the kit slices (s1, s3's kit
half, s5) and the galaxy slices (s2, s3's galaxy half, s4). A slice that needs to change the contract
raises an outbox item instead of editing another slice's files.

**s1 is the tracer bullet.** Before anything else depends on it, it proves in a real Claude Code
session that a `PreToolUse` hook's `updatedInput.answers` answers `AskUserQuestion`. If it does not,
s1 stops with an outbox item, and the PRD returns to design (spec, Risks).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The hooks answer `AskUserQuestion` from the contract: `ask.url` in the config (default `null`), the `.omni-loop/local/` state with its own `.gitignore`, `omni ask hook` (`pre`, `post`, `prompt`) against a contract server, and the plugin's `hooks/hooks.json`, proven in a live session against a local fake server | `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/lib/ask/hook` `kit/lib/ask/client` `kit/lib/ask/local-state` `kit/bin/commands/ask.mjs` `kit/bin/commands/index.mjs` `kit/bin/ask-hook.test.mjs` `kit/test/fake-ask-server.mjs` `kit/plugin/hooks/` `kit/dist/omni.mjs` | — | 1 |
| s2 | The galaxy serves the session and round half of the contract: the `ask_sessions` / `ask_rounds` migration with row-level security and expiry, and `/api/ask/sessions`, `/close`, `/rounds`, `/wait`, `/answers`, `/abandon`, each checking the bearer token and the crew | `supabase/migrations/20260926090000_ask_sessions` `apps/galaxy/app/api/ask/sessions/` `apps/galaxy/app/api/ask/rounds/` `apps/galaxy/src/ask/api` `apps/galaxy/src/ask/store` `apps/galaxy/src/ask/auth` | — | 1 |
| s4 | The ask page: `/ask/[session]` for its signed-in owner, the round with options, Recommended badge, preview, multi-select and Other, keyboard `1`–`4` and `Enter`, the history with page/terminal tags, the working / moved / closed states, polling every 2 s, and the system / light / dark switch applied before paint | `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/app/ask/[session]/` `apps/galaxy/src/ask/page` `apps/galaxy/src/ask/answer-model` `apps/galaxy/src/ask/theme` `apps/galaxy/src/ask/ask.css` | s2 | 2 |
| s3 | `omni signin`, `signout` and `whoami` end to end: the galaxy's `/ask/signin` page, the `?next=ask-cli` branch of the auth callback, the one-time code table and `/api/ask/token`; on the kit side the loopback listener, the token exchange and refresh, and `~/.config/omni/credentials.json` at mode 0600 | `supabase/migrations/20260926100000_ask_cli_codes` `apps/galaxy/app/ask/signin/` `apps/galaxy/app/auth/callback/` `apps/galaxy/app/api/ask/token/` `apps/galaxy/src/ask/cli-code` `kit/bin/commands/signin.mjs` `kit/bin/commands/index.mjs` `kit/lib/ask/credentials` `kit/lib/ask/loopback` `kit/bin/signin.test.mjs` `kit/dist/omni.mjs` | s2, s4 | 3 |
| s5 | The mode, whole: `omni ask` (`on`, `off`, `status`), the `/omni:ask` skill, this repository's `ask.url`, ADR-0002 amending principle 7, the no-"galaxy" guard over kit source, the kit README line, and the manual acceptance run (brainstorm in ask mode, both themes, offline fallback) | `kit/bin/commands/ask.mjs` `kit/lib/ask/mode` `kit/bin/ask.test.mjs` `kit/test/no-game-words.test.mjs` `kit/plugin/skills/ask/` `kit/README.md` `kit/dist/omni.mjs` `.omni-loop/config.yml` `.omni-loop/knowledge/adr/0002-` | s1, s3 | 4 |

**Shared ground.**
- `kit/dist/omni.mjs` is declared by s1, s3 and s5, in waves 1, 3 and 4. Every slice that changes
  bundled code rebuilds it with `pnpm kit:build` and commits it. When a sub-PR conflicts on the bundle,
  take either side and rebuild from the merged source; never merge two bundles by hand.
- `kit/bin/commands/index.mjs` is declared by s1 (`ask`) and s3 (`signin`, `signout`, `whoami`), in
  waves 1 and 3.
- `kit/bin/commands/ask.mjs` is declared by s1 (the `hook` subcommand) and s5 (`on`, `off`, `status`), in
  waves 1 and 4.

Every other prefix is held by one slice.
- `kit/lib/ask/` is split by file prefix: `hook`, `client` and `local-state` belong to s1,
  `credentials` and `loopback` to s3, and `mode` to s5.
- `apps/galaxy/src/ask/` is split the same way: `api`, `store` and `auth` belong to s2; `page`,
  `answer-model`, `theme` and `ask.css` to s4; and `cli-code` to s3.
- The two migrations have distinct file prefixes.

The ordering has reasons behind it:
- s4 follows s2 because the page reads the rounds s2 serves.
- s3 follows s4 because its sign-in page sits under s4's `app/ask/layout.tsx` and stylesheet.
- s5 follows s1 and s3 because `omni ask on` needs both the hooks and a sign-in.
- `kit/test/plugin.test.mjs` refuses a skill that names an `omni` command the CLI lacks, which is why
  the `/omni:ask` skill ships in s5 and not earlier.

## Per slice: done when

**s1**
- `omni config` shows `ask: { url: null }`, and `ask.url` accepts an https URL (or http on
  `127.0.0.1`).
- Without `.omni-loop/local/ask.json`, `omni ask hook pre`, `post` and `prompt` each exit 0 with empty
  stdout, for any stdin.
- Against `kit/test/fake-ask-server.mjs`, `hook pre` behaves as follows:
  - a round the fake answers prints exactly `{hookSpecificOutput: {hookEventName: "PreToolUse",
    permissionDecision: "allow", updatedInput: {questions, answers}}}`;
  - a multi-select answer is joined with `, `, and Other text passes through verbatim;
  - no answer within the total wait (shortened in tests) calls `abandon` and prints nothing;
  - with the server down it prints nothing within 2 s;
  - a 401 refreshes once and retries;
  - a `closed` session deletes `ask.json`.
- `hook post` posts the terminal answer with `via: "terminal"` only when the round is not answered on
  the page, and then deletes `ask-round.json`.
- `hook prompt` prints the one-sentence `additionalContext` only while the mode is on.
- `.omni-loop/local/.gitignore` holds `*`, and `git status` shows nothing under `.omni-loop/local/`.
- `kit/plugin/hooks/hooks.json` wires `PreToolUse` and `PostToolUse` (matcher `AskUserQuestion`) and
  `UserPromptSubmit`, with `pre` at `timeout: 600`.
- The tracer, recorded in the sub-PR: a live Claude Code session with the plugin loaded and
  `ask.json` pointing at the fake server receives the fake's answer as its `AskUserQuestion` result,
  and the terminal prompt never shows. When this fails, the slice stops with an outbox item.

**s2**
- The migration applies on a clean database.
- Account A cannot select, update or delete account B's sessions or rounds. This is checked by an RLS
  test run with two JWTs.
- The handler tests, run against a stubbed Supabase client, cover:
  - a missing or invalid token gets 401;
  - a non-crew account gets 403;
  - another owner's session gets 404;
  - `POST /rounds` stores the questions as given;
  - `/wait` returns `answered` with the answers as soon as they are set, `open` after at most 50 s,
    and `closed` for a closed or 12 h idle session;
  - `/abandon` and `/answers` (`via: "terminal"`) set the round's status and its `answered_via`.
- The ask routes declare `maxDuration: 60`. Expired sessions and rounds are removed by one scheduled SQL
  function, and no ledger or player table is touched.

**s4**
- Signed out, `/ask/<id>` shows a sign-in card, and after the sign-in it comes back to the same
  session.
- Signed in as another account, it shows "not found".
- A round shows its chip, its question as the heading, options as rows with their descriptions, and
  the yellow **Recommended** badge in place of a trailing "(Recommended)".
- A `preview` shows in a monospace panel beside the options, and under them below 720 px.
- Multi-select uses checkboxes, and every question has **Other**.
- The answer-model tests show that Send is enabled only when every question has an answer, that a
  multi-select joins with `, `, and that Other is sent verbatim.
- Keys `1`–`4` pick an option, and `Enter` sends when Send is enabled.
- Answered rounds fold into the history with a `page` or `terminal` tag. The working, "moved to the
  terminal" and "session closed" states each render.
- The theme resolver tests cover system, light and dark, and a stored choice is applied by an inline
  script before the first paint (no flash on reload).
- Every text colour pair in both themes passes WCAG AA. That is checked by a test over the token table.
  Question text uses Atkinson Hyperlegible Next, and the pixel font appears only in the header
  wordmark.

**s3**
- `omni signin` opens `<ask.url>/ask/signin?port=<p>&state=<s>`. After a Google sign-in with a
  @vertuoza.com account it prints `signed in as <email>` and writes
  `~/.config/omni/credentials.json` at mode 0600, keyed by the host.
- A non-crew account is refused on the page, and nothing is written.
- A mismatched `state` is refused by the listener.
- A one-time code works once, within 2 minutes, and only for the account that created it. The
  handler tests cover reuse, expiry and a wrong account.
- `/api/ask/token` exchanges a code or a refresh token.
- `omni whoami` prints the email, or `signed out`. `omni signout` deletes the host's entry.
- The existing arcade sign-in and GitHub link are unchanged, which the callback's existing paths
  show.

**s5**
- `omni ask on`:
  - signed in, it opens a session titled `<repo slug> · <branch>`, writes `.omni-loop/local/ask.json`
    and prints one link;
  - signed out, it exits 1 and says `omni signin`;
  - with `ask.url: null`, it exits 1 with the one-line reason;
  - a second `on` in the same checkout closes the first session.
- `omni ask off` closes the session and deletes `ask.json`. `omni ask status` prints the link, or
  `off`.
- `/omni:ask on|off|status` runs those commands, and `kit/test/plugin.test.mjs` passes with it.
- `kit/test/no-game-words.test.mjs` fails on "galaxy" in any non-test file under `kit/` and passes
  on the tree.
- `.omni-loop/knowledge/adr/0002-*.md` records the amendment to PRD 3's principle 7, the contract as
  the only coupling, and `ask.url: null` as the switch-off. This repository's `.omni-loop/config.yml`
  sets `ask.url` to the galaxy's production URL.
- The manual acceptance is recorded in the sub-PR with screenshots:
  - a `/omni:brainstorm` question answered on the page in light and in dark theme;
  - a multi-select and an Other answer received exactly;
  - with the network off, the same question shows as the terminal prompt, and its answer appears in
    the page's history tagged `terminal`;
  - after `/omni:ask off`, the page shows "session closed".
