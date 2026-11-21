import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { KeptVerdict } from '../../business-laws/verdicts.repository';
import { APPROVAL_ROUTE, LAWS_HOLD, type ApprovalView, type ApproveScreen } from '../page/approval';
import { approvalBody, postApproval } from '../page/ApproveButton';
import type { ReadyView } from '../page/ready';
import { pinnedOf, planLine, reviewKindOf, reviewPath, reviewWords } from './review';
import { ReviewPage, type ReviewPageProps } from './ReviewPage';

// The review screen (PRD omni-loop-20 s5): which signed decision waits on the viewer, the screen it opens in
// reading order, and its decision, which posts exactly what the PRD page's Approve and Give Tech Approval post.
// Every PRD, person and law here is fictional.

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push }) }));

const SCREEN: ApproveScreen = {
  diffs: [{ path: 'spec.md', rows: [{ sign: '-', text: 'Quotes are sent by email.' }, { sign: '+', text: 'Quotes are sent by email or post.' }] }],
  sections: [{ name: 'Problem', html: '<p>Quotes get lost.</p>' }, { name: 'Solution', html: '<p>Send them twice.</p>' }],
  spec: 'read',
};

const APPROVAL: ApprovalView = {
  state: 'drifted', words: 'drifted · approve again', detail: 'spec.md changed since ada approved it · 9 Oct 2026, 09:12 UTC',
  changed: ['spec.md'], canApprove: true, dossier: 'd-1', screen: SCREEN, seal: null, tech: null, canRequestTech: false,
};

const RED: KeptVerdict = {
  specVersion: 'v-1', lawHome: 'acme/plan', packSha: 'c'.repeat(40), state: 'red', reason: '1 law broken', laws: ['BL-QUOTES-1'],
  domains: [{ key: 'quotes', name: 'Quotes', reasons: ['"Quote"'] }],
  findings: [{ law: 'BL-QUOTES-1', statement: 'A quote is sent only above zero.', why: 'Trust.', quote: 'a zero quote is sent', domain: 'quotes', file: 'business-laws.md', owners: ['ana'] }],
  judgedAt: '2026-12-01T09:00:00Z',
};

const TECH: NonNullable<ApprovalView['tech']> = {
  state: 'asked', name: 'Bo', canGive: true, screen: { diffs: [], sections: [], spec: 'read' }, seal: null, waiting: null,
};

const READY: ReadyView = {
  tone: 'pass', title: 'Ready for review · 5 of 5', sign: 'Omni App · abc1234 · 09:40 UTC', named: null,
  checks: [
    { name: 'CI is green', tone: 'pass', mark: '✓', state: 'Pass', evidence: 'https://github.com/acme/app/actions/runs/1', note: null, criteria: [] },
    {
      name: 'Every criterion is proven', tone: 'pass', mark: '✓', state: 'Pass', evidence: null, note: null,
      criteria: [{ id: 'AC-1', kind: 'test', title: 'a quote is sent', tone: 'pass', state: 'Pass', proof: 'https://github.com/acme/app/blob/abc/quote.test.ts', steps: [{ keyword: 'Given', text: 'a quote' }] }],
    },
  ],
  foot: { lines: ['Ready for review, not merged.', 'Only a person merges.'], strong: true, action: { label: 'Review PR 42', href: 'https://github.com/acme/app/pull/42' } },
};

const PROPS: ReviewPageProps = {
  kind: 'approve', dossier: { id: 'd-1', title: 'Quotes by post', label: 'PRD 7' }, me: 'Cy', approval: APPROVAL, ready: null,
  pinned: pinnedOf([{ kind: 'spec' }, { kind: 'spec' }, { kind: 'plan' }, { kind: 'before-after' }, { kind: 'voice' }]),
  plan: 'Plan v1 · 3 slices', planMarkdown: null,
};

const render = (props: Partial<ReviewPageProps>) => renderToStaticMarkup(createElement(ReviewPage, { ...PROPS, ...props }));
const at = (html: string, text: string) => {
  const found = html.indexOf(text);
  expect(found, text).toBeGreaterThan(-1);
  return found;
};

describe('which decision waits on the viewer', () => {
  it('is the Tech Approval for the person it names, then Approve, then the feature once ready, else none', () => {
    expect(reviewKindOf({ canApprove: false, tech: TECH }, READY)).toBe('tech');
    expect(reviewKindOf({ canApprove: true, tech: null }, READY)).toBe('approve');
    expect(reviewKindOf({ canApprove: false, tech: { ...TECH, canGive: false } }, READY)).toBe('feature');
    expect(reviewKindOf(null, READY)).toBe('feature');
  });

  it('is none for a viewer who may not decide, with no verdict, or a verdict that is not ready', () => {
    expect(reviewKindOf({ canApprove: false, tech: null }, null)).toBeNull();
    expect(reviewKindOf(null, { ...READY, tone: 'wait' })).toBeNull();
    expect(reviewKindOf(null, { ...READY, tone: 'fail' })).toBeNull();
    expect(reviewKindOf(null, { ...READY, foot: { ...READY.foot, action: null } })).toBeNull();
  });

  it('lives at /prd/<id>/review', () => {
    expect(reviewPath('d-1')).toBe('/prd/d-1/review');
  });
});

describe('what Approve pins', () => {
  it('names the latest spec, plan and before/after, never the voice', () => {
    expect(PROPS.pinned.map((file) => file.name)).toEqual(['Spec v2', 'Plan v1', 'Before/after v1']);
    expect(planLine([{ kind: 'plan' }, { kind: 'plan' }], 14)).toBe('Plan v2 · 14 slices');
    expect(planLine([{ kind: 'plan' }], 1)).toBe('Plan v1 · 1 slice');
    expect(planLine([{ kind: 'plan' }], null)).toBe('Plan v1');
    expect(planLine([{ kind: 'spec' }], 3)).toBeNull();
  });
});

describe('the decision posts what the PRD page posts', () => {
  it('AC-3: Approve on the review screen posts the dossier alone to the approval route, so it pins the same files as today', async () => {
    const send = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 201 })));
    await postApproval('d-1', 'product', send);
    expect(send).toHaveBeenCalledWith(APPROVAL_ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"dossier":"d-1"}' });
    expect(approvalBody('d-1', 'tech')).toBe('{"dossier":"d-1","kind":"tech"}');
  });

  it('AC-3: Review and approve opens the review screen whose decision is Approve, and Back to the PRD returns to its page', () => {
    const html = render({});
    expect(html).toMatch(/<button[^>]*data-primary=""[^>]*>Approve<\/button>/);
    expect(html).toContain('href="/prd/d-1">Back to the PRD</a>');
    expect(html).not.toContain('Request changes');
  });
});

describe('Review and approve', () => {
  it('reads what changed, the business laws, then what it approves, in that order', () => {
    const html = render({});
    expect(at(html, '1 · What changed')).toBeLessThan(at(html, '2 · Business laws'));
    expect(at(html, '2 · Business laws')).toBeLessThan(at(html, '3 · What you approve'));
    expect(at(html, '+ Quotes are sent by email or post.')).toBeLessThan(at(html, 'Quotes get lost.'));
    expect(at(html, 'Quotes get lost.')).toBeLessThan(at(html, 'Send them twice.'));
    expect(html).toContain('The plan: Plan v1 · 3 slices');
    expect(html).toContain('Pins Spec v2, Plan v1, Before/after v1.');
    expect(html).toContain('spec.md changed since ada approved it · 9 Oct 2026');
    expect(html).toContain('You approve as Cy.');
    expect(html).toContain('data-screen="prd-review"');
  });

  it('says a first approval has nothing before it', () => {
    const html = render({ approval: { ...APPROVAL, state: 'waiting', detail: null, screen: { ...SCREEN, diffs: [] } } });
    expect(html).toContain('Its first approval: nothing to compare.');
    expect(html).toContain('Nobody has approved it yet.');
  });

  it('turns Approve off on a red business-law verdict, saying why', () => {
    const html = render({ approval: { ...APPROVAL, laws: { show: 'verdict', verdict: RED } } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Approve<\/button>/);
    expect(html).toContain(LAWS_HOLD);
    expect(html).toContain('BL-QUOTES-1');
  });
});

describe('Review the plan', () => {
  it('reads the plan first, and a red verdict never turns Give Tech Approval off (BR-PRODUCT-129)', () => {
    const html = render({
      kind: 'tech', approval: { ...APPROVAL, canApprove: false, tech: TECH, laws: { show: 'verdict', verdict: RED } },
      planMarkdown: { front: 'prd: 7', html: '<h2>Slices</h2>' },
    });
    expect(at(html, '1 · The plan')).toBeLessThan(at(html, '2 · What changed'));
    expect(html).toContain('<h2>Slices</h2>');
    expect(html).toContain('No Tech Approval given before.');
    expect(html).toContain('A red verdict never holds this.');
    expect(html).toMatch(/<button[^>]*data-primary=""[^>]*>Give Tech Approval<\/button>/);
    expect(html).not.toMatch(/disabled=""[^>]*>Give Tech Approval/);
  });
});

describe('Review the feature', () => {
  it('reads the five Ready checks, then each criterion with its proof, then links Merge on GitHub to the feature PR', () => {
    const html = render({ kind: 'feature', approval: null, ready: READY });
    expect(at(html, '1 · Ready checks')).toBeLessThan(at(html, '2 · Proof of each criterion'));
    expect(html).toContain('CI is green');
    expect(html).toContain('href="https://github.com/acme/app/blob/abc/quote.test.ts"');
    expect(html).toMatch(/<a[^>]*href="https:\/\/github.com\/acme\/app\/pull\/42"[^>]*data-primary=""[^>]*>Merge on GitHub<\/a>/);
    expect(html).toContain('Only a person merges.');
    expect(html).toContain('Judged by Omni App · abc1234 · 09:40 UTC');
  });
});

describe('the words', () => {
  it('names the viewer in the line under each question', () => {
    expect(reviewWords('approve', { approval: APPROVAL, ready: null, me: 'Cy' }).detail).toBe('You approve as Cy.');
    expect(reviewWords('tech', { approval: { ...APPROVAL, tech: { ...TECH, state: 'voided' } }, ready: null, me: 'Bo' }).lede).toContain('no longer holds');
    expect(reviewWords('feature', { approval: null, ready: READY, me: 'Cy' }).lede).toBe('Ready for review · 5 of 5');
  });
});
