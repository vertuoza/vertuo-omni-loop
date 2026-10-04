import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { cliSignInReturn, type CliCallbackDeps, type CliSession } from '../ask/cli-code';
import { present } from '../ask/test/test-item';
import { settled } from '../stages/settled';
import type { GithubAccount } from './github-orgs';
import { afterSignIn, appLanding, joinBeforeIssue, settleSignIn, settlingExchange, type SignedIn, type SignInDeps } from './sign-in';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA, type FakeUser } from './galaxy.fake';
import { joinByGithub } from './workspace';

const TOKEN = 'gho_provider-token-of-the-sign-in';

/** GitHub as the provider token reads it: each person's login and orgs. */
const GITHUB: Record<string, GithubAccount> = {
  [PEOPLE.bea.id]: { login: 'bea-gh', orgs: ['Vertuoza', 'some-club'] },
  [PEOPLE.eve.id]: { login: 'eve-gh', orgs: ['example'] },
};

function world(person: FakeUser, github: GithubAccount | undefined = GITHUB[person.id]) {
  const w = fakeGalaxyDb(twoWorkspaces(), Object.values(PEOPLE));
  const readGithub = vi.fn((token: string) => settled(() => {
    if (token !== TOKEN) throw new Error('GitHub answered 401 to /user');
    return present(github, `the GitHub account of ${person.email}`);
  }));
  const joining = vi.fn((userId: string, logins: string[]) => joinByGithub(w.service() as unknown as SupabaseClient<Database>, userId, logins));
  const deps: SignInDeps = { readGithub, joinByGithub: joining };
  const session: SignedIn = { user: { id: person.id }, provider_token: TOKEN };
  return { w, db: w.client(person) as unknown as SupabaseClient<Database>, deps, session, readGithub, joining };
}

const memberOf = (w: ReturnType<typeof fakeGalaxyDb>, person: FakeUser) =>
  w.tables.workspace_members.filter((m) => m.user_id === person.id).map((m) => m.workspace_id);

afterEach(() => { vi.restoreAllMocks(); });

describe('after a sign-in with GitHub', () => {
  it('joins the workspaces of the person\'s orgs, links GitHub, then goes back to the arcade', async () => {
    const { w, db, deps, session, joining } = world(PEOPLE.bea);
    expect(await afterSignIn(db, session, deps, null)).toEqual(['signin', 'ok']);
    expect(joining).toHaveBeenCalledWith(PEOPLE.bea.id, ['bea-gh', 'Vertuoza', 'some-club']);
    expect(memberOf(w, PEOPLE.bea)).toEqual([VERTUOZA]);
    expect(w.calls).toEqual([
      { kind: 'rpc', fn: 'join_workspaces_by_github', args: { p_user_id: PEOPLE.bea.id, p_logins: ['bea-gh', 'Vertuoza', 'some-club'] } },
      { kind: 'rpc', fn: 'link_github' },
    ]);
  });

  it('joins as the service role, never as the person: they cannot run the join themselves', async () => {
    const { w } = world(PEOPLE.bea);
    const { error } = await w.client(PEOPLE.bea).rpc('join_workspaces_by_github', { p_user_id: PEOPLE.bea.id, p_logins: ['vertuoza'] });
    expect(error?.code).toBe('42501');
  });

  it('never hands the provider token to the database: only the person\'s id and logins go there', async () => {
    const { w, db, deps, session } = world(PEOPLE.bea);
    await afterSignIn(db, session, deps, null);
    expect(JSON.stringify(w.calls)).not.toContain(TOKEN);
    expect(JSON.stringify(w.tables)).not.toContain(TOKEN);
  });

  it('links GitHub on every sign-in, a member\'s too', async () => {
    const { w, db, deps } = world(PEOPLE.ada, { login: 'ada-gh', orgs: ['vertuoza'] });
    expect(await afterSignIn(db, { user: { id: PEOPLE.ada.id }, provider_token: TOKEN }, deps, null)).toEqual(['signin', 'ok']);
    expect(w.calls.map((c) => c.kind === 'rpc' && c.fn)).toEqual(['join_workspaces_by_github', 'link_github']);
  });

  it('leaves a person in no org of a workspace in none, and still goes back to the arcade', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, db, deps, session } = world(PEOPLE.eve);
    expect(await afterSignIn(db, session, deps, null)).toEqual(['signin', 'ok']);
    expect(memberOf(w, PEOPLE.eve)).toEqual([]);
    // link_github() refuses a person in no workspace: logged, never a failed sign-in.
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Sign in with an account of a workspace first.'));
  });

  it('still links and goes back to the arcade when GitHub refuses the token (ADR 0044)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, db, deps } = world(PEOPLE.ada);
    expect(await afterSignIn(db, { user: { id: PEOPLE.ada.id }, provider_token: 'expired' }, deps, null)).toEqual(['signin', 'ok']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('401'));
    expect(w.calls).toEqual([{ kind: 'rpc', fn: 'link_github' }]);
  });

  it('still goes back to the arcade when the database fails to join', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, db, deps, session } = world(PEOPLE.bea);
    w.state.fail = { message: 'timeout' };
    expect(await afterSignIn(db, session, deps, null)).toEqual(['signin', 'ok']);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('timeout'));
  });

  it('asks GitHub nothing when Supabase handed no provider token, and says so in the log', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { db, deps, readGithub, joining } = world(PEOPLE.bea);
    expect(await afterSignIn(db, { user: { id: PEOPLE.bea.id }, provider_token: null }, deps, null)).toEqual(['signin', 'ok']);
    expect(readGithub).not.toHaveBeenCalled();
    expect(joining).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no GitHub token'));
  });

  it('does nothing without a session (an exchange that answered none)', async () => {
    const { w, db, deps } = world(PEOPLE.bea);
    expect(await afterSignIn(db, null, deps, null)).toEqual(['signin', 'ok']);
    expect(w.calls).toEqual([]);
  });
});

describe('after the arcade\'s link step (next=link, until the step goes)', () => {
  it('answers the linked login', async () => {
    const { db, deps, session } = world(PEOPLE.bea);
    expect(await afterSignIn(db, session, deps, 'link')).toEqual(['linked', 'bea-gh']);
  });

  it('brings link_github()\'s refusal back to the arcade', async () => {
    const { db, deps, session } = world(PEOPLE.eve);
    expect(await afterSignIn(db, session, deps, 'link')).toEqual(['link_error', 'Sign in with an account of a workspace first.']);
  });
});

// Where a sign-in from HOME lands (PRD 932): allowlisted, never a path taken from the address.
describe('the landing after a sign-in from HOME', () => {
  it('lands an Omni app pick on /app', () => {
    expect(appLanding('app')).toBe('/app');
  });

  it.each([null, '', 'arcade', 'link', 'ask-cli', 'APP', '/app', '//evil.example', 'https://evil.example', '/app/../x'])(
    'lands %j on /play', (next) => {
      expect(appLanding(next)).toBe('/play');
    });
});

describe('a page\'s own callback (ask, knowledge, dossiers)', () => {
  it('exchanges the code, then joins and links before the page reads as the person', async () => {
    const { w, db, deps, session } = world(PEOPLE.bea);
    const exchange = vi.fn(() => Promise.resolve({ data: { session }, error: null }));
    expect(await settlingExchange(exchange, db, deps)('code')).toEqual({ error: null });
    expect(exchange).toHaveBeenCalledWith('code');
    expect(memberOf(w, PEOPLE.bea)).toEqual([VERTUOZA]);
    expect(w.calls.map((c) => c.kind === 'rpc' && c.fn)).toEqual(['join_workspaces_by_github', 'link_github']);
  });

  it('answers a refused exchange as it came, and joins nobody', async () => {
    const { w, db, deps } = world(PEOPLE.bea);
    expect(await settlingExchange(() => Promise.resolve({ data: null, error: { message: 'expired' } }), db, deps)('old')).toEqual({ error: { message: 'expired' } });
    expect(w.calls).toEqual([]);
  });

  it('never fails the sign-in when joining and linking fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, db, deps, session } = world(PEOPLE.bea);
    w.state.fail = { message: 'timeout' };
    expect(await settlingExchange(() => Promise.resolve({ data: { session }, error: null }), db, deps)('code')).toEqual({ error: null });
  });
});

describe('the terminal\'s sign-in (omni signin)', () => {
  const cli = (person: FakeUser): CliSession & SignedIn => ({ access_token: `access-${person.id}`, refresh_token: 'refresh', user: { id: person.id, email: person.email }, provider_token: TOKEN });

  it('joins before the one-time code is issued', async () => {
    const order: string[] = [];
    const issue = vi.fn(() => { order.push('issue'); return Promise.resolve({ error: null }); });
    const deps: CliCallbackDeps = { exchange: null, issue, revoke: () => Promise.resolve() };
    const join = vi.fn(() => { order.push('join'); return Promise.resolve(); });
    const s = cli(PEOPLE.bea);
    expect(await joinBeforeIssue(deps, join).issue(s, 'hash')).toEqual({ error: null });
    expect(join).toHaveBeenCalledWith(s);
    expect(issue).toHaveBeenCalledWith(s, 'hash');
    expect(order).toEqual(['join', 'issue']);
  });

  it('still issues the code when joining fails: the code\'s own refusal then speaks', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const issue = vi.fn(() => Promise.resolve({ error: null }));
    const wrapped = joinBeforeIssue({ exchange: null, issue, revoke: () => Promise.resolve() }, () => Promise.reject(new Error('timeout')));
    expect(await wrapped.issue(cli(PEOPLE.bea), 'hash')).toEqual({ error: null });
    expect(issue).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('hands a code to a member of a workspace\'s org who never signed in before', async () => {
    const { w, deps: signIn } = world(PEOPLE.bea);
    const bea = cli(PEOPLE.bea);
    const deps: CliCallbackDeps = {
      exchange: () => Promise.resolve({ session: bea, error: null }),
      // As ask_cli_code_issue() does: members of a workspace only.
      issue: (s) => Promise.resolve(w.tables.workspace_members.some((m) => m.user_id === s.user.id)
        ? { error: null }
        : { error: { message: 'Sign in with an account of a workspace first.' } }),
      revoke: () => Promise.resolve(),
    };
    const url = new URL('https://galaxy.example/auth/callback?next=ask-cli&port=49152&state=Zm9vYmFyYmF6cXV4LXN0YXRl&code=github');
    const join = (s: CliSession) => settleSignIn(w.client(PEOPLE.bea), s, signIn);
    expect(await cliSignInReturn(url, 'https://galaxy.example', joinBeforeIssue(deps, join))).toMatch(/^http:\/\/127\.0\.0\.1:49152\/callback\?/);
    expect(memberOf(w, PEOPLE.bea)).toEqual([VERTUOZA]);
  });
});
