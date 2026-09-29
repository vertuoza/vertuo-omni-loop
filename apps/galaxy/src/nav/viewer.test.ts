import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.spyOn(console, 'error').mockImplementation(() => {});

const { readViewer, SIGNED_OUT } = await import('./viewer');
type Source = Parameters<typeof readViewer>[0];

// Who is looking at an app page (PRD 438), read once per request for the sidebar and the top bar.
// Every part falls back on its own, and the read never throws: tested on a fake source, never on
// Supabase.

const ADA = {
  id: 'u-ada',
  email: 'ada@example.com',
  user_metadata: { full_name: 'Ada Lovelace', avatar_url: 'https://avatars.example/ada.png' },
  identities: [{ provider: 'github', identity_data: { user_name: 'ada' } }],
};

const WAITING = [{ kind: 'question' as const, id: 'r1', sessionTitle: 'feat/ada', question: 'Which storage?', askedAt: 1, sharedBy: null }];
const LIVE = { kind: 'database' as const, url: 'https://db.example', key: 'anon', me: 'u-ada' };

const HERO = { v: 1, body: 'girl', skin: 2, hair: 3, suit: 0, cape: 8 };

const fake = (over: Partial<Source> = {}): Source => ({
  user: async () => ADA,
  workspace: async () => ({ id: 'w-acme', name: 'Acme' }),
  player: async () => null,
  questions: async () => WAITING,
  live: () => LIVE,
  ...over,
});

const boom = async (): Promise<never> => {
  throw new Error('down');
};

describe('the viewer', () => {
  it('is the full viewer when every read answers', async () => {
    expect(await readViewer(fake())).toEqual({
      signedIn: true,
      name: 'Ada Lovelace',
      login: 'ada',
      avatarUrl: 'https://avatars.example/ada.png',
      workspaceName: 'Acme',
      heroSvg: null,
      waiting: { questions: WAITING, unread: false, source: LIVE },
    });
  });

  it('asks for the workspace, the questions and where to read them again, of the person signed in', async () => {
    const workspace = vi.fn(async () => ({ name: 'Acme' }));
    const questions = vi.fn(async () => WAITING);
    const live = vi.fn(() => LIVE);
    await readViewer(fake({ workspace, questions, live }));
    expect(workspace).toHaveBeenCalledWith('u-ada');
    expect(questions).toHaveBeenCalledWith('u-ada');
    expect(live).toHaveBeenCalledWith('u-ada');
  });

  it('is signed out with no session, and reads nothing else', async () => {
    const workspace = vi.fn(async () => ({ name: 'Acme' }));
    const questions = vi.fn(async () => WAITING);
    expect(await readViewer(fake({ user: async () => null, workspace, questions }))).toEqual(SIGNED_OUT);
    expect(SIGNED_OUT.waiting).toBeNull();
    expect(workspace).not.toHaveBeenCalled();
    expect(questions).not.toHaveBeenCalled();
  });

  it('is signed out when the session cannot be read', async () => {
    expect(await readViewer(fake({ user: boom }))).toEqual(SIGNED_OUT);
  });

  it('has no workspace name when the workspace read throws, or finds none', async () => {
    expect(await readViewer(fake({ workspace: boom }))).toMatchObject({ signedIn: true, workspaceName: null, waiting: { questions: WAITING } });
    expect(await readViewer(fake({ workspace: async () => null }))).toMatchObject({ signedIn: true, workspaceName: null });
  });

  it('holds no questions, marked unread, when their read throws, and still says where to read them again', async () => {
    expect(await readViewer(fake({ questions: boom }))).toMatchObject({ signedIn: true, workspaceName: 'Acme', waiting: { questions: [], unread: true, source: LIVE } });
  });

  it('never throws, even when every read does', async () => {
    await expect(readViewer({ user: boom, workspace: boom, player: boom, questions: boom, live: () => { throw new Error('down'); } })).resolves.toEqual(SIGNED_OUT);
    await expect(readViewer(fake({ workspace: boom, questions: boom, live: () => { throw new Error('down'); } })))
      .resolves.toMatchObject({ signedIn: true, workspaceName: null, waiting: { questions: [], unread: true, source: null } });
  });

  it('holds the viewer\'s hero, as a decorative pixel SVG, when their player row in the workspace has a valid one (PRD 652)', async () => {
    const player = vi.fn(async () => ({ hero: HERO, color: '#3355ff' }));
    const viewer = await readViewer(fake({ player }));
    expect(player).toHaveBeenCalledWith('u-ada', 'w-acme');
    expect(viewer.heroSvg).toMatch(/^<svg\b/);
    expect(viewer.heroSvg).not.toContain('<title>');
    expect(viewer.heroSvg).not.toContain('aria-label');
    expect(viewer.avatarUrl).toBe('https://avatars.example/ada.png');
    const other = await readViewer(fake({ player: async () => ({ hero: HERO, color: '#ff3355' }) }));
    expect(other.heroSvg).not.toBe(viewer.heroSvg);
  });

  it('holds no hero, and keeps the avatar, with no player row, an invalid hero, a failed player read or no workspace', async () => {
    const player = vi.fn(async () => ({ hero: HERO, color: null }));
    for (const over of [
      { player: async () => null },
      { player: async () => ({ hero: { v: 9 }, color: '#3355ff' }) },
      { player: boom },
    ] as Partial<Source>[]) {
      expect(await readViewer(fake(over))).toMatchObject({ signedIn: true, heroSvg: null, avatarUrl: 'https://avatars.example/ada.png', workspaceName: 'Acme' });
    }
    expect(await readViewer(fake({ workspace: async () => null, player }))).toMatchObject({ heroSvg: null });
    expect(player).not.toHaveBeenCalled();
  });

  it('falls back on the email\'s name, and on no login or avatar, when the account has none', async () => {
    const bare = { id: 'u-bob', email: 'bob@example.com', user_metadata: {}, identities: [] };
    expect(await readViewer(fake({ user: async () => bare }))).toMatchObject({ name: 'bob', login: null, avatarUrl: null });
  });
});
