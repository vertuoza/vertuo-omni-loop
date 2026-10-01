// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { gradePlaybook } from './check-playbook.ts';
import { staleEvidence } from './status.ts';

const FILE = '.omni-loop/knowledge/playbook/testing.md';
const refuse = () => {
  throw new Error('git is not here');
};
const hashes = (map) => (command, args) => `${map[args.at(-1)]}\n`;

/** The grade's lines about `FILE` only: every other form is missing, which is not what these test. */
function grade(files, exec = refuse) {
  const { ctx } = makeRepo({ files });
  const result = gradePlaybook({ ctx, exec });
  const mine = (line) => line.startsWith(`${FILE}:`);
  return { ...result, violations: result.violations.filter(mine), warnings: result.warnings.filter(mine) };
}

const TESTING = [
  { id: 'commands', required: true, body: '`make check`' },
  { id: 'layout', required: true, body: 'Beside the code.' },
  { id: 'never', required: true, body: 'A test never sleeps.' },
];

describe('gradePlaybook', () => {
  it('warns on an evidence file git cannot hash, rather than failing', () => {
    const { violations, warnings } = grade({ [FILE]: formText({ frontMatter: { evidence: ['a.json@abcdef1'] }, slots: TESTING }), 'a.json': '{}' });
    expect(violations).toEqual([]);
    expect(warnings).toEqual([`${FILE}: evidence a.json@abcdef1 could not be hashed`]);
  });

  it('reports the parser’s errors for a form that does not parse, and grades it no further', () => {
    const text = formText({ slots: [...TESTING, { id: 'data', marker: '<!-- slot: data -->', body: 'TODO(human): x?' }] });
    const { violations, warnings, forms } = grade({ [FILE]: text });
    expect(violations).toEqual([expect.stringMatching(new RegExp(`^${FILE}: "## Data": malformed slot marker`))]);
    expect(warnings).toEqual([]);
    expect(forms.find((form) => form.form === 'testing').state).toBe('invalid');
  });

  it('lists the questions of a pointer form, and asks it for no section', () => {
    const pointer = formText({ frontMatter: { state: 'pointer', 'points-to': 'guides' }, slots: [{ id: 'data', body: 'TODO(human): which fixtures?' }] });
    const { violations, warnings } = grade({ [FILE]: pointer, 'guides/a.md': 'a' });
    expect(violations).toEqual([]);
    expect(warnings).toEqual([`${FILE}: "## Data" TODO(human): which fixtures?`]);
  });

  it('asks the template, not the marker, whether a slot is required', () => {
    const optional = TESTING.map((slot) => ({ ...slot, required: false, body: slot.id === 'never' ? '' : slot.body }));
    const { violations, warnings } = grade({ [FILE]: formText({ slots: optional }) });
    expect(violations).toEqual([]);
    expect(warnings).toEqual([`${FILE}: required slot "never" is blank — the kit default applies`]);
  });
});

describe('staleEvidence', () => {
  it('is quiet for a file whose hash starts with the recorded hex, and names a changed, gone or unhashable one', () => {
    const { ctx } = makeRepo({ files: { 'a.json': '{}', 'b.json': '{}' } });
    const evidence = [
      { path: 'a.json', hash: 'abcdef1' },
      { path: 'b.json', hash: '1234567' },
      { path: 'gone.json', hash: '7654321' },
    ];
    expect(staleEvidence(evidence, { ctx, exec: hashes({ 'a.json': 'abcdef1999', 'b.json': 'ffff000' }) })).toEqual([
      { path: 'b.json', hash: '1234567', now: 'ffff000', exists: true },
      { path: 'gone.json', hash: '7654321', now: null, exists: false },
    ]);
    expect(staleEvidence(evidence.slice(0, 1), { ctx, exec: refuse })).toEqual([{ path: 'a.json', hash: 'abcdef1', now: null, exists: true }]);
  });
});
