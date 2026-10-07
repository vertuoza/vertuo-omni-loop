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
import { execFileSync } from 'node:child_process';
import { loadConfig } from '../config.ts';
import type { askClient } from './client.ts';
import { askContext, sessionContext } from './context.ts';
import { roundLead } from './lead.ts';
import {
  clearOldShots, clearRound, clearTerminal, isSafeId, isShotName, readMode, readRound, readTerminal, writeRound, writeShot, writeTerminal,
} from './local-state.ts';
import { currentBranch, sessionTitle } from './mode.ts';
import type { RoundStatus } from './schema.ts';
import { field, jsonObject } from './schema.ts';

/** The contract client the hooks call through (`./client.ts`), or a test's own of the same shape. */
type Client = ReturnType<typeof askClient>;

/** `AskUserQuestion`'s answers, as the tool takes them: question text to the answer. */
type Answers = Record<string, string>;

/** A hook's output, written to stdout as JSON. */
type HookOutput = { hookSpecificOutput: Record<string, unknown> };

const TOOL = 'AskUserQuestion';

export const PROMPT_CONTEXT =
  'Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.';

/** The total a `pre` hook waits for the page, and the most one `wait` call may take (the server
 * holds it up to 50 s). */
export const WAIT_LIMITS = Object.freeze({ totalMs: 540_000, callMs: 60_000 });

/** The most one screenshot's download may take (PRD 620), inside the same total. */
const SHOT_DOWNLOAD_MS = 30_000;

/** The line that heads a question's screenshots in its answer. */
const SCREENSHOTS_HEADING = 'Screenshots (open each with Read):';

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

/**
 * `answers` shaped as `AskUserQuestion` takes them: question text to the chosen label, several
 * labels joined with `, `, typed text kept verbatim. `null` unless every question has an answer.
 */
export function toolAnswers(questions: unknown, answers: unknown): Answers | null {
  return shapeAnswers(questions, answers, { partly: false });
}

/**
 * `answers` shaped as `toolAnswers` shapes them, keeping only the questions that have one (PRD 1180):
 * a question left empty is left out. `null` when none has an answer.
 */
export function givenAnswers(questions: unknown, answers: unknown): Answers | null {
  return shapeAnswers(questions, answers, { partly: true });
}

function shapeAnswers(questions: unknown, answers: unknown, { partly }: { partly: boolean }): Answers | null {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const shaped: Answers = {};
  const list: readonly unknown[] = questions;
  for (const entry of list) {
    // A question that is null or undefined throws, as destructuring it always has.
    if (entry === null || entry === undefined) throw new TypeError(`a question is ${String(entry)}`);
    const question = String(field(entry, 'question'));
    const given = field(answers, question);
    const text = Array.isArray(given) && given.every((label) => typeof label === 'string') ? given.join(', ') : given;
    if (typeof text !== 'string' || text === '') {
      if (partly) continue;
      return null;
    }
    shaped[question] = text;
  }
  return Object.keys(shaped).length > 0 ? shaped : null;
}

export function promptOutput(): HookOutput {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: PROMPT_CONTEXT } };
}

function preOutput(toolInput: unknown, answers: Answers): HookOutput {
  const input = jsonObject(toolInput) ?? {};
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...input, answers } } };
}

/** A best-effort context (`./context.ts`), or `null` when even reading it failed: the question goes
 * on either way. */
function contextOf<T>(read: () => T): T | null {
  try {
    return read() ?? null;
  } catch {
    return null;
  }
}

/**
 * `answers` with, for each question whose answer carried screenshots, the heading and one line per
 * screenshot appended after a blank line: its absolute path once downloaded, or a line saying it
 * could not be. Nothing here can fail the answer.
 */
async function withScreenshots({ root, client, roundId, answers, attachments, deadline, now }: {
  root: string;
  client: Client;
  roundId: string;
  answers: Answers;
  attachments: unknown;
  deadline: number;
  now: () => number;
}): Promise<Answers> {
  if (!attachments || typeof attachments !== 'object' || Array.isArray(attachments)) return answers;
  const shaped = { ...answers };
  for (const question of Object.keys(answers)) {
    const shots = field(attachments, question);
    if (!Array.isArray(shots) || shots.length === 0) continue;
    const lines: string[] = [];
    for (const [index, shot] of shots.entries()) {
      const path = await downloadShot({ root, client, roundId, shot, deadline, now });
      lines.push(path ? `- ${path}` : `- Screenshot ${index + 1} could not be downloaded`);
    }
    shaped[question] = `${answers[question]}\n\n${SCREENSHOTS_HEADING}\n${lines.join('\n')}`;
  }
  return shaped;
}

/** One screenshot written into its round's folder: its absolute path, or `null` when it could not be. */
async function downloadShot({ root, client, roundId, shot, deadline, now }: {
  root: string;
  client: Client;
  roundId: string;
  shot: unknown;
  deadline: number;
  now: () => number;
}): Promise<string | null> {
  const left = deadline - now();
  const url = field(shot, 'url');
  const name = field(shot, 'name');
  // A name that could leave the folder is refused before anything is fetched.
  if (left <= 0 || typeof url !== 'string' || url === '' || !isShotName(name)) return null;
  try {
    const bytes = await client.download(url, { timeoutMs: Math.min(SHOT_DOWNLOAD_MS, left) });
    return writeShot(root, roundId, name, bytes);
  } catch {
    return null;
  }
}

/** The input's id when it may name a file, else `null`. */
const idOf = (value: unknown): string | null => (isSafeId(value) ? value : null);

/** The session the server says is closed or gone, when a round is posted into it. */
const SESSION_GONE = [404, 409];

/**
 * This terminal's session: the one its file names on `host`, or one it opens titled `title()` and
 * writes. Throws when none could be opened.
 */
async function terminalSession({ root, host, client, terminalId, title, readSessionContext }: {
  root: string;
  host: string;
  client: Client;
  terminalId: string;
  title: () => string;
  readSessionContext: (root: string) => unknown;
}): Promise<string> {
  const known = readTerminal(root, terminalId);
  if (known && known.host === host) return known.sessionId;
  const opened = await client.openSession(title(), contextOf(() => readSessionContext(root)) ?? undefined);
  const id = field(opened, 'id');
  if (typeof id !== 'string' || id === '') throw new Error('the server answered with no session');
  writeTerminal(root, terminalId, { sessionId: id, host });
  return id;
}

/** Removes the screenshot folders older than 7 days; one that cannot be removed stays one more round. */
function sweepOldShots(root: string, now: () => number): void {
  try {
    clearOldShots(root, now());
  } catch {
    // Old screenshots stay one more round.
  }
}

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

/** The round opened for this question in this terminal's session, or `null` when none could be. */
async function openRoundFor({ root, host, client, input, title, readContext, readSessionContext, readLead, questions, terminalId }: {
  root: string;
  host: string;
  client: Client;
  input: unknown;
  title: () => string;
  readContext: (options: { root: string; input: unknown }) => unknown;
  readSessionContext: (root: string) => unknown;
  readLead: (options: { input?: unknown }) => unknown;
  questions: unknown[];
  terminalId: string;
}): Promise<string | null> {
  let roundId: unknown;
  try {
    const sessionId = await terminalSession({ root, host, client, terminalId, title, readSessionContext });
    try {
      const context = contextOf(() => readContext({ root, input })) ?? undefined;
      roundId = field(await client.openRound(sessionId, questions, context, contextOf(() => readLead({ input }))), 'roundId');
    } catch (error) {
      // Closed or gone on the server: this question goes to the terminal, the next opens anew.
      const status = field(error, 'status');
      if (typeof status === 'number' && SESSION_GONE.includes(status)) clearTerminal(root, terminalId);
      return null;
    }
  } catch {
    return null;
  }
  return typeof roundId === 'string' && roundId !== '' ? roundId : null;
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

  const roundId = await openRoundFor({ root, host, client, input, title, readContext, readSessionContext, readLead, questions, terminalId });
  if (!roundId) return null;
  const keep = (status: RoundStatus): void => {
    writeRound(root, toolUseId, { roundId, status });
  };
  keep('open');

  const giveUp = async (): Promise<null> => {
    await client.abandon(roundId).catch(() => {});
    keep('abandoned');
    return null;
  };

  for (;;) {
    const left = deadline - now();
    if (left <= 0) return giveUp();
    let result: unknown;
    try {
      result = await client.wait(roundId, { timeoutMs: Math.min(limits.callMs, left) });
    } catch {
      return giveUp();
    }
    const status = field(result, 'status');
    if (status === 'open') continue;
    if (status === 'closed') {
      // The round stays: the post hook records the terminal's answer on it (PRD 1180).
      clearTerminal(root, terminalId);
      return null;
    }
    if (status === 'abandoned') {
      keep('abandoned');
      return null;
    }
    const answers = status === 'answered' ? toolAnswers(questions, field(result, 'answers')) : null;
    if (!answers) return giveUp();
    keep('answered');
    const attachments = field(result, 'attachments');
    return preOutput(toolInput, await withScreenshots({ root, client, roundId, answers, attachments, deadline, now }));
  }
}

/** The status of a call the server refused, or `null`. */
function statusOf(error: unknown): number | null {
  const status = field(error, 'status');
  return typeof status === 'number' ? status : null;
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
 * Opens this question's round already answered in the terminal (PRD 1180): in this terminal's
 * session, or in a new one when the server no longer takes rounds in it. An older server, which opens
 * it unanswered, is then sent the answer. Throws when it could not be recorded.
 */
async function openAnswered({ root, host, client, input, title, readContext, readSessionContext, readLead, questions, answers, terminalId }: {
  root: string;
  host: string;
  client: Client;
  input: unknown;
  title: () => string;
  readContext: (options: { root: string; input: unknown }) => unknown;
  readSessionContext: (root: string) => unknown;
  readLead: (options: { input?: unknown }) => unknown;
  questions: unknown;
  answers: Answers;
  terminalId: string;
}): Promise<void> {
  const context = contextOf(() => readContext({ root, input })) ?? undefined;
  const lead = contextOf(() => readLead({ input }));
  const send = async (): Promise<unknown> => {
    const sessionId = await terminalSession({ root, host, client, terminalId, title, readSessionContext });
    return client.openAnswered(sessionId, questions, answers, context, lead);
  };
  let reply: unknown;
  try {
    reply = await send();
  } catch (error) {
    const status = statusOf(error);
    if (status === null || !SESSION_GONE.includes(status)) throw error;
    // Closed or gone on the server: a new session takes it.
    clearTerminal(root, terminalId);
    reply = await send();
  }
  const roundId = field(reply, 'roundId');
  if (typeof roundId !== 'string' || roundId === '') throw new Error('the server answered with no round');
  if (field(reply, 'status') !== 'answered') await client.answer(roundId, answers);
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
    await openAnswered({ root, host, client, input, title, readContext, readSessionContext, readLead, questions, answers, terminalId });
  } catch (error) {
    warn(failureLine(error));
  } finally {
    if (round) clearRound(root, toolUseId);
  }
}

/**
 * Posts the terminal's answer to a round `pre` left: `true` once it is settled (recorded, or answered
 * on the page meanwhile, the first answer winning), `false` when the round is gone with its session.
 * Throws on any other failure.
 */
async function answerRound(client: Client, roundId: string, answers: Answers): Promise<boolean> {
  try {
    await client.answer(roundId, answers);
    return true;
  } catch (error) {
    const status = statusOf(error);
    if (status === 409) return true;
    if (status === 404) return false;
    throw error;
  }
}

/**
 * Closes this terminal's session on the server when it can, then deletes its file — whatever
 * happens. A session left open reads as closed after 12 hours without a call.
 */
export async function endHook({ root, host, client, input }: { root: string; host: string; client: Client; input: unknown }): Promise<void> {
  const terminalId = idOf(field(input, 'session_id'));
  const session = readTerminal(root, terminalId);
  if (!session) return;
  try {
    if (session.host === host) await client.closeSession(session.sessionId);
  } catch {
    // The page closes it on its own.
  } finally {
    clearTerminal(root, terminalId);
  }
}
