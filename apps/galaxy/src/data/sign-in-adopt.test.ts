import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Installation } from '../signup/installation';
import { signupWorld } from '../signup/signup.fake';
import { item } from '../ask/test/test-item';
import { afterSignIn } from './sign-in';

// A sign-up that stopped half way: the App is installed, but no workspace was made. The next sign-in
// finishes it, with nothing to type.
const DAN = 'user-dan';
const OWN: Installation = { id: 7001, account: { login: 'dan-gh', type: 'User' } };
const ACME: Installation = { id: 5001, account: { login: 'Acme', type: 'Organization' } };
const OTHER: Installation = { id: 9001, account: { login: 'someone-else', type: 'User' } };

const world = (installations: Installation[], orgs: string[] = []) =>
  signupWorld({ accounts: { [DAN]: { login: 'dan-gh', orgs } }, installations });

afterEach(() => { vi.restoreAllMocks(); });

describe('a sign-in by someone in no workspace', () => {
  it('makes the App already installed on their own account their workspace, as its owner', async () => {
    const w = world([OWN]);
    expect(await afterSignIn(w.db, w.session(DAN), w.deps, null)).toEqual(['signin', 'ok']);
    expect(w.signup.createWorkspace).toHaveBeenCalledWith(DAN, OWN);
    expect(w.members).toEqual([{ workspace_id: 'ws-1', user_id: DAN, role: 'owner' }]);
  });

  it('makes the App already installed on an org of theirs their workspace', async () => {
    const w = world([ACME], ['acme']);
    await afterSignIn(w.db, w.session(DAN), w.deps, null);
    expect(w.workspaces).toEqual([{ id: 'ws-1', slug: 'acme', github_org: 'Acme', github_installation_id: 5001 }]);
    expect(w.members).toEqual([{ workspace_id: 'ws-1', user_id: DAN, role: 'owner' }]);
  });

  it('records the installation on an org\'s workspace that had none, and joins it', async () => {
    const w = signupWorld({
      accounts: { [DAN]: { login: 'dan-gh', orgs: ['acme'] } },
      installations: [ACME],
      workspaces: [{ id: 'ws-acme', slug: 'acme', github_org: 'Acme', github_installation_id: null }],
      members: [{ workspace_id: 'ws-acme', user_id: 'user-owen', role: 'owner' }],
    });
    await afterSignIn(w.db, w.session(DAN), w.deps, null);
    expect(w.workspaces).toEqual([{ id: 'ws-acme', slug: 'acme', github_org: 'Acme', github_installation_id: 5001 }]);
    expect(w.members).toContainEqual({ workspace_id: 'ws-acme', user_id: DAN, role: 'member' });
  });

  it('makes nothing of an installation on someone else\'s account, or when there is none', async () => {
    const w = world([OTHER]);
    await afterSignIn(w.db, w.session(DAN), w.deps, null);
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
    expect(w.workspaces).toEqual([]);
  });

  it('picks up the installation before GitHub is linked, so they are a player at once', async () => {
    const w = world([OWN]);
    await afterSignIn(w.db, w.session(DAN), w.deps, null);
    const created = item((w.signup.createWorkspace as ReturnType<typeof vi.fn>).mock.invocationCallOrder, 0);
    expect(item(w.linkGithub.mock.invocationCallOrder, 0)).toBeGreaterThan(created);
  });

  it('looks up nothing when joining failed, since it cannot tell whether they are in one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world([OWN]);
    w.joinByGithub.mockRejectedValueOnce(new Error('Supabase: timeout'));
    await afterSignIn(w.db, w.session(DAN), w.deps, null);
    expect(w.signup.userInstallation).not.toHaveBeenCalled();
  });

  it('never fails the sign-in when GitHub cannot be read (ADR 0044)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world([OWN]);
    w.signup.userInstallation = vi.fn(() => Promise.reject(new Error('GitHub answered 502')));
    expect(await afterSignIn(w.db, w.session(DAN), w.deps, null)).toEqual(['signin', 'ok']);
    expect(w.linkGithub).toHaveBeenCalled();
  });
});
