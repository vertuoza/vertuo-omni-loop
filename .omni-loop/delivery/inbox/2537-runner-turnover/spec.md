---
prd: 2537
title: A runner turns over to another account or agent when one runs out
blocked-by: none
spec: file
phase0: server
---

# A runner turns over to another account or agent when one runs out

**Date:** 2026-10-27 · **PRD:** #2537 · **After:** PRD 1830 (runners), PRD 1894 (the Claude token
for jobs), PRD 2102 (runner health and tokens), PRD 1890 (the kit's skills for other agents) · **Uses:** T3 Code 0.1.x
(`t3`, MIT) on the runner's machine
· **Touches:** `kit/lib/runner/` (`job.ts`, `runner.ts`, `api.ts`, `terminal.ts`, `plugin.ts`,
`tokens.ts`, `steps.ts`, new `agents/` and `accounts.ts`), `kit/bin/commands/runner.ts`,
`kit/lib/env/read.ts`, `apps/galaxy/src/runners/` (contract, service, repository, page),
`supabase/migrations/` (one migration), `docs/guide/runners.md`, the `runners` draft screen.
**Out of scope:** a cost in dollars from a price list, a journal that resumes a job after the
runner restarts, a machine image and placement labels, a pool of accounts kept on the server, the
scripts that set up a particular machine, and any agent beyond Claude Code, Codex CLI and OpenCode.

## Problem

A runner (PRD 1830) runs every job with one agent and one account: `omni runner job` starts
`claude -p` (`kit/lib/runner/job.ts`), and the job gets the runner's one token as
`CLAUDE_CODE_OAUTH_TOKEN` (PRD 1894). When that account reaches its plan's 5-hour or weekly limit,
Claude prints its limit message and exits non-zero, the job reads `failed · exit code 1`, and every
job the runner takes after it fails the same way until the limit resets. Nothing on the Runners page
says why, and nothing tries another account. A fleet that drives a roadmap loses hours to one
account running out.

The kit already speaks to other agents: it writes its skills for Codex and other CLIs (PRD 1890).
But a runner can only start Claude, so a workspace that pays for Codex, or that can call an
open-weight model through OpenCode, cannot use them for its runner's jobs.

## Solution

### 1. Agents behind one adapter (`kit/lib/runner/agents/`)

An **agent** is how the runner runs one account's work. There are two adapters, with one shape:

| part | what it does |
|---|---|
| `check(account)` | the account can run now, or one line saying why not |
| `command(job, account, handoff?)` | the program, arguments, environment and stdin for one run in the job's worktree |
| `step(event)` | one event of the run turned into the step line the log and the Terminal show, or nothing |
| `usage(run)` | the run's tokens (`{input, output, cacheRead, cacheWrite}`) and the model's name, or `null` |
| `limit(run)` | whether the run ended on the account's usage limit, and the reset time when the agent says one |
| `pressure(run)` | read while the run goes: the account's usage (a percent, or a warning status) with its reset time, and the run's context (`{used, window}` tokens), each `null` when the agent does not say |
| `session(run)`, `interrupt(run)` and `resume(job, account, session, prompt)` | the run's session, a clean stop when the agent offers one (else `null`), and the command that continues that session with one more message |

- **`t3`, the default agent: T3 Code runs the coding CLIs.** T3 Code (MIT, `t3` on npm) is a
  server on the runner's machine that drives Claude Code (through the Claude Agent SDK), Codex
  (through its app-server), OpenCode and others, each **provider instance** signed in to one
  account (its own Claude config folder, `CODEX_HOME` or provider key, kept by T3 in files only its
  user reads). The runner talks to it only through its command line, on the same machine:
  - **A run** is `t3 thread start <worktree> - --provider <instance> --model <model> --wait --json`,
    the message on stdin. It prints `{threadId, runId, status, reply, error}`; exit 1 is a run that
    failed or stopped, exit 2 a run that waits for an answer, which the job treats as failed with
    that reason. A thread runs in T3's **Full access** mode, as a job runs Claude today.
  - **Step lines** come from `t3 thread show <thread> --json`, read every 5 seconds while the run
    goes: each new message becomes a step line. They are coarser than today's: a message, not every
    tool call.
  - **The limit** is the thread's run ending with T3's usage-limit class and its reset time
    (T3 reads Claude's `rate_limit_event` and Codex's `usageLimitExceeded` and rate limits itself).
  - **Pressure** is the instance's usage percent per window and the thread's context use, as T3
    exposes them to its own machine. A reading T3 does not expose to the command line or its MCP
    endpoint on the host is `null`, and that trigger does not fire for this agent (section 3).
  - **Resume** is `t3 thread send <thread> -`; **interrupt** is T3's own stop of the active run when
    the host can call it, else `null`.
  - **Tokens** are counted from each instance's transcripts, as PRD 2102 counts Claude's (the
    instance's Claude config folder, its `CODEX_HOME` sessions), for the job's worktree: the command
    line's output carries none.
  - T3 keeps its own retry after a reset **off** (its `autoResumeLimitedThreads` setting): the runner
    decides what happens after a limit.
- **`claude`, the fallback: Claude Code run directly**, today's code moved behind the shape:
  `claude --dangerously-skip-permissions -p --output-format stream-json --verbose`, the job line on
  stdin, the token as `CLAUDE_CODE_OAUTH_TOKEN`, tokens from the transcripts (PRD 2102), the step
  lines of `steps.ts`. Its limit is the usage-limit result in its stream; its pressure is the
  stream's `rate_limit_event` (`allowed_warning`, with `resetsAt` and its window; no percent) and the
  last assistant message's tokens against the model's window; it resumes with `claude -p --resume
  <session>` and interrupts with `SIGINT`. It is what a runner with no accounts file uses, and what
  an account names to work without T3.
- **The job line.** A Claude instance gets the line as it is (`/omni:yolo 7`): the trial on T3 0.1.3
  showed a T3 Claude thread lists every `/omni:` skill of the installed plugin. Codex and OpenCode
  instances get it as words: `Use the omni-yolo skill with these arguments: 7`. A repository's own
  skill (PRD 2313) runs on a Claude instance only.
- **The skills for Codex and OpenCode.** Before a job on such an instance, the runner writes the
  kit's skills, of the version the job's repository pins, in that instance's own skills folder
  (`<CODEX_HOME>/skills/omni-*`, which Codex lists through its app-server; OpenCode's global skills
  folder), the way it keeps the Claude plugin current today (`plugin.ts`). It never writes them in
  the worktree. An instance whose agent reads no skills folder outside the repository takes no job,
  and its account reads `no skills`.
- **Recordings.** Each adapter is tested against recorded output in `kit/lib/runner/fixtures/`: the
  `t3` command line's JSON (a run done, failed, at its limit, waiting for an answer, `thread show`
  pages), and Claude's stream. Output that does not parse is a step line printed as it is, never a
  crash.

### 2. Accounts (`kit/lib/runner/accounts.ts`)

A runner reads its accounts from `~/.config/omni/accounts.yml`, a file on the machine, never in a
repository:

```yaml
accounts:
  - id: claude-1
    instance: claude-1                          # a T3 provider instance, signed in in T3
    model: claude-opus-5-5
  - id: claude-2
    instance: claude-2
    model: claude-opus-5-5
  - id: codex-1
    instance: codex-1
    model: gpt-5-codex
  - id: open-1
    instance: opencode-mistral
    model: mistral/devstral-medium-latest
    budget: 20000000                            # tokens a day
    takes: [pr-care, plan, bug-fix]
  - id: claude-direct
    agent: claude                               # without T3, as today
    secret: ~/.config/omni/secrets/claude-direct
handoff:
  usage: 90                                     # percent of a usage window (default 90)
  context: 75                                   # percent of the model's context window (default 75)
```

- **An account with `instance`** runs through T3; its `agent` is `t3` and needs no secret: the
  sign-in lives in T3's instance. **An account with `agent: claude`** runs Claude directly, with its
  `secret`.
- **The order is the order of the file.** A job starts on the first account that is ready, whose
  `takes` allows the job's skill (no `takes`: any skill), and whose agent passed its check.
- **`takes`** names the skills of `RUNNABLE_SKILLS` (`kit/lib/runner/line.ts`) an account may run or
  take over. A name outside that list is refused when the runner starts.
- **No file:** the runner has one account, `claude` run directly, from the token it reads today
  (`CLAUDE_CODE_OAUTH_TOKEN`, `kit/lib/env/read.ts`). A runner set up before this PRD runs exactly
  as it did, and needs no T3.
- **`handoff`** sets the two planned thresholds, in whole percents from 50 to 99; `budget` (tokens a
  day) is a whole positive number. Each is optional.
- **A malformed file** stops `omni runner` before it registers, naming the account and the field.
- **States.** Each account is `ready`, `active` (a job runs on it), `out` until a reset time, or
  `unusable` with a reason (`not signed in`, `no skills`, `T3 not running`, `no such instance`). The
  runner keeps the states in `~/.config/omni/accounts-state.json`, so a restart remembers an account
  that is out. At its reset time an `out` account is `ready` again.
- **Secrets stay on the machine.** A direct account's secret is read from its file when a run starts
  and passed to that run's process only; a T3 account's stays in T3. None enters the report, the
  log or the handoff note; the runner masks it in every line it streams, as it does a GitHub App
  token.

### 3. Handoffs, in the middle of a job

A **handoff** ends one run of a job and starts the next one in the **same worktree**, with a note
that says where the job stands. Three things start one:

| trigger | when | the next run |
|---|---|---|
| **usage** (planned) | `pressure` reads the account's usage at or above `handoff.usage` (90 % by default), or Claude's `allowed_warning`, or an OpenCode account's day past its `budget` | the next account (below); this one is `out` until the reset time the pressure named |
| **context** (planned) | `pressure` reads the run's context at or above `handoff.context` (75 % of the model's window by default) | a fresh session on the **same** account |
| **limit** (the wall) | the run ends and `limit(run)` says the account hit its limit | the next account; this one is `out` until the reset time the CLI gave, or for one hour when it gave none (the report says the time was guessed) |

**A planned handoff, step by step:**

1. The runner stops the run through its adapter's `interrupt` (Claude direct: `SIGINT`, then `SIGTERM`
   after 30 s; T3: its stop of the active run). The session is kept. An agent whose `interrupt` is
   `null` hands off at the wall only, and its planned triggers are not read.
2. **The agent writes its own note.** The runner resumes that session on the same account for one
   turn, with the message `Write the handoff note for whoever continues this job to <path>: what is
   done, what is next, the pull requests and branches open, and every decision you took. Change no
   other file.` The turn has 5 minutes. `<path>` is `job-<id>.handoff.md` beside the job's log,
   never in the worktree.
3. **The runner's note is the fallback.** When that turn fails, times out or writes nothing (an
   account already at its wall, a session the CLI lost), the runner writes the note itself: the job
   line, the last 40 step lines, `git status --short`, `git log --oneline` since the job's start,
   `git worktree list`, and the pull requests the log named. After a **limit**, the runner always
   writes the note itself: the account has no turn left.
4. **The next run starts** with the job line, then `You are taking over this job from <agent>
   (<model>) because <why>. Here is where it stopped:`, then the note. `<why>` is `its account
   reached 91 % of its 5-hour window`, `its context was 78 % full` or `it reached its usage limit`.

**The next account** is the next one, in the file's order, that is ready, whose `takes` allows the
job's skill, and whose agent passed its check. None left ends the job `failed` with the reason `no
tokens left: every account is out until <earliest reset>`.

**Caps.** A job changes account at most **three** times and opens at most **five** fresh sessions
for context; past either, the next trigger ends the job `failed`, naming it. A pressure read once
starts one handoff: the runner reads none while a handoff runs.

A run that ends non-zero without a recognised limit fails the job as today: a crash never hands
off.

### 4. Paused: no tokens left

When no account is ready for any skill, the runner pauses as it does under machine pressure
(PRD 2102): it opens no new `next`, and its health report's `paused` reads
`no tokens left until 18:00`. It takes jobs again once one account is ready.

### 5. The reports (runner to server)

- **A job's parts.** Each job report (`POST /api/runners/jobs/<id>`) carries an optional `parts`
  list, one entry per run:

  ```json
  "parts": [
    { "agent": "claude", "model": "claude-opus-5-5", "account": "claude-1",
      "from": "2026-10-27T13:41:02Z", "to": "2026-10-27T14:02:11Z",
      "tokens": { "input": 912000, "output": 61000, "cacheRead": 3100000, "cacheWrite": 240000 },
      "ended": "usage", "resetsAt": "2026-10-27T18:00:00Z", "guessed": false, "note": "agent" },
    { "agent": "codex", "model": "gpt-5-codex", "account": "codex-1",
      "from": "2026-10-27T14:02:15Z", "to": null,
      "tokens": { "input": 380000, "output": 23000, "cacheRead": 110000, "cacheWrite": 0 },
      "ended": null }
  ]
  ```

  `ended` is `usage`, `context`, `limit`, `done`, `failed` or `null` while it runs, and `note` is
  `agent` or `runner` for a part that handed off: who wrote its note. The job's `tokens` stays the sum of
  its parts, so a page that reads only `tokens` keeps working.
- **The accounts.** The health report (`POST /api/runners/<id>/health`) carries an optional
  `accounts` list: `{ id, agent, state, resetsAt?, reason? }`. An account's id is the name its owner
  wrote; nothing else about it leaves the machine.
- **An old server.** Both fields are optional. As with `tokens` in PRD 2102, the runner sends them
  only once the server accepted one report carrying them, and a report refused once is sent again
  without them.

### 6. Storage (one migration)

- `runner_jobs.parts jsonb null`.
- The accounts ride in `runners.health`, which is already `jsonb`: no column.

### 7. The Runners page

- **A runner's row** gains its account chips under the health line, in the file's order: the id, in
  the ink colour when ready, in the signal colour when active, in `--ask-red` when out or unusable,
  each titled with its agent and its state (`out until 18:00`, `not signed in`).
- **Paused: no tokens left until 18:00** reads in place of Online or Busy, as a pause for memory
  does.
- **A job's row** names its agent and model beside its status (`codex · gpt-5-codex`), and, when it
  handed off, a line per part: `claude-1 · Opus 5.5 · 13:41–14:02 · usage 91 %` then
  `codex-1 · gpt-5-codex · since 14:02`. The reason reads `usage <n> %`, `usage warning`,
  `context <n> %` or `usage limit`.
- **A queued job** that every possible runner holds back for tokens reads `Waiting: every runner out
  of tokens until 18:00`, beside PRD 2102's reasons.

### 8. The pull request names its parts

A job that turned over has `/omni:pr` add one line to its pull request's status comment, written by
the runner through the job's environment (`OMNI_RUNNER_PARTS`, the parts in one line): `Parts:
claude (Opus 5.5) until 14:02 · codex (gpt-5-codex), usage limit`. A job that never turned over adds
nothing.

### 9. The guide

`docs/guide/runners.md` gains **Accounts and handoffs** under **Set up a new runner**: installing
T3 Code as a service on the machine (`t3 service install`, bound to loopback or the tailnet), adding
one provider instance per account and signing each in, T3's retry after a reset left off, the
accounts file, the order, `takes`, the handoff thresholds, what the chips and `Paused: no tokens
left` mean, and rows in **When something goes wrong** (`no skills`, `not signed in`, `T3 not
running`).

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| this | cli | `kit/lib/runner/agents/<agent>.ts`, one module per agent | no written convention: follows `kit/lib/runner/` (one module per concern) |
| this | cli | `accounts.yml`, `accounts-state.json` under `~/.config/omni/` | no written convention: follows `~/.config/omni/runner-token` (the runner guide, "Make a token") |
| this | db | `runner_jobs.parts` | no written convention: follows `runner_jobs.tokens` ← `supabase/migrations/20261212090000_runner_tokens.sql:17` |
| this | ui | `parts`, `accounts` in the contracts | follows `tokens` in `JobUpdateSchema` ← `apps/galaxy/src/runners/runners.contract.ts` |

## Decisions

- **T3 Code runs the agents, behind the adapter; `omni runner` keeps the jobs and the handoffs.**
  The person chose this after a trial of T3 0.1.3 on a laptop (2026-10-27): `t3 thread start …
  --wait --json` ran a Claude thread headless in Full access and returned its status, and that
  thread listed every `/omni:` skill. T3 already keeps several accounts per provider, reads Claude's
  and Codex's limits with their reset times, and shows usage per account, which the first plan built
  as three adapters. It does **not** move a thread to another instance when one runs out (its resume
  refuses another instance), and its command line returns no tokens and no live steps: those stay
  the runner's. The direct Claude adapter stays, so a runner works without T3, and a T3 that breaks
  never stops it. Over the first plan's three direct adapters (Claude, `codex exec`, `opencode run`)
  and over a client of the Agent Client Protocol.
- **Turnover in the middle of a job.** The person chose this over failing and requeuing, and over
  turning over only between accounts of one agent. One pull request may hold two agents' work; the
  page and the pull request name each part.
- **Accounts kept on each runner.** The person chose this over a pool on the server: secrets never
  leave the machine.
- **The voice's objection, accepted.** The F-E Developer (persona:F-E Developer) objected that a
  weaker open model finishing what Claude started puts slop in a pull request nobody can attribute.
  The design now names every part on the pull request and the page, and an account's `takes` limits
  which skills it may run or take over (an open model on `pr-care`, `plan` and `bug-fix` only).
- **The third agent is OpenCode with a hosted open-weight model in the EU.** The person chose a
  hosted model over a GPU machine of the workspace's own. The model is the account's setting, so a
  machine of its own can replace it later with no change to the kit.
- **The skills in the agent's own folder, never in the worktree.** This repository's agents are
  `claude` only, so no `.agents/skills` exists in it: the approved rule ("a repository without them
  skips that agent") would never use Codex here. Writing them in the account's own folder, at the
  repository's pinned version, mirrors how the Claude plugin is kept, and no skill file can enter a
  pull request. Changed after the design was approved; the person reviews it with the spec.
- **One hour when no reset time is given; three turnovers at most.** The most reversible choices,
  taken without asking: each is one constant.
- **Planned handoffs on usage and context, before the wall.** The person chose this after reading
  the first plan, which only turned over once a run had hit its limit. Usage hands off to another
  account; context hands off to a fresh session of the same account, on top of the CLIs' own
  compaction.
- **The outgoing agent writes its note; the runner's note is the fallback.** The person chose this.
  The agent knows what it decided and what is next; the runner can only read the log and git. After
  the wall the agent has no turn left, so the runner writes it.
- **Claude run directly hands off on `allowed_warning`, not a percent.** Headless Claude Code
  reports a status and a reset time, not a percent; its percent is only given to the status line.
  Through T3, the trigger is the instance's percent wherever T3 shows it on the machine.
- **90 % usage, 75 % context, three account changes and five fresh sessions.** The most reversible
  choices, taken without asking: each is a default or one constant.
- **The same worktree, nothing pushed at turnover.** A push needs the repository's hooks to pass on
  half-done work, and the next agent is on the same machine. Pushing and resuming after a restart
  belong to the restart journal, a later PRD.
- **A repository's own skill runs on Claude only.** It may rely on Claude's tools; it is the most
  reversible choice.

## User stories

- As the person who runs the fleet, I list two Claude accounts, one Codex and one open model on a
  runner, and a roadmap I drive overnight keeps moving when the first Claude account hits its weekly
  limit.
- As a PM, I see on the Runners page that `/omni:yolo 2513` ran on Claude until 14:02 and then on
  Codex, and why.
- As a front-end developer reviewing the pull request, I read which agent did which part, and I know
  the open model never touched a `yolo`.
- As a lead engineer, I see `Paused: no tokens left until 18:00` on a runner, and I know the loop
  waits on a limit, not on a bug.

## Scope

**In:** the T3 adapter and the direct Claude adapter, the kit's skills for Codex and OpenCode instances, the accounts file and its states, turnover with the handoff note, the
pause, the `parts` and `accounts` reports, the migration, the Runners page's chips and parts, the
pull request's parts line, the guide's section, the `runners` draft screen.

**Out:** what the header lists.

## Test seams

Tests live beside the code (`omni kb show testing`). None calls a real agent CLI, GitHub or
Supabase: each CLI is a fake program on the `PATH` that replays a recording from
`kit/lib/runner/fixtures/`.

- **Each adapter** (`kit/lib/runner/agents/*.test.ts`), against a fake `t3` and a fake `claude` on
  the `PATH` that replay recordings: `command` for a job and for a takeover, `step` on each recorded
  event (T3: new messages of `thread show`), `usage` summed from recorded transcripts, `limit` on a
  recorded limit (with and without a reset time), exit 2 (waiting for an answer), a crash that is not
  a limit, T3 not running, an unknown instance, and output that does not parse.
- **`accounts.test.ts`:** the file read, each malformed field refused with its account and field,
  `takes` outside `RUNNABLE_SKILLS` refused, no file giving today's one Claude account, states kept
  across a restart, an `out` account ready again at its reset time.
- **Handoffs** (`job.test.ts`, `turnover.test.ts`): a recorded Claude limit, then a fake Codex that
  finishes: two parts, the note beside the log and not in the worktree, the takeover message, the job
  `done`. A recorded `allowed_warning` and a Codex `used_percent` of 91: the run interrupted, the
  session resumed for the note, the next account started with it. A context at 76 %: a fresh session
  on the same account. A note turn that fails or times out: the runner's note, `note: runner`. Also:
  a crash does not hand off; `takes` skips an account; the caps end the job naming them; a secret
  never appears in the log, the note or a report.
- **The skills** (`plugin.test.ts`): written in the account's folder at the pinned version, never in
  the worktree; `no skills` when the agent reads none.
- **The pause** (`runner.test.ts`): every account out opens no `next`, and the runner resumes at the
  earliest reset.
- **`runners.contract.test.ts`:** `parts` and `accounts` valid and invalid, and an old runner's
  reports still valid.
- **Controller, service and migration tests:** `parts` stored, accounts kept in `health`, the column
  and its row-level security unchanged.
- **Page model and render tests:** each chip state, `Paused: no tokens left`, a job's agent and
  parts, and the queued reason.
- **Mutation:** `kit/lib/env/read.ts` is in the delivery core: `pnpm mutation:changed` runs on it.

## Risks

**What a merge publishes:**
- **The kit.** Every runner that runs `omni update` gets the adapters. A runner without an accounts
  file runs as before.
- **The migration.** One nullable column, applied by the `supabase` workflow.
- **The arcade.** The Runners page and the contracts deploy with the release commit.

**Order:** an old runner sends no `parts` and no `accounts`, and its row shows nothing new. A new
runner against an old server sends neither until the server accepts them (Solution, 5).

**Agents:**
- **Mixed work in one pull request.** Named on the pull request and the page; limited by `takes`;
  every gate still runs, and only a person merges.
- **A CLI changes its output or its limit message.** The adapter then misses the limit and the job
  fails as today; the recordings make the change a red test once a recording is refreshed.
- **A planned handoff interrupts a run mid-step.** A file may be half edited; the worktree is kept as
  it is, and the note says what was under way. The pressure signals are the CLIs' own and may change
  without notice: a signal the adapter no longer reads only means no planned handoff, and the wall
  still turns over.
- **T3 is alpha (0.1.x, nightly builds) and promises no stable interface.** The runner uses only its
  command line on the same machine, pins the version the guide names, and every T3 output it reads is
  a recording in the tests: a change shows as a red test when a recording is refreshed. A T3 account
  that fails its check is `unusable`, and the next account, a direct Claude one included, takes the
  job.
- **Coarser step lines through T3.** A step is a message, not every tool call: the Terminal view
  shows less while a T3 run goes.
- **Codex and OpenCode have no sub-agents like Claude's.** A wave on them builds its slices one
  after another, as the briefing's **Parallel agents** says: slower, not wrong.
- **T3 runs agents in Full access** on the runner. A runner is a machine dedicated to agents, with
  no production credentials (the runner guide); this is the same trust Claude gets today. T3 binds
  to the machine's loopback (or its tailnet address) only.
- **Accounts and plans.** Turning over between several subscription accounts of one provider may
  break that provider's terms. The guide says to use a seat or a key per account; the kit does not
  check it.

**Rollback:** revert the merge commit. The column stays, unused. A runner with an accounts file
then runs on Claude only, from `CLAUDE_CODE_OAUTH_TOKEN` when it is set.

**The Legal entries it touches:**
- **L-GDPR-2** (credentials never stored or logged in clear): a direct account's secret stays in a
  file on the machine and is passed to the run's process only; a T3 account's sign-in stays in T3's
  files, readable by its user only. Every streamed line is masked; the report names an account by
  its id only.
- **L-GDPR-5** (every service handling personal data on the product's behalf is named): the
  accounts are the workspace's own, chosen and paid by it on its own machine, as Claude is on a
  runner today; no data goes to OpenAI or Mistral on the product's behalf. Whether the guide must
  still name them is a question for its owner, @pierrederval.
- **L-GDPR-7** (a basis for transfers outside the EU): the guide's example open model is hosted in
  the EU; what a workspace's accounts send is the workspace's choice.
- **L-GDPR-4** (logs have a cap or a retention): a handoff note lives beside its job's log and goes
  with it.
- **L-AIACT-1** (agents' work says so): the parts line names the agents; every commit and pull
  request stays signed as today.

**The locked laws.** `omni kb laws` printed these for the files this design changes; the design
keeps each one as it stands (accounts and parts are read only by the runner's workspace members,
under row-level security, and no secret reaches the browser):

- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind, and nobody can tell what was decided. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, and players could no longer trust what they earned. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository, so each criterion becomes ordinary tests.

1. **No accounts file, no change.** A runner with no `accounts.yml` runs a job on Claude with its one
   token, exactly as before, and its report carries one part.
2. **Turnover at the wall.** On a runner whose first account hits its usage limit mid-job, the job
   carries on in the same worktree on the next ready account. It ends `done` with two parts, and the
   first account reads `out until <reset>` on the Runners page.
3. **A planned handoff.** On an account whose usage reaches `handoff.usage` (or Claude's warning),
   the run stops, the same session writes the handoff note, and the next account carries on from it;
   the part reads `note: agent`. When the note's turn fails, the runner's note is used.
4. **A fresh session for context.** A run whose context reaches `handoff.context` hands off to a new
   session of the same account, with the agent's note.
5. **`takes` is kept.** An account whose `takes` leaves out the job's skill neither starts nor takes
   over that job.
6. **A crash is not a limit.** A run that fails without a recognised limit fails the job, and no
   other account starts.
7. **Out of tokens.** When every account is out, the job fails with `no tokens left: every account
   is out until <earliest reset>`, the runner reads `Paused: no tokens left until <time>` and takes
   no job, then takes jobs again after the earliest reset.
8. **Secrets stay.** No account secret appears in a report, a log line, the handoff note or the
   page.
9. **Parts on the pull request.** A job that turned over has its pull request's status comment name
   each agent, model and why it turned over.
10. **Codex and OpenCode run the kit's skills** from their own folders, at the repository's pinned
   version, and no skill file appears in the job's pull request.
11. **Through T3.** An account with `instance` runs its job as a T3 thread in the job's worktree; a
   runner whose T3 is not running reads its T3 accounts `unusable · T3 not running` and runs the job
   on its next account, a direct Claude one included.
