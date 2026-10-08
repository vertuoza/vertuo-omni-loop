import { beforeEach, describe, expect, it, vi } from 'vitest';

// The galaxy's one auth callback, for a voter (PRD 1246, s3): `next=ideas` lands back on the board the
// ▲ was pressed on, with the vote counted, and never goes on to /signup or joins anything, even for a
// voter in no workspace. Supabase is stubbed; the arcade's own steps fail loudly if they run.

const IDEA = '00000000-0000-4000-8000-000000000001';

const db = vi.hoisted(() => ({
  exchange: vi.fn(() => Promise.resolve({ data: { session: null }, error: null as null | { message: string } })),
  insert: vi.fn((_row: { idea_id: string }) => Promise.resolve({ error: null as null | { code?: string; message: string } })),
  env: vi.fn(() => ({ url: 'http://127.0.0.1:54321', key: 'anon' }) as null | { url: string; key: string }),
}));
const arcade = vi.hoisted(() => ({
  afterSignIn: vi.fn(() => Promise.resolve(['signin', 'ok'])),
  landing: vi.fn(() => Promise.resolve('/signup')),
}));

vi.mock('server-only', () => ({}));
vi.mock('../../data/supabase-server', () => ({
  supabaseEnv: db.env,
  supabaseServer: async () => ({
    auth: { exchangeCodeForSession: db.exchange },
    from: (table: string) => {
      if (table !== 'idea_votes') throw new Error(`no table ${table} in this test`);
      return { insert: db.insert };
    },
  }),
  supabaseAs: () => { throw new Error('not in this test'); },
}));
vi.mock('../../data/sign-in', async (actual) => ({
  ...(await actual<typeof import('../../data/sign-in')>()),
  afterSignIn: arcade.afterSignIn,
}));
vi.mock('../../data/sign-in-live', () => ({ signInDeps: {} }));
vi.mock('../../data/workspace', () => ({ landingAfterSignIn: arcade.landing }));
vi.mock('../../ask/cli-code-live', () => ({ cliCallbackDeps: () => { throw new Error('not in this test'); } }));

const { GET } = await import('../../../app/auth/callback/route.ts');
const { NextRequest } = await import('next/server');

const callback = async (query: string) => {
  const res = await GET(new NextRequest(`https://galaxy.example/auth/callback${query}`));
  return new URL(res.headers.get('location') ?? '');
};

beforeEach(() => {
  db.exchange.mockClear();
  db.insert.mockClear();
  arcade.afterSignIn.mockClear();
  arcade.landing.mockClear();
});

describe('a voter back from GitHub', () => {
  it('lands back on the board with the vote counted, never on /signup, in no workspace', async () => {
    const back = await callback(`?next=ideas&board=acme%2Fwidgets&vote=${IDEA}&code=c`);
    expect(back.href).toBe('https://galaxy.example/ideas/acme/widgets');
    expect(db.exchange).toHaveBeenCalledWith('c');
    expect(db.insert).toHaveBeenCalledWith({ idea_id: IDEA });
    expect(arcade.landing).not.toHaveBeenCalled();
    expect(arcade.afterSignIn).not.toHaveBeenCalled();
  });

  it('counts a vote already counted as counted', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key value' } });
    expect((await callback(`?next=ideas&board=acme%2Fwidgets&vote=${IDEA}&code=c`)).pathname).toBe('/ideas/acme/widgets');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('refuses a return path off the allowlist: back to /play, nothing exchanged', async () => {
    const back = await callback(`?next=ideas&board=%2F%2Fevil.example&vote=${IDEA}&code=c`);
    expect(back.href).toBe('https://galaxy.example/play');
    expect(db.exchange).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('lands on the board on a deployment with no Supabase', async () => {
    db.env.mockReturnValueOnce(null);
    expect((await callback(`?next=ideas&board=acme%2Fwidgets&vote=${IDEA}&code=c`)).pathname).toBe('/ideas/acme/widgets');
    expect(db.exchange).not.toHaveBeenCalled();
  });
});
