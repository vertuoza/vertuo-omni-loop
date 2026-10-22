import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { MemberSession } from '../data/member-session';
import { waitingViewOf, type WaitingDeps } from './waiting-board.controller';
import type { WaitingBoardData } from './waiting-board.service';

// /app/waiting's controller (PRD 2377 s3): the session first (signed out, no read runs), then the
// workspace, then the board read as the person; a failed read is the unreadable notice.

const SIGNED_IN = { kind: 'signed-in', db: {}, user: { id: 'u-1' }, env: { url: 'u', key: 'k' } } as unknown as MemberSession;
const NOW = new Date('2026-10-19T12:00:00Z');
const DATA: WaitingBoardData = { board: { rows: [], stale: [], reviews: 0 }, filter: null, productsUnreadable: false };

function deps(over: Partial<WaitingDeps> = {}) {
  const reads: string[] = [];
  const d: WaitingDeps = {
    workspace: () => { reads.push('workspace'); return Promise.resolve({ id: 'ws-1' }); },
    load: (_s, workspace, query) => { reads.push(`load ${workspace} ${JSON.stringify(query)}`); return Promise.resolve(DATA); },
    ...over,
  };
  return { reads, d };
}

describe('the Waiting board\'s controller', () => {
  it('reads nothing for a signed-out person or a deployment with no database', async () => {
    for (const kind of ['sign-in', 'closed'] as const) {
      const { reads, d } = deps();
      expect(await waitingViewOf({ kind }, {}, NOW, d)).toEqual({ kind });
      expect(reads).toEqual([]);
    }
  });

  it('draws the demo\'s example rows in the demo, with no read', async () => {
    const { reads, d } = deps();
    const view = await waitingViewOf({ kind: 'demo' }, {}, NOW, d);
    expect(view.kind).toBe('board');
    if (view.kind !== 'board') return;
    expect(view.board.rows.length).toBeGreaterThan(3);
    expect(reads).toEqual([]);
  });

  it('reads the person\'s workspace, then its board with the query', async () => {
    const { reads, d } = deps();
    expect(await waitingViewOf(SIGNED_IN, { product: 'none' }, NOW, d)).toEqual({ kind: 'board', ...DATA });
    expect(reads).toEqual(['workspace', 'load ws-1 {"product":"none"}']);
  });

  it('draws the demo\'s tab the query asks for', async () => {
    const { d } = deps();
    const rows = async (tab: string) => {
      const view = await waitingViewOf({ kind: 'demo' }, { tab }, NOW, d);
      return view.kind === 'board' ? view.board.rows.length : -1;
    };
    expect([await rows('workspace'), await rows('mine'), await rows('reviews')]).toEqual([6, 2, 2]);
  });

  it('says so for an account in no workspace', async () => {
    const { reads, d } = deps({ workspace: () => Promise.resolve(null) });
    expect(await waitingViewOf(SIGNED_IN, {}, NOW, d)).toEqual({ kind: 'no-workspace' });
    expect(reads).toEqual([]);
  });

  it('draws the unreadable notice when a read fails, and logs it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { d } = deps({ load: () => Promise.reject(new Error('refused')) });
    expect(await waitingViewOf(SIGNED_IN, {}, NOW, d)).toEqual({ kind: 'unreadable' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('refused'));
    log.mockRestore();
  });
});
