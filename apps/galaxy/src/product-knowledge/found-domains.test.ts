import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adoptFields, canBeKey, foundDomains, notOnListLabel, type RepositoryFolders } from './found-domains';
import { foldersOf, knowledgeRootOf } from './found-domains-pack';

// The folders of a product's repositories that its list of domains does not hold (PRD 2583 s3), from a
// knowledge pack's files: pure. Fictional repositories and folders.

const file = (path: string, content = '') => ({ path, content });
const config = (knowledge: string) => file('.omni-loop/config.yml', `kit: 1\npaths:\n  knowledge: ${knowledge}\n`);

describe('the knowledge root', () => {
  it('is the pack\'s own paths.knowledge, and .omni-loop/knowledge when it holds none or cannot be read', () => {
    expect(knowledgeRootOf([config('docs/know/')])).toBe('docs/know');
    expect(knowledgeRootOf([file('.omni-loop/config.yml', 'kit: 1\n')])).toBe('.omni-loop/knowledge');
    expect(knowledgeRootOf([file('.omni-loop/config.yml', ': : not yaml [')])).toBe('.omni-loop/knowledge');
    expect(knowledgeRootOf([])).toBe('.omni-loop/knowledge');
  });
});

describe('the folders of a pack', () => {
  it('counts a folder directly under <root>/domains/, once however many files it holds', () => {
    const folders = foldersOf([
      file('.omni-loop/knowledge/domains/stock/rules.md'), file('.omni-loop/knowledge/domains/stock/README.md', '# Stock\n\nWhat is on the shelves.\n'),
      file('.omni-loop/knowledge/domains/payroll/rules.md'),
    ]);
    expect([...folders.keys()]).toEqual(['payroll', 'stock']);
  });

  it('honours a custom root', () => {
    const files = [config('docs/know'), file('docs/know/domains/stock/rules.md'), file('.omni-loop/knowledge/domains/ghost/rules.md')];
    expect([...foldersOf(files).keys()]).toEqual(['stock']);
  });

  it('never counts the imported copies of a plan repository, under repos/<target>/domains/', () => {
    const files = [file('.omni-loop/knowledge/repos/backend/domains/stock/rules.md'), file('.omni-loop/knowledge/domains/payroll/rules.md')];
    expect([...foldersOf(files).keys()]).toEqual(['payroll']);
  });

  it('takes a file directly under domains/ for no folder', () => {
    expect(foldersOf([file('.omni-loop/knowledge/domains/README.md'), file('.omni-loop/knowledge/domains/notes.txt')]).size).toBe(0);
  });

  it('reads a folder\'s meaning from the first paragraph of its README, and none without one', () => {
    const folders = foldersOf([
      file('.omni-loop/knowledge/domains/stock/README.md', '# Stock\n\nWhat is on   the\nshelves.\n\nMore.\n'),
      file('.omni-loop/knowledge/domains/payroll/rules.md'),
    ]);
    expect(folders.get('stock')).toBe('What is on the shelves.');
    expect(folders.get('payroll')).toBe('');
  });
});

describe('what can be a key', () => {
  it('is lower-case words joined by hyphens, at most 60 characters', () => {
    expect(canBeKey('stock-levels')).toBe(true);
    expect(canBeKey('a')).toBe(true);
    expect(canBeKey('a'.repeat(60))).toBe(true);
    expect(canBeKey('a'.repeat(61))).toBe(false);
    for (const bad of ['Stock', 'stock_levels', '2stock', '-stock', 'stock levels', '']) expect(canBeKey(bad)).toBe(false);
  });
});

const repo = (repository: string, names: string[] | null): RepositoryFolders => ({
  repository, folders: names === null ? null : new Map(names.map((n) => [n, ''])),
});

describe('the folders off the list', () => {
  const listed = [{ key: 'stock', retiredAt: null }, { key: 'legacy', retiredAt: '2026-12-01' }];

  it('shows each folder the list lacks once, with every repository holding it, in name order', () => {
    const found = foundDomains(listed, [repo('acme/api', ['planning', 'stock']), repo('acme/web', ['planning', 'billing'])]);
    expect(found.off.map((r) => [r.name, r.repositories])).toEqual([['billing', ['acme/web']], ['planning', ['acme/api', 'acme/web']]]);
    expect(found.count).toBe(2);
  });

  it('marks a name that cannot be a key, still counting it as off the list', () => {
    const found = foundDomains(listed, [repo('acme/api', ['Stock_Levels', 'planning'])]);
    expect(found.off.map((r) => [r.name, r.canBeKey])).toEqual([['Stock_Levels', false], ['planning', true]]);
    expect(found.count).toBe(2);
  });

  it('shows a retired domain still in a repository as such, offering no addition and adding nothing to the count', () => {
    const found = foundDomains(listed, [repo('acme/api', ['legacy', 'stock'])]);
    expect(found.off).toEqual([]);
    expect(found.retired).toEqual([{ key: 'legacy', repositories: ['acme/api'] }]);
    expect(found.count).toBe(0);
  });

  it('lists a repository with no pack as not read yet, adding nothing to the count', () => {
    const found = foundDomains(listed, [repo('acme/api', null), repo('acme/web', ['planning'])]);
    expect(found.notRead).toEqual(['acme/api']);
    expect(found.count).toBe(1);
  });

  it('reads a repository once however many times it is given, and holds nothing for a product with no folder', () => {
    expect(foundDomains([], [repo('acme/api', ['x']), repo('acme/api', ['x'])]).off[0]?.repositories).toEqual(['acme/api']);
    expect(foundDomains([], [])).toEqual({ off: [], retired: [], notRead: [], count: 0 });
  });
});

describe('adding a folder in one action', () => {
  it('fills the key from the folder, the name from its words and the meaning from its README', () => {
    expect(adoptFields({ name: 'stock-levels', repositories: ['acme/api'], canBeKey: true, meaning: 'What is on the shelves.' }))
      .toEqual({ key: 'stock-levels', name: 'Stock levels', meaning: 'What is on the shelves.' });
  });

  it('says where the folder was found when it has no README, and cuts a long meaning to 400 characters', () => {
    expect(adoptFields({ name: 'planning', repositories: ['acme/api', 'acme/web'], canBeKey: true, meaning: '' }).meaning)
      .toBe('Found as the folder domains/planning in acme/api, acme/web.');
    expect(adoptFields({ name: 'planning', repositories: ['acme/api'], canBeKey: true, meaning: 'x'.repeat(500) }).meaning).toHaveLength(400);
  });

  it('keeps a name within 80 characters', () => {
    expect(adoptFields({ name: 'a-'.repeat(30) + 'b', repositories: [], canBeKey: true, meaning: '' }).name.length).toBeLessThanOrEqual(80);
  });
});

describe('the sub-menu\'s entry', () => {
  it('shows the active count and, above 0, the folders not on the list', () => {
    expect(notOnListLabel(6, 2)).toBe('Domains 6 · 2 not on the list');
    expect(notOnListLabel(0, 1)).toBe('Domains 0 · 1 not on the list');
    expect(notOnListLabel(6, 0)).toBeNull();
    expect(notOnListLabel(6, null)).toBeNull();
  });
});

describe('found-domains in the browser', () => {
  it('imports nothing, so a client component can read it without the kit\'s file system', () => {
    const source = readFileSync(new URL('./found-domains.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/^import\s(?!type\s)/m);
  });
});
