---
prd: 1739
title: Agent-agnostic basics — AGENTS.md first, a session id any agent has, hooks in .agents/
blocked-by: none
spec: file
phase0: server
---

# Agent-agnostic basics

**Date:** 2026-10-12 · **PRD:** #1739 · **Touches:** `kit/lib/config.ts`, `kit/lib/laws.ts`,
`kit/lib/init/detect.ts`, `kit/lib/env/read.ts`, `kit/bin/commands/dossier.ts`,
`kit/bin/commands/now.ts`, `kit/bin/omni.ts`, `kit/lib/flow/schema.ts`, `docs/guide/flow.md`,
`README.md` · **Kind:** Bounded

## Problem

The kit's engine, the `omni` CLI, runs under any coding agent, but three of its defaults assume
Claude Code. A repository driven by Codex, Cursor or another agent trips on each:

1. **Context and laws read `CLAUDE.md` only.** `paths.context` defaults to `['CLAUDE.md']`
   (`kit/lib/config.ts:189`), and the invariants heading behind `laws.source: claudeMdInvariants` is
   read from a hardcoded `CLAUDE.md` (`kit/lib/laws.ts:51`, `kit/lib/init/detect.ts:82`). A
   repository whose agent instructions live in `AGENTS.md`, the file Codex, Cursor, Copilot and
   Gemini CLI read, gets no context files, and `omni init` never finds its invariants.
2. **The session id comes from Claude Code alone.** `omni dossier open` tags a draft with
   `CLAUDE_CODE_SESSION_ID` (`kit/lib/env/read.ts:17`), so that the Omni page links the terminal's
   questions and work to the draft, and a later push finds the session's own draft. Under any other
   agent the variable is unset: the draft opens unlinked.
3. **Hooks are steered to an alias, not a shared folder.** A flow hook under `.claude/` is refused
   with "mark it `{ path, alias: claude }`, or move it out of `.claude/`"
   (`kit/lib/flow/schema.ts:46`). It names no place to move it to, while `.agents/` has become the
   folder several agents share (Codex and Cursor read `.agents/skills/`).

This PRD is the first step toward a kit any coding agent drives. The rest, installing through
`claude plugin`, the plugin's `hooks.json`, the Claude tool names inside the skills, skills under
`.agents/skills/` and a CLI step runner, is the follow-up PRD.

## Solution

Three changes, each additive: a repository that set its own values sees no difference, and nothing
changes for a Claude Code session.

### 1. `AGENTS.md` first

- `paths.context` defaults to `['AGENTS.md', 'CLAUDE.md']`. A file of the list that does not exist
  is skipped, as today.
- The invariants heading (`laws.claudeMdHeading`) is looked up in the files of `paths.context`, in
  order: the first file that exists and holds the heading line is the one read. `lawsFor`
  (`kit/lib/laws.ts`) and `detectLawsSource` (`kit/lib/init/detect.ts`) share one helper for it.
  A repository whose `paths.context` does not name `CLAUDE.md` no longer has its `CLAUDE.md` read
  for invariants.
- The names `laws.claudeMdHeading` and `claudeMdInvariants` stay as they are, so every config that
  sets them still reads. Their doc comments, the init config text and the outbox's comment say
  "the context files" in place of "CLAUDE.md".
- The phase-0 policy counts `AGENTS.md` as a document through the new default, with no change of
  its own.

### 2. A session id any agent has

The session id a command uses is, in this order:

1. `OMNI_SESSION_ID`, when it is set and safe;
2. `CLAUDE_CODE_SESSION_ID`, when it is set and safe;
3. the id stored for this checkout in `.omni-loop/local/session.json` of the main checkout;
4. none.

`omni dossier open`, when steps 1 to 3 give none, generates an id (a random UUID), stores it in
that file and sends it. Every later command of that checkout, from any of its worktrees, reads it
back at step 3. Only `dossier open` writes the file; `dossier push`, `omni now` and the session
record `kit/bin/omni.ts` keeps read it.

- `kit/lib/env/read.ts`: the group `claudeSession` becomes `agentSession`, read from
  `OMNI_SESSION_ID` then `CLAUDE_CODE_SESSION_ID`. `OMNI_SESSION_ID` is a variable a person sets, so
  it joins `VARIABLES` and the root README's list (`scripts/env-docs.test.ts`); Claude Code's stays
  in `PLATFORM_VARIABLES`.
- The wire field the Omni page reads, `claudeSessionId`, and the draft record's field keep their
  names: the API contract changes in the follow-up PRD.
- "Safe" is today's rule (`claudeSessionOf`, `isSafeId`): 1 to 200 characters, trimmed.

### 3. Hooks in `.agents/`

- A flow hook under `.claude/` is refused with: `<path> sits under .claude/, which only Claude Code
  reads — move it to .agents/hooks/, or mark it { path: <path>, alias: claude }`.
- A hook under `.agents/` is a plain path, as it is today: no alias.
- `alias: claude` stays the one alias, for what only Claude Code reads (a slash command such as
  `pr.openWith: /create-pr`, a file under `.claude/`). Its doc comment says so.
- `docs/guide/flow.md` › **Not tied to one agent** recommends `.agents/hooks/` for hook files, and
  its refusal example shows the new line.

## Decisions

- **Scope: quick wins only** (the person's answer: "BRAINSTORM a PRD for quick wins only - to make
  the full version agnostic after"). Install, `hooks.json`, skill tool names, `.agents/skills/`,
  the `worktrees` default and the wire field are left to the follow-up PRD.
- **`.agents/`, not one alias per agent.** The person asked "isn't it .agent the folder nowadays
  ??? and can't we redirect each agent towards the .agent": hooks are plain files any agent reads,
  so they are steered to `.agents/hooks/`, and no `codex`, `cursor` or other alias is added. Pulling
  skills into `.agents/skills/` was offered and declined for this PRD.
- **Config names kept.** `claudeMdHeading` and `claudeMdInvariants` keep their names: renaming them
  would break every config that sets them, for a word.
- **A generated session id, per checkout.** The voice objected at the design (persona:B-E DEv):
  *"An env var I have to export myself in every Codex terminal won't get set. If omni can't link my
  session on its own, my dossier stays empty and this quick win does nothing for me."* Settled
  `accepted`: `omni dossier open` generates and stores an id when no variable gives one.
- **Stored in the main checkout.** The file sits beside the drafts `dossier open` already records
  there, so a push from any worktree of the checkout finds the same id and the same draft.
- **Proof video: no.** Nothing here shows in a browser.

## User stories

- As a developer driving the loop with Codex, my repository's `AGENTS.md` is read as context, and
  `omni init` finds the invariants it lists.
- As that developer, the draft dossier my brainstorm opens is linked to my checkout without my
  setting anything, and the push from my feature worktree finds it (persona:B-E DEv).
- As a team lead whose people use several agents, I set `OMNI_SESSION_ID` in a wrapper script and
  every agent's session is tagged the same way (persona:Lead Engineer).
- As a repository owner writing flow hooks, the refusal tells me where to put a hook every agent
  reads: `.agents/hooks/`.
- As a Claude Code user, nothing changes: `CLAUDE_CODE_SESSION_ID` is still read, `CLAUDE.md` is
  still a context file.

## Scope

In: the `paths.context` default; the invariants lookup over the context files; the session id
order, the generated id and its file; `OMNI_SESSION_ID` in the env module and the README; the
`.claude/` hook refusal and its doc comment; `docs/guide/flow.md`; the `omni help` text that names
the Claude session; the rebuilt `kit/dist/`.

Out: `kit/lib/init/plugin.ts` and `kit/lib/update/plugin.ts` (`claude plugin`), the plugin's
`hooks.json` and `$CLAUDE_PROJECT_DIR`, the status line, `plugin-hud`, the skills' tool names
(`AskUserQuestion`, worktree agents, `/loop`), skills under `.agents/skills/`, the `worktrees`
default, `CLAUDE_CODE_REMOTE`, the API's `claudeSessionId` field, the ask-mode and heartbeat hooks
(they read the hook input's `session_id`).

## Test seams

As `omni kb show testing` says: vitest, colocated `*.test.ts`, no network, no GitHub, fixtures in
temporary folders.

- **Context files:** a fixture with only `AGENTS.md` holding the heading reads its ADRs as
  invariants; one with both files reads the first in `paths.context` that holds the heading; one
  whose `paths.context` omits `CLAUDE.md` does not read it; `detectLawsSource` returns
  `claudeMdInvariants` for an `AGENTS.md`-only repository. The config test asserts the new default.
- **Session id:** `readEnv` with `OMNI_SESSION_ID` and `CLAUDE_CODE_SESSION_ID` both set gives the
  first; with Claude's only, Claude's; with neither, none. `dossier open` with neither sends a UUID
  and writes `session.json` in the main checkout; a second `open` and a `push` reuse it; with
  `OMNI_SESSION_ID` set, nothing is written. The fake Omni page (`kit/test/fake-ask-server.ts`)
  records the id each call sent.
- **Hooks:** `hookRefProblem` on `.claude/hooks/x.md` returns the new line; on `.agents/hooks/x.md`
  returns `null`; `{ path: .claude/hooks/x.md, alias: claude }` still passes.
- **Env docs:** `scripts/env-docs.test.ts` passes with `OMNI_SESSION_ID` in the README's list.
- The full `pnpm test`, `pnpm lint` and `pnpm typecheck` stay green; `kit/test/dist.test.ts` with
  the rebuilt bundle.

## Risks

Merging publishes the kit change on `main`; the release workflow's version commit follows and
installs pick it up on `omni update`. Rollback is reverting the merge commit; the only state it
leaves is `.omni-loop/local/session.json` on computers that opened a dossier, which nothing reads
after the revert.

- **A repository relying on `CLAUDE.md` invariants with a custom `paths.context`** that leaves
  `CLAUDE.md` out stops reading them. Rare (the default and every `omni init` keep it); the release
  note names it.
- **One generated id per checkout, not per terminal.** Two non-Claude sessions in the same checkout
  share it, so their drafts look like one session's. `chooseDraft` still matches a draft by PRD
  number first, and `OMNI_SESSION_ID` separates them for whoever needs it.
- **A Claude Code session never uses the file:** its variable wins at step 2, so its drafts stay
  tagged as today.

## Acceptance criteria

1. `omni config paths.context` in a repository with no `paths.context` prints
   `["AGENTS.md","CLAUDE.md"]`.
2. With `laws.source: claudeMdInvariants` and the invariants heading in `AGENTS.md` only, an ADR it
   lists floors an outbox item high; with the heading in both files, the first file of
   `paths.context` that holds it is read.
3. `omni init` in a repository whose `AGENTS.md` holds the invariants heading proposes
   `laws.source: claudeMdInvariants`.
4. With `OMNI_SESSION_ID=abc` and `CLAUDE_CODE_SESSION_ID=xyz` set, `omni dossier open` sends
   `abc`; with only the second, `xyz`.
5. With neither set, `omni dossier open` sends a generated id and stores it in the main checkout's
   `.omni-loop/local/session.json`; a second `omni dossier open` and an `omni dossier push` from a
   worktree of that checkout send the same id.
6. `omni check config` refuses a flow hook at `.claude/hooks/x.md` with a line that names `.agents/hooks/`,
   accepts `.agents/hooks/x.md` as a plain path, and still accepts
   `{ path: .claude/hooks/x.md, alias: claude }`.
7. The root README's list of environment variables names `OMNI_SESSION_ID`, and
   `docs/guide/flow.md` recommends `.agents/hooks/`.
8. `pnpm test`, `pnpm lint` and `pnpm typecheck` are green, and `kit/dist/` is rebuilt.
