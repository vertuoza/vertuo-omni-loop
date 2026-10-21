// The playbook as one line per rule (lines.ts), the retro judge's view of it: a bold headline with
// the sentence after it, else a first sentence, each line named by its slot; tables, code and
// quotes are no rule; a form missing or unreadable gives nothing.
import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { parseForm } from './forms.ts';
import { formLines, LINE_MAX, playbookLines } from './lines.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const RULES = [
  '- **A migration stays the newest until it merges.** `supabase db push` refuses a migration dated',
  '  before the newest one production applied. Re-date it after each merge.',
  '- Never hand-edit a generated file. Rebuild it.',
  '',
  'New server code logs through `kit/lib/log`, never a bare `console` string (ADR-0102). More here.',
  '',
  '| a | table |',
  '|---|---|',
  '',
  '```sh',
  'pnpm test',
  '```',
].join('\n');

function form(body: string | undefined, id = 'conventions') {
  const parsed = parseForm(formText({ frontMatter: { form: id, state: 'filled' }, slots: [{ id: 'naming', body }] }));
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  return parsed.form;
}

describe('formLines', () => {
  it('one line per top-level bullet or bullet-less paragraph, named by its slot', () => {
    expect(formLines(form(RULES))).toEqual([
      { id: 'playbook/conventions#naming', line: 'A migration stays the newest until it merges. `supabase db push` refuses a migration dated before the newest one production applied.' },
      { id: 'playbook/conventions#naming', line: 'Never hand-edit a generated file.' },
      { id: 'playbook/conventions#naming', line: 'New server code logs through `kit/lib/log`, never a bare `console` string (ADR-0102).' },
    ]);
  });

  it('a blank or question-only slot gives no line', () => {
    expect(formLines(form(undefined))).toEqual([]);
    expect(formLines(form('TODO(human): which runner?'))).toEqual([]);
  });

  it('cuts a line past LINE_MAX characters, marking the cut', () => {
    const [only] = formLines(form(`- ${'word '.repeat(80)}`));
    expect(only?.line).toHaveLength(LINE_MAX);
    expect(only?.line.endsWith('…')).toBe(true);
  });
});

describe('playbookLines', () => {
  it('reads every form the playbook holds, and skips one missing or unreadable', () => {
    const { root, ctx } = makeRepo({
      files: {
        '.omni-loop/knowledge/playbook/conventions.md': formText({ frontMatter: { form: 'conventions', state: 'filled' }, slots: [{ id: 'naming', body: '- **One rule.** Its reason.' }] }),
        '.omni-loop/knowledge/playbook/testing.md': '# no front matter\n\n- a rule nobody can read\n',
      },
    });
    roots.push(root);
    expect(playbookLines({ ctx })).toEqual([{ id: 'playbook/conventions#naming', line: 'One rule. Its reason.' }]);
  });
});
