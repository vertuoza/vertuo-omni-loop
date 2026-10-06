import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { UNREAD, type GithubSummary, type Outbox, type OutboxItem } from '../github/summary';
import { renderMarkdown } from '../markdown';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../store';
import { DossierPage } from './DossierPage';
import { isWide, subscribe, WIDE } from './outbox-context';
import { SEND_OFF } from './outbox-view';
import { dossierView, readPick } from './view';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

// Ported from archive/outbox-answers-v1:apps/galaxy/src/outbox/render.test.ts (PRD 251, s9), on PRD
// 426's GitHub summary. The Outbox tab of /prd/<id> as the server renders it: what a person sees
// before any script runs, in each state of the spec's table, with each kind of card and group, and the
// context rail.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PR = 'https://github.com/acme/widgets/pull/12';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const dossier: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'acme/widgets', prd: parsePrd(7), title: 'Team inbox',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};
const versions: DossierVersionRow[] = [
  { id: 's1', dossier_id: ID, kind: 'spec', bytes: 10, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: '2026-09-27T09:20:00Z' },
  { id: 'b1', dossier_id: ID, kind: 'before-after', bytes: 10, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: '2026-09-27T09:20:01Z' },
];
const SHAPE = { question: 'Square or <b>hexagonal</b> tiles?', header: 'Shape', multiSelect: false, options: [{ label: 'Square', description: '' }] };
const rounds: DossierRoundRow[] = [{
  rule: 'brainstorm', round_id: 'r1', session_id: 's1', asked_by: PIERRE.user_id, repo: 'acme/widgets', branch: 'main', questions: [SHAPE],
  answers: { [SHAPE.question]: 'Square' }, status: 'answered', answered_via: 'page', answered_by: PIERRE.user_id, category: null,
  category_by: null, prd: null, skill: '/omni:brainstorm', created_at: '2026-09-27T09:15:00Z', answered_at: '2026-09-27T09:16:00Z',
}];

const DETAILS = { decide: 'Which colour.', meanwhile: 'Kept blue.', cost: 'A constant.', unknown: 'Whether red frightens.' };
const COLOUR: OutboxItem = {
  id: 's1-01-colour', rank: 'high', question: 'Should the badge turn **late** in red?', decision: 'It stays blue.',
  options: [{ letter: 'A', text: 'Keep blue.' }, { letter: 'B', text: 'Red.' }, { letter: 'C', text: 'Orange.' }], personSteps: null,
  bearsOn: 'P-PRODUCT-3', intro: 'The intro of s1-01-colour.', punchline: 'The punchline of s1-01-colour.', details: DETAILS,
};
const SECRET: OutboxItem = {
  id: 's2-01-secret', rank: 'human-action', question: 'The secret is missing.', decision: 'Nothing sent until it is set.',
  options: [], personSteps: 'Set `OMNI_OUTBOX_SECRET` on the host.', bearsOn: 'none', intro: null, punchline: null, details: {},
};
const NAME: OutboxItem = {
  id: 's1-02-name', rank: 'medium', question: 'Call it inbox?', decision: 'Inbox.',
  options: [{ letter: 'A', text: 'Inbox.' }, { letter: 'B', text: 'Mail.' }], personSteps: null, bearsOn: 'none', intro: null, punchline: null, details: {},
};

function summary(more: Partial<GithubSummary> = {}): GithubSummary {
  return {
    repo: 'acme/widgets', prd: parsePrd(7), folder: '0007-team-inbox', topic: 'team-inbox',
    issue: { number: parseIssue(7), url: 'https://github.com/acme/widgets/issues/7', state: 'open' },
    phase0: { number: parsePr(10), url: 'https://github.com/acme/widgets/pull/10', state: 'merged', draft: false },
    feature: { number: parsePr(12), url: PR, state: 'open', draft: true, mergedAt: null }, retro: null, mergedSlices: 2,
    outbox: {
      open: [COLOUR, SECRET],
      adopted: [NAME],
      settled: [
        { id: 's1-02-name', title: 'Call it inbox?', verdict: 'adopted', answer: 'Adopted when raised.', by: null, at: null, url: null },
        { id: 's1-00-name', title: 'Keep the name?', verdict: 'agreed', answer: 'A. Keep it.', by: 'ada', at: '2026-09-26', url: `${PR}#issuecomment-2` },
      ],
    },
    outboxComment: `${PR}#issuecomment-1`,
    replies: {
      numbering: [{ number: 1, id: 's2-01-secret' }, { number: 2, id: 's1-01-colour' }, { number: 3, id: 's1-02-name' }, { number: 4, id: 's1-00-name' }],
      pending: [{ number: 2, id: 's1-01-colour', text: 'B because red frightens people', by: 'ada', at: '2026-09-27T09:30:00Z', url: `${PR}#issuecomment-5`, counted: true, door: 'github' }],
    },
    ...more,
  };
}

function tab({ github = summary(), query = {}, spec = null, me = PIERRE.user_id, demo = false }: { github?: GithubSummary | null; query?: Record<string, string>; spec?: string | null; me?: string | null; demo?: boolean } = {}) {
  const view = dossierView({ dossier, versions, members: [PIERRE], rounds, github, demo }, me, readPick({ tab: 'outbox', ...query }));
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: spec === null ? null : renderMarkdown(spec), supabase: null }));
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the tab', () => {
  it('is Outbox, after Plan and the User voice, with n open in its label, and current; the other tabs are unchanged', () => {
    const html = tab();
    expect(html).toMatch(/User voice<\/a><a class="dossier-tab" href="\/prd\/[^"]+\?tab=outbox" aria-current="page">Outbox<small>2 open<\/small><\/a>/);
    expect(html).toContain('>Before/after<small>v1</small></a>');
    expect(html).toContain('>Spec<small>v1</small></a>');
  });
});

describe('the states', () => {
  it('no outbox yet', () => {
    expect(tab({ github: summary({ outbox: null }) })).toContain('<p class="dossier-empty">No decision yet: the outbox fills while the PRD is built.</p>');
  });

  it('nothing open: says so, then Adopted and Settled', () => {
    const html = tab({ github: summary({ outbox: { open: [], adopted: [NAME], settled: (summary().outbox as Outbox).settled } }) });
    expect(html).toContain('Nothing is waiting on you.');
    expect(html).toContain('<summary>Adopted unless you object · 1</summary>');
    expect(html).toContain('<summary>Settled · 1</summary>');
    expect(html.indexOf('Nothing is waiting on you.')).toBeLessThan(html.indexOf('Adopted unless you object'));
  });

  it('shipped: read-only, with the date, and no toolbar', () => {
    const merged = tab({ github: summary({ feature: { number: parsePr(12), url: PR, state: 'merged', draft: false, mergedAt: '2026-09-28T08:00:00Z' } }) });
    expect(merged).toContain('The feature pull request merged on 28 Sep 2026: what was still open was adopted.');
    expect(merged).not.toContain('Select every recommendation');
    expect(merged).toMatch(/<fieldset class="outbox-options" disabled="">/);
    expect(merged).not.toContain('>Object</button>');
  });

  it('closed: read-only, and says so', () => {
    const closed = tab({ github: summary({ feature: null, issue: { number: parseIssue(7), url: 'https://github.com/acme/widgets/issues/7', state: 'closed' } }) });
    expect(closed).toContain('The feature pull request closed: what was still open was adopted.');
    expect(closed).not.toContain('Select every recommendation');
  });

  it('GitHub out of reach: PRD 426\'s words, and the other tabs are there as ever', () => {
    for (const github of [null, summary({ outbox: UNREAD })]) {
      const html = tab({ github });
      expect(html).toContain('<p class="ask-problem" role="alert">GitHub did not answer. The page tries again within a minute.</p>');
      expect(html).toContain('>Before/after<small>v1</small></a>');
    }
  });

  it('signed out: the questions, read-only, and Sign in with GitHub to answer here', () => {
    const html = tab({ me: null });
    expect(html).toContain('<p class="outbox-note" role="status">Sign in with GitHub to answer here.</p>');
    expect(html).toContain('Question 2</h3>');
    expect(html).not.toContain('Select every recommendation');
    expect(html).toMatch(/<fieldset class="outbox-options" disabled="">/);
  });

  it('the demo: Send off, saying so', () => {
    const html = tab({ demo: true });
    expect(html).toMatch(/<button type="button" class="ask-button" disabled="">Send 0 answers<\/button>/);
    expect(html).toContain(SEND_OFF.demo);
  });

  it('the replies unread: the outbox shown, no number, and why', () => {
    const html = tab({ github: summary({ replies: UNREAD }) });
    expect(html).toContain('The replies on the pull request could not be read');
    expect(html).toContain('s1-01-colour</h3>');
    expect(html).toContain('Not numbered yet');
    expect(html).not.toContain('data-answered');
  });
});

describe('the cards', () => {
  const html = tab();

  it('the toolbar: Select every recommendation, and Send n answers, shown but not open yet', () => {
    expect(html).toContain('>Select every recommendation</button>');
    expect(html).toMatch(/<button type="button" class="ask-button" disabled="">Send 0 answers<\/button>/);
    expect(html).toContain(SEND_OFF.notYet);
  });

  it('a decision card: number and rank, intro, question, decision, punchline, the options with A built and recommended', () => {
    const card = /<article id="s1-01-colour" class="outbox-card" data-kind="decision" data-answered="true"[^>]*>[\s\S]*?<\/article>/.exec(html)?.[0] ?? '';
    expect(card).toContain('Question 2</h3>');
    expect(card).toContain('data-rank="high">high</span>');
    expect(card).toContain('<p class="outbox-fun">The intro of s1-01-colour.</p>');
    expect(card).toContain('<strong>late</strong>');
    expect(card).toContain('Decision taken');
    expect(card).toContain('<p class="outbox-fun">The punchline of s1-01-colour.</p>');
    expect([...card.matchAll(/<input type="radio" name="outbox-2" value="([A-D])"/g)].map((m) => m[1])).toEqual(['A', 'B', 'C']);
    expect(card).toMatch(/value="A"[^>]*\/><span class="outbox-option-letter">A<\/span><span class="ask-rec">built · recommended<\/span>/);
    expect(card.match(/built · recommended/g)).toHaveLength(1);
    expect(card).toContain('<a class="ask-chip" href="/knowledge?entry=P-PRODUCT-3">P-PRODUCT-3</a>');
    expect(card).toContain('<h4>What I had to decide</h4>');
    expect(card).toContain('<h4>What I did meanwhile</h4>');
    expect(card).toContain('<h4>What it costs to change later</h4>');
    expect(card).toContain('<h4>What I could not know</h4>');
  });

  it('an answered card: what it said, who, where and when, and it can be answered again', () => {
    const card = /data-answered="true"[\s\S]*?<\/article>/.exec(html)?.[0] ?? '';
    expect(text(card)).toContain('Answered B because red frightens people by @ada on GitHub · 27 Sep 2026, 09:30 UTC · the reply');
    expect(card).toContain(`href="${PR}#issuecomment-5"`);
    expect(card).toContain('by <span class="person-chip is-inline"><img class="person-face is-photo" src="https://github.com/ada.png?size=48" alt=""');
    expect(card).toContain('type="radio"');
    expect(card).not.toContain('will not read');
  });

  it('an answer whose author the kit does not count says /omni:yolo-fix will not read it', () => {
    const replies = { ...summary().replies as object, pending: [{ number: 2, id: 's1-01-colour', text: 'C', by: 'visitor', at: null, url: null, counted: false, door: 'page' as const }] };
    const card = text(tab({ github: summary({ replies: replies as GithubSummary['replies'] }) }));
    expect(card).toContain('Answered C by @visitor on the Omni page');
    expect(card).toContain('GitHub does not list @visitor as an owner, member or collaborator of this repository, so /omni:yolo-fix will not read this answer.');
  });

  it('a human-action card: its steps, then Done or Not done', () => {
    const card = /<article id="s2-01-secret" class="outbox-card" data-kind="action"[\s\S]*?<\/article>/.exec(html)?.[0] ?? '';
    expect(card).toContain('Question 1</h3>');
    expect(card).toContain('<code>OMNI_OUTBOX_SECRET</code>');
    expect([...card.matchAll(/<input type="radio" name="outbox-1" value="([a-z-]+)"/g)].map((m) => m[1])).toEqual(['done', 'not-done']);
    expect(card).not.toContain('built · recommended');
  });

  it('the human action comes first, then the decision', () => {
    expect(html.indexOf('Question 1</h3>')).toBeLessThan(html.indexOf('Question 2</h3>'));
  });

  it('an adopted medium sits in its collapsed group, with Object and no options until then', () => {
    const group = html.slice(html.indexOf('<details class="outbox-group"><summary>Adopted unless you object · 1</summary>'), html.indexOf('<summary>Settled'));
    expect(group).toContain('Question 3</h3>');
    expect(group).toContain('data-adopted="true"');
    expect(group).toContain('>Object</button>');
    expect(group).not.toContain('type="radio"');
  });

  it('settled: each entry\'s verdict, who approved it, and its answer', () => {
    expect(text(html)).toContain('Settled · 1');
    expect(text(html)).toContain('Question 4 agreed Keep the name? · approved by @ada · 26 Sep 2026 · the reply');
    expect(html).toContain('<p class="outbox-settled-answer">A. Keep it.</p>');
    expect(html).toMatch(/approved by <span class="person-chip is-inline"><img class="person-face is-photo" src="https:\/\/github.com\/ada.png\?size=48" alt=""[^>]*\/>@ada<\/span>/);
  });

  it('links the outbox comment, to answer on the pull request instead', () => {
    expect(html).toContain(`<a href="${PR}#issuecomment-1" target="_blank" rel="noopener noreferrer">on the pull request</a>`);
  });
});

describe('the context rail', () => {
  it('Before/after by default: the sandboxed frame of the latest version', () => {
    const html = tab();
    expect(html).toContain('<details class="outbox-context" open="" aria-label="Context"><summary>Context</summary>');
    expect(html).toMatch(/<a class="outbox-switch-link" href="[^"]+\?tab=outbox" aria-current="page">Before\/after<\/a>/);
    expect(html).toContain(`src="/prd/${ID}/v/1/page" sandbox="allow-scripts"`);
  });

  it('sits before the questions, so a tall screen shows it as a disclosure above them', () => {
    const html = tab();
    expect(html.indexOf('outbox-context')).toBeLessThan(html.indexOf('outbox-main'));
  });

  it('Spec: rendered, raw HTML off', () => {
    const html = tab({ query: { context: 'spec' }, spec: '# Team inbox\n\n<b>raw</b>\n' });
    expect(html).toMatch(/<a class="outbox-switch-link" href="[^"]+context=spec" aria-current="page">Spec<\/a>/);
    expect(html).toContain('<h1>Team inbox</h1>');
    expect(html).toContain('&lt;b&gt;raw&lt;/b&gt;');
    expect(html).not.toContain('<iframe');
  });

  it('Spec that could not be read says so', () => {
    expect(tab({ query: { context: 'spec' } })).toContain('The spec could not be read.');
  });

  it('Brainstorm: each question with its answer, as text', () => {
    const html = tab({ query: { context: 'brainstorm' } });
    expect(html).toContain('Square or &lt;b&gt;hexagonal&lt;/b&gt; tiles?');
    expect(html).toContain('<b>Square</b>');
  });
});

describe('the context disclosure, wide and tall', () => {
  it('sits open on a wide screen, and closed on a tall one, following the width as it changes', () => {
    let matches = true;
    const listeners = new Set<() => void>();
    const media = {
      get matches() { return matches; },
      addEventListener: (_: string, f: () => void) => listeners.add(f),
      removeEventListener: (_: string, f: () => void) => listeners.delete(f),
    };
    vi.stubGlobal('window', { matchMedia: (query: string) => (query === WIDE ? media : null) });
    try {
      expect(isWide()).toBe(true);
      const seen: boolean[] = [];
      const stop = subscribe(() => seen.push(isWide()));
      matches = false;
      listeners.forEach((f) => { f(); });
      expect(seen).toEqual([false]);
      stop();
      expect(listeners.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is wide from 960px, as the stylesheet lays the rail beside the questions', () => {
    expect(WIDE).toBe('(min-width: 960px)');
    const css = readFileSync(fileURLToPath(new URL('./dossier.css', import.meta.url)), 'utf8');
    expect(css).toContain('@media (min-width: 960px)');
    expect(css).toMatch(/\.outbox-context > summary \{ display: none; \}/);
  });
});
