import { describe, expect, it } from 'vitest';
import { withExcerptsOf, withoutExcerpts } from './excerpts.ts';

const red = { label: 'e2e on abc1234 in s1', url: 'https://github.com/acme/widget/actions/runs/1/job/2', excerpt: 'Error: timed out' };
const other = { label: 'e2e on def5678 in s2', url: 'https://github.com/acme/widget/actions/runs/3/job/4', excerpt: 'Error: refused' };
const sheet = {
  kinds: { ci: { redRuns: [{ id: 2, check: 'e2e', log: 'read', excerpt: 'Error: timed out' }], totals: { red: 1 } } },
  findings: [
    { id: 'repeated-red:e2e', evidence: [red, other] },
    { id: 'flaky:e2e', evidence: [red, { label: 'e2e green', url: null }] },
  ],
};

describe('withoutExcerpts', () => {
  it('leaves out every excerpt, at any depth, and keeps everything else', () => {
    const lean = withoutExcerpts(sheet);
    expect(JSON.stringify(lean)).not.toContain('excerpt');
    expect(lean).toEqual({
      kinds: { ci: { redRuns: [{ id: 2, check: 'e2e', log: 'read' }], totals: { red: 1 } } },
      findings: [
        { id: 'repeated-red:e2e', evidence: [{ label: red.label, url: red.url }, { label: other.label, url: other.url }] },
        { id: 'flaky:e2e', evidence: [{ label: red.label, url: red.url }, { label: 'e2e green', url: null }] },
      ],
    });
    expect(sheet.findings[0]?.evidence[0]).toEqual(red);
  });
});

describe('withExcerptsOf', () => {
  it('puts each excerpt back on the item it was taken from: the sheet as it was', () => {
    expect(withExcerptsOf(withoutExcerpts(sheet), sheet)).toEqual(sheet);
  });

  it('matches an item whatever the order of its keys, as the ledger’s jsonb gives them back', () => {
    const reordered = { findings: [{ evidence: [{ url: red.url, label: red.label }], id: 'repeated-red:e2e' }] };
    expect(withExcerptsOf(reordered, sheet)).toEqual({ findings: [{ id: 'repeated-red:e2e', evidence: [red] }] });
  });

  it('puts back no excerpt on an item the new sheet no longer holds, and keeps an excerpt already there', () => {
    const saved = { findings: [{ id: 'x', evidence: [{ label: 'gone', url: null }, { label: 'kept', url: null, excerpt: 'mine' }] }] };
    expect(withExcerptsOf(saved, sheet)).toEqual(saved);
  });

  it('gives back the saved value itself when the new sheet holds no excerpt', () => {
    const lean = withoutExcerpts(sheet);
    expect(withExcerptsOf(lean, lean)).toBe(lean);
  });
});
