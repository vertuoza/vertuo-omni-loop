import { describe, expect, it } from 'vitest';
import { brokenRows } from '../data/broken-rows.fake';
import { SavedRepository } from './model';
import { COULD_NOT_SAVE, databaseRepositories, demoRepositoriesPort, NOT_A_BOARD_MEMBER, NOT_MEMBER, NOT_OWNER, PUBLIC_ELSEWHERE, refusalOf } from './store';

const containing = (text: string): unknown => expect.stringContaining(text);

// Settings → Repositories's two calls (PRD 612 s1): add_repository() and set_repository_tracked(),
// as the signed-in person, each answering the row it saved or a refusal the page shows; and the demo,
// which keeps the same rules in memory.

function db(answer: { data?: unknown; error?: unknown } | Error) {
  const calls: [string, unknown][] = [];
  return {
    calls,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push([fn, args]);
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null });
    },
  };
}

const STORED = {
  workspace_id: 'ws-1', full_name: 'vertuoza/vertuo-apps', tracked: true, added_at: '2026-10-08T09:00:00Z', added_by: 'u-1',
  collected_at: null, collected_until: null, collect_error: null, product_id: null, public_ideas: false, phase0: 'pr',
};

describe('the database calls', () => {
  it('adds a repository with add_repository(), answering the row it saved', async () => {
    const d = db({ data: STORED });
    expect(await databaseRepositories(d, 'ws-1').add('Vertuoza/vertuo-apps')).toEqual({
      ok: true, repository: { fullName: 'vertuoza/vertuo-apps', tracked: true, collectedAt: null, collectError: null, product: null, publicIdeas: false, phase0: 'pr' },
    });
    expect(d.calls).toEqual([['add_repository', { p_workspace: 'ws-1', p_full_name: 'Vertuoza/vertuo-apps' }]]);
  });

  it('points a repository at a product with repository_set_product(), any member\'s to do (PRD 748 s4)', async () => {
    const d = db({ data: { ...STORED, product_id: 'p-2' } });
    expect(await databaseRepositories(d, 'ws-1').setProduct('vertuoza/vertuo-apps', 'p-2')).toMatchObject({ ok: true, repository: { product: 'p-2' } });
    expect(d.calls).toEqual([['repository_set_product', { p_workspace: 'ws-1', p_full_name: 'vertuoza/vertuo-apps', p_product: 'p-2' }]]);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').setProduct('a/b', 'p-2')).toEqual({ ok: false, message: NOT_MEMBER });
    expect(await databaseRepositories(db({ error: { code: 'P0002' } }), 'ws-1').setProduct('a/b', 'p-2')).toMatchObject({ ok: false, message: containing('Reload') });
  });

  it('points a repository at a product in the demo', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, product: 'p-1', publicIdeas: false }]);
    expect(await port.setProduct('acme/widgets', 'p-2')).toMatchObject({ ok: true, repository: { product: 'p-2' } });
    expect(await port.setProduct('acme/nothing', 'p-2')).toMatchObject({ ok: false });
  });

  it('switches tracking with set_repository_tracked()', async () => {
    const d = db({ data: { ...STORED, tracked: false } });
    expect(await databaseRepositories(d, 'ws-1').setTracked('vertuoza/vertuo-apps', false)).toMatchObject({ ok: true, repository: { tracked: false } });
    expect(d.calls).toEqual([['set_repository_tracked', { p_workspace: 'ws-1', p_full_name: 'vertuoza/vertuo-apps', p_tracked: false }]]);
  });

  it('turns a repository\'s ideas board public or private with set_repository_public_ideas(), any member\'s to do (PRD 1246 s4)', async () => {
    const d = db({ data: { ...STORED, public_ideas: true } });
    expect(await databaseRepositories(d, 'ws-1').setPublicIdeas('vertuoza/vertuo-apps', true)).toMatchObject({ ok: true, repository: { publicIdeas: true } });
    expect(d.calls).toEqual([['set_repository_public_ideas', { p_workspace: 'ws-1', p_full_name: 'vertuoza/vertuo-apps', p_public: true }]]);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').setPublicIdeas('a/b', true)).toEqual({ ok: false, message: NOT_A_BOARD_MEMBER });
    expect(await databaseRepositories(db({ error: { code: '23505' } }), 'ws-1').setPublicIdeas('a/b', true)).toEqual({ ok: false, message: PUBLIC_ELSEWHERE });
    expect(await databaseRepositories(db({ error: { code: 'XX000' } }), 'ws-1').setPublicIdeas('a/b', false)).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });

  it('turns a board public and private again in the demo', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, product: null, publicIdeas: false }]);
    expect(await port.setPublicIdeas('acme/widgets', true)).toMatchObject({ ok: true, repository: { publicIdeas: true } });
    expect(await port.setPublicIdeas('acme/widgets', false)).toMatchObject({ ok: true, repository: { publicIdeas: false } });
  });

  it('switches where a repository\'s phase 0 is approved with set_repository_phase0(), the owner\'s only (PRD 1299 s1)', async () => {
    const d = db({ data: { ...STORED, phase0: 'server' } });
    expect(await databaseRepositories(d, 'ws-1').setPhase0('vertuoza/vertuo-apps', 'server')).toMatchObject({ ok: true, repository: { phase0: 'server' } });
    expect(d.calls).toEqual([['set_repository_phase0', { p_workspace: 'ws-1', p_full_name: 'vertuoza/vertuo-apps', p_phase0: 'server' }]]);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').setPhase0('a/b', 'server')).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseRepositories(db({ error: { code: 'P0002' } }), 'ws-1').setPhase0('a/b', 'pr')).toMatchObject({ ok: false, message: containing('Reload') });
    expect(await databaseRepositories(db({ data: { ...STORED, phase0: 'both' } }), 'ws-1').setPhase0('a/b', 'pr')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });

  it('switches phase 0 to the server and back in the demo', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, product: null, publicIdeas: false }]);
    expect(await port.setPhase0('acme/widgets', 'server')).toMatchObject({ ok: true, repository: { phase0: 'server' } });
    expect(await port.setPhase0('acme/widgets', 'pr')).toMatchObject({ ok: true, repository: { phase0: 'pr' } });
    expect(await port.setPhase0('acme/nothing', 'server')).toMatchObject({ ok: false });
  });

  it('answers a refusal for a non-owner, an error, nothing, or a failed call', async () => {
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').add('a/b')).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseRepositories(db({ error: { code: 'XX000' } }), 'ws-1').add('a/b')).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await databaseRepositories(db({}), 'ws-1').setTracked('a/b', true)).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(await databaseRepositories(db(new Error('fetch failed')), 'ws-1').add('a/b')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});

describe('a refusal', () => {
  it('names the owner for 42501, and asks to try again otherwise', () => {
    expect(refusalOf({ code: '42501' })).toBe(NOT_OWNER);
    expect(refusalOf(null)).toBe(COULD_NOT_SAVE);
  });
});

describe('the demo', () => {
  it('adds a repository tracked, in lower case, and switches it', async () => {
    const port = demoRepositoriesPort([]);
    expect(await port.add('Acme/Widgets')).toEqual({ ok: true, repository: { fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, product: null, publicIdeas: false, phase0: 'pr' } });
    expect(await port.setTracked('acme/widgets', false)).toMatchObject({ ok: true, repository: { tracked: false } });
  });

  it('refuses to switch a repository it does not list', async () => {
    expect(await demoRepositoriesPort([]).setTracked('acme/nothing', false)).toMatchObject({ ok: false });
  });
});

describe('the saved row\'s schema (PRD 1030)', () => {
  it('parses the row the functions answer, and refuses a column missing, of the wrong type or null where none is allowed', () => {
    expect(SavedRepository.parse(STORED)).toEqual(STORED);
    for (const [how, row] of brokenRows(STORED, { missing: 'tracked', wrongType: ['tracked', 'yes'], notNull: 'full_name' })) {
      expect(SavedRepository.safeParse(row).success, how).toBe(false);
    }
  });

  it('answers a saved row that does not parse as a save that failed', async () => {
    expect(await databaseRepositories(db({ data: { ...STORED, tracked: 'yes' } }), 'ws-1').add('a/b')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });
});
