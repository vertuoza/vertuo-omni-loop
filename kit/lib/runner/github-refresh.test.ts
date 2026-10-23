// Keeping a job's GitHub App token current (PRD 2433, s3): `keepGithubToken()` on a fake clock, a fake sleep
// and a fake app, over a token file in a temporary home. A token with 5 minutes left or more is the answer as
// it stands; with less, the app is asked, once however many ask together; a refusal waits a minute, shared by
// everyone who reads the file; a token that expired with no fresh one is no token. No test holds a real token
// and none calls GitHub.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { keepGithubToken, REFRESH_BEFORE_MS, RETRY_MS } from './github-refresh.ts';
import type { RefreshOptions } from './github-refresh.ts';
import { githubTokenFile, readGithubToken, saveGithubToken } from './github-token.ts';
import type { GithubToken } from './github-token.ts';

const T0 = Date.parse('2026-10-22T12:00:00.000Z');
const MIN = 60 * 1000;
const OLD = ['ghs', 'fakeOldTokenOfTheJob0123456789ABCDEF'].join('_');
const FRESH = ['ghs', 'fakeFreshTokenOfTheJob9876543210XYZ'].join('_');
const FRESHER = ['ghs', 'fakeFresherTokenOfTheJob5555555555Q'].join('_');
const TOO_LONG = 'another refresh of the job’s token is taking too long';
const REFUSED = 'refused (503)';

const at = (ms: number): string => new Date(T0 + ms).toISOString();
const grant = (token: string, ms: number): GithubToken => ({ token, expiresAt: at(ms) });

/** What the fake app answers: a token, or what it throws (an `Error`, or `{ thrown }` for anything else). */
type Answer = GithubToken | Error | { thrown: unknown };

/**
 * A job's token file in a temporary home, its one token expiring `expiresIn` after `T0` (or on the date it is
 * given as), and the options of a refresh on a fake clock: every ask is kept with the time it was made, and is
 * answered from `answers` in turn.
 */
function setup(expiresIn: number | string, answers: Answer[] = []) {
  const home = mkdtempSync(join(tmpdir(), 'omni-refresh-'));
  const file = githubTokenFile(home, '7');
  if (file === null) throw new Error('no file');
  saveGithubToken(file, 'box-1', typeof expiresIn === 'string' ? { token: OLD, expiresAt: expiresIn } : grant(OLD, expiresIn), 'https://omni.example/app');
  const clock = { now: T0 };
  const asked: number[] = [];
  const slept: number[] = [];
  const options: RefreshOptions = {
    file,
    runner: 'box-1',
    job: '7',
    fetchToken: async (job) => {
      asked.push(clock.now);
      expect(job).toBe('7');
      // The app takes a moment, so a caller that comes meanwhile has time to look.
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      const next = answers.shift();
      if (next === undefined) throw new Error('no answer was queued');
      if (next instanceof Error) throw next;
      if ('thrown' in next) throw next.thrown;
      return next;
    },
    now: () => clock.now,
    sleep: (ms) => {
      slept.push(ms);
      clock.now += ms;
      return new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    },
  };
  return { file, clock, asked, slept, options, keep: () => keepGithubToken(options) };
}

const held = (file: string) => readGithubToken(file);

describe('a token with life left', () => {
  it('is the answer as it stands when it has 5 minutes left or more, and the app is not asked', async () => {
    for (const left of [REFRESH_BEFORE_MS, REFRESH_BEFORE_MS + 1, 60 * MIN]) {
      const { keep, asked } = setup(left);
      expect(await keep()).toEqual({ token: grant(OLD, left), failed: null });
      expect(asked).toEqual([]);
    }
  });

  it('is refreshed the moment less than 5 minutes are left', async () => {
    const { keep, asked, file } = setup(REFRESH_BEFORE_MS - 1, [grant(FRESH, 65 * MIN)]);
    expect(await keep()).toEqual({ token: grant(FRESH, 65 * MIN), failed: null });
    expect(asked).toEqual([T0]);
    expect(held(file)?.tokens.at(-1)).toEqual(grant(FRESH, 65 * MIN));
  });

  it('is refreshed once its time has come on the clock the caller gives', async () => {
    const { keep, asked, clock } = setup(60 * MIN, [grant(FRESH, 125 * MIN)]);
    expect(await keep()).toEqual({ token: grant(OLD, 60 * MIN), failed: null });
    clock.now = T0 + 55 * MIN;
    expect(await keep()).toEqual({ token: grant(OLD, 60 * MIN), failed: null });
    expect(asked).toEqual([]);
    clock.now = T0 + 55 * MIN + 1;
    expect(await keep()).toEqual({ token: grant(FRESH, 125 * MIN), failed: null });
    expect(asked).toEqual([T0 + 55 * MIN + 1]);
  });
});

describe('a refresh that works', () => {
  it('keeps every token the job had, the fresh one last, so none stops being masked', async () => {
    const { keep, file, clock } = setup(2 * MIN, [grant(FRESH, 62 * MIN), grant(FRESHER, 122 * MIN)]);
    await keep();
    expect(held(file)).toEqual({ runner: 'box-1', page: 'https://omni.example/app', tokens: [grant(OLD, 2 * MIN), grant(FRESH, 62 * MIN)] });
    // An hour later it is due again.
    clock.now = T0 + 58 * MIN;
    expect(await keep()).toEqual({ token: grant(FRESHER, 122 * MIN), failed: null });
    expect(held(file)?.tokens.map((entry) => entry.token)).toEqual([OLD, FRESH, FRESHER]);
  });

  it('keeps the page the session asks, and leaves no lock and no half-written file behind', async () => {
    const { keep, file } = setup(MIN, [grant(FRESH, 61 * MIN)]);
    await keep();
    expect(held(file)?.page).toBe('https://omni.example/app');
    expect(existsSync(`${file}lock`)).toBe(false);
    expect(existsSync(`${file}tmp`)).toBe(false);
  });

  it('is taken once when callers ask together: one token between them, none lost from the file', async () => {
    const { options, asked, file, slept } = setup(MIN, [grant(FRESH, 61 * MIN), grant(FRESHER, 121 * MIN)]);
    const answers = await Promise.all([keepGithubToken(options), keepGithubToken(options), keepGithubToken(options)]);
    expect(asked).toHaveLength(1);
    expect(answers).toEqual([
      { token: grant(FRESH, 61 * MIN), failed: null },
      { token: grant(FRESH, 61 * MIN), failed: null },
      { token: grant(FRESH, 61 * MIN), failed: null },
    ]);
    expect(held(file)?.tokens).toEqual([grant(OLD, MIN), grant(FRESH, 61 * MIN)]);
    expect(slept.length).toBeGreaterThan(0);
    expect(slept.every((ms) => ms === 100)).toBe(true);
  });
});

describe('a refresh that fails', () => {
  it('answers the token the job still holds, and why, while it lives', async () => {
    const { keep, file } = setup(3 * MIN, [new Error(REFUSED)]);
    expect(await keep()).toEqual({ token: grant(OLD, 3 * MIN), failed: REFUSED });
    expect(held(file)?.retry).toEqual({ at: T0 + RETRY_MS, why: REFUSED });
    expect(held(file)?.tokens).toEqual([grant(OLD, 3 * MIN)]);
  });

  it('is tried again every minute, by whoever looks, and not before', async () => {
    const { keep, asked, clock } = setup(10 * MIN - 1, [new Error(REFUSED), new Error(REFUSED), grant(FRESH, 70 * MIN)]);
    clock.now = T0 + 5 * MIN;
    expect((await keep()).failed).toBe(REFUSED);
    for (const wait of [5_000, 30_000, 24_999]) {
      clock.now += wait;
      expect((await keep()).failed).toBe(REFUSED);
    }
    expect(asked).toEqual([T0 + 5 * MIN]);
    clock.now = T0 + 5 * MIN + RETRY_MS;
    expect((await keep()).failed).toBe(REFUSED);
    clock.now += RETRY_MS - 1;
    expect((await keep()).failed).toBe(REFUSED);
    expect(asked).toEqual([T0 + 5 * MIN, T0 + 6 * MIN]);
    clock.now = T0 + 7 * MIN;
    expect(await keep()).toEqual({ token: grant(FRESH, 70 * MIN), failed: null });
    expect(asked).toEqual([T0 + 5 * MIN, T0 + 6 * MIN, T0 + 7 * MIN]);
  });

  it('forgets the wait once a fresh token comes', async () => {
    const { keep, file, clock } = setup(2 * MIN, [new Error(REFUSED), grant(FRESH, 62 * MIN)]);
    await keep();
    expect(held(file)?.retry).toBeDefined();
    clock.now += RETRY_MS;
    await keep();
    expect(held(file)?.retry).toBeUndefined();
    expect(held(file)?.tokens.map((entry) => entry.token)).toEqual([OLD, FRESH]);
  });

  it('is no token once it expired with no fresh one, and says so', async () => {
    const { keep, clock } = setup(3 * MIN, [new Error(REFUSED), new Error(REFUSED), new Error('the app is down')]);
    expect((await keep()).failed).toBe(REFUSED);
    clock.now = T0 + 2 * MIN;
    expect((await keep()).token).toEqual(grant(OLD, 3 * MIN));
    clock.now = T0 + 3 * MIN - 1;
    expect((await keep()).token).toEqual(grant(OLD, 3 * MIN));
    clock.now = T0 + 3 * MIN;
    expect(await keep()).toEqual({ token: null, failed: 'its token expired and no fresh one came (the app is down)' });
  });

  it('is no token while the wait of a failed refresh stands, once it expired', async () => {
    const { keep, asked, clock } = setup(3 * MIN, [new Error(REFUSED)]);
    clock.now = T0 + 3 * MIN - 1;
    expect((await keep()).failed).toBe(REFUSED);
    clock.now += 1;
    expect(await keep()).toEqual({ token: null, failed: `its token expired and no fresh one came (${REFUSED})` });
    expect(asked).toEqual([T0 + 3 * MIN - 1]);
  });

  it('takes a date that does not read for a token with no life left', async () => {
    const { keep } = setup('not a date', [new Error(REFUSED)]);
    expect(await keep()).toEqual({ token: null, failed: `its token expired and no fresh one came (${REFUSED})` });
  });

  it('says the first line of what went wrong, never with a token in it', async () => {
    const { keep, file } = setup(MIN, [new Error(`the app said no to ${OLD}\nsecond line`)]);
    expect((await keep()).failed).toBe('the app said no to ***');
    expect(held(file)?.retry?.why).toBe('the app said no to ***');
  });

  it('cuts a long reason to 200 characters, and says something when the app said nothing', async () => {
    const long = setup(MIN, [new Error('x'.repeat(500))]);
    const cut = (await long.keep()).failed ?? '';
    expect(cut).toHaveLength(200);
    expect(cut.endsWith('…')).toBe(true);
    const exact = setup(MIN, [new Error('y'.repeat(200))]);
    expect((await exact.keep()).failed).toBe('y'.repeat(200));
    const empty = setup(MIN, [new Error('')]);
    expect((await empty.keep()).failed).toBe('the app did not say why');
  });

  it('never throws, whatever the app throws', async () => {
    const { keep } = setup(MIN, [{ thrown: 'a plain string, not an error' }]);
    expect((await keep()).failed).toBe('a plain string, not an error');
  });

  it('answers the token it has when the fresh one cannot be kept on this machine, and never names a folder of it', async () => {
    const { keep, file } = setup(MIN, [grant(FRESH, 61 * MIN)]);
    // A folder where the file is written first: nothing can be kept.
    mkdirSync(`${file}tmp`);
    const kept = await keep();
    expect(kept).toEqual({ token: grant(OLD, MIN), failed: 'the fresh token could not be kept on this machine' });
    expect(JSON.stringify(kept)).not.toContain(dirname(file));
    expect(existsSync(`${file}lock`)).toBe(false);
  });

  it('goes on when the wait of a failed refresh cannot be kept', async () => {
    const { keep, file } = setup(MIN, [new Error(REFUSED)]);
    mkdirSync(`${file}tmp`);
    expect(await keep()).toEqual({ token: grant(OLD, MIN), failed: REFUSED });
    expect(held(file)?.retry).toBeUndefined();
  });
});

describe('a job with no token of this runner', () => {
  it('has none, and the app is not asked', async () => {
    const { keep, asked, file } = setup(MIN);
    rmSync(file);
    expect(await keep()).toEqual({ token: null, failed: 'the job has no token kept on this machine' });
    writeFileSync(file, 'not json');
    expect(await keep()).toEqual({ token: null, failed: 'the job has no token kept on this machine' });
    saveGithubToken(file, 'box-2', grant(OLD, MIN));
    expect(await keep()).toEqual({ token: null, failed: "the token of the job is another runner's" });
    expect(asked).toEqual([]);
    expect(held(file)?.runner).toBe('box-2');
  });
});

describe('the lock of the file', () => {
  it('is waited for, 100 ms at a time, up to 20 s, then the token the job holds is the answer', async () => {
    const { keep, asked, slept, file } = setup(3 * MIN, [grant(FRESH, 63 * MIN)]);
    writeFileSync(`${file}lock`, '');
    expect(await keep()).toEqual({ token: grant(OLD, 3 * MIN), failed: TOO_LONG });
    expect(asked).toEqual([]);
    expect(slept).toEqual(Array.from({ length: 200 }, () => 100));
    // The lock of another is never taken down while it is young.
    expect(existsSync(`${file}lock`)).toBe(true);
  });

  it('leaves no token when the one the job holds expired during the wait', async () => {
    const { keep, clock, file } = setup(10 * MIN);
    writeFileSync(`${file}lock`, '');
    clock.now = T0 + 10 * MIN - 1;
    expect(await keep()).toEqual({ token: null, failed: `its token expired and no fresh one came (${TOO_LONG})` });
  });

  it('is taken over when its holder is gone: older than a minute', async () => {
    const { keep, asked, file, slept } = setup(MIN, [grant(FRESH, 61 * MIN)]);
    writeFileSync(`${file}lock`, '');
    const old = new Date(Date.now() - 61 * 1000);
    utimesSync(`${file}lock`, old, old);
    expect(await keep()).toEqual({ token: grant(FRESH, 61 * MIN), failed: null });
    expect(asked).toHaveLength(1);
    expect(slept).toEqual([]);
    expect(existsSync(`${file}lock`)).toBe(false);
  });

  it('is not taken over at 59 s', async () => {
    const { keep, asked, file } = setup(MIN, [grant(FRESH, 61 * MIN)]);
    writeFileSync(`${file}lock`, '');
    const young = new Date(Date.now() - 59 * 1000);
    utimesSync(`${file}lock`, young, young);
    expect((await keep()).failed).toBe(TOO_LONG);
    expect(asked).toEqual([]);
  });

  it('is waited for, and the fresh token another kept in the meantime is the answer, without asking again', async () => {
    const { options, file, clock } = setup(MIN);
    writeFileSync(`${file}lock`, '');
    const asks: string[] = [];
    const kept = await keepGithubToken({
      ...options,
      fetchToken: (job) => {
        asks.push(job);
        return Promise.reject(new Error('must not be asked'));
      },
      sleep: (ms) => {
        clock.now += ms;
        // Another process finishes its refresh while this one waits, and gives the lock back.
        saveGithubToken(file, 'box-1', grant(FRESH, 61 * MIN));
        rmSync(`${file}lock`);
        return Promise.resolve();
      },
    });
    expect(kept).toEqual({ token: grant(FRESH, 61 * MIN), failed: null });
    expect(asks).toEqual([]);
    expect(held(file)?.tokens.map((entry) => entry.token)).toEqual([OLD, FRESH]);
  });

  it.skipIf(process.getuid?.() === 0)('answers the token the job holds when the folder is read-only and no lock can be made', async () => {
    const { keep, asked, file } = setup(MIN, [grant(FRESH, 61 * MIN)]);
    chmodSync(dirname(file), 0o500);
    try {
      expect(await keep()).toEqual({ token: grant(OLD, MIN), failed: TOO_LONG });
      expect(asked).toEqual([]);
    } finally {
      chmodSync(dirname(file), 0o700);
    }
  });
});
