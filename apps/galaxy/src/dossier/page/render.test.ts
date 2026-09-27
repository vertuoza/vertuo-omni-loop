import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../store';
import { CopyLink } from './CopyLink';
import { DeleteDraft } from './DeleteDraft';
import { DossierPage } from './DossierPage';
import { DossierSignIn } from './DossierSignIn';
import { dossierView, readPick, type DossierPick } from './view';

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
} = {}) {
  const view = dossierView({ dossier, versions: rows, members: [PIERRE, MARIE], rounds: questions }, me, pick);
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: markdown === null ? null : renderMarkdown(markdown), supabase }));
}
const tab = (name: DossierPick['tab'], v?: number): DossierPick => ({ tab: name, version: v ?? null });

describe('the header', () => {
  it('shows PRD #n, the title, the repository chips, who opened it and when, and Copy link', () => {
    const html = page();
    expect(html).toMatch(/<h1 class="dossier-title"><span class="dossier-number">PRD #216<\/span> ?<span>PRD dossiers<\/span><\/h1>/);
    expect(html).toContain('<li class="dossier-repo">vertuoza/vertuo-omni-loop</li>');
    expect(html).toContain('opened by Pierre · 27 Sep 2026, 09:12 UTC');
    expect(html).toContain('>Copy link</button>');
  });

  it('shows DRAFT for a draft', () => {
    const html = page({ dossier: draft });
    expect(html).toContain('<span class="dossier-draft">DRAFT</span>');
    expect(html).toContain('Offline quotes on the site app');
    expect(html).not.toContain('PRD #');
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
  it('reads Before/after, Spec and Plan with their latest versions, then Questions with answered out of asked', () => {
    const html = page();
    const tabs = [...html.matchAll(/<a class="dossier-tab" href="([^"]+)"( aria-current="page")?>([^<]+)(?:<small>([^<]+)<\/small>)?<\/a>/g)]
      .map((m) => [m[3], m[4] ?? null, m[1].replaceAll('&amp;', '&'), Boolean(m[2])]);
    expect(tabs).toEqual([
      ['Before/after', 'v2', `/prd/${ID}`, true],
      ['Spec', 'v2', `/prd/${ID}?tab=spec`, false],
      ['Plan', null, `/prd/${ID}?tab=plan`, false],
      ['Questions', '1/2 answered', `/prd/${ID}?tab=questions`, false],
    ]);
  });
});

describe('the Questions tab', () => {
  const questions = (more: Parameters<typeof page>[0] = {}) => page({ pick: tab('questions'), ...more });

  it('lists each round in the order asked, marked brainstorm or delivery, with no picker and no frame', () => {
    const html = questions();
    expect(html).toContain('<ol class="dossier-rounds" aria-label="Questions, in the order they were asked">');
    expect([...html.matchAll(/<li class="dossier-round" data-rule="([a-z]+)">/g)].map((m) => m[1])).toEqual(['brainstorm', 'delivery']);
    expect([...html.matchAll(/<span class="dossier-rule">([a-z]+)<\/span>/g)].map((m) => m[1])).toEqual(['brainstorm', 'delivery']);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<iframe');
  });

  it('shows the question, as text, with its options, the chosen one marked, and the answer', () => {
    const html = questions();
    expect(html).toContain('Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?');
    expect(html).not.toContain('<b>hexagonal</b>');
    expect(html).toMatch(/<li class="dossier-option" data-chosen="true"><span class="dossier-option-label">Square<span class="ask-rec">Recommended<\/span><span class="dossier-chosen">chosen<\/span><\/span><span class="dossier-option-desc">cheaper<\/span><\/li>/);
    expect(html).toMatch(/<li class="dossier-option"><span class="dossier-option-label">Hexagonal<\/span><span class="dossier-option-desc">prettier<\/span><\/li>/);
    expect(html).toContain('<p class="dossier-answer"><span class="ask-hint">Answer</span> <b>Square (Recommended)</b></p>');
    expect(html).toContain('<p class="dossier-answer"><span class="ask-hint">No answer</span></p>');
  });

  it('says who answered and after how long, its category, who asked and where, and links to the question', () => {
    const html = questions();
    expect(html).toContain('answered by Marie after 1 min 35 s, on the page');
    expect(html).toContain('moved to the terminal, no answer recorded');
    expect(html).toContain('<span class="dossier-category" data-category="ux-ui">UX/UI</span>');
    expect(html).toContain('<span class="dossier-category" data-category="unsorted">unsorted</span>');
    expect(html).toContain('asked by Pierre · 27 Sep 2026, 09:15 UTC');
    expect(html).toContain('vertuoza/vertuo-omni-loop · feat/prd-dossiers--s3 · PRD #216 · /omni:do-work');
    expect(html).toContain('<a class="dossier-round-link" href="/ask/q/r1">Open the question</a>');
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

describe('the Before/after tab', () => {
  it('frames the latest version on its sandboxed route, with scripts allowed and nothing else', () => {
    const html = page();
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

  it('keeps no tab for Before/after, the page\'s default', () => {
    expect(page()).not.toContain('name="tab"');
  });
});

describe('an artifact with no version yet', () => {
  it('says so, with no picker and no frame', () => {
    const plan = page({ pick: tab('plan') });
    expect(plan).toContain('The plan has no version yet.');
    expect(plan).not.toContain('<select');
    const empty = page({ dossier: draft, rows: [] });
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

  it('the sign-in card asks for the workspace\'s Google account and says the link opens for its members', () => {
    const html = renderToStaticMarkup(createElement(DossierSignIn, { supabase: SUPABASE, returnPath: `/prd/${ID}/callback`, error: 'Not allowed' }));
    expect(html).toContain('Sign in to read this PRD');
    expect(html).toContain('members of its workspace');
    expect(html).toContain('>Sign in with Google</button>');
    expect(html).toContain('role="alert">Not allowed</p>');
  });
});
