---
prd: 1665
title: The kit reads the loop's state from the Omni page, not from gh
blocked-by: none
spec: file
phase0: server
---

# The kit reads the loop's state from the Omni page, not from gh

**Date:** 2026-10-12 · **PRD:** #1665 · **After:** PRD 71 (the kit's sign-in), PRD 1628 (kit
tokens), ADR-0095 (the galaxy's layering) · **Touches:** `apps/galaxy/src/loop/` and
`apps/galaxy/app/api/loop/` (new), `kit/lib/loop-reads/` (new), the read calls of
`kit/bin/commands/board.ts`, `next.ts`, `care.ts`, `roadmap.ts`, `statusline.ts`, `dossier.ts` and
`flow.ts` with `kit/lib/roadmap/push.ts` and `kit/lib/now/build-links.ts`, `kit/bin/github.ts` (its
read helpers), a guard test, and the kit README.
**Out of scope:** every write to GitHub (comments, labels, `care reply`, creating, editing, readying
or merging pull requests), git itself, and the setup and maintenance commands (`init`, `update`,
`version`, `credits`, `harvest`, `targets`, `plan moved`), which keep `gh` for now.

## Problem

The commands that decide what to plan or run next read GitHub through the `gh` CLI, most of them
through GitHub's GraphQL API: `omni board` (`gh pr list`, `gh pr view`), `omni next` (`gh pr list`,
`gh api graphql`), `omni care` (`gh pr list`, `gh pr view`, `gh issue view`, `gh issue list`,
`gh api graphql`), `omni roadmap`'s gate (`gh pr list`), `omni statusline --refresh` (`gh pr list`),
`omni dossier` (`gh issue view`) and `omni flow` (`gh pr list`, `gh pr view`, `gh pr diff`).

A coding agent without `gh`, or with `gh` refused, cannot drive the loop. On 2026-10-12, in a
Claude Code cloud session, `/omni:yolo 1660` stopped at its first board read: `gh pr list`
answered `HTTP 403: GitHub GraphQL is not available from Claude Code sessions`. The same holds for
any agent that has the kit and HTTPS but not a `gh` signed in to GitHub. Meanwhile the Omni page
already reads every repository a workspace installed, with the GitHub App's installation token,
and the kit already signs in to it.

## Solution

The kit asks the Omni page for the **loop facts** it decides on, in the loop's own words, and the
page alone knows the code host. Today it reads GitHub; the contract carries nothing GitHub-only, so
another host can be added on the server without changing the kit.

### The contract

Each route sits under the kit's existing sign-in (`omni signin`, or `OMNI_TOKEN` traded as today),
takes `repo=<owner/name>`, and answers only when the caller's workspace owns that repository
(`repo_workspace(person, repo)`, checked before any call to the host).

| route | answers |
|---|---|
| `GET /api/loop/changes?repo&base\|head\|label&state=all\|open` | `{changes: [Change]}`, at most 200, newest first |
| `GET /api/loop/changes/<n>?repo` | `Change` with `lastCommitAt`, `files: [path]` and `review: {checks: [{name, state}], mergeable: true\|false\|null, threads: [{id, path, line, resolved, comments: [{author, body, createdAt}]}]}` |
| `GET /api/loop/comments?repo&on=<n>` | `{comments: [{id, author, body, createdAt, updatedAt}]}` |
| `GET /api/loop/issues?repo&label&state` | `{issues: [{number, title, state, labels}]}` |
| `GET /api/loop/issues/<n>?repo` | `{number, title, state, labels, comments, closedBy: [n]}` |

`Change` is `{number, title, head, base, state: open|draft|merged|closed, createdAt, updatedAt,
mergedAt, labels, body, url, author}`. A check's `state` is `pending|success|failure|neutral|skipped`.

### The server

`apps/galaxy/src/loop/`, in ADR-0095's roles: `loop.contract.ts` (the zod shapes, browser-safe),
the routes under `apps/galaxy/app/api/loop/` as controllers (the session first, then
`repo_workspace`), `loop.service.ts` (maps the host's data to loop facts), `loop.repository.ts`
(the workspace check), and the host adapter `loop/github.ts`: the installation token from
`githubApp().installationToken` (kept in memory, as today), REST only through `@omni/github`, so
conditional requests with ETags (`github_etags`) answer an unchanged list with a 304 and spend
nothing of the rate budget (`github_budget`). Review state is read by REST: check runs on the head
commit, `mergeable` from the pull request, and review comments grouped into threads. Nothing new is
stored.

### The kit

`kit/lib/loop-reads/` holds the `LoopReads` port (`changes`, `change`, `comments`, `issues`,
`issue`) and its one adapter on `askClient`, with a 15-second limit for these reads. `board`,
`next`, `care`, `roadmap`, `statusline`, `dossier` and `flow` take a `LoopReads` where they called
`gh` to read; their decisions (`boardFor`, `next`'s verdict, `care`'s state, the roadmap gate) are
unchanged. `kit/bin/github.ts` keeps its write helpers; its read helpers go. There is one read path
everywhere: no `gh` fallback.

### Behaviour

Every command prints what it prints today. A read that cannot be made prints one line on stderr and
exits 1:

| case | line |
|---|---|
| no sign-in, or it expired | `no sign-in (omni signin)` |
| no answer within 15 s | `unreachable` |
| the repository is not the caller's workspace's | `refused (403): <owner/repo> is not in your workspace` |
| the App is not installed, or its token is refused | `refused (424): the Omni app cannot read <owner/repo>: <install link>` |
| the host's rate budget is spent | `refused (429): GitHub's budget for <owner/repo> is spent until <time>` |
| an Omni page without these routes | `refused (404): this Omni page cannot read the loop yet` |

The status line's refresh keeps the last value it drew, as it does today when `gh` fails. The
skills that read the board (`/omni:wave`, `/omni:yolo`, `/omni:next`, `/omni:pr-care`) treat each
line as **held, not failed**, as an unreachable approval already is.

## Decisions

- **The server answers the kit's reads** (approach A of three, reshaped to be portable). Rejected:
  a board computed on the server from webhook-fed tables (the board logic twice, and a board as old
  as the last webhook), and `gh api` REST in place of GraphQL (still needs `gh`).
- **Portable to any coding agent, and later any code host** (the person's goal): the contract names
  loop facts (a *change*, its *review*), never GitHub's objects; only `loop/github.ts` knows GitHub.
- **Omni only, no `gh` fallback for reads** (the person's answer): one path everywhere, so what an
  agent sees locally is what it sees in claude.ai.
- **Every read that decides is in scope** (the person's answer): board, next, care's reads, the
  roadmap gate, statusline, dossier's issue title, flow's open-change checks. Writes, git and the
  setup commands stay as they are.
- **Live, not stored:** each read goes to the host, with ETags; a board read right after a merge
  sees it.
- **The voice's objection, accepted.** B-E DEv: the board now needs a hosted server and a sign-in
  where `gh` was enough, which reads as lock-in. Met by the contract being the open part: the
  server is open core (offering#316), `ask.url` may point at a self-hosted Omni, and the kit README
  says how. The kit depends on the contract, never on omni-loop.xyz.
- **No proof video** (the person's answer).

## User stories

1. As an agent in a Claude Code cloud session, I run `/omni:yolo <n>` and its board reads work
   without `gh`.
2. As a developer using another coding agent with the kit, I run `omni next` and get the same verdict
   I would get in Claude Code.
3. As a team that self-hosts Omni, I point `ask.url` at our server and the kit reads through it.
4. As a developer whose repository is not in my workspace, I get one line saying so, not a stack
   trace.

## Scope

In: the five routes, the GitHub adapter, the contract, the kit's port and adapter, the moved read
calls of the seven commands and their two library helpers, the guard test, the error lines, and
the README.

Out: writes, git, the setup and maintenance commands, any other code host, storing GitHub data.

## Test seams

Every test runs on fixtures: none calls GitHub or Supabase (testing playbook).

| risk | test |
|---|---|
| the contract stays one truth | shared fixtures parsed by `loop.contract.ts` and by the kit's adapter |
| GitHub REST mapped to loop facts: draft vs open, merged vs closed, labels, threads grouped from review comments, check states | unit tests of `loop/github.ts` on recorded REST payloads |
| the routes: session first, `repo_workspace` before any host call, 403 / 424 / 429 / 404, the 200 cap | controller tests on a fake service |
| ETags: a repeated read sends `If-None-Match` and serves the stored body on 304 | through `@omni/github`'s fake |
| the decisions do not move: `boardFor`, `next`, `care`, the roadmap gate give the same result from `LoopReads` fixtures as from today's `gh` fixtures | each command's tests, moved to a fake `LoopReads` built from the same data |
| no `gh` read left on the loop's path | `kit/test/no-gh-reads.test.ts`: none of `gh pr list`, `gh pr view`, `gh pr diff`, `gh pr checks`, `gh issue view`, `gh issue list`, `gh api graphql` in the moved commands and helpers |
| the error lines, each exit 1, and the status line keeping its last value | `main()` with an injected `fetch` |
| layering: the new galaxy files in their roles | `scripts/layering-guard.test.ts` and `scripts/import-guard.test.ts`, with no new baseline line |

`kit/lib/board.ts` is mutation core: `pnpm mutation:changed` runs on the slices that touch it.

## Risks

- **What merging publishes:** the galaxy's `/api/loop` routes on its next production deploy, and a
  kit whose deciding commands need a sign-in and an Omni page that serves them. A kit released
  before the page serves the routes would print `refused (404)` on every board read, so the server
  lands first and the kit after it is deployed.
- **The rate budget:** every board read now spends the App's budget for the repository instead of
  each person's `gh` budget. ETags make unchanged reads free; the 429 line names when it refills.
- **Rollback:** revert the kit's landing to put the `gh` reads back; the routes can stay, unused.

## Acceptance criteria

1. In a Claude Code cloud session with no working `gh`, signed in to the Omni page, `omni board
   <n> --json` prints the board that a local `gh` run prints for the same PRD at the same time.
2. `omni next`, `omni care` (its reads), `omni roadmap`'s gate, `omni statusline --refresh`,
   `omni dossier` and `omni flow` run there too, with the same results as today.
3. Not signed in, each of them prints `no sign-in (omni signin)` and exits 1; a repository outside
   the caller's workspace prints the 403 line; an Omni page without the routes prints the 404
   line.
4. The guard test finds no `gh` read on the seven commands and their helpers, and every write they
   make is unchanged.
5. `GET /api/loop/changes` refuses a repository the caller's workspace does not own before any call
   to GitHub, and never returns the installation token.
6. Reading the same board twice in a row, the second read's GitHub calls answer 304.
7. The kit README says these commands need a sign-in instead of `gh`, and how to point `ask.url` at
   a self-hosted Omni.
