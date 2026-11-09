import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { KeptVerdict } from '../../business-laws/verdicts.repository';
import type { DossierRow, DossierVersionRow } from '../store';
import { approvalView, approveOff, LAWS_HOLD, type ApprovalFacts, type ApprovalRow } from './approval';
import { DossierPage } from './DossierPage';
import { dossierView, readPick, type DossierRead } from './view';

// #2671: a PRD numbered on its product (mobile-12, no GitHub issue) gets the approval area of its page, as a PRD
// numbered from an issue does: Approve for whoever may approve it, the business laws verdict above it, and the
// seal once approved. A draft, which has no number at all, still gets none. Every product and law is fictional.

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({ ...(await original<typeof import('next/navigation')>()), useRouter: () => ({ refresh: () => {} }) }));

const ID = '00000000-0000-4000-8000-0000000000e1';
const ADA = { user_id: 'u-ada', email: 'ada@example.com', name: 'Ada' };

/** A dossier with no repository number, born on the server: a product PRD, or a draft until it has a number. */
const NO_REPOSITORY_NUMBER: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'acme/app', prd: null, title: 'Quotes can be sent twice', birthplace: 'server',
  opened_by: ADA.user_id, created_at: '2026-11-09T08:00:00Z', numbered_at: '2026-11-09T08:00:00Z',
};

const version = (id: string, kind: DossierVersionRow['kind']): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: ADA.user_id, commit_sha: null, created_at: '2026-11-09T08:05:00Z',
});
const VERSIONS = [version('v-spec-1', 'spec'), version('v-plan-1', 'plan'), version('v-ba-1', 'before-after')];

const APPROVED: ApprovalRow = {
  id: 'a-1', approver_login: 'ada', approved_at: '2026-11-09T09:12:00Z',
  files: [
    { kind: 'spec', path: 'spec.md', version_id: 'v-spec-1', sha256: '9c41aa00e07b' },
    { kind: 'plan', path: 'plan.md', version_id: 'v-plan-1', sha256: '41b0bb000cd2' },
    { kind: 'before-after', path: 'before-after.html', version_id: 'v-ba-1', sha256: '77aa00e07b12' },
  ],
};

const RED: KeptVerdict = {
  specVersion: 'v-spec-1', lawHome: 'acme/plan', packSha: 'c'.repeat(40), state: 'red', reason: '1 law broken', laws: ['BL-QUOTES-1'],
  domains: [{ key: 'quotes', name: 'Quotes', reasons: ['areas'] }],
  findings: [{
    law: 'BL-QUOTES-1', statement: 'A quote is sent once.', why: 'A customer billed twice stops trusting the contractor.', quote: 'a quote can be sent twice',
    domain: 'quotes', file: '.omni-loop/knowledge/domains/quotes/business-laws.md', owners: ['ana'],
  }],
  judgedAt: '2026-11-09T09:00:00Z',
};

const FACTS: ApprovalFacts = { voids: [], asked: [] };
const OF_PRODUCT = { ...FACTS, productPrd: 'mobile-12' };
const OF_NO_PRODUCT = { ...FACTS, productPrd: null };

const read = (approval: DossierRead['approval'], approvalFacts: ApprovalFacts): DossierRead =>
  ({ dossier: NO_REPOSITORY_NUMBER, versions: VERSIONS, members: [ADA], rounds: [], approval, approvalFacts });

const page = (r: DossierRead) =>
  renderToStaticMarkup(createElement(DossierPage, { view: dossierView(r, ADA.user_id, readPick({})), markdown: null, supabase: null }));

describe('the approval area of a product PRD', () => {
  it('offers Approve while it waits', () => {
    const view = approvalView(read(null, OF_PRODUCT), ADA.user_id);
    expect(view).toMatchObject({ state: 'waiting', canApprove: true, dossier: ID });
    expect(page(read(null, OF_PRODUCT))).toContain('Approve');
  });

  it('shows a red business laws verdict above Approve, and turns Approve off', () => {
    const facts = { ...OF_PRODUCT, laws: { show: 'verdict' as const, verdict: RED } };
    const view = approvalView(read(null, facts), ADA.user_id);
    expect(view && approveOff(view)).toBe(LAWS_HOLD);
    expect(page(read(null, facts))).toContain('Business laws ✗ 1');
  });

  it('seals the approval under the product PRD\'s id', () => {
    expect(approvalView(read(APPROVED, OF_PRODUCT), ADA.user_id)?.seal?.prd).toBe('mobile-12');
    expect(page(read(APPROVED, OF_PRODUCT))).toContain('PRD mobile-12');
  });

  it('stays away from a draft, which is numbered nowhere', () => {
    expect(approvalView(read(null, FACTS), ADA.user_id)).toBeNull();
    expect(approvalView(read(null, OF_NO_PRODUCT), ADA.user_id)).toBeNull();
  });
});
