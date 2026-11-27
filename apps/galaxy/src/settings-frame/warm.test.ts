import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { viewerOf } = await import('../data/viewer');
const { warmSettingsReads } = await import('./warm');
type Deps = Parameters<typeof viewerOf>[0];

// The settings layout and a page share one session read and one workspace read per request
// (omni-loop-29 s1). Counted on a fake client, never on Supabase; a per-request memo stands in for
// React's cache(), as in src/data/viewer.test.ts.

const claims = { sub: 'u-ada', email: 'ada@example.com', app_metadata: {}, user_metadata: {} };

function fake() {
  const calls = { getClaims: 0, workspaces: 0 };
  const db = {
    auth: { getClaims: () => { calls.getClaims += 1; return Promise.resolve({ data: { claims }, error: null }); } },
    from: () => {
      calls.workspaces += 1;
      return { select: () => ({ eq: () => Promise.resolve({ data: [{ joined_at: '2026-09-01T00:00:00Z', workspace: { id: 'w-1', slug: 'acme', name: 'Acme', theme: {} } }], error: null }) }) };
    },
  };
  const deps = {
    mode: () => 'live', env: () => ({ url: 'https://db.example', key: 'anon' }), client: () => Promise.resolve(db),
    questions: () => Promise.resolve([]), now: () => 0,
  } as unknown as Deps;
  const request = () => {
    let kept: unknown;
    let has = false;
    return viewerOf(deps, <T>(read: () => T) => () => { if (!has) { kept = read(); has = true; } return kept as T; });
  };
  return { calls, request };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the settings layout\'s shared reads (omni-loop-29 s1)', () => {
  it('AC-1: counts one session read and one workspace read across the layout and a page', async () => {
    const { calls, request } = fake();
    const viewer = request();
    warmSettingsReads(viewer);
    const seen = await viewer();
    if (seen.kind !== 'signed-in') throw new Error('expected a signed-in viewer');
    const workspace = await seen.workspace();
    await settle();
    expect(workspace?.name).toBe('Acme');
    expect(calls).toEqual({ getClaims: 1, workspaces: 1 });
  });

  it('AC-1: a second page asking again still sees one read of each', async () => {
    const { calls, request } = fake();
    const viewer = request();
    warmSettingsReads(viewer);
    for (let page = 0; page < 2; page += 1) {
      const seen = await viewer();
      if (seen.kind === 'signed-in') await seen.workspace();
    }
    expect(calls).toEqual({ getClaims: 1, workspaces: 1 });
  });

  it('AC-2: returns at once, before the session read finishes', () => {
    const pending = vi.fn(() => new Promise<never>(() => undefined));
    warmSettingsReads(pending);
    expect(pending).toHaveBeenCalledOnce();
  });

  it('stays quiet when a read fails: the page that awaits it shows the failure', async () => {
    const failing = () => Promise.reject(new Error('down'));
    expect(() => { warmSettingsReads(failing); }).not.toThrow();
    await settle();
  });
});
