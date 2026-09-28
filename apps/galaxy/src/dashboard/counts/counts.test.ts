import { describe, expect, it } from 'vitest';
import type { ForMeRow } from '../../ask/page/question';
import type { TabRow } from '../../ask/page/tabs';
import type { AskRoundStatus } from '../../ask/store';
import { ASK, FOR_ME, waitingCount } from './counts';

// The counts' own rule (PRD 328): how many questions wait for you now, and where the tile sends you.
// Your open sessions count when their newest round is open (readTabs gives each its newest round); a
// question a teammate shared with you counts while it is open (readForMe). The tile links to
// /ask/for-me when at least one is waiting and every one of them is shared, and to /ask otherwise.

const session = (id: string) => ({
  id, owner: 'me', title: `Session ${id}`, status: 'open' as const, created_at: '2026-09-26T09:00:00Z', last_seen_at: '2026-09-26T09:55:00Z',
});
const tab = (id: string, newest: AskRoundStatus | null): TabRow => ({
  session: session(id),
  newest: newest === null ? null : { id: `${id}-r`, status: newest, created_at: '2026-09-26T09:50:00Z', header: 'Access' },
});
const shared = (id: string, status: AskRoundStatus = 'open'): ForMeRow => ({
  round: { id, questions: [], answers: null, answered_via: null, status, created_at: '2026-09-26T09:52:00Z', answered_at: null },
  session: session(`s-${id}`),
  sharedBy: 'a-teammate',
});

describe('waitingCount', () => {
  it('nothing waiting: 0, and the tile links to /ask', () => {
    expect(waitingCount([], [])).toEqual({ count: 0, href: ASK });
  });

  it('counts your sessions whose newest round is open', () => {
    expect(waitingCount([tab('a', 'open'), tab('b', 'open')], [])).toEqual({ count: 2, href: ASK });
  });

  it('leaves out a session whose newest round is answered, moved to the terminal, or not asked yet', () => {
    expect(waitingCount([tab('a', 'answered'), tab('b', 'abandoned'), tab('c', null), tab('d', 'open')], [])).toEqual({ count: 1, href: ASK });
  });

  it('only shared questions waiting: they count, and the tile links to /ask/for-me', () => {
    expect(waitingCount([], [shared('q1'), shared('q2')])).toEqual({ count: 2, href: FOR_ME });
  });

  it('shared questions beside sessions that wait for nobody: still /ask/for-me', () => {
    expect(waitingCount([tab('a', 'answered'), tab('b', null)], [shared('q1')])).toEqual({ count: 1, href: FOR_ME });
  });

  it('yours and shared ones together: both count, and the tile links to /ask', () => {
    expect(waitingCount([tab('a', 'open'), tab('b', 'answered')], [shared('q1'), shared('q2')])).toEqual({ count: 3, href: ASK });
  });

  it('a shared question no longer open waits for nobody', () => {
    expect(waitingCount([], [shared('q1', 'answered'), shared('q2', 'abandoned')])).toEqual({ count: 0, href: ASK });
  });
});
