import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EnvError, envGroup, envReader, groupVariables, requireGroup, variablesOf, type EnvSource } from './group.ts';

const PAIR = envGroup({
  label: 'the store',
  schema: z.object({ url: z.url(), key: z.string(), model: z.string().optional() }),
  variables: { url: ['STORE_URL', 'PUBLIC_STORE_URL'], key: 'STORE_KEY', model: 'STORE_MODEL' },
});
const APP = envGroup({
  label: 'the App',
  schema: z.object({ id: z.string().regex(/^\d+$/, 'a number'), secret: z.string() }),
  variables: { id: 'APP_ID', secret: 'APP_SECRET' },
  required: 'production',
});

const SECRET = 'sk-fake-secret-0123456789';

/** The group read alone from `source`, or the error it threw. */
function read(source: EnvSource, { production = false } = {}) {
  const reader = envReader(source, { production });
  const pair = reader.group(PAIR);
  const app = reader.group(APP);
  try {
    reader.done();
    return { pair, app, error: null };
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    return { pair, app, error };
  }
}

describe('a group', () => {
  it('comes back complete and typed when its variables are set', () => {
    expect(read({ STORE_URL: 'https://store.test', STORE_KEY: SECRET }).pair).toEqual({ url: 'https://store.test', key: SECRET });
    expect(read({ STORE_URL: 'https://store.test', STORE_KEY: 'k', STORE_MODEL: 'm' }).pair).toEqual({ url: 'https://store.test', key: 'k', model: 'm' });
  });

  it('reads a fallback variable when the first is unset or empty', () => {
    expect(read({ PUBLIC_STORE_URL: 'https://public.test', STORE_KEY: 'k' }).pair?.url).toBe('https://public.test');
    expect(read({ STORE_URL: '', PUBLIC_STORE_URL: 'https://public.test', STORE_KEY: 'k' }).pair?.url).toBe('https://public.test');
    expect(read({ STORE_URL: 'https://first.test', PUBLIC_STORE_URL: 'https://public.test', STORE_KEY: 'k' }).pair?.url).toBe('https://first.test');
  });

  it('is null, with no problem, when none of its variables is set, empty strings included', () => {
    expect(read({})).toEqual({ pair: null, app: null, error: null });
    expect(read({ STORE_URL: '', STORE_KEY: '' })).toEqual({ pair: null, app: null, error: null });
  });

  it('is a problem naming every variable when half set', () => {
    const { pair, error } = read({ STORE_URL: 'https://store.test' });
    expect(pair).toBeNull();
    expect(error?.problems).toEqual([{
      variables: ['STORE_URL (or PUBLIC_STORE_URL)', 'STORE_KEY'],
      reason: 'STORE_KEY is not set while STORE_URL (or PUBLIC_STORE_URL) is (the store: set all of them, or none)',
    }]);
  });

  it('counts an optional member alone as half set: the feature is not off by accident', () => {
    expect(read({ STORE_MODEL: 'm' }).error?.problems[0]?.variables).toEqual(['STORE_MODEL', 'STORE_URL (or PUBLIC_STORE_URL)', 'STORE_KEY']);
  });

  it('is a problem naming the variable when a value is malformed', () => {
    const { error } = read({ STORE_URL: SECRET, STORE_KEY: 'k' });
    expect(error?.problems).toEqual([{ variables: ['STORE_URL (or PUBLIC_STORE_URL)'], reason: 'STORE_URL (or PUBLIC_STORE_URL) is not valid: Invalid URL' }]);
  });

  it('is required in production only when marked so', () => {
    expect(read({}, { production: false }).error).toBeNull();
    expect(read({}, { production: true }).error?.problems).toEqual([{
      variables: ['APP_ID', 'APP_SECRET'],
      reason: 'APP_ID and APP_SECRET must be set in production (the App)',
    }]);
    expect(read({ APP_ID: '12', APP_SECRET: 's' }, { production: true }).app).toEqual({ id: '12', secret: 's' });
  });

  it('names its variables', () => {
    expect(groupVariables(PAIR)).toEqual(['STORE_URL (or PUBLIC_STORE_URL)', 'STORE_KEY', 'STORE_MODEL']);
  });

  it('lists every variable of several groups once, fallbacks included, for the docs', () => {
    expect(variablesOf([PAIR, APP, PAIR])).toEqual(['STORE_URL', 'PUBLIC_STORE_URL', 'STORE_KEY', 'STORE_MODEL', 'APP_ID', 'APP_SECRET']);
  });
});

describe('the error', () => {
  it('carries every problem of one read at once, in one message', () => {
    const { error } = read({ STORE_KEY: 'k', APP_ID: 'twelve', APP_SECRET: 's' });
    expect(error).toBeInstanceOf(EnvError);
    expect(error?.name).toBe('EnvError');
    expect(error?.problems.map((problem) => problem.variables)).toEqual([['STORE_KEY', 'STORE_URL (or PUBLIC_STORE_URL)'], ['APP_ID']]);
    expect(error?.message).toBe(
      'environment: STORE_URL (or PUBLIC_STORE_URL) is not set while STORE_KEY is (the store: set all of them, or none); APP_ID is not valid: a number',
    );
  });

  it('never holds a value, however the variables are wrong', () => {
    const sources: EnvSource[] = [
      { STORE_URL: SECRET, STORE_KEY: SECRET },
      { STORE_KEY: SECRET },
      { STORE_MODEL: SECRET },
      { APP_ID: SECRET, APP_SECRET: SECRET },
      { APP_SECRET: SECRET },
    ];
    for (const source of sources) {
      const { error } = read(source, { production: true });
      expect(error).not.toBeNull();
      expect(JSON.stringify({ message: error?.message, problems: error?.problems, stack: error?.stack })).not.toContain(SECRET);
    }
  });
});

describe('requireGroup', () => {
  it('gives the group back when it is set', () => {
    expect(requireGroup({ url: 'https://store.test', key: 'k' }, PAIR, 'the import writes the store')).toEqual({ url: 'https://store.test', key: 'k' });
  });

  it('throws an EnvError naming its required variables and what needs them when it is null', () => {
    expect(() => requireGroup(null, PAIR, 'the import writes the store')).toThrow(
      new EnvError([{ variables: ['STORE_URL (or PUBLIC_STORE_URL)', 'STORE_KEY'], reason: 'STORE_URL (or PUBLIC_STORE_URL) and STORE_KEY are not set: the import writes the store' }]),
    );
  });
});
