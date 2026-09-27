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
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../config.mjs';

const QUIET = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 };
const COMMAND = /<command-name>\s*(\/[^<\s]+)\s*<\/command-name>/g;
const FOLDER = /^(\d{4})-(.+)$/;

function attempt(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0);

/** The text of a user entry's content: a string, or the text blocks of a list. */
function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((block) => (block?.type === 'text' && typeof block.text === 'string' ? block.text : '')).join('\n');
}

/**
 * The skill, model and token counts a Claude Code transcript (JSON lines) holds. A line that is not
 * JSON is skipped; a field it cannot find is `null`.
 *
 * @returns {{ skill: string | null, model: string | null,
 *   tokens: { input: number, output: number, cacheRead: number, cacheWrite: number } | null }}
 */
export function readTranscript(text) {
  let skill = null;
  let model = null;
  const usage = new Map();
  for (const raw of typeof text === 'string' ? text.split('\n') : []) {
    if (!raw.trim()) continue;
    const entry = attempt(() => JSON.parse(raw));
    const message = entry?.message;
    if (!message || typeof message !== 'object') continue;
    if (entry.type === 'user') {
      const commands = [...textOf(message.content).matchAll(COMMAND)];
      if (commands.length) skill = commands[commands.length - 1][1];
    } else if (entry.type === 'assistant') {
      if (typeof message.model === 'string' && message.model) model = message.model;
      if (message.usage && typeof message.usage === 'object') {
        // A message streamed over several entries repeats its id and its usage: the last one counts.
        usage.set(typeof message.id === 'string' ? message.id : `#${usage.size}`, message.usage);
      }
    }
  }
  if (usage.size === 0) return { skill, model, tokens: null };
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const u of usage.values()) {
    tokens.input += count(u.input_tokens);
    tokens.output += count(u.output_tokens);
    tokens.cacheRead += count(u.cache_read_input_tokens);
    tokens.cacheWrite += count(u.cache_creation_input_tokens);
  }
  return { skill, model, tokens };
}

/** A branch template (`feat/{topic}--{slice}`) as an anchored pattern whose first group is the topic. */
function branchPattern(template) {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\{topic\}/, '(.+?)').replace(/\{slice\}/, '[^/]+')}$`);
}

/**
 * The PRD number a branch of the loop works on: the topic a slice or feature branch carries, looked
 * up among the inbox's `<nnnn>-<topic>` folders. `null` for any other branch.
 *
 * @param {string | null} branch
 * @param {{ branches: { feature: string, slice: string }, folders: string[] }} where
 */
export function prdOfBranch(branch, { branches, folders }) {
  if (typeof branch !== 'string' || !branch) return null;
  for (const template of [branches.slice, branches.feature]) {
    const topic = attempt(() => branchPattern(template).exec(branch)?.[1]);
    if (!topic) continue;
    for (const folder of folders) {
      const match = FOLDER.exec(folder);
      if (match && match[2] === topic) return Number(match[1]);
    }
  }
  return null;
}

/** The context a session open sends: the repository, when the config names it. */
export function sessionContext(root) {
  return { repo: attempt(() => loadConfig(root).repo.slug) ?? null };
}

/**
 * The context a new round carries. Never throws.
 *
 * @param {{ root: string, input: any, exec?: typeof execFileSync }} options
 */
export function askContext({ root, input, exec = execFileSync }) {
  const config = attempt(() => loadConfig(root));
  const cwd = typeof input?.cwd === 'string' && input.cwd ? input.cwd : root;
  const head = attempt(() => String(exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, ...QUIET })).trim());
  const branch = head && head !== 'HEAD' ? head : null;
  const folders = config ? attempt(() => readdirSync(join(root, config.paths.delivery, 'inbox'))) ?? [] : [];
  const prd = config ? attempt(() => prdOfBranch(branch, { branches: config.branches, folders })) : null;
  const path = typeof input?.transcript_path === 'string' ? input.transcript_path : null;
  const transcript = (path && attempt(() => readTranscript(readFileSync(path, 'utf8')))) || { skill: null, model: null, tokens: null };
  return {
    repo: config?.repo?.slug ?? null,
    branch,
    prd,
    claudeSessionId: typeof input?.session_id === 'string' && input.session_id ? input.session_id : null,
    ...transcript,
  };
}
