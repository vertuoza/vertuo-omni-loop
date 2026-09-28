import { readQuestions } from '../ask/answer-model';
import type { Member } from '../ask/page/question';
import { readForMe, readMembers, tabsReader, type Db, type SortDb } from '../ask/page/source';
import { mergeQuestions, ownQuestions, sharedQuestions, type WaitingQuestion } from './waiting';

// Where the waiting list's Questions part is read (PRD 499): the ask pages' own readers, as the
// signed-in person (row-level security decides), on the server for the first paint and in the browser
// every 5 s after. A round's questions never change, so each waiting round's first question is fetched
// once; a workspace's members, who name the person who shared a round, once per reader.

/** A reader of the Questions part for `me`, keeping what it read before. Throws when a read fails. */
export function questionsReader(db: Db & SortDb, me: string): (now: number) => Promise<WaitingQuestion[]> {
  const tabs = tabsReader(db, me);
  const texts = new Map<string, string>();
  const members = new Map<string, Member[]>();
  return async (now) => {
    const [rows, shared] = await Promise.all([tabs(now), readForMe(db, me)]);
    const waiting = rows.flatMap((r) => (r.newest?.status === 'open' && !texts.has(r.newest.id) ? [r.newest.id] : []));
    if (waiting.length) {
      const { data, error } = await db.from('ask_rounds').select('id, questions').in('id', waiting);
      if (error) throw new Error(`read the questions: ${error.message}`);
      for (const round of (data ?? []) as { id: string; questions: unknown }[]) {
        const first = readQuestions(round.questions)[0]?.question;
        if (first) texts.set(round.id, first);
      }
    }
    const places = [...new Set(shared.map((r) => r.session.workspace_id).filter((w): w is string => Boolean(w)))];
    await Promise.all(places.filter((w) => !members.has(w)).map(async (w) => members.set(w, await readMembers(db, w))));
    const known = places.flatMap((w) => members.get(w) ?? []);
    return mergeQuestions(ownQuestions(rows, texts, now), sharedQuestions(shared, known, now));
  };
}

/** The Questions part, read once (the server's first paint). */
export const readWaitingQuestions = (db: Db & SortDb, me: string, now: number) => questionsReader(db, me)(now);
