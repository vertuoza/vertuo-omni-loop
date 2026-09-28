import { describe, expect, it } from 'vitest';
import type { ForMeRow } from '../../ask/page/question';
import type { TabRow } from '../../ask/page/tabs';
import type { AskRoundStatus } from '../../ask/store';
import { ASK, FOR_ME, waitingCount } from './counts';

// The counts' own rule (PRD 328): how many questions wait for you now, and where the tile sends you.
// Your open sessions count when their newest round is open (readTabs gives each its newest round); a
// question a teammate shared with you counts while it is open (readForMe); each only while the page
// can still answer it, as /ask and /ask/for-me show it. The tile links to /ask/for-me when at least one
// is waiting and every one of them is shared, and to /ask otherwise.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const session = (id: string, over: { status?: 'open' | 'closed'; last_seen_at?: string } = {}) => ({
  id, owner: 'me', title: `Session ${id}`, status: 'open' as const, created_at: ago(60), last_seen_at: ago(1), ...over,
});
/** One of your sessions, with its newest round asked `minutes` ago. */
const tab = (id: string, newest: AskRoundStatus | null, minutes = 2, over?: Parameters<typeof session>[1]): TabRow => ({
  session: session(id, over),
  newest: newest === null ? null : { id: `${id}-r`, status: newest, created_at: ago(minutes), header: 'Access' },
});
/** A round a teammate shared with you, asked `minutes` ago. */
const shared = (id: string, status: AskRoundStatus = 'open', minutes = 2, over?: Parameters<typeof session>[1]): ForMeRow => ({
  round: { id, questions: [], answers: null, answered_via: null, status, created_at: ago(minutes), answered_at: null },
  session: session(`s-${id}`, over),
  sharedBy: 'a-teammate',
});

describe('waitingCount', () => {
  it('nothing waiting: 0, and the tile links to /ask', () => {
    expect(waitingCount([], [], NOW)).toEqual({ count: 0, href: ASK });
  });

  it('counts your sessions whose newest round is open', () => {
    expect(waitingCount([tab('a', 'open'), tab('b', 'open')], [], NOW)).toEqual({ count: 2, href: ASK });
  });

  it('leaves out a session whose newest round is answered, moved to the terminal, or not asked yet', () => {
    expect(waitingCount([tab('a', 'answered'), tab('b', 'abandoned'), tab('c', null), tab('d', 'open')], [], NOW)).toEqual({ count: 1, href: ASK });
  });

  it('only shared questions waiting: they count, and the tile links to /ask/for-me', () => {
    expect(waitingCount([], [shared('q1'), shared('q2')], NOW)).toEqual({ count: 2, href: FOR_ME });
  });

  it('shared questions beside sessions that wait for nobody: still /ask/for-me', () => {
    expect(waitingCount([tab('a', 'answered'), tab('b', null)], [shared('q1')], NOW)).toEqual({ count: 1, href: FOR_ME });
  });

  it('yours and shared ones together: both count, and the tile links to /ask', () => {
    expect(waitingCount([tab('a', 'open'), tab('b', 'answered')], [shared('q1'), shared('q2')], NOW)).toEqual({ count: 3, href: ASK });
  });

  it('a shared question no longer open waits for nobody', () => {
    expect(waitingCount([], [shared('q1', 'answered'), shared('q2', 'abandoned')], NOW)).toEqual({ count: 0, href: ASK });
  });

  it('a question still open once the terminal has taken it over (nine minutes on) waits for nobody, as the pages show it', () => {
    expect(waitingCount([tab('a', 'open', 8), tab('b', 'open', 10)], [shared('q1', 'open', 8), shared('q2', 'open', 10)], NOW))
      .toEqual({ count: 2, href: ASK });
    expect(waitingCount([tab('b', 'open', 10)], [shared('q2', 'open', 10)], NOW)).toEqual({ count: 0, href: ASK });
  });

  it('a question in a closed session waits for nobody', () => {
    const closed = { status: 'closed' as const };
    const idle = { last_seen_at: ago(13 * 60) };
    expect(waitingCount([tab('a', 'open', 2, closed), tab('b', 'open', 2, idle)], [shared('q1', 'open', 2, closed), shared('q2', 'open', 2, idle)], NOW))
      .toEqual({ count: 0, href: ASK });
  });
});
