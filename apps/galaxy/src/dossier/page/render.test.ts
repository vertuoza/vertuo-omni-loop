import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { renderMarkdown } from '../markdown';
import { UNREAD, type GithubSummary, type PullRef } from '../github/summary';
import type { StageRow } from '../../stages/stage';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../store';
import { CopyLink } from './CopyLink';
import { DELETE_CONFIRM, removeDraft } from './DeleteDraft';
import { DossierPage } from './DossierPage';
import { DossierSignIn } from './DossierSignIn';
import { headHeight } from './PinnedHead';
import { Taken, takenLine } from './QuickAnswer';
import { COPY_WORDS, copyCommand, StageHeaderCopy } from './StageHeaderCopy';
import { SendToTerminalScope } from '../../runners/send/SendToTerminal';
import type { SendSetup } from '../../runners/send/targets';
import { PitchAction, PitchPanel, pitchCommand, PITCH_HINT } from './PitchAction';
import { StageAction } from './StageHeader';
import { stageView } from './stage';
import { dossierView, readPick, type DossierPick } from './view';
import { parseIssue, parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

// A quick round's buttons (PRD 384) refresh through the app router, which a static render has none of.
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// /prd/<id> as the server renders it (PRD 216): what a person sees before any script runs, in each of
// its states — numbered or draft, each artifact tab, a version picked, an artifact with no version yet,
// the opener of a draft, the sign-in, and the Questions tab with its rounds, none, or none readable.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@example.com', name: 'Pierre' };
const MARIE = { user_id: 'u-marie', email: 'marie@example.com', name: 'Marie' };
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), title: 'PRD dossiers',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};
const draft: DossierRow = { ...numbered, prd: null, numbered_at: null, title: 'Offline quotes on the site app' };

const version = (id: string, kind: DossierVersionRow['kind'], at: string, more: Partial<DossierVersionRow> = {}): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: at, ...more,
});
const versions = [
  version('s1', 'spec', '2026-09-27T09:20:00Z'),
  version('b1', 'before-after', '2026-09-27T09:20:01Z'),
  version('b2', 'before-after', '2026-09-27T12:00:00Z'),
  version('s2', 'spec', '2026-09-28T08:00:00Z', { source: 'github', uploaded_by: null, commit_sha: 'a1b2c3d4e5f6' }),
];

const SPEC = '---\nprd: 216\ntitle: PRD dossiers\n---\n\n# PRD dossiers\n\nKeep <script>alert(1)</script> every version.\n';

const SHAPE = {
  question: 'Square or <b>hexagonal</b> tiles?', header: 'Shape', multiSelect: false,
  options: [{ label: 'Square (Recommended)', description: 'cheaper' }, { label: 'Hexagonal', description: 'prettier' }],
};
const asked = (id: string, rule: DossierRoundRow['rule'], at: string, more: Partial<DossierRoundRow> = {}): DossierRoundRow => ({
  rule, round_id: id, session_id: 's1', asked_by: PIERRE.user_id, repo: 'vertuoza/vertuo-omni-loop', branch: 'main', questions: [SHAPE],
  answers: null, status: 'open', answered_via: null, answered_by: null, category: null, category_by: null, prd: null,
  skill: '/omni:brainstorm', created_at: at, answered_at: null, ...more,
});
const rounds = [
  asked('r1', 'brainstorm', '2026-09-27T09:15:00Z', {
    status: 'answered', answers: { [SHAPE.question]: 'Square (Recommended)' }, answered_via: 'page', answered_by: MARIE.user_id,
    answered_at: '2026-09-27T09:16:35Z', category: 'ux-ui', category_by: 'model',
  }),
  asked('r2', 'delivery', '2026-09-28T08:00:00Z', { status: 'abandoned', prd: parsePrd(216), branch: 'feat/prd-dossiers--s3', skill: '/omni:do-work' }),
];

type PageOptions = {
  dossier?: DossierRow; rows?: typeof versions; pick?: DossierPick; me?: string; markdown?: string | null;
  supabase?: typeof SUPABASE | null; questions?: DossierRoundRow[] | null;
  answerable?: string[]; now?: number; github?: GithubSummary | null; slices?: number | null;
  repos?: string[] | null; stages?: StageRow[] | null; fixing?: { runner: string } | null;
};

function page({
  dossier = numbered, rows = versions, pick = readPick({}), me = MARIE.user_id, markdown = null,
  supabase = SUPABASE, questions = rounds,
  answerable = [], now = Date.now(), github, slices = null,
  repos = null, stages, fixing,
}: PageOptions = {}) {
  const view = dossierView({ dossier, versions: rows, members: [PIERRE, MARIE], rounds: questions, repos, answerable, github, slices, stages, fixing }, me, pick, now);
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: markdown === null ? null : renderMarkdown(markdown), supabase }));
}
/** The Pitch button of a shipped or retro PRD (PRD 859), closed as the server renders it. */
const PITCH_BUTTON = '<button class="omni-button omni-button--primary omni-button--md" type="button" aria-expanded="false" data-primary="">Pitch</button>';
/** A repository chip of the facts strip. */
const REPO_CHIP = (repo: string) => `<li class="dossier-repo"><span class="omni-badge omni-badge--neutral">${repo}</span></li>`;
/** The primary button of the header (@omni/ui's Button), as a button that copies. */
const PRIMARY = (label: string, command: string) => `<button class="omni-button omni-button--primary omni-button--md" type="button" title="${command}" data-primary="">${label}</button>`;
const tab = (name: DossierPick['tab'], v?: number): DossierPick => ({ tab: name, version: v ?? null });
/** What the markup reads as text, its tags taken out (PRD 652: a face now sits before a name). */
const textOf = (html: string) => html.replace(/<[^>]+>/g, '');
/** A person's chip in a sentence (PRD 652): the face, then the name. */
const chip = (name: string) => new RegExp(`<span class="person-chip is-inline"><(?:img|span) class="person-face [^>]*>(?:</span>)?${name}</span>`);
/** The stored stages of a PRD at `stage` (PRD 587): that one row, last synced 29 Sep 2026, 09:15 UTC. */
const at = (stage: StageRow['stage']): StageRow[] => [{ stage, reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' }];

/** The current stage of the track, with its progress words: `PRD`, `Building · 2 of 5 slices`. */
const currentStage = (html: string) => /omni-stage-track__stage--current[^>]*>.*?<span class="omni-stage-track__name">([^<]+)<\/span>/.exec(html)?.[1] ?? null;
/** Each stage of the track and its state: `PRD:current`. */
const track = (html: string) => [...html.matchAll(/<li class="omni-stage-track__stage omni-stage-track__stage--(done|current|pending)[^"]*"[^>]*>.*?<span class="omni-stage-track__name">([^<]+)<\/span>/g)]
  .map((m) => `${(m[2] ?? '').split(' · ')[0] ?? ''}:${m[1] ?? ''}`);
/** The head's subtitle. */
const lede = (html: string) => /<p class="omni-page-header__lede">([^<]+)<\/p>/.exec(html)?.[1] ?? null;
/** The head's meta row, fact by fact. */
const meta = (html: string) => [...html.matchAll(/<li class="omni-page-header__fact">([^<]+)<\/li>/g)].map((m) => m[1]);
/** The head: everything before the tab row. */
const headOf = (html: string) => html.slice(html.indexOf('<div class="dossier-top">'), html.indexOf('<div class="dossier-tabbar">'));
/** About this PRD: its section. */
const aboutOf = (html: string) => {
  const start = html.indexOf('<section class="dossier-about"');
  return start === -1 ? '' : html.slice(start, html.indexOf('</section>', start));
};
/** The labels of About this PRD's facts, in order. */
const facts = (html: string) => [...aboutOf(html).matchAll(/<dt class="omni-definition-list__label">([^<]+)<\/dt>/g)].map((m) => m[1]);
/** The label of each button or button link in the head, in order. */
const actions = (html: string) => [...headOf(html).matchAll(/<(?:a|button)[^>]*class="omni-button[^"]*"[^>]*>([^<]+)<\/(?:a|button)>/g)].map((m) => m[1]);

describe('the head (omni-loop-20 s6)', () => {
  it('shows the eyebrow, the 32 px title, the repository in the meta row, who opened it in About this PRD, and Copy link', () => {
    const html = page();
    expect(html).toContain('<p class="omni-page-header__eyebrow">PRD #216</p>');
    expect(html).toContain('<h1 class="omni-page-header__title">PRD dossiers</h1>');
    expect(meta(html)).toEqual(['vertuoza/vertuo-omni-loop']);
    expect(aboutOf(html)).toContain(REPO_CHIP('vertuoza/vertuo-omni-loop'));
    expect(textOf(aboutOf(html))).toContain('opened by Pierre · 27 Sep 2026, 09:12 UTC');
    expect(aboutOf(html)).toMatch(chip('Pierre'));
    expect(html).toContain('>Copy link</button>');
  });

  it('reads Draft for a draft, with no issue, its track on Idea while the brainstorm runs', () => {
    const html = page({ dossier: draft, pick: tab('before-after') });
    expect(html).toContain('<p class="omni-page-header__eyebrow">Draft</p>');
    expect(html).toContain('Offline quotes on the site app');
    expect(html).not.toContain('PRD #');
    expect(html).not.toContain('/issues/');
    expect(currentStage(html)).toBe('Idea · brainstorm in progress');
    expect(currentStage(page({ dossier: draft, questions: [] }))).toBe('Idea · brainstorm in progress');
  });
});

describe('the stage, said once (PRD 426, PRD 587, omni-loop-20 s6)', () => {
  const pr = (number: number, state: PullRef['state'], draft = false): PullRef =>
    ({ number: parsePr(number), url: `https://github.com/vertuoza/vertuo-omni-loop/pull/${number}`, state, draft });
  const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers',
    issue: { number: parseIssue(216), url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/216', state: 'open' },
    phase0: null, feature: null, retro: null, mergedSlices: 0, ...more,
  });
  const button = (html: string) => /<a class="omni-button omni-button--primary omni-button--md" href="([^"]+)" data-primary="" target="_blank" rel="noopener noreferrer">([^<]+)<\/a>/.exec(html)?.slice(1) ?? null;
  const links = (html: string) => [...html.matchAll(/<li><div class="omni-list-row omni-list-row--compact"><span class="omni-list-row__main"><span class="omni-list-row__title"><a href="[^"]+" target="_blank" rel="noopener noreferrer">([^<]+)<\/a><\/span><\/span><span class="omni-list-row__trailing"><span class="ask-hint">([^<]+)<\/span>/g)]
    .map((m) => `${m[1]} ${m[2]}`);

  it('shows no track when the stages were not asked for', () => {
    expect(page()).not.toContain('omni-stage-track');
    expect(page({ github: summary() })).not.toContain('omni-stage-track');
  });

  it('says the stage once at every stage: one track, no Stage cell, no stage words, no stage pill, nothing in the meta row', () => {
    for (const stage of ['prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'] as const) {
      const html = page({ github: summary({ phase0: pr(220, 'merged') }), stages: at(stage) });
      expect(html.match(/<ol class="omni-stage-track/g), stage).toHaveLength(1);
      expect(html, stage).not.toContain('Stage: ');
      expect(html, stage).not.toContain('Now:');
      expect(html, stage).not.toContain('stage-stop');
      expect(html, stage).not.toContain('<dt>Stage</dt>');
      expect(facts(html), stage).not.toContain('Stage');
      expect(meta(html).join(' '), stage).not.toMatch(new RegExp(stage, 'i'));
    }
  });

  it('in the PRD stage, Approve spec opens the phase-0 PR; with none open yet, no button and the agents write the spec', () => {
    const html = page({ github: summary({ phase0: pr(220, 'open') }), stages: at('prd') });
    expect(track(html)).toEqual(['Idea:done', 'PRD:current', 'Inbox:pending', 'Building:pending', 'Outbox:pending', 'Shipped:pending', 'Retro:pending']);
    expect(button(html)).toEqual(['https://github.com/vertuoza/vertuo-omni-loop/pull/220', 'Approve spec']);
    expect(lede(html)).toBe('You review the spec and merge its phase-0 pull request.');
    expect(links(html)).toEqual(['issue #216 open', 'phase-0 #220 open']);
    const writing = page({ github: summary(), stages: at('prd') });
    expect(button(writing)).toBeNull();
    expect(lede(writing)).toBe('The agents write the spec. Nothing waits on you.');
  });

  it('in the inbox stage, Build it is a button carrying the command to copy', () => {
    const html = page({ github: summary({ phase0: pr(220, 'merged') }), stages: at('inbox') });
    expect(currentStage(html)).toBe('Inbox');
    expect(html).toContain(PRIMARY('Build it', '/omni:yolo 216'));
    expect(html).toContain('<code class="stage-command">/omni:yolo 216</code>');
    expect(links(html)).toEqual(['issue #216 open', 'phase-0 #220 ✓']);
  });

  it('Build it copies /omni:yolo <n> and says "Copied", or asks to copy by hand where the clipboard refuses', async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyCommand('/omni:yolo 216', { writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('/omni:yolo 216');
    expect(COPY_WORDS.copied).toBe('Copied');
    expect(await copyCommand('/omni:yolo 216', { writeText: () => Promise.reject(new Error('denied')) })).toBe('refused');
    expect(await copyCommand('/omni:yolo 216', undefined)).toBe('refused');
  });

  it('in the building stage, the slices merged out of the plan\'s on the track; in the outbox stage, Review & merge on GitHub', () => {
    const building = summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 2 });
    const html = page({ github: building, slices: 5, stages: at('building') });
    expect(currentStage(html)).toBe('Building · 2 of 5 slices');
    expect(button(html)).toBeNull();
    expect(html).not.toContain('data-primary');
    const ready = page({ github: { ...building, feature: pr(221, 'open') }, stages: at('outbox') });
    expect(button(ready)).toEqual(['https://github.com/vertuoza/vertuo-omni-loop/pull/221', 'Review &amp; merge']);
  });

  it('at building with open outbox items, the one primary answers them on the Outbox tab', () => {
    const item = { id: 's1-01-x', rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null };
    const comment = 'https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7';
    const red = summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 2, outbox: { open: [item], settled: [] }, outboxComment: comment });
    const html = page({ github: red, stages: at('building') });
    expect(html).not.toContain('stage-badge');
    expect(lede(html)).toBe('You answer the decision the agents left open.');
    expect(html).toContain(`<a class="omni-button omni-button--primary omni-button--md" href="/prd/${ID}" data-primary="">Answer 1 item</a>`);
  });

  it('the track says where the outbox stands: waiting, answered, or unread (PRD 2223)', () => {
    const item = (id: string) => ({ id, rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null });
    const comment = 'https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7';
    const answer = (number: number, id: string) => ({ number, id, text: 'B', by: 'paula', at: null, url: null, counted: true, door: 'github' as const });
    const base = summary({
      phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 3, outbox: { open: [item('a'), item('b')], settled: [] }, outboxComment: comment,
    });
    const numbering = [{ number: 1, id: 'a' }, { number: 4, id: 'b' }];
    const render = (replies: GithubSummary['replies']) => page({ github: { ...base, replies }, slices: 3, stages: at('building'), pick: tab('specifications') });

    const waiting = render({ numbering, pending: [answer(1, 'a')] });
    expect(currentStage(waiting)).toBe('Building · 3 of 3 slices · 1 of 2 answered');
    expect(waiting).toContain('>Answer 2 items</a>');
    expect(waiting).toContain('feature #221 · draft</a>');

    const answered = render({ numbering, pending: [answer(1, 'a'), answer(4, 'b')] });
    expect(currentStage(answered)).toBe('Building · 3 of 3 slices · answered');
    expect(lede(answered)).toBe('Every answer is in: you start the fix with them.');
    expect(answered).toContain('type="button" title="/omni:yolo-fix 216" data-primary="">Fix with answers</button>');
    expect(answered).toContain('<a class="stage-fixes ask-hint" href="?tab=outbox">Fixes with 1: B · 4: B</a>');

    const unread = render(UNREAD);
    expect(unread).toContain('>Answer 2 items</a>');
    expect(currentStage(unread)).toBe('Building · 3 of 3 slices');
    expect(unread).not.toContain('Fix with answers');
  });

  it('the head reads fixing on <runner> in place of answered while the PRD\'s fix job is queued or running (PRD 2270)', () => {
    const item = (id: string) => ({ id, rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null });
    const answer = (number: number, id: string) => ({ number, id, text: 'B', by: 'paula', at: null, url: null, counted: true, door: 'github' as const });
    const github = summary({
      phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 3, outbox: { open: [item('a')], settled: [] },
      outboxComment: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7', replies: { numbering: [{ number: 1, id: 'a' }], pending: [answer(1, 'a')] },
    });
    const fixing = page({ github, slices: 3, stages: at('building'), fixing: { runner: 'pierre-laptop' } });
    expect(currentStage(fixing)).toBe('Building · 3 of 3 slices · fixing on pierre-laptop');
    expect(lede(fixing)).toBe('The agents fix it with your answers on pierre-laptop. Nothing waits on you.');
    expect(fixing).not.toContain('Fix with answers');
    expect(fixing).not.toContain('data-primary');
    expect(currentStage(page({ github, slices: 3, stages: at('building'), fixing: null }))).toBe('Building · 3 of 3 slices · answered');
  });

  it('says when the stage was reached and last synced on hover, and lights nothing before the first sync', () => {
    expect(page({ github: summary(), stages: at('prd') })).toContain('title="PRD since 28 Sep 10:00 UTC · 23.3 h · last synced 29 Sep 2026, 09:15 UTC"');
    const syncing = page({ github: summary(), stages: [] });
    expect(track(syncing).every((stop) => stop.endsWith(':pending'))).toBe(true);
    expect(lede(syncing)).toBe('Its stages are being read from GitHub.');
  });

  it('in the shipped stage, Pitch and the retro comes next; in the retro stage, Pitch, with the retro PR in the links (PRD 859)', () => {
    const shipped = summary({ issue: { number: parseIssue(216), url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/216', state: 'closed' }, phase0: pr(220, 'merged'), feature: pr(221, 'merged'), mergedSlices: 5 });
    const html = page({ github: shipped, stages: at('shipped') });
    expect(lede(html)).toBe('Shipped: the retro is written next, and you may pitch it.');
    expect(button(html)).toBeNull();
    expect(html).toContain(PITCH_BUTTON);
    const retro = page({ github: { ...shipped, retro: pr(230, 'open') }, stages: at('retro'), pick: tab('specifications') });
    expect(track(retro)).toEqual(['Idea:done', 'PRD:done', 'Inbox:done', 'Building:done', 'Outbox:done', 'Shipped:done', 'Retro:current']);
    expect(button(retro)).toBeNull();
    expect(retro).toContain(PITCH_BUTTON);
    expect(links(retro)).toEqual(['issue #216 ✓', 'phase-0 #220 ✓', 'feature #221 ✓', 'retro #230 open']);
  });

  it('shows no Pitch at any stage before shipped (PRD 859)', () => {
    const pages = [
      page({ github: summary({ phase0: pr(220, 'open') }), stages: at('prd') }),
      page({ github: summary({ phase0: pr(220, 'merged') }), stages: at('inbox') }),
      page({ github: summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 2 }), stages: at('building') }),
      page({ github: summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open'), mergedSlices: 2 }), stages: at('outbox') }),
      page({ dossier: draft, me: PIERRE.user_id }),
      page(),
    ];
    for (const html of pages) expect(html).not.toContain('pitch-action');
  });

  it('when GitHub did not answer, still shows the stored stage and the rest of the page, with no GitHub-bound button', () => {
    for (const github of [null, summary({ retro: UNREAD })]) {
      const html = page({ github, stages: at('retro') });
      expect(track(html).at(-1)).toBe('Retro:current');
      expect(button(html)).toBeNull();
      expect(html).toContain(PITCH_BUTTON);
      expect(html).toContain('<p class="omni-page-header__eyebrow">PRD #216</p>');
      expect(html).toContain('<div class="dossier-tabbar">');
    }
  });

  it('shows the health chip beside the open feature PR\'s link, in its three looks, and none without a read care state (PRD 790, s2)', () => {
    const care = { ci: 'green' as const, failedUrl: null, conflict: false, base: 'main', threads: [], watchingSince: null, lastRound: null };
    const open = summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open'), mergedSlices: 2, care });
    const featureLink = '<a href="https://github.com/vertuoza/vertuo-omni-loop/pull/221" target="_blank" rel="noopener noreferrer">feature #221</a></span></span><span class="omni-list-row__trailing"><span class="ask-hint">open</span>';
    const specs = tab('specifications');
    expect(page({ github: open, stages: at('outbox'), pick: specs }))
      .toContain(`${featureLink}<span class="omni-badge omni-badge--success" title="PR care">CI ✓ · no conflict · 0 open</span></span></div></li>`);
    expect(page({ github: { ...open, care: { ...care, ci: 'red' } }, stages: at('outbox'), pick: specs })).toContain('<span class="omni-badge omni-badge--danger" title="PR care">CI red · no conflict · 0 open</span>');
    expect(page({ github: { ...open, care: { ...care, ci: 'running' } }, stages: at('outbox'), pick: specs })).toContain('<span class="omni-badge omni-badge--neutral" title="PR care">CI running · no conflict · 0 open</span>');
    for (const github of [{ ...open, care: UNREAD }, { ...open, care: null }, { ...open, feature: pr(221, 'merged') }, summary()]) {
      expect(page({ github, stages: at('outbox'), pick: specs })).not.toMatch(/omni-badge[^>]*>CI /);
    }
  });
});

describe('the head on the page anatomy, and About this PRD (omni-loop-20 s6)', () => {
  const pr = (number: number, state: PullRef['state'], draft = false): PullRef =>
    ({ number: parsePr(number), url: `https://github.com/vertuoza/vertuo-omni-loop/pull/${number}`, state, draft });
  const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers',
    issue: { number: parseIssue(216), url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/216', state: 'open' },
    phase0: null, feature: null, retro: null, mergedSlices: 0, ...more,
  });

  it('holds the head, then the tab row, then the pane, About this PRD placed in the Specifications tab (omni-loop-20 s7)', () => {
    const html = page({ github: summary({ phase0: pr(220, 'open') }), stages: at('prd') });
    const head = html.indexOf('<div class="dossier-top"><header class="omni-page-header">');
    const track = html.indexOf('<ol class="omni-stage-track');
    const tabs = html.indexOf('<div class="dossier-tabbar"><nav class="omni-tabs omni-tabs--md" aria-label="Artifacts">');
    const pane = html.indexOf('<section class="dossier-pane" aria-label="Specifications">');
    const about = html.indexOf('<section class="dossier-about" aria-label="About this PRD">');
    expect(head).toBeGreaterThanOrEqual(0);
    expect(track).toBeGreaterThan(head);
    expect(tabs).toBeGreaterThan(track);
    expect(pane).toBeGreaterThan(tabs);
    expect(about).toBeGreaterThan(pane);
    expect(html).not.toContain('dossier-facts');
    expect(html).not.toContain('class="dossier-head"');
    for (const other of ['brainstorm', 'outbox', 'feature', 'retro', 'timeline', 'voice'] as const) {
      expect(page({ github: summary({ phase0: pr(220, 'open') }), stages: at('prd'), pick: tab(other) }), other).not.toContain('dossier-about');
    }
  });

  it('puts Copy link then the one primary in the head, and the primary only where someone acts', () => {
    expect(actions(page({ github: summary({ phase0: pr(220, 'open') }), stages: at('prd') }))).toEqual(['Copy link', 'Approve spec']);
    const inbox = page({ github: summary({ phase0: pr(220, 'merged') }), stages: at('inbox') });
    expect(actions(inbox)).toEqual(['Copy link', 'Build it']);
    expect(headOf(inbox)).toContain('<code class="stage-command">/omni:yolo 216</code>');
    expect(actions(page({ github: summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open'), mergedSlices: 2 }), stages: at('outbox') }))).toEqual(['Copy link', 'Review &amp; merge']);
    expect(actions(page())).toEqual(['Copy link']);
  });

  it('gives a draft\'s opener the Actions menu, and nobody else', () => {
    expect(headOf(page({ dossier: draft, me: PIERRE.user_id }))).toMatch(/<button[^>]*class="omni-button omni-button--secondary omni-button--md"[^>]*>Actions<span class="omni-icon/);
    expect(headOf(page({ dossier: draft, me: MARIE.user_id }))).not.toContain('>Actions<');
    expect(headOf(page({ dossier: draft, me: PIERRE.user_id, supabase: null }))).not.toContain('>Actions<');
    expect(headOf(page({ dossier: numbered, me: PIERRE.user_id }))).not.toContain('>Actions<');
  });

  it('lists the repository, On GitHub and Opened in About this PRD at every stage', () => {
    for (const stage of ['prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'] as const) {
      const html = page({ github: summary({ phase0: pr(220, 'merged') }), stages: at(stage), pick: tab('specifications') });
      expect(facts(html), stage).toEqual(['Repository', 'On GitHub', 'Opened']);
      expect(aboutOf(html)).toContain('<ul class="stage-links" aria-label="On GitHub">');
      expect(textOf(aboutOf(html))).toContain('opened by Pierre · 27 Sep 2026, 09:12 UTC');
    }
  });

  it('says Repositories for more than one repository, each a chip, and counts them in the meta row', () => {
    const html = page({ repos: ['vertuoza/vertuo-omni-loop', 'demo-org/nimbus-web'] });
    expect(facts(html)).toEqual(['Repositories', 'Opened']);
    expect(aboutOf(html)).toContain(`<ul class="dossier-repos" aria-label="Repositories">${REPO_CHIP('vertuoza/vertuo-omni-loop')}${REPO_CHIP('demo-org/nimbus-web')}</ul>`);
    expect(meta(html)[0]).toBe('2 repositories');
  });

  it('shows a draft no On GitHub fact', () => {
    expect(facts(page({ dossier: draft, me: PIERRE.user_id, pick: tab('specifications') }))).toEqual(['Repository', 'Opened']);
  });

  it('shows the links GitHub gave when GitHub did not answer the rest', () => {
    for (const github of [null, summary({ retro: UNREAD })]) {
      expect(facts(page({ github, stages: at('shipped'), pick: tab('specifications') }))).toEqual(github ? ['Repository', 'On GitHub', 'Opened'] : ['Repository', 'Opened']);
    }
  });
});

describe('Delete draft', () => {
  it('is an action of the Actions menu, for the opener of a draft where the page can delete', () => {
    expect(page({ dossier: draft, me: PIERRE.user_id })).toContain('>Actions<');
    expect(page({ dossier: draft, me: MARIE.user_id })).not.toContain('Delete');
    expect(page({ dossier: numbered, me: PIERRE.user_id })).not.toContain('Delete');
  });

  it('asks before it deletes, and does nothing when the person says no', async () => {
    let asked = '';
    expect(await removeDraft(SUPABASE, ID, (question) => { asked = question; return false; })).toBeNull();
    expect(asked).toBe(DELETE_CONFIRM);
  });
});

describe('the tabs (omni-loop-20 s7)', () => {
  /** Each tab of the row: its label, its pill, its link (none while dimmed), whether it is current, its reason while dimmed, and its yellow. */
  const tabsOf = (html: string) => [...html.matchAll(/<(?:a|span) class="omni-tab( omni-tab--current| omni-tab--empty)?"(?: aria-current="page")?(?: aria-disabled="true" title="([^"]*)")?(?: href="([^"]+)")?>([^<]+)(?:<span class="omni-tab__count( omni-tab__count--attention)?">([^<]+)<\/span>)?<\/(?:a|span)>/g)]
    .map((m) => [m[4], m[6] ?? null, m[3]?.replaceAll('&amp;', '&') ?? null, m[1] === ' omni-tab--current', ...(m[2] ? [`dimmed: ${m[2]}`] : []), ...(m[5] ? ['yellow'] : [])]);

  it('AC-1: reads Brainstorm, Specifications, User voice, Outbox, Feature, Retro, Timeline, in that order, with no More menu, each count a pill', () => {
    const html = page();
    expect(tabsOf(html)).toEqual([
      ['Brainstorm', '1/2 answered', `/prd/${ID}?tab=brainstorm`, false],
      ['Specifications', 'v2', `/prd/${ID}`, true],
      ['User voice', null, null, false, 'dimmed: No voice yet: it appears once a brainstorm runs with personas.'],
      ['Outbox', null, null, false, 'dimmed: No decision yet: the outbox fills while the PRD is built.'],
      ['Feature', null, `/prd/${ID}?tab=feature`, false],
      ['Retro', null, null, false, 'dimmed: The retro is written when the feature PR merges.'],
      ['Timeline', null, `/prd/${ID}?tab=timeline`, false],
    ]);
    expect(html).not.toMatch(/>More</);
    expect(html).toContain('<div class="omni-segmented omni-segmented--md" role="group" aria-label="Specifications">');
    expect(html).toContain(`src="/prd/${ID}/v/2/page"`);
  });

  it('turns a pill yellow only while the tab waits on the viewer: a question they may answer', () => {
    const open = asked('r3', 'brainstorm', '2026-09-28T09:00:00Z', { questions: [SHAPE, { ...SHAPE, question: 'Why?' }] });
    expect(tabsOf(page({ questions: [...rounds, open] }))[0]).toEqual(['Brainstorm', '1/4', `/prd/${ID}?tab=brainstorm`, false]);
    expect(tabsOf(page({ questions: [...rounds, open], answerable: ['r3'] }))[0]).toEqual(['Brainstorm', '1/4', `/prd/${ID}?tab=brainstorm`, false, 'yellow']);
  });

  it('opens a draft on Brainstorm, and a draft with no question yet stays there, its reason said', () => {
    expect(tabsOf(page({ dossier: draft, me: PIERRE.user_id }))[0]).toEqual(['Brainstorm', '1/2 answered', `/prd/${ID}`, true]);
    expect(page({ dossier: draft, me: PIERRE.user_id })).toContain('dossier-rounds');
    expect(tabsOf(page({ dossier: draft, me: PIERRE.user_id, questions: [] }))[0]).toEqual(['Brainstorm', null, `/prd/${ID}`, true]);
  });
});

describe('a signed decision on the review screen only (omni-loop-20 s7)', () => {
  const SCREEN = {
    diffs: [{ path: 'plan.md', rows: [{ sign: '+' as const, text: 'two' }] }],
    sections: [{ name: 'Problem' as const, html: '<p>Nobody is told.</p>' }],
    spec: 'read' as const,
  };
  const server = (approval: Parameters<typeof dossierView>[0]['approval'], me: string, pick: DossierPick, tech = false) => {
    const techFacts = tech ? { tech: { user: me, state: 'asked' as const, approval: null }, techScreen: SCREEN } : {};
    const view = dossierView({
      dossier: { ...numbered, birthplace: 'server' }, versions, members: [PIERRE, MARIE], rounds, approval,
      approvalFacts: { voids: [], asked: [], screen: SCREEN, ...techFacts },
    }, me, pick);
    return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase: SUPABASE }));
  };
  const above = (html: string) => html.slice(0, html.indexOf('<section class="dossier-pane"'));

  it('AC-3: draws no approve panel above any tab, and Review and approve leads to the review screen', () => {
    for (const name of ['brainstorm', 'specifications', 'voice', 'outbox', 'feature', 'retro', 'timeline'] as const) {
      const html = server(null, MARIE.user_id, tab(name));
      expect(html, name).not.toContain('dossier-approve-screen');
      expect(html, name).not.toContain('>Approve</button>');
      expect(html, name).not.toContain('What changed since it was approved');
      expect(above(html), name).not.toContain('dossier-seal-card');
      expect(html, name).toContain(`<a class="omni-button omni-button--primary omni-button--md" href="/prd/${ID}/review" data-primary="">Review and approve</a>`);
    }
  });

  it('AC-2: opens on Specifications, whose one line links to the review screen, never an approve panel', () => {
    const html = server(null, MARIE.user_id, readPick({}));
    expect(html).toContain('<section class="dossier-pane" aria-label="Specifications">');
    expect(html).toContain(`<p class="omni-notice__title">This version waits for your approval.</p><div class="omni-notice__body"><a href="/prd/${ID}/review">Review and approve</a></div>`);
    expect(html).not.toContain('<a href="/prd/' + ID + '/review">Review and approve</a></div></div><section');
  });

  it('says it changed since it was approved, once drifted, with the same one line', () => {
    const approved = { id: 'a-1', approver_login: 'pierre', approved_at: '2026-09-27T12:00:00Z', files: [{ kind: 'spec' as const, path: 'spec.md', version_id: 'v1', sha256: 'abc' }] };
    const html = server(approved, MARIE.user_id, tab('specifications'));
    expect(html).toContain('It changed since it was approved: it waits for your approval again.');
    expect(html).toContain(`<a href="/prd/${ID}/review">Review and approve</a>`);
  });

  it('gives the named person one line to Review the plan, and no Give Tech Approval button on the page', () => {
    const html = server(null, MARIE.user_id, tab('specifications'), true);
    expect(html).not.toContain('Give Tech Approval</button>');
    expect(html).toContain(`<p class="omni-notice__title">The plan waits for your Tech Approval.</p><div class="omni-notice__body"><a href="/prd/${ID}/review">Review the plan</a></div>`);
  });

  it('keeps the seals and the verdict in the Approval record, at #approval, and nowhere above the pane', () => {
    const approved = { id: 'a-1', approver_login: 'pierre', approved_at: '2026-09-27T12:00:00Z', files: [{ kind: 'spec' as const, path: 'spec.md', version_id: 's2', sha256: 'abc' }, { kind: 'before-after' as const, path: 'before-after.html', version_id: 'b2' }] };
    const record = server(approved, MARIE.user_id, readPick({ segment: 'approval' }));
    expect(record).toContain('<section id="approval" class="dossier-seal-card" aria-label="Approved">');
    expect(above(record)).not.toContain('dossier-seal-card');
    expect(record).toContain(`aria-current="page" href="/prd/${ID}?segment=approval">Approval record</a>`);
    expect(server(approved, MARIE.user_id, tab('outbox'))).not.toContain('dossier-seal-card');
  });
});

describe('the Outbox tab (PRD 426)', () => {
  const outboxSummary = (outbox: GithubSummary['outbox'], outboxComment: GithubSummary['outboxComment'] = 'https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7'): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null, retro: null,
    phase0: { number: parsePr(220), url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: parsePr(221), url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'open', draft: false },
    mergedSlices: 2, outbox, outboxComment,
  });
  const OPEN = [
    { id: 's1-01-medium', rank: 'medium' as const, question: 'Keep <i>tabs</i> in the address?', decision: 'Kept them.', personSteps: null,
      options: [{ letter: 'A', text: 'Keep them.' }, { letter: 'B', text: 'Drop them.' }] },
    { id: 's2-01-key', rank: 'human-action' as const, question: 'Who adds the key?', decision: null, options: [], personSteps: 'Add the key on the host.' },
  ];
  const SETTLED = [{ id: 's1-02-zeta', title: 'Zeta or eta?', verdict: 'agreed', answer: 'Zeta, as built.' }];
  const outbox = (github: GithubSummary | null) => page({ pick: tab('outbox'), github, stages: at('outbox') });

  it('links the outbox comment, lists the open items highest rank first, then the settled ones, raw HTML off', () => {
    const html = outbox(outboxSummary({ open: OPEN, settled: SETTLED }));
    expect(html).toContain('<section class="dossier-pane" aria-label="Outbox">');
    expect(html).toContain('<a href="https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7" target="_blank" rel="noopener noreferrer">on the pull request</a>');
    expect([...html.matchAll(/<article id="(s\d-\d\d-[a-z]+)" class="outbox-entry"/g)].map((m) => m[1])).toEqual(['s2-01-key', 's1-01-medium']);
    expect([...html.matchAll(/<span class="outbox-rank" data-rank="[a-z-]+"><span class="omni-badge[^"]*">([^<]+)<\/span><\/span>/g)].map((m) => m[1])).toEqual(['needs a person', 'medium', 'agreed']);
    expect(html).toContain('Keep &lt;i&gt;tabs&lt;/i&gt; in the address?');
    expect(html).not.toContain('<i>tabs</i>');
    expect(html).toContain('<span class="ask-rec">built · recommended</span><span class="outbox-option-text"><p>Keep them.</p>');
    expect(html).toContain('<span class="ask-hint">Decision taken</span><div class="dossier-md"><p>Kept them.</p>');
    expect(html).toContain('<div class="dossier-md outbox-steps"><p>Add the key on the host.</p>');
    expect(html).toContain('<summary>Settled · 1</summary>');
    expect(html).toContain('Zeta or eta?');
    expect(html).toContain('<p class="outbox-settled-answer">Zeta, as built.</p>');
    expect(html).toContain('Outbox<span class="omni-tab__count omni-tab__count--attention">2 open</span>');
    expect(html).toContain('>Answer 2 items</a>');
  });

  it('with none open, says nothing is waiting, lists the settled ones, and counts them on the tab', () => {
    const html = outbox(outboxSummary({ open: [], settled: SETTLED }));
    expect(html).toContain('<p class="omni-empty-state__title">Nothing is waiting on you.</p>');
    expect(html).toContain('Outbox<span class="omni-tab__count">1 settled</span>');
    expect(html).toContain('>Review &amp; merge</a>');
  });

  it('is dimmed and says why while empty, and says when GitHub did not answer', () => {
    const empty = outbox(outboxSummary(null));
    expect(empty).toContain('<a class="omni-tab omni-tab--current" aria-current="page" href="/prd/00000000-0000-4000-8000-0000000000d1?tab=outbox">Outbox</a>');
    expect(page({ github: outboxSummary(null), stages: at('outbox') })).toContain('<span class="omni-tab omni-tab--empty" aria-disabled="true" title="No decision yet: the outbox fills while the PRD is built.">Outbox</span>');
    expect(empty).toContain('<p class="omni-empty-state__title">No decision yet: the outbox fills while the PRD is built.</p>');
    for (const html of [outbox(null), outbox(outboxSummary(UNREAD))]) {
      expect(html).toContain('<div class="omni-notice__body">GitHub did not answer. The page tries again within a minute.</div>');
    }
  });
});

describe('the Retro tab (PRD 426, s3)', () => {
  const RETRO_URL = 'https://github.com/vertuoza/vertuo-omni-loop/pull/230';
  const retroSummary = (retro: GithubSummary['retro'], retroText: GithubSummary['retroText']): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null,
    phase0: { number: parsePr(220), url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: parsePr(221), url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'merged', draft: false },
    mergedSlices: 3, retro, retroText,
  });
  const pr = (state: PullRef['state']): PullRef => ({ number: parsePr(230), url: RETRO_URL, state, draft: false });
  const retro = (github: GithubSummary | null) => page({ pick: tab('retro'), github });
  const RETRO = '# How PRD 216 went\n\nThree waves, <script>alert(1)</script> one rework.\n';

  it('shows Open the retro PR on top, then retro.md rendered from markdown, raw HTML off, as the sixth tab', () => {
    const html = retro(retroSummary(pr('open'), RETRO));
    expect(html).toContain('<section class="dossier-pane" aria-label="Retro">');
    expect(html).toContain(`<a class="ask-button" href="${RETRO_URL}" target="_blank" rel="noopener noreferrer">Open the retro PR</a>`);
    expect(html).toContain('<article class="dossier-md"><h1>How PRD 216 went</h1>');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`<a class="omni-tab omni-tab--current" aria-current="page" href="/prd/${ID}?tab=retro">Retro<span class="omni-tab__count">open PR</span></a>`);
    expect(html.indexOf('>Outbox')).toBeLessThan(html.indexOf('>Retro<'));
  });

  it('is badged merged once the retro PR is merged', () => {
    expect(retro(retroSummary(pr('merged'), RETRO))).toContain('Retro<span class="omni-tab__count">merged</span></a>');
  });

  it('is dimmed and says why while there is no retro, and says when GitHub did not answer', () => {
    const empty = retro(retroSummary(null, null));
    expect(empty).toContain(`<a class="omni-tab omni-tab--current" aria-current="page" href="/prd/${ID}?tab=retro">Retro</a>`);
    expect(empty).toContain('<p class="dossier-empty">The retro is written when the feature PR merges.</p>');
    expect(empty).not.toContain('Open the retro PR');
    for (const html of [retro(null), retro(retroSummary(pr('open'), UNREAD))]) {
      expect(html).toContain('<p class="ask-problem" role="alert">GitHub did not answer. The page tries again within a minute.</p>');
      expect(html).not.toContain('dossier-md');
    }
  });
});

describe('the Questions tab', () => {
  const questions = (more: Parameters<typeof page>[0] = {}) => page({ pick: tab('questions'), ...more });

  it('lists each round in the order asked, marked brainstorm or delivery, with no picker and no frame', () => {
    const html = questions();
    expect(html).toContain('<ol class="dossier-rounds" aria-label="Questions, in the order they were asked">');
    expect([...html.matchAll(/<li id="(r\d)" class="dossier-round" data-rule="([a-z]+)" data-state="([a-z]+)">/g)].map((m) => [m[1], m[2], m[3]]))
      .toEqual([['r1', 'brainstorm', 'answered'], ['r2', 'delivery', 'moved']]);
    expect([...html.matchAll(/<span class="dossier-rule">([a-z]+)<\/span>/g)].map((m) => m[1])).toEqual(['brainstorm', 'delivery']);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<iframe');
  });

  it('folds an answered round: a closed <details> whose <summary> is its line (PRD 498)', () => {
    const [answered] = rounds;
    assertDefined(answered, 'the answered round');
    const html = questions({ questions: [answered] });
    expect(html).toMatch(/<li id="r1" class="dossier-round" data-rule="brainstorm" data-state="answered"><details class="dossier-fold"><summary class="dossier-round-line">/);
    expect(html).not.toMatch(/<details[^>]* open/);
    const line = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(line).toContain('<span class="dossier-mark" data-state="answered"');
    expect(line).toContain('<span class="dossier-rule">brainstorm</span>');
    expect(line).toContain('<span class="dossier-category" data-category="ux-ui">UX/UI</span>');
    expect(line).toContain('— shape');
    expect(line).toContain('<span class="dossier-round-count">1/1</span>');
    expect(line).toContain('27 Sep, 09:15');
    expect(textOf(line)).toContain('answered by Marie after 1 min 35 s, on the page');
    expect(line).toMatch(/<span class="dossier-outcome">answered by <span class="person-chip is-inline">/);
    expect(line).toMatch(chip('Marie'));
  });

  it('shows an answered question, as text, on one line: chip · question → the chosen option, in no box', () => {
    const html = questions();
    expect(html).toContain('Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?');
    expect(html).not.toContain('<b>hexagonal</b>');
    expect(html).toContain('<p class="dossier-q-text dossier-q-line"><span class="ask-chip">Shape</span> '
      + '<span class="dossier-q-asked">Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?</span> → '
      + '<span class="dossier-chosen" aria-label="Chosen option"><span class="dossier-choice"><span class="dossier-option-label">Square<span class="ask-rec">Recommended</span></span>'
      + '<span class="dossier-option-desc">cheaper</span></span></span></p>');
    expect(html).not.toContain('dossier-option"');
    expect(html).not.toContain('data-chosen');
    expect(html).not.toContain('Hexagonal');
    expect(html).not.toContain('prettier');
  });

  it('shows each chosen option of a multi-select answer, and an answer matching no option as its text', () => {
    const checks = {
      question: 'Which checks?', header: 'Checks', multiSelect: true,
      options: [{ label: 'Unit', description: 'fast' }, { label: 'Access', description: 'two accounts' }, { label: 'Manual', description: 'slow' }],
    };
    const html = questions({
      questions: [
        asked('r5', 'brainstorm', '2026-09-27T10:00:00Z', {
          questions: [checks], status: 'answered', answers: { [checks.question]: 'Unit, Access' }, answered_via: 'page', answered_by: PIERRE.user_id,
          answered_at: '2026-09-27T10:01:00Z',
        }),
        asked('r6', 'brainstorm', '2026-09-27T10:05:00Z', {
          status: 'answered', answers: { [SHAPE.question]: 'Triangles, <i>obviously</i>' }, answered_via: 'page', answered_by: PIERRE.user_id,
          answered_at: '2026-09-27T10:06:00Z',
        }),
      ],
    });
    expect([...html.matchAll(/<span class="dossier-option-label">([^<]+)/g)].map((m) => m[1])).toEqual(['Unit', 'Access']);
    expect(html).toContain('<span class="dossier-chosen" aria-label="Chosen options">');
    expect(html).not.toContain('Manual');
    expect(html).not.toContain('Hexagonal');
    expect(html).toContain('→ <span class="dossier-answer">Triangles, &lt;i&gt;obviously&lt;/i&gt;</span>');
  });

  it('never folds an open round: no <details>, its line no control, and every option shown (PRD 498)', () => {
    const html = questions({ questions: [asked('r7', 'brainstorm', '2026-09-27T10:00:00Z')] });
    expect(html).toContain('<li id="r7" class="dossier-round" data-rule="brainstorm" data-state="open"><div class="dossier-round-line">');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<summary');
    expect(html).toContain('<span class="dossier-round-count"><span class="dossier-left">1 to answer</span></span>');
    expect(html).toContain('<ul class="dossier-options" aria-label="Options, one could be chosen">');
    expect([...html.matchAll(/<span class="dossier-option-label">([^<]+)/g)].map((m) => m[1])).toEqual(['Square', 'Hexagonal']);
    expect(html).not.toContain('data-chosen');
    expect(html).toContain('not answered yet');
  });

  it('folds a round moved to the terminal, its line saying so, with no option', () => {
    const [, moved] = rounds;
    assertDefined(moved, 'the moved round');
    const html = questions({ questions: [moved] });
    expect(html).toMatch(/<li id="r2" class="dossier-round" data-rule="delivery" data-state="moved"><details class="dossier-fold"><summary class="dossier-round-line">/);
    const line = html.slice(html.indexOf('<summary'), html.indexOf('</summary>'));
    expect(line).toContain('<span class="dossier-round-count">moved to the terminal</span>');
    expect(html).toContain('Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?');
    expect(html).not.toContain('dossier-option');
    expect(html).toContain('<p class="dossier-outcome">moved to the terminal, no answer recorded</p>');
  });

  it('counts the questions in a strip above the list, with a meter (PRD 498)', () => {
    const open = asked('r3', 'brainstorm', '2026-09-28T09:00:00Z', { questions: [SHAPE, { ...SHAPE, question: 'Why?' }] });
    const html = questions({ questions: [...rounds, open] });
    expect(html).toContain('<div class="dossier-progress"><p class="dossier-progress-words">1 of 4 answered <span class="dossier-left">2 to answer</span></p>'
      + '<meter class="dossier-meter" aria-label="Questions answered" min="0" max="4" value="1"></meter></div>');
    expect(html).toMatch(/<h2 class="omni-section-heading__title">Questions<\/h2><span class="omni-section-heading__count">1\/4<\/span>/);
    expect(html).toContain('class="omni-list-row omni-list-row--normal"');
    expect(html.indexOf('dossier-progress')).toBeLessThan(html.indexOf('dossier-rounds'));
    expect(questions()).toContain('<p class="dossier-progress-words">1 of 2 answered</p>');
  });

  it('says who answered and after how long, its category, who asked and where, and links to the question', () => {
    const html = questions();
    expect(textOf(html)).toContain('answered by Marie after 1 min 35 s, on the page');
    expect(html).toContain('moved to the terminal, no answer recorded');
    expect(html).toContain('<span class="dossier-category" data-category="ux-ui">UX/UI</span>');
    expect(html).toContain('<span class="dossier-category" data-category="unsorted">unsorted</span>');
    expect(textOf(html)).toContain('asked by Pierre · 27 Sep 2026, 09:15 UTC');
    expect(html).toMatch(chip('Pierre'));
    expect(html).toContain('vertuoza/vertuo-omni-loop · feat/prd-dossiers--s3 · PRD #216 · /omni:do-work');
    expect(html).toContain(`<a class="dossier-round-link" href="/ask/q/r1?from=${ID}">Open the question</a>`);
  });

  it('says when no question was asked yet', () => {
    const html = questions({ questions: [] });
    expect(html).toContain('No question yet.');
    expect(html).toContain('The questions the agent asks with ask mode on show here');
    expect(html).not.toMatch(/claude/i);
    expect(html).not.toContain('dossier-rounds');
  });

  it('says when the questions could not be read, and still shows the dossier', () => {
    const html = questions({ questions: null });
    expect(html).toContain('role="alert"');
    expect(html).toContain('The questions could not be read.');
    expect(html).toContain('PRD #216');
  });
});

describe('a quick round on the Questions tab (PRD 384)', () => {
  const AT = '2026-09-28T09:00:00Z';
  const SOON = Date.parse(AT) + 60_000;
  const open = asked('q1', 'brainstorm', AT);
  const later = asked('q2', 'brainstorm', '2026-09-28T09:00:30Z', { questions: [SHAPE, SHAPE] });
  const quick = (more: Parameters<typeof page>[0] = {}) => page({ pick: tab('questions'), questions: [open, later], now: SOON, ...more });
  const buttons = (html: string) => [...html.matchAll(/<button class="omni-button[^"]*" type="button"[^>]*><span class="dossier-option-label">([^<]+)/g)].map((m) => m[1]);

  it('shows a person who may answer it one button per option, in place of the option list, with its Open link', () => {
    const html = quick({ answerable: ['q1'], questions: [open] });
    expect(buttons(html)).toEqual(['Square', 'Hexagonal']);
    expect(html).toContain('<ul class="dossier-quick-choices" aria-label="Answer with one click">');
    expect(html).toContain('<span class="dossier-option-desc">prettier</span>');
    expect(html).not.toContain('aria-label="Options, one could be chosen"><li');
    expect(html).toContain(`href="/ask/q/q1?from=${ID}">Open the question</a>`);
    expect(html).not.toContain('Waiting for');
  });

  it('keeps its buttons off until the script runs: with no script, the Open link answers it', () => {
    expect(quick({ answerable: ['q1'] })).toMatch(/<button class="omni-button[^"]*" type="button" disabled="">/);
  });

  it('shows anyone else its options and "Waiting for <owner>", with no button', () => {
    const html = quick({ answerable: [] });
    expect(buttons(html)).toEqual([]);
    expect(html).not.toContain('dossier-quick-choices');
    expect(html).toContain('aria-label="Options, one could be chosen"');
    expect(textOf(html)).toContain('Waiting for Pierre');
    expect(html).toMatch(/<p class="dossier-quick-note">Waiting for <span class="person-chip is-inline">/);
  });

  it('shows a round that is not quick with its Open link only', () => {
    const html = quick({ answerable: ['q1', 'q2'], questions: [later] });
    expect(html).not.toContain('dossier-quick-choices');
    expect(html).not.toContain('Waiting for');
    expect(html).toContain(`href="/ask/q/q2?from=${ID}">Open the question</a>`);
  });

  it('shows no button once its time is up', () => {
    const html = quick({ answerable: ['q1'], now: Date.parse(AT) + 540_000 });
    expect(html).not.toContain('dossier-quick-choices');
    expect(html).not.toContain('Waiting for');
  });

  it('shows no button where the page has no database to answer through (the demo)', () => {
    const html = quick({ answerable: ['q1'], supabase: null });
    expect(html).not.toContain('dossier-quick-choices');
    expect(html).toContain('aria-label="Options, one could be chosen"');
  });

  it('gives each round its id, so the way back lands on the next open round', () => {
    expect(quick()).toContain('<li id="q2" class="dossier-round"');
    expect(quick()).toContain('<li id="q1" class="dossier-round" data-rule="brainstorm" data-state="open">');
  });
});

describe('what a click that came second says', () => {
  const names = { 'u-marie': 'Marie' };
  it('names who came first, or says it moved', () => {
    expect(takenLine({ kind: 'taken', by: 'u-marie', via: 'page', moved: false }, names)).toBe('Already answered by Marie');
    expect(takenLine({ kind: 'taken', by: 'u-gone', via: 'page', moved: false }, names)).toBe('Already answered by someone who left the workspace');
    expect(takenLine({ kind: 'taken', by: null, via: 'terminal', moved: false }, names)).toBe('Already answered in the terminal.');
    expect(takenLine({ kind: 'taken', by: null, via: null, moved: true }, names)).toBe('This question moved to the terminal before your answer.');
  });

  it('draws the face of who came first before their name (PRD 652), and the words alone otherwise', () => {
    const quick = { names, faces: { 'u-marie': { kind: 'initial' as const, letter: 'M' } } };
    const taken = (outcome: Parameters<typeof takenLine>[0]) => renderToStaticMarkup(createElement(Taken, { outcome, quick }));
    expect(taken({ kind: 'taken', by: 'u-marie', via: 'page', moved: false }))
      .toBe('Already answered by <span class="person-chip is-inline"><span class="person-face is-initial" aria-hidden="true" data-initial="M"></span>Marie</span>');
    expect(taken({ kind: 'taken', by: 'u-gone', via: 'page', moved: false })).toBe('Already answered by someone who left the workspace');
    expect(taken({ kind: 'taken', by: 'u-marie', via: 'page', moved: true })).toBe('This question moved to the terminal before your answer.');
  });
});

describe('the Before/after tab', () => {
  it('frames the latest version on its sandboxed route, with scripts allowed and nothing else', () => {
    const html = page({ pick: tab('before-after') });
    const frame = html.match(/<iframe[^>]*>/)?.[0] ?? '';
    expect(frame).toContain(`src="/prd/${ID}/v/2/page"`);
    expect(frame).toContain('sandbox="allow-scripts"');
    expect(frame).toContain('title="Before/after, v2"');
    expect(html).toContain('sandboxed · no cookies · no network');
    expect(html).toContain(`href="/prd/${ID}/v/2/page"`);
  });

  it('frames the version picked', () => {
    expect(page({ pick: tab('before-after', 1) })).toContain(`src="/prd/${ID}/v/1/page"`);
  });
});

describe('the Spec and Plan tabs', () => {
  it('render the markdown, with the front matter as a line above it', () => {
    const html = page({ pick: tab('spec'), markdown: SPEC });
    expect(html).toContain('<p class="dossier-front">prd: 216 · title: PRD dossiers</p>');
    expect(html).toContain('<h1>PRD dossiers</h1>');
    expect(html).not.toContain('<iframe');
  });

  it('show raw HTML in the markdown as text', () => {
    const html = page({ pick: tab('spec'), markdown: SPEC });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('say so when a version could not be read', () => {
    expect(page({ pick: tab('spec'), markdown: null })).toContain('This version could not be read.');
  });
});

describe('the version picker (omni-loop-20 s11)', () => {
  it('is one button naming the shown version, its day and who, with no Show button', () => {
    const html = page({ pick: tab('spec'), markdown: SPEC });
    expect(html).toContain('<summary class="dossier-version__button"');
    expect(html).toContain('<span class="dossier-version__label">v2 · 28 Sep · commit a1b2c3d (github)</span>');
    expect(html).not.toContain('>Show</button>');
    expect(html).not.toMatch(/<select[^>]*name="v"/);
  });

  it('opens the list of versions newest first, each a link to the new address, the shown one current', () => {
    const html = page({ pick: tab('spec'), markdown: SPEC });
    const links = [...html.matchAll(/<li><a href="([^"]+)"( aria-current="true")?>([^<]+)<\/a><\/li>/g)].map((m) => [m[1], m[3], Boolean(m[2])]);
    expect(links).toEqual([
      [`/prd/${ID}?segment=spec&amp;v=2`, 'v2 · 28 Sep · commit a1b2c3d (github)', true],
      [`/prd/${ID}?segment=spec&amp;v=1`, 'v1 · 27 Sep · Pierre (kit)', false],
    ]);
    expect(html).not.toContain('tab=spec');
  });

  it('keeps the Before/after segment too, so a version picked there does not land on Spec', () => {
    expect(page({ pick: tab('before-after') })).toContain(`<li><a href="/prd/${ID}?v=1">`);
  });
});

describe('an artifact with no version yet', () => {
  it('says so, with no picker and no frame', () => {
    const plan = page({ pick: tab('plan') });
    expect(plan).toContain('The plan has no version yet.');
    expect(plan).not.toContain('<select');
    const empty = page({ dossier: draft, rows: [], questions: [], pick: tab('specifications') });
    expect(empty).toContain('The before/after page has no version yet.');
    expect(empty).not.toContain('<iframe');
    expect(page({ dossier: draft, rows: [], pick: tab('spec') })).toContain('The spec has no version yet.');
  });
});

describe('the pieces the browser takes over', () => {
  it('Copy link is one button until it is pressed', () => {
    expect(renderToStaticMarkup(createElement(CopyLink, { path: `/prd/${ID}` }))).toBe(
      '<span class="dossier-copy"><button class="omni-button omni-button--secondary omni-button--md" type="button">Copy link</button></span>',
    );
  });

  it('the pinned tab row writes its height as whole pixels, never negative, for the rounds to land under (PRD 476)', () => {
    expect(headHeight(212)).toBe('212px');
    expect(headHeight(211.2)).toBe('212px');
    expect(headHeight(0)).toBe('0px');
    expect(headHeight(-4)).toBe('0px');
    expect(headHeight(Number.NaN)).toBe('0px');
  });

  it('the sign-in card offers only GitHub and says the link opens for its members', () => {
    const html = renderToStaticMarkup(createElement(DossierSignIn, { supabase: SUPABASE, returnPath: `/prd/${ID}/callback`, error: 'Not allowed' }));
    expect(html).toContain('Sign in to read this PRD');
    expect(html).toContain('members of its workspace');
    expect(html).toContain('>Sign in with GitHub</button>');
    expect(html).not.toMatch(/google/i);
    expect(html).toContain('role="alert">Not allowed</p>');
  });
});

describe('Send to terminal beside a copy button (PRD 1830 s4)', () => {
  const setup: SendSetup = { repo: 'vertuoza/vertuo-omni-loop', options: [{ key: 'any', group: 'any', label: 'Any runner', state: null, target: { kind: 'any' } }] };
  const copy = (command: string, given: SendSetup | null) =>
    renderToStaticMarkup(createElement(SendToTerminalScope, { setup: given, children: createElement(StageHeaderCopy, { label: 'Copy', command }) }));

  it('shows beside a line a runner runs, when the page gives the viewer a runner', () => {
    expect(copy('/omni:pr-care 216', setup)).toContain('<code class="stage-command">/omni:pr-care 216</code><span class="send-terminal">');
  });

  it('is not drawn with no runner, or beside a line a runner does not run (the rework, a concept\'s brainstorm)', () => {
    expect(copy('/omni:pr-care 216', null)).not.toContain('Send to terminal');
    expect(copy('/omni:brainstorm --rework 216', setup)).not.toContain('Send to terminal');
    expect(copy('/omni:brainstorm --concept 1272 a2', setup)).not.toContain('Send to terminal');
  });
});

describe('the Pitch panel (PRD 859)', () => {
  const html = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);
  const noop = () => {};
  const panel = (more: Partial<Parameters<typeof PitchPanel>[0]> = {}) =>
    html(createElement(PitchPanel, { prd: parsePrd(216), audience: 'customers', disabled: false, copied: 'idle', onChoose: noop, onCopy: noop, ...more }));

  it('reads /omni:pitch <n> --for <audience>', () => {
    expect(pitchCommand(parsePrd(216), 'customers')).toBe('/omni:pitch 216 --for customers');
    expect(pitchCommand(parsePrd(216), 'inside')).toBe('/omni:pitch 216 --for inside');
  });

  it('opens on Customers, selected first, with its command, Copy and the one line', () => {
    const shown = panel();
    const customers = shown.indexOf('Customers');
    expect(customers).toBeGreaterThan(-1);
    expect(shown.indexOf('Inside')).toBeGreaterThan(customers);
    expect(shown).toContain('<input type="radio" name="pitch-audience-216" checked="" value="customers"/>');
    expect(shown).toContain('<input type="radio" name="pitch-audience-216" value="inside"/>');
    expect(shown).toContain('<code class="stage-command pitch-command">/omni:pitch 216 --for customers</code>');
    expect(shown).toContain('<button class="omni-button omni-button--secondary omni-button--md" type="button" title="/omni:pitch 216 --for customers">Copy</button>');
    expect(shown).toContain(PITCH_HINT);
    expect(PITCH_HINT).toBe('Run it in your coding agent, in this repository. The pitch shows on the Pitch tab.');
  });

  it('gives Send to terminal beside Copy when the page gives the viewer a runner, never in the demo (PRD 1830 s4)', () => {
    const setup: SendSetup = { repo: 'vertuoza/vertuo-omni-loop', options: [{ key: 'any', group: 'any', label: 'Any runner', state: null, target: { kind: 'any' } }] };
    const scoped = (disabled: boolean) => html(createElement(SendToTerminalScope, {
      setup, children: createElement(PitchPanel, { prd: parsePrd(216), audience: 'customers', disabled, copied: 'idle', onChoose: noop, onCopy: noop }),
    }));
    expect(panel()).not.toContain('Send to terminal');
    expect(scoped(false)).toContain('>Copy</button><span class="send-terminal"><button class="omni-button omni-button--quiet omni-button--md" type="button" aria-expanded="false">Send to terminal</button>');
    expect(scoped(true)).not.toContain('Send to terminal');
  });

  it('with Inside chosen, shows --for inside, and Copy carries the shown command', () => {
    const shown = panel({ audience: 'inside' });
    expect(shown).toContain('checked="" value="inside"');
    expect(shown).not.toContain('checked="" value="customers"');
    expect(shown).toContain('<code class="stage-command pitch-command">/omni:pitch 216 --for inside</code>');
    expect(shown).toContain('title="/omni:pitch 216 --for inside">Copy</button>');
    expect(shown).not.toContain('--for customers');
  });

  it('says Copied, or asks to copy by hand where the clipboard refuses', () => {
    expect(panel({ copied: 'copied' })).toContain(`<span class="ask-hint" role="status">${COPY_WORDS.copied}</span>`);
    expect(panel({ copied: 'refused' })).toContain(`<span class="ask-hint" role="status">${COPY_WORDS.refused}</span>`);
    expect(panel()).not.toContain('role="status"');
  });

  it('in the demo, shows the panel disabled: no choice can change and Copy does nothing', () => {
    const shown = panel({ disabled: true });
    expect(shown).toContain('<fieldset class="pitch-choices" disabled="">');
    expect(shown).toMatch(/<button class="omni-button omni-button--secondary omni-button--md" type="button" disabled="" title="[^"]+">Copy<\/button>/);
    expect(shown).toContain('/omni:pitch 216 --for customers');
    expect(shown).toContain('The demo cannot make a pitch.');
    expect(panel()).not.toContain('disabled=""');
  });

  it('the button opens nothing on the server: the panel is drawn once it is pressed', () => {
    const closed = html(createElement(PitchAction, { prd: parsePrd(216), disabled: false }));
    expect(closed).toContain(PITCH_BUTTON);
    expect(closed).not.toContain('pitch-panel');
  });

  it('the header passes the demo to the Pitch action, and only the Pitch action', () => {
    const shipped = stageView({ prd: parsePrd(216), rows: at('shipped') });
    expect(html(createElement(StageAction, { stage: shipped, demo: true }))).toContain('<span class="pitch-action" data-demo="true">');
    expect(html(createElement(StageAction, { stage: shipped }))).toContain('<span class="pitch-action">');
    const inbox = stageView({ prd: parsePrd(216), rows: at('inbox') });
    expect(html(createElement(StageAction, { stage: inbox, demo: true }))).toContain(PRIMARY('Build it', '/omni:yolo 216'));
  });

  it('a demo page at shipped draws its Pitch action disabled', () => {
    const view = dossierView({ dossier: numbered, versions, members: [PIERRE, MARIE], rounds, repos: null, answerable: [], stages: at('shipped'), demo: true }, MARIE.user_id, readPick({}), Date.now());
    const shown = renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase: null }));
    expect(shown).toContain('<span class="pitch-action" data-demo="true">');
  });
});
