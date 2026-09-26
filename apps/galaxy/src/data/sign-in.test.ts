import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cliSignInReturn, type CliCallbackDeps, type CliSession } from '../ask/cli-code';
import { afterSignIn, joinBeforeIssue } from './sign-in';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';

function as(person: FakeUser) {
  const world = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  return { world, db: world.client(person) as unknown as SupabaseClient };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('after a sign-in with Google', () => {
  it('joins the workspaces of the account\'s domain, then goes back to the arcade', async () => {
    const { world, db } = as(PEOPLE.bea);
    expect(await afterSignIn(db, null)).toEqual(['signin', 'ok']);
    expect(world.calls).toEqual([{ kind: 'rpc', fn: 'join_by_domain' }]);
    expect(world.tables.workspace_members).toContainEqual(expect.objectContaining({ workspace_id: VERTUOZA, user_id: PEOPLE.bea.id }));
  });

  it('still goes back to the arcade when joining fails: the page joins once more itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { world, db } = as(PEOPLE.bea);
    world.state.fail = { message: 'timeout' };
    expect(await afterSignIn(db, null)).toEqual(['signin', 'ok']);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('after linking GitHub', () => {
  it('joins before link_github(), so a session from before workspaces is answered', async () => {
    const { world, db } = as(PEOPLE.bea);
    expect(await afterSignIn(db, 'link')).toEqual(['linked', 'bea-gh']);
    expect(world.calls).toEqual([{ kind: 'rpc', fn: 'join_by_domain' }, { kind: 'rpc', fn: 'link_github' }]);
  });

  it('brings link_github()\'s refusal back to the arcade', async () => {
    const { db } = as(PEOPLE.una);
    expect(await afterSignIn(db, 'link')).toEqual(['link_error', 'Sign in with an account of a workspace first.']);
  });
});

describe('the terminal\'s sign-in (omni signin)', () => {
  const session = (person: FakeUser): CliSession => ({ access_token: `access-${person.id}`, refresh_token: 'refresh', user: { id: person.id, email: person.email } });

  it('joins before the one-time code is issued', async () => {
    const order: string[] = [];
    const issue = vi.fn(async () => { order.push('issue'); return { error: null }; });
    const deps: CliCallbackDeps = { exchange: null, issue, revoke: async () => {} };
    const join = vi.fn(async () => { order.push('join'); });
    const s = session(PEOPLE.bea);
    expect(await joinBeforeIssue(deps, join).issue(s, 'hash')).toEqual({ error: null });
    expect(join).toHaveBeenCalledWith(s);
    expect(issue).toHaveBeenCalledWith(s, 'hash');
    expect(order).toEqual(['join', 'issue']);
  });

  it('still issues the code when joining fails: the code\'s own refusal then speaks', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const issue = vi.fn(async () => ({ error: null }));
    const wrapped = joinBeforeIssue({ exchange: null, issue, revoke: async () => {} }, async () => { throw new Error('timeout'); });
    expect(await wrapped.issue(session(PEOPLE.bea), 'hash')).toEqual({ error: null });
    expect(issue).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('hands a code to a vertuoza.com account that has not opened the arcade since workspaces', async () => {
    const { world } = as(PEOPLE.bea);
    const bea = session(PEOPLE.bea);
    const deps: CliCallbackDeps = {
      exchange: async () => ({ session: bea, error: null }),
      // As ask_cli_code_issue() does: members of a workspace only.
      issue: async (s) => (world.tables.workspace_members.some((m) => m.user_id === s.user.id)
        ? { error: null }
        : { error: { message: 'Sign in with an account of a workspace first.' } }),
      revoke: async () => {},
    };
    const url = new URL('https://galaxy.example/auth/callback?next=ask-cli&port=49152&state=Zm9vYmFyYmF6cXV4LXN0YXRl&code=google');
    const join = async () => { await world.client(PEOPLE.bea).rpc('join_by_domain'); };
    expect(await cliSignInReturn(url, 'https://galaxy.example', joinBeforeIssue(deps, join))).toMatch(/^http:\/\/127\.0\.0\.1:49152\/callback\?/);
  });
});
