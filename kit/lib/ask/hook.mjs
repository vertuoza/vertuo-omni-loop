// The bodies of ask mode's three harness hooks, as functions of (the hook's input, the checkout's
// local state, the contract client). Whatever goes wrong, a hook answers `null` — no output — so the
// person's terminal prompt shows exactly as it would without ask mode. The mode never blocks a
// session.
//
// - `pre` (PreToolUse on AskUserQuestion): posts the round, waits on it up to 540 s in all (the
//   hook's own timeout is 600 s), and hands the page's answer back through `updatedInput.answers`.
//   On any other outcome it abandons the round when it can, and answers nothing.
// - `post` (PostToolUse on AskUserQuestion): an answer given in the terminal is posted to the page as
//   well, with `via: "terminal"`; then the round file goes.
// - `prompt` (UserPromptSubmit): one sentence of context, so questions go through the tool.
import { loadConfig } from '../config.mjs';
import { clearRound, clearSession, readRound, readSession, writeRound } from './local-state.mjs';

const TOOL = 'AskUserQuestion';

export const PROMPT_CONTEXT =
  'Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.';

/** The total a `pre` hook waits for the page, and the most one `wait` call may take (the server
 * holds it up to 50 s). */
export const WAIT_LIMITS = Object.freeze({ totalMs: 540_000, callMs: 60_000 });

/**
 * The mode in this checkout: the open session and the URL its calls go to, or `null` when it is off
 * — no `ask.json`, `ask.url` null or unreadable, or `ask.url` naming another host than the session's.
 *
 * @returns {{ session: { sessionId: string, url: string, host: string }, baseUrl: string } | null}
 */
export function activeSession(root) {
  const session = readSession(root);
  if (!session) return null;
  let baseUrl;
  try {
    baseUrl = loadConfig(root).ask.url;
  } catch {
    return null;
  }
  if (!baseUrl || new URL(baseUrl).host !== session.host) return null;
  return { session, baseUrl };
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

/**
 * @param {{ root: string, session: { sessionId: string }, client: ReturnType<import('./client.mjs').askClient>,
 *   input: any, limits?: { totalMs: number, callMs: number }, now?: () => number }} options
 * @returns {Promise<object | null>} the hook's output, or `null` for none
 */
export async function preHook({ root, session, client, input, limits = WAIT_LIMITS, now = Date.now }) {
  if (input?.tool_name !== TOOL) return null;
  const toolInput = input.tool_input;
  const questions = toolInput?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  const toolUseId = typeof input.tool_use_id === 'string' ? input.tool_use_id : null;
  const deadline = now() + limits.totalMs;

  let roundId;
  try {
    ({ roundId } = await client.openRound(session.sessionId, questions));
  } catch {
    return null;
  }
  if (typeof roundId !== 'string' || roundId === '') return null;
  const keep = (status) => writeRound(root, { roundId, toolUseId, status });
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
      clearRound(root);
      clearSession(root);
      return null;
    }
    if (result?.status === 'abandoned') {
      keep('abandoned');
      return null;
    }
    const answers = result?.status === 'answered' ? toolAnswers(questions, result.answers) : null;
    if (!answers) return giveUp();
    keep('answered');
    return preOutput(toolInput, answers);
  }
}

/**
 * Posts an answer the person gave in the terminal to the round `pre` left open or abandoned, then
 * deletes the round file — whatever happens.
 */
export async function postHook({ root, client, input }) {
  const round = readRound(root);
  if (!round) return;
  try {
    const toolUseId = typeof input?.tool_use_id === 'string' ? input.tool_use_id : null;
    if (round.toolUseId && toolUseId && round.toolUseId !== toolUseId) return;
    if (round.status === 'answered') return;
    const questions = input?.tool_input?.questions ?? input?.tool_response?.questions;
    const answers = toolAnswers(questions, input?.tool_response?.answers ?? input?.tool_input?.answers);
    if (answers) await client.answer(round.roundId, answers);
  } catch {
    // The page misses one terminal answer; the session goes on.
  } finally {
    clearRound(root);
  }
}
