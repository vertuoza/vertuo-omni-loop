import { describe, expect, it } from 'vitest';
import { brokenRows } from '../data/broken-rows.fake';
import { SavedRepository } from './model';
import { COULD_NOT_SAVE, databaseRepositories, demoRepositoriesPort, GONE, NOT_A_BOARD_MEMBER, NOT_OWNER, PUBLIC_ELSEWHERE, refusalOf } from './store';

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
  workspace_id: 'ws-1', full_name: 'demo-org/nimbus-apps', tracked: true, added_at: '2026-10-08T09:00:00Z', added_by: 'u-1',
  collected_at: null, collected_until: null, collect_error: null, public_ideas: false, phase0: 'pr', fix_when_answered: true, removed_at: null,
};

describe('the database calls', () => {
  it('adds a repository with add_repository(), answering the row it saved', async () => {
    const d = db({ data: STORED });
    expect(await databaseRepositories(d, 'ws-1').add('Demo-Org/nimbus-apps')).toEqual({
      ok: true, repository: { fullName: 'demo-org/nimbus-apps', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, phase0: 'pr', fixWhenAnswered: true, removedAt: null, planProducts: [] },
    });
    expect(d.calls).toEqual([['add_repository', { p_workspace: 'ws-1', p_full_name: 'Demo-Org/nimbus-apps' }]]);
  });

  it('no longer points a repository at a product: its products are changed on each product\'s home (PRD 1364 s11)', () => {
    expect(Object.keys(databaseRepositories(db({}), 'ws-1'))).not.toContain('setProduct');
    expect(Object.keys(demoRepositoriesPort([]))).not.toContain('setProduct');
  });

  it('switches tracking with set_repository_tracked()', async () => {
    const d = db({ data: { ...STORED, tracked: false } });
    expect(await databaseRepositories(d, 'ws-1').setTracked('demo-org/nimbus-apps', false)).toMatchObject({ ok: true, repository: { tracked: false } });
    expect(d.calls).toEqual([['set_repository_tracked', { p_workspace: 'ws-1', p_full_name: 'demo-org/nimbus-apps', p_tracked: false }]]);
  });

  it('turns a repository\'s ideas board public or private with set_repository_public_ideas(), any member\'s to do (PRD 1246 s4)', async () => {
    const d = db({ data: { ...STORED, public_ideas: true } });
    expect(await databaseRepositories(d, 'ws-1').setPublicIdeas('demo-org/nimbus-apps', true)).toMatchObject({ ok: true, repository: { publicIdeas: true } });
    expect(d.calls).toEqual([['set_repository_public_ideas', { p_workspace: 'ws-1', p_full_name: 'demo-org/nimbus-apps', p_public: true }]]);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').setPublicIdeas('a/b', true)).toEqual({ ok: false, message: NOT_A_BOARD_MEMBER });
    expect(await databaseRepositories(db({ error: { code: '23505' } }), 'ws-1').setPublicIdeas('a/b', true)).toEqual({ ok: false, message: PUBLIC_ELSEWHERE });
    expect(await databaseRepositories(db({ error: { code: 'XX000' } }), 'ws-1').setPublicIdeas('a/b', false)).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });

  it('turns a board public and private again in the demo', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false }]);
    expect(await port.setPublicIdeas('acme/widgets', true)).toMatchObject({ ok: true, repository: { publicIdeas: true } });
    expect(await port.setPublicIdeas('acme/widgets', false)).toMatchObject({ ok: true, repository: { publicIdeas: false } });
  });

  it('switches where a repository\'s phase 0 is approved with set_repository_phase0(), the owner\'s only (PRD 1299 s1)', async () => {
    const d = db({ data: { ...STORED, phase0: 'server' } });
    expect(await databaseRepositories(d, 'ws-1').setPhase0('demo-org/nimbus-apps', 'server')).toMatchObject({ ok: true, repository: { phase0: 'server' } });
    expect(d.calls).toEqual([['set_repository_phase0', { p_workspace: 'ws-1', p_full_name: 'demo-org/nimbus-apps', p_phase0: 'server' }]]);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').setPhase0('a/b', 'server')).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseRepositories(db({ error: { code: 'P0002' } }), 'ws-1').setPhase0('a/b', 'pr')).toMatchObject({ ok: false, message: containing('Reload') });
    expect(await databaseRepositories(db({ data: { ...STORED, phase0: 'both' } }), 'ws-1').setPhase0('a/b', 'pr')).toEqual({ ok: false, message: COULD_NOT_SAVE });
  });

  it('switches phase 0 to the server and back in the demo', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false }]);
    expect(await port.setPhase0('acme/widgets', 'server')).toMatchObject({ ok: true, repository: { phase0: 'server' } });
    expect(await port.setPhase0('acme/widgets', 'pr')).toMatchObject({ ok: true, repository: { phase0: 'pr' } });
    expect(await port.setPhase0('acme/nothing', 'server')).toMatchObject({ ok: false });
  });

  it('switches Fix on a runner once answered with set_repository_fix_when_answered(), the owner\'s only (PRD 2270 s3)', async () => {
    const d = db({ data: { ...STORED, fix_when_answered: false } });
    expect(await databaseRepositories(d, 'ws-1').setFixWhenAnswered('demo-org/nimbus-apps', false)).toMatchObject({ ok: true, repository: { fixWhenAnswered: false } });
    expect(d.calls).toEqual([['set_repository_fix_when_answered', { p_workspace: 'ws-1', p_full_name: 'demo-org/nimbus-apps', p_on: false }]]);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').setFixWhenAnswered('a/b', true)).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseRepositories(db({ error: { code: 'P0002' } }), 'ws-1').setFixWhenAnswered('a/b', true)).toMatchObject({ ok: false, message: containing('Reload') });
  });

  it('switches Fix on a runner once answered off and back on in the demo', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false }]);
    expect(await port.setFixWhenAnswered('acme/widgets', false)).toMatchObject({ ok: true, repository: { fixWhenAnswered: false } });
    expect(await port.setFixWhenAnswered('acme/widgets', true)).toMatchObject({ ok: true, repository: { fixWhenAnswered: true } });
    expect(await port.setFixWhenAnswered('acme/nothing', false)).toMatchObject({ ok: false });
  });

  it('removes a repository with remove_repository(), answering the row it removed (PRD 2188 s1)', async () => {
    const d = db({ data: { ...STORED, tracked: false, removed_at: '2026-10-19T10:00:00Z' } });
    expect(await databaseRepositories(d, 'ws-1').remove('demo-org/nimbus-apps')).toMatchObject({
      ok: true, repository: { fullName: 'demo-org/nimbus-apps', tracked: false, removedAt: '2026-10-19T10:00:00Z' },
    });
    expect(d.calls).toEqual([['remove_repository', { p_workspace: 'ws-1', p_full_name: 'demo-org/nimbus-apps' }]]);
  });

  it('answers a remove refused for a member, or for a repository no longer listed, as the page says it (PRD 2188 s1)', async () => {
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1').remove('a/b')).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseRepositories(db({ error: { code: 'P0002' } }), 'ws-1').remove('a/b')).toEqual({ ok: false, message: GONE });
    expect(await databaseRepositories(db(new Error('fetch failed')), 'ws-1').remove('a/b')).toEqual({ ok: false, message: COULD_NOT_SAVE });
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
    expect(await port.add('Acme/Widgets')).toEqual({ ok: true, repository: { fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, phase0: 'pr', fixWhenAnswered: true, removedAt: null } });
    expect(await port.setTracked('acme/widgets', false)).toMatchObject({ ok: true, repository: { tracked: false } });
  });

  it('refuses to switch a repository it does not list', async () => {
    expect(await demoRepositoriesPort([]).setTracked('acme/nothing', false)).toMatchObject({ ok: false });
  });

  it('removes a repository: removed, untracked, its board private, in no product and planned in by none (PRD 2188 s1)', async () => {
    const chips = [{ id: 'p-1', name: 'Widgets' }];
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: chips, publicIdeas: true, planProducts: chips }]);
    const removed = await port.remove('Acme/Widgets');
    expect(removed).toMatchObject({ ok: true, repository: { fullName: 'acme/widgets', tracked: false, publicIdeas: false, products: [], planProducts: [] } });
    expect(removed.ok && typeof removed.repository.removedAt).toBe('string');
    expect(await port.remove('acme/widgets')).toEqual(removed);
    expect(await port.remove('acme/nothing')).toEqual({ ok: false, message: GONE });
  });

  it('adds a removed repository back, tracked (PRD 2188 s1)', async () => {
    const port = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false }]);
    await port.remove('acme/widgets');
    expect(await port.add('acme/widgets')).toMatchObject({ ok: true, repository: { fullName: 'acme/widgets', tracked: true, removedAt: null } });
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

describe('the Runner skills calls (PRD 2313 s3)', () => {
  const READ = { skills: [{ name: 'validate-prd', description: null, allowed: { by: 'ada', at: '2026-10-21T09:30:00Z' }, gone: false }], branch: 'main', error: null };
  const answering = (status: number, body: unknown) => {
    const urls: string[] = [];
    return { urls, fetch: (url: string) => { urls.push(url); return Promise.resolve({ ok: status < 400, json: () => Promise.resolve(body) }); } };
  };

  it('reads a repository\'s skills from the route', async () => {
    const f = answering(200, READ);
    expect(await databaseRepositories(db({}), 'ws-1', f.fetch).skills('acme/widgets')).toEqual(READ);
    expect(f.urls).toEqual(['/api/repositories/skills?repo=acme%2Fwidgets']);
  });

  it('says why the route refused, or that its answer was out of shape, as a read that failed', async () => {
    expect(await databaseRepositories(db({}), 'ws-1', answering(403, { error: 'Not a member.' }).fetch).skills('a/b')).toEqual({ skills: [], branch: null, error: 'Not a member.' });
    expect(await databaseRepositories(db({}), 'ws-1', answering(200, { skills: 3 }).fetch).skills('a/b')).toMatchObject({ error: 'try again in a moment.' });
    const down = () => Promise.reject(new Error('offline'));
    expect(await databaseRepositories(db({}), 'ws-1', down).skills('a/b')).toMatchObject({ error: 'try again in a moment.' });
  });

  it('allows a skill with set_repository_runner_skill(), then reads the block again', async () => {
    const d = db({});
    const f = answering(200, READ);
    expect(await databaseRepositories(d, 'ws-1', f.fetch).setSkill('acme/widgets', 'validate-prd', true)).toEqual({ ok: true, read: READ });
    expect(d.calls).toEqual([['set_repository_runner_skill', { p_workspace: 'ws-1', p_full_name: 'acme/widgets', p_skill: 'validate-prd', p_allowed: true }]]);
    expect(f.urls).toHaveLength(1);
  });

  it('refuses a member with the owner-only line, and carries a malformed name\'s own words', async () => {
    const f = answering(200, READ);
    expect(await databaseRepositories(db({ error: { code: '42501' } }), 'ws-1', f.fetch).setSkill('a/b', 'x', true)).toEqual({ ok: false, message: NOT_OWNER });
    expect(await databaseRepositories(db({ error: { code: '22023', message: 'Skill: a skill\'s name.' } }), 'ws-1', f.fetch).setSkill('a/b', 'X', true)).toEqual({ ok: false, message: 'Skill: a skill\'s name.' });
    expect(await databaseRepositories(db(new Error('boom')), 'ws-1', f.fetch).setSkill('a/b', 'x', true)).toEqual({ ok: false, message: COULD_NOT_SAVE });
    expect(f.urls).toEqual([]);
  });

  it('keeps the same in the demo: two skills, allowed by the switch, taken back by it', async () => {
    const demo = demoRepositoriesPort([{ fullName: 'acme/widgets', tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false }]);
    expect((await demo.skills('acme/widgets')).skills.map((s) => [s.name, s.allowed !== null])).toEqual([['validate-prd', false], ['release-notes', false]]);
    const on = await demo.setSkill('acme/widgets', 'validate-prd', true);
    expect(on.ok && on.read.skills[0]?.allowed?.by).toBe('ada');
    const off = await demo.setSkill('acme/widgets', 'validate-prd', false);
    expect(off.ok && off.read.skills[0]?.allowed).toBeNull();
    expect(await demo.setSkill('other/none', 'validate-prd', true)).toEqual({ ok: false, message: GONE });
  });
});
