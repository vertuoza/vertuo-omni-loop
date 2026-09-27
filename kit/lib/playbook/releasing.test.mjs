// PRD 262, slice s1: the `releasing` form's optional `notes` slot — the voice of a release note. Its
// kit default states the note's rules and shows three example notes, each one a note the check
// passes; `omni kb show releasing` prints it wherever a repository leaves the slot out or blank.
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.mjs';
import { formText, makeRepo } from '../../test/fixture.mjs';
import { DESCRIPTION_MAX, gradeReleaseNote, INITIAL_VERSION, parseReleaseNote, TITLE_MAX } from '../releases/note.mjs';
import { FORMS, parseForm } from './forms.mjs';
import { formTemplate } from './templates.mjs';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const RELEASING = '.omni-loop/knowledge/playbook/releasing.md';

const notesSlot = () => parseForm(formTemplate('releasing')).form.slots.find((slot) => slot.id === 'notes');

/** Every fenced block of `text`, as its inner text. */
const fencedBlocks = (text) => [...text.matchAll(/^```[a-z]*\n([\s\S]*?)^```$/gm)].map(([, inner]) => inner);

async function omni(root, argv) {
  const out = [];
  const err = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('the releasing form’s notes slot', () => {
  it('is the form’s last slot, optional', () => {
    expect(FORMS.find((form) => form.id === 'releasing').slots.at(-1)).toEqual({ id: 'notes', required: false });
    expect(notesSlot()).toMatchObject({ id: 'notes', heading: 'Release notes', required: false });
  });

  it('states the note’s rules in its kit default', () => {
    const text = notesSlot().body.text;
    for (const rule of ['release.md', `${TITLE_MAX} characters`, `${DESCRIPTION_MAX} characters`, `version: ${INITIAL_VERSION}`, 'omni check releases', 'releaseNotes.enabled']) {
      expect(text, rule).toContain(rule);
    }
  });

  it('shows three example notes, each one the check passes', () => {
    const examples = fencedBlocks(notesSlot().body.text);
    expect(examples).toHaveLength(3);
    for (const example of examples) {
      const parsed = parseReleaseNote(example);
      expect(parsed.ok, example).toBe(true);
      expect(parsed.note.version, example).toBeNull();
      expect(gradeReleaseNote(example, { prd: parsed.note.prd }), example).toEqual([]);
    }
  });
});

describe('omni kb show releasing', () => {
  it('prints the notes slot’s kit default when the repository has no releasing form', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, out } = await omni(root, ['kb', 'show', 'releasing']);
    expect(code).toBe(0);
    expect(out.match(/^## .*$/gm)).toEqual([
      '## What a merge publishes  [kit default]',
      '## How a release happens  [kit default]',
      '## Rollback  [kit default]',
      '## Release notes  [kit default]',
    ]);
    expect(out).toContain(`## Release notes  [kit default]\n${notesSlot().body.text}\n`);
  });

  it('prints it for a filled form written before the slot existed, and the repository’s own voice when it has one', async () => {
    const slots = [{ id: 'publishes', heading: 'What a merge publishes', required: true, body: 'A merge ships the site.' }];
    const before = formText({ frontMatter: { form: 'releasing', state: 'filled' }, title: 'Releasing', opener: 'Use this page when you need to know what a merge publishes.', slots });
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [RELEASING]: before } });
    const shown = await omni(root, ['kb', 'show', 'releasing']);
    expect(shown.code).toBe(0);
    expect(shown.out).toContain(`## Release notes  [kit default]\n${notesSlot().body.text}\n`);
    expect((await omni(root, ['check', 'kb'])).code).toBe(0);

    const own = formText({
      frontMatter: { form: 'releasing', state: 'filled' },
      title: 'Releasing',
      opener: 'Use this page when you need to know what a merge publishes.',
      slots: [...slots, { id: 'notes', heading: 'Release notes', body: 'Write for the finance team.' }],
    });
    const { root: mine } = makeRepo({ git: true, files: { ...CONFIG, [RELEASING]: own } });
    expect((await omni(mine, ['kb', 'show', 'releasing'])).out).toContain('## Release notes  [repo]\nWrite for the finance team.\n');
    expect((await omni(mine, ['check', 'kb'])).code).toBe(0);
  });
});
