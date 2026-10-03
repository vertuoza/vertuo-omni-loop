// Where a question came from and what the Claude session had cost when it asked (PRD 144's spec,
// "What a round records"): the `context` the `pre` hook sends with each new round, and the
// `context.repo` a session open sends. Every field is best-effort: a value that cannot be read is
// `null`, and nothing here ever throws — the mode never blocks a question.
//
// | field           | read from                                                                 |
// |-----------------|---------------------------------------------------------------------------|
// | repo            | the config's `repo.slug`                                                  |
// | branch          | `git rev-parse --abbrev-ref HEAD` in the hook's cwd (a detached HEAD: null) |
// | prd             | a branch shaped like `branches.feature` or `branches.slice` gives {topic};  |
// |                 | the folder `<paths.delivery>/inbox/<nnnn>-<topic>` gives nnnn               |
// | claudeSessionId | the hook input's `session_id`                                             |
// | skill           | the transcript's last user entry carrying `<command-name>/…</command-name>` |
// | model           | the transcript's last assistant entry's `message.model`                  |
// | tokens          | the sum of `message.usage` over assistant entries, each message id once    |
//
// Only counts and names leave the machine, never the transcript's text.
import { execFileSync } from 'node:child_process';
import type { StdioOptions } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config.ts';
import type { ExecText } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import type { Config } from '../types.ts';
import { parseFolderName } from '../layout.ts';
import { field, textOrNull } from './schema.ts';

/** The token counts a transcript holds, summed over its assistant messages. */
export type TokenCounts = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** What a transcript tells of the session that asked. */
export type TranscriptFacts = { skill: string | null; model: string | null; tokens: TokenCounts | null };

/** The context a new round carries. */
export type AskContext = { repo: string | null; branch: string | null; prd: PrdNumber | null; claudeSessionId: string | null } & TranscriptFacts;

const QUIET: { encoding: 'utf8'; stdio: StdioOptions; timeout: number } = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 };
const COMMAND = /<command-name>\s*(\/[^<\s]+)\s*<\/command-name>/g;

function attempt<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0);

/** The text of a user entry's content: a string, or the text blocks of a list. */
function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block: unknown) => {
      const text = field(block, 'text');
      return field(block, 'type') === 'text' && typeof text === 'string' ? text : '';
    })
    .join('\n');
}

/**
 * The skill, model and token counts a Claude Code transcript (JSON lines) holds. A line that is not
 * JSON is skipped; a field it cannot find is `null`.
 */
export function readTranscript(text: unknown): TranscriptFacts {
  let skill: string | null = null;
  let model: string | null = null;
  const usage = new Map<string, object>();
  for (const raw of typeof text === 'string' ? text.split('\n') : []) {
    if (!raw.trim()) continue;
    const entry = attempt((): unknown => JSON.parse(raw));
    const message = field(entry, 'message');
    if (!message || typeof message !== 'object') continue;
    const type = field(entry, 'type');
    if (type === 'user') {
      const last = [...textOf(field(message, 'content')).matchAll(COMMAND)].at(-1);
      // The pattern's one group always matches: a command name is never empty.
      if (last) skill = last[1] ?? null;
    } else if (type === 'assistant') {
      model = textOrNull(field(message, 'model')) ?? model;
      const used = field(message, 'usage');
      if (used && typeof used === 'object') {
        // A message streamed over several entries repeats its id and its usage: the last one counts.
        const id = field(message, 'id');
        usage.set(typeof id === 'string' ? id : `#${usage.size}`, used);
      }
    }
  }
  if (usage.size === 0) return { skill, model, tokens: null };
  const tokens: TokenCounts = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const u of usage.values()) {
    tokens.input += count(field(u, 'input_tokens'));
    tokens.output += count(field(u, 'output_tokens'));
    tokens.cacheRead += count(field(u, 'cache_read_input_tokens'));
    tokens.cacheWrite += count(field(u, 'cache_creation_input_tokens'));
  }
  return { skill, model, tokens };
}

/** A branch template (`feat/{topic}--{slice}`) as an anchored pattern whose first group is the topic. */
function branchPattern(template: string): RegExp {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\{topic\}/, '(.+?)').replace(/\{slice\}/, '[^/]+')}$`);
}

/**
 * The PRD number a branch of the loop works on: the topic a slice or feature branch carries, looked
 * up among the inbox's `<nnnn>-<topic>` folders. `null` for any other branch.
 */
export function prdOfBranch(branch: unknown, { branches, folders }: { branches: Pick<Config['branches'], 'feature' | 'slice'>; folders: readonly string[] }): PrdNumber | null {
  if (typeof branch !== 'string' || !branch) return null;
  for (const template of [branches.slice, branches.feature]) {
    const topic = attempt(() => branchPattern(template).exec(branch)?.[1]);
    if (!topic) continue;
    for (const folder of folders) {
      const named = parseFolderName(folder);
      if (named && named.topic === topic) return named.prd;
    }
  }
  return null;
}

/** The context a session open sends: the repository, when the config names it. */
export function sessionContext(root: string): { repo: string | null } {
  return { repo: attempt(() => loadConfig(root).repo.slug) ?? null };
}

/**
 * The context a new round carries. Never throws.
 */
export function askContext({ root, input, exec = execFileSync }: { root: string; input: unknown; exec?: ExecText }): AskContext {
  const config = attempt(() => loadConfig(root));
  const cwd = textOrNull(field(input, 'cwd')) ?? root;
  const head = attempt(() => exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, ...QUIET }).trim());
  const branch = head && head !== 'HEAD' ? head : null;
  const folders = config ? attempt(() => readdirSync(join(root, config.paths.delivery, 'inbox'))) ?? [] : [];
  const prd = config ? attempt(() => prdOfBranch(branch, { branches: config.branches, folders })) : null;
  const transcriptPath = field(input, 'transcript_path');
  const path = typeof transcriptPath === 'string' ? transcriptPath : null;
  const transcript = (path && attempt(() => readTranscript(readFileSync(path, 'utf8')))) || { skill: null, model: null, tokens: null };
  return {
    repo: config?.repo.slug ?? null,
    branch,
    prd,
    claudeSessionId: textOrNull(field(input, 'session_id')),
    ...transcript,
  };
}
