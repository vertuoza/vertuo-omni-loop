import 'server-only';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { arcadeMode } from '../../data/mode';
import { DEMO_MEMBERS } from './demo';
import { forMeList, type ForMeEntry } from './question';
import { readAsSignedIn, sessionsMembers, type NotRead } from './signed-in-live';
import { readForMe } from './source';

// For me, read on the server as the signed-in person (PRD 144): the open rounds shared with them. Null
// when there is nobody signed in, or no database; the demo shows one question shared by a teammate.

export type ForMeRead = { kind: 'entries'; entries: ForMeEntry[] } | NotRead;

export async function readForMeLive(now: number): Promise<ForMeRead> {
  const mode = arcadeMode(process.env);
  if (mode === 'demo') {
    const teammate = at(DEMO_MEMBERS, 1, 'the demo teammate');
    return {
      kind: 'entries',
      entries: [{ roundId: 'demo', question: 'How should the page and the agent be authenticated?', sessionTitle: 'vertuo-omni-loop · feat/ask-mode', sharedBy: teammate.name ?? teammate.email, minutesLeft: 7 }],
    };
  }
  return readAsSignedIn(mode, async (db, me): Promise<ForMeRead> => {
    const rows = await readForMe(db, me);
    return { kind: 'entries', entries: forMeList(rows, await sessionsMembers(db, rows), now) };
  });
}

/** How many questions wait under For me, for the header; null when it cannot say (signed out, no
 * database, the database failing): the header then shows no count. */
export async function forMeCount(now: number): Promise<number | null> {
  try {
    const read = await readForMeLive(now);
    return read.kind === 'entries' ? read.entries.length : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
