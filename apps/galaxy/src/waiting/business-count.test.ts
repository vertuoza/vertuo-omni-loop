import { describe, expect, it, vi } from 'vitest';
import { waitingBusiness, type BusinessCountDeps } from './business-count';

// GET /api/waiting/business (PRD 774, s5): for any signed-in member, how many things wait to be
// checked in their workspace's business (business_to_check()); 0 with no workspace; 401 signed out.

type Over = { user?: string | null; workspace?: string | null; count?: number; error?: string; fail?: boolean };

function deps(over: Over = {}) {
  const rpc = vi.fn(async (_fn: string, _args: Record<string, unknown>) =>
    (over.error ? { data: null, error: { message: over.error } } : { data: over.count ?? 0, error: null }));
  const db = { auth: { getUser: async () => ({ data: { user: over.user === null ? null : { id: over.user ?? 'u1' } } }) }, rpc };
  const workspace = vi.fn(async () => (over.workspace === null ? null : { id: over.workspace ?? 'w1' }));
  const d: BusinessCountDeps = {
    db: async () => {
      if (over.fail) throw new Error('no database');
      return db;
    },
    workspace,
  };
  return { d, rpc, workspace };
}

const body = async (r: Response) => ({ status: r.status, json: await r.json() });

describe('the business count route', () => {
  it('gives the member\'s count of things to check, read for their workspace', async () => {
    const { d, rpc, workspace } = deps({ count: 4 });
    expect(await body(await waitingBusiness(d))).toEqual({ status: 200, json: { count: 4 } });
    expect(workspace).toHaveBeenCalledWith(expect.anything(), 'u1');
    expect(rpc).toHaveBeenCalledWith('business_to_check', { p_workspace: 'w1' });
  });

  it('gives 0 when there is nothing to check, and with no workspace, without asking', async () => {
    expect(await body(await waitingBusiness(deps({ count: 0 }).d))).toEqual({ status: 200, json: { count: 0 } });
    const none = deps({ workspace: null });
    expect(await body(await waitingBusiness(none.d))).toEqual({ status: 200, json: { count: 0 } });
    expect(none.rpc).not.toHaveBeenCalled();
  });

  it('refuses a person signed out, or with no database', async () => {
    expect((await waitingBusiness(deps({ user: null }).d)).status).toBe(401);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await waitingBusiness(deps({ fail: true }).d)).status).toBe(401);
    err.mockRestore();
  });

  it('answers 500 when the count cannot be read', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await body(await waitingBusiness(deps({ error: 'boom' }).d))).toEqual({ status: 500, json: { error: 'The business could not be read.' } });
    err.mockRestore();
  });

  it('is never cached', async () => {
    expect((await waitingBusiness(deps().d)).headers.get('cache-control')).toBe('no-store');
  });
});
