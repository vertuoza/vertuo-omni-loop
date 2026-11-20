import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import type { ApproveScreen } from '../page/approval';
import type { ReadyRow } from '../page/ready';
import type { DossierRead } from '../page/view';
import { reviewRoute } from './ReviewRoute';

// /prd/<id>/review called as the server calls it (PRD omni-loop-20 s5), its reads stubbed: who gets the screen,
// who is sent back to the PRD's page, and the sign-in card for a signed-out viewer. The approval itself is read
// by ./approval-read.ts, the PRD page's own read, stubbed here. Every PRD and person is fictional.

const ID = '00000000-0000-4000-8000-0000000000d1';
const ME = '00000000-0000-4000-8000-0000000000a1';
const SCREEN: ApproveScreen = { diffs: [], sections: [{ name: 'Problem', html: '<p>Quotes get lost.</p>' }], spec: 'read' };

/** What the stubbed reads answer. */
type Given = { mode: string; session: unknown; read: unknown; down: boolean; approval: unknown; ready: unknown };

const given = vi.hoisted((): Given => ({ mode: 'supabase', session: null, read: null, down: false, approval: {}, ready: null }));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  redirect: (to: string) => { throw new Error(`redirect ${to}`); },
  notFound: () => { throw new Error('not found'); },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock('../../env', async (original) => ({ ...(await original<typeof import('../../env')>()), serverEnv: () => ({ mode: given.mode }) }));
vi.mock('../page/route-gate', async (original) => ({ ...(await original<typeof import('../page/route-gate')>()), dossierSession: () => Promise.resolve(given.session) }));
vi.mock('../page/source', async (original) => ({
  ...(await original<typeof import('../page/source')>()),
  readDossier: () => (given.down ? Promise.reject(new Error('down')) : Promise.resolve(given.read)),
  readPlanSlices: () => Promise.resolve(3),
  readContent: () => Promise.resolve('---\nprd: 7\n---\n\n## Slices\n'),
}));
vi.mock('./approval-read', () => ({ approvalOf: () => Promise.resolve(given.approval) }));
vi.mock('../page/ready.repository', () => ({ readLatestVerdict: () => Promise.resolve(given.ready) }));

const READ = {
  dossier: {
    id: ID, workspace_id: 'w-1', home_repo: 'acme/app', prd: PrdNumberSchema.parse(7), kind: 'prd', title: 'Quotes by post',
    opened_by: null, created_at: '2026-11-01T09:00:00Z', numbered_at: '2026-11-01T09:00:00Z', birthplace: 'server',
  },
  versions: (['spec', 'plan', 'before-after'] as const).map((kind) => ({
    id: `v-${kind}`, dossier_id: ID, kind, bytes: 1, source: 'kit', uploaded_by: null, commit_sha: null, created_at: '2026-11-01T09:00:00Z',
  })),
  members: [{ user_id: ME, email: 'cy@example.com', name: 'Cy' }],
  rounds: [],
} satisfies DossierRead;

const check = (id: string) => ({ id, title: id, state: 'pass' as const, why: '', evidence: null, excused: [] });
const READY: ReadyRow = {
  repo: 'acme/app', prd: PrdNumberSchema.parse(7), pr_number: 42, head_sha: 'a'.repeat(40), state: 'ready', passed: 5, headline: 'ready',
  checks: ['ci', 'conflicts', 'outbox', 'review', 'acceptance'].map(check), criteria: [], decided_at: '2026-11-20T09:40:00Z',
};

const route = () => reviewRoute({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve({}) });
const html = async () => {
  const page: unknown = await route();
  expect(isValidElement(page)).toBe(true);
  return renderToStaticMarkup(page as ReactElement);
};

beforeEach(() => {
  given.mode = 'supabase';
  given.session = { env: { url: 'https://db.example', key: 'k' }, db: {}, user: { id: ME } };
  given.read = READ;
  given.down = false;
  given.approval = { approval: null, approvalFacts: { voids: [], asked: [], screen: SCREEN } };
  given.ready = null;
});

describe('/prd/<id>/review', () => {
  it('AC-3: Review and approve opens the review screen for the member who may approve', async () => {
    const page = await html();
    expect(page).toContain('Review and approve');
    expect(page).toContain('PRD 7 · Quotes by post');
    expect(page).toContain('Quotes get lost.');
    expect(page).toContain('The plan: Plan v1 · 3 slices');
    expect(page).toContain('You approve as Cy.');
    expect(page).toMatch(/<button[^>]*data-primary=""[^>]*>Approve<\/button>/);
  });

  it('opens Review the plan for the member a Tech Approval request names, the plan first', async () => {
    given.approval = { approval: null, approvalFacts: { voids: [], asked: [], tech: { user: ME, state: 'asked', approval: null }, techScreen: { diffs: [], sections: [], spec: 'read' } } };
    const page = await html();
    expect(page).toContain('Review the plan');
    expect(page).toContain('Slices</h2>');
    expect(page).toContain('Give Tech Approval');
  });

  it('opens Review the feature once the feature PR is ready and nothing else waits on the viewer', async () => {
    given.approval = { approval: null, approvalFacts: { voids: [], asked: ['someone-else'] } };
    given.ready = READY;
    const page = await html();
    expect(page).toContain('Review the feature');
    expect(page).toContain('href="https://github.com/acme/app/pull/42"');
  });

  it('sends a viewer with no decision waiting back to the PRD page', async () => {
    given.approval = { approval: null, approvalFacts: { voids: [], asked: ['someone-else'] } };
    await expect(route()).rejects.toThrow(`redirect /prd/${ID}`);
  });

  it('sends the demo back to its PRD page, and a fix to its own page', async () => {
    given.mode = 'demo';
    await expect(route()).rejects.toThrow(`redirect /prd/${ID}`);
    given.mode = 'supabase';
    given.read = { ...READ, dossier: { ...READ.dossier, kind: 'visual' } };
    await expect(route()).rejects.toThrow(`redirect /visual/${ID}`);
  });

  it('shows the sign-in card signed out, not found to a non-member, and says when the database is down', async () => {
    given.session = { env: { url: 'https://db.example', key: 'k' }, db: {}, user: null };
    expect(await html()).toContain('Sign in');
    given.session = { env: { url: 'https://db.example', key: 'k' }, db: {}, user: { id: ME } };
    given.read = null;
    await expect(route()).rejects.toThrow('not found');
    given.down = true;
    expect(await html()).toContain('The dossier database could not answer');
  });
});
