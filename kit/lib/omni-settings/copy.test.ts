// PRD 2417, s1: the local copy of the Omni settings' tech playbook — written from a settings
// repository's files and where they came from, read back, and read by the knowledge tree's resolver
// as the [omni settings] level (acceptance criterion 2).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { formText, makeRepo } from '../../test/fixture.ts';
import { levelFolder } from '../knowledge-tree/levels.ts';
import { resolveForm } from '../playbook/resolve.ts';
import { formTemplate } from '../playbook/templates.ts';
import { readSettingsCopy, SETTINGS_COPY_RECORD, writeSettingsCopy } from './copy.ts';
import { curatedDefault } from './curated.ts';
import { formOfSettingsPath, settingsFilePath } from './layout.ts';
import type { SettingsFile, SettingsSource } from './schema.ts';

const COPY = levelFolder('omni settings');
const SOURCE: SettingsSource = { repository: 'acme/settings', commit: 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0', readAt: '2026-10-23T08:00:00.000Z' };
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\ncommands:\n  test: make check\n' };

/** A settings repository's checkout holding `files` (form to text) in its settings folder. */
function settingsCheckout(files: Record<string, string>) {
  const placed = Object.fromEntries(Object.entries(files).map(([form, text]) => [settingsFilePath(form) ?? `.omni-loop/settings/playbook/${form}.md`, text]));
  return makeRepo({ files: placed });
}

/** What a settings checkout serves: each file of its settings folder, as the route reads it. */
function served(root: string): SettingsFile[] {
  const walk = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
  return walk('.omni-loop/settings')
    .sort()
    .flatMap((path) => {
      const form = formOfSettingsPath(path);
      return form ? [{ form, text: readFileSync(join(root, path), 'utf8') }] : [];
    });
}

/** A filled testing page holding `body` in its never slot. */
const testingPage = (body: string, frontMatter: Record<string, unknown> = {}) =>
  formText({ frontMatter: { state: 'filled', ...frontMatter }, slots: [{ id: 'never', heading: 'Never', required: true, body }] });

/** Runs `omni <argv>` in `root`: `{ code, out, err }`. */
async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('writeSettingsCopy — the round trip from a settings checkout to the tree’s Omni settings level', () => {
  it('writes each page where the resolver reads it, and the record of where it came from', () => {
    const settings = settingsCheckout(Object.fromEntries(curatedDefault().map(({ form, text }) => [form, text])));
    const { root, ctx } = makeRepo();
    const write = writeSettingsCopy({ root, files: served(settings.root), source: SOURCE });
    expect(write).toEqual({ folder: COPY, written: ['bug-fixing', 'definition-of-done', 'review', 'verification'], skipped: [] });
    for (const form of write.written) expect(existsSync(join(root, COPY, 'playbook', `${form}.md`))).toBe(true);
    expect(readSettingsCopy({ root })).toEqual({ state: 'copied', ...SOURCE, forms: write.written, skipped: [] });

    const review = resolveForm('review', { ctx, template: formTemplate('review') });
    expect(review.problems).toEqual([]);
    expect(review.sections.map(({ slot, label }) => `${slot ?? ''} ${label}`)).toEqual(['fix [omni settings]', 'push-back [omni settings]', 'ask [omni settings]']);
    expect(review.sections[0]?.text).toMatch(/^Fix the comment, commit, and reply on its thread with the commit/);
  });

  it('keeps each page as the settings repository wrote it, only its owner line out of the front matter', () => {
    const [file] = curatedDefault();
    if (!file) throw new Error('no curated page');
    const { root } = makeRepo();
    writeSettingsCopy({ root, files: [file], source: SOURCE });
    const copied = readFileSync(join(root, COPY, 'playbook', `${file.form}.md`), 'utf8');
    expect(copied).not.toMatch(/^owner:/m);
    expect(copied.slice(copied.indexOf('\n---\n'))).toBe(file.text.slice(file.text.indexOf('\n---\n')));
  });

  it('writes the decisions form beside the decision records, as a knowledge folder lays it out', () => {
    const decisions = formText({ frontMatter: { form: 'decisions', state: 'filled' }, title: 'Decisions', slots: [{ id: 'where', required: true, body: 'Settings: under adr/.' }] });
    const { root } = makeRepo();
    expect(writeSettingsCopy({ root, files: [{ form: 'decisions', text: decisions }], source: SOURCE }).written).toEqual(['decisions']);
    expect(readFileSync(join(root, COPY, 'adr/README.md'), 'utf8')).toBe(decisions);
  });

  it('keeps the copy out of git: the local folder carries its own .gitignore', () => {
    const { root } = makeRepo();
    writeSettingsCopy({ root, files: [], source: SOURCE });
    expect(readFileSync(join(root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('skips a page that is not a form the kit reads, names why, and writes the rest', () => {
    const { root } = makeRepo();
    const write = writeSettingsCopy({
      root,
      source: SOURCE,
      files: [
        { form: 'testing', text: testingPage('Settings: never sleep.') },
        { form: 'deploying', text: testingPage('x') },
        { form: 'review', text: testingPage('x') },
        { form: 'verification', text: '# Verification\n' },
        { form: 'bug-fixing', text: testingPage('x', { form: 'bug-fixing', owner: 'alice' }) },
        { form: 'testing', text: testingPage('Settings: the second one.') },
      ],
    });
    expect(write.written).toEqual(['testing']);
    expect(write.skipped).toEqual([
      { form: 'deploying', reason: 'deploying is not a form the kit reads' },
      { form: 'review', reason: 'its front matter says form: testing' },
      { form: 'verification', reason: 'missing its front matter (a "---" fenced header)' },
      { form: 'bug-fixing', reason: 'owner: a list of GitHub logins, or null for the law owners' },
      { form: 'testing', reason: 'appears twice: the first is kept' },
    ]);
    expect(readdirSync(join(root, COPY, 'playbook'))).toEqual(['testing.md']);
    expect(readFileSync(join(root, COPY, 'playbook/testing.md'), 'utf8')).toContain('Settings: never sleep.');
    expect(readSettingsCopy({ root })).toMatchObject({ state: 'copied', forms: ['testing'], skipped: write.skipped });
  });

  it('replaces the last copy’s playbook whole: a page the settings repository dropped leaves the copy, its other knowledge stays', () => {
    const { root, write: put } = makeRepo();
    put(`${COPY}/product/principles.md`, 'the product side of this level\n');
    put(`${COPY}/adr/0001-a-decision.md`, 'a decision record\n');
    const decisions = formText({ frontMatter: { form: 'decisions', state: 'filled' }, title: 'Decisions', slots: [{ id: 'where', required: true, body: 'x' }] });
    writeSettingsCopy({ root, files: [...curatedDefault(), { form: 'decisions', text: decisions }], source: SOURCE });
    const later = { ...SOURCE, commit: 'b2c3d4e', readAt: '2026-10-24T08:00:00.000Z' };
    writeSettingsCopy({ root, files: [{ form: 'testing', text: testingPage('Settings: later.') }], source: later });
    expect(readdirSync(join(root, COPY, 'playbook'))).toEqual(['testing.md']);
    expect(existsSync(join(root, COPY, 'adr/README.md'))).toBe(false);
    expect(readFileSync(join(root, COPY, 'adr/0001-a-decision.md'), 'utf8')).toBe('a decision record\n');
    expect(readFileSync(join(root, COPY, 'product/principles.md'), 'utf8')).toBe('the product side of this level\n');
    expect(readSettingsCopy({ root })).toEqual({ state: 'copied', ...later, forms: ['testing'], skipped: [] });
  });

  it('refuses a source that does not say where the files came from: a caller’s mistake, nothing written', () => {
    const { root } = makeRepo();
    expect(() => writeSettingsCopy({ root, files: [], source: { ...SOURCE, commit: 'main' } })).toThrow(/commit/);
    expect(existsSync(join(root, COPY))).toBe(false);
  });
});

describe('readSettingsCopy — the record of the last copy', () => {
  it('is absent with no copy, and unreadable when its record is not one', () => {
    const { root, write } = makeRepo();
    expect(readSettingsCopy({ root })).toEqual({ state: 'absent' });
    write(`${COPY}/${SETTINGS_COPY_RECORD}`, '{ not json');
    expect(readSettingsCopy({ root })).toEqual({ state: 'unreadable' });
    write(`${COPY}/${SETTINGS_COPY_RECORD}`, JSON.stringify({ repository: 'acme/settings' }));
    expect(readSettingsCopy({ root })).toEqual({ state: 'unreadable' });
  });
});

describe('omni kb show — a form the repository does not write reads the Omni settings’ copy (acceptance criterion 2)', () => {
  it('prints the settings text of review tagged [omni settings], in a repository without its own review page', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeSettingsCopy({ root, files: curatedDefault(), source: SOURCE });
    const { code, out, err } = await omni(root, ['kb', 'show', 'review']);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out.match(/^## .*$/gm)).toEqual(['## Fix  [omni settings]', '## Push back  [omni settings]', '## Ask  [omni settings]']);
    expect(out).toContain('## Fix  [omni settings]\nFix the comment, commit, and reply on its thread with the commit, when it names a defect:\n');
  });

  it('prints exactly what it prints today with no copy, and with a copy that does not set the form', async () => {
    const today = await omni(makeRepo({ git: true, files: CONFIG }).root, ['kb', 'show', 'review']);
    expect(today.out.match(/^## .*$/gm)).toEqual(['## Fix  [kit default]', '## Push back  [kit default]', '## Ask  [kit default]']);
    const { root } = makeRepo({ git: true, files: CONFIG });
    writeSettingsCopy({ root, files: [{ form: 'testing', text: testingPage('Settings: never sleep.') }], source: SOURCE });
    expect(await omni(root, ['kb', 'show', 'review'])).toEqual(today);
  });

  it('a repository’s own page still wins over the copy', async () => {
    const own = formText({
      frontMatter: { form: 'review', state: 'filled' },
      title: 'Review',
      slots: [{ id: 'fix', heading: 'Fix', required: true, body: 'Ours: fix every bug.' }],
    });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/knowledge/playbook/review.md': own } });
    writeSettingsCopy({ root, files: curatedDefault(), source: SOURCE });
    const { out } = await omni(root, ['kb', 'show', 'review']);
    expect(out.match(/^## .*$/gm)).toEqual(['## Fix  [repo]', '## Push back  [omni settings]', '## Ask  [omni settings]']);
    expect(out).toContain('## Fix  [repo]\nOurs: fix every bug.\n');
  });
});
