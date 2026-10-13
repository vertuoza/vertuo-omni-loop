// The core of an ask round (PRD 1831), shared by every entry that asks the person on the page: the
// Claude hook (`./hook.ts`, stdin JSON in, `hookSpecificOutput` out) and the CLI (a question file in,
// JSON and an exit code out). It opens this terminal's session when it has none, posts the round,
// waits for it in calls of at most `callMs` up to a deadline, abandons it, downloads the screenshots
// an answer carries (PRD 620) and records an answer given outside the page (PRD 1180). Nothing here
// reads stdin, a transcript or a TTY: each entry hands it what it read its own way.
import type { askClient } from './client.ts';
import { clearOldShots, clearTerminal, isShotName, readTerminal, writeShot, writeTerminal } from './local-state.ts';
import { field } from './schema.ts';

/** The contract client the round calls through (`./client.ts`), or a test's own of the same shape. */
export type Client = ReturnType<typeof askClient>;

/** `AskUserQuestion`'s answers, as the tool takes them: question text to the answer. */
export type Answers = Record<string, string>;

/** The most one screenshot's download may take (PRD 620), inside the same total. */
const SHOT_DOWNLOAD_MS = 30_000;

/** The line that heads a question's screenshots in its answer. */
const SCREENSHOTS_HEADING = 'Screenshots (open each with Read):';

/** The session the server says is closed or gone, when a round is posted into it. */
const SESSION_GONE = [404, 409];

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
  const list = questionsToShape(questions, answers);
  if (!list) return null;
  const shaped: Answers = {};
  for (const entry of list) {
    const question = questionOf(entry);
    const text = answerText(field(answers, question));
    if (text !== null) shaped[question] = text;
    else if (!partly) return null;
  }
  return Object.keys(shaped).length > 0 ? shaped : null;
}

/** The questions, when there are some and `answers` is a record to read them from; else `null`. */
function questionsToShape(questions: unknown, answers: unknown): readonly unknown[] | null {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return null;
  const list: readonly unknown[] = questions;
  return list;
}

/** A question's text. A question that is null or undefined throws, as destructuring it always has. */
function questionOf(entry: unknown): string {
  if (entry === null || entry === undefined) throw new TypeError(`a question is ${String(entry)}`);
  return String(field(entry, 'question'));
}

/** The answer given to one question, its labels joined; `null` when it has none. */
function answerText(given: unknown): string | null {
  const text = Array.isArray(given) && given.every((label) => typeof label === 'string') ? given.join(', ') : given;
  return typeof text === 'string' && text !== '' ? text : null;
}

/** A best-effort read (a round's context, its lead), or `null` when even reading it failed: the
 * question goes on either way. */
function contextOf<T>(read: () => T): T | null {
  try {
    return read() ?? null;
  } catch {
    return null;
  }
}

/** What reading a downloaded round's screenshots needs. */
type ShotsInput = {
  root: string;
  client: Client;
  roundId: string;
  deadline: number;
  now: () => number;
};

/**
 * `answers` with, for each question whose answer carried screenshots, the heading and one line per
 * screenshot appended after a blank line: its absolute path once downloaded, or a line saying it
 * could not be. Nothing here can fail the answer. `shots` gets each path written, in order.
 */
export async function withScreenshots({ answers, attachments, shots = [], ...input }: ShotsInput & {
  answers: Answers;
  attachments: unknown;
  shots?: string[];
}): Promise<Answers> {
  if (!attachments || typeof attachments !== 'object' || Array.isArray(attachments)) return answers;
  const shaped = { ...answers };
  for (const question of Object.keys(answers)) {
    const list = field(attachments, question);
    if (!Array.isArray(list) || list.length === 0) continue;
    const lines: string[] = [];
    for (const [index, shot] of list.entries()) {
      const path = await downloadShot({ ...input, shot });
      if (path) shots.push(path);
      lines.push(path ? `- ${path}` : `- Screenshot ${index + 1} could not be downloaded`);
    }
    shaped[question] = `${answers[question]}\n\n${SCREENSHOTS_HEADING}\n${lines.join('\n')}`;
  }
  return shaped;
}

/** One screenshot written into its round's folder: its absolute path, or `null` when it could not be. */
async function downloadShot({ root, client, roundId, shot, deadline, now }: ShotsInput & { shot: unknown }): Promise<string | null> {
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

/** Removes the screenshot folders older than 7 days; one that cannot be removed stays one more round. */
export function sweepOldShots(root: string, now: () => number): void {
  try {
    clearOldShots(root, now());
  } catch {
    // Old screenshots stay one more round.
  }
}

/** The status of a call the server refused, or `null`. */
function statusOf(error: unknown): number | null {
  const status = field(error, 'status');
  return typeof status === 'number' ? status : null;
}

/** Whether the server refused a call because the session is closed or gone. */
const sessionGone = (error: unknown): boolean => {
  const status = statusOf(error);
  return status !== null && SESSION_GONE.includes(status);
};

/** What any round needs: the checkout, the host its mode is on against, the client and the terminal. */
export type Terminal = {
  root: string;
  host: string;
  client: Client;
  terminalId: string;
  /** The title a session this terminal opens takes: `<repo slug> · <branch>`. */
  title: () => string;
  /** The session's context (PRD 144), sent when it opens; best effort. */
  readSessionContext: (root: string) => unknown;
};

/**
 * This terminal's session: the one its file names on `host`, or one it opens titled `title()` and
 * writes. Throws when none could be opened.
 */
async function terminalSession({ root, host, client, terminalId, title, readSessionContext }: Terminal): Promise<string> {
  const known = readTerminal(root, terminalId);
  if (known && known.host === host) return known.sessionId;
  const opened = await client.openSession(title(), contextOf(() => readSessionContext(root)) ?? undefined);
  const id = field(opened, 'id');
  if (typeof id !== 'string' || id === '') throw new Error('the server answered with no session');
  writeTerminal(root, terminalId, { sessionId: id, host });
  return id;
}

/** What a round carries beside its questions: its context (PRD 144) and its lead (PRD 752), each
 * read only when the round is sent, and best effort. */
export type RoundExtras = { readContext: () => unknown; readLead: () => unknown };

/** The round opened for these questions in this terminal's session, or `null` when none could be. */
export async function openRound({ questions, readContext, readLead, ...terminal }: Terminal & RoundExtras & { questions: unknown[] }): Promise<string | null> {
  let roundId: unknown;
  try {
    const sessionId = await terminalSession(terminal);
    try {
      const context = contextOf(readContext) ?? undefined;
      roundId = field(await terminal.client.openRound(sessionId, questions, context, contextOf(readLead)), 'roundId');
    } catch (error) {
      // Closed or gone on the server: this question goes to the terminal, the next opens anew.
      if (sessionGone(error)) clearTerminal(terminal.root, terminal.terminalId);
      return null;
    }
  } catch {
    return null;
  }
  return typeof roundId === 'string' && roundId !== '' ? roundId : null;
}

/** How a wait on a round ended. */
export type RoundOutcome =
  | { kind: 'answered'; answers: Answers; attachments: unknown }
  /** The deadline came with the round still open. */
  | { kind: 'open' }
  /** The session closed on the page; the round stays, for an answer given outside it. */
  | { kind: 'closed' }
  | { kind: 'abandoned' }
  /** A wait call failed, or the answer did not fit the questions. */
  | { kind: 'failed' };

/**
 * Waits for the round, in calls of at most `callMs`, until `deadline`. Never throws, abandons
 * nothing: what to do with a round left open is the entry's call.
 */
export async function awaitRound({ client, roundId, questions, deadline, callMs, now }: {
  client: Client;
  roundId: string;
  questions: unknown;
  deadline: number;
  callMs: number;
  now: () => number;
}): Promise<RoundOutcome> {
  for (;;) {
    const left = deadline - now();
    if (left <= 0) return { kind: 'open' };
    let result: unknown;
    try {
      result = await client.wait(roundId, { timeoutMs: Math.min(callMs, left) });
    } catch {
      return { kind: 'failed' };
    }
    const status = field(result, 'status');
    if (status === 'open') continue;
    if (status === 'closed' || status === 'abandoned') return { kind: status };
    const answers = status === 'answered' ? toolAnswers(questions, field(result, 'answers')) : null;
    return answers ? { kind: 'answered', answers, attachments: field(result, 'attachments') } : { kind: 'failed' };
  }
}

/** Abandons the round on the page when it can; never throws. */
export async function abandonRound(client: Client, roundId: string): Promise<void> {
  await client.abandon(roundId).catch(() => {});
}

/**
 * Posts an answer given outside the page to a round left open: `true` once it is settled (recorded,
 * or answered on the page meanwhile, the first answer winning), `false` when the round is gone with
 * its session. Throws on any other failure.
 */
export async function answerRound(client: Client, roundId: string, answers: Answers): Promise<boolean> {
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
 * Opens a round already answered outside the page (PRD 1180): in this terminal's session, or in a
 * new one when the server no longer takes rounds in it. An older server, which opens it unanswered,
 * is then sent the answer. Throws when it could not be recorded.
 */
export async function openAnswered({ questions, answers, readContext, readLead, ...terminal }: Terminal & RoundExtras & {
  questions: unknown;
  answers: Answers;
}): Promise<void> {
  const context = contextOf(readContext) ?? undefined;
  const lead = contextOf(readLead);
  const send = async (): Promise<unknown> => {
    const sessionId = await terminalSession(terminal);
    return terminal.client.openAnswered(sessionId, questions, answers, context, lead);
  };
  let reply: unknown;
  try {
    reply = await send();
  } catch (error) {
    if (!sessionGone(error)) throw error;
    // Closed or gone on the server: a new session takes it.
    clearTerminal(terminal.root, terminal.terminalId);
    reply = await send();
  }
  const roundId = field(reply, 'roundId');
  if (typeof roundId !== 'string' || roundId === '') throw new Error('the server answered with no round');
  if (field(reply, 'status') !== 'answered') await terminal.client.answer(roundId, answers);
}

/** Closes this terminal's session on the page when it can, then forgets it, whatever happens. */
export async function closeTerminal({ root, host, client, terminalId }: Pick<Terminal, 'root' | 'host' | 'client' | 'terminalId'>): Promise<void> {
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
