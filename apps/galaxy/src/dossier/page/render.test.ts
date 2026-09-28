import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { renderMarkdown } from '../markdown';
import { UNREAD, type GithubSummary, type PullRef } from '../github/summary';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../store';
import { CopyLink } from './CopyLink';
import { DeleteDraft } from './DeleteDraft';
import { DossierPage } from './DossierPage';
import { DossierSignIn } from './DossierSignIn';
import { takenLine } from './QuickAnswer';
import { COPY_WORDS, copyCommand } from './StageHeaderCopy';
import { dossierView, readPick, type DossierPick } from './view';

// A quick round's buttons (PRD 384) refresh through the app router, which a static render has none of.
vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// /prd/<id> as the server renders it (PRD 216): what a person sees before any script runs, in each of
// its states — numbered or draft, each artifact tab, a version picked, an artifact with no version yet,
// the opener of a draft, the sign-in, and the Questions tab with its rounds, none, or none readable.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const MARIE = { user_id: 'u-marie', email: 'marie@vertuoza.com', name: 'Marie' };
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: 216, title: 'PRD dossiers',
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
  asked('r2', 'delivery', '2026-09-28T08:00:00Z', { status: 'abandoned', prd: 216, branch: 'feat/prd-dossiers--s3', skill: '/omni:do-work' }),
];

function page({
  dossier = numbered, rows = versions, pick = readPick({}), me = MARIE.user_id, markdown = null as string | null,
  supabase = SUPABASE as typeof SUPABASE | null, questions = rounds as DossierRoundRow[] | null,
  answerable = [] as string[], now = Date.now(), github = undefined as GithubSummary | null | undefined, slices = null as number | null,
} = {}) {
  const view = dossierView({ dossier, versions: rows, members: [PIERRE, MARIE], rounds: questions, answerable, github, slices }, me, pick, now);
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: markdown === null ? null : renderMarkdown(markdown), supabase }));
}
const tab = (name: DossierPick['tab'], v?: number): DossierPick => ({ tab: name, version: v ?? null });

describe('the header', () => {
  it('shows PRD #n, the title, the repository chips, who opened it and when, and Copy link', () => {
    const html = page();
    expect(html).toMatch(/<h1 class="dossier-title"><a class="dossier-number" href="https:\/\/github.com\/vertuoza\/vertuo-omni-loop\/issues\/216" target="_blank" rel="noopener noreferrer">PRD #216 ↗<\/a> ?<span>PRD dossiers<\/span><\/h1>/);
    expect(html).toContain('<li class="dossier-repo">vertuoza/vertuo-omni-loop</li>');
    expect(html).toContain('opened by Pierre · 27 Sep 2026, 09:12 UTC');
    expect(html).toContain('>Copy link</button>');
  });

  it('shows DRAFT for a draft', () => {
    const html = page({ dossier: draft, pick: tab('before-after') });
    expect(html).toContain('<span class="dossier-draft">DRAFT</span>');
    expect(html).toContain('Offline quotes on the site app');
    expect(html).not.toContain('PRD #');
    expect(html).not.toContain('/issues/');
    expect(html).toContain('<li class="stage-stop stage-current" aria-current="step">idea</li>');
    expect(html).toContain('<strong>Stage: idea</strong><span class="ask-hint"> · Brainstorm in progress</span>');
  });
});

describe('the stage header (PRD 426)', () => {
  const pr = (number: number, state: PullRef['state'], draft = false): PullRef =>
    ({ number, url: `https://github.com/vertuoza/vertuo-omni-loop/pull/${number}`, state, draft });
  const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers',
    issue: { number: 216, url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/216', state: 'open' },
    phase0: null, feature: null, retro: null, mergedSlices: 0, ...more,
  });
  const track = (html: string) => [...html.matchAll(/<li class="stage-stop stage-(\w+)"[^>]*>(?:<span aria-hidden="true">✓ <\/span>)?([^<]+)<\/li>/g)]
    .map((m) => `${m[2]}:${m[1]}`);
  const button = (html: string) => /<a class="ask-button stage-action" href="([^"]+)"[^>]*>([^<]+)<\/a>/.exec(html)?.slice(1) ?? null;
  const links = (html: string) => [...html.matchAll(/<li><a href="[^"]+" target="_blank" rel="noopener noreferrer">([^<]+)<\/a> <span class="ask-hint">([^<]+)<\/span><\/li>/g)]
    .map((m) => `${m[1]} ${m[2]}`);

  it('shows no track when GitHub was not asked', () => {
    expect(page()).not.toContain('stage-track');
  });

  it('in the PRD stage, Approve spec opens the phase-0 PR; with none open yet, no button and "Spec being written"', () => {
    const html = page({ github: summary({ phase0: pr(220, 'open') }) });
    expect(track(html)).toEqual(['idea:passed', 'PRD:current', 'inbox:ahead', 'outbox:ahead', 'shipped:ahead', 'retro:ahead']);
    expect(html).toContain('<strong>Stage: PRD</strong>');
    expect(button(html)).toEqual(['https://github.com/vertuoza/vertuo-omni-loop/pull/220', 'Approve spec']);
    expect(links(html)).toEqual(['issue #216 open', 'phase-0 #220 open']);
    const writing = page({ github: summary() });
    expect(button(writing)).toBeNull();
    expect(writing).toContain('Spec being written');
  });

  it('in the inbox stage, Build it is a button carrying the command to copy', () => {
    const html = page({ github: summary({ phase0: pr(220, 'merged') }) });
    expect(html).toContain('<strong>Stage: inbox</strong>');
    expect(html).toContain('<button type="button" class="ask-button stage-action" title="/omni:yolo 216">Build it</button>');
    expect(html).toContain('<code class="stage-command">/omni:yolo 216</code>');
    expect(links(html)).toEqual(['issue #216 open', 'phase-0 #220 ✓']);
  });

  it('Build it copies /omni:yolo <n> and says "Copied", or asks to copy by hand where the clipboard refuses', async () => {
    const writeText = vi.fn(async () => {});
    expect(await copyCommand('/omni:yolo 216', { writeText })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('/omni:yolo 216');
    expect(COPY_WORDS.copied).toBe('Copied');
    expect(await copyCommand('/omni:yolo 216', { writeText: async () => { throw new Error('denied'); } })).toBe('refused');
    expect(await copyCommand('/omni:yolo 216', undefined)).toBe('refused');
  });

  it('in the outbox stage, being built with the slices merged out of the plan\'s, then Review & merge once the feature PR is ready', () => {
    const building = summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 2 });
    const html = page({ github: building, slices: 5 });
    expect(html).toContain('<strong>Stage: outbox</strong><span class="ask-hint"> · Being built · 2/5 slices</span>');
    expect(button(html)).toBeNull();
    expect(button(page({ github: { ...building, feature: pr(221, 'open') } }))).toEqual(['https://github.com/vertuoza/vertuo-omni-loop/pull/221', 'Review &amp; merge']);
  });

  it('in the shipped stage, no button and the retro comes next; in the retro stage, Read the retro opens the retro PR', () => {
    const shipped = summary({ issue: { number: 216, url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/216', state: 'closed' }, phase0: pr(220, 'merged'), feature: pr(221, 'merged'), mergedSlices: 5 });
    const html = page({ github: shipped });
    expect(html).toContain('Shipped · the retro is written next');
    expect(button(html)).toBeNull();
    const retro = page({ github: { ...shipped, retro: pr(230, 'open') } });
    expect(track(retro)).toEqual(['idea:passed', 'PRD:passed', 'inbox:passed', 'outbox:passed', 'shipped:passed', 'retro:current']);
    expect(button(retro)).toEqual(['https://github.com/vertuoza/vertuo-omni-loop/pull/230', 'Read the retro']);
    expect(links(retro)).toEqual(['issue #216 ✓', 'phase-0 #220 ✓', 'feature #221 ✓', 'retro #230 open']);
  });

  it('when GitHub did not answer, lights nothing, says so, and still shows the rest of the page', () => {
    for (const github of [null, summary({ retro: UNREAD })]) {
      const html = page({ github });
      expect(track(html).every((stop) => stop.endsWith(':ahead'))).toBe(true);
      expect(html).toContain('<p class="stage-words" role="status"><strong>Stage unknown: GitHub did not answer.</strong></p>');
      expect(button(html)).toBeNull();
      expect(html).toContain('PRD #216 ↗');
      expect(html).toContain('<nav class="dossier-tabs"');
    }
  });
});

describe('Delete', () => {
  it('is offered to the opener of a draft', () => {
    expect(page({ dossier: draft, me: PIERRE.user_id })).toContain('>Delete draft</button>');
  });

  it('is offered to nobody else, and to nobody on a numbered dossier', () => {
    expect(page({ dossier: draft, me: MARIE.user_id })).not.toContain('Delete');
    expect(page({ dossier: numbered, me: PIERRE.user_id })).not.toContain('Delete');
  });

  it('is not offered where the page has no database to delete from', () => {
    expect(page({ dossier: draft, me: PIERRE.user_id, supabase: null })).not.toContain('Delete');
  });
});

describe('the tabs', () => {
  const tabsOf = (html: string) => [...html.matchAll(/<a class="dossier-tab( dossier-tab-empty)?" href="([^"]+)"( aria-current="page")?>([^<]+)(?:<small>([^<]+)<\/small>)?<\/a>/g)]
    .map((m) => [m[4], m[5] ?? null, m[2].replaceAll('&amp;', '&'), Boolean(m[3]), ...(m[1] ? ['dimmed'] : [])]);

  it('reads Questions with answered out of asked, then Before/after, Spec and Plan with their latest versions, opening on Questions', () => {
    expect(tabsOf(page())).toEqual([
      ['Questions', '1/2 answered', `/prd/${ID}`, true],
      ['Before/after', 'v2', `/prd/${ID}?tab=before-after`, false],
      ['Spec', 'v2', `/prd/${ID}?tab=spec`, false],
      ['Plan', null, `/prd/${ID}?tab=plan`, false],
      ['Outbox', null, `/prd/${ID}?tab=outbox`, false, 'dimmed'],
      ['Retro', null, `/prd/${ID}?tab=retro`, false, 'dimmed'],
    ]);
    expect(page()).toContain('dossier-rounds');
  });

  it('opens on Before/after when no question was asked yet', () => {
    const html = page({ questions: [] });
    expect(tabsOf(html)).toEqual([
      ['Questions', null, `/prd/${ID}?tab=questions`, false],
      ['Before/after', 'v2', `/prd/${ID}`, true],
      ['Spec', 'v2', `/prd/${ID}?tab=spec`, false],
      ['Plan', null, `/prd/${ID}?tab=plan`, false],
      ['Outbox', null, `/prd/${ID}?tab=outbox`, false, 'dimmed'],
      ['Retro', null, `/prd/${ID}?tab=retro`, false, 'dimmed'],
    ]);
    expect(html).toContain(`src="/prd/${ID}/v/2/page"`);
  });
});

describe('the Outbox tab (PRD 426)', () => {
  const outboxSummary = (outbox: GithubSummary['outbox'], outboxComment: GithubSummary['outboxComment'] = 'https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7'): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null, retro: null,
    phase0: { number: 220, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: 221, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'open', draft: false },
    mergedSlices: 2, outbox, outboxComment,
  });
  const OPEN = [
    { id: 's1-01-medium', rank: 'medium' as const, question: 'Keep <i>tabs</i> in the address?', decision: 'Kept them.', personSteps: null,
      options: [{ letter: 'A', text: 'Keep them.' }, { letter: 'B', text: 'Drop them.' }] },
    { id: 's2-01-key', rank: 'human-action' as const, question: 'Who adds the key?', decision: null, options: [], personSteps: 'Add the key on the host.' },
  ];
  const SETTLED = [{ id: 's1-02-zeta', title: 'Zeta or eta?', verdict: 'agreed', answer: 'Zeta, as built.' }];
  const outbox = (github: GithubSummary | null) => page({ pick: tab('outbox'), github });

  it('links the outbox comment, lists the open items highest rank first, then the settled ones, raw HTML off', () => {
    const html = outbox(outboxSummary({ open: OPEN, settled: SETTLED }));
    expect(html).toContain('<section class="dossier-pane" aria-label="Outbox">');
    expect(html).toContain('<a href="https://github.com/vertuoza/vertuo-omni-loop/pull/221#issuecomment-7" target="_blank" rel="noopener noreferrer">on the pull request</a>');
    expect([...html.matchAll(/<article id="(s\d-\d\d-[a-z]+)" class="outbox-card"/g)].map((m) => m[1])).toEqual(['s2-01-key', 's1-01-medium']);
    expect([...html.matchAll(/<span class="outbox-rank" data-rank="[a-z-]+">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(['needs a person', 'medium', 'agreed']);
    expect(html).toContain('Keep &lt;i&gt;tabs&lt;/i&gt; in the address?');
    expect(html).not.toContain('<i>tabs</i>');
    expect(html).toContain('<span class="ask-rec">built · recommended</span><span class="outbox-option-text"><p>Keep them.</p>');
    expect(html).toContain('<span class="ask-hint">Decision taken</span><div class="dossier-md"><p>Kept them.</p>');
    expect(html).toContain('<div class="dossier-md outbox-steps"><p>Add the key on the host.</p>');
    expect(html).toContain('<summary>Settled · 1</summary>');
    expect(html).toContain('Zeta or eta?');
    expect(html).toContain('<p class="outbox-settled-answer">Zeta, as built.</p>');
    expect(html).toContain('<small>2 open</small>');
    expect(html).toContain('<strong>Stage: outbox</strong>');
    expect(html).toContain('>Answer the outbox</a>');
  });

  it('with none open, says nothing is waiting, lists the settled ones, and counts them on the tab', () => {
    const html = outbox(outboxSummary({ open: [], settled: SETTLED }));
    expect(html).toContain('<p class="outbox-nothing">Nothing is waiting on you.</p>');
    expect(html).toContain('<small>1 settled</small>');
    expect(html).toContain('>Review &amp; merge</a>');
  });

  it('is dimmed and says why while empty, and says when GitHub did not answer', () => {
    const empty = outbox(outboxSummary(null));
    expect(empty).toContain('<a class="dossier-tab dossier-tab-empty" href="/prd/00000000-0000-4000-8000-0000000000d1?tab=outbox" aria-current="page">Outbox</a>');
    expect(empty).toContain('<p class="dossier-empty">No decision yet: the outbox fills while the PRD is built.</p>');
    for (const html of [outbox(null), outbox(outboxSummary(UNREAD))]) {
      expect(html).toContain('<p class="ask-problem" role="alert">GitHub did not answer. The page tries again within a minute.</p>');
    }
  });
});

describe('the Retro tab (PRD 426, s3)', () => {
  const RETRO_URL = 'https://github.com/vertuoza/vertuo-omni-loop/pull/230';
  const retroSummary = (retro: GithubSummary['retro'], retroText: GithubSummary['retroText']): GithubSummary => ({
    repo: 'vertuoza/vertuo-omni-loop', prd: 216, folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null,
    phase0: { number: 220, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/220', state: 'merged', draft: false },
    feature: { number: 221, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'merged', draft: false },
    mergedSlices: 3, retro, retroText,
  });
  const pr = (state: PullRef['state']): PullRef => ({ number: 230, url: RETRO_URL, state, draft: false });
  const retro = (github: GithubSummary | null) => page({ pick: tab('retro'), github });
  const RETRO = '# How PRD 216 went\n\nThree waves, <script>alert(1)</script> one rework.\n';

  it('shows Open the retro PR on top, then retro.md rendered from markdown, raw HTML off, as the sixth tab', () => {
    const html = retro(retroSummary(pr('open'), RETRO));
    expect(html).toContain('<section class="dossier-pane" aria-label="Retro">');
    expect(html).toContain(`<a class="ask-button" href="${RETRO_URL}" target="_blank" rel="noopener noreferrer">Open the retro PR</a>`);
    expect(html).toContain('<article class="dossier-md"><h1>How PRD 216 went</h1>');
    expect(html).not.toContain('<script>');
    expect(html).toContain(`<a class="dossier-tab" href="/prd/${ID}?tab=retro" aria-current="page">Retro<small>open PR</small></a>`);
    expect(html.indexOf('>Outbox')).toBeLessThan(html.indexOf('>Retro<'));
  });

  it('is badged merged once the retro PR is merged', () => {
    expect(retro(retroSummary(pr('merged'), RETRO))).toContain('Retro<small>merged</small></a>');
  });

  it('is dimmed and says why while there is no retro, and says when GitHub did not answer', () => {
    const empty = retro(retroSummary(null, null));
    expect(empty).toContain(`<a class="dossier-tab dossier-tab-empty" href="/prd/${ID}?tab=retro" aria-current="page">Retro</a>`);
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
    expect([...html.matchAll(/<li id="(r\d)" class="dossier-round" data-rule="([a-z]+)">/g)].map((m) => [m[1], m[2]]))
      .toEqual([['r1', 'brainstorm'], ['r2', 'delivery']]);
    expect([...html.matchAll(/<span class="dossier-rule">([a-z]+)<\/span>/g)].map((m) => m[1])).toEqual(['brainstorm', 'delivery']);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<iframe');
  });

  it('shows an answered question, as text, with only its chosen option and its description', () => {
    const html = questions();
    expect(html).toContain('Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?');
    expect(html).not.toContain('<b>hexagonal</b>');
    expect(html).toContain('<ul class="dossier-options" aria-label="Chosen option">'
      + '<li class="dossier-option" data-chosen="true"><span class="dossier-option-label">Square<span class="ask-rec">Recommended</span></span>'
      + '<span class="dossier-option-desc">cheaper</span></li></ul>');
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
    expect(html).toContain('<ul class="dossier-options" aria-label="Chosen options">');
    expect(html).not.toContain('Manual');
    expect(html).not.toContain('Hexagonal');
    expect(html).toContain('<p class="dossier-answer"><span class="ask-hint">Answer</span> <b>Triangles, &lt;i&gt;obviously&lt;/i&gt;</b></p>');
  });

  it('shows every option of an open question', () => {
    const html = questions({ questions: [asked('r7', 'brainstorm', '2026-09-27T10:00:00Z')] });
    expect(html).toContain('<ul class="dossier-options" aria-label="Options, one could be chosen">');
    expect([...html.matchAll(/<span class="dossier-option-label">([^<]+)/g)].map((m) => m[1])).toEqual(['Square', 'Hexagonal']);
    expect(html).not.toContain('data-chosen');
    expect(html).toContain('not answered yet');
  });

  it('shows a question moved to the terminal with no option', () => {
    const html = questions({ questions: [rounds[1]] });
    expect(html).toContain('Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?');
    expect(html).not.toContain('dossier-option');
    expect(html).toContain('<p class="dossier-outcome">moved to the terminal, no answer recorded</p>');
  });

  it('says who answered and after how long, its category, who asked and where, and links to the question', () => {
    const html = questions();
    expect(html).toContain('answered by Marie after 1 min 35 s, on the page');
    expect(html).toContain('moved to the terminal, no answer recorded');
    expect(html).toContain('<span class="dossier-category" data-category="ux-ui">UX/UI</span>');
    expect(html).toContain('<span class="dossier-category" data-category="unsorted">unsorted</span>');
    expect(html).toContain('asked by Pierre · 27 Sep 2026, 09:15 UTC');
    expect(html).toContain('vertuoza/vertuo-omni-loop · feat/prd-dossiers--s3 · PRD #216 · /omni:do-work');
    expect(html).toContain(`<a class="dossier-round-link" href="/ask/q/r1?from=${ID}">Open the question</a>`);
  });

  it('says when no question was asked yet', () => {
    const html = questions({ questions: [] });
    expect(html).toContain('No question yet.');
    expect(html).not.toContain('dossier-rounds');
  });

  it('says when the questions could not be read, and still shows the dossier', () => {
    const html = questions({ questions: null });
    expect(html).toContain('role="alert">The questions could not be read.');
    expect(html).toContain('PRD #216');
  });
});

describe('a quick round on the Questions tab (PRD 384)', () => {
  const AT = '2026-09-28T09:00:00Z';
  const SOON = Date.parse(AT) + 60_000;
  const open = asked('q1', 'brainstorm', AT);
  const later = asked('q2', 'brainstorm', '2026-09-28T09:00:30Z', { questions: [SHAPE, SHAPE] });
  const quick = (more: Parameters<typeof page>[0] = {}) => page({ pick: tab('questions'), questions: [open, later], now: SOON, ...more });
  const buttons = (html: string) => [...html.matchAll(/<button type="button" class="dossier-quick-choice"[^>]*><span class="dossier-option-label">([^<]+)/g)].map((m) => m[1]);

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
    expect(quick({ answerable: ['q1'] })).toMatch(/<button type="button" class="dossier-quick-choice" disabled="">/);
  });

  it('shows anyone else its options and "Waiting for <owner>", with no button', () => {
    const html = quick({ answerable: [] });
    expect(buttons(html)).toEqual([]);
    expect(html).not.toContain('dossier-quick-choice');
    expect(html).toContain('aria-label="Options, one could be chosen"');
    expect(html).toContain('<p class="dossier-quick-note">Waiting for Pierre</p>');
  });

  it('shows a round that is not quick with its Open link only', () => {
    const html = quick({ answerable: ['q1', 'q2'], questions: [later] });
    expect(html).not.toContain('dossier-quick-choice');
    expect(html).not.toContain('Waiting for');
    expect(html).toContain(`href="/ask/q/q2?from=${ID}">Open the question</a>`);
  });

  it('shows no button once its time is up', () => {
    const html = quick({ answerable: ['q1'], now: Date.parse(AT) + 540_000 });
    expect(html).not.toContain('dossier-quick-choice');
    expect(html).not.toContain('Waiting for');
  });

  it('shows no button where the page has no database to answer through (the demo)', () => {
    const html = quick({ answerable: ['q1'], supabase: null });
    expect(html).not.toContain('dossier-quick-choice');
    expect(html).toContain('aria-label="Options, one could be chosen"');
  });

  it('gives each round its id, so the way back lands on the next open round', () => {
    expect(quick()).toContain('<li id="q2" class="dossier-round"');
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

describe('the version picker', () => {
  it('lists the tab\'s versions newest first, with their day and source, the shown one selected', () => {
    const html = page({ pick: tab('spec'), markdown: SPEC });
    const options = [...html.matchAll(/<option value="(\d+)"( selected="")?>([^<]+)<\/option>/g)].map((m) => [m[1], m[3], Boolean(m[2])]);
    expect(options).toEqual([
      ['2', 'v2 · 28 Sep · commit a1b2c3d (github)', true],
      ['1', 'v1 · 27 Sep · Pierre (kit)', false],
    ]);
  });

  it('is a GET form to the same page that keeps the tab, so it works before any script runs', () => {
    const html = page({ pick: tab('spec'), markdown: SPEC });
    const form = html.match(/<form[^>]*>/)?.[0] ?? '';
    expect(form).toContain('method="get"');
    expect(form).toContain(`action="/prd/${ID}"`);
    expect(html).toContain('<input type="hidden" name="tab" value="spec"/>');
    expect(html).toMatch(/<select[^>]*name="v"/);
  });

  it('keeps the Before/after tab too, so a version picked there does not land on Questions', () => {
    expect(page({ pick: tab('before-after') })).toContain('<input type="hidden" name="tab" value="before-after"/>');
  });
});

describe('an artifact with no version yet', () => {
  it('says so, with no picker and no frame', () => {
    const plan = page({ pick: tab('plan') });
    expect(plan).toContain('The plan has no version yet.');
    expect(plan).not.toContain('<select');
    const empty = page({ dossier: draft, rows: [], questions: [] });
    expect(empty).toContain('The before/after page has no version yet.');
    expect(empty).not.toContain('<iframe');
    expect(page({ dossier: draft, rows: [], pick: tab('spec') })).toContain('The spec has no version yet.');
  });
});

describe('the pieces the browser takes over', () => {
  it('Copy link is one button until it is pressed', () => {
    expect(renderToStaticMarkup(createElement(CopyLink, { path: `/prd/${ID}` }))).toBe(
      '<span class="dossier-copy"><button type="button" class="ask-button">Copy link</button></span>',
    );
  });

  it('Delete draft is one quiet button', () => {
    expect(renderToStaticMarkup(createElement(DeleteDraft, { supabase: SUPABASE, id: ID }))).toBe(
      '<span class="dossier-delete"><button type="button" class="ask-button quiet">Delete draft</button></span>',
    );
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
