import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Installation } from '../signup/installation';
import { signupWorld } from '../signup/signup.fake';
import { item } from '../ask/test/test-item';
import { afterSignIn } from './sign-in';

// MIA asked acme's owner to install Omni Loop (a sign-up request); the owner has since installed it.
const MIA = 'user-mia';
const ACME: Installation = { id: 5001, account: { login: 'Acme', type: 'Organization' } };

function world(opts: { installed?: Installation[]; orgs?: string[]; requests?: string[] } = {}) {
  return signupWorld({
    accounts: { [MIA]: { login: 'mia-gh', orgs: opts.orgs ?? ['acme'] } },
    installations: opts.installed ?? [ACME],
    requests: (opts.requests ?? ['acme']).map((github_org) => ({ user_id: MIA, github_org })),
  });
}

afterEach(() => { vi.restoreAllMocks(); });

describe('after a sign-in, a pending sign-up request', () => {
  it('whose org now has the App makes the requester the new workspace\'s owner, and is done', async () => {
    const w = world();
    expect(await afterSignIn(w.db, w.session(MIA), w.deps, null)).toEqual(['signin', 'ok']);
    expect(w.signup.createWorkspace).toHaveBeenCalledWith(MIA, ACME);
    expect(w.members).toEqual([{ workspace_id: 'ws-1', user_id: MIA, role: 'owner' }]);
    expect(w.requests).toEqual([]);
  });

  it('completes before GitHub is linked, so the new owner is a player at once', async () => {
    const w = world();
    await afterSignIn(w.db, w.session(MIA), w.deps, null);
    const created = item((w.signup.createWorkspace as ReturnType<typeof vi.fn>).mock.invocationCallOrder, 0);
    expect(item(w.linkGithub.mock.invocationCallOrder, 0)).toBeGreaterThan(created);
  });

  it('whose org still has no App stays pending', async () => {
    const w = world({ installed: [] });
    await afterSignIn(w.db, w.session(MIA), w.deps, null);
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
    expect(w.requests).toEqual([{ user_id: MIA, github_org: 'acme' }]);
  });

  it('for an org the person no longer belongs to makes nothing', async () => {
    const w = world({ orgs: [] });
    await afterSignIn(w.db, w.session(MIA), w.deps, null);
    expect(w.signup.orgInstallation).not.toHaveBeenCalled();
    expect(w.signup.createWorkspace).not.toHaveBeenCalled();
  });

  it('asks GitHub nothing more when the person has no request and is in a workspace', async () => {
    const w = signupWorld({
      accounts: { [MIA]: { login: 'mia-gh', orgs: ['acme'] } },
      installations: [ACME],
      workspaces: [{ id: 'ws-acme', slug: 'acme', github_org: 'Acme', github_installation_id: 5001 }],
      members: [{ workspace_id: 'ws-acme', user_id: MIA, role: 'owner' }],
    });
    await afterSignIn(w.db, w.session(MIA), w.deps, null);
    expect(w.signup.orgInstallation).not.toHaveBeenCalled();
    expect(w.signup.userInstallation).not.toHaveBeenCalled();
  });

  it('joins an existing workspace as a member when the org\'s owner made it first', async () => {
    const w = signupWorld({
      accounts: { [MIA]: { login: 'mia-gh', orgs: ['acme'] } },
      installations: [ACME],
      workspaces: [{ id: 'ws-acme', slug: 'acme', github_org: 'Acme', github_installation_id: 5001 }],
      members: [{ workspace_id: 'ws-acme', user_id: 'user-owen', role: 'owner' }],
      requests: [{ user_id: MIA, github_org: 'acme' }],
    });
    await afterSignIn(w.db, w.session(MIA), w.deps, null);
    expect(w.members).toContainEqual({ workspace_id: 'ws-acme', user_id: MIA, role: 'member' });
    expect(w.workspaces).toHaveLength(1);
    expect(w.requests).toEqual([]);
  });

  it('never fails the sign-in when completing fails (ADR 0044)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world();
    w.state.githubDown = true;
    expect(await afterSignIn(w.db, w.session(MIA), w.deps, null)).toEqual(['signin', 'ok']);
    expect(w.linkGithub).toHaveBeenCalled();
    expect(w.requests).toEqual([{ user_id: MIA, github_org: 'acme' }]);
  });
});
