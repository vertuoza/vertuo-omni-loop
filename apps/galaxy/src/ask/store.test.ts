import { describe, it, expect } from 'vitest';
import { askAttachments, askStore, ATTACHMENTS_BUCKET, IDLE_CLOSE_MS, sessionClosed, SIGNED_LINK_SECONDS } from './store';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const seen = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('sessionClosed', () => {
  it('reads a closed session as closed', () => {
    expect(sessionClosed({ status: 'closed', last_seen_at: seen(0) }, NOW)).toBe(true);
  });

  it('reads an open session as open until 12 hours pass without a call', () => {
    expect(IDLE_CLOSE_MS).toBe(12 * 60 * 60 * 1000);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(0) }, NOW)).toBe(false);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(IDLE_CLOSE_MS - 1) }, NOW)).toBe(false);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(IDLE_CLOSE_MS) }, NOW)).toBe(true);
    expect(sessionClosed({ status: 'open', last_seen_at: seen(3 * IDLE_CLOSE_MS) }, NOW)).toBe(true);
  });
});

describe('moveRound (PRD 620)', () => {
  /** A client that records the one update it is sent, and answers with the row. */
  function recording() {
    const sent: Array<Record<string, unknown>> = [];
    const query = {
      update(values: Record<string, unknown>) { sent.push(values); return query; },
      eq() { return query; },
      in() { return query; },
      select() { return query; },
      maybeSingle: async () => ({ data: { id: 'r1', ...sent[0] }, error: null }),
    };
    return { sent, db: { from: () => query } as unknown as Parameters<typeof askStore>[0] };
  }

  it('sends the screenshots with the answer, in the same update', async () => {
    const { sent, db } = recording();
    const attachments = { 'Which screen?': ['r1/1.png', 'r1/2.webp'] };
    await askStore(db).moveRound('r1', ['open'], { status: 'answered', answers: { 'Which screen?': 'This one' }, answered_via: 'page', attachments });
    expect(sent).toEqual([{ status: 'answered', answers: { 'Which screen?': 'This one' }, answered_via: 'page', attachments }]);
  });

  it('sends no attachments field for an answer without screenshots', async () => {
    const { sent, db } = recording();
    await askStore(db).moveRound('r1', ['open'], { status: 'answered', answers: { Q: 'A' }, answered_via: 'page' });
    expect(sent).toEqual([{ status: 'answered', answers: { Q: 'A' }, answered_via: 'page' }]);
  });
});

describe('askAttachments (PRD 620)', () => {
  type Reply = { data: Array<{ path: string | null; signedUrl: string; error: string | null }> | null; error: { message: string } | null };
  function storage(reply: Reply) {
    const asked: Array<{ bucket: string; paths: string[]; expiresIn: number }> = [];
    const db = {
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: async (paths: string[], expiresIn: number) => { asked.push({ bucket, paths, expiresIn }); return reply; },
        }),
      },
    } as unknown as Parameters<typeof askAttachments>[0];
    return { asked, db };
  }

  it('signs every path in one call, for 10 minutes, in the bucket', async () => {
    const { asked, db } = storage({ data: [
      { path: 'r1/1.png', signedUrl: 'https://s/1', error: null },
      { path: 'r1/2.png', signedUrl: 'https://s/2', error: null },
    ], error: null });
    expect(await askAttachments(db).links(['r1/1.png', 'r1/2.png'])).toEqual(['https://s/1', 'https://s/2']);
    expect(asked).toEqual([{ bucket: ATTACHMENTS_BUCKET, paths: ['r1/1.png', 'r1/2.png'], expiresIn: SIGNED_LINK_SECONDS }]);
    expect(SIGNED_LINK_SECONDS).toBe(600);
  });

  it('reads a link that could not be made as null, and a failed or throwing call as all null', async () => {
    const one = storage({ data: [
      { path: 'r1/1.png', signedUrl: 'https://s/1', error: null },
      { path: 'r1/2.png', signedUrl: '', error: 'Object not found' },
    ], error: null });
    expect(await askAttachments(one.db).links(['r1/1.png', 'r1/2.png'])).toEqual(['https://s/1', null]);
    const all = storage({ data: null, error: { message: 'down' } });
    expect(await askAttachments(all.db).links(['r1/1.png'])).toEqual([null]);
    expect(await askAttachments(all.db).links([])).toEqual([]);
    const none = { storage: { from: () => { throw new Error('no storage'); } } } as unknown as Parameters<typeof askAttachments>[0];
    expect(await askAttachments(none).links(['r1/1.png', 'r1/2.png'])).toEqual([null, null]);
  });
});
