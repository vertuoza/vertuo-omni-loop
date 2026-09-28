import { afterEach, describe, expect, it, vi } from 'vitest';
import { finishSetup, readSetup, setupReturn, type Setup } from './installed';
import { signupWorld } from './signup.fake';
import type { Installation } from './installation';

// People: OWEN administers the acme org on GitHub; SOLO has no org; MIA belongs to acme but does not
// administer it; ZED belongs to nothing Omni Loop knows.
const OWEN = 'user-owen';
const SOLO = 'user-solo';
const MIA = 'user-mia';
const ZED = 'user-zed';
const ACCOUNTS = {
  [OWEN]: { login: 'owen-gh', orgs: ['Acme'] },
  [SOLO]: { login: 'Solo-Dev', orgs: [] },
  [MIA]: { login: 'mia-gh', orgs: ['acme', 'Globex'] },
  [ZED]: { login: 'zed-gh', orgs: ['elsewhere'] },
};
const ACME_INSTALL: Installation = { id: 5001, account: { login: 'Acme', type: 'Organization' } };
const SOLO_INSTALL: Installation = { id: 5002, account: { login: 'Solo-Dev', type: 'User' } };
const OTHER_USER_INSTALL: Installation = { id: 5003, account: { login: 'owen-gh', type: 'User' } };
const VERTUOZA_INSTALL: Installation = { id: 5004, account: { login: 'vertuoza', type: 'Organization' } };

const install = (installationId: number): Setup => ({ action: 'install', installationId });

function world(extra: Partial<Parameters<typeof signupWorld>[0]> = {}) {
  return signupWorld({ accounts: ACCOUNTS, installations: [ACME_INSTALL, SOLO_INSTALL, OTHER_USER_INSTALL, VERTUOZA_INSTALL], ...extra });
}

afterEach(() => { vi.restoreAllMocks(); });

describe('reading the address GitHub sends the installer back to', () => {
  const read = (query: string) => readSetup(new URLSearchParams(query));

  it('reads an installation', () => {
    expect(read('installation_id=5001&setup_action=install')).toEqual(install(5001));
  });

  it('reads an update of an installation as an installation', () => {
    expect(read('installation_id=5001&setup_action=update')).toEqual(install(5001));
  });

  it('reads an install request, which carries no installation', () => {
    expect(read('setup_action=request')).toEqual({ action: 'request' });
  });

  it.each([
    ['no installation id', 'setup_action=install'],
    ['a non-numeric installation id', 'installation_id=abc&setup_action=install'],
    ['a negative installation id', 'installation_id=-4&setup_action=install'],
    ['a zero installation id', 'installation_id=0&setup_action=install'],
    ['a fractional installation id', 'installation_id=5.5&setup_action=install'],
    ['an installation id past a safe integer', 'installation_id=99999999999999999999&setup_action=install'],
    ['no action', 'installation_id=5001'],
    ['an unknown action', 'installation_id=5001&setup_action=delete'],
    ['nothing', ''],
  ])('refuses %s', (_, query) => {
    expect(read(query)).toBeNull();
  });
});

describe('finishing an installation (/signup/installed)', () => {
  it('makes an org the visitor belongs to a workspace, with them as its owner', async () => {
    const w = world();
    const outcome = await finishSetup(w.db, w.session(OWEN), install(5001), w.deps);
    expect(outcome).toEqual({ kind: 'workspace', slug: 'acme', role: 'owner', created: true });
    expect(w.workspaces).toEqual([{ id: 'ws-1', slug: 'acme', github_org: 'Acme', github_installation_id: 5001 }]);
    expect(w.members).toEqual([{ workspace_id: 'ws-1', user_id: OWEN, role: 'owner' }]);
    expect(w.signup.createWorkspace).toHaveBeenCalledWith(OWEN, ACME_INSTALL);
  });

  it('never trusts the address: it fetches the installation from GitHub first', async () => {
    const w = world();
    await finishSetup(w.db, w.session(OWEN), install(5001), w.deps);
    expect(w.signup.installation).toHaveBeenCalledWith(5001);
  });

  it('makes a personal account a solo workspace, named after the login', async () => {
    const w = world();
    expect(await finishSetup(w.db, w.session(SOLO), install(5002), w.deps)).toEqual({ kind: 'workspace', slug: 'solo-dev', role: 'owner', created: true });
    expect(w.members).toEqual([{ workspace_id: 'ws-1', user_id: SOLO, role: 'owner' }]);
  });

  it('adds the visitor to an account\'s existing workspace as a member, and records the installation on it', async () => {
    const w = world({ workspaces: [{ id: 'ws-vz', slug: 'vertuoza', github_org: 'vertuoza', github_installation_id: null }], accounts: { ...ACCOUNTS, [OWEN]: { login: 'owen-gh', orgs: ['Vertuoza'] } } });
    expect(await finishSetup(w.db, w.session(OWEN), install(5004), w.deps)).toEqual({ kind: 'workspace', slug: 'vertuoza', role: 'member', created: false });
    expect(w.workspaces).toHaveLength(1);
    expect(w.workspaces[0].github_installation_id).toBe(5004);
  });

  it('creates nothing new when the same installation comes back twice', async () => {
    const w = world();
    await finishSetup(w.db, w.session(OWEN), install(5001), w.deps);
    expect(await finishSetup(w.db, w.session(OWEN), install(5001), w.deps)).toEqual({ kind: 'workspace', slug: 'acme', role: 'owner', created: false });
    expect(w.workspaces).toHaveLength(1);
  });

  it('links GitHub once the workspace exists, so the owner is a player at once', async () => {
    const w = world();
    await finishSetup(w.db, w.session(OWEN), install(5001), w.deps);
    expect(w.linkGithub).toHaveBeenCalledWith('link_github');
    const created = (w.signup.createWorkspace as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(w.linkGithub.mock.invocationCallOrder[0]).toBeGreaterThan(created);
  });

  it.each([
    ['an org the visitor does not belong to', ZED, 5001],
    ['another user\'s personal account', SOLO, 5003],
  ])('refuses %s, and creates nothing', async (_, visitor, id) => {
    const w = world();
    expect(await finishSetup(w.db, w.session(visitor), install(id), w.deps)).toEqual({ kind: 'error', reason: 'not-yours' });
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
    expect(w.workspaces).toEqual([]);
  });

  it('refuses an installation GitHub does not know (a forged id), and creates nothing', async () => {
    const w = world();
    expect(await finishSetup(w.db, w.session(OWEN), install(424242), w.deps)).toEqual({ kind: 'error', reason: 'unknown' });
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
  });

  it('shows an error when GitHub answers an error, and creates nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world();
    w.state.githubDown = true;
    expect(await finishSetup(w.db, w.session(OWEN), install(5001), w.deps)).toEqual({ kind: 'error', reason: 'github' });
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
  });

  it('shows an error when the sign-in came back without GitHub\'s token', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world();
    expect(await finishSetup(w.db, w.session(OWEN, null), install(5001), w.deps)).toEqual({ kind: 'error', reason: 'github' });
    expect(w.signup.installation).not.toHaveBeenCalled();
  });

  it('shows an error when the database cannot make the workspace', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world();
    w.state.dbDown = true;
    expect(await finishSetup(w.db, w.session(OWEN), install(5001), w.deps)).toEqual({ kind: 'error', reason: 'failed' });
  });

  it('still lands in the workspace when linking GitHub fails (ADR 0044)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world();
    w.linkGithub.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never);
    expect(await finishSetup(w.db, w.session(OWEN), install(5001), w.deps)).toMatchObject({ kind: 'workspace', slug: 'acme' });
  });
});

describe('an install request (the visitor is not the org\'s admin)', () => {
  it('records a request for their org that has no installation, and waits for its owner', async () => {
    const w = world({ installations: [VERTUOZA_INSTALL] });
    expect(await finishSetup(w.db, w.session(MIA), { action: 'request' }, w.deps)).toEqual({ kind: 'waiting', orgs: ['acme', 'Globex'] });
    expect(w.requests).toEqual([{ user_id: MIA, github_org: 'acme' }, { user_id: MIA, github_org: 'Globex' }]);
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
  });

  it('leaves out an org that already has the App', async () => {
    const w = world();
    expect(await finishSetup(w.db, w.session(MIA), { action: 'request' }, w.deps)).toEqual({ kind: 'waiting', orgs: ['Globex'] });
    expect(w.requests).toEqual([{ user_id: MIA, github_org: 'Globex' }]);
  });

  it('shows an error when no org of theirs could be waiting', async () => {
    const w = world();
    expect(await finishSetup(w.db, w.session(SOLO), { action: 'request' }, w.deps)).toEqual({ kind: 'error', reason: 'no-org' });
    expect(w.requests).toEqual([]);
  });

  it('records nothing when GitHub answers an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world();
    w.state.githubDown = true;
    expect(await finishSetup(w.db, w.session(MIA), { action: 'request' }, w.deps)).toEqual({ kind: 'error', reason: 'github' });
    expect(w.requests).toEqual([]);
  });
});

describe('where the visitor goes next', () => {
  const at = (outcome: Parameters<typeof setupReturn>[0]) => setupReturn(outcome, 'https://galaxy.example').toString();

  it('to the arcade once they are in a workspace', () => {
    expect(at({ kind: 'workspace', slug: 'acme', role: 'owner', created: true })).toBe('https://galaxy.example/play');
  });

  it('to the waiting screen, naming the orgs', () => {
    expect(at({ kind: 'waiting', orgs: ['acme', 'Globex'] })).toBe('https://galaxy.example/signup?waiting=acme%2CGlobex');
  });

  it('to the error screen, naming the reason', () => {
    expect(at({ kind: 'error', reason: 'not-yours' })).toBe('https://galaxy.example/signup?error=not-yours');
  });
});
