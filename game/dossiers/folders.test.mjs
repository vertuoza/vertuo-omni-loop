import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { ARTIFACT_MAX_BYTES, deliveryFolders, dossierSwitch, gitBlobSha, titleOf } from './folders.mjs';

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
