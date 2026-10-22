// What the Omni page keeps of the escalation record (PRD 1794, s5): the `<!-- omni:escalation -->`
// comment the Omni GitHub App keeps on a feature PR, read through the kit's own reader
// (kit/lib/escalation/comments.ts, s2), never redefined here. Each waiting item the record names keeps
// who is asked about it (`asked`, GitHub logins in lower case), and each held law becomes a waiting
// item of its own, ranked human-action, so the waiting list of every person asked shows it. Pure: it
// reads no comment and writes no row.
import { readRecord, type RecordLine } from 'omni-loop/kit/lib/escalation/comments.ts';
import type { WaitingQuestion } from './store';

/** The question a held law asks of whoever is asked about it. */
export const lawQuestion = (law: string): string => `Approve the change to ${law} on GitHub, or ask for changes.`;

/** The escalation record among a pull request's comments; null when none carries it. */
export function recordIn(comments: readonly { body?: string | null | undefined }[]): RecordLine[] | null {
  for (const comment of comments) {
    const record = readRecord(comment.body ?? '');
    if (record !== null) return record;
  }
  return null;
}

/** Logins as stored: lower case, without `@`, each once. */
const loginsOf = (asked: readonly string[]): string[] => [...new Set(asked.map((login) => login.replace(/^@/, '').toLowerCase()))];

/** `question` with whom it asks; no field at all when it asks nobody, so a row with no record is as before. */
const asking = (question: WaitingQuestion, asked: readonly string[]): WaitingQuestion => {
  const logins = loginsOf(asked);
  return logins.length > 0 ? { ...question, asked: logins } : question;
};

/**
 * The waiting items with whom the record asks about each, then each held law of the record as a
 * human-action item. A record line whose item is no longer open is left out: the outbox says what is
 * open, the record only who is asked.
 */
export function withEscalation(waiting: readonly WaitingQuestion[], record: readonly RecordLine[] | null): WaitingQuestion[] {
  if (record === null) return [...waiting];
  const items = new Map(record.filter((one) => one.kind === 'item').map((one) => [one.thing, one.asked]));
  const laws = record.filter((one) => one.kind === 'law')
    .map((one) => asking({ id: one.thing, rank: 'human-action', question: lawQuestion(one.thing) }, one.asked));
  return [...waiting.map((question) => asking(question, items.get(question.id) ?? [])), ...laws];
}
