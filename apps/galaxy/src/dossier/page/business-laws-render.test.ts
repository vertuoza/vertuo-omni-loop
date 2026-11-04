import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { KeptVerdict } from '../../business-laws/verdicts.repository';
import type { LawsView } from '../../business-laws/verdicts.service';
import { amendLine } from './AmendLaw';
import { approveOff, LAWS_HOLD } from './approval';
import { ApproveButton } from './ApproveButton';
import { BusinessLawsVerdict } from './BusinessLawsVerdict';

// The business laws' verdict on the approve screen (PRD 2632 s4): red names each law broken, its Why, the
// spec's words and its owner, with Ask to amend this law and Approve off; green says what it judged; not
// judged says why, Approve on. Every law and spec is fictional.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

const RED: KeptVerdict = {
  specVersion: 'v-1', lawHome: 'acme/plan', packSha: 'c'.repeat(40), state: 'red', reason: '1 law broken',
  laws: ['BL-PRODUCT-1', 'BL-QUOTES-1'],
  domains: [{ key: 'quotes', name: 'Quotes', reasons: ['"Quote"'] }],
  findings: [{
    law: 'BL-QUOTES-1', statement: 'A quote can be sent only when its total including tax is above zero.',
    why: 'A customer who receives an empty quote stops trusting the contractor.', quote: 'a template can be sent with a zero total',
    domain: 'quotes', file: '.omni-loop/knowledge/domains/quotes/business-laws.md', owners: ['ana'],
  }],
  judgedAt: '2026-12-01T09:00:00Z',
};
const GREEN: KeptVerdict = {
  ...RED, state: 'green', reason: '12 judged', findings: [],
  laws: Array.from({ length: 12 }, (_, n) => `BL-QUOTES-${n + 1}`),
  domains: [{ key: 'quotes', name: 'Quotes', reasons: ['"Quote"'] }, { key: 'invoicing', reasons: ['areas'] }],
};
const NEUTRAL: KeptVerdict = { ...GREEN, state: 'neutral', reason: 'the model did not answer: it took too long' };

const render = (laws: LawsView | null) => renderToStaticMarkup(createElement(BusinessLawsVerdict, { laws }));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");

describe('the business laws verdict', () => {
  it('on a red, shows each finding\'s law, Why, the spec\'s words, its owner and Ask to amend this law', () => {
    const html = render({ show: 'verdict', verdict: RED });
    const text = textOf(html);
    expect(text).toContain('Business laws ✗ 1');
    expect(html).toContain('<code class="dossier-laws-id">BL-QUOTES-1</code>');
    expect(text).toContain('A quote can be sent only when its total including tax is above zero.');
    expect(text).toContain('Why: A customer who receives an empty quote stops trusting the contractor.');
    expect(text).toContain('The spec says: a template can be sent with a zero total');
    expect(text).toContain('Owner: @ana · Quotes ← "Quote"');
    expect(html).toContain('>Ask to amend this law</button>');
    expect(amendLine('BL-QUOTES-1')).toBe('/omni:knowledge-add amend BL-QUOTES-1');
  });

  it('on a green, says how many laws it judged and which domains, each one\'s reason a click away', () => {
    const html = render({ show: 'verdict', verdict: GREEN });
    expect(textOf(html)).toContain('Business laws ✓ 12 judged');
    expect(html).toContain('<summary>Quotes, invoicing</summary>');
    expect(textOf(html)).toContain('Quotes ← "Quote"');
    expect(textOf(html)).toContain('invoicing ← areas');
    expect(html).not.toContain('Ask to amend');
    expect(textOf(render({ show: 'verdict', verdict: { ...GREEN, laws: [], domains: [] } }))).toContain('No business law applies to this spec.');
  });

  it('not judged, says why', () => {
    expect(textOf(render({ show: 'verdict', verdict: NEUTRAL }))).toBe('Business laws not judgedThe model did not answer: it took too long.');
    expect(textOf(render({ show: 'not-judged', why: 'the law home has no knowledge pack yet' }))).toContain('The law home has no knowledge pack yet.');
  });

  it('shows nothing for a product with no law home or no law', () => {
    expect(render({ show: 'nothing' })).toBe('');
    expect(render(null)).toBe('');
  });
});

describe('Approve beside the verdict', () => {
  it('is off on a red, saying why, and on for a green, a not judged and no verdict', () => {
    expect(approveOff({ laws: { show: 'verdict', verdict: RED } })).toBe(LAWS_HOLD);
    for (const laws of [{ show: 'verdict', verdict: GREEN }, { show: 'verdict', verdict: NEUTRAL }, { show: 'not-judged', why: 'x' }, { show: 'nothing' }, null] as const) {
      expect(approveOff({ laws })).toBeNull();
    }
    const off = renderToStaticMarkup(createElement(ApproveButton, { dossier: 'd-1', off: LAWS_HOLD }));
    expect(off).toMatch(/<button[^>]*disabled=""[^>]*>Approve<\/button>/);
    expect(off).toContain('Change the spec, or amend the law.');
    expect(renderToStaticMarkup(createElement(ApproveButton, { dossier: 'd-1' }))).not.toContain('disabled');
  });
});
