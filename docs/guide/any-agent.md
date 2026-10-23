---
title: Any coding agent
description: Run a session and ask the person on the Omni page from any coding agent, Codex or another, on a laptop or in the cloud, with plain omni commands and no hook.
---

Claude Code runs the loop's session work through its hooks: the briefing when a session starts, the
questions sent to your ask page, the heartbeat the Omni page shows, the close when it ends. Any
other coding agent, such as Codex in a terminal or on chatgpt.com, does the same with five plain
`omni` commands it runs from its shell. Nothing reads stdin, needs a terminal or a home folder, so
they work on a laptop and in a cloud session alike.

This page lists them in the order an agent runs them. Paste it, or point your agent at it, at the
start of a session.

## Set up your agent

Once per repository, by someone who administers it:

1. **List your agents.** The `agents` key of `.omni-loop/config.yml` names the coding agents your
   team uses: any of `claude`, `codex`, `cursor` and `gemini`. `omni init --agent <agent>` writes
   it, one `--agent` per agent ([Install › Run omni init](/docs/install#run-omni-init)). On a
   repository already set up, edit the key, then run `omni update`.
2. **Merge the pull request.** `omni init` or `omni update` writes the skills' copies under
   `.agents/skills/omni-<name>/`, one folder per skill, and lists them in `.omni-loop/agents.json`.
   Merge its pull request, so the copies are committed on the default branch for everyone.

Then each person runs a skill in their own agent's form:

| Agent | How you run a skill |
|---|---|
| Claude Code | `/omni:yolo 7` |
| Codex | `$omni-yolo 7` |
| Cursor | `/omni-yolo 7` |
| Gemini CLI | ask for `omni-yolo` |

The guide names every skill in the kit's form, `/omni:<name>`: type it in your agent's form above.
`omni help` shows each form for the agents the key lists. `omni check agents` says whether the
copies match the kit's version: never edit one by hand, the next `omni update` writes it back. The
status line and the HUD are Claude Code's alone.

## Before you start

- **The repository runs the loop:** it has a `.omni-loop/` folder at its root. Where `omni` is not
  installed, as in a cloud session, the agent runs the repository's own copy,
  `node .omni-loop/bin/omni.mjs`, which takes the same commands.
- **You are signed in.** On a laptop, `omni signin` once. In a cloud session, set `OMNI_TOKEN`, and
  `OMNI_ASK=on` for the questions: [Cloud sessions](/docs/cloud), step 2.
- **Ask mode is on,** for the questions to reach your page: `omni ask on` on a laptop, or
  `OMNI_ASK=on` in the environment, which needs no file and wins over what `omni ask on` wrote.
  `OMNI_ASK=off` turns it off.

## 1. Start the session

The agent runs this first, before anything else:

```bash agent
omni session start
```

It prints the product's Statement and Never list, then the repository's briefing, then a last line
`session: <id>`. The id is `OMNI_SESSION_ID` when it is set, else `CLAUDE_CODE_SESSION_ID`, else the
one stored for this checkout; with none, it makes one and stores it, so every later `omni` command
of the checkout belongs to the same session. Set `OMNI_SESSION_ID` to tell apart two sessions that
share one checkout.

It always exits 0, the Omni page reachable or not.

## 2. Ask the person

When the agent has a question for you, it writes it to a file, in the shape Claude's
`AskUserQuestion` takes, then asks:

```json file=q.json
{
  "questions": [
    {
      "question": "Which list should the export start from?",
      "header": "Export",
      "options": [
        { "label": "Open invoices", "description": "Only the invoices still to be paid." },
        { "label": "All invoices", "description": "Every invoice of the year." }
      ],
      "multiSelect": false
    }
  ],
  "lead": "The spec does not say which invoices the export lists.",
  "context": { "skill": "brainstorm", "model": "gpt-5-codex" }
}
```

```bash agent
omni ask question --file q.json
```

`lead`, the text the agent wrote before asking, and `context`, the skill and the model, are optional.
Any other field is refused, named. The question shows on your ask page; you answer it there. What
the command prints, and what the agent does next, depend on its exit code:

| Exit | What it means | What the agent does |
|---|---|---|
| `0` | you answered on the page | reads the one line of JSON it printed: `{ round, answers, shots }`, `answers` by question, `shots` the paths of the screenshots you added |
| `4` | the wait ran out, the question still open | reads `round <id>` and resumes with `omni ask wait` (step 3) |
| `3` | the page is not used: ask mode off, no sign-in, the page unreachable, or the question closed | asks you in its own chat, then sends your answer (step 4). The reason is the one line on stderr |
| `2` | the command or the file is wrong | fixes the field the line names, and asks again |

An unattended run, a runner job with `OMNI_UNATTENDED` set, asks no one: `omni ask question` and
`omni ask wait` open no round, wait for nothing and exit `3` with the line `unattended`. The agent
asks nothing and records a decision as an outbox item ranked high.

It waits 110 seconds by default, so the call ends before a cloud shell gives up at two minutes.
`--wait` takes any number of seconds from 10 to 540:

```bash agent
omni ask question --file q.json --wait 300
```

## 3. Keep waiting

On exit 4, the question stays open on your page. The agent resumes the wait with the round it
printed, as often as it is willing to wait:

```bash agent
omni ask wait <round>
```

It takes the same `--wait` and ends with the same exit codes: 0 with your answer, 4 still waiting,
3 to ask in its own chat.

## 4. Send an answer given in the chat

On exit 3 the agent asks you in its own chat. When the question had a round, the stderr line names
it: the agent then sends your answer to the page, so the page keeps it beside the question. It
writes the answers by question, as `ask question` printed them:

```json file=a.json
{ "answers": { "Which list should the export start from?": "Open invoices" } }
```

```bash agent
omni ask answer <round> --file a.json
```

The page shows the answer as given in the terminal. A question left empty is left out. It exits 0
even when the page cannot be reached, with one line on stderr: it never stops the agent.

## 5. End the session

The agent runs this last:

```bash agent
omni session end
```

It closes the session's questions on your ask page and tells the Omni page the session stopped. It
always exits 0. An agent that never gets to run it does no harm: the page treats a session whose
heartbeat stopped as gone.

## Model tiers

The plan advises a tier for each slice, in its `tier` column, from what the slice needs:

| Tier | For |
|---|---|
| `deep` | a slice whose design is subtle: an algorithm, a concurrency or migration hazard, a law path |
| `build` | a bounded slice with a territory and a test-first spec, the ordinary case |
| `light` | a mechanical slice: a rename, wording, docs, a config line |

You review the tiers with the rest of the plan, before anything is built: change a cell to change
one. Saying nothing approves the plan's advice.

The `tiers` key of `.omni-loop/config.yml` maps each tier to a model, and an effort if you want one,
with a row per agent, so a Codex terminal and a Claude terminal each read their own:

```yaml file=.omni-loop/config.yml
agents: [claude, codex]
tiers:
  claude:
    deep:  { model: opus,   effort: high }
    build: { model: sonnet, effort: medium }
    light: { model: haiku,  effort: low }
  codex:
    build: { model: <id> }
```

`/omni:wave` starts each slice's agent on the model and effort its tier maps to
(`omni tier <tier> --agent <agent>` prints them). No mapping inherits: without `tiers`, without a
row for your agent or an entry for the slice's tier, the slice runs on your terminal's model, as it
always did. So does every slice of an agent that cannot choose a model per subagent, and a slice
whose model the agent refuses, started again once on the terminal's model. Every sub-PR says what
built it on a `Tier:` line, such as `Tier: light · claude haiku · low` or
`Tier: build · inherited (no mapping)`.

## Clean up the worktrees

Every slice agent works in its own worktree under the `worktrees` folder, and so do the feature and
phase-0 worktrees `/omni:brainstorm` cuts. The kit removes the ones it created, once their work is
safe on the remote:

```bash
omni worktrees list [--json]
omni worktrees prune [--prd <n>] [--dry-run]
omni worktrees remove <path>
omni worktrees hint
```

`list` shows every worktree of the repository, the kit's or not, and says for each of the kit's
whether it is safe to remove or kept, with the reason. `prune` removes the safe ones, prints
`removed <path> · <size>` or `kept <path> · <reason>` for each, then `freed <total>`; `--prd <n>`
limits it to one PRD's, and `--dry-run` removes nothing and prints `would remove`. `remove` applies
the same rules to the one worktree you name. `hint` prints how many could go, with no network and
no board read; the session start runs it.

A worktree is kept while it has an uncommitted change, a commit no remote branch holds, a slice still
claimed, a slice that is red, stopped or blocked while its feature pull request is open, or a process
working inside it. `/omni:wave` removes a slice's worktree once its pull request merges,
`/omni:yolo` and `/omni:yolo-fix` prune the PRD's worktrees before they hand off and name each one
they kept, and every verb exits 0 whatever it keeps. Nothing is ever removed by force.

## The heartbeat

While the session runs, every `omni` command the agent runs tells the Omni page the session is
working, at most once a minute and in the background: the command neither waits for it nor fails
with it. Nothing to run for it. `OMNI_HEARTBEAT=off` stops it; `omni heartbeat` sends one by hand.

[Next → How the loop works](/docs/loop)
