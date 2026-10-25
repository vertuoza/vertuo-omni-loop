// PRD 2417, s1: one page of a settings repository's tech playbook, read as the copy keeps it — its
// `owner:` line apart, the rest the forms' own parser reads — and where it lies.
import { describe, expect, it } from 'vitest';
import { formText } from '../../test/fixture.ts';
import { parseForm } from '../playbook/forms.ts';
import { formOfSettingsPath, formRelativePath, SETTINGS_DIR, settingsFilePath } from './layout.ts';
import { ownersOf, readSettingsPage } from './page.ts';

/** A testing page holding one filled slot, its front matter extended by `frontMatter`. */
const page = (frontMatter: Record<string, unknown> = {}) =>
  formText({ frontMatter: { state: 'filled', ...frontMatter }, slots: [{ id: 'never', required: true, body: 'Never sleep in a test.' }] });

describe('the settings folder — where a settings repository keeps its tech playbook', () => {
  it('is .omni-loop/settings/, laid out as a knowledge folder: playbook/<form>.md, and the decisions form at adr/README.md', () => {
    expect(SETTINGS_DIR).toBe('.omni-loop/settings');
    expect(settingsFilePath('review')).toBe('.omni-loop/settings/playbook/review.md');
    expect(settingsFilePath('decisions')).toBe('.omni-loop/settings/adr/README.md');
    expect(formRelativePath('review')).toBe('playbook/review.md');
    expect(formRelativePath('decisions')).toBe('adr/README.md');
  });

  it('names no path for a form the kit does not have', () => {
    expect(settingsFilePath('deploying')).toBeNull();
    expect(formRelativePath('deploying')).toBeNull();
  });

  it('reads a path back to its form, and no form from any other path', () => {
    expect(formOfSettingsPath('.omni-loop/settings/playbook/bug-fixing.md')).toBe('bug-fixing');
    expect(formOfSettingsPath('.omni-loop/settings/adr/README.md')).toBe('decisions');
    expect(formOfSettingsPath('.omni-loop/settings/playbook/decisions.md')).toBeNull();
    expect(formOfSettingsPath('.omni-loop/settings/playbook/deploying.md')).toBeNull();
    expect(formOfSettingsPath('.omni-loop/knowledge/playbook/review.md')).toBeNull();
    expect(formOfSettingsPath('.omni-loop/settings/playbook/review.txt')).toBeNull();
  });
});

describe('readSettingsPage — a page as the copy keeps it', () => {
  it('reads owner: null as no owner named, and leaves the copy’s text for the forms’ parser, owner line gone', () => {
    const read = readSettingsPage({ form: 'testing', text: page({ owner: null }) });
    expect(read).toMatchObject({ ok: true, page: { form: 'testing', owners: null } });
    if (!read.ok) throw new Error(read.reason);
    expect(read.page.text).not.toMatch(/^owner:/m);
    const parsed = parseForm(read.page.text);
    expect(parsed.errors ?? []).toEqual([]);
    expect(parsed.form?.slots.map(({ id, body }) => `${id}: ${body.text}`)).toEqual(['never: Never sleep in a test.']);
  });

  it('keeps the body byte for byte: only the owner line leaves the front matter', () => {
    const text = page({ owner: ['alice'] });
    const read = readSettingsPage({ form: 'testing', text });
    if (!read.ok) throw new Error(read.reason);
    const body = (t: string) => t.slice(t.indexOf('\n---\n') + 5);
    expect(body(read.page.text)).toBe(body(text));
    expect(read.page.text).toContain('form: testing\n');
    expect(read.page.text).toContain('state: filled\n');
  });

  it('reads the logins an owner line names, a leading @ dropped', () => {
    const read = readSettingsPage({ form: 'testing', text: page({ owner: ['@alice', 'bob-smith'] }) });
    expect(read).toMatchObject({ ok: true, page: { owners: ['alice', 'bob-smith'] } });
  });

  it('reads a page with no owner line as naming none, and leaves its text as it is', () => {
    const text = page();
    expect(readSettingsPage({ form: 'testing', text })).toEqual({ ok: true, page: { form: 'testing', owners: null, text } });
  });

  it.each([
    ['a form the kit does not have', { form: 'deploying', text: page() }, 'deploying is not a form the kit reads'],
    ['a page of another form than its file', { form: 'review', text: page() }, 'its front matter says form: testing'],
    ['an owner that names no login', { form: 'testing', text: page({ owner: 'alice' }) }, 'owner: a list of GitHub logins, or null for the law owners'],
    ['an owner holding something else than logins', { form: 'testing', text: page({ owner: ['not a login'] }) }, 'owner: a list of GitHub logins, or null for the law owners'],
    ['an empty owner list', { form: 'testing', text: page({ owner: [] }) }, 'owner: a list of GitHub logins, or null for the law owners'],
    ['a page with no front matter', { form: 'testing', text: '# Testing\n' }, 'missing its front matter'],
    ['front matter that is not YAML', { form: 'testing', text: '---\nform: [\n---\n# Testing\n' }, 'front matter is not YAML'],
    ['a front matter key the forms do not have', { form: 'testing', text: page({ colour: 'red' }) }, 'colour'],
  ])('refuses %s, naming why', (_case, file, reason) => {
    const read = readSettingsPage(file);
    expect(read.ok).toBe(false);
    expect(read.ok ? '' : read.reason).toContain(reason);
  });
});

describe('ownersOf — who approves a change to a page', () => {
  it('is the logins its owner line names, else the law owners', () => {
    expect(ownersOf({ owners: ['alice'] }, { lawOwners: ['carol'] })).toEqual(['alice']);
    expect(ownersOf({ owners: null }, { lawOwners: ['carol', 'dan'] })).toEqual(['carol', 'dan']);
  });
});
