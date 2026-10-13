---
prd: 1831
title: Hook-free omni commands — session, ask and heartbeat for any agent, on a laptop or in the cloud
blocked-by: none
spec: file
phase0: server
---

# Hook-free omni commands

**Date:** 2026-10-13 · **PRD:** #1831 · **Touches:** `kit/bin/commands/ask.ts`,
`kit/bin/commands/heartbeat.ts`, a new `kit/bin/commands/session.ts`, `kit/lib/ask/hook.ts` (split
into a core and two adapters), `kit/lib/ask/mode.ts`, `kit/lib/ask/heartbeat.ts`,
`kit/lib/env/read.ts`, `kit/bin/omni.ts`, `kit/bin/commands/index.ts`, `kit/lib/help/entries.ts`,
`docs/guide/any-agent.md` (new), `docs/guide/cloud.md`, `docs/guide/meta.json`, `README.md` ·
**Kind:** Architectural

## Problem

The `omni` CLI runs under any coding agent, but four of the kit's jobs only happen because Claude
Code runs a hook (`kit/plugin/hooks/hooks.json`):

1. **The constituents at session start.** `SessionStart` runs `omni constituents`, so the product's
   Statement and Never list print before anything else. Another agent never sees them.
2. **Ask mode.** `PreToolUse` on `AskUserQuestion` runs `omni ask hook pre`: it posts the question
   to the person's ask page, waits up to 540 s and hands the answer back as the tool's input.
   `PostToolUse` sends an answer typed in the terminal to the page. Both read Claude's hook JSON on
   stdin and Claude's transcript (`kit/lib/ask/hook.ts`, `context.ts`, `lead.ts`). An agent with no
   `AskUserQuestion` tool and no hooks cannot reach the page at all.
3. **The heartbeat.** `PostToolUse` on every tool runs `omni heartbeat`, which reads `session_id`
   from the hook's stdin. Without it, the Omni page never learns a session is working.
4. **The close.** `SessionEnd` closes the terminal's ask session and sends the last heartbeat.

PRD 1739 gave every agent a session id (`OMNI_SESSION_ID`, `CLAUDE_CODE_SESSION_ID`, then one stored
for the checkout) and left these hooks to a follow-up. This PRD is that follow-up's first step:
every hook body becomes a command any agent runs from a shell, on a laptop **or in a cloud session**
(Claude Code on the web, Codex on chatgpt.com), where there is no terminal, no TTY, no
`~/.config/omni`, a fresh clone and a shell that may give up after two minutes.

It is the first of four PRDs that make the kit coding-agent agnostic. The skills' wording, the
install adapter with `.agents/skills/`, and the CLI step runner each follow as their own PRD.

## Solution

Each hook's job becomes a plain `omni` command. Claude's hooks stay, byte for byte, and call the
same core. The API contract does not change: the wire field `claudeSessionId` keeps its name and
carries whatever session id the command resolved.

### 1. `omni session start` and `omni session end`

- `omni session start` resolves the session id in PRD 1739's order: `OMNI_SESSION_ID`, then
  `CLAUDE_CODE_SESSION_ID`, then the id stored in the main checkout's
  `.omni-loop/local/session.json`. When none gives one, it generates one (a random UUID) and stores
  it there, as `omni dossier open` does today (the two share `kit/lib/dossier/session.ts`). It then
  prints, in this order: the constituents (`omni constituents`' text, its 3-second budget and its
  cache unchanged), the briefing (`omni kb show briefing`), and a last line `session: <id>`.
- `omni session end` closes this session's ask session (as `ask hook end` does, keyed by the
  resolved id) and sends the heartbeat's `--end`.
- Both print what they can and always exit 0; exit 2 is a usage error only. No step of either one
  holds the agent up: each network call keeps its own budget (constituents 3 s, heartbeat 2 s, the
  close 2 s).

### 2. `omni ask question`, `omni ask wait`, `omni ask answer`

`omni ask question --file <q.json> [--wait <seconds>]`:

- `q.json` takes `AskUserQuestion`'s input shape, `{ questions: [{ question, header, options:
  [{ label, description }], multiSelect }] }`, plus two optional fields: `lead`, the text the agent
  wrote before asking (PRD 752), and `context`, `{ skill, model }` (PRD 144's round context: the
  CLI reads `repo`, `branch` and `prd` itself, as the hook does, and sends `tokens` as null, having
  no transcript). Unknown fields are refused. Claude's hook builds the same object from its stdin and transcript,
  so both entries share one schema (`kit/lib/ask/schema.ts`).
- The mode is on when `OMNI_ASK=on` is set, or when `.omni-loop/local/ask.json` says so (`omni ask
  on`), as today. `OMNI_ASK=off` turns it off whatever the file says. The token is `OMNI_TOKEN` when
  set, else the computer's sign-in, as today.
- It opens this session's ask session when it has none (keyed by the resolved session id, the
  terminal of PRD 142), posts the round, and waits for it in calls of at most 50 s, up to `--wait`
  seconds in all: **110 by default**, under the shortest shell limit common to the agents (2
  minutes); any value from 10 to 540 is taken.
- **Exit 0:** answered. Stdout is one JSON object, `{ round, answers, shots }`: `answers` maps each
  question's text to its answer, as `AskUserQuestion` takes them, and `shots` lists the absolute
  paths of the screenshots downloaded into `.omni-loop/local/ask/shots/<round>/` (PRD 620), each
  also appended to its question's answer, as the hook does.
- **Exit 3: ask in your own chat.** Ask mode is off, there is no sign-in, the page cannot be reached,
  it refused, or the round came back abandoned or closed. Stdout is empty; stderr says why in one
  line (an unreachable host keeps today's `cannot reach <host>: allow it in your environment's
  network access`). A round left open is abandoned when it can be.
- **Exit 4: still waiting.** The wait ran out with the round open. Stdout is `round <id>`; the round
  stays open on the page.
- **Exit 2:** a usage error, or a question file that does not read, the field named.

`omni ask wait <round> [--wait <seconds>]` resumes the wait on an open round, with the same
`--wait` default and the same exit codes. An agent repeats it for as long as it is willing to wait.

`omni ask answer <round> --file <a.json>` sends answers the person gave in the agent's own chat to
the page, as `ask hook post` does (PRD 1180): `a.json` is `{ answers }`, posted with
`via: "terminal"`, a question left empty left out. It exits 0 once posted, and 0 with one line on
stderr when the post fails: it never stops the agent.

None of the three reads stdin, needs a TTY or needs `~/.config/omni` when `OMNI_TOKEN` is set.

### 3. The heartbeat any `omni` command sends

- After any `omni` command whose session id resolves (step 1 of the order, or the stored id), the
  CLI sends the heartbeat, at most once a minute per session (`kit/lib/ask/heartbeat.ts`'s window,
  unchanged), from a **detached child process**: the command neither waits for it nor fails with it.
- It sends only when dossiers are on and the computer is signed in or `OMNI_TOKEN` is set, as today.
- It is off when `OMNI_HEARTBEAT=off` is set, and under vitest (`VITEST` set).
- `omni heartbeat` itself, the hook commands, `omni session end` and `omni statusline` never spawn
  it. `omni heartbeat` takes its session id from the resolver when its stdin carries none, so it can
  be run by hand.
- Claude's `PostToolUse` hook keeps its finer beat after every tool call.

### 4. Claude keeps its hooks

`kit/plugin/hooks/hooks.json` does not change. `kit/lib/ask/hook.ts` is split into a core
(`kit/lib/ask/round.ts`: open the session, post, wait, abandon, download screenshots) and two
adapters: the Claude hook (stdin JSON in, `hookSpecificOutput` out, the transcript read for `lead`
and `context`) and the CLI (a file in, JSON and an exit code out). Every case of
`kit/lib/ask/hook.test.ts` stays green without an edit.

### 5. The guide: any agent, on a laptop or in the cloud

- A new page, `docs/guide/any-agent.md`, listed in `docs/guide/meta.json`: run `omni session start`
  first; ask through `omni ask question`, resume with `omni ask wait` on exit 4, ask in the chat on
  exit 3 and send that answer with `omni ask answer`; run `omni session end` last. Each command with
  a copyable example.
- `docs/guide/cloud.md` › **Set up the cloud environment** gains `OMNI_ASK=on`, beside `OMNI_TOKEN`,
  and the line to allow the Omni page's host in the environment's network access.
- The root README's list of environment variables names `OMNI_ASK` and `OMNI_HEARTBEAT`
  (`scripts/env-docs.test.ts`).
- `omni help` gives an entry to `session`, to the three `ask` verbs and to the heartbeat's switch.

## Decisions

- **Split into four PRDs.** The idea held five items: an install adapter, `.agents/skills/`,
  hook-free commands, neutral skill wording and a CLI step runner. The person chose to brainstorm
  the hook-free commands first; the wording, the install adapter with `.agents/skills/`, and the
  step runner follow, in that order, each blocked by the one before.
- **Ask: one blocking command that resumes** (the person picked A over two calls every time, and over
  an MCP tool that leaves out agents without MCP). An MCP tool can be built on the same core later.
- **Exit 3 means "ask in your own chat".** One code for every reason the page is not used, so a
  skill has one branch; the reason goes to stderr for the person.
- **A 110-second default wait** so the call fits a cloud shell's 2-minute limit; the resume carries
  the rest. Claude's hook keeps its 540 s.
- **`omni session start|end`** (the person's choice over folding them into `kb show briefing` or
  leaving them to `AGENTS.md`). `session end` is best effort: an agent with no end event may never
  run it, and the page already treats a session whose beats stopped as gone.
- **The heartbeat rides on every `omni` command** (the person's choice over explicit calls in the
  skills, or start and end only). Detached, at most once a minute, never in a test.
- **Cloud sessions are in scope** (the person, at the design: "make sure as well it can run on cloud
  like Claude.ai and codex from a website (not such as terminal)"): `OMNI_ASK=on` switches ask mode
  on with no file, nothing reads stdin or needs a home folder, and the default wait fits a cloud
  shell.
- **The wire field `claudeSessionId` keeps its name**: renaming it is a contract change for the Omni
  page, out of this PRD.
- **The voice objected at the design** (persona:Irisa): *"I push customer quick wins for my mobile
  team (persona:Irisa); this PRD alone gives nobody a new agent — a teammate on Codex still can't
  run a skill until two more PRDs land."* Settled `accepted`: the guide page `any-agent.md` lets a
  person on Codex use ask mode and the session commands by hand the day this ships.
- **Proof video: no.** Nothing here shows in a browser.

## User stories

- As a developer driving Codex in a terminal, I run `omni session start` and read the product's
  Statement, its Never list and the briefing, as a Claude session does (persona:B-E DEv).
- As a PM in a Codex or Claude Code session on the web, with `OMNI_TOKEN` and `OMNI_ASK=on` set in
  the environment, the agent's questions reach my ask page, and my answers come back to it
  (persona:Irisa, persona:Paul - Product Manager).
- As that PM, when the agent's shell gives up after two minutes, the agent picks up the same
  question with `omni ask wait` and my answer is not lost.
- As a team lead, the Omni page shows a Codex session working as it shows a Claude one, without
  anyone wiring a hook (persona:Lead Engineer).
- As a Claude Code user, nothing changes: the same hooks, the same 540-second wait, the same page
  (persona:F-E Developer).

## Scope

In: `omni session start|end`; `omni ask question|wait|answer`; `OMNI_ASK`; the ask core split out of
the hook; the heartbeat spawned by any `omni` command, `OMNI_HEARTBEAT`, and `omni heartbeat`
reading the resolver; `omni help` entries; `docs/guide/any-agent.md`, `docs/guide/cloud.md`,
`docs/guide/meta.json`, the README's variables; the rebuilt `kit/dist/`.

Out: any skill's wording (PRD 2 of the series: step 0 becomes `omni session start`, "ask the person"
becomes `omni ask question`); `omni init`, `claude plugin`, `.agents/skills/`, the status line and
`plugin-hud` (PRD 3); a step runner (PRD 4); the API's `claudeSessionId` field; an MCP tool;
`kit/plugin/hooks/hooks.json`.

## Test seams

As `omni kb show testing` says: vitest, colocated `*.test.ts`, no network, no GitHub, fixtures in
temporary folders. The Omni page is `kit/test/fake-ask-server.ts`, or a fake `fetch` as the ask tests
pass today.

- **`ask question`:** one case per exit code: answered (0, `answers` and `shots` printed); mode off,
  no sign-in, unreachable, refused, round abandoned (3 each, stdout empty, the reason on stderr);
  wait ran out (4, `round <id>`, the round left open); a question file with a missing field or an
  unknown one (2, the field named). The wait is cut into calls of at most 50 s.
- **`ask wait`:** resumes an open round to 0, 3 and 4.
- **`ask answer`:** posts `via: "terminal"`, leaves an empty question out, exits 0 when the post
  fails, with one line on stderr.
- **`OMNI_ASK`:** `on` with no `ask.json` turns the mode on; `off` with `ask.json` turns it off.
- **The cloud seam:** a temporary checkout with no home folder, stdin not a TTY and empty,
  `OMNI_TOKEN` and `OMNI_ASK=on` set: `ask question` opens the session, times out once (4), `ask
  wait` gets the answer (0), and `session end` closes the session.
- **`session start`:** prints the constituents, then the briefing, then `session: <id>`, for each
  of the four id sources (the stored id written only when none of the first three gives one);
  exits 0 with the page unreachable.
- **`session end`:** closes the ask session and sends `ended: true`; exits 0 when both fail.
- **The heartbeat:** a command run with a session id spawns the detached child once per minute and
  not twice within it; none under `OMNI_HEARTBEAT=off`, none under vitest, none from `heartbeat`,
  `ask hook`, `session end` or `statusline`. `omni heartbeat` with empty stdin reads the resolver.
- **Claude unchanged:** `kit/lib/ask/hook.test.ts` passes without an edit; a test reads
  `kit/plugin/hooks/hooks.json` and asserts it unchanged.
- **Registers:** the help and commands-table tests list the new verbs;
  `scripts/env-docs.test.ts` passes with `OMNI_ASK` and `OMNI_HEARTBEAT` in the README.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` stay green; `kit/test/dist.test.ts` with
  the rebuilt bundle.

## Risks

Merging publishes the kit change on `main`; the release workflow's version commit follows, and
installs pick it up on `omni update`. Rollback is reverting the merge commit: every command and
variable is new, and the hooks never changed, so a revert leaves nothing behind but
`.omni-loop/local/` files nothing reads any more.

- **The heartbeat now fires from every `omni` command,** not only from Claude's hook. That is the
  one behaviour change for an existing user. It is rate-limited to once a minute, detached and
  silent; `OMNI_HEARTBEAT=off` turns it off, and the release note names it.
- **A detached child in a CI job** could outlive the job's step. CI runs no session id unless one
  is set, and with no session id nothing is spawned.
- **A cloud environment that blocks the Omni page's host** sees exit 3 on every question: the agent
  asks in its chat, which is today's behaviour there. The guide names the host to allow.
- **One stored id per checkout,** as PRD 1739 noted: two non-Claude sessions in the same checkout
  share one ask session and one heartbeat. `OMNI_SESSION_ID` separates them.

## Acceptance criteria

1. With `OMNI_SESSION_ID` and `CLAUDE_CODE_SESSION_ID` unset and no `session.json`, `omni session
   start` prints the constituents, then the briefing, then `session: <uuid>`, stores the id in the
   main checkout's `.omni-loop/local/session.json`, and exits 0; with the Omni page unreachable it
   still prints the briefing and exits 0.
2. With ask mode on, `omni ask question --file q.json` posts the round to the ask page and, once
   the person answers there, prints `{ round, answers, shots }` and exits 0.
3. With ask mode off, `omni ask question` prints nothing on stdout, one line on stderr, and exits 3.
4. With the round unanswered after `--wait 10`, `omni ask question` prints `round <id>` and exits 4,
   and `omni ask wait <id>` then prints the answer given on the page and exits 0.
5. `omni ask answer <round> --file a.json` shows the answer on the page as given in the terminal.
6. In a checkout with no `~/.config/omni`, no TTY and no `ask.json`, with `OMNI_TOKEN` and
   `OMNI_ASK=on` set, criteria 2 and 4 hold.
7. Two `omni` commands run within a minute in one session send one heartbeat; neither waits for
   it; with `OMNI_HEARTBEAT=off` neither sends one.
8. `omni session end` closes the session's ask session and sends the heartbeat's end, and exits 0
   when the page cannot be reached.
9. `kit/plugin/hooks/hooks.json` is unchanged, and in a Claude Code session a question asked with
   ask mode on is answered on the page as before.
10. `docs/guide/any-agent.md` is served under `/docs`, `docs/guide/cloud.md` names `OMNI_ASK=on`,
    the README names `OMNI_ASK` and `OMNI_HEARTBEAT`, and `omni help session` and
    `omni help ask` describe the new verbs.
11. `pnpm test`, `pnpm lint` and `pnpm typecheck` are green, and `kit/dist/` is rebuilt.
