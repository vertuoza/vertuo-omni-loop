import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { ARTIFACT_MAX_BYTES, fixTitle, readConceptFolder, readDossierFolder, readFixFolder } from './folder.ts';
import { assertDefined } from '../../test/assert.ts';
import { parseIssue, parsePrd } from '../ids.ts';

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const INBOX = '.omni-loop/delivery/inbox/0007-team-inbox';
const SPEC = '---\nprd: 7\ntitle: "Team inbox — every question in one place"\nblocked-by: none\nspec: file\n---\n\n# Team inbox\n';
const PLAN = '# Plan: team inbox\n\n| id | slice |\n';
const PAGE = '<!doctype html>\n<title>Before and after</title>\n<p>été</p>\n';

describe('readDossierFolder', () => {
  it('reads the three kinds with their hashes and sizes, and the title from the front matter', () => {
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: PLAN, [`${INBOX}/before-after.html`]: PAGE } });
    const folder = readDossierFolder(ctx, parsePrd(7));
    assertDefined(folder, 'folder');

    expect(folder.dir).toBe(INBOX);
    expect(folder.title).toBe('Team inbox — every question in one place');
    expect(folder.artifacts).toEqual([
      { kind: 'spec', path: `${INBOX}/spec.md`, content: SPEC, sha256: sha256(SPEC), bytes: Buffer.byteLength(SPEC) },
      { kind: 'plan', path: `${INBOX}/plan.md`, content: PLAN, sha256: sha256(PLAN), bytes: Buffer.byteLength(PLAN) },
      { kind: 'before-after', path: `${INBOX}/before-after.html`, content: PAGE, sha256: sha256(PAGE), bytes: Buffer.byteLength(PAGE) },
    ]);
    // A size is in bytes, not characters: "été" is five bytes.
    assertDefined(folder.artifacts[2], 'folder.artifacts[2]');
    expect(folder.artifacts[2].bytes).toBe(PAGE.length + 2);
    expect(folder.tooLarge).toEqual([]);
  });

  it('reads voice.json as the voice artifact, sent last (PRD 822)', () => {
    const VOICE = '{"rounds": []}\n';
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/voice.json`]: VOICE } });
    const folder = readDossierFolder(ctx, parsePrd(7));
    assertDefined(folder, 'folder');
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['spec', 'voice']);
    expect(folder.artifacts[1]).toEqual({ kind: 'voice', path: `${INBOX}/voice.json`, content: VOICE, sha256: sha256(VOICE), bytes: Buffer.byteLength(VOICE) });
  });

  it('skips a missing file without naming it', () => {
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: SPEC } });
    const folder = readDossierFolder(ctx, parsePrd(7));
    assertDefined(folder, 'folder');
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['spec']);
    expect(folder.tooLarge).toEqual([]);
  });

  it('skips a file over 512 KiB, naming it, and still reads the others and the title', () => {
    const big = `---\ntitle: Big one\n---\n${'x'.repeat(ARTIFACT_MAX_BYTES)}`;
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: big, [`${INBOX}/plan.md`]: PLAN } });
    const folder = readDossierFolder(ctx, parsePrd(7));
    assertDefined(folder, 'folder');

    expect(ARTIFACT_MAX_BYTES).toBe(512 * 1024);
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['plan']);
    expect(folder.tooLarge).toEqual([{ kind: 'spec', path: `${INBOX}/spec.md`, bytes: Buffer.byteLength(big) }]);
    expect(folder.title).toBe('Big one');
  });

  it('takes a file of exactly 512 KiB', () => {
    const exact = 'y'.repeat(ARTIFACT_MAX_BYTES);
    const { ctx } = makeRepo({ files: { [`${INBOX}/plan.md`]: exact } });
    const dossierFolder = readDossierFolder(ctx, parsePrd(7));
    assertDefined(dossierFolder, 'the dossier folder');
    expect(dossierFolder.artifacts.map((a) => a.bytes)).toEqual([ARTIFACT_MAX_BYTES]);
  });

  it('titles the dossier after the folder\'s topic when the spec has no title, or there is no spec', () => {
    const untitled = makeRepo({ files: { [`${INBOX}/spec.md`]: '# No front matter\n' } });
    const dossierFolder = readDossierFolder(untitled.ctx, parsePrd(7));
    assertDefined(dossierFolder, 'the dossier folder');
    expect(dossierFolder.title).toBe('team-inbox');
    const noSpec = makeRepo({ files: { [`${INBOX}/plan.md`]: PLAN } });
    const dossierFolder2 = readDossierFolder(noSpec.ctx, parsePrd(7));
    assertDefined(dossierFolder2, 'the dossier folder');
    expect(dossierFolder2.title).toBe('team-inbox');
  });

  it('cuts a title to the 200 characters the contract takes', () => {
    const { ctx } = makeRepo({ files: { [`${INBOX}/spec.md`]: `---\ntitle: ${'t'.repeat(250)}\n---\n` } });
    const dossierFolder = readDossierFolder(ctx, parsePrd(7));
    assertDefined(dossierFolder, 'the dossier folder');
    expect(dossierFolder.title).toBe('t'.repeat(200));
  });

  it('reads a shipped PRD\'s folder', () => {
    const shipped = '.omni-loop/delivery/shipped/0003-omni-loop-kit';
    const { ctx } = makeRepo({ files: { [`${shipped}/spec.md`]: '---\ntitle: The kit\n---\n' } });
    const folder = readDossierFolder(ctx, parsePrd(3));
    assertDefined(folder, 'folder');
    expect(folder.dir).toBe(shipped);
    expect(folder.title).toBe('The kit');
  });

  it('is null for a PRD with no folder', () => {
    const { ctx } = makeRepo();
    expect(readDossierFolder(ctx, parsePrd(99))).toBeNull();
  });
});

describe('readFixFolder (PRD 627)', () => {
  const VISUAL = '.omni-loop/delivery/visual/0548-omni-links-new-tab';
  const BUGS = '.omni-loop/delivery/bugs/0571-number-args';
  const round = (k: number) => `<!doctype html>\n<title>Round ${k}</title>\n`;

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
    const folder = readFixFolder(ctx, 'visual', parseIssue(548));
    assertDefined(folder, 'folder');
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
    const folder = readFixFolder(ctx, 'bug', parseIssue(571));
    assertDefined(folder, 'folder');
    expect(folder.artifacts.map(({ kind, path }) => ({ kind, path }))).toEqual([{ kind: 'bug-record', path: `${BUGS}/bug.md` }]);
  });

  it('titles the fix after its issue without its Visual: or Bug: prefix, else after the folder\'s topic', () => {
    const { ctx } = makeRepo({ files: { [`${VISUAL}/before-after.html`]: PAGE, [`${BUGS}/bug.md`]: '# Bug\n' } });
    const fixFolder = readFixFolder(ctx, 'visual', parseIssue(548), { issueTitle: 'Visual: Omni links open in a new tab' });
    assertDefined(fixFolder, 'the fix folder');
    expect(fixFolder.title).toBe('Omni links open in a new tab');
    const fixFolder2 = readFixFolder(ctx, 'bug', parseIssue(571), { issueTitle: 'Bug: omni reads 1e2 as a number' });
    assertDefined(fixFolder2, 'the fix folder');
    expect(fixFolder2.title).toBe('omni reads 1e2 as a number');
    const fixFolder3 = readFixFolder(ctx, 'visual', parseIssue(548), { issueTitle: 'Links in a new tab' });
    assertDefined(fixFolder3, 'the fix folder');
    expect(fixFolder3.title).toBe('Links in a new tab');
    const fixFolder4 = readFixFolder(ctx, 'visual', parseIssue(548));
    assertDefined(fixFolder4, 'the fix folder');
    expect(fixFolder4.title).toBe('omni-links-new-tab');
    const fixFolder5 = readFixFolder(ctx, 'bug', parseIssue(571), { issueTitle: '  ' });
    assertDefined(fixFolder5, 'the fix folder');
    expect(fixFolder5.title).toBe('number-args');
    expect(fixTitle(`Visual: ${'t'.repeat(250)}`, 'topic')).toBe('t'.repeat(200));
  });

  it('skips a file over 512 KiB, naming it, and still reads the others', () => {
    const big = 'x'.repeat(ARTIFACT_MAX_BYTES + 1);
    const { ctx } = makeRepo({ files: { [`${VISUAL}/before-after.html`]: PAGE, [`${VISUAL}/variations-r1.html`]: big } });
    const folder = readFixFolder(ctx, 'visual', parseIssue(548));
    assertDefined(folder, 'folder');
    expect(folder.artifacts.map((a) => a.kind)).toEqual(['before-after']);
    expect(folder.tooLarge).toEqual([{ kind: 'variations', path: `${VISUAL}/variations-r1.html`, bytes: big.length }]);
  });

  it('is null for an issue with no folder of its kind, and never reads another issue\'s', () => {
    const { ctx } = makeRepo({ files: { [`${VISUAL}/before-after.html`]: PAGE, '.omni-loop/delivery/visual/5480-other/before-after.html': PAGE } });
    expect(readFixFolder(ctx, 'bug', parseIssue(548))).toBeNull();
    expect(readFixFolder(ctx, 'visual', parseIssue(54))).toBeNull();
    const fixFolder = readFixFolder(ctx, 'visual', parseIssue(548));
    assertDefined(fixFolder, 'the fix folder');
    expect(fixFolder.dir).toBe(VISUAL);
  });
});

describe('readConceptFolder (PRD 1272)', () => {
  const CONCEPT = '.omni-loop/delivery/inbox/concepts/1269-products-umbrella';
  const RECORD = [
    '---', 'concept: 1269', 'title: Products replace plan repositories', 'kind: platform', 'scale: vast', '---', '',
    ...['The brief', 'The vision', 'Why this one', 'Killed and why', 'Fuel'].flatMap((name) => [`## ${name}`, '', `What ${name} says.`, '']),
    '## Areas', '', '| id | area | brief | PRD |', '|---|---|---|---|',
    '| server-approval | Server approval | Approve on the page | |', '| products | Products | The umbrella | |', '',
  ].join('\n');
  const files = (extra: Record<string, string> = {}) => ({
    [`${CONCEPT}/concept.md`]: RECORD,
    [`${CONCEPT}/vision.html`]: '<p>tour</p>',
    [`${CONCEPT}/board-r2.html`]: 'board 2',
    [`${CONCEPT}/board-r10.html`]: 'board 10',
    [`${CONCEPT}/board-r1.html`]: 'board 1',
    [`${CONCEPT}/debate.md`]: '# Debate',
    ...extra,
  });

  it('reads the record, the vision tour, each board a round in numeric order and the debate, titled from the front matter', () => {
    const { ctx } = makeRepo({ files: files() });
    const read = readConceptFolder(ctx, parseIssue(1269));
    assertDefined(read, 'the concept folder');
    if (!read.ok) throw new Error(read.errors.join('; '));
    const { folder } = read;
    expect(folder.dir).toBe(CONCEPT);
    expect(folder.title).toBe('Products replace plan repositories');
    expect(folder.artifacts.map(({ kind, path, round: k }) => ({ kind, path, round: k }))).toEqual([
      { kind: 'concept-record', path: `${CONCEPT}/concept.md`, round: undefined },
      { kind: 'vision', path: `${CONCEPT}/vision.html`, round: undefined },
      { kind: 'board', path: `${CONCEPT}/board-r1.html`, round: 1 },
      { kind: 'board', path: `${CONCEPT}/board-r2.html`, round: 2 },
      { kind: 'board', path: `${CONCEPT}/board-r10.html`, round: 10 },
      { kind: 'debate', path: `${CONCEPT}/debate.md`, round: undefined },
    ]);
    expect(folder.artifacts[0]).toMatchObject({ content: RECORD, sha256: sha256(RECORD), bytes: Buffer.byteLength(RECORD) });
    expect(folder.tooLarge).toEqual([]);
  });

  it('sends the rest when there is no vision.html', () => {
    const { ctx } = makeRepo({ files: Object.fromEntries(Object.entries(files()).filter(([path]) => !path.endsWith('/vision.html'))) });
    const read = readConceptFolder(ctx, parseIssue(1269));
    assertDefined(read, 'the concept folder');
    if (!read.ok) throw new Error(read.errors.join('; '));
    expect(read.folder.artifacts.map((a) => a.kind)).toEqual(['concept-record', 'board', 'board', 'board', 'debate']);
  });

  it('names a file over 512 KiB as too large and sends the others', () => {
    const big = 'x'.repeat(ARTIFACT_MAX_BYTES + 1);
    const { ctx } = makeRepo({ files: files({ [`${CONCEPT}/board-r2.html`]: big }) });
    const read = readConceptFolder(ctx, parseIssue(1269));
    assertDefined(read, 'the concept folder');
    if (!read.ok) throw new Error(read.errors.join('; '));
    expect(read.folder.artifacts.map((a) => a.round ?? a.kind)).toEqual(['concept-record', 'vision', 1, 10, 'debate']);
    expect(read.folder.tooLarge).toEqual([{ kind: 'board', path: `${CONCEPT}/board-r2.html`, bytes: big.length }]);
  });

  it('refuses a concept.md the parser refuses, or one missing, naming its errors', () => {
    const { ctx } = makeRepo({ files: files({ [`${CONCEPT}/concept.md`]: RECORD.replace('kind: platform', 'kind: rocket') }) });
    const read = readConceptFolder(ctx, parseIssue(1269));
    assertDefined(read, 'the concept folder');
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.errors.join('\n')).toMatch(/kind/);

    const { ctx: none } = makeRepo({ files: { [`${CONCEPT}/vision.html`]: '<p>tour</p>' } });
    const missing = readConceptFolder(none, parseIssue(1269));
    expect(missing).toMatchObject({ ok: false, errors: [expect.stringMatching(/concept\.md/)] });
  });

  it('refuses a concept.md that names another concept', () => {
    const { ctx } = makeRepo({ files: files({ [`${CONCEPT}/concept.md`]: RECORD.replace('concept: 1269', 'concept: 746') }) });
    expect(readConceptFolder(ctx, parseIssue(1269))).toMatchObject({ ok: false, errors: [expect.stringMatching(/746/)] });
  });

  it('is null for an issue with no concept folder', () => {
    const { ctx } = makeRepo({ files: files() });
    expect(readConceptFolder(ctx, parseIssue(126))).toBeNull();
    expect(readConceptFolder(makeRepo({ files: {} }).ctx, parseIssue(1269))).toBeNull();
  });
});
