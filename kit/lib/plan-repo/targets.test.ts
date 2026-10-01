// @ts-nocheck
// The targets reader (PRD 522, s1): each target's row read from faked `gh api` answers. No test calls
// GitHub: `fakeGh` answers each call by its endpoint, and a missing file is GitHub's 404.
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { copyEvidence, readTarget, readTargets, targetsTable } from './targets.ts';

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const BUNDLE = 'var define_OMNI_BUNDLE_default = { home: "acme/kit", version: "0.0.40" };\n';
const FILLED = '---\nform: testing\nstate: filled\n---\n\n# Testing\n';
const BLANK = '---\nform: testing\nstate: blank\n---\n\n# Testing\n';

const notFound = () => Object.assign(new Error('Command failed: gh api …\ngh: Not Found (HTTP 404)'), { stderr: 'gh: Not Found (HTTP 404)\n' });

/**
 * A fake `execFileSync` for one or more repositories. `world[slug]` is `null` for a repository `gh`
 * cannot read, else `{ branch, files: { path: text }, compare: { ahead, files } }`: a file absent
 * from `files` is a 404, and a directory lists the files under it.
 */
function fakeGh(world) {
  const calls = [];
  const exec = (file, args) => {
    if (file !== 'gh' || args[0] !== 'api') throw new Error(`unexpected ${file} ${args.join(' ')}`);
    const endpoint = args[args.length - 1];
    calls.push(endpoint);
    const [, owner, name, kind, ...rest] = endpoint.split('?')[0].split('/');
    const repo = world[`${owner}/${name}`];
    if (!repo) {
      throw Object.assign(new Error('Command failed: gh api\ngh: Could not resolve to a Repository (HTTP 404)'), {
        stderr: 'gh: Could not resolve to a Repository with the name. (HTTP 404)\n',
      });
    }
    if (kind === undefined) return JSON.stringify({ default_branch: repo.branch ?? 'main' });
    if (kind === 'compare') {
      if (!repo.compare) throw notFound();
      return JSON.stringify({
        ahead_by: repo.compare.ahead,
        files: repo.compare.files.map((filename) => ({ filename })),
      });
    }
    const path = rest.map(decodeURIComponent).join('/');
    if (Object.hasOwn(repo.files ?? {}, path)) return repo.files[path];
    const under = Object.keys(repo.files ?? {}).filter((f) => f.startsWith(`${path}/`) && !f.slice(path.length + 1).includes('/'));
    if (under.length) return JSON.stringify(under.map((f) => ({ type: 'file', name: f.split('/').pop(), path: f })));
    throw notFound();
  };
  return { exec, calls };
}

/** A target with the loop at v0.0.40 and one filled form, under the default layout. */
const WITH_LOOP = {
  '.omni-loop/config.yml': 'kit: 1\n',
  '.omni-loop/bin/omni.mjs': BUNDLE,
  '.omni-loop/knowledge/playbook/testing.md': FILLED,
};

const OWN = { repo: 'acme/front', role: 'front-end', knowledge: 'own', readAt: null };
const NONE = { repo: 'acme/legacy', role: 'legacy', knowledge: 'none', readAt: null };
const IMPORTED = { repo: 'acme/back', role: 'back-end', knowledge: 'imported', readAt: SHA };

const read = (target, world, evidence = []) => readTarget(target, { exec: fakeGh(world).exec, evidence: new Set(evidence) });

describe('readTarget', () => {
  it('reads an own target with the loop and a filled form as ok, its loop as the installed version', () => {
    expect(read(OWN, { 'acme/front': { files: WITH_LOOP } })).toEqual({
      repo: 'acme/front', role: 'front-end', knowledge: 'own', loop: 'v0.0.40', state: 'ok', detail: null,
    });
  });

  it('reads a none target without the loop as ok, its loop not installed', () => {
    expect(read(NONE, { 'acme/legacy': { files: { 'README.md': 'hi' } } })).toMatchObject({ loop: 'not installed', state: 'ok', detail: null });
  });

  it('reads the loop as installed when the bin carries no version, or is missing', () => {
    const noStamp = { ...WITH_LOOP, '.omni-loop/bin/omni.mjs': 'console.log(1);\n' };
    expect(read(OWN, { 'acme/front': { files: noStamp } }).loop).toBe('installed');
    const { '.omni-loop/bin/omni.mjs': _, ...noBin } = WITH_LOOP;
    expect(read(OWN, { 'acme/front': { files: noBin } }).loop).toBe('installed');
  });

  it('reads the filled forms under the playbook folder the target configures', () => {
    const files = {
      '.omni-loop/config.yml': 'kit: 1\npaths:\n  playbook: docs/playbook\n',
      '.omni-loop/bin/omni.mjs': BUNDLE,
      '.omni-loop/knowledge/playbook/testing.md': BLANK,
      'docs/playbook/testing.md': FILLED,
    };
    expect(read(OWN, { 'acme/front': { files } })).toMatchObject({ state: 'ok' });
  });

  it('reads an own target whose loop was removed as drifted', () => {
    expect(read(OWN, { 'acme/front': { files: {} } })).toMatchObject({
      loop: 'not installed', state: 'drifted', detail: 'the config says own, but the loop is not installed',
    });
  });

  it('reads an own target with the loop but no filled form as drifted', () => {
    const files = { ...WITH_LOOP, '.omni-loop/knowledge/playbook/testing.md': BLANK };
    expect(read(OWN, { 'acme/front': { files } })).toMatchObject({
      loop: 'v0.0.40', state: 'drifted', detail: 'the config says own, but no form is filled',
    });
  });

  it('reads a none or imported target that now has the loop and a filled form as drifted', () => {
    expect(read(NONE, { 'acme/legacy': { files: WITH_LOOP } })).toMatchObject({
      state: 'drifted', detail: 'the config says none, but it has the loop and a filled form',
    });
    expect(read(IMPORTED, { 'acme/back': { files: WITH_LOOP, compare: { ahead: 0, files: [] } } })).toMatchObject({
      state: 'drifted', detail: 'the config says imported, but it has the loop and a filled form',
    });
  });

  it('reads a none target with the loop but no filled form as ok', () => {
    const files = { ...WITH_LOOP, '.omni-loop/knowledge/playbook/testing.md': BLANK };
    expect(read(NONE, { 'acme/legacy': { files } })).toMatchObject({ state: 'ok' });
  });

  it('reads an imported target whose head has not moved as ok', () => {
    expect(read(IMPORTED, { 'acme/back': { files: {}, compare: { ahead: 0, files: [] } } }, ['composer.json'])).toMatchObject({
      knowledge: 'imported', loop: 'not installed', state: 'ok', detail: null,
    });
  });

  it('reads an imported target whose head moved without touching evidence as ok', () => {
    const world = { 'acme/back': { files: {}, compare: { ahead: 12, files: ['src/a.php', 'README.md'] } } };
    expect(read(IMPORTED, world, ['composer.json'])).toMatchObject({ state: 'ok', detail: null });
  });

  it('reads an imported target whose head changed an evidence file as stale, counting commits and files', () => {
    const world = { 'acme/back': { files: {}, compare: { ahead: 12, files: ['composer.json', 'phpunit.xml', 'src/a.php'] } } };
    expect(read(IMPORTED, world, ['composer.json', 'phpunit.xml', 'Makefile'])).toMatchObject({
      state: 'stale', detail: '12 commits, 2 evidence files changed',
    });
    const one = { 'acme/back': { files: {}, compare: { ahead: 1, files: ['composer.json'] } } };
    expect(read(IMPORTED, one, ['composer.json'])).toMatchObject({ state: 'stale', detail: '1 commit, 1 evidence file changed' });
  });

  it('compares from readAt to the default branch the repository names', () => {
    const { exec, calls } = fakeGh({ 'acme/back': { branch: 'develop', files: {}, compare: { ahead: 0, files: [] } } });
    readTarget(IMPORTED, { exec, evidence: new Set() });
    expect(calls).toContain(`repos/acme/back/compare/${SHA}...develop`);
    expect(calls).toContain('repos/acme/back/contents/.omni-loop/config.yml?ref=develop');
  });

  it('reads an imported target whose readAt GitHub cannot compare as stale, saying so', () => {
    expect(read(IMPORTED, { 'acme/back': { files: {} } }, ['composer.json'])).toMatchObject({
      state: 'stale', detail: `readAt ${SHA.slice(0, 7)} cannot be compared with the default branch`,
    });
  });

  it('reads a repository gh cannot read as unreachable, keeping its row', () => {
    expect(read({ ...OWN, repo: 'acme/typo' }, {})).toEqual({
      repo: 'acme/typo', role: 'front-end', knowledge: 'own', loop: '—', state: 'unreachable',
      detail: 'gh: Could not resolve to a Repository with the name. (HTTP 404)',
    });
  });

  it('names drifted before stale: an imported target that installed its own knowledge base', () => {
    const world = { 'acme/back': { files: WITH_LOOP, compare: { ahead: 3, files: ['composer.json'] } } };
    expect(read(IMPORTED, world, ['composer.json']).state).toBe('drifted');
  });
});

describe('readTargets', () => {
  it('reads every target in config order, each with the evidence of its own copy', () => {
    const copy = formText({ frontMatter: { state: 'filled', evidence: ['composer.json@50fa1bd'] }, slots: [] });
    const { ctx } = makeRepo({ files: { '.omni-loop/knowledge/repos/back/playbook/testing.md': copy } });
    const world = {
      'acme/back': { files: {}, compare: { ahead: 2, files: ['composer.json'] } },
      'acme/front': { files: WITH_LOOP },
    };
    const rows = readTargets([OWN, { ...OWN, repo: 'acme/typo' }, IMPORTED], { ctx, exec: fakeGh(world).exec });
    expect(rows.map((row) => [row.repo, row.state])).toEqual([['acme/front', 'ok'], ['acme/typo', 'unreachable'], ['acme/back', 'stale']]);
  });
});

describe('copyEvidence', () => {
  it("collects every evidence path of a copy's forms, and nothing for a target with no copy", () => {
    const one = formText({ frontMatter: { state: 'filled', evidence: ['composer.json@50fa1bd', 'Makefile@1a2b3c4'] } });
    const two = formText({ frontMatter: { form: 'setup', state: 'filled', evidence: ['composer.json@50fa1bd', 'docker/php.ini@abc1234'] } });
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/knowledge/repos/back/playbook/testing.md': one,
        '.omni-loop/knowledge/repos/back/playbook/setup.md': two,
        '.omni-loop/knowledge/repos/back/playbook/notes.txt': 'not a form',
      },
    });
    expect([...copyEvidence('acme/back', { ctx })].sort()).toEqual(['Makefile', 'composer.json', 'docker/php.ini']);
    expect([...copyEvidence('acme/other', { ctx })]).toEqual([]);
  });
});

describe('targetsTable', () => {
  it('lays the rows out in columns, the detail beside a state that is not ok', () => {
    const rows = [
      { repo: 'acme/back', role: 'back-end', knowledge: 'imported', loop: 'not installed', state: 'stale', detail: '12 commits, 4 evidence files changed' },
      { repo: 'acme/front', role: 'front-end', knowledge: 'own', loop: 'v0.0.40', state: 'ok', detail: null },
    ];
    expect(targetsTable(rows)).toEqual([
      'repo        role       knowledge  loop           state',
      'acme/back   back-end   imported   not installed  stale (12 commits, 4 evidence files changed)',
      'acme/front  front-end  own        v0.0.40        ok',
    ]);
  });
});
