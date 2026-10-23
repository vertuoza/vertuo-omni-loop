import { describe, expect, it } from 'vitest';
import { demoRepositories } from './repositories-demo';
import {
  noPackLine, ownersLine, readPacks, readRepositories, repositoriesSection, shortSha, type PackRead, type RepositoriesInput, type RepositoryPack,
} from './repositories-section';

// The Repositories section's model (PRD 2419 s1) over fixture knowledge packs: each repository of the
// product, each page and record marked with its level, the repository that level is and its owner, and
// a repository with no pack.

const form = (id: string, state = 'filled') =>
  `---\nform: ${id}\nform-version: 1\nstate: ${state}\npoints-to: null\nevidence: null\ninvaded: null\n---\n\n# ${id} here\n\n## One\n<!-- slot: one · required -->\nText.\n`;
const file = (path: string, content: string) => ({ path, content });
const pack = (sha: string, files: { path: string; content: string }[]): RepositoryPack => ({ sha: sha.repeat(40).slice(0, 40), committedAt: '2026-11-02T09:00:00Z', files });
const config = (owners: string) => file('.omni-loop/config.yml', `kit: 1\nlaws:\n  owners: [${owners}]\n`);
const PLAYBOOK = '.omni-loop/knowledge/playbook';

const API = pack('a', [config('anna'), file(`${PLAYBOOK}/testing.md`, form('testing')), file('.omni-loop/knowledge/adr/0001-own.md', '# Own record\n')]);
const PLAN = pack('b', [config('pat'), file(`${PLAYBOOK}/setup.md`, form('setup')), file('.omni-loop/knowledge/adr/0002-plan.md', '# Plan record\n')]);

const input = (over: Partial<RepositoriesInput> = {}): RepositoriesInput => ({
  product: 'p-1',
  repositories: ['acme/web', 'acme/api'],
  plan: 'acme/plan',
  packs: new Map([['acme/api', API], ['acme/plan', PLAN]]),
  settings: null,
  ...over,
});

describe('the Repositories section', () => {
  const data = repositoriesSection(input());
  const api = data.repositories.find((r) => r.repository === 'acme/api');
  if (!api?.pack) throw new Error('acme/api has a pack');
  const page = (form: string) => api.pages.find((p) => p.form === form);

  it('lists each repository of the product by name', () => {
    expect(data.repositories.map((r) => r.repository)).toEqual(['acme/api', 'acme/web']);
  });

  it('reads a repository’s pack at its commit', () => {
    expect(api.pack).toEqual({ sha: API.sha, committedAt: '2026-11-02T09:00:00Z' });
    expect(shortSha(api.pack.sha)).toBe('aaaaaaa');
  });

  it('marks a page the repository holds as the repository’s, owned by its law owners', () => {
    expect(page('testing')).toMatchObject({ level: 'repo', from: 'acme/api', owners: ['anna'], title: 'testing here' });
  });

  it('marks a page only the plan repository holds as the plan repository’s, owned by its law owners', () => {
    expect(page('setup')).toMatchObject({ level: 'plan repo', from: 'acme/plan', owners: ['pat'] });
  });

  it('marks a page no level holds as the kit default, owned by the repository’s law owners', () => {
    expect(page('ci')).toMatchObject({ level: 'kit default', from: null, file: null, owners: ['anna'] });
  });

  it('marks a page the Omni settings hold as theirs, when they are handed in', () => {
    const settings = { repository: 'acme/settings', level: { pages: [{ form: 'ci', file: '.omni-loop/settings/playbook/ci.md', text: form('ci') }], records: [], lawOwners: ['sol'] } };
    const withSettings = repositoriesSection(input({ settings })).repositories.find((r) => r.repository === 'acme/api');
    expect(withSettings?.pack && withSettings.pages.find((p) => p.form === 'ci')).toMatchObject({ level: 'omni settings', from: 'acme/settings', owners: ['sol'] });
  });

  it('lists the repository’s records first, then the plan repository’s, each with its level and owner', () => {
    expect(api.records.map((r) => [r.number, r.level, r.from, r.owners])).toEqual([
      ['0001', 'repo', 'acme/api', ['anna']],
      ['0002', 'plan repo', 'acme/plan', ['pat']],
    ]);
  });

  it('says a repository with no pack has none, and how the Omni app makes one', () => {
    expect(data.repositories.find((r) => r.repository === 'acme/web')).toEqual({ repository: 'acme/web', pack: null });
    expect(noPackLine('acme/web')).toContain('when a merge into acme/web touches its knowledge folder or its flow config');
  });

  it('reads the plan repository as its own repository, with no plan level above it', () => {
    const plan = repositoriesSection(input({ repositories: ['acme/plan'] })).repositories[0];
    expect(plan?.pack && plan.pages.find((p) => p.form === 'setup')).toMatchObject({ level: 'repo', from: 'acme/plan' });
    expect(plan?.pack && plan.records.map((r) => r.level)).toEqual(['repo']);
  });

  it('reads no plan level when the product names no plan repository, or its plan repository has no pack', () => {
    for (const over of [{ plan: null }, { packs: new Map([['acme/api', API]]) }]) {
      const read = repositoriesSection(input(over)).repositories.find((r) => r.repository === 'acme/api');
      expect(read?.pack && read.pages.find((p) => p.form === 'setup')?.level).toBe('kit default');
    }
  });

  it('names a repository listed twice once, and a product with none lists none', () => {
    expect(repositoriesSection(input({ repositories: ['acme/api', 'acme/api'] })).repositories).toHaveLength(1);
    expect(repositoriesSection(input({ repositories: [] })).repositories).toEqual([]);
  });

  it('shows owners as logins, a dash for none', () => {
    expect(ownersLine(['anna', 'bob'])).toBe('@anna, @bob');
    expect(ownersLine([])).toBe('—');
  });
});

describe('reading the packs', () => {
  it('reads each repository once, a repository with no pack as none', async () => {
    const asked: string[] = [];
    const packs = await readPacks(['acme/api', 'acme/web', 'acme/api'], (repository) => {
      asked.push(repository);
      return Promise.resolve({ ok: true, pack: repository === 'acme/api' ? API : null });
    });
    expect(asked).toEqual(['acme/api', 'acme/web']);
    expect(packs && [...packs]).toEqual([['acme/api', API], ['acme/web', null]]);
  });

  it('answers null when one pack cannot be read', async () => {
    expect(await readPacks(['acme/api', 'acme/web'], (repository) => Promise.resolve(repository === 'acme/web' ? { ok: false } : { ok: true, pack: API }))).toBeNull();
  });
});

describe('the section’s read', () => {
  const pack: PackRead = (repository) => Promise.resolve({ ok: true, pack: repository === 'acme/api' ? API : repository === 'acme/plan' ? PLAN : null });

  it('reads the product’s repositories, then the pack of each and of its plan repository', async () => {
    const asked: string[] = [];
    const read = await readRepositories('p-1', {
      held: () => Promise.resolve({ plan: 'acme/plan', repositories: ['acme/api', 'acme/web'] }),
      pack: (repository) => { asked.push(repository); return pack(repository); },
      settings: null,
    });
    expect(asked).toEqual(['acme/api', 'acme/web', 'acme/plan']);
    expect(read.ok && read.data.repositories.map((r) => [r.repository, r.pack !== null])).toEqual([['acme/api', true], ['acme/web', false]]);
    expect(read.ok && read.data.repositories[0]?.pack && read.data.repositories[0].pages.find((p) => p.form === 'setup')?.level).toBe('plan repo');
  });

  it('says what it could not read: the product’s repositories, or a pack', async () => {
    expect(await readRepositories('p-1', { held: () => Promise.resolve(null), pack, settings: null })).toEqual({ ok: false, unread: 'the repositories of p-1' });
    const failing = await readRepositories('p-1', { held: () => Promise.resolve({ plan: null, repositories: ['acme/api'] }), pack: () => Promise.resolve({ ok: false }), settings: null });
    expect(failing).toEqual({ ok: false, unread: 'a knowledge pack of p-1' });
  });
});

describe('the demo', () => {
  it('draws a repository with a pack, every level marked, and one with none', () => {
    const demo = demoRepositories('demo-product-1');
    if (demo === null) throw new Error('the demo product has a section');
    const levels = new Set(demo.repositories.flatMap((r) => (r.pack ? r.pages.map((p) => p.level) : [])));
    expect([...levels].sort()).toEqual(['kit default', 'omni settings', 'plan repo', 'repo']);
    expect(demo.repositories.some((r) => r.pack === null)).toBe(true);
    expect(demoRepositories('another')).toBeNull();
  });
});
