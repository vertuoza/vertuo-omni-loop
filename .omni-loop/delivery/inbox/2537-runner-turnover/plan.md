# Plan: a runner turns over to another account or agent when one runs out

PRD #2537, spec in `spec.md` beside this plan. The feature branch `feat/runner-turnover` merges into
`main` through the feature PR (`Closes #2537`); each slice is a sub-PR from
`feat/runner-turnover--<slice>` into the feature branch (`Part of #2537`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A job runs Claude through the agent adapter, exactly as today: command, step lines, tokens, limit, usage and context pressure, and session resume behind one shape | `kit/lib/runner/agents/` `kit/lib/runner/job.` `kit/lib/runner/steps.` `kit/lib/runner/tokens.` `kit/lib/runner/fixtures/claude/` | — | 1 | deep |
| s2 | A runner reads its accounts file, keeps each account's state across restarts, and starts a job on the first ready account `takes` allows; no file means today's one Claude account | `kit/lib/runner/accounts.` `kit/lib/runner/runner.` `kit/lib/runner/terminal.` `kit/bin/commands/runner.` `kit/lib/env/read.` `kit/lib/runner/job.` | s1 | 2 | build |
| s3 | A job that hits a usage limit turns over to the next ready account in the same worktree with a handoff note, at most three times, and its parts reach the server and the Runners page | `kit/lib/runner/job.` `kit/lib/runner/api.` `kit/lib/runner/turnover.` `apps/galaxy/src/runners/` `apps/galaxy/app/api/runners/` `supabase/migrations/` | s1, s2 | 3 | deep |
| s4 | A job runs as a T3 Code thread on the account's instance: the `t3` adapter (thread start, steps from `thread show`, the limit and its reset, pressure where T3 shows it, resume, interrupt), its recordings, tokens from the instance's transcripts, and `T3 not running` falling through to the next account | `kit/lib/runner/agents/t3` `kit/lib/runner/agents/index.` `kit/lib/runner/fixtures/t3/` `kit/lib/runner/tokens.` | s1, s2 | 3 | deep |
| s5 | Codex and OpenCode instances read the kit's skills, at the repository's pinned version, from their own folders and never from the worktree | `kit/lib/runner/plugin.` `kit/lib/runner/fixtures/skills/` | s2 | 3 | build |
| s6 | A runner whose every account is out reads Paused: no tokens left, its accounts reach the health report, and the Runners page shows the account chips and the queued reason | `kit/lib/runner/runner.` `kit/lib/runner/health.` `kit/lib/runner/api.` `apps/galaxy/src/runners/` `apps/galaxy/app/api/runners/` | s2, s3 | 4 | build |
| s7 | The pull request's status comment names the parts of a job that turned over, and the runner guide explains accounts and handoffs | `kit/plugin/skills/pr/` `docs/guide/runners.md` | s3 | 4 | light |
| s8 | A job hands off before the wall: at the usage or context threshold the run is interrupted, the same session writes the handoff note (the runner's note as fallback), and the next account, or a fresh session for context, carries on | `kit/lib/runner/job.` `kit/lib/runner/turnover.` `kit/lib/runner/accounts.` | s3, s4 | 4 | deep |

**Shared ground.**
- `kit/lib/runner/job.` (`job.ts` and its tests): s1, s2, s3 and s8, in waves 1, 2, 3 and 4.
- `kit/lib/runner/turnover.`: s3 (wave 3) and s8 (wave 4). `kit/lib/runner/accounts.`: s2 (wave 2)
  and s8 (wave 4), which adds the `handoff`, `budget` and `contextWindow` fields.
- `kit/lib/runner/runner.`: s2 (wave 2) and s6 (wave 4).
- `kit/lib/runner/api.`, `apps/galaxy/src/runners/` (contract, service, repository, page and their
  tests, `runners.contract.test.ts` included) and `apps/galaxy/app/api/runners/`: s3 (wave 3) and s6
  (wave 4).
- `kit/lib/runner/agents/` and its registry `kit/lib/runner/agents/index.`: s1 (wave 1) creates them
  with the direct Claude adapter; s4 (wave 3) adds the `t3` adapter and its line.
- `kit/lib/runner/tokens.`: s1 (wave 1) and s4 (wave 3), which counts the T3 instances' transcripts.
- `kit/dist/` is built from `kit/lib/`: no slice commits it; the wave rebuilds it after merging.

## Per slice: done when

### s1 (deep: the job core changes shape under every running job)
- `kit/lib/runner/agents/` holds the adapter shape (`check`, `command`, `step`, `usage`, `limit`) and
  the `claude` adapter; `job.ts` runs a job through it and no longer names `claude` itself.
- A recorded Claude stream in `kit/lib/runner/fixtures/claude/` replays through a fake `claude` on the
  `PATH`: the same step lines, tokens and exit as before the change (the existing `job.test.ts` and
  `job-pr.test.ts` pass unchanged).
- `limit()` recognises Claude's usage-limit result in a recording, with its reset time, and returns
  `null` on a crash and on output that does not parse.
- `pressure()` reads a recorded `rate_limit_event` (`allowed_warning`, its `resetsAt` and window) and
  the context from the last assistant message's tokens; `session()` gives the session id and
  `resume()` builds `claude -p --resume <session>`.

### s2
- `~/.config/omni/accounts.yml` is read when `omni runner` starts: each malformed field is refused
  before the runner registers, naming the account and the field; a `takes` skill outside
  `RUNNABLE_SKILLS` is refused.
- No file gives one account, `claude`, from `CLAUDE_CODE_OAUTH_TOKEN`, and a job runs exactly as
  before (acceptance 1).
- Account states persist in `~/.config/omni/accounts-state.json`; an `out` account is `ready` again at
  its reset time; an account whose agent fails its check is `unusable` with the reason.
- A job starts on the first ready account whose `takes` allows its skill; a secret is passed to that
  run's process only (acceptance 5, part).

### s3 (deep: turnover mid-job, a migration and the job contract) (`ui: yes`)
- A recorded Claude limit followed by a fake second agent that finishes ends the job `done` with two
  parts, in the same worktree, the handoff note beside the job's log and not in the worktree, and the
  takeover message first (acceptance 2).
- A crash without a recognised limit fails the job and starts no other account (acceptance 8).
- An account whose `takes` leaves out the skill never takes over (acceptance 9).
- A fourth limit, or no account left, fails the job with `no tokens left: every account is out until
  <earliest reset>`.
- `JobUpdateSchema` accepts an optional `parts`; `runner_jobs.parts` stores it; an old runner's
  report is still valid; the runner sends `parts` only once the server accepted them.
- The Runners page names a job's agent and model, and one line per part.
- No secret appears in a report, a log line or the handoff note (acceptance 6).

### s4 (deep: a new dependency's output, read from recordings)
- Recordings of `t3` 0.1.x in `kit/lib/runner/fixtures/t3/`: `thread start --wait --json` done,
  failed, at its usage limit and waiting for an answer (exit 2), and `thread show --json` pages. A
  fake `t3` on the `PATH` replays them.
- An account with `instance` runs `t3 thread start <worktree> - --provider <instance> --model
  <model> --wait --json`, the job line on stdin (as words for a Codex or OpenCode instance); new
  messages of `thread show` become step lines every 5 seconds.
- `limit()` reads T3's usage-limit end with its reset time; exit 2 fails the job naming it; a crash
  is not a limit.
- `pressure()` returns the instance's usage percent and the thread's context where the recordings
  show T3 exposing them to the host, else `null`; `interrupt()` stops the active run where T3 lets
  the host, else `null`; `resume()` is `t3 thread send <thread> -`. The slice's PR says which
  readings T3 gave.
- Tokens come from the instance's transcripts for the job's worktree.
- `T3 not running` or an unknown instance makes the account `unusable` with that reason, and the job
  starts on the next account (acceptance 11).

### s5
- Before a job on a Codex instance, the kit's skills of the repository's pinned version are in
  `<CODEX_HOME>/skills/omni-*`; on an OpenCode instance, in OpenCode's global skills folder; never in
  the worktree (acceptance 10).
- An instance whose agent reads no skills folder outside the repository is `unusable · no skills`.

### s6 (`ui: yes`)
- Every account out opens no new `next`; the health report's `paused` reads `no tokens left until
  <time>`; the runner takes jobs again after the earliest reset (acceptance 5).
- `HealthReportSchema` accepts an optional `accounts` list of ids and states only.
- The Runners page shows the account chips in order, each state in its colour, `Paused: no tokens
  left until <time>`, and `Waiting: every runner out of tokens until <time>` on a queued job.

### s7 (light: a skill's wording and the guide)
- `/omni:pr`'s status comment adds `Parts: <agent> (<model>) until <time> · <agent> (<model>), <why>`
  when `OMNI_RUNNER_PARTS` is set, and nothing otherwise (acceptance 7).
- `docs/guide/runners.md` has **Accounts and turnover**: the file, the order, `takes`, signing in
  Codex and OpenCode, the chips and the pause, two rows in **When something goes wrong**, and the
  note to use a seat or a key per account.

### s8 (deep: interrupting a live run and resuming its session)
- `accounts.yml` accepts `handoff.usage`, `handoff.context` (50–99), `budget` and `contextWindow`, and
  refuses a bad value naming it.
- A recorded `allowed_warning` (Claude) and a recorded `used_percent` of 91 (Codex): the run is
  interrupted, its session resumed for one turn that writes `job-<id>.handoff.md` beside the log, and
  the next account starts with it; the part reads `ended: usage`, `note: agent` (acceptance 3).
- A note turn that fails, times out after 5 minutes, or writes nothing: the runner's note, `note:
  runner`.
- A context at 76 %: a fresh session on the same account with the agent's note, `ended: context`
  (acceptance 4).
- Three account changes and five fresh sessions at most; past either, the job fails naming the cap.
