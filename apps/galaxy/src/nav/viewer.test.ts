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

const fake = (over: Partial<Source> = {}): Source => ({
  user: async () => ADA,
  workspace: async () => ({ name: 'Acme' }),
  forMe: async () => 3,
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
      forMe: 3,
    });
  });

  it('asks for the workspace of the person signed in', async () => {
    const workspace = vi.fn(async () => ({ name: 'Acme' }));
    await readViewer(fake({ workspace }));
    expect(workspace).toHaveBeenCalledWith('u-ada');
  });

  it('is signed out with no session, and reads nothing else', async () => {
    const workspace = vi.fn(async () => ({ name: 'Acme' }));
    const forMe = vi.fn(async () => 3);
    expect(await readViewer(fake({ user: async () => null, workspace, forMe }))).toEqual(SIGNED_OUT);
    expect(workspace).not.toHaveBeenCalled();
    expect(forMe).not.toHaveBeenCalled();
  });

  it('is signed out when the session cannot be read', async () => {
    expect(await readViewer(fake({ user: boom }))).toEqual(SIGNED_OUT);
  });

  it('has no workspace name when the workspace read throws, or finds none', async () => {
    expect(await readViewer(fake({ workspace: boom }))).toMatchObject({ signedIn: true, workspaceName: null, forMe: 3 });
    expect(await readViewer(fake({ workspace: async () => null }))).toMatchObject({ signedIn: true, workspaceName: null });
  });

  it('has forMe: null when the For me count throws', async () => {
    expect(await readViewer(fake({ forMe: boom }))).toMatchObject({ signedIn: true, workspaceName: 'Acme', forMe: null });
  });

  it('never throws, even when every read does', async () => {
    await expect(readViewer({ user: boom, workspace: boom, forMe: boom })).resolves.toEqual(SIGNED_OUT);
    await expect(readViewer(fake({ workspace: boom, forMe: boom }))).resolves.toMatchObject({ signedIn: true, workspaceName: null, forMe: null });
  });

  it('falls back on the email\'s name, and on no login or avatar, when the account has none', async () => {
    const bare = { id: 'u-bob', email: 'bob@example.com', user_metadata: {}, identities: [] };
    expect(await readViewer(fake({ user: async () => bare }))).toMatchObject({ name: 'bob', login: null, avatarUrl: null });
  });
});
