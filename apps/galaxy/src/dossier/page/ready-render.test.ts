import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readyView, type ReadyRow } from './ready';
import { ReadyPanel } from './ReadyPanel';

// The Ready panel (PRD 2898 s9) at 5 of 5 and at 4 of 5: the failing check named at the top, each check
// linking its evidence, each AC with its lines, kind, proof and state. Every name and link is fictional.

const TITLES = ['CI green on the latest commit', 'Full tests and lint ran', 'Every acceptance criterion has its proof', 'No test was loosened', 'The change stayed in its area'];
const IDS = ['ci', 'full', 'acceptance', 'loosening', 'area'];
const check = (at: number, state: ReadyRow['checks'][number]['state'], why = '') => ({
  id: IDS[at] ?? 'x', title: TITLES[at] ?? 'x', state, why, evidence: `https://github.com/acme/widgets/actions/runs/${String(8800 + at)}`, excused: [],
});
const CRITERIA: ReadyRow['criteria'] = [
  { number: 1, kind: 'test', scenario: 'The screen follows the theme', lines: ['Scenario: x', 'Given a member who picked Dark', 'When they open a quote', 'Then it is drawn in Dark'], proof: 'https://github.com/acme/widgets/blob/a41f9c2/t.test.ts', state: 'passed' },
  { number: 2, kind: 'e2e', scenario: 'The switch is kept', lines: ['Given a member', 'When they switch to Light', 'Then it stays Light'], proof: null, state: 'pending' },
];
const BASE: ReadyRow = {
  repo: 'acme/widgets', prd: 2803, pr_number: 2817, head_sha: 'a41f9c2'.padEnd(40, '0'), state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5',
  checks: [0, 1, 2, 3, 4].map((at) => check(at, 'pass')), criteria: CRITERIA, decided_at: '2026-11-15T07:00:00Z',
};
const render = (row: ReadyRow | null) => renderToStaticMarkup(createElement(ReadyPanel, { ready: readyView(row) }));
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the Ready panel', () => {
  it('draws nothing with no verdict', () => {
    expect(render(null)).toBe('');
  });

  it('at 5 of 5 says ready, not merged, and offers Review PR', () => {
    const html = render(BASE);
    const text = textOf(html);
    expect(text).toContain('Ready for review · 5 of 5');
    expect(text).toContain('Ready for review, not merged.');
    expect(text).toContain('Only a person merges.');
    expect(html).toContain('href="https://github.com/acme/widgets/pull/2817"');
    expect(text).toContain('Review PR 2817');
    for (const run of [8800, 8801, 8802, 8803, 8804]) expect(html).toContain(`actions/runs/${String(run)}`);
    expect(text).toContain('Omni App · a41f9c2 · 07:00 UTC');
  });

  it('lists each AC with its kind, its three lines, its proof and its state', () => {
    const text = textOf(render(BASE));
    expect(text).toContain('AC-1 test The screen follows the theme Pass');
    expect(text).toContain('Given a member who picked Dark');
    expect(text).toContain('Then it is drawn in Dark');
    expect(text).toContain('AC-2 e2e The switch is kept Waiting no proof yet');
  });

  it('at 4 of 5 names the failing check at the top and stays a draft', () => {
    const checks = BASE.checks.map((c, at) => (at === 3 ? check(3, 'fail', 'quote-theme.test.ts adds .skip') : c));
    const html = render({ ...BASE, state: 'not ready', passed: 4, checks });
    const text = textOf(html);
    expect(text).toContain('Not ready · 4 of 5');
    expect(text.indexOf('Failed: No test was loosened')).toBeLessThan(text.indexOf('CI green on the latest commit'));
    expect(text).toContain('quote-theme.test.ts adds .skip');
    expect(text).toContain('Stays a draft.');
    expect(text).not.toContain('Review PR');
  });

  it('never draws a waiting or not judged check as passed, and never says merged as a state', () => {
    const checks = BASE.checks.map((c, at) => (at === 1 ? check(1, 'not finished', 'test still running') : at === 4 ? check(4, 'not judged', 'the plan is unreadable') : c));
    const html = render({ ...BASE, state: 'not finished', passed: 3, checks });
    const text = textOf(html);
    expect(text).toContain('Not finished · 3 of 5 so far');
    expect(text).toContain('Waiting');
    expect(text).toContain('Not judged · the plan is unreadable');
    expect(html.match(/is-pass/g)).toHaveLength(3);
    expect(text.match(/merged/gi)).toBeNull();
  });

  it('draws only https links', () => {
    const checks = BASE.checks.map((c, at) => (at === 0 ? { ...c, evidence: 'javascript:alert(1)' } : c));
    expect(render({ ...BASE, checks })).not.toContain('javascript:');
  });
});
