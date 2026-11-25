import { describe, expect, it } from 'vitest';
import { APP_ERROR_CHARS, appErrorRow, appErrorWriter, maskSecrets, type AppErrorRow } from './app-errors';

// The galaxy's 5xx (PRD omni-loop-34 s3): masked before the write, cut to 500 characters, and a write that fails is one
// log line, never a failure of the route that wrote. Test credentials are built at runtime.

describe('maskSecrets', () => {
  it.each([
    ['a GitHub token', `ghp_${'a'.repeat(36)}`],
    ['a fine-grained GitHub token', `github_pat_${'a'.repeat(40)}`],
    ['an API key', `sk-ant-${'a'.repeat(30)}`],
    ['a Supabase secret', `sb_secret_${'a'.repeat(20)}`],
    ['a JWT', `eyJ${'a'.repeat(10)}.${'b'.repeat(10)}.${'c'.repeat(10)}`],
  ])('masks %s', (_name, secret) => {
    expect(maskSecrets(`failed with ${secret} here`)).toBe('failed with [masked] here');
  });

  it('masks a bearer token and a key=value secret, keeping the name', () => {
    expect(maskSecrets(`Bearer ${'x'.repeat(20)}`)).toBe('Bearer [masked]');
    expect(maskSecrets('password=hunter2hunter2 next')).toBe('password=[masked] next');
  });

  it('leaves plain words as they are', () => {
    expect(maskSecrets('The runners could not answer.')).toBe('The runners could not answer.');
  });
});

describe('appErrorRow', () => {
  it('keeps the route on one line, the status in 5xx and at most 500 characters of message', () => {
    const row = appErrorRow({ workspace: null, route: 'GET /api/x\nmore', status: 503, message: 'm'.repeat(900) });
    expect(row).toMatchObject({ service: 'galaxy', route: 'GET /api/x more', status: 503 });
    expect(row.message).toHaveLength(APP_ERROR_CHARS);
  });
});

describe('appErrorWriter', () => {
  it('writes one masked row', async () => {
    const rows: AppErrorRow[] = [];
    await appErrorWriter({ write: (row) => { rows.push(row); return Promise.resolve(); } }, () => undefined)({ workspace: 'w1', route: 'POST /api/y', status: 500, message: `token=${'t'.repeat(12)}` });
    expect(rows).toEqual([{ workspace_id: 'w1', service: 'galaxy', route: 'POST /api/y', status: 500, message: 'token=[masked]' }]);
  });

  it('logs a write that fails, and never throws', async () => {
    const logs: string[] = [];
    await appErrorWriter({ write: () => Promise.reject(new Error('down')) }, (line) => { logs.push(line); })({ workspace: null, route: 'GET /api/z', status: 500, message: 'x' });
    expect(logs).toEqual(['app errors: the 500 of GET /api/z was not recorded — down']);
  });

  it('writes nothing without a store', async () => {
    await expect(appErrorWriter(null, () => undefined)({ workspace: null, route: 'GET /api/z', status: 500, message: 'x' })).resolves.toBeUndefined();
  });
});
