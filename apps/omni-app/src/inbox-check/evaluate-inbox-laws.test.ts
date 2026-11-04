import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { evaluateInbox, type Gate, type LawsGrader } from './evaluate-inbox.ts';

// The sixth gate, `business laws` (PRD 2632 s5), through an injected judge: red, green and neutral, and a
// phase-0 PR with no judge wired unchanged. The canon gate is not wired here: it is neutral.

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const TRAILER = 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const FOLDER = '.omni-loop/delivery/inbox/0042-widget';

const args = (laws?: LawsGrader | null) => ({
  base: join(FIXTURES, 'inbox-base'),
  head: join(FIXTURES, 'inbox-head-complete'),
  pr: { headRef: 'docs/phase-0-widget' },
  repo: 'acme/widgets',
  changes: ['spec.md', 'plan.md', 'before-after.html'].map((file) => ({ path: `${FOLDER}/${file}`, status: 'A' })),
  commits: [{ sha: 'c1', message: `docs(phase-0): widget\n\n${TRAILER}` }],
  issue: { number: parseIssue(42), state: 'open', labels: ['omni:prd'], isPullRequest: false },
  ...(laws === undefined ? {} : { laws }),
});

const grader = (gate: Gate) => ({ grade: vi.fn<LawsGrader['grade']>(() => Promise.resolve(gate)) });

describe('evaluateInbox — the business laws gate, sixth', () => {
  it('red: the check fails, names the gate in its title and lists the law, its Why and the quote', async () => {
    const laws = grader({
      name: 'business laws',
      ok: false,
      title: 'business laws ✗ 1',
      reason: '1 law broken: BL-QUOTES-1',
      details: ['BL-QUOTES-1: A quote is sent only with a total above zero.', 'Why: An empty quote loses the customer.', 'The spec says: "a complete PRD folder"'],
    });
    const verdict = await evaluateInbox(args(laws));
    expect(verdict?.conclusion).toBe('failure');
    expect(verdict?.gates.at(-1)).toMatchObject({ name: 'business laws', ok: false });
    expect(verdict?.title).toBe('Not ok: business laws ✗ 1');
    expect(verdict?.summary).toContain('- not ok — business laws: 1 law broken: BL-QUOTES-1');
    expect(verdict?.summary).toContain('  - Why: An empty quote loses the customer.');
    expect(verdict?.summary).toContain('  - The spec says: "a complete PRD folder"');
  });

  it('is asked for the PR\'s repository and the PRD\'s spec.md', async () => {
    const laws = grader({ name: 'business laws', ok: true, reason: '3 judged · Quotes' });
    await evaluateInbox(args(laws));
    expect(laws.grade).toHaveBeenCalledOnce();
    expect(laws.grade).toHaveBeenCalledWith({ repo: 'acme/widgets', spec: expect.stringContaining('A phase-0 fixture') });
  });

  it('green: counted among the judged gates', async () => {
    const verdict = await evaluateInbox(args(grader({ name: 'business laws', ok: true, reason: '3 judged · Quotes' })));
    expect(verdict?.conclusion).toBe('success');
    expect(verdict?.summary).toContain('- ok — business laws: 3 judged · Quotes');
  });

  it('neutral: ok, and never counts as judged', async () => {
    const verdict = await evaluateInbox(args(grader({ name: 'business laws', ok: true, neutral: true, reason: 'not judged: the repository has no law home' })));
    expect(verdict?.conclusion).toBe('success');
    expect(verdict?.summary).toContain('- neutral — business laws: not judged: the repository has no law home');
  });

  it('with no judge wired the five gates are as they were', async () => {
    const verdict = await evaluateInbox(args());
    expect(verdict?.gates.map((gate) => gate.name)).toEqual(['phase-0 verdict', 'inbox folder', 'plan', 'PRD issue', 'canon']);
    expect(verdict?.summary).not.toContain('business laws');
  });
});
