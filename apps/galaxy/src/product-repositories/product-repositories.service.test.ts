import { describe, expect, it } from 'vitest';
import { productRepositoriesService } from './product-repositories.service';
import type { LinkWritten, ProductRepositoriesRepository, StoredLinkRow, StoredProductRow } from './product-repositories.repository';

// The product links' rules for the kit (PRD 1364, s5) on a fake store that keeps its links as the
// database would: an import adds the links that are missing, changes the ones that differ and leaves
// the rest, each new link first with nothing consumed, so a second run writes nothing; and a
// repository's products, by name.

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const ACME = 'w-acme';
const MOBILE: StoredProductRow = { id: 'p-mobile', workspace_id: ACME, name: 'Mobile' };
const ESTIMATES: StoredProductRow = { id: 'p-estimates', workspace_id: ACME, name: 'Estimates' };
const API: StoredLinkRow = { repository: 'acme/api', role: 'api', knowledge: 'own', read_at: null, read_only: false, consumes: [] };

const target = (over: Partial<{ repo: string; role: string; knowledge: 'own' | 'imported' | 'none'; readAt: string | null; readOnly: boolean; consumes: string[] }> = {}) => ({
  repo: 'acme/api', role: 'api', knowledge: 'own' as const, readAt: null, readOnly: false, consumes: [], ...over,
});

/** A store over `links` (product id → its links), recording each write; `refuse` refuses the write of that repository. */
function store(links: Record<string, StoredLinkRow[]>, { refuse }: { refuse?: { repository: string; code: string; message: string } } = {}) {
  const writes: string[] = [];
  const fake: ProductRepositoriesRepository = {
    workspacesListing: (repo) => Promise.resolve(['acme/plan', 'acme/api', 'acme/app'].includes(repo) ? [ACME] : []),
    products: () => Promise.resolve([MOBILE, ESTIMATES]),
    links: (product) => Promise.resolve([...(links[product] ?? [])]),
    productsLinking: (repo) => Promise.resolve(Object.entries(links).filter(([, rows]) => rows.some((row) => row.repository === repo)).map(([id]) => id)),
    link: (product, link): Promise<LinkWritten> => {
      if (refuse?.repository === link.repository) return Promise.resolve({ ok: false, code: refuse.code, message: refuse.message });
      writes.push(`${link.repository} ${link.role ?? '-'} ${link.knowledge} [${link.consumes.join(',')}]`);
      const kept = (links[product] ??= []);
      const at = kept.findIndex((row) => row.repository === link.repository);
      if (at === -1) kept.push(link);
      else kept[at] = link;
      return Promise.resolve({ ok: true });
    },
  };
  return { service: productRepositoriesService(fake), writes, links };
}

describe('importTargets', () => {
  const request = {
    repo: 'acme/plan',
    product: 'mobile',
    targets: [
      target({ repo: 'Acme/App', role: 'mobile', consumes: ['acme/api'] }),
      target({ repo: 'acme/api', knowledge: 'imported', readAt: SHA }),
    ],
  };

  it('adds each missing link, the new ones first with nothing consumed, then those that consume', async () => {
    const s = store({});
    expect(await s.service.importTargets(request)).toEqual({
      kind: 'ok',
      reply: { product: { name: 'Mobile' }, added: ['acme/app', 'acme/api'], changed: [], unchanged: [] },
    });
    expect(s.writes).toEqual(['acme/app mobile own []', 'acme/api api imported []', 'acme/app mobile own [acme/api]']);
  });

  it('changes a link that differs, leaves one that is the same, and writes nothing on a second run', async () => {
    const s = store({ 'p-mobile': [API, { ...API, repository: 'acme/app', role: 'mobile', consumes: ['acme/api'] }] });
    expect(await s.service.importTargets(request)).toEqual({
      kind: 'ok',
      reply: { product: { name: 'Mobile' }, added: [], changed: ['acme/api'], unchanged: ['acme/app'] },
    });
    expect(s.writes).toEqual(['acme/api api imported []']);
    expect(await s.service.importTargets(request)).toMatchObject({ reply: { added: [], changed: [], unchanged: ['acme/app', 'acme/api'] } });
    expect(s.writes).toHaveLength(1);
  });

  it('reads consumes in any order and case as the same link', async () => {
    const s = store({ 'p-mobile': [{ ...API, repository: 'acme/app', consumes: ['acme/api', 'acme/docs'] }] });
    const same = { ...request, targets: [target({ repo: 'acme/app', consumes: ['Acme/Docs', 'acme/api', 'acme/api'] })] };
    expect(await s.service.importTargets(same)).toMatchObject({ reply: { unchanged: ['acme/app'] } });
    expect(s.writes).toEqual([]);
  });

  it("stops at the database's refusal, with its code and words", async () => {
    const s = store({}, { refuse: { repository: 'acme/api', code: '42501', message: 'Only an owner of the workspace changes the repositories of Mobile.' } });
    expect(await s.service.importTargets(request)).toEqual({
      kind: 'refused',
      code: '42501',
      message: 'Only an owner of the workspace changes the repositories of Mobile.',
    });
    expect(s.writes).toEqual(['acme/app mobile own []']);
  });

  it('answers why no product answers the name, writing nothing', async () => {
    const s = store({});
    expect(await s.service.importTargets({ ...request, repo: 'acme/other' })).toEqual({ kind: 'unlisted' });
    expect(await s.service.importTargets({ ...request, product: 'Web' })).toEqual({ kind: 'no-product' });
    expect(s.writes).toEqual([]);
  });
});

describe('productsOf', () => {
  it("names the products linking the repository, by name, and none for a repository in none or no workspace's", async () => {
    const s = store({ 'p-mobile': [API], 'p-estimates': [API, { ...API, repository: 'acme/app' }] });
    expect(await s.service.productsOf('Acme/API')).toEqual({ products: [{ name: 'Estimates' }, { name: 'Mobile' }] });
    expect(await s.service.productsOf('acme/app')).toEqual({ products: [{ name: 'Estimates' }] });
    expect(await s.service.productsOf('acme/plan')).toEqual({ products: [] });
    expect(await s.service.productsOf('acme/other')).toEqual({ products: [] });
  });
});
