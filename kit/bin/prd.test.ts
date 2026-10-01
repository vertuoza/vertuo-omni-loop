// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: vertuoza/vertuo-automation-plan\n' };
const DIR = '.omni-loop/delivery/inbox/0007-quote';

const MULTI = [
  '# Plan',
  '',
  '## Repositories',
  '',
  '| repo | role | read at | knowledge |',
  '| --- | --- | --- | --- |',
  '| vertuo-backend-php | back-end | 3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4 | imported (stale) |',
  '| vertuo-apps | front-end | 9b01e44c2d7a3f5e8b6c1d0a9f8e7d6c5b4a3921 | own |',
  '',
  '## Slices',
  '',
  '| id | repo | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- | --- |',
  '| s1 | vertuo-apps | the screen | `apps/quote/` | s2 | 2 |',
  '| s2 | vertuo-backend-php | the total | `src/Quote/` | — | 1 |',
  '',
].join('\n');

const ORDINARY = [
  '# Plan',
  '',
  '| id | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- |',
  '| s1 | Alpha | `a/` | — | 1 |',
  '',
].join('\n');

async function prdOut(files) {
  const { root } = makeRepo({ git: true, files: { ...CONFIG, [`${DIR}/spec.md`]: 'x', ...files } });
  const s = io();
  const code = await main(['prd', '7'], { cwd: root, ...s });
  return { code, text: s.out.join('') };
}

function expectedLines(files) {
  return [
    'PRD 7 — 0007-quote',
    'state: inbox',
    `dir: ${DIR}`,
    'files:',
    ...files.map((file) => `  - ${DIR}/${file}`),
    'outbox: .omni-loop/delivery/outbox/0007-quote',
    'open items: none',
  ];
}

describe('omni prd', () => {
  it('prints a repos line, in ## Repositories order, for a plan with a repo column', async () => {
    const { code, text } = await prdOut({ [`${DIR}/plan.md`]: MULTI });
    expect(code).toBe(0);
    expect(text).toMatch(/^repos: vertuo-backend-php, vertuo-apps$/m);
    expect(text.trimEnd().split('\n')).toEqual([...expectedLines(['plan.md', 'spec.md']), 'repos: vertuo-backend-php, vertuo-apps']);
  });

  it('prints no repos line and every other line as before for an ordinary plan', async () => {
    const { code, text } = await prdOut({ [`${DIR}/plan.md`]: ORDINARY });
    expect(code).toBe(0);
    expect(text).not.toMatch(/repos:/);
    expect(text.trimEnd().split('\n')).toEqual(expectedLines(['plan.md', 'spec.md']));
  });

  it('prints no repos line for a PRD with no plan', async () => {
    const { code, text } = await prdOut({});
    expect(code).toBe(0);
    expect(text).not.toMatch(/repos:/);
    expect(text.trimEnd().split('\n')).toEqual(expectedLines(['spec.md']));
  });

  it('prints no repos line when the plan cannot be parsed', async () => {
    const { code, text } = await prdOut({ [`${DIR}/plan.md`]: '# Plan\n\nno table yet\n' });
    expect(code).toBe(0);
    expect(text).not.toMatch(/repos:/);
  });

  it('names the repositories in slice order when a repo column has no ## Repositories table', async () => {
    const plan = MULTI.split('## Slices')[1];
    const { code, text } = await prdOut({ [`${DIR}/plan.md`]: `# Plan\n${plan}` });
    expect(code).toBe(0);
    expect(text).toMatch(/^repos: vertuo-apps, vertuo-backend-php$/m);
  });
});
