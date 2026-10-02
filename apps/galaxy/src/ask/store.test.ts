import { describe, it, expect } from 'vitest';
import { askAttachments, askStore, AskStoreError, ATTACHMENTS_BUCKET, IDLE_CLOSE_MS, sessionClosed, SIGNED_LINK_SECONDS } from './store';

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

describe('addRound (PRD 752)', () => {
  /** A client that records the one insert it is sent, and answers with an id. */
  function recording() {
    const sent: Array<Record<string, unknown>> = [];
    const query = {
      insert(values: Record<string, unknown>) { sent.push(values); return query; },
      select() { return query; },
      single: () => Promise.resolve({ data: { id: 'r1' }, error: null }),
    };
    return { sent, db: { from: () => query } as unknown as Parameters<typeof askStore>[0] };
  }
  const facts = { prd: null, skill: null, model: null, tokens: null, cost_usd: null };

  it('sends the lead with the round', async () => {
    const { sent, db } = recording();
    await askStore(db).addRound('s1', [{ question: 'Q?' }], { ...facts, lead: '## The design' });
    expect(sent).toEqual([{ session_id: 's1', questions: [{ question: 'Q?' }], lead: '## The design' }]);
  });

  it('sends no lead field for a round without one, so an older database takes it too', async () => {
    const { sent, db } = recording();
    await askStore(db).addRound('s1', [{ question: 'Q?' }], { ...facts, lead: null });
    await askStore(db).addRound('s1', [{ question: 'Q?' }]);
    expect(sent).toEqual([{ session_id: 's1', questions: [{ question: 'Q?' }] }, { session_id: 's1', questions: [{ question: 'Q?' }] }]);
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
      maybeSingle: () => Promise.resolve({ data: { id: 'r1', ...sent[0] }, error: null }),
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
          createSignedUrls: (paths: string[], expiresIn: number) => { asked.push({ bucket, paths, expiresIn }); return Promise.resolve(reply); },
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

describe('askAttachments.removeRounds (PRD 620)', () => {
  type Listed = { data: Array<{ name: string }> | null; error: { message: string } | null };
  /** A bucket holding `objects`, listing a folder and removing paths as Storage does, every call recorded. */
  function bucket(objects: string[], fail: { list?: boolean; remove?: boolean } = {}) {
    const calls: Array<{ bucket: string; op: 'list' | 'remove'; arg: string | string[] }> = [];
    const db = {
      storage: {
        from: (name: string) => ({
          async list(folder: string): Promise<Listed> {
            calls.push({ bucket: name, op: 'list', arg: folder });
            if (fail.list) return { data: null, error: { message: 'list is down' } };
            return { data: objects.filter((o) => o.startsWith(`${folder}/`)).map((o) => ({ name: o.slice(folder.length + 1) })), error: null };
          },
          async remove(paths: string[]) {
            calls.push({ bucket: name, op: 'remove', arg: paths });
            if (fail.remove) return { data: null, error: { message: 'remove is down' } };
            objects = objects.filter((o) => !paths.includes(o));
            return { data: paths.map((p) => ({ name: p })), error: null };
          },
        }),
      },
    } as unknown as Parameters<typeof askAttachments>[0];
    return { calls, db, left: () => objects };
  }

  it('lists each round\'s folder in the bucket and removes every object in it, in one call', async () => {
    const b = bucket(['r1/1.png', 'r1/2.webp', 'r2/1.gif', 'r3/1.png']);
    await askAttachments(b.db).removeRounds(['r1', 'r2']);
    expect(b.left()).toEqual(['r3/1.png']);
    expect(b.calls.filter((c) => c.op === 'list').map((c) => [c.bucket, c.arg])).toEqual([[ATTACHMENTS_BUCKET, 'r1'], [ATTACHMENTS_BUCKET, 'r2']]);
    expect(b.calls.filter((c) => c.op === 'remove')).toEqual([{ bucket: ATTACHMENTS_BUCKET, op: 'remove', arg: ['r1/1.png', 'r1/2.webp', 'r2/1.gif'] }]);
  });

  it('removes nothing, and calls no remove, when the folders are empty or there are no rounds', async () => {
    const b = bucket(['r9/1.png']);
    await askAttachments(b.db).removeRounds(['r1']);
    await askAttachments(b.db).removeRounds([]);
    expect(b.calls.map((c) => c.op)).toEqual(['list']);
    expect(b.left()).toEqual(['r9/1.png']);
  });

  it('throws, so the rows stay, when a folder cannot be listed or its objects cannot be removed', async () => {
    const listing = bucket(['r1/1.png'], { list: true });
    await expect(askAttachments(listing.db).removeRounds(['r1'])).rejects.toBeInstanceOf(AskStoreError);
    const removing = bucket(['r1/1.png'], { remove: true });
    await expect(askAttachments(removing.db).removeRounds(['r1'])).rejects.toThrow(/remove is down/);
    expect(removing.left()).toEqual(['r1/1.png']);
  });
});

describe('askStore.roundIds (PRD 620)', () => {
  it('reads the ids of a session\'s rounds', async () => {
    const asked: unknown[][] = [];
    const query = {
      select(columns: string) { asked.push(['select', columns]); return query; },
      eq(column: string, value: string) { asked.push(['eq', column, value]); return query; },
      then: (done: (r: unknown) => unknown) => Promise.resolve({ data: [{ id: 'r1' }, { id: 'r2' }], error: null }).then(done),
    };
    const db = { from: (table: string) => { asked.push(['from', table]); return query; } } as unknown as Parameters<typeof askStore>[0];
    expect(await askStore(db).roundIds('s1')).toEqual(['r1', 'r2']);
    expect(asked).toEqual([['from', 'ask_rounds'], ['select', 'id'], ['eq', 'session_id', 's1']]);
  });
});
