// The waiting list's reads, as rules over the repositories (PRD 1318, s4; ADR-0095): the Questions part
// (PRD 499) and the New documents part (PRD 579), read on the server as the signed-in person, for the
// server's first paint (src/data/viewer.ts) and for GET /api/waiting/questions and
// GET /api/waiting/documents, which the bell polls (src/waiting/waiting.controller.ts). A failed read
// throws, so the controller answers 500 rather than an empty bell.
//
// The Questions part is the ask pages' own reads (src/ask/ask.service.ts for the tab list; the rounds
// shared with the person, and a workspace's members and people for who shared one), plus the first
// question of each waiting round. A reader keeps what it read before: a round's questions never change,
// so each waiting round's first question is fetched once; a workspace's members and its people
// directory, which give the face of the person who shared a round (PRD 652; a failed read falls back
// to initials), once per reader. On the server a reader lives for one request.
import { readQuestions } from '../ask/answer-model';
import { askReads } from '../ask/ask.service';
import { readForMe, readMembers } from '../ask/page/source';
import type { ForMeRow, Member } from '../ask/page/question';
import type { TabRow } from '../ask/page/tabs';
import { loadPeople, type People } from '../people/load';
import { DOCUMENT_KINDS, DOCS_DAYS, type DocumentRow } from './documents';
import { mergeQuestions, ownQuestions, sharedQuestions, type WaitingQuestion } from './waiting';
import { waitingRepository, type DocumentReadRow, type WaitingDb, type WaitingRepository } from './waiting.repository';
import { isOneOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

const WINDOW = DOCS_DAYS * 24 * 60 * 60_000;

/** The ask pages' reads the Questions part is made of. */
type WaitingAskReads = {
  /** The person's tab list; `headers` holds each newest round's header once read. */
  tabs(owner: string, now: number, headers: Map<string, string | null>): Promise<TabRow[]>;
  /** Every open round shared with `me`. */
  forMe(me: string): Promise<ForMeRow[]>;
  /** A workspace's members, each with their face; none when they cannot be read. */
  members(workspace: string): Promise<Member[]>;
  /** A workspace's people directory. */
  people(workspace: string): Promise<People>;
};

/** A version kept for the New documents part: a known kind, of a numbered dossier. */
function documentOf(r: DocumentReadRow): DocumentRow[] {
  return r.dossier && typeof r.dossier.prd === 'number' && isOneOf(DOCUMENT_KINDS, r.kind)
    ? [{ id: r.id, kind: r.kind, created_at: r.created_at, dossier: { id: r.dossier.id, prd: r.dossier.prd, title: r.dossier.title } }]
    : [];
}

function waitingService(ask: WaitingAskReads, store: Pick<WaitingRepository, 'roundQuestions' | 'documents'>) {
  return {
    /** A reader of the Questions part for `me`, keeping what it read before. */
    questionsReader(me: string): (now: number) => Promise<WaitingQuestion[]> {
      const headers = new Map<string, string | null>();
      const texts = new Map<string, string>();
      const members = new Map<string, Member[]>();
      const people = new Map<string, People>();
      return async (now) => {
        const [rows, shared] = await Promise.all([ask.tabs(me, now, headers), ask.forMe(me)]);
        const waiting = rows.flatMap((r) => (r.newest?.status === 'open' && !texts.has(r.newest.id) ? [r.newest.id] : []));
        if (waiting.length) {
          for (const round of await store.roundQuestions(waiting)) {
            const first = readQuestions(round.questions)[0]?.question;
            if (first) texts.set(round.id, first);
          }
        }
        const places = [...new Set(shared.map((r) => r.session.workspace_id).filter((w): w is string => Boolean(w)))];
        await Promise.all(places.filter((w) => !members.has(w)).map(async (w) => {
          const [m, p] = await Promise.all([ask.members(w), ask.people(w)]);
          members.set(w, m);
          people.set(w, p);
        }));
        const known = places.flatMap((w) => members.get(w) ?? []);
        return mergeQuestions(ownQuestions(rows, texts, now), sharedQuestions(shared, known, now, people));
      };
    },

    /** The versions pushed in the last 7 days to the numbered dossiers `me` opened, the 50 newest, of
     * the kinds the part shows. */
    async documents(me: string, now: number): Promise<DocumentRow[]> {
      return (await store.documents(me, new Date(now - WINDOW).toISOString())).flatMap(documentOf);
    },
  };
}

export type WaitingReads = ReturnType<typeof waitingService>;

/** The waiting reads on `db`, the client the controller (or the server's first paint) was handed. */
export function waitingReads(db: WaitingDb): WaitingReads {
  const ask = askReads(db);
  return waitingService({
    tabs: (owner, now, headers) => ask.tabs(owner, now, headers),
    forMe: (me) => readForMe(db, me),
    members: (workspace) => readMembers(db, workspace),
    people: (workspace) => loadPeople(db, workspace),
  }, waitingRepository(db));
}

/** The Questions part, read once (the server's first paint). */
export const readWaitingQuestions = (db: WaitingDb, me: string, now: number): Promise<WaitingQuestion[]> =>
  waitingReads(db).questionsReader(me)(now);
