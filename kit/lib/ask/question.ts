// The CLI adapter of an ask round (PRD 1831): `omni ask question`, `omni ask wait` and `omni ask
// answer`, which ask the person on the page from any agent, with no hook, no stdin and no TTY. A
// question file in, an outcome out; the command turns it into JSON and an exit code. The round's core
// (`./round.ts`) opens the session, posts, waits, abandons and downloads, as it does for Claude's hook.
//
// - A question asked is kept in `.omni-loop/local/ask/questions/<round id>.json` (its questions, the
//   host and the terminal), so that `ask wait` can resume it from another shell call and `ask answer`
//   can shape an answer given in the agent's own chat. It goes once the page answered it, or once an
//   answer was sent for it. `omni ask off` clears it with every other file of the mode.
// - Every way the page is not used (no round, a round abandoned or closed, a call that failed) is one
//   outcome, `elsewhere`, carrying the reason in one line: the agent then asks in its own chat.
// - Nothing here reads stdin, a transcript or a home folder: the command hands it the client.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from './client.ts';
import { askContext, sessionContext } from './context.ts';
import { clearTerminal, ensureLocalDir, isSafeId, LOCAL_DIR } from './local-state.ts';
import type { Answers, Client } from './round.ts';
import { abandonRound, answerRound, awaitRound, givenAnswers, openAnswered, openRound, sweepOldShots, withScreenshots } from './round.ts';
import type { QuestionFile } from './schema.ts';

/** The wait `ask question` and `ask wait` take by default, in seconds: under a cloud shell's 2 minutes. */
export const WAIT_DEFAULT_S = 110;
/** The shortest and the longest wait they take, in seconds; the longest is Claude's hook's. */
export const WAIT_MIN_S = 10;
export const WAIT_MAX_S = 540;
/** The most one `wait` call may take: the server holds it up to 50 s. */
export const CALL_MS = 50_000;

const QUESTIONS_DIR = join('ask', 'questions');

/** A question this checkout asked, as it keeps it for a later `ask wait` or `ask answer`. */
const AskedSchema = z.object({
  roundId: z.string().refine(isSafeId),
  host: z.string().min(1),
  terminalId: z.string().refine(isSafeId),
  questions: z.array(z.unknown()).min(1),
});
type Asked = z.infer<typeof AskedSchema>;

const askedFile = (root: string, roundId: string): string => join(root, LOCAL_DIR, QUESTIONS_DIR, `${roundId}.json`);

/** The question asked under `roundId` here, or `null`: none, or a file that does not read. */
function readAsked(root: string, roundId: string): Asked | null {
  if (!isSafeId(roundId)) return null;
  try {
    const parsed = AskedSchema.safeParse(JSON.parse(readFileSync(askedFile(root, roundId), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeAsked(root: string, asked: Asked): void {
  ensureLocalDir(root);
  mkdirSync(join(root, LOCAL_DIR, QUESTIONS_DIR), { recursive: true });
  writeFileSync(askedFile(root, asked.roundId), `${JSON.stringify(asked, null, 2)}\n`);
}

function clearAsked(root: string, roundId: string): void {
  if (isSafeId(roundId)) rmSync(askedFile(root, roundId), { force: true });
}

/** How asking ended: answered on the page, still open when the wait ran out, or to be asked in the
 * agent's own chat, for `reason`, with the round left behind when there is one. */
export type AskOutcome =
  | { kind: 'answered'; round: string; answers: Answers; shots: string[] }
  | { kind: 'open'; round: string }
  | { kind: 'elsewhere'; reason: string; round: string | null };

/** A client whose calls note the last error they threw, for the one line that says why. */
function recording(client: Client): { client: Client; last: () => unknown } {
  let last: unknown = null;
  const note = <T>(promise: Promise<T>): Promise<T> =>
    promise.catch((error: unknown) => {
      last = error;
      throw error;
    });
  return {
    client: {
      ...client,
      openSession: (...args: Parameters<Client['openSession']>) => note(client.openSession(...args)),
      openRound: (...args: Parameters<Client['openRound']>) => note(client.openRound(...args)),
      wait: (...args: Parameters<Client['wait']>) => note(client.wait(...args)),
    },
    last: () => last,
  };
}

/** Why a call failed, in one line, `host` being the page's. */
export function failureReason(error: unknown, host: string): string {
  if (error instanceof AskCallError) {
    if (error.message.startsWith('OMNI_TOKEN')) return error.message;
    if (error.status === null) return `cannot reach ${host}: allow it in your environment's network access`;
    if (error.status === 401) return `${host} refused this sign-in: run omni signin, or set OMNI_TOKEN`;
    return `${host} refused the question (${String(error.status)}${error.reason ? `: ${error.reason}` : ''})`;
  }
  return error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : String(error);
}

/** Whether `error` is a call that timed out before the page answered it. */
const timedOut = (error: unknown): boolean => error instanceof AskCallError && error.status === null && error.message.endsWith('timed out');

/** What asking and waiting need. */
type Wait = { waitMs: number; callMs?: number; now?: () => number };

/** Waits for a round asked here until the wait runs out, and settles what it came to. */
async function settle({ root, client, asked, waitMs, callMs = CALL_MS, now = Date.now }: { root: string; client: Client; asked: Asked } & Wait): Promise<AskOutcome> {
  const { roundId, questions, terminalId } = asked;
  const recorder = recording(client);
  const deadline = now() + waitMs;
  const outcome = await awaitRound({ client: recorder.client, roundId, questions, deadline, callMs, now });
  const elsewhere = (reason: string): AskOutcome => ({ kind: 'elsewhere', reason, round: roundId });
  switch (outcome.kind) {
    case 'answered': {
      const shots: string[] = [];
      const answers = await withScreenshots({ root, client, roundId, answers: outcome.answers, attachments: outcome.attachments, shots, deadline, now });
      clearAsked(root, roundId);
      return { kind: 'answered', round: roundId, answers, shots };
    }
    case 'open':
      return { kind: 'open', round: roundId };
    case 'closed':
      // The next question opens a new session; this round stays, for an answer given in the chat.
      clearTerminal(root, terminalId);
      return elsewhere('the session was closed on the page');
    case 'abandoned':
      return elsewhere('the question was abandoned on the page');
    case 'failed': {
      const error = recorder.last();
      // The last call outlived the wait the server holds it for: the wait ran out, the round open.
      if (timedOut(error) && now() >= deadline) return { kind: 'open', round: roundId };
      await abandonRound(client, roundId);
      return elsewhere(error === null ? "the page's answer did not fit the questions" : failureReason(error, asked.host));
    }
  }
}

/**
 * Asks `file`'s questions on the page in terminal `terminalId`'s session (opened when it has none),
 * and waits up to `waitMs` for the answer.
 */
export async function askQuestion({ root, host, client, terminalId, title, file, ...wait }: {
  root: string;
  host: string;
  client: Client;
  terminalId: string;
  title: () => string;
  file: QuestionFile;
} & Wait): Promise<AskOutcome> {
  const now = wait.now ?? Date.now;
  sweepOldShots(root, now);
  const recorder = recording(client);
  const { questions } = file;
  const roundId = await openRound({
    root,
    host,
    client: recorder.client,
    terminalId,
    title,
    readSessionContext: sessionContext,
    readContext: () => ({
      ...askContext({ root, input: { session_id: terminalId } }),
      skill: file.context?.skill ?? null,
      model: file.context?.model ?? null,
      tokens: null,
    }),
    readLead: () => file.lead ?? null,
    questions,
  });
  if (roundId === null) {
    const error = recorder.last();
    return { kind: 'elsewhere', reason: error === null ? 'the page opened no question' : failureReason(error, host), round: null };
  }
  if (!isSafeId(roundId)) {
    await abandonRound(client, roundId);
    return { kind: 'elsewhere', reason: 'the page named the question with an id this checkout cannot keep', round: null };
  }
  const asked = { roundId, host, terminalId, questions };
  writeAsked(root, asked);
  return settle({ root, client, asked, ...wait });
}

/** Resumes the wait on a round asked here. */
export async function resumeQuestion({ root, host, client, roundId, ...wait }: { root: string; host: string; client: Client; roundId: string } & Wait): Promise<AskOutcome> {
  const asked = readAsked(root, roundId);
  if (!asked) return { kind: 'elsewhere', reason: `no question asked in this checkout is round ${roundId}`, round: null };
  if (asked.host !== host) return { kind: 'elsewhere', reason: `round ${roundId} was asked on ${asked.host}, not ${host}`, round: null };
  return settle({ root, client, asked, ...wait });
}

/** An answer file: each question's answer, as `AskUserQuestion` takes them (a label list joins). */
const AnswerFileSchema = z.strictObject({ answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])) });
export type AnswerFile = z.infer<typeof AnswerFileSchema>;

/** `value` read as an answer file, or the first field it gets wrong, as a dotted path. */
export function readAnswerFile(value: unknown): { ok: true; value: AnswerFile } | { ok: false; field: string; message: string } {
  const parsed = AnswerFileSchema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  const issue = parsed.error.issues.at(0);
  // An unknown field is named itself; the file as a whole is `(file)`.
  const unknown = issue?.code === 'unrecognized_keys' ? issue.keys.slice(0, 1) : [];
  const field = [...(issue?.path ?? []), ...unknown].map(String).join('.');
  return { ok: false, field: field || '(file)', message: issue?.message ?? 'not an answer file' };
}

/** The answers given, a question left empty left out, as `givenAnswers` shapes them without the questions. */
function answersAsGiven(answers: AnswerFile['answers']): Answers | null {
  const questions = Object.keys(answers).map((question) => ({ question }));
  return givenAnswers(questions, answers);
}

/**
 * Sends the answers the person gave in the agent's own chat to the page (PRD 1180), `via: "terminal"`:
 * on the round, or, when the page no longer has it, on one opened answered in this terminal's
 * session. A question left empty is left out; nothing is sent when none was answered. Throws when it
 * could not be recorded.
 */
export async function answerQuestion({ root, host, client, roundId, answers, title }: {
  root: string;
  host: string;
  client: Client;
  roundId: string;
  answers: AnswerFile['answers'];
  title: () => string;
}): Promise<'sent' | 'nothing'> {
  const asked = readAsked(root, roundId);
  const given = asked ? givenAnswers(asked.questions, answers) : answersAsGiven(answers);
  if (!given) return 'nothing';
  if (!(await answerRound(client, roundId, given))) {
    if (!asked) throw new Error(`the page no longer has round ${roundId}`);
    await openAnswered({
      root,
      host,
      client,
      terminalId: asked.terminalId,
      title,
      readSessionContext: sessionContext,
      readContext: () => askContext({ root, input: { session_id: asked.terminalId } }),
      readLead: () => null,
      questions: asked.questions,
      answers: given,
    });
  }
  clearAsked(root, roundId);
  return 'sent';
}
