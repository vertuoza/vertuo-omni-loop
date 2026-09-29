// The bodies of ask mode's harness hooks, as functions of (the hook's input, the checkout's local
// state, the contract client). Whatever goes wrong, a hook answers `null` — no output — so the
// person's terminal prompt shows exactly as it would without ask mode. The mode never blocks a
// session. The mode is per checkout; the session is per terminal, the terminal being the input's
// `session_id`, and the round per question, keyed by its `tool_use_id` (PRD 142's spec).
//
// - `pre` (PreToolUse on AskUserQuestion): opens this terminal's session on its first question
//   (with `context.repo`, PRD 144), posts the round with its best-effort `context` (`./context.mjs`:
//   where it came from, what the session had cost; a context that cannot be read is sent as nulls, or
//   not at all, and never stops the question), waits on it up to 540 s in all (the hook's own timeout
//   is 600 s), and hands the page's answer back through `updatedInput.answers`. On any other outcome
//   it abandons the round when it can, and answers nothing. A closed session is forgotten: the next
//   question opens anew. Before it opens a round, it removes the screenshot folders older than 7 days.
//   An answer that carries screenshots (PRD 620) has each downloaded from its signed link into
//   `.omni-loop/local/ask/shots/<round id>/`, 30 s a file within the same total, and their absolute
//   paths appended to that question's answer for Claude to Read; one it could not download is named
//   instead, and the answer goes through either way.
// - `post` (PostToolUse on AskUserQuestion): an answer given in the terminal is posted to the page as
//   well, with `via: "terminal"`; then that question's round file goes.
// - `end` (SessionEnd): closes this terminal's session and deletes its file.
// - `prompt` (UserPromptSubmit): one sentence of context, so questions go through the tool.
import { loadConfig } from '../config.mjs';
import { askContext, sessionContext } from './context.mjs';
import {
  clearOldShots, clearRound, clearTerminal, isSafeId, isShotName, readMode, readRound, readTerminal, writeRound, writeShot, writeTerminal,
} from './local-state.mjs';

const TOOL = 'AskUserQuestion';

export const PROMPT_CONTEXT =
  'Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.';

/** The total a `pre` hook waits for the page, and the most one `wait` call may take (the server
 * holds it up to 50 s). */
export const WAIT_LIMITS = Object.freeze({ totalMs: 540_000, callMs: 60_000 });

/** The most one screenshot's download may take (PRD 620), inside the same total. */
export const SHOT_DOWNLOAD_MS = 30_000;

/** The line that heads a question's screenshots in its answer. */
export const SCREENSHOTS_HEADING = 'Screenshots (open each with Read):';

/**
 * The mode in this checkout: the host it is on against and the URL its calls go to, or `null` when
 * it is off — no `ask.json`, `ask.url` null or unreadable, or `ask.url` naming another host.
 *
 * @returns {{ host: string, baseUrl: string } | null}
 */
export function activeMode(root) {
  const mode = readMode(root);
  if (!mode) return null;
  let baseUrl;
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
export function toolAnswers(questions, answers) {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const shaped = {};
  for (const { question } of questions) {
    const given = answers[question];
    const text = Array.isArray(given) && given.every((label) => typeof label === 'string') ? given.join(', ') : given;
    if (typeof text !== 'string' || text === '') return null;
    shaped[question] = text;
  }
  return shaped;
}

export function promptOutput() {
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: PROMPT_CONTEXT } };
}

function preOutput(toolInput, answers) {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { ...toolInput, answers } } };
}

/** A best-effort context (`./context.mjs`), or `null` when even reading it failed: the question goes
 * on either way. */
function contextOf(read) {
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
async function withScreenshots({ root, client, roundId, answers, attachments, deadline, now }) {
  if (!attachments || typeof attachments !== 'object' || Array.isArray(attachments)) return answers;
  const shaped = { ...answers };
  for (const question of Object.keys(answers)) {
    const shots = attachments[question];
    if (!Array.isArray(shots) || shots.length === 0) continue;
    const lines = [];
    for (const [index, shot] of shots.entries()) {
      const path = await downloadShot({ root, client, roundId, shot, deadline, now });
      lines.push(path ? `- ${path}` : `- Screenshot ${index + 1} could not be downloaded`);
    }
    shaped[question] = `${answers[question]}\n\n${SCREENSHOTS_HEADING}\n${lines.join('\n')}`;
  }
  return shaped;
}

/** One screenshot written into its round's folder: its absolute path, or `null` when it could not be. */
async function downloadShot({ root, client, roundId, shot, deadline, now }) {
  const left = deadline - now();
  // A name that could leave the folder is refused before anything is fetched.
  if (left <= 0 || typeof shot?.url !== 'string' || shot.url === '' || !isShotName(shot.name)) return null;
  try {
    const bytes = await client.download(shot.url, { timeoutMs: Math.min(SHOT_DOWNLOAD_MS, left) });
    return writeShot(root, roundId, shot.name, bytes);
  } catch {
    return null;
  }
}

/** The input's id when it may name a file, else `null`. */
const idOf = (value) => (isSafeId(value) ? value : null);

/** The session the server says is closed or gone, when a round is posted into it. */
const SESSION_GONE = [404, 409];

/**
 * This terminal's session: the one its file names on `host`, or one it opens titled `title()` and
 * writes. Throws when none could be opened.
 */
async function terminalSession({ root, host, client, terminalId, title, readSessionContext }) {
  const known = readTerminal(root, terminalId);
  if (known && known.host === host) return known.sessionId;
  const opened = await client.openSession(title(), contextOf(() => readSessionContext(root)) ?? undefined);
  if (typeof opened?.id !== 'string' || opened.id === '') throw new Error('the server answered with no session');
  writeTerminal(root, terminalId, { sessionId: opened.id, host });
  return opened.id;
}

/**
 * @param {{ root: string, host: string, client: ReturnType<import('./client.mjs').askClient>,
 *   input: any, title: () => string, limits?: { totalMs: number, callMs: number }, now?: () => number,
 *   readContext?: typeof askContext, readSessionContext?: typeof sessionContext }} options
 *   `title` names a session this terminal opens: `<repo slug> · <branch>`.
 * @returns {Promise<object | null>} the hook's output, or `null` for none
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
}) {
  if (input?.tool_name !== TOOL) return null;
  const toolInput = input.tool_input;
  const questions = toolInput?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  const terminalId = idOf(input.session_id);
  const toolUseId = idOf(input.tool_use_id);
  if (!terminalId || !toolUseId) return null;
  const deadline = now() + limits.totalMs;

  try {
    clearOldShots(root, now());
  } catch {
    // Old screenshots stay one more round.
  }

  let roundId;
  try {
    const sessionId = await terminalSession({ root, host, client, terminalId, title, readSessionContext });
    try {
      ({ roundId } = await client.openRound(sessionId, questions, contextOf(() => readContext({ root, input })) ?? undefined));
    } catch (error) {
      // Closed or gone on the server: this question goes to the terminal, the next opens anew.
      if (SESSION_GONE.includes(error?.status)) clearTerminal(root, terminalId);
      return null;
    }
  } catch {
    return null;
  }
  if (typeof roundId !== 'string' || roundId === '') return null;
  const keep = (status) => writeRound(root, toolUseId, { roundId, status });
  keep('open');

  const giveUp = async () => {
    await client.abandon(roundId).catch(() => {});
    keep('abandoned');
    return null;
  };

  for (;;) {
    const left = deadline - now();
    if (left <= 0) return giveUp();
    let result;
    try {
      result = await client.wait(roundId, { timeoutMs: Math.min(limits.callMs, left) });
    } catch {
      return giveUp();
    }
    if (result?.status === 'open') continue;
    if (result?.status === 'closed') {
      clearRound(root, toolUseId);
      clearTerminal(root, terminalId);
      return null;
    }
    if (result?.status === 'abandoned') {
      keep('abandoned');
      return null;
    }
    const answers = result?.status === 'answered' ? toolAnswers(questions, result.answers) : null;
    if (!answers) return giveUp();
    keep('answered');
    const attachments = result.attachments;
    return preOutput(toolInput, await withScreenshots({ root, client, roundId, answers, attachments, deadline, now }));
  }
}

/**
 * Posts an answer the person gave in the terminal to the round `pre` left open or abandoned for this
 * tool call, then deletes that round's file — whatever happens. Another call's round is never read.
 */
export async function postHook({ root, client, input }) {
  const toolUseId = idOf(input?.tool_use_id);
  const round = readRound(root, toolUseId);
  if (!round) return;
  try {
    if (round.status === 'answered') return;
    const questions = input?.tool_input?.questions ?? input?.tool_response?.questions;
    const answers = toolAnswers(questions, input?.tool_response?.answers ?? input?.tool_input?.answers);
    if (answers) await client.answer(round.roundId, answers);
  } catch {
    // The page misses one terminal answer; the session goes on.
  } finally {
    clearRound(root, toolUseId);
  }
}

/**
 * Closes this terminal's session on the server when it can, then deletes its file — whatever
 * happens. A session left open reads as closed after 12 hours without a call.
 */
export async function endHook({ root, host, client, input }) {
  const terminalId = idOf(input?.session_id);
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
