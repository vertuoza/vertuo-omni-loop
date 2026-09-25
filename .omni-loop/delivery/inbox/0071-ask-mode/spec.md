---
prd: 71
title: Ask mode — Claude's questions on a clean web page
blocked-by: none
spec: file
---

# Ask mode: Claude's questions on a clean web page

**Date:** 2026-09-25 · **PRD:** #71 · **Modelled on:** [adesombergh/bbq](https://github.com/adesombergh/bbq)
(MIT), its `bbq-offload` mode above all · **Amends:** PRD 3's spec §2 principle 7 ("the kit never
mentions the game"), through ADR-0002

## Problem

The skills ask questions in the terminal. `/omni:brainstorm` asks a dozen in one design session, and
the terminal is a poor place to read them:
- the question, its options and a long preview share one monospace column;
- earlier answers scroll away;
- the only theme is whatever the terminal has.

A person being questioned is holding a design in their head, and the screen adds to that load
instead of lowering it.

bbq shows that the questions read far better on a web page. It runs a local server, however, keeps
everything in memory, and needs each skill to be told to call its tools. We want the same page, hosted,
and **transparent**: turn a mode on, and every question goes to the page, with no skill written
differently.

## Solution

**A mode, switched on per repository checkout, carried by harness hooks.**

```text
omni signin              once per machine: Google sign-in (@vertuoza.com) in the browser, token kept locally
/omni:ask on             opens a session, prints the link, turns the hooks on
  … Claude calls AskUserQuestion …
    PreToolUse hook      sends the questions to the page, waits, hands the page's answer back to Claude
    PostToolUse hook     an answer typed in the terminal is shown on the page as well
    UserPromptSubmit     one line of context: "ask every question through AskUserQuestion"
/omni:ask off            closes the session, the hooks go quiet
```

The page lives in the galaxy app (Next.js on Vercel), which already has a Google sign-in restricted to
the crew. **The kit knows only a URL,** `ask.url` in `.omni-loop/config.yml`, and a small HTTP contract
(below). It never names the galaxy, so the hooks and CLI would work unchanged against any server that
honours the contract.

### The contract (`ask.url` + `/api/ask/*`)

Every call carries `Authorization: Bearer <access token>`. The server checks the token and that the
account belongs to the crew, and every row is owned by the account that created it.

| Call | Does |
|---|---|
| `GET /ask/signin?port=<p>&state=<s>` (a page) | signs the person in, then redirects to `http://127.0.0.1:<p>/callback?state=<s>&code=<c>` |
| `POST /api/ask/token` `{code}` or `{refresh_token}` | returns `{access_token, refresh_token, expires_at, email}` |
| `POST /api/ask/sessions` `{title}` | opens a session → `{id, url}` |
| `POST /api/ask/sessions/:id/close` | closes it |
| `POST /api/ask/sessions/:id/rounds` `{questions}` | `questions` is `AskUserQuestion`'s input as is → `{roundId}` |
| `GET /api/ask/rounds/:id/wait` | holds up to 50 s → `{status: open\|answered\|abandoned\|closed, answers?}` |
| `POST /api/ask/rounds/:id/answers` `{answers, via: "terminal"}` | records an answer given in the terminal |
| `POST /api/ask/rounds/:id/abandon` | the hook gave up waiting; the page shows "moved to the terminal" |

`answers` has exactly the shape `AskUserQuestion` takes in `updatedInput.answers`: question text to the
chosen label. Several labels are joined with `, ` for a multi-select, and the typed text is used for
**Other**.

### The kit side

- **`omni signin` / `omni signout` / `omni whoami`.**
  - `signin` starts a one-shot listener on `127.0.0.1` at a random port, opens `<ask.url>/ask/signin`,
    catches the code, and exchanges it for tokens.
  - The tokens are stored in `~/.config/omni/credentials.json` (mode `0600`), keyed by the host of
    `ask.url`. They are never stored in the repository.
  - `signout` deletes them.
- **`omni ask on | off | status`.**
  - `on` needs a sign-in. It opens a session titled `<repo slug> · <branch>`, writes
    `.omni-loop/local/ask.json` (`{sessionId, url, host}`), and prints the link.
  - `.omni-loop/local/` carries its own `.gitignore` (`*`), so nothing in it is ever committed and the
    repository's `.gitignore` is untouched.
  - `off` closes the session and deletes the file. `status` prints the link, or `off`.
- **`omni ask hook pre | post | prompt`.** These are the three hook bodies. Each reads the hook's JSON on
  stdin, and **each exits 0 with empty output when `.omni-loop/local/ask.json` is missing.**
  - `pre`:
    - posts the round;
    - loops on `wait` for up to 540 s in total (the hook's timeout is 600 s);
    - once answered on the page, prints `{hookSpecificOutput: {hookEventName: "PreToolUse",
      permissionDecision: "allow", updatedInput: {questions, answers}}}`;
    - on any other outcome it calls `abandon` when it can, then exits 0 silently, so the terminal
      prompt shows;
    - it keeps `roundId` in `.omni-loop/local/ask-round.json` for `post`.
  - `post`: when the answer came from the terminal (the round in `ask-round.json` is not answered on
    the page), it posts the answer with `via: "terminal"`. It then deletes `ask-round.json`.
  - `prompt`: prints `additionalContext`, one sentence: "Ask mode is on: ask every question to the
    person through the AskUserQuestion tool, never as plain text."
- **`/omni:ask`**: a thin skill in the `omni` plugin that runs `omni ask on|off|status` and prints the
  link.
- **`kit/plugin/hooks/hooks.json`**: the three hooks, matcher `AskUserQuestion` on Pre/PostToolUse,
  each running `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" ask hook <kind>`, with `pre` at
  `"timeout": 600`.
- **Config:**
  - a new section `ask: { url: null }`;
  - with `null`, `omni ask on` answers "ask mode is not set up for this repository (ask.url)" and
    exits 1;
  - this repository sets `ask.url` to the galaxy's production URL.

### The galaxy side

- **Routes**: `app/ask/signin/page.tsx`, `app/ask/[session]/page.tsx` and
  `app/api/ask/**/route.ts`, with a `?next=ask-cli` branch in the existing `auth/callback`. Ask
  code lives in `src/ask/`, apart from `src/arcade/`.
- **Sign-in:**
  - It is the galaxy's Google sign-in: Supabase Auth, `hd=vertuoza.com`, and `is_crew()`.
  - Asking needs **no player row and no GitHub link**. Those are for the game.
  - The one-time `code` handed to the CLI is a random value stored hashed for 2 minutes, bound to the
    signed-in account, and good for a single use.
- **Data** is one migration:
  - `ask_sessions` (`id uuid`, `owner uuid → auth.users`, `title`, `status open|closed`,
    `created_at`, `last_seen_at`).
  - `ask_rounds` (`id`, `session_id`, `questions jsonb`, `answers jsonb`,
    `answered_via page|terminal`, `status open|answered|abandoned`, timestamps).
  - `ask_cli_codes` (`code_hash`, `owner`, `refresh_token`, `expires_at`).
  - Row-level security everywhere: `owner = auth.uid()` directly, or through the session. The CLI-code
    table is service-role only.
  - A session with no call for 12 h reads as closed, and rounds go 7 days after their session closes,
    both through one scheduled SQL function. None of this is a ledger event, and none of it touches
    the game's tables.
- **The page:**
  - A reading surface, not the arcade: one centred column about 680 px wide, a readable sans-serif (Atkinson Hyperlegible Next, drawn for legibility) at 17 px with 1.6 line height.
  - The pixel font appears only in the small header wordmark.
  - The galaxy's colours become signals, as named tokens: plasma for the selected option, yellow for
    **Recommended** (an option whose label ends in "(Recommended)" loses the suffix and gains the
    badge), cyan for links and focus, green for answered, red for errors only.
  - A system / light / dark switch is stored in `localStorage` and applied before the first paint. In
    light theme the same hues are darkened on an off-white ground. Every text colour pair passes WCAG
    AA in both themes.
  - The open round sits at the top:
    - each question shows its `header` chip and its question as the heading;
    - options appear as large rows with their descriptions;
    - a `preview` is shown in a monospace panel beside the options (under them below 720 px);
    - multi-select uses checkboxes, and every question has an **Other** field;
    - **Send to Claude** is enabled once each question has an answer;
    - keys `1`–`4` pick an option and `Enter` sends.
  - Answered rounds fold into a quiet history list below, each with its answers and a
    "page" / "terminal" tag.
  - Other states: signed out, "Claude is working…", "moved to the terminal" and "session closed".
  - The page polls every 2 s while the tab is visible.

## Decisions

1. **A mode, carried by hooks, not an instruction to the model.** The `PreToolUse` hook on
   `AskUserQuestion` is harness-enforced and works for every skill unchanged. The `UserPromptSubmit`
   nudge catches questions a skill would otherwise write as prose. (bbq's `bbq-offload` is an
   instruction; this PRD chose the hook.)
2. **The page answers, the terminal takes over.** Claude Code cannot show the terminal prompt while a
   hook waits, so there is no "first answer wins". The page is the answer channel while the mode is
   on. The terminal prompt appears whenever the page cannot answer (not signed in, unreachable, 9 min
   without an answer). The mode never blocks a session.
3. **Hosted in the galaxy, behind its Google sign-in:** the person's choice, over a separate
   project or omni-app. It amends PRD 3's principle 7. **ADR-0002** records it:
   - the kit may *depend on a URL* the game app serves;
   - it still never names the game (a kit test fails on the word "galaxy" in any non-test file under `kit/`, next to the game-word list `kit/lib/outbox/banter.test.mjs` already keeps);
   - removing the game removes ask mode, and `ask.url: null` switches it off cleanly.
4. **No asides, notes or mini-game.** `AskUserQuestion` has no channel for bbq's Wait what / Show me /
   ELI5, nor for its notes. The page shows exactly what the tool carries.
5. **Polling, not realtime,** on the page (every 2 s) and in the hook (a 50 s wait per call, within the
   galaxy function's 60 s limit). Supabase Realtime is not introduced.
6. **The local state stays in `.omni-loop/local/`,** ignored by its own `.gitignore`. It is inside the
   kit's footprint, so `omni-loop remove` still deletes exactly what the kit owns. The credentials sit
   in the user's home, since one sign-in serves every repository.
7. **One session per checkout.** A second `omni ask on` in the same checkout replaces the first
   session and closes it.

## User stories

1. As a person brainstorming a PRD, I switch ask mode on and answer every question on a page I can
   read comfortably, in the theme I like, while the terminal keeps showing the work.
2. As a person on a phone or a second screen, I open the link and answer there.
3. As a person whose network drops mid-session, the question simply shows in the terminal. I lose
   nothing and do nothing.
4. As a person who answered one question in the terminal, I still see it in the page's history.
5. As a teammate, I cannot open someone else's session, even with its link.

## Scope

**In:** `omni signin|signout|whoami`, `omni ask on|off|status|hook`, the `/omni:ask` skill, the
plugin's `hooks/hooks.json`, the `ask.url` config key, the galaxy routes and page, the migration,
ADR-0002, and a line in the kit README.

**Out:**
- asides, notes and a snake game;
- Realtime;
- Slack or mobile push;
- asking through anything other than `AskUserQuestion`;
- sharing a session with another person;
- changing any existing skill's text;
- game points for answering.

## Test seams

- **The hook bodies are pure functions of (stdin JSON, local files, HTTP).** They are tested with
  vitest against a fake contract server (`node:http`) for these cases: mode off → no output; answered
  → the exact `hookSpecificOutput`; multi-select and Other → the joined or typed answer; timeout →
  `abandon` called and no output; server down → no output within 2 s; 401 → one refresh then retry;
  session closed → `ask.json` deleted.
- **`omni signin`**: the loopback listener is tested with a fake browser (a plain HTTP GET on the
  callback), the state is checked, and the credentials file is written with mode 0600.
- **Config**: `ask.url` defaults to `null`, and `omni ask on` refuses cleanly when it is.
- **Kit guard**: a test that fails when any non-test file under `kit/` (plugin skills and hooks included) contains "galaxy".
- **Galaxy API handlers**: tested as functions with a stubbed Supabase client, for token rejected,
  non-crew rejected, another owner's session gives 404, and the round life cycle
  open → answered / abandoned.
- **Migration**: an RLS check that account A reads nothing of account B's sessions or rounds.
- **The page**: component tests for the answer model (the recommended badge, multi-select joining,
  Send enabled only when complete), and the theme resolver (system / light / dark).

## Risks

- **`updatedInput.answers` is the load-bearing assumption.** The Claude Code docs say it works, but it
  has not been tried here. The first slice is a tracer bullet that proves it end to end with a
  hard-coded answer before anything else is built. If it fails, the PRD stops and comes back for a
  redesign.
- **The hook's 600 s ceiling.** A person who takes longer than 9 min gets the terminal prompt. That is
  intended, and the page says so.
- **Vercel function time.** Each wait holds a function for up to 50 s. That is cheap at a crew's volume,
  and each wait is capped by `maxDuration: 60` on the ask routes.
- **Coupling the kit to the game.** It is contained by Decision 3: a URL only, a guard test, and a clean
  switch-off.
- **A refresh token on disk.** It is scoped to the ask contract, mode 0600, outside the repository,
  and `omni signout` deletes it.

## Acceptance criteria

1. With the mode off (no `.omni-loop/local/ask.json`), every hook exits 0 with no output, and
   `AskUserQuestion` behaves exactly as today.
2. `omni signin` opens the browser. After a Google sign-in with a @vertuoza.com account, the terminal
   prints `signed in as <email>`, and `~/.config/omni/credentials.json` exists with mode 0600. An
   account outside the crew is refused on the page, and nothing is written.
3. `/omni:ask on` prints one link. Opening it signed in as the same account shows an empty session
   titled `<repo> · <branch>`. Opening it as another account shows "not found".
4. With the mode on, a `/omni:brainstorm` question appears on the page within 3 s. Answering it there
   continues the session with that answer, and the terminal shows the question and the chosen answer.
5. Multi-select answers and **Other** text reach Claude exactly as typed.
6. With the galaxy unreachable, or no answer within 9 min, the same question appears as the normal
   terminal prompt. The page marks the round "moved to the terminal", and an answer typed there shows
   in the page's history tagged "terminal".
7. The page has a system / light / dark switch that survives a reload with no flash of the wrong
   theme. Every text colour pair passes WCAG AA in both themes. Question text is never in the pixel
   font.
8. `/omni:ask off` closes the session: the page shows "session closed", and the hooks are silent
   again.
9. `ask.url: null` makes `omni ask on` exit 1 with a one-line reason. No non-test file under `kit/` contains
   the word "galaxy".
10. ADR-0002 exists and states the amendment to principle 7.
