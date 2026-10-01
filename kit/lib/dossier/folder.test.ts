// @ts-nocheck
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { ARTIFACT_MAX_BYTES, fixTitle, readDossierFolder, readFixFolder } from './folder.ts';

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

  it('reads voice.json as the voice artifact, sent last (PRD 822)', () => {
    const VOICE = '{"rounds": []}\n';
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/voice.json`]: VOICE } });
    const folder = readDossierFolder(ctx, 7);
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['spec', 'voice']);
    expect(folder.artifacts[1]).toEqual({ kind: 'voice', path: `${INBOX}/voice.json`, content: VOICE, sha256: sha256(VOICE), bytes: Buffer.byteLength(VOICE) });
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

describe('readFixFolder (PRD 627)', () => {
  const VISUAL = '.omni-loop/delivery/visual/0548-omni-links-new-tab';
  const BUGS = '.omni-loop/delivery/bugs/0571-number-args';
  const round = (k) => `<!doctype html>\n<title>Round ${k}</title>\n`;

  it('reads a visual fix\'s page, then its rounds in numeric order, each a variations version', () => {
    const { ctx } = makeRepo({
      files: {
        [`${VISUAL}/before-after.html`]: PAGE,
        [`${VISUAL}/variations-r10.html`]: round(10),
        [`${VISUAL}/variations-r2.html`]: round(2),
        [`${VISUAL}/variations-r1.html`]: round(1),
        [`${VISUAL}/notes.txt`]: 'not an artifact',
      },
    });
    const folder = readFixFolder(ctx, 'visual', 548);
    expect(folder.dir).toBe(VISUAL);
    expect(folder.artifacts.map(({ kind, path, round: k }) => ({ kind, path, round: k }))).toEqual([
      { kind: 'before-after', path: `${VISUAL}/before-after.html`, round: undefined },
      { kind: 'variations', path: `${VISUAL}/variations-r1.html`, round: 1 },
      { kind: 'variations', path: `${VISUAL}/variations-r2.html`, round: 2 },
      { kind: 'variations', path: `${VISUAL}/variations-r10.html`, round: 10 },
    ]);
    expect(folder.artifacts[1]).toMatchObject({ content: round(1), sha256: sha256(round(1)), bytes: Buffer.byteLength(round(1)) });
    expect(folder.tooLarge).toEqual([]);
  });

  it('reads a bug fix\'s bug.md as its record', () => {
    const { ctx } = makeRepo({ files: { [`${BUGS}/bug.md`]: '# Bug 571: numbers\n' } });
    const folder = readFixFolder(ctx, 'bug', 571);
    expect(folder.artifacts.map(({ kind, path }) => ({ kind, path }))).toEqual([{ kind: 'bug-record', path: `${BUGS}/bug.md` }]);
  });

  it('titles the fix after its issue without its Visual: or Bug: prefix, else after the folder\'s topic', () => {
    const { ctx } = makeRepo({ files: { [`${VISUAL}/before-after.html`]: PAGE, [`${BUGS}/bug.md`]: '# Bug\n' } });
    expect(readFixFolder(ctx, 'visual', 548, { issueTitle: 'Visual: Omni links open in a new tab' }).title).toBe('Omni links open in a new tab');
    expect(readFixFolder(ctx, 'bug', 571, { issueTitle: 'Bug: omni reads 1e2 as a number' }).title).toBe('omni reads 1e2 as a number');
    expect(readFixFolder(ctx, 'visual', 548, { issueTitle: 'Links in a new tab' }).title).toBe('Links in a new tab');
    expect(readFixFolder(ctx, 'visual', 548).title).toBe('omni-links-new-tab');
    expect(readFixFolder(ctx, 'bug', 571, { issueTitle: '  ' }).title).toBe('number-args');
    expect(fixTitle(`Visual: ${'t'.repeat(250)}`, 'topic')).toBe('t'.repeat(200));
  });

  it('skips a file over 512 KiB, naming it, and still reads the others', () => {
    const big = 'x'.repeat(ARTIFACT_MAX_BYTES + 1);
    const { ctx } = makeRepo({ files: { [`${VISUAL}/before-after.html`]: PAGE, [`${VISUAL}/variations-r1.html`]: big } });
    const folder = readFixFolder(ctx, 'visual', 548);
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['before-after']);
    expect(folder.tooLarge).toEqual([{ kind: 'variations', path: `${VISUAL}/variations-r1.html`, bytes: big.length }]);
  });

  it('is null for an issue with no folder of its kind, and never reads another issue\'s', () => {
    const { ctx } = makeRepo({ files: { [`${VISUAL}/before-after.html`]: PAGE, '.omni-loop/delivery/visual/5480-other/before-after.html': PAGE } });
    expect(readFixFolder(ctx, 'bug', 548)).toBeNull();
    expect(readFixFolder(ctx, 'visual', 54)).toBeNull();
    expect(readFixFolder(ctx, 'visual', 548).dir).toBe(VISUAL);
  });
});
