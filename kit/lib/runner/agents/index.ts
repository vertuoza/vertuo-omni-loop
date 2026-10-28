// The agents a runner can run a job with (PRD 2537), by the name an account gives: one line each. The
// fallback, `claude` run directly, is what a runner with no accounts file runs every job with, exactly
// as before there were agents: on its one account, which names no model and holds no secret of its own
// (the job's session already carries the runner's token, PRD 1894). `t3` runs an account's work as a
// T3 Code thread on its instance (s4).
import type { Agent, AgentAccount } from './agent.ts';
import { claudeAgent } from './claude.ts';
import { t3Agent } from './t3.ts';
import type { T3Deps } from './t3.ts';

/** What every agent may be built with: where Claude keeps its transcripts, how a check runs a command, and the `t3` agent's own. */
export type AgentDeps = NonNullable<Parameters<typeof claudeAgent>[0]> & T3Deps;

/** Each agent's builder, by its name. */
const AGENTS: Readonly<Record<string, (deps: AgentDeps) => Agent>> = {
  claude: claudeAgent,
  t3: t3Agent,
};

/** The agent named `name`, or `null` when no agent has that name. */
export function agentNamed(name: string, deps: AgentDeps = {}): Agent | null {
  const build = Object.hasOwn(AGENTS, name) ? AGENTS[name] : undefined;
  return build === undefined ? null : build(deps);
}

/** The agent a job runs with when no account names one. */
export function fallbackAgent(deps: AgentDeps = {}): Agent {
  return claudeAgent(deps);
}

/** The one account of a runner with no accounts file: the fallback agent's, as the runner always ran it. */
export function fallbackAccount(): AgentAccount {
  return { id: fallbackAgent().name, model: null, secret: null };
}
