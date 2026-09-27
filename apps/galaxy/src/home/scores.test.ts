import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';

// `server-only` refuses to load outside a server bundle; the reader is exercised here on plain Node.
vi.mock('server-only', () => ({}));
const { countHighScores, NO_SCORE } = await import('./scores');

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const SHIPPED = '.omni-loop/delivery/shipped';

/** A plan whose slice table holds one row per id. */
function plan(...ids: string[]) {
  const rows = ids.map((id) => `| ${id} | a slice | \`apps/x/${id}\` | — | 1 |`);
  return ['# Plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', ...rows, '', 'After the table.', ''].join('\n');
}

/** One settled entry, as the kit writes it. */
function entry(id: string, verdict: string) {
  return [
    `<!-- omni-outbox-settled: ${id} -->`,
    '',
    `## ${id} — ${verdict}`,
    '',
    `- Verdict: ${verdict}`,
    '- Rank: medium',
    '',
    '### The answer, as it was given',
    '',
    '```text',
    'Adopted.',
    '```',
    '',
    '### The item, as it was raised',
    '',
    '```text',
    `id: ${id}`,
    '```',
    '',
    `<!-- /omni-outbox-settled: ${id} -->`,
    '',
  ].join('\n');
}

function settled(...entries: [string, string][]) {
  return ['# Settled outbox items', '', ...entries.map(([id, verdict]) => entry(id, verdict))].join('\n');
}

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

/** A temporary checkout holding `files`, and the app's folder inside it. */
function checkout(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'omni-scores-'));
  roots.push(root);
  for (const [path, text] of Object.entries({ 'apps/galaxy/package.json': '{}\n', ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return { root, app: join(root, 'apps/galaxy') };
}

/** Two shipped PRDs: five slices between them, three decisions adopted. */
const TWO_SHIPPED = {
  '.omni-loop/config.yml': CONFIG,
  [`${SHIPPED}/0003-kit/plan.md`]: plan('s1', 's2', 's3'),
  [`${SHIPPED}/0003-kit/outbox/settled.md`]: settled(['s1-01-a', 'adopted'], ['s1-02-b', 'agreed'], ['s2-01-c', 'adopted']),
  [`${SHIPPED}/0007-skills/plan.md`]: plan('s1', 's2'),
  [`${SHIPPED}/0007-skills/outbox/settled.md`]: settled(['s1-01-d', 'adopted'], ['s2-01-e', 'drifted']),
};

describe('countHighScores — the high scores, counted from the shipped delivery folder', () => {
  it('counts the shipped PRDs, the rows of their slice tables and the decisions adopted', () => {
    const { app } = checkout(TWO_SHIPPED);
    const log = vi.fn();
    expect(countHighScores({ cwd: app, log })).toEqual({ prdsShipped: 2, slicesMerged: 5, decisionsAdopted: 3 });
    expect(log).not.toHaveBeenCalled();
  });

  it('counts an item adopted then objected to by its latest entry only', () => {
    const { app } = checkout({
      ...TWO_SHIPPED,
      [`${SHIPPED}/0007-skills/outbox/settled.md`]: settled(['s1-01-d', 'adopted'], ['s1-01-d', 'drifted']),
    });
    expect(countHighScores({ cwd: app, log: vi.fn() }).decisionsAdopted).toBe(2);
  });

  it('ignores anything in the folder that is not a PRD folder', () => {
    const { app } = checkout({ ...TWO_SHIPPED, [`${SHIPPED}/README.md`]: '# Shipped\n', [`${SHIPPED}/notes/plan.md`]: plan('s1') });
    expect(countHighScores({ cwd: app, log: vi.fn() })).toEqual({ prdsShipped: 2, slicesMerged: 5, decisionsAdopted: 3 });
  });

  it('counts zero of everything when nothing has shipped yet', () => {
    const { app } = checkout({ '.omni-loop/config.yml': CONFIG, [`${SHIPPED}/.keep`]: '' });
    expect(countHighScores({ cwd: app, log: vi.fn() })).toEqual({ prdsShipped: 0, slicesMerged: 0, decisionsAdopted: 0 });
  });

  it('shows — for every counter when the shipped folder is missing', () => {
    const { app } = checkout({ '.omni-loop/config.yml': CONFIG });
    const log = vi.fn();
    expect(countHighScores({ cwd: app, log })).toEqual({ prdsShipped: NO_SCORE, slicesMerged: NO_SCORE, decisionsAdopted: NO_SCORE });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('shows — for every counter when no Omni Loop config is found', () => {
    const { app } = checkout({});
    expect(countHighScores({ cwd: app, log: vi.fn() })).toEqual({ prdsShipped: NO_SCORE, slicesMerged: NO_SCORE, decisionsAdopted: NO_SCORE });
  });

  it('shows — for the slices only when a shipped plan has no slice table', () => {
    const { app } = checkout({ ...TWO_SHIPPED, [`${SHIPPED}/0007-skills/plan.md`]: '# Plan\n\nNo table here.\n' });
    const log = vi.fn();
    expect(countHighScores({ cwd: app, log })).toEqual({ prdsShipped: 2, slicesMerged: NO_SCORE, decisionsAdopted: 3 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('0007-skills'));
  });

  it('shows — for the slices only when a shipped plan is missing', () => {
    const { app, root } = checkout(TWO_SHIPPED);
    rmSync(join(root, SHIPPED, '0003-kit/plan.md'));
    expect(countHighScores({ cwd: app, log: vi.fn() })).toEqual({ prdsShipped: 2, slicesMerged: NO_SCORE, decisionsAdopted: 3 });
  });

  it('shows — for the decisions only when a shipped settled.md is missing', () => {
    const { app, root } = checkout(TWO_SHIPPED);
    rmSync(join(root, SHIPPED, '0003-kit/outbox/settled.md'));
    const log = vi.fn();
    expect(countHighScores({ cwd: app, log })).toEqual({ prdsShipped: 2, slicesMerged: 5, decisionsAdopted: NO_SCORE });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('0003-kit'));
  });

  it('reads the delivery folder the config names', () => {
    const { app } = checkout({
      '.omni-loop/config.yml': `${CONFIG}paths:\n  delivery: docs/delivery\n`,
      'docs/delivery/shipped/0003-kit/plan.md': plan('s1'),
      'docs/delivery/shipped/0003-kit/outbox/settled.md': settled(['s1-01-a', 'adopted']),
    });
    expect(countHighScores({ cwd: app, log: vi.fn() })).toEqual({ prdsShipped: 1, slicesMerged: 1, decisionsAdopted: 1 });
  });

  it("reads this repository's own shipped folder: every counter a number", () => {
    const log = vi.fn();
    const scores = countHighScores({ cwd: process.cwd(), log });
    expect(log).not.toHaveBeenCalled();
    for (const score of Object.values(scores)) expect(typeof score).toBe('number');
  });

  it('never invents a number: — is not a count', () => {
    expect(NO_SCORE).toBe('—');
  });
});
