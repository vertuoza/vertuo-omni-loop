import { describe, expect, it, vi } from 'vitest';

// The push route files (app/api/push/*), called as Next calls them, with the session stubbed (PRD 1322
// s9): signed out, or with no database, each answers 401 and reaches no table.

const given = vi.hoisted(() => ({ database: true }));
const getUser = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: { user: null } })));
const from = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({
  supabaseEnv: () => (given.database ? { url: 'http://127.0.0.1:54321', key: 'anon' } : null),
  supabaseServer: () => Promise.resolve({ auth: { getUser }, from }),
}));

const channels = await import('../../app/api/push/channels/route');
const subscription = await import('../../app/api/push/subscription/route');

const send = (method: string, path: string, body: unknown) =>
  new Request(`https://galaxy.test${path}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const DEVICE = { endpoint: 'https://push.example/x', keys: { p256dh: 'p', auth: 'a' }, label: 'Mac · Chrome' };

describe('the push routes, signed out', () => {
  it.each([true, false])('answer 401 and touch no table (database: %s)', async (database) => {
    given.database = database;
    const answers = await Promise.all([
      channels.POST(send('POST', '/api/push/channels', { push: true, email: true })),
      subscription.POST(send('POST', '/api/push/subscription', DEVICE)),
      subscription.DELETE(send('DELETE', '/api/push/subscription', { endpoint: DEVICE.endpoint })),
    ]);
    expect(answers.map((res) => res.status)).toEqual([401, 401, 401]);
    expect(from).not.toHaveBeenCalled();
  });
});
