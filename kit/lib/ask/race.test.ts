import { describe, expect, it } from 'vitest';
import { firstOf } from './race.ts';
import type { Contender } from './race.ts';

/** A contender settled by hand, which counts how often it is closed; closing it fails its result, as
 * closing a listener or a device request does. */
function contender<T>() {
  let settle: { resolve: (value: T) => void; reject: (error: unknown) => void } = { resolve: () => {}, reject: () => {} };
  const result = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  const state = { closed: 0 };
  const made: Contender<T> & { resolve: (value: T) => void; reject: (error: unknown) => void; state: typeof state } = {
    result,
    close: () => {
      state.closed += 1;
      settle.reject(new Error('closed'));
      return Promise.resolve();
    },
    resolve: (value) => { settle.resolve(value); },
    reject: (error) => { settle.reject(error); },
    state,
  };
  return made;
}

/** Lets every settled promise run its handlers. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('firstOf', () => {
  it('gives what the first to come back brings, and closes the other before it does', async () => {
    const loopback = contender<string>();
    const device = contender<string>();
    const race = firstOf([loopback, device]);
    device.resolve('from-device');
    expect(await race).toBe('from-device');
    expect(loopback.state.closed).toBe(1);
    expect(device.state.closed).toBe(0);
  });

  it('works the other way round, and ignores the one that comes back later', async () => {
    const loopback = contender<string>();
    const device = contender<string>();
    const race = firstOf([loopback, device]);
    loopback.resolve('from-loopback');
    device.resolve('late');
    expect(await race).toBe('from-loopback');
    expect(device.state.closed).toBe(1);
    expect(loopback.state.closed).toBe(0);
  });

  it('keeps waiting on the other when one fails, and takes what it brings', async () => {
    const loopback = contender<string>();
    const device = contender<string>();
    const race = firstOf([loopback, device]);
    device.reject(new Error('unreachable'));
    await tick();
    loopback.resolve('from-loopback');
    expect(await race).toBe('from-loopback');
    expect(device.state.closed).toBe(0);
  });

  it('fails with the last failure once every contender has failed, closing none', async () => {
    const loopback = contender<string>();
    const device = contender<string>();
    const race = firstOf([loopback, device]);
    loopback.reject(new Error('timed out'));
    await tick();
    device.reject(new Error('expired'));
    await expect(race).rejects.toThrow('expired');
    expect(loopback.state.closed + device.state.closed).toBe(0);
  });

  it('with one contender is that contender', async () => {
    const only = contender<number>();
    const race = firstOf([only]);
    only.resolve(7);
    expect(await race).toBe(7);
    const failing = contender<number>();
    const failed = firstOf([failing]);
    failing.reject(new Error('no'));
    await expect(failed).rejects.toThrow('no');
  });

  it('refuses an empty race', async () => {
    await expect(firstOf([])).rejects.toThrow(/no contender/);
  });
});
