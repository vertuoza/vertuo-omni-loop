// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { ARTIFACT_MAX_BYTES, deliveryFolders, dossierSwitch, fixFolders, fixTitle, gitBlobSha, titleOf } from './folders.ts';

const blob = (path, sha, size = 100) => ({ path, mode: '100644', type: 'blob', sha, size });

describe('dossierSwitch: the repository\'s own config decides', () => {
  const ON = 'kit: 1\nask:\n  url: https://ask.example.com\ndossier:\n  enabled: true\n';

  it('is on when dossier.enabled is true and ask.url is set, reading paths.delivery or its default', () => {
    expect(dossierSwitch(ON)).toEqual({ on: true, delivery: '.omni-loop/delivery' });
    expect(dossierSwitch(`${ON}paths:\n  delivery: ./docs/delivery/\n`)).toEqual({ on: true, delivery: 'docs/delivery' });
  });

  it('is off, saying why, when the switch is off, not a boolean, or ask.url is not set', () => {
    expect(dossierSwitch('kit: 1\nask:\n  url: https://ask.example.com\n')).toEqual({ on: false, reason: 'dossier.enabled is false' });
    expect(dossierSwitch(ON.replace('enabled: true', 'enabled: false'))).toEqual({ on: false, reason: 'dossier.enabled is false' });
    expect(dossierSwitch(ON.replace('enabled: true', 'enabled: "true"'))).toEqual({ on: false, reason: 'dossier.enabled is not true or false' });
    expect(dossierSwitch('kit: 1\ndossier:\n  enabled: true\n')).toEqual({ on: false, reason: 'ask.url is not set' });
    expect(dossierSwitch(ON.replace('url: https://ask.example.com', 'url: null'))).toEqual({ on: false, reason: 'ask.url is not set' });
  });

  it('is off when the config does not read', () => {
    expect(dossierSwitch('kit: [1\n')).toMatchObject({ on: false, reason: expect.stringMatching(/^\.omni-loop\/config\.yml does not read/) });
    expect(dossierSwitch('')).toMatchObject({ on: false, reason: expect.stringMatching(/does not read/) });
    expect(dossierSwitch('- a list\n')).toMatchObject({ on: false, reason: expect.stringMatching(/does not read/) });
  });
});

describe('deliveryFolders: one tree listing, read as PRD folders', () => {
  const D = '.omni-loop/delivery';

  it('keeps each <nnnn>-<topic> folder of inbox and shipped with its three artifacts and their blob hashes', () => {
    const { folders, skipped } = deliveryFolders([
      { path: D, mode: '040000', type: 'tree', sha: 't1' },
      blob(`${D}/inbox/0216-prd-dossiers/spec.md`, 'a1'),
      blob(`${D}/inbox/0216-prd-dossiers/plan.md`, 'a2'),
      blob(`${D}/inbox/0216-prd-dossiers/before-after.html`, 'a3', 2048),
      blob(`${D}/inbox/0216-prd-dossiers/notes.md`, 'a4'),
      blob(`${D}/shipped/0003-ask-mode/spec.md`, 'b1'),
      blob(`${D}/shipped/0003-ask-mode/outbox/s1-01-x.md`, 'b2'),
      blob(`${D}/outbox/0216-prd-dossiers/s1-02-y.md`, 'c1'),
      blob(`${D}/inbox/README.md`, 'c2'),
      blob('README.md', 'c3'),
    ], D);
    expect(folders).toEqual([
      { prd: 3, topic: 'ask-mode', dir: `${D}/shipped/0003-ask-mode`, files: [{ kind: 'spec', path: `${D}/shipped/0003-ask-mode/spec.md`, sha: 'b1', size: 100 }] },
      {
        prd: 216, topic: 'prd-dossiers', dir: `${D}/inbox/0216-prd-dossiers`, files: [
          { kind: 'spec', path: `${D}/inbox/0216-prd-dossiers/spec.md`, sha: 'a1', size: 100 },
          { kind: 'plan', path: `${D}/inbox/0216-prd-dossiers/plan.md`, sha: 'a2', size: 100 },
          { kind: 'before-after', path: `${D}/inbox/0216-prd-dossiers/before-after.html`, sha: 'a3', size: 2048 },
        ],
      },
    ]);
    expect(skipped).toEqual([]);
  });

  it('skips, naming why, a folder whose name does not parse and a file over 512 KiB', () => {
    const { folders, skipped } = deliveryFolders([
      blob(`${D}/inbox/drafts/spec.md`, 'd1'),
      blob(`${D}/inbox/0000-nothing/spec.md`, 'd2'),
      blob(`${D}/shipped/12-short/spec.md`, 'd3'),
      blob(`${D}/inbox/0007-Big_Page/spec.md`, 'd4'),
      blob(`${D}/inbox/0009-huge/spec.md`, 'e1'),
      blob(`${D}/inbox/0009-huge/before-after.html`, 'e2', ARTIFACT_MAX_BYTES + 1),
      blob(`${D}/inbox/0010-edge/before-after.html`, 'e3', ARTIFACT_MAX_BYTES),
    ], D);
    expect(folders.map((f) => [f.prd, f.files.map((x) => x.kind)])).toEqual([[9, ['spec']], [10, ['before-after']]]);
    expect(skipped).toEqual([
      { path: `${D}/inbox/0000-nothing`, reason: 'the folder name does not read as <nnnn>-<topic>' },
      { path: `${D}/inbox/0007-Big_Page`, reason: 'the folder name does not read as <nnnn>-<topic>' },
      { path: `${D}/inbox/0009-huge/before-after.html`, reason: `${ARTIFACT_MAX_BYTES + 1} bytes, over 512 KiB` },
      { path: `${D}/inbox/drafts`, reason: 'the folder name does not read as <nnnn>-<topic>' },
      { path: `${D}/shipped/12-short`, reason: 'the folder name does not read as <nnnn>-<topic>' },
    ]);
  });

  it('reads one folder per PRD as the kit does: the inbox before shipped, the first name before the next', () => {
    const { folders, skipped } = deliveryFolders([
      blob(`${D}/shipped/0005-old/spec.md`, 's1'),
      blob(`${D}/inbox/0005-new/spec.md`, 'i1'),
      blob(`${D}/shipped/0006-b/spec.md`, 's2'),
      blob(`${D}/shipped/0006-a/spec.md`, 's3'),
    ], D);
    expect(folders.map((f) => f.dir)).toEqual([`${D}/inbox/0005-new`, `${D}/shipped/0006-a`]);
    expect(skipped).toEqual([
      { path: `${D}/shipped/0005-old`, reason: `PRD 5 is read from ${D}/inbox/0005-new` },
      { path: `${D}/shipped/0006-b`, reason: `PRD 6 is read from ${D}/shipped/0006-a` },
    ]);
  });

  it('reads the delivery folder the config names, and nothing outside it', () => {
    const { folders } = deliveryFolders([
      blob('docs/delivery/inbox/0001-a/spec.md', 'x1'),
      blob(`${D}/inbox/0002-b/spec.md`, 'x2'),
    ], 'docs/delivery');
    expect(folders.map((f) => f.prd)).toEqual([1]);
  });
});

describe('fixFolders: one tree listing, read as visual and bug fixes (PRD 627)', () => {
  const D = '.omni-loop/delivery';

  it('reads visual/ into before-after and its rounds in numeric order, and bugs/ into one bug-record', () => {
    const { folders, skipped } = fixFolders([
      blob(`${D}/visual/0548-omni-links-new-tab/before-after.html`, 'v1'),
      blob(`${D}/visual/0561-omni-links-footer/variations-r10.html`, 'r10'),
      blob(`${D}/visual/0561-omni-links-footer/variations-r2.html`, 'r2'),
      blob(`${D}/visual/0561-omni-links-footer/before-after.html`, 'v2'),
      blob(`${D}/visual/0561-omni-links-footer/variations-r1.html`, 'r1'),
      blob(`${D}/visual/0561-omni-links-footer/variations-r0.html`, 'r0'),
      blob(`${D}/visual/0561-omni-links-footer/notes.md`, 'n1'),
      blob(`${D}/bugs/0571-number-args/bug.md`, 'b1'),
      blob(`${D}/bugs/0571-number-args/before-after.html`, 'b2'),
      blob(`${D}/inbox/0216-prd-dossiers/spec.md`, 'p1'),
    ], D);
    expect(folders).toEqual([
      { kind: 'visual', prd: 548, topic: 'omni-links-new-tab', dir: `${D}/visual/0548-omni-links-new-tab`, files: [{ kind: 'before-after', path: `${D}/visual/0548-omni-links-new-tab/before-after.html`, sha: 'v1', size: 100 }] },
      {
        kind: 'visual', prd: 561, topic: 'omni-links-footer', dir: `${D}/visual/0561-omni-links-footer`, files: [
          { kind: 'before-after', path: `${D}/visual/0561-omni-links-footer/before-after.html`, sha: 'v2', size: 100 },
          { kind: 'variations', round: 1, path: `${D}/visual/0561-omni-links-footer/variations-r1.html`, sha: 'r1', size: 100 },
          { kind: 'variations', round: 2, path: `${D}/visual/0561-omni-links-footer/variations-r2.html`, sha: 'r2', size: 100 },
          { kind: 'variations', round: 10, path: `${D}/visual/0561-omni-links-footer/variations-r10.html`, sha: 'r10', size: 100 },
        ],
      },
      { kind: 'bug', prd: 571, topic: 'number-args', dir: `${D}/bugs/0571-number-args`, files: [{ kind: 'bug-record', path: `${D}/bugs/0571-number-args/bug.md`, sha: 'b1', size: 100 }] },
    ]);
    expect(skipped).toEqual([]);
  });

  it('skips, naming why, a folder whose name does not parse, a file over 512 KiB and a number\'s second folder', () => {
    const { folders, skipped } = fixFolders([
      blob(`${D}/visual/drafts/before-after.html`, 'd1'),
      blob(`${D}/bugs/12-short/bug.md`, 'd2'),
      blob(`${D}/visual/0009-huge/before-after.html`, 'e1', ARTIFACT_MAX_BYTES + 1),
      blob(`${D}/visual/0009-huge/variations-r1.html`, 'e2'),
      blob(`${D}/bugs/0006-b/bug.md`, 's1'),
      blob(`${D}/bugs/0006-a/bug.md`, 's2'),
      blob(`${D}/visual/0006-a/before-after.html`, 's3'),
    ], D);
    expect(folders.map((f) => [f.kind, f.prd, f.dir, f.files.map((x) => x.kind)])).toEqual([
      ['visual', 6, `${D}/visual/0006-a`, ['before-after']],
      ['visual', 9, `${D}/visual/0009-huge`, ['variations']],
      ['bug', 6, `${D}/bugs/0006-a`, ['bug-record']],
    ]);
    expect(skipped).toEqual([
      { path: `${D}/bugs/0006-b`, reason: `bug fix 6 is read from ${D}/bugs/0006-a` },
      { path: `${D}/bugs/12-short`, reason: 'the folder name does not read as <nnnn>-<topic>' },
      { path: `${D}/visual/0009-huge/before-after.html`, reason: `${ARTIFACT_MAX_BYTES + 1} bytes, over 512 KiB` },
      { path: `${D}/visual/drafts`, reason: 'the folder name does not read as <nnnn>-<topic>' },
    ]);
  });

  it('leaves deliveryFolders reading inbox and shipped only', () => {
    const { folders } = deliveryFolders([blob(`${D}/visual/0548-a/before-after.html`, 'v1'), blob(`${D}/bugs/0571-b/bug.md`, 'b1')], D);
    expect(folders).toEqual([]);
  });
});

describe('fixTitle: the issue\'s title without its prefix, else the topic', () => {
  it('strips Visual: or Bug:, and falls back to the topic, cut to 200 characters', () => {
    expect(fixTitle('Visual: Docs open in a new tab', 'omni-links-new-tab')).toBe('Docs open in a new tab');
    expect(fixTitle('bug:  omni reads 1e2', 'number-args')).toBe('omni reads 1e2');
    expect(fixTitle('A plain title', 't')).toBe('A plain title');
    expect(fixTitle(null, 'number-args')).toBe('number-args');
    expect(fixTitle('Bug: ', 'number-args')).toBe('number-args');
    expect(fixTitle(`Visual: ${'x'.repeat(250)}`, 't')).toBe('x'.repeat(200));
  });
});

describe('titleOf: the spec\'s front matter, else the topic', () => {
  it('reads the title as the kit does, quotes stripped, cut to 200 characters', () => {
    expect(titleOf('---\nprd: 216\ntitle: PRD dossiers — versioned\n---\n# x\n', 'prd-dossiers')).toBe('PRD dossiers — versioned');
    expect(titleOf('---\r\ntitle: "Quoted"\r\n---\r\n', 't')).toBe('Quoted');
    expect(titleOf(`---\ntitle: ${'x'.repeat(250)}\n---\n`, 't')).toBe('x'.repeat(200));
  });

  it('falls back to the topic with no front matter, no title, a blank title or no spec', () => {
    expect(titleOf('# Just a heading\n', 'prd-dossiers')).toBe('prd-dossiers');
    expect(titleOf('---\nprd: 216\n---\n', 'prd-dossiers')).toBe('prd-dossiers');
    expect(titleOf('---\ntitle:   \n---\n', 'prd-dossiers')).toBe('prd-dossiers');
    expect(titleOf(null, 'prd-dossiers')).toBe('prd-dossiers');
  });
});

describe('gitBlobSha', () => {
  it('is the hash git gives a file\'s content, so a stored version can be matched to a tree entry', () => {
    // `printf 'hello\n' | git hash-object --stdin`
    expect(gitBlobSha('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
    const text = 'Déjà vu — ✓\n';
    const bytes = Buffer.from(text, 'utf8');
    expect(gitBlobSha(text)).toBe(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'));
  });
});
