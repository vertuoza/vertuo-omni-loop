import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentials } from '../ask/credentials.mjs';
import { signInLines, signInStep } from './signin-step.mjs';

const ASK_URL = 'https://omni.example.test';
const HOST = 'omni.example.test';
const ENTRY = { access_token: 'a', refresh_token: 'r', expires_at: null, email: 'ada@example.test' };

const freshHome = () => mkdtempSync(join(tmpdir(), 'omni-home-'));

/** A sign-in flow that keeps an entry for the host, as `omni signin` does, and exits with `code`. */
function flow(home, code = 0) {
  const calls = [];
  const signIn = async () => {
    calls.push('signin');
    if (code === 0) credentials({ home }).write(HOST, ENTRY);
    return code;
  };
  return { signIn, calls };
}

describe('signInStep', () => {
  it('on a terminal and signed out, runs the sign-in flow and reports who signed in', async () => {
    const home = freshHome();
    const { signIn, calls } = flow(home);
    expect(await signInStep({ askUrl: ASK_URL, home, interactive: true, signIn })).toEqual({ outcome: 'signed-in', host: HOST, email: ENTRY.email });
    expect(calls).toEqual(['signin']);
  });

  it('signed in already: "already", and no flow runs, terminal or not', async () => {
    for (const interactive of [true, false]) {
      const home = freshHome();
      credentials({ home }).write(HOST, ENTRY);
      const { signIn, calls } = flow(home);
      expect(await signInStep({ askUrl: ASK_URL, home, interactive, signIn })).toEqual({ outcome: 'already', host: HOST, email: ENTRY.email });
      expect(calls).toEqual([]);
    }
  });

  it('no terminal: later, and no flow runs', async () => {
    const home = freshHome();
    const { signIn, calls } = flow(home);
    expect(await signInStep({ askUrl: ASK_URL, home, interactive: false, signIn })).toEqual({ outcome: 'later', host: HOST, why: 'no terminal' });
    expect(calls).toEqual([]);
  });

  it('a sign-in refused, timed out or throwing: later', async () => {
    const home = freshHome();
    expect((await signInStep({ askUrl: ASK_URL, home, interactive: true, signIn: flow(home, 1).signIn })).outcome).toBe('later');
    const throwing = async () => { throw new Error('boom'); };
    expect(await signInStep({ askUrl: ASK_URL, home, interactive: true, signIn: throwing })).toEqual({ outcome: 'later', host: HOST, why: 'did not finish' });
  });

  it('no ask.url: unset, and no flow runs', async () => {
    const home = freshHome();
    const { signIn, calls } = flow(home);
    expect(await signInStep({ askUrl: null, home, interactive: true, signIn })).toEqual({ outcome: 'unset' });
    expect(calls).toEqual([]);
  });
});

describe('signInLines', () => {
  it('one status line when signed in, now or already', () => {
    expect(signInLines({ outcome: 'signed-in', host: HOST, email: ENTRY.email })).toEqual({ status: [`  signin  signed in to ${HOST} as ${ENTRY.email}`], todo: [] });
    expect(signInLines({ outcome: 'already', host: HOST, email: ENTRY.email })).toEqual({ status: [`  signin  signed in to ${HOST} already, as ${ENTRY.email}`], todo: [] });
  });

  it('omni signin as a later step when it could not be done now', () => {
    expect(signInLines({ outcome: 'later', host: HOST, why: 'no terminal' })).toEqual({ status: [`  signin  not signed in to ${HOST}: no terminal`], todo: ['omni signin'] });
  });

  it('says ask.url is not set, with nothing to type', () => {
    expect(signInLines({ outcome: 'unset' })).toEqual({ status: ['  signin  skipped: ask.url is not set'], todo: [] });
  });
});
