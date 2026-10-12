import { describe, expect, it, vi } from 'vitest';
import { boardLanding, press, signInProblem, voterCallbackUrl, type VotePorts } from './vote';

// The ▲ of a card (PRD 1246, s3): what a press does, signed out, signed in, voted or not, with the
// browser's session, the database and GitHub's sign-in faked.

const IDEA = '00000000-0000-4000-8000-000000000001';

function ports(over: Partial<VotePorts> = {}): VotePorts & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    origin: 'https://galaxy.example',
    signedIn: vi.fn(() => Promise.resolve(true)),
    add: vi.fn((id: string) => { calls.push(`add ${id}`); return Promise.resolve(null); }),
    remove: vi.fn((id: string) => { calls.push(`remove ${id}`); return Promise.resolve(null); }),
    signIn: vi.fn((to: string) => { calls.push(`sign in ${to}`); return Promise.resolve(null); }),
    ...over,
  };
}

describe('a signed-in press', () => {
  it('adds the vote, and the count goes up by one', async () => {
    const p = ports();
    expect(await press(p, 'acme/widgets', IDEA, { votes: 4, voted: false })).toEqual({ kind: 'counted', state: { votes: 5, voted: true } });
    expect(p.calls).toEqual([`add ${IDEA}`]);
  });

  it('a second press takes it back, and the count goes down by one', async () => {
    const p = ports();
    expect(await press(p, 'acme/widgets', IDEA, { votes: 5, voted: true })).toEqual({ kind: 'counted', state: { votes: 4, voted: false } });
    expect(p.calls).toEqual([`remove ${IDEA}`]);
  });

  it('never counts below zero', async () => {
    expect(await press(ports(), 'acme/widgets', IDEA, { votes: 0, voted: true })).toEqual({ kind: 'counted', state: { votes: 0, voted: false } });
  });

  it('keeps the count and says so when the database refuses', async () => {
    const p = ports({ add: () => Promise.resolve('new row violates row-level security policy') });
    expect(await press(p, 'acme/widgets', IDEA, { votes: 4, voted: false })).toEqual({ kind: 'failed', problem: 'Your vote could not be counted. Try again.' });
  });
});

describe('a signed-out press', () => {
  it('starts a GitHub sign-in that comes back to the board with the vote to count, and writes nothing', async () => {
    const p = ports({ signedIn: () => Promise.resolve(false) });
    expect(await press(p, 'acme/widgets', IDEA, { votes: 4, voted: false })).toEqual({ kind: 'signing-in' });
    expect(p.calls).toEqual([`sign in https://galaxy.example/auth/callback?next=ideas&board=acme%2Fwidgets&vote=${IDEA}`]);
  });

  it('says why when the sign-in could not start', async () => {
    const p = ports({ signedIn: () => Promise.resolve(false), signIn: () => Promise.resolve('GitHub sign-in could not start: provider is not enabled') });
    expect(await press(p, 'acme/widgets', IDEA, { votes: 4, voted: false })).toEqual({ kind: 'failed', problem: 'GitHub sign-in could not start: provider is not enabled' });
  });
});

describe('the demo, with no database', () => {
  it('counts the press on the page only', async () => {
    expect(await press(null, 'vertuoza/vertuo-omni-loop', IDEA, { votes: 1, voted: false })).toEqual({ kind: 'counted', state: { votes: 2, voted: true } });
  });
});

describe('a sign-in to vote that did not finish', () => {
  it('is read from the board\'s address, and is nothing on a plain visit', () => {
    expect(signInProblem('?signin_error=Nope')).toBe('Your sign-in to vote did not finish: Nope');
    expect(signInProblem('')).toBeNull();
    expect(signInProblem('?signin_error=')).toBeNull();
  });
});

describe('the way back to the board', () => {
  it('is the callback, naming the board and the idea', () => {
    const url = new URL(voterCallbackUrl('https://galaxy.example', 'acme/widgets', IDEA));
    expect(url.pathname).toBe('/auth/callback');
    expect(url.searchParams.get('board')).toBe('acme/widgets');
    expect(url.searchParams.get('vote')).toBe(IDEA);
  });

  it('lands only on a board path: /ideas/<owner>/<repo>', () => {
    expect(boardLanding('acme/widgets')).toBe('/ideas/acme/widgets');
    expect(boardLanding('Acme/Widgets')).toBe('/ideas/acme/widgets');
    for (const off of [null, '', 'acme', '//evil.example', 'https://evil.example/x', 'acme/widgets/../../play', '../acme/x', 'acme/wid gets', '/acme/widgets']) {
      expect(boardLanding(off)).toBeNull();
    }
  });
});
