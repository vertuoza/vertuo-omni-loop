import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { DOSSIERS_FILE, mainCheckout, markNumbered, readDossiers, recordDraft } from './local.ts';

const DRAFT = { id: 'd-1', url: 'https://omni.example/prd/d-1', claudeSessionId: 'sess-a', prd: null, openedAt: '2026-09-27T09:00:00.000Z' };

describe('the local dossiers file', () => {
  it('lives beside ask mode\'s state, in .omni-loop/local', () => {
    expect(DOSSIERS_FILE).toBe('.omni-loop/local/dossiers.json');
  });

  it('records a draft, reads it back, and keeps the folder out of git', () => {
    const { root, read } = makeRepo();
    recordDraft(root, DRAFT);
    recordDraft(root, { ...DRAFT, id: 'd-2', claudeSessionId: null });
    expect(readDossiers(root)).toEqual([DRAFT, { ...DRAFT, id: 'd-2', claudeSessionId: null }]);
    expect(read('.omni-loop/local/.gitignore')).toBe('*\n');
  });

  it('numbers a draft, taking the dossier it became', () => {
    const { root } = makeRepo();
    recordDraft(root, DRAFT);
    recordDraft(root, { ...DRAFT, id: 'd-2' });
    markNumbered(root, 'd-1', { prd: 7, id: 'dossier-7', url: 'https://omni.example/prd/dossier-7' });
    expect(readDossiers(root)).toEqual([
      { ...DRAFT, id: 'dossier-7', url: 'https://omni.example/prd/dossier-7', prd: 7 },
      { ...DRAFT, id: 'd-2' },
    ]);
  });

  it('reads a missing, half-written or wrongly shaped file as empty', () => {
    const { root, write } = makeRepo();
    expect(readDossiers(root)).toEqual([]);
    write(DOSSIERS_FILE, '[{"id": "d-1", "url": "https://omni.exa');
    expect(readDossiers(root)).toEqual([]);
    write(DOSSIERS_FILE, JSON.stringify({ dossiers: [DRAFT] }));
    expect(readDossiers(root)).toEqual([]);
    write(DOSSIERS_FILE, 'null');
    expect(readDossiers(root)).toEqual([]);
  });

  it('drops an entry of the wrong shape and keeps the others', () => {
    const { root, write } = makeRepo();
    write(DOSSIERS_FILE, JSON.stringify([DRAFT, { id: 3 }, { ...DRAFT, id: 'd-2', prd: 'seven' }, 'd-4', { ...DRAFT, id: 'd-5', prd: 5 }]));
    expect(readDossiers(root).map((e) => e.id)).toEqual(['d-1', 'd-5']);
  });

  it('recording after a half-written file starts again from the new draft', () => {
    const { root, write } = makeRepo();
    write(DOSSIERS_FILE, '[{');
    recordDraft(root, DRAFT);
    expect(JSON.parse(readFileSync(join(root, DOSSIERS_FILE), 'utf8'))).toEqual([DRAFT]);
  });
});

describe('mainCheckout', () => {
  it('is the checkout itself in the main checkout, from any folder of it', () => {
    const { root, write } = makeRepo({ git: true });
    write('docs/a.md', 'a');
    expect(mainCheckout(root)).toBe(realpathSync(root));
    expect(mainCheckout(join(root, 'docs'))).toBe(realpathSync(root));
  });

  it('is the main checkout from a worktree, so both read the same file', () => {
    const { root } = makeRepo({ git: true });
    const tree = join(mkdtempSync(join(tmpdir(), 'omni-wt-')), 'tree');
    execFileSync('git', ['worktree', 'add', '-q', '-b', 'side', tree], { cwd: root, stdio: 'ignore' });

    expect(mainCheckout(tree)).toBe(realpathSync(root));
    recordDraft(mainCheckout(tree)!, DRAFT);
    expect(readDossiers(mainCheckout(root)!)).toEqual([DRAFT]);
  });

  it('is null outside a repository', () => {
    expect(mainCheckout(mkdtempSync(join(tmpdir(), 'omni-bare-')))).toBeNull();
  });
});
