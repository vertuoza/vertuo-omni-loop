/**
 * **Which agents `omni init` installs for** (PRD 1890, slice s3). The `agents` key comes from the
 * repeatable `--agent <agent>` flag, else, on a terminal, from one question (Claude ticked: an empty
 * answer is `claude`), else from the config's default, `[claude]`.
 *
 * With any agent but `claude` listed, init writes the `.agents/skills/omni-*` copies through
 * `kit/lib/agents/` and commits the folders the manifest says it owns (N-PRODUCT-13, amended). An
 * `omni-*` folder the manifest does not own, or a manifest omni did not write, refuses the install
 * before anything is written, as the writer itself would.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS } from '../config.ts';
import { isOneOf } from '../narrow.ts';
import { AGENTS_MANIFEST, AgentsError, readManifest } from '../agents/write.ts';
import type { AgentCopyChange } from '../agents/write.ts';
import type { Agent } from '../types.ts';

/** The flag that names an agent, once per agent. */
const AGENT_FLAG = '--agent';

/** The agent the Claude plugin and `.claude/settings.json` serve; the copies serve the others. */
const CLAUDE: Agent = 'claude';

/** Where the copies live: one `omni-<name>` folder per skill. */
export const COPIES_GLOB = '.agents/skills/omni-*';

/** Whether `agents` lists Claude Code: the plugin and the settings keys are installed only then. */
export const servesClaude = (agents: readonly Agent[]): boolean => agents.includes(CLAUDE);

/** Whether `agents` lists an agent that reads the copies. */
export const needsCopies = (agents: readonly Agent[]): boolean => agents.some((agent) => agent !== CLAUDE);


/**
 * `names` as agents, in their order, or the one line that refuses them: an agent the kit does not
 * install for, or one named twice, each named.
 */
export function parseAgents(names: readonly string[]): { agents: Agent[] } | { error: string } {
  const agents: Agent[] = [];
  for (const name of names) {
    if (!isOneOf(AGENTS, name)) return { error: `${name} is no agent the kit installs for — one of ${AGENTS.join(', ')}` };
    if (agents.includes(name)) return { error: `${name} is named twice` };
    agents.push(name);
  }
  return agents.length ? { agents } : { error: `name at least one agent — one of ${AGENTS.join(', ')}` };
}

/**
 * Takes every `--agent <value>` out of `args`: the flag repeats, which the shared parser does not
 * read. A `--agent` with no value is left in `values` as `''`, for {@link parseAgents} to refuse.
 */
export function takeAgentFlags(args: readonly string[]): { values: string[]; rest: string[] } {
  const values: string[] = [];
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] ?? '';
    if (arg !== AGENT_FLAG) {
      rest.push(arg);
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) {
      values.push('');
    } else {
      values.push(value);
      index += 1;
    }
  }
  return { values, rest };
}

/** The question a terminal init asks, Claude ticked: an empty answer keeps `claude` alone. */
export const AGENTS_QUESTION = `agents: the coding agents your team uses, any of ${AGENTS.join(', ')}, separated by commas (empty for claude): `;

/** The agents an answer to {@link AGENTS_QUESTION} names: commas or spaces between them, any case. */
export function agentsAnswer(answer: string | null | undefined): string[] {
  const names = (answer ?? '').split(/[\s,]+/).map((name) => name.trim().toLowerCase()).filter(Boolean);
  return names.length ? names : [CLAUDE];
}

/**
 * The one line that refuses the copies before init writes anything, or `null`: a manifest omni did
 * not write, or an `omni-*` folder in `.agents/skills/` it does not own (the writer would stop there).
 */
export function copiesRefusal(root: string): string | null {
  let owned: ReadonlySet<string>;
  try {
    owned = new Set(Object.keys(readManifest(root)?.folders ?? {}));
  } catch (error) {
    if (error instanceof AgentsError) return error.message;
    throw error;
  }
  const dir = join(root, '.agents', 'skills');
  if (!existsSync(dir)) return null;
  const foreign = readdirSync(dir)
    .filter((name) => name.startsWith('omni-'))
    .map((name) => `.agents/skills/${name}`)
    .filter((folder) => !owned.has(folder))
    .sort();
  if (!foreign.length) return null;
  const one = foreign.length === 1;
  return `${foreign.join(', ')} ${one ? 'is' : 'are'} not omni's (not in ${AGENTS_MANIFEST}): move or rename ${one ? 'it' : 'them'}, then run again`;
}

/** The copy folders the manifest says the install owns, to commit with the install: none without one. */
export function ownedCopyPaths(root: string): string[] {
  return Object.keys(readManifest(root)?.folders ?? {}).sort();
}

/**
 * The setup line of the copies: how many skills were written for which agents, or removed when the
 * agents no longer need them. `null` when there are none and none were removed.
 */
export function copiesLine({ agents, owned, changes }: { agents: readonly Agent[]; owned: number; changes: readonly AgentCopyChange[] }): string | null {
  if (owned > 0) {
    const others = agents.filter((agent) => agent !== CLAUDE).join(', ');
    return `  wrote   ${COPIES_GLOB}  (${owned} skills for ${others}, listed in ${AGENTS_MANIFEST})`;
  }
  const removed = changes.filter((change) => change.change === 'removed').length;
  return removed ? `  removed ${COPIES_GLOB}  (${removed} skill${removed === 1 ? '' : 's'}: agents lists claude alone)` : null;
}

/** The line that says the plugin was left alone: no agent listed reads it. */
export const NO_PLUGIN_LINE = `  plugin  not installed: agents does not list ${CLAUDE}`;
