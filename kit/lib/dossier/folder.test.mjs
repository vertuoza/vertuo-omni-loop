import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { ARTIFACT_MAX_BYTES, readDossierFolder } from './folder.mjs';

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const INBOX = '.omni-loop/delivery/inbox/0007-team-inbox';
const SPEC = '---\nprd: 7\ntitle: "Team inbox — every question in one place"\nblocked-by: none\nspec: file\n---\n\n# Team inbox\n';
const PLAN = '# Plan: team inbox\n\n| id | slice |\n';
const PAGE = '<!doctype html>\n<title>Before and after</title>\n<p>été</p>\n';

describe('readDossierFolder', () => {
  it('reads the three kinds with their hashes and sizes, and the title from the front matter', () => {
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: PLAN, [`${INBOX}/before-after.html`]: PAGE } });
    const folder = readDossierFolder(ctx, 7);

    expect(folder.dir).toBe(INBOX);
    expect(folder.title).toBe('Team inbox — every question in one place');
    expect(folder.artifacts).toEqual([
      { kind: 'spec', path: `${INBOX}/spec.md`, content: SPEC, sha256: sha256(SPEC), bytes: Buffer.byteLength(SPEC) },
      { kind: 'plan', path: `${INBOX}/plan.md`, content: PLAN, sha256: sha256(PLAN), bytes: Buffer.byteLength(PLAN) },
      { kind: 'before-after', path: `${INBOX}/before-after.html`, content: PAGE, sha256: sha256(PAGE), bytes: Buffer.byteLength(PAGE) },
    ]);
    // A size is in bytes, not characters: "été" is five bytes.
    expect(folder.artifacts[2].bytes).toBe(PAGE.length + 2);
    expect(folder.tooLarge).toEqual([]);
  });

  it('skips a missing file without naming it', () => {
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: SPEC } });
    const folder = readDossierFolder(ctx, 7);
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['spec']);
    expect(folder.tooLarge).toEqual([]);
  });

  it('skips a file over 512 KiB, naming it, and still reads the others and the title', () => {
    const big = `---\ntitle: Big one\n---\n${'x'.repeat(ARTIFACT_MAX_BYTES)}`;
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: big, [`${INBOX}/plan.md`]: PLAN } });
    const folder = readDossierFolder(ctx, 7);

    expect(ARTIFACT_MAX_BYTES).toBe(512 * 1024);
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['plan']);
    expect(folder.tooLarge).toEqual([{ kind: 'spec', path: `${INBOX}/spec.md`, bytes: Buffer.byteLength(big) }]);
    expect(folder.title).toBe('Big one');
  });

  it('takes a file of exactly 512 KiB', () => {
    const exact = 'y'.repeat(ARTIFACT_MAX_BYTES);
    const { ctx } = makeRepo({ files: { [`${INBOX}/plan.md`]: exact } });
    expect(readDossierFolder(ctx, 7).artifacts.map((a) => a.bytes)).toEqual([ARTIFACT_MAX_BYTES]);
  });

  it('titles the dossier after the folder\'s topic when the spec has no title, or there is no spec', () => {
    const untitled = makeRepo({ files: { [`${INBOX}/spec.md`]: '# No front matter\n' } });
    expect(readDossierFolder(untitled.ctx, 7).title).toBe('team-inbox');
    const noSpec = makeRepo({ files: { [`${INBOX}/plan.md`]: PLAN } });
    expect(readDossierFolder(noSpec.ctx, 7).title).toBe('team-inbox');
  });

  it('cuts a title to the 200 characters the contract takes', () => {
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: `---\ntitle: ${'t'.repeat(250)}\n---\n` } });
    expect(readDossierFolder(ctx, 7).title).toBe('t'.repeat(200));
  });

  it('reads a shipped PRD\'s folder', () => {
    const shipped = '.omni-loop/delivery/shipped/0003-omni-loop-kit';
    const { ctx } = makeRepo({ files: { [`${shipped}/spec.md`]: '---\ntitle: The kit\n---\n' } });
    const folder = readDossierFolder(ctx, 3);
    expect(folder.dir).toBe(shipped);
    expect(folder.title).toBe('The kit');
  });

  it('is null for a PRD with no folder', () => {
    const { ctx } = makeRepo();
    expect(readDossierFolder(ctx, 99)).toBeNull();
  });
});
