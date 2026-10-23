// PRD 2416, s3: `omni kb show decisions` reads the records through the knowledge tree, bottom-up,
// and names each record's level beside it once another level contributes one.
import { describe, expect, it } from 'vitest';
import { readDecisions, levelOf } from '../lib/playbook/decisions.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\ncommands:\n  test: make check\n' };
const ADR = '.omni-loop/knowledge/adr';
const PLAN = '.omni-loop/local/tree/plan-repo/adr';
const SETTINGS = '.omni-loop/local/tree/omni-settings/adr';

async function show(root: string, ...more: string[]) {
  const out: string[] = [];
  const code = await main(['kb', 'show', 'decisions', ...more], { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => undefined } });
  const text = out.join('');
  return { code, records: text.slice(text.indexOf('## Records')) };
}

describe('readDecisions — the records through the knowledge tree (PRD 2416)', () => {
  it('lists the repository’s records first, then the plan repository’s and the Omni settings’ it does not hold', () => {
    const { ctx } = makeRepo({
      config: {},
      files: {
        [`${ADR}/0001-own.md`]: '# 0001 — Own\n',
        [`${PLAN}/0001-plan.md`]: '# 0001 — Plan’s clash\n',
        [`${PLAN}/0002-plan.md`]: '# 0002 — Plan’s\n',
        [`${SETTINGS}/0002-settings.md`]: '# 0002 — Settings’ clash\n',
        [`${SETTINGS}/0003-settings.md`]: '# 0003 — Settings’\n',
      },
    });
    const { records, next, shared } = readDecisions({ ctx });
    expect(records.map((record) => [levelOf(record), record.number, record.title])).toEqual([
      ['repo', '0001', '0001 — Own'],
      ['plan repo', '0002', '0002 — Plan’s'],
      ['omni settings', '0003', '0003 — Settings’'],
    ]);
    expect(shared).toEqual([]);
    expect(next).toBe('0002');
  });

  it('reads the repository alone when no other level is present, its records carrying no level key', () => {
    const { ctx } = makeRepo({ files: { [`${ADR}/0001-own.md`]: '# 0001 — Own\n' } });
    expect(readDecisions({ ctx }).records).toEqual([{ number: '0001', file: `${ADR}/0001-own.md`, title: '0001 — Own', prd: null }]);
  });
});

describe('omni kb show decisions — acceptance criteria 4 and 5', () => {
  it('acceptance 4: prints each record’s level beside it, the repository’s own first', async () => {
    const { root } = makeRepo({
      git: true,
      files: { ...CONFIG, [`${ADR}/0005-own.md`]: '# 0005 — Own\n', [`${PLAN}/0001-plan.md`]: '# 0001 — Plan’s\n', [`${SETTINGS}/0002-s.md`]: '# 0002 — Settings’\n' },
    });
    const { code, records } = await show(root);
    expect(code).toBe(0);
    expect(records).toBe(
      [
        `## Records  [read live from ${ADR}]`,
        '0005  0005 — Own  [repo]',
        '0001  0001 — Plan’s  [plan repo]',
        '0002  0002 — Settings’  [omni settings]',
        'Next free number: 0006',
        '',
      ].join('\n'),
    );
  });

  it('acceptance 5: with no other level the lines are exactly as before, untagged', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [`${ADR}/0001-own.md`]: '# 0001 — Own\n' } });
    const { records } = await show(root);
    expect(records).toBe(`## Records  [read live from ${ADR}]\n0001  0001 — Own\nNext free number: 0002\n`);
  });

  it('keeps the latest 20 of the repository’s records and every inherited one', async () => {
    const own = Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`${ADR}/${String(i + 1).padStart(4, '0')}-a.md`, `# R${String(i + 1)}\n`]));
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...own, [`${PLAN}/0100-p.md`]: '# P\n' } });
    const { records } = await show(root);
    expect(records).toContain('0003  R3  [repo]');
    expect(records).not.toContain('0002  R2');
    expect(records).toContain('… 2 older records: omni kb show decisions --all');
    expect(records).toContain('0100  P  [plan repo]');
  });
});
