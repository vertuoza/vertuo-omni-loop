// The nightly mutation workflow's alert, read from .github/workflows/mutation.yml: the `score` job alone
// may write issues, and its last step keeps the red-night issue on `main` whatever came before,
// red unless every shard finished and the score held, assigned to the laws' owners. Nothing here runs
// the workflow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dig, digText } from '../kit/bin/dig.ts';

const text = readFileSync(fileURLToPath(new URL('../.github/workflows/mutation.yml', import.meta.url)), 'utf8');
const workflow: unknown = parse(text);
const score = dig(workflow, 'jobs', 'score');
const steps = dig(score, 'steps');
const last = Array.isArray(steps) ? steps.length - 1 : 0;

describe('the mutation workflow’s alert', () => {
  it('lets the score job alone write issues; the workflow itself only reads', () => {
    expect(dig(workflow, 'permissions')).toEqual({ contents: 'read' });
    expect(dig(score, 'permissions')).toEqual({ contents: 'read', issues: 'write' });
    expect(dig(workflow, 'jobs', 'mutate', 'permissions')).toBeUndefined();
  });

  it('keeps the issue last, whatever failed before it, and only on main', () => {
    expect(digText(score, 'steps', last, 'name')).toBe('Keep the red-night issue');
    expect(digText(score, 'steps', last, 'if')).toBe("always() && github.ref == 'refs/heads/main'");
  });

  it('is green only when every shard finished and the score held', () => {
    expect(digText(score, 'steps', last, 'env', 'STATE')).toBe("${{ (needs.mutate.result == 'success' && steps.score.outcome == 'success') && 'green' || 'red' }}");
    const scored: unknown = Array.isArray(steps) ? steps.find((step: unknown) => dig(step, 'name') === 'Score against the floors') : undefined;
    expect(digText(scored, 'id')).toBe('score');
  });

  it('runs the alert script with the score table, assigning each of the laws’ owners, on the run’s own token', () => {
    const run = digText(score, 'steps', last, 'run');
    expect(run).toContain('node scripts/mutation-alert.ts');
    expect(run).toContain('--score score.md');
    expect(run).toContain('config laws.owners');
    expect(digText(score, 'steps', last, 'env', 'GH_TOKEN')).toBe('${{ github.token }}');
    expect(text).not.toMatch(/secrets\./);
  });
});
