// PRD 2338, s3: a kept lesson's outcome, recorded in its PRD's retro.json and retro.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../../test/fixture.ts';
import { parsePrd } from '../ids.ts';
import { recordOutcome, withOutcomeLine } from './record-outcome.ts';
import type { LessonOutcome } from './outcome.ts';

const D = '.omni-loop/delivery';
const JSON_FILE = `${D}/shipped/0042-a/retro.json`;
const MD_FILE = `${D}/shipped/0042-a/retro.md`;
const TESTING = { '.omni-loop/knowledge/playbook/testing.md': formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', required: true, by: 'human', body: '- A test never calls the network.' }] }) };
const RED = 'repeated-red:check';
const CHURN = 'churn:a.ts';
const STAYS: LessonOutcome = { staysHere: 'a rule says it' };
const LINE = '- **Stays here:** a rule says it';

function json(runs: unknown[]): string {
  return `${JSON.stringify({ prd: 42, runs }, null, 2)}\n`;
}

const merge = { run: 'merge', issues: { [RED]: { number: 101 }, [CHURN]: { number: 102 } } };
const MARKDOWN = [`# Retro`, '', `### F1 · One — \`${RED}\` · [#101](u)`, '', '- a', '- b', '', `### F2 · Two — \`${CHURN}\``, '', '- c', ''].join('\n');

function record(files: Record<string, string>, finding = RED, outcome: LessonOutcome = STAYS) {
  const { ctx, root } = makeRepo({ files: { ...TESTING, ...files } });
  const result = recordOutcome({ ctx, prd: parsePrd(42), finding, outcome });
  const read = (file: string) => readFileSync(join(root, file), 'utf8');
  return { result, read };
}

describe('recordOutcome', () => {
  it('writes the outcome under the run that kept the lesson and its line, naming both files', () => {
    const { result, read } = record({ [JSON_FILE]: json([merge]), [MD_FILE]: MARKDOWN });
    expect(result).toEqual({ ok: true, json: JSON_FILE, markdown: MD_FILE });
    expect(read(JSON_FILE)).toBe(json([{ ...merge, outcomes: { [RED]: STAYS } }]));
    expect(read(MD_FILE)).toBe(MARKDOWN.replace('- b\n', `- b\n${LINE}\n`));
  });

  it('writes under the latest run that kept the lesson, beside outcomes already there, other keys untouched', () => {
    const first = { run: 'merge', issues: { [RED]: { number: 101 } }, extra: 1 };
    const second = { run: 'day-14', issues: { [RED]: { number: 101 }, [CHURN]: { number: 102 } }, outcomes: { [CHURN]: STAYS } };
    const { result, read } = record({ [JSON_FILE]: json([first, second]) });
    expect(result).toEqual({ ok: true, json: JSON_FILE, markdown: null });
    expect(read(JSON_FILE)).toBe(json([first, { ...second, outcomes: { [CHURN]: STAYS, [RED]: STAYS } }]));
  });

  it('skips runs with no issues, and issues that are no record, when it looks for the lesson', () => {
    const { result, read } = record({ [JSON_FILE]: json([{ run: 'a' }, { run: 'b', issues: 'x', outcomes: 'x' }, merge, { run: 'c', issues: {}, outcomes: {} }]) });
    expect(result.ok).toBe(true);
    expect(JSON.parse(read(JSON_FILE))).toMatchObject({ runs: [{ run: 'a' }, { run: 'b' }, { outcomes: { [RED]: STAYS } }, { outcomes: {} }] });
  });

  it('keeps the file as it was when it refuses', () => {
    const files = { [JSON_FILE]: json([{ ...merge, outcomes: { [RED]: STAYS } }]), [MD_FILE]: MARKDOWN };
    const cases: Array<[string, LessonOutcome, string]> = [
      [RED, { staysHere: 'again' }, `PRD 42, lesson \`${RED}\` already has an outcome — an outcome is never rewritten`],
      ['nope', STAYS, 'PRD 42 kept no lesson for `nope`'],
      [CHURN, { staysHere: ' ' }, 'stays here with no reason'],
      [CHURN, { became: 'playbook/testing#levels' }, 'became playbook/testing#levels does not resolve — .omni-loop/knowledge/playbook/testing.md has no slot "levels"'],
    ];
    for (const [finding, outcome, reason] of cases) {
      const { result, read } = record(files, finding, outcome);
      expect(result, reason).toEqual({ ok: false, reason });
      expect(read(JSON_FILE)).toBe(files[JSON_FILE]);
      expect(read(MD_FILE)).toBe(MARKDOWN);
    }
  });

  it('sees an outcome any run gives, not only the one that kept the lesson', () => {
    const later = { run: 'day-14', outcomes: { [RED]: STAYS } };
    expect(record({ [JSON_FILE]: json([merge, later]) }).result).toMatchObject({ ok: false });
    expect(record({ [JSON_FILE]: json([{ ...merge, outcomes: { [RED]: STAYS } }, { run: 'x' }]) }).result).toMatchObject({ ok: false });
  });

  it('refuses a PRD with no folder, no retro.json, an unreadable one and one with no runs', () => {
    expect(record({}).result).toEqual({ ok: false, reason: `PRD 42 has no folder in ${D}/inbox or ${D}/shipped` });
    expect(record({ [`${D}/shipped/0042-a/spec.md`]: 'x' }).result).toEqual({ ok: false, reason: `${JSON_FILE} is missing — PRD 42 has no retro` });
    const broken = record({ [JSON_FILE]: '{' }).result;
    expect(broken).toMatchObject({ ok: false, reason: expect.stringMatching(new RegExp(`^${JSON_FILE} is not a retro record — `)) });
    expect(record({ [JSON_FILE]: '[]' }).result).toMatchObject({ ok: false, reason: expect.stringMatching(new RegExp(`^${JSON_FILE} is not a retro record — `)) });
    expect(record({ [JSON_FILE]: '{"runs":3}' }).result).toMatchObject({ ok: false, reason: expect.stringMatching(new RegExp(`^${JSON_FILE} is not a retro record — runs: `)) });
  });

  it('writes the json and leaves retro.md alone when it has no such finding', () => {
    const { result, read } = record({ [JSON_FILE]: json([merge]), [MD_FILE]: '# Retro\n' });
    expect(result).toEqual({ ok: true, json: JSON_FILE, markdown: null });
    expect(read(MD_FILE)).toBe('# Retro\n');
  });
});

describe('withOutcomeLine', () => {
  const heading = (tail: string) => `### F1 · One — \`${RED}\`${tail}`;

  it('adds the line after the last line of the finding, before the next heading of any of the first three levels', () => {
    for (const next of ['### F2', '## Other', '# Top']) {
      expect(withOutcomeLine(['# T', heading(''), '', '- a', '- b', '', next, '- z'].join('\n'), RED, LINE)).toBe(['# T', heading(''), '', '- a', '- b', LINE, '', next, '- z'].join('\n'));
    }
  });

  it('goes on through a deeper heading, and ends at the end of the text', () => {
    expect(withOutcomeLine([heading(''), '#### deeper', '- a'].join('\n'), RED, LINE)).toBe([heading(''), '#### deeper', '- a', LINE].join('\n'));
    expect(withOutcomeLine([heading(''), '- a', ''].join('\n'), RED, LINE)).toBe([heading(''), '- a', LINE, ''].join('\n'));
  });

  it('puts the line right under a heading with nothing under it, and skips whitespace-only lines at the end', () => {
    expect(withOutcomeLine([heading(''), '', '', '### n'].join('\n'), RED, LINE)).toBe([heading(''), LINE, '', '', '### n'].join('\n'));
    expect(withOutcomeLine([heading(''), '- a', '  ', '\t', '### n'].join('\n'), RED, LINE)).toBe([heading(''), '- a', LINE, '  ', '\t', '### n'].join('\n'));
  });

  it('finds the finding by its id after the dash, as the heading ends or goes on with the issue link', () => {
    expect(withOutcomeLine(heading(' · [#1](u)'), RED, LINE)).toBe(`${heading(' · [#1](u)')}\n${LINE}`);
    expect(withOutcomeLine(heading(''), RED, LINE)).toBe(`${heading('')}\n${LINE}`);
  });

  it('matches only a heading line of that exact finding', () => {
    expect(withOutcomeLine(`- x — \`${RED}\``, RED, LINE)).toBeNull();
    expect(withOutcomeLine(`## F1 — \`${RED}\``, RED, LINE)).toBeNull();
    expect(withOutcomeLine(heading(' extra'), RED, LINE)).toBeNull();
    expect(withOutcomeLine(`### F1 · \`${RED}\``, RED, LINE)).toBeNull();
    expect(withOutcomeLine(heading(''), CHURN, LINE)).toBeNull();
    expect(withOutcomeLine('', RED, LINE)).toBeNull();
  });
});
