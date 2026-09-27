import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { renderMarkdown } from '../dossier/markdown';
import { DossierPage } from '../dossier/page/DossierPage';
import { dossierView, readPick } from '../dossier/page/view';
import type { DossierRoundRow, DossierRow, DossierVersionRow } from '../dossier/store';
import { isWide, subscribe, WIDE } from './ContextDisclosure';
import { outboxRow, STORED } from './fixtures';
import { SEND_OFF } from './OutboxTab';
import type { OutboxRead } from './tab';

// The Outbox tab of /prd/<id> as the server renders it (PRD 251): what a person sees before any script
// runs, in each state of the spec's table, with each kind of card and group, and the context rail.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const dossier: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'acme/widgets', prd: 7, title: 'Team inbox',
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

function tab({ outbox = { row: outboxRow() } as OutboxRead, query = {} as Record<string, string>, spec = null as string | null, sendOff = SEND_OFF.notYet as string | null } = {}) {
  const view = dossierView({ dossier, versions, members: [PIERRE], rounds, outbox }, PIERRE.user_id, readPick({ tab: 'outbox', ...query }));
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: spec === null ? null : renderMarkdown(spec), supabase: null, sendOff }));
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the tab', () => {
  it('is Outbox, after Questions, with n open in its label, and current', () => {
    expect(tab()).toMatch(/Questions<small>1\/1 answered<\/small><\/a><a class="dossier-tab" href="\/prd\/[^"]+\?tab=outbox" aria-current="page">Outbox<small>2 open<\/small><\/a>/);
  });
});

describe('the states', () => {
  it('no outbox stored', () => {
    expect(text(tab({ outbox: { row: null } }))).toContain(
      'No outbox yet. It appears once the feature pull request opens and the omni-loop App has checked it.',
    );
  });

  it('nothing open: says so, then Adopted and Settled', () => {
    const html = tab({ outbox: { row: outboxRow({ outbox: { ...STORED, open: [], pending: [] } }) } });
    expect(html).toContain('Nothing is waiting on you.');
    expect(html).toContain('<summary>Adopted unless you object · 1</summary>');
    expect(html).toContain('<summary>Settled · 1</summary>');
    expect(html.indexOf('Nothing is waiting on you.')).toBeLessThan(html.indexOf('Adopted unless you object'));
  });

  it('merged or closed: read-only, with the date, and no toolbar', () => {
    const merged = tab({ outbox: { row: outboxRow({ state: 'merged', evaluated_at: '2026-09-28T08:00:00Z' }) } });
    expect(merged).toContain('The feature pull request merged on 28 Sep 2026: what was still open was adopted.');
    expect(merged).not.toContain('Select every recommendation');
    expect(merged).toMatch(/<fieldset class="outbox-options" disabled="">/);
    expect(merged).not.toContain('>Object</button>');
    const closed = tab({ outbox: { row: outboxRow({ state: 'closed', evaluated_at: '2026-09-28T08:00:00Z' }) } });
    expect(closed).toContain('The feature pull request closed on 28 Sep 2026');
  });

  it('the read failed: the outbox is out of reach, and the other tabs are there as ever', () => {
    const html = tab({ outbox: { failed: true } });
    expect(html).toContain('The outbox is out of reach.');
    expect(html).toContain('>Before/after<small>v1</small></a>');
    expect(html).toContain('>Outbox</a>');
  });

  it('Send off, saying why: the demo', () => {
    const html = tab({ sendOff: SEND_OFF.demo });
    expect(html).toMatch(/<button type="button" class="ask-button" disabled="">Send 0 answers<\/button>/);
    expect(html).toContain('A demo outbox: Send is off here.');
  });
});

describe('the cards', () => {
  const html = tab();

  it('the toolbar: Select every recommendation, and Send n answers', () => {
    expect(html).toContain('>Select every recommendation</button>');
    expect(html).toContain('>Send 0 answers</button>');
  });

  it('a decision card: number and rank, intro, question, decision, punchline, the options with A built and recommended', () => {
    const card = /<article class="outbox-card" data-kind="decision" data-answered="true"[^>]*>[\s\S]*?<\/article>/.exec(html)?.[0] ?? '';
    expect(card).toContain('Question 2</h3>');
    expect(card).toContain('data-rank="high">high</span>');
    expect(card).toContain('<p class="outbox-fun">The intro of s1-01-colour.</p>');
    expect(card).toContain('<strong>late</strong>');
    expect(card).toContain('Decision taken');
    expect([...card.matchAll(/<input type="radio" name="outbox-2" value="([A-D])"/g)].map((m) => m[1])).toEqual(['A', 'B', 'C']);
    expect(card).toMatch(/value="A"[^>]*\/><span class="outbox-option-letter">A<\/span><span class="ask-rec">built · recommended<\/span>/);
    expect(card.match(/built · recommended/g)).toHaveLength(1);
    expect(card).toContain('<a class="ask-chip" href="/knowledge?entry=P-PRODUCT-3">P-PRODUCT-3</a>');
    expect(card).toContain('<h4>What I had to decide</h4>');
    expect(card).toContain('<h4>What I could not know</h4>');
  });

  it('an answered card: what it said, who, where and when, and it can be answered again', () => {
    const card = /data-answered="true"[\s\S]*?<\/article>/.exec(html)?.[0] ?? '';
    expect(text(card)).toContain('Answered B because red frightens people by @ada on GitHub · 27 Sep 2026, 09:30 UTC · the reply');
    expect(card).toContain('href="https://github.com/acme/widgets/pull/12#issuecomment-5"');
    expect(card).toContain('type="radio"');
  });

  it('a human-action card: its steps, then Done or Not done', () => {
    const card = /<article class="outbox-card" data-kind="action"[\s\S]*?<\/article>/.exec(html)?.[0] ?? '';
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
    expect(text(html)).toContain('s1-00-name agreed approved by @ada · 26 Sep 2026 · the reply');
    expect(html).toContain('<p class="outbox-settled-answer">A. Keep it.</p>');
  });

  it('links the feature pull request', () => {
    expect(html).toContain('href="https://github.com/acme/widgets/pull/12"');
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
      listeners.forEach((f) => f());
      expect(seen).toEqual([false]);
      stop();
      expect(listeners.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is wide from 960px, as the stylesheet lays the rail beside the questions', () => {
    expect(WIDE).toBe('(min-width: 960px)');
    const css = readFileSync(fileURLToPath(new URL('./outbox.css', import.meta.url)), 'utf8');
    expect(css).toContain('@media (min-width: 960px)');
    expect(css).toMatch(/\.outbox-context > summary \{ display: none; \}/);
  });
});
