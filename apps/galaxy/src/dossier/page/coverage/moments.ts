import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseIssue, parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { FindingView } from '../../../rewind/rewind.contract';
import type { BreakRow, MainWatchRead, WatchRow } from '../../../main-watch/store';
import { fixPageView } from '../../../fixes/timeline';
import type { StageRow } from '../../../stages/stage';
import type { GithubSummary } from '../../github/summary';
import { renderMarkdown } from '../../markdown';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../../store';
import type { ApprovalRow, ApprovalView, ApproveScreen } from '../approval';
import { pinnedOf, type ReviewKind } from '../../review/review';
import { ReviewPage } from '../../review/ReviewPage';
import { readyView, type ReadyRow } from '../ready';
import { DossierPage } from '../DossierPage';
import { dossierView, readPick, type PageTab } from '../view';

// The coverage test's fixtures (omni-loop-20 s9): the PRD page in each moment of its life, every PRD,
// person, repository and link fictional. A moment is one dossier with everything its stage can show, so
// each item of the inventory has somewhere to be found.

export const MOMENTS = ['draft', 'approval', 'tech-approval', 'outbox', 'ready', 'shipped', 'main-broke'] as const;
export type MomentName = (typeof MOMENTS)[number];

export const ID = '00000000-0000-4000-8000-0000000000c1';
export const REPO = 'acme/widgets';
const NOW = Date.parse('2026-10-22T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };
const PIERRE = { user_id: 'u-pierre', email: 'pierre@example.com', name: 'Pierre' };
const MARIE = { user_id: 'u-marie', email: 'marie@example.com', name: 'Marie' };
export const ME = MARIE.user_id;

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: REPO, prd: parsePrd(216), title: 'Offline quotes', birthplace: 'server',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};
const draft: DossierRow = { ...numbered, prd: null, numbered_at: null, title: 'Offline quotes (draft)' };

const version = (id: string, kind: DossierVersionRow['kind'], at: string, more: Partial<DossierVersionRow> = {}): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: at, ...more,
});
const versions = [
  version('s1', 'spec', '2026-09-27T09:20:00Z'),
  version('s2', 'spec', '2026-09-28T08:00:00Z', { source: 'github', uploaded_by: null, commit_sha: 'a1b2c3d4e5f6' }),
  version('p1', 'plan', '2026-09-27T09:21:00Z'),
  version('b1', 'before-after', '2026-09-27T09:20:01Z'),
  version('v1', 'voice', '2026-09-27T09:22:00Z'),
];

const SHAPE = {
  question: 'Square or hexagonal tiles?', header: 'Shape', multiSelect: false,
  options: [{ label: 'Square (Recommended)', description: 'cheaper' }, { label: 'Hexagonal', description: 'prettier' }],
};
const asked = (id: string, rule: DossierRoundRow['rule'], at: string, more: Partial<DossierRoundRow> = {}): DossierRoundRow => ({
  rule, round_id: id, session_id: 's1', asked_by: PIERRE.user_id, repo: REPO, branch: 'main', questions: [SHAPE], answers: null,
  status: 'open', answered_via: null, answered_by: null, category: null, category_by: null, prd: null, skill: '/omni:brainstorm',
  created_at: at, answered_at: null, ...more,
});
const rounds = [
  asked('r1', 'brainstorm', '2026-09-27T09:15:00Z', {
    status: 'answered', answers: { [SHAPE.question]: 'Square (Recommended)' }, answered_via: 'page', answered_by: MARIE.user_id,
    answered_at: '2026-09-27T09:16:35Z', category: 'ux-ui', category_by: 'model',
  }),
  asked('r2', 'brainstorm', '2026-09-28T09:00:00Z'),
];

const SCREEN: ApproveScreen = {
  diffs: [{ path: 'plan.md', rows: [{ sign: '+', text: 'two' }] }],
  sections: [{ name: 'Problem', html: '<p>Nobody is told.</p>' }],
  spec: 'read',
};
const APPROVED: ApprovalRow = {
  id: 'a-1', approver_login: 'pierre', approved_at: '2026-09-27T12:00:00Z',
  files: [{ kind: 'spec', path: 'spec.md', version_id: 's2', sha256: 'abc' }, { kind: 'before-after', path: 'before-after.html', version_id: 'b1' }],
};

const item = (id: string, rank: 'high' | 'medium' | 'human-action') => ({
  id, rank, question: `Question ${id}?`, decision: 'Decided.', options: rank === 'human-action' ? [] : [{ letter: 'A', text: 'Keep.' }, { letter: 'B', text: 'Change.' }],
  personSteps: rank === 'human-action' ? 'Set the secret.' : null, bearsOn: 'none', intro: null, punchline: null, details: {},
});
const PR = `https://github.com/${REPO}/pull/221`;
const CARE: NonNullable<GithubSummary['care']> = {
  ci: 'red', failedUrl: `https://github.com/${REPO}/actions/runs/9`, conflict: true, base: 'main',
  threads: [
    { url: `${PR}#discussion_r1`, login: 'rev1', avatar: null, firstLine: 'Rename this', verdict: 'asked', reason: 'A product decision.', resolved: false },
    { url: `${PR}#discussion_r3`, login: 'rev3', avatar: null, firstLine: 'Duplicate', verdict: 'fixed', reason: 'Fixed in a1b2c3d.', resolved: true },
  ],
  watchingSince: iso(-DAY), lastRound: iso(-60_000),
};
const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: REPO, prd: parsePrd(216), folder: '0216-offline-quotes', topic: 'offline-quotes',
  issue: { number: parseIssue(216), url: `https://github.com/${REPO}/issues/216`, state: 'open' },
  phase0: { number: parsePr(220), url: `https://github.com/${REPO}/pull/220`, state: 'merged', draft: false },
  feature: { number: parsePr(221), url: PR, state: 'open', draft: true, mergedAt: null }, retro: null, mergedSlices: 3,
  outbox: null, outboxComment: null, care: CARE, ...more,
});
const at = (stage: StageRow['stage']): StageRow[] => [{ stage, reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' }];

const TITLES = ['CI green on the latest commit', 'Full tests and lint ran', 'Every acceptance criterion has its proof', 'No test was loosened', 'The change stayed in its area'];
const IDS = ['ci', 'full', 'acceptance', 'loosening', 'area'];
const READY: ReadyRow = {
  repo: REPO, prd: parsePrd(216), pr_number: 221, head_sha: 'a41f9c2'.padEnd(40, '0'), state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5',
  checks: IDS.map((id, n) => ({ id, title: TITLES[n] ?? id, state: 'pass' as const, why: '', evidence: `https://github.com/${REPO}/actions/runs/${String(8800 + n)}`, excused: [] })),
  criteria: [{ number: 1, kind: 'test', scenario: 'Quotes work offline', lines: ['Given a quote', 'When offline', 'Then it saves'], proof: `https://github.com/${REPO}/blob/abc/quote.test.ts`, state: 'passed' }],
  decided_at: '2026-11-15T07:00:00Z',
};
const PROOF = {
  runs: [{
    id: 'r-1', dossier_id: ID, commit_sha: 'a1b2c3d4e5f6', url: 'https://preview.test/prd', gif: null, created_by: PIERRE.user_id, created_at: '2026-09-30T14:05:00Z',
    criteria: [{ text: 'The tab shows a player', verdict: 'pass' as const, video: '1.webm', script: '1.spec.ts' }, { text: 'A failed check reads x', verdict: 'fail' as const, note: 'expected x', video: '2.webm', script: '2.spec.ts' }],
  }],
  shown: { id: 'r-1', links: { '1.webm': 'https://storage.test/1.webm', '1.spec.ts': 'https://storage.test/1.spec.ts', '2.webm': null, '2.spec.ts': null }, scripts: { '1.spec.ts': 'await expect(page).toBeVisible();', '2.spec.ts': null } },
};
const FIVE = ['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif'];
const PITCH = {
  runs: [{
    id: 'p-1', dossier_id: ID, audience: 'customers' as const, look: 'arcade' as const, commit_sha: 'a1b2c3d4e5f6', hook: 'Quotes offline', benefit: 'Work anywhere.',
    kicker: 'NEW', closing: 'Omni Loop', files: FIVE, created_by: PIERRE.user_id, created_at: '2026-10-01T14:05:00Z',
  }],
  links: { 'p-1': Object.fromEntries(FIVE.map((name) => [name, `https://storage.test/${name}`])) },
};
const watch = (more: Partial<WatchRow> = {}): WatchRow => ({
  lane: REPO, merge_sha: 'a'.repeat(40), merged_at: iso(-2 * DAY), watch_until: iso(5 * DAY), status: 'watching', unread: [], ...more,
});
const red: BreakRow = { lane: REPO, kind: 'ci-red', source: 'run-1', url: `https://github.com/${REPO}/actions/runs/1`, title: 'lint job', parent: 'green', at: iso(-DAY) };
const FINDING: FindingView = {
  id: 'f1', check: 'ci', origin: 'omni-setup', happened: 'The lint was red on the slice.', evidence: [`https://github.com/${REPO}/actions/runs/2`],
  fix: 'Require the lint job.', state: 'proposed', reason: null, decidedBy: null, decidedAt: null, outcome: null,
};
const WATCHING: MainWatchRead = { watches: [watch()], breaks: [] };
const BROKE: MainWatchRead = { watches: [watch({ status: 'broke' })], breaks: [red] };

type Read = Parameters<typeof dossierView>[0];

const FEATURE_OPEN = { number: parsePr(221), url: PR, state: 'open' as const, draft: false, mergedAt: null };
const FEATURE_MERGED = { number: parsePr(221), url: PR, state: 'merged' as const, draft: false, mergedAt: '2026-10-20T10:00:00Z' };
const base = { dossier: numbered, versions, members: [PIERRE, MARIE], rounds, approval: APPROVED, approvalFacts: { voids: [], asked: [] }, slices: 5 } satisfies Read;

const reads: Record<MomentName, () => Read> = {
  draft: () => ({ dossier: { ...draft, birthplace: 'repo' }, versions, members: [PIERRE, MARIE], rounds, answerable: ['r2'] }),
  approval: () => ({ ...base, approval: null, approvalFacts: { voids: [], asked: [], screen: SCREEN }, github: summary(), stages: at('prd') }),
  'tech-approval': () => ({
    ...base, approvalFacts: { voids: [], asked: [], tech: { user: ME, state: 'asked', approval: null }, techScreen: SCREEN }, github: summary(), stages: at('prd'),
  }),
  outbox: () => ({
    ...base,
    github: summary({
      outbox: {
        open: [item('s1-01-colour', 'high'), item('s2-01-secret', 'human-action')], adopted: [item('s1-02-name', 'medium')],
        settled: [{ id: 's1-00-name', title: 'Keep the name?', verdict: 'agreed', answer: 'A. Keep it.', by: 'ada', at: '2026-09-26', url: `${PR}#issuecomment-2` }],
      },
      outboxComment: `${PR}#issuecomment-1`,
    }),
    stages: at('building'),
  }),
  ready: () => ({ ...base, github: summary({ feature: FEATURE_OPEN }), stages: at('outbox'), proofs: PROOF }),
  shipped: () => ({
    ...base, github: summary({ feature: FEATURE_MERGED, retro: { number: parsePr(230), url: `https://github.com/${REPO}/pull/230`, state: 'merged', draft: false, mergedAt: '2026-10-21T10:00:00Z' }, retroText: '# Retro\n\nIt went well.' }),
    stages: at('shipped'), proofs: PROOF, pitches: PITCH, mainWatch: WATCHING,
  }),
  'main-broke': () => ({
    ...base, github: summary({ feature: FEATURE_MERGED }), stages: at('shipped'), mainWatch: BROKE, rewindFindings: [FINDING],
  }),
};

/** Where a render looks: a tab, a segment of Specifications, a context of the Specifications rail. */
export type Where = { tab?: PageTab; segment?: string; context?: string };

/** The PRD page in a moment, on a tab (the page's own pick when none), as the server renders it. */
export function renderMoment(moment: MomentName, where: Where = {}): string {
  const query: Record<string, string> = {};
  if (where.tab) query.tab = where.tab;
  if (where.segment) query.segment = where.segment;
  if (where.context) query.context = where.context;
  const view = dossierView(reads[moment](), ME, readPick(query), NOW);
  return renderToStaticMarkup(createElement(DossierPage, {
    view, markdown: renderMarkdown('---\nprd: 216\n---\n\n# Offline quotes\n\nQuotes keep working offline.\n'), supabase: SUPABASE,
    ...(moment === 'ready' ? { ready: readyView(READY) } : {}),
  }));
}

/** A fix's page (a visual fix), on a tab. */
export function renderFix(tab?: string): string {
  const fix = {
    issue: { number: parseIssue(548), url: `https://github.com/${REPO}/issues/548`, state: 'closed' as const, author: 'anna', createdAt: '2026-09-29T08:00:00Z', risk: null, regression: false },
    pull: { number: parsePr(562), url: `https://github.com/${REPO}/pull/562`, state: 'merged' as const, mergedAt: '2026-09-29T12:00:00Z', mergedBy: 'pierre' },
    approvals: [], release: null,
  };
  const dossier: DossierRow = { ...numbered, prd: parsePrd(548), kind: 'visual', title: 'Darker sidebar' };
  const view = dossierView({
    dossier, versions: [version('r1', 'variations', '2026-09-29T09:10:00Z'), version('b1', 'before-after', '2026-09-29T09:30:00Z')], members: [PIERRE], rounds: [],
    fix: fixPageView('visual', fix, { letter: 'C', login: 'pierre', date: '2026-09-29' }),
  }, ME, readPick(tab ? { tab } : {}), NOW);
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase: SUPABASE }));
}

const APPROVAL_VIEW: ApprovalView = {
  state: 'waiting', words: 'waiting for approval', detail: null, changed: [], canApprove: true, dossier: ID, screen: SCREEN, seal: null,
  tech: { state: 'asked', name: 'Marie', canGive: true, screen: SCREEN, seal: null, waiting: null }, canRequestTech: false,
};

/** The review screen (`/prd/<id>/review`) for one of the three signed decisions. */
export function renderReview(kind: ReviewKind): string {
  return renderToStaticMarkup(createElement(ReviewPage, {
    kind, dossier: { id: ID, title: 'Offline quotes', label: 'PRD 216' }, me: 'Marie', approval: APPROVAL_VIEW, ready: readyView(READY),
    pinned: pinnedOf([{ kind: 'spec' }, { kind: 'plan' }, { kind: 'before-after' }]), plan: 'Plan v1 · 5 slices',
    planMarkdown: renderMarkdown('# Plan\n\nFive slices.\n'),
  }));
}
