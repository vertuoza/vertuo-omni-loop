// The bodies of ask mode's harness hooks, as functions of (the hook's input, the checkout's local
// state, the contract client). Whatever goes wrong, a hook answers `null` — no output — so the
// person's terminal prompt shows exactly as it would without ask mode. The mode never blocks a
// session. The mode is per checkout; the session is per terminal, the terminal being the input's
// `session_id`, and the round per question, keyed by its `tool_use_id` (PRD 142's spec).
//
// - `pre` (PreToolUse on AskUserQuestion): opens this terminal's session on its first question
//   (with `context.repo`, PRD 144), posts the round with its best-effort `context` (`./context.ts`:
//   where it came from, what the session had cost; a context that cannot be read is sent as nulls, or
//   not at all, and never stops the question) and its `lead` (`./lead.ts`, PRD 752: the text Claude
//   wrote before asking; none when it cannot be read), waits on it up to 540 s in all (the hook's own timeout
//   is 600 s), and hands the page's answer back through `updatedInput.answers`. On any other outcome
//   it abandons the round when it can, and answers nothing. A closed session is forgotten: the next
//   question opens anew. Before it opens a round, it removes the screenshot folders older than 7 days.
//   An answer that carries screenshots (PRD 620) has each downloaded from its signed link into
//   `.omni-loop/local/ask/shots/<round id>/`, 30 s a file within the same total, and their absolute
//   paths appended to that question's answer for Claude to Read; one it could not download is named
//   instead, and the answer goes through either way.
//   A round that comes back `closed` keeps its file, for `post` to answer.
// - `post` (PostToolUse on AskUserQuestion): an answer given in the terminal always reaches the page
//   (PRD 1180), with `via: "terminal"`: posted to the round `pre` left open, abandoned or closed, or,
//   when `pre` could not open one, sent with the questions, opening the round answered in one call.
//   A question left empty is left out; nothing is posted when none was answered, nor for a round the
//   page answered. A post that fails prints one line on stderr and the session goes on. Then that
//   question's round file goes.
// - `end` (SessionEnd): closes this terminal's session and deletes its file.
// - `prompt` (UserPromptSubmit): one sentence of context, so questions go through the tool.
//
// Since PRD 1831 these are the Claude adapter of the round's core (`./round.ts`): they read Claude's
// hook JSON and transcript, and the core opens, posts, waits, abandons and downloads.
import { execFileSync } from 'node:child_process';
import { loadConfig } from '../config.ts';
import { askContext, sessionContext } from './context.ts';
import { roundLead } from './lead.ts';
import { clearRound, clearTerminal, isSafeId, readMode, readRound, writeRound } from './local-state.ts';
import type { Answers, Client, RoundExtras } from './round.ts';
import {
  abandonRound, answerRound, awaitRound, closeTerminal, givenAnswers, openAnswered, openRound, sweepOldShots, withScreenshots,
} from './round.ts';
import { currentBranch, sessionTitle } from './title.ts';
import type { RoundStatus } from './schema.ts';
import { field, jsonObject } from './schema.ts';

export { toolAnswers } from './round.ts';

/** A hook's output, written to stdout as JSON. */
type HookOutput = { hookSpecificOutput: Record<string, unknown> };

const TOOL = 'AskUserQuestion';

export const PROMPT_CONTEXT =
  'Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.';

/** The total a `pre` hook waits for the page, and the most one `wait` call may take (the server
 * holds it up to 50 s). */
export const WAIT_LIMITS = Object.freeze({ totalMs: 540_000, callMs: 60_000 });

/**
 * The mode in this checkout: the host it is on against and the URL its calls go to, or `null` when
 * it is off — no `ask.json`, `ask.url` null or unreadable, or `ask.url` naming another host.
 */
export function activeMode(root: string): { host: string; baseUrl: string } | null {
  const mode = readMode(root);
  if (!mode) return null;
  let baseUrl: string | null;
  try {
    baseUrl = loadConfig(root).ask.url;
  } catch {
    return null;
  }
  if (!baseUrl || new URL(baseUrl).host !== mode.host) return null;
  return { host: mode.host, baseUrl };
}

export function promptOutput(): HookOutput {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: PROMPT_CONTEXT } };
}

function preOutput(toolInput: unknown, answers: Answers): HookOutput {
  const input = jsonObject(toolInput) ?? {};
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...input, answers } } };
}

/** The input's id when it may name a file, else `null`. */
const idOf = (value: unknown): string | null => (isSafeId(value) ? value : null);

/** What `pre` needs from its input, or `null` when the hook has nothing to do with it. */
function preInput(input: unknown): { toolInput: unknown; questions: unknown[]; terminalId: string; toolUseId: string } | null {
  if (field(input, 'tool_name') !== TOOL) return null;
  const toolInput = field(input, 'tool_input');
  const questions = field(toolInput, 'questions');
  if (!Array.isArray(questions) || questions.length === 0) return null;
  const terminalId = idOf(field(input, 'session_id'));
  const toolUseId = idOf(field(input, 'tool_use_id'));
  if (!terminalId || !toolUseId) return null;
  return { toolInput, questions, terminalId, toolUseId };
}

/** How the hook reads a round's context (PRD 144) and lead (PRD 752): from its input, and the
 * transcript the input names. */
type ContextReaders = {
  readContext: (options: { root: string; input: unknown }) => unknown;
  readLead: (options: { input?: unknown }) => unknown;
};

/** The round's extras, read from the hook's input when the round is sent. */
function extrasOf(root: string, input: unknown, { readContext, readLead }: ContextReaders): RoundExtras {
  return { readContext: () => readContext({ root, input }), readLead: () => readLead({ input }) };
}

/**
 * The `pre` hook's output, or `null` for none. `title` names a session this terminal opens:
 * `<repo slug> · <branch>`.
 */
export async function preHook({
  root,
  host,
  client,
  input,
  title,
  limits = WAIT_LIMITS,
  now = Date.now,
  readContext = askContext,
  readSessionContext = sessionContext,
  readLead = roundLead,
}: {
  root: string;
  host: string;
  client: Client;
  input: unknown;
  title: () => string;
  limits?: { totalMs: number; callMs: number };
  now?: () => number;
  readContext?: (options: { root: string; input: unknown }) => unknown;
  readSessionContext?: (root: string) => unknown;
  readLead?: (options: { input?: unknown }) => unknown;
}): Promise<HookOutput | null> {
  const pre = preInput(input);
  if (!pre) return null;
  const { toolInput, questions, terminalId, toolUseId } = pre;
  const deadline = now() + limits.totalMs;
  sweepOldShots(root, now);

  const extras = extrasOf(root, input, { readContext, readLead });
  const roundId = await openRound({ root, host, client, terminalId, title, readSessionContext, ...extras, questions });
  if (!roundId) return null;
  const keep = (status: RoundStatus): void => {
    writeRound(root, toolUseId, { roundId, status });
  };
  keep('open');

  const outcome = await awaitRound({ client, roundId, questions, deadline, callMs: limits.callMs, now });
  switch (outcome.kind) {
    case 'answered': {
      keep('answered');
      const { answers, attachments } = outcome;
      return preOutput(toolInput, await withScreenshots({ root, client, roundId, answers, attachments, deadline, now }));
    }
    case 'closed':
      // The round stays: the post hook records the terminal's answer on it (PRD 1180).
      clearTerminal(root, terminalId);
      return null;
    case 'abandoned':
      keep('abandoned');
      return null;
    case 'open':
    case 'failed':
      await abandonRound(client, roundId);
      keep('abandoned');
      return null;
  }
}

/** The one line a post that failed prints (PRD 1180). */
function failureLine(error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  return `omni ask: this answer was not recorded on the page (${reason.replace(/\s+/g, ' ').trim()})`;
}

/** The title a post hook opens a session with, read only when it must open one. */
function defaultTitle(root: string): () => string {
  return () => sessionTitle({ slug: loadConfig(root).repo.slug, branch: currentBranch(root, execFileSync), root });
}

/**
 * Records an answer the person gave in the terminal on the page (PRD 1180): on the round `pre` left
 * for this tool call, or on one it opens answered when `pre` left none. Another call's round is never
 * read. A failure prints one line through `warn` and never throws; the round's file goes whatever
 * happens.
 */
export async function postHook({
  root,
  client,
  input,
  host = activeMode(root)?.host ?? null,
  title = defaultTitle(root),
  readContext = askContext,
  readSessionContext = sessionContext,
  readLead = roundLead,
  warn = (line: string) => {
    process.stderr.write(`${line}\n`);
  },
}: {
  root: string;
  client: Client;
  input: unknown;
  host?: string | null;
  title?: () => string;
  readContext?: (options: { root: string; input: unknown }) => unknown;
  readSessionContext?: (root: string) => unknown;
  readLead?: (options: { input?: unknown }) => unknown;
  warn?: (line: string) => void;
}): Promise<void> {
  const toolUseId = idOf(field(input, 'tool_use_id'));
  if (!toolUseId) return;
  const round = readRound(root, toolUseId);
  try {
    // A page answer is never posted again from the terminal.
    if (round?.status === 'answered') return;
    if (!round && field(input, 'tool_name') !== TOOL) return;
    const toolInput = field(input, 'tool_input');
    const toolResponse = field(input, 'tool_response');
    const questions = field(toolInput, 'questions') ?? field(toolResponse, 'questions');
    const answers = givenAnswers(questions, field(toolResponse, 'answers') ?? field(toolInput, 'answers'));
    if (!answers) return;
    if (round && (await answerRound(client, round.roundId, answers))) return;
    const terminalId = idOf(field(input, 'session_id'));
    if (!host || !terminalId) throw new Error('no ask session can be opened for this terminal');
    const extras = extrasOf(root, input, { readContext, readLead });
    await openAnswered({ root, host, client, terminalId, title, readSessionContext, ...extras, questions, answers });
  } catch (error) {
    warn(failureLine(error));
  } finally {
    if (round) clearRound(root, toolUseId);
  }
}

/**
 * Closes this terminal's session on the server when it can, then deletes its file — whatever
 * happens. A session left open reads as closed after 12 hours without a call.
 */
export async function endHook({ root, host, client, input }: { root: string; host: string; client: Client; input: unknown }): Promise<void> {
  const terminalId = idOf(field(input, 'session_id'));
  if (terminalId) await closeTerminal({ root, host, client, terminalId });
}
