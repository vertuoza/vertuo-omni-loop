import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasAuthCookie, SESSION_MARK_SCRIPT, SETTLE_MS, settleSession, type SettlePorts } from './session-mark';
import type { SignedInView } from './signed-in';

// No flash (PRD 1006, s2): before HOME paints, a Supabase auth cookie marks the page pending, so SIGN
// UP WITH GITHUB keeps its box but is not shown; Controls then settles the mark from the session read.

describe('the pre-paint cookie check', () => {
  it('marks the page on a Supabase auth cookie', () => {
    expect(hasAuthCookie('sb-abc-auth-token=base64-eyJ')).toBe(true);
    expect(hasAuthCookie('theme=dark; sb-abc-auth-token=base64-eyJ')).toBe(true);
  });

  it('marks the page on a chunked one', () => {
    expect(hasAuthCookie('sb-abc-auth-token.0=base64-eyJ; sb-abc-auth-token.1=rest')).toBe(true);
    expect(hasAuthCookie('a=1;sb-abc-auth-token.0=x')).toBe(true);
  });

  it('leaves the page alone with no Supabase auth cookie', () => {
    expect(hasAuthCookie('')).toBe(false);
    expect(hasAuthCookie('theme=dark; omni-choice=app')).toBe(false);
  });

  it('leaves the page alone on an unrelated sb- cookie', () => {
    expect(hasAuthCookie('sb-abc-auth-token-code-verifier=x')).toBe(false);
    expect(hasAuthCookie('sb-abc-other=x')).toBe(false);
    expect(hasAuthCookie('xsb-abc-auth-token=x')).toBe(false);
  });

  it('runs the same rule as the inline script', () => {
    const run = (cookie: string) => {
      const main = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } };
      runInNewContext(SESSION_MARK_SCRIPT, { document: { cookie, currentScript: { parentElement: main } } });
      return main.attrs['data-session'];
    };
    expect(run('sb-abc-auth-token.0=x')).toBe('pending');
    expect(run('sb-abc-other=x')).toBeUndefined();
  });
});

describe('settling the mark', () => {
  const ada: SignedInView = { name: 'Ada', face: { kind: 'initial', letter: 'A' } };
  let marks: Array<'in' | null>;
  let drawn: SignedInView[];
  const ports = (read: () => Promise<SignedInView | null>): SettlePorts => ({
    read,
    mark: (state) => { marks.push(state); },
    draw: (view) => { drawn.push(view); },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    marks = [];
    drawn = [];
  });
  afterEach(() => { vi.useRealTimers(); });

  it('a session marks the page in and draws the pills', async () => {
    settleSession(ports(() => Promise.resolve(ada)));
    await vi.advanceTimersByTimeAsync(0);
    expect(marks).toEqual(['in']);
    expect(drawn).toEqual([ada]);
  });

  it('no session removes the mark', async () => {
    settleSession(ports(() => Promise.resolve(null)));
    await vi.advanceTimersByTimeAsync(0);
    expect(marks).toEqual([null]);
    expect(drawn).toEqual([]);
  });

  it('a failed read removes the mark', async () => {
    settleSession(ports(() => Promise.reject(new Error('network down'))));
    await vi.advanceTimersByTimeAsync(0);
    expect(marks).toEqual([null]);
  });

  it('no Supabase (the demo) removes the mark', async () => {
    const { readSignedIn } = await import('./session-read');
    settleSession(ports(() => readSignedIn(null)));
    await vi.advanceTimersByTimeAsync(0);
    expect(marks).toEqual([null]);
  });

  it('3 seconds without an answer removes the mark, and a late session still draws the pills', async () => {
    let answer: (view: SignedInView | null) => void = () => {};
    settleSession(ports(() => new Promise((done) => { answer = done; })));
    await vi.advanceTimersByTimeAsync(SETTLE_MS - 1);
    expect(marks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(SETTLE_MS).toBe(3000);
    expect(marks).toEqual([null]);
    answer(ada);
    await vi.advanceTimersByTimeAsync(0);
    expect(drawn).toEqual([ada]);
  });

  it('a late no-session after the 3 seconds changes nothing more', async () => {
    let answer: (view: SignedInView | null) => void = () => {};
    settleSession(ports(() => new Promise((done) => { answer = done; })));
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    answer(null);
    await vi.advanceTimersByTimeAsync(0);
    expect(marks).toEqual([null]);
    expect(drawn).toEqual([]);
  });

  it('stops when cancelled: the page has gone', async () => {
    const cancel = settleSession(ports(() => Promise.resolve(ada)));
    cancel();
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    expect(marks).toEqual([]);
    expect(drawn).toEqual([]);
  });
});
