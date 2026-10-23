// PRD 2417, s1 (acceptance criterion 4): the curated first default the kit ships for a settings
// repository's tech playbook — review (fix, push back, ask), the definition of done, verification
// before a push, and bug fixing — each a form the forms' own parser reads, every section filled.
import { describe, expect, it } from 'vitest';
import { FORMS, parseForm } from '../playbook/forms.ts';
import { readTemplates } from '../playbook/templates.ts';
import { CURATED_FORMS, curatedDefault } from './curated.ts';
import { readSettingsPage } from './page.ts';
import { SettingsFileSchema } from './schema.ts';

/** Each curated page, read as the copy keeps it. */
const pages = () =>
  curatedDefault().map((file) => {
    const read = readSettingsPage(file);
    if (!read.ok) throw new Error(`${file.form}: ${read.reason}`);
    return read.page;
  });

describe('the curated first default', () => {
  it('holds review, the definition of done, verification and bug fixing, and nothing else', () => {
    expect(CURATED_FORMS).toEqual(['review', 'definition-of-done', 'verification', 'bug-fixing']);
    expect(curatedDefault().map(({ form }) => form)).toEqual(CURATED_FORMS);
    const shipped = Object.keys(readTemplates()).filter((path) => path.startsWith('omni-settings/'));
    expect(shipped.sort()).toEqual(CURATED_FORMS.map((form) => `omni-settings/playbook/${form}.md`).sort());
  });

  it('is served as settings files, each the text of its template under the kit’s omni-settings folder', () => {
    const templates = readTemplates();
    for (const file of curatedDefault()) {
      expect(SettingsFileSchema.parse(file)).toEqual(file);
      expect(file.text).toBe(templates[`omni-settings/playbook/${file.form}.md`]);
    }
  });

  it('carries an owner line on every page, null: the law owners of the settings repository', () => {
    for (const file of curatedDefault()) expect(file.text).toMatch(/^---\n[\s\S]*^owner: null$[\s\S]*^---$/m);
    expect(pages().map(({ owners }) => owners)).toEqual(CURATED_FORMS.map(() => null));
  });

  for (const form of CURATED_FORMS) {
    it(`${form}: a filled form declaring exactly its slots, in order, each holding text, no open question and no config placeholder`, () => {
      const page = pages().find((entry) => entry.form === form);
      const parsed = parseForm(page?.text ?? '');
      expect(parsed.errors ?? []).toEqual([]);
      expect(parsed.form).toMatchObject({ id: form, state: 'filled', pointsTo: null, evidence: [], invaded: null, unmarked: [] });
      const spec = FORMS.find((entry) => entry.id === form);
      expect(parsed.form?.slots.map(({ id, required }) => ({ id, required }))).toEqual(spec?.slots.map(({ id, required }) => ({ id, required })));
      for (const slot of parsed.form?.slots ?? []) {
        expect(slot.body.kind, `${form}#${slot.id}`).toBe('text');
        expect(slot.body.questions, `${form}#${slot.id}`).toEqual([]);
        expect(slot.body.text, `${form}#${slot.id}`).not.toMatch(/\{config:|TODO\(human\)/);
      }
    });
  }

  it('review answers a comment three ways: fix, push back, ask', () => {
    const review = parseForm(pages().find((entry) => entry.form === 'review')?.text ?? '').form;
    expect(review?.slots.map(({ heading }) => heading)).toEqual(['Fix', 'Push back', 'Ask']);
  });
});
