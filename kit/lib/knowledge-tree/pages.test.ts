// PRD 2419, s1: the knowledge tree's pages over files handed in, as the Omni page reads a repository's
// knowledge pack. Each page reads the lowest level that holds it filled, else the kit default; each
// decision record says its level, the repository's own first; each carries its owner.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORM_IDS } from '../playbook/forms.ts';
import { packLevel, treePages } from './pages.ts';
import type { LevelSource, TreeFile } from './pages.ts';

/** A form's text: its front matter, its title and one slot. */
function form(id: string, { state = 'filled', owner, pointsTo = null }: { state?: string; owner?: string; pointsTo?: string | null } = {}): string {
  return [
    '---',
    `form: ${id}`,
    'form-version: 1',
    `state: ${state}`,
    `points-to: ${pointsTo ?? 'null'}`,
    'evidence: null',
    'invaded: null',
    ...(owner === undefined ? [] : [`owner: ${owner}`]),
    '---',
    '',
    `# The ${id} page`,
    '',
    '## One',
    '<!-- slot: one · required -->',
    'Some text.',
    '',
  ].join('\n');
}

const CONFIG = '.omni-loop/config.yml';
const PLAYBOOK = '.omni-loop/knowledge/playbook';
const ADR = '.omni-loop/knowledge/adr';

const config = (owners: string) => ({ path: CONFIG, content: `kit: 1\nlaws:\n  owners: ${owners}\n` });
const page = (id: string, options?: Parameters<typeof form>[1]): TreeFile => ({ path: `${PLAYBOOK}/${id}.md`, content: form(id, options) });
const record = (name: string, title: string, dir = ADR): TreeFile => ({ path: `${dir}/${name}`, content: `# ${title}\n\n**PRD:** #7\n\n## Context\n\nWhy.\n` });

/** The level a pack of `files` reads as; fails the test when it does not read. */
function level(files: TreeFile[]): LevelSource {
  return packLevel(files).level;
}

const EMPTY: LevelSource = { pages: [], records: [], lawOwners: [] };

describe('packLevel — a knowledge pack read as one level of the tree', () => {
  it('reads the playbook pages and decision records where the pack’s config puts them, with its law owners', () => {
    const read = packLevel([
      config('[anna, { login: bob, delegate: carl }]'),
      page('testing'),
      { path: '.omni-loop/knowledge/adr/README.md', content: form('decisions') },
      record('0001-one.md', 'One'),
      { path: `${ADR}/notes.txt`, content: 'no record' },
      { path: `${ADR}/nested/0002-deep.md`, content: '# Deep' },
    ]);
    expect(read.problems).toEqual([]);
    expect(read.level.lawOwners).toEqual(['anna', 'bob']);
    expect(read.level.pages.map((p) => [p.form, p.file])).toEqual([
      ['testing', `${PLAYBOOK}/testing.md`],
      ['decisions', '.omni-loop/knowledge/adr/README.md'],
    ]);
    expect(read.level.records.map((r) => r.file)).toEqual([`${ADR}/0001-one.md`]);
  });

  it('follows a config that moves the knowledge folder', () => {
    const read = packLevel([
      { path: CONFIG, content: 'kit: 1\npaths:\n  knowledge: docs/kb\n  playbook: docs/kb/forms\n  adr: docs/kb/decisions\n' },
      { path: 'docs/kb/forms/setup.md', content: form('setup') },
      record('0003-moved.md', 'Moved', 'docs/kb/decisions'),
    ]);
    expect(read.level.pages.map((p) => p.file)).toEqual(['docs/kb/forms/setup.md']);
    expect(read.level.records.map((r) => r.file)).toEqual(['docs/kb/decisions/0003-moved.md']);
  });

  it('reads a pack whose config is missing or does not parse with the kit’s paths, no owner, and says so', () => {
    const missing = packLevel([page('testing')]);
    expect(missing.level.pages.map((p) => p.form)).toEqual(['testing']);
    expect(missing.level.lawOwners).toEqual([]);
    expect(missing.problems).toEqual([`${CONFIG}: not in the knowledge pack`]);
    const broken = packLevel([{ path: CONFIG, content: 'kit: 2\n' }, page('testing')]);
    expect(broken.level.pages.map((p) => p.form)).toEqual(['testing']);
    expect(broken.problems).toEqual([`${CONFIG} is not a valid Omni Loop config: kit: Invalid literal value, expected 1`]);
  });
});

describe('treePages — each page the lowest level that holds it filled, else the kit default (PRD 2416’s order)', () => {
  const repo = level([config('[anna]'), page('testing'), page('setup', { state: 'blank' })]);
  const plan = level([config('[pat]'), page('setup'), page('ci'), page('testing')]);
  const settings: LevelSource = {
    pages: [{ form: 'ci', file: '.omni-loop/settings/playbook/ci.md', text: form('ci') }, { form: 'review', file: '.omni-loop/settings/playbook/review.md', text: form('review', { owner: '[sam]' }) }],
    records: [],
    lawOwners: ['sol'],
  };
  const tree = treePages({ repo, 'plan repo': plan, 'omni settings': settings });
  const of = (id: string) => tree.pages.find((p) => p.form === id);

  it('lists every form of the kit once, in the kit’s order', () => {
    expect(tree.pages.map((p) => p.form)).toEqual(FORM_IDS);
  });

  it('marks a page the repository holds filled as the repository’s, even when every level above holds it', () => {
    expect(of('testing')).toEqual({ form: 'testing', level: 'repo', file: `${PLAYBOOK}/testing.md`, title: 'The testing page', owners: ['anna'] });
  });

  it('reads a page the repository leaves blank from its plan repository, owned by the plan repository’s law owners', () => {
    expect(of('setup')).toMatchObject({ level: 'plan repo', file: `${PLAYBOOK}/setup.md`, owners: ['pat'] });
  });

  it('reads the plan repository before the Omni settings', () => {
    expect(of('ci')).toMatchObject({ level: 'plan repo', owners: ['pat'] });
  });

  it('reads a page only the Omni settings hold from them, owned by its owner line', () => {
    expect(of('review')).toMatchObject({ level: 'omni settings', file: '.omni-loop/settings/playbook/review.md', owners: ['sam'] });
  });

  it('reads a page no level holds as the kit default, owned by the repository’s law owners', () => {
    expect(of('releasing')).toEqual({ form: 'releasing', level: 'kit default', file: null, title: null, owners: ['anna'] });
  });

  it('takes an owner line over the law owners on the repository’s own page, a leading @ dropped', () => {
    const own = treePages({ repo: { ...EMPTY, lawOwners: ['anna'], pages: [{ form: 'testing', file: 't.md', text: form('testing', { owner: '["@kim", lee]' }) }] }, 'plan repo': null, 'omni settings': null });
    expect(own.pages.find((p) => p.form === 'testing')?.owners).toEqual(['kim', 'lee']);
  });

  it('takes the repository’s pointer page as its own, and skips a level’s pointer page', () => {
    const pointer = form('testing', { state: 'pointer', pointsTo: 'docs/testing.md' });
    const own = treePages({ repo: { ...EMPTY, pages: [{ form: 'testing', file: 'a.md', text: pointer }] }, 'plan repo': null, 'omni settings': null });
    expect(own.pages.find((p) => p.form === 'testing')?.level).toBe('repo');
    const above = treePages({ repo: EMPTY, 'plan repo': { ...EMPTY, pages: [{ form: 'testing', file: 'b.md', text: pointer }] }, 'omni settings': null });
    expect(above.pages.find((p) => p.form === 'testing')?.level).toBe('kit default');
  });

  it('skips a page that does not parse, naming it, and reads the next level', () => {
    const broken = treePages({
      repo: { ...EMPTY, pages: [{ form: 'testing', file: 'bad.md', text: 'no front matter' }] },
      'plan repo': plan,
      'omni settings': null,
    });
    expect(broken.pages.find((p) => p.form === 'testing')?.level).toBe('plan repo');
    expect(broken.problems).toHaveLength(1);
    expect(broken.problems[0]).toMatch(/^bad\.md: /);
  });

  it('skips a page whose front matter names another form', () => {
    const wrong = treePages({ repo: { ...EMPTY, pages: [{ form: 'testing', file: 'w.md', text: form('setup') }] }, 'plan repo': null, 'omni settings': null });
    expect(wrong.pages.find((p) => p.form === 'testing')?.level).toBe('kit default');
    expect(wrong.problems).toEqual(['w.md: its front matter says form: setup']);
  });
});

describe('treePages — the decision records, the repository’s own first', () => {
  const repo = level([config('[anna]'), record('0002-own.md', 'Own two'), record('0001-own.md', 'Own one')]);
  const plan = level([config('[pat]'), record('0001-plan.md', 'Plan one'), record('0003-plan.md', 'Plan three'), { path: `${ADR}/0004-untitled.md`, content: 'no heading' }]);
  const settings: LevelSource = { pages: [], records: [{ file: '.omni-loop/settings/adr/0003-s.md', text: '# Settings three' }, { file: '.omni-loop/settings/adr/0005-s.md', text: '# Settings five' }], lawOwners: ['sol'] };
  const tree = treePages({ repo, 'plan repo': plan, 'omni settings': settings });

  it('lists the repository’s records in number order, then each level’s records whose number nothing nearer holds', () => {
    expect(tree.records.map((r) => [r.number, r.level, r.title])).toEqual([
      ['0001', 'repo', 'Own one'],
      ['0002', 'repo', 'Own two'],
      ['0003', 'plan repo', 'Plan three'],
      ['0004', 'plan repo', null],
      ['0005', 'omni settings', 'Settings five'],
    ]);
  });

  it('gives each record its level’s law owners', () => {
    expect(tree.records.map((r) => r.owners)).toEqual([['anna'], ['anna'], ['pat'], ['pat'], ['sol']]);
  });

  it('reads no level above the repository when none is handed in', () => {
    expect(treePages({ repo, 'plan repo': null, 'omni settings': null }).records.map((r) => r.level)).toEqual(['repo', 'repo']);
  });
});

describe('the module', () => {
  it('imports nothing that reads the disk, so an app bundler takes it', () => {
    const source = readFileSync(new URL('./pages.ts', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports.filter((path) => path?.startsWith('node:'))).toEqual([]);
    expect(source).not.toMatch(/^import \{[^}]*\} from '\.\/levels\.ts';$/m);
  });
});
