---
id: s4-01-t3-instance-from-the-file
prd: 2537
slice: s4
rank: medium
bears-on: none
raised: 2026-10-28
wave: 3
---

## The question, in plain words

The runner hands each agent an account with its name, model and secret, but not the T3 instance it runs on. How should the T3 agent learn the instance?

## The decision, in plain words

The T3 agent looks the account up again in the accounts file on the machine, by its name, and reads its instance there.

## The intro, for fun

An account walks into a runner with a name, a model and a secret, and forgets to say where it lives.

## The punchline, for fun

So the agent checks the address book again.

## The options, in plain words

A. The T3 agent reads the account's instance from the accounts file, by the account's name (built).
B. The account every agent is handed carries its instance, so no agent reads the file again.

## What I had to decide

`AgentAccount` (`kit/lib/runner/agents/agent.ts`) carries `id`, `model` and `secret` only, and `agentAccountOf` (`kit/lib/runner/accounts.ts`) builds it; both are outside s4's territory. The `t3` agent (`agents/t3.ts`) resolves an account's instance by reading `~/.config/omni/accounts.yml` again under the home it is built with (`homedir()` unless given), or through an injected `instanceOf`. `runner.ts`'s `takeAccount` builds agents with `{ projects, exec }` only, so its check reads the file under `homedir()`, which is the runner's home in practice. Option B adds an optional `instance` to `AgentAccount`, set in `agentAccountOf`; s8 (wave 4) touches `accounts.ts` and could take it.

## What I did meanwhile

Built A, with an injected `instanceOf` in the tests; `omni runner job` hands the t3 agent the home it reads the file from.

## What it costs to change later

One optional field and one line in two files, and the lookup in `t3.ts` removed: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person wants the agent's account to carry its instance now rather than in s8 (author)
