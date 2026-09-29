import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { addShots, emptyDraft, pickOption, readQuestions } from '../answer-model';
import { trayOf } from './attachments';
import { AskPage } from './AskPage';
import { AskSession } from './AskSession';
import { CategoryChip } from './CategoryChip';
import { ContextLine } from './ContextLine';
import { demoSessions, demoState } from './demo';
import { History } from './History';
import { RoundForm } from './RoundForm';
import { rowOf, startPage } from './tabs';
import { contextParts, type HistoryEntry } from './view';

// The round and the history as the server renders them: what a person sees before any script runs.

const [storage, checks] = readQuestions([
  {
    question: 'Which storage should the sessions use?',
    header: 'Storage',
    multiSelect: false,
    options: [
      { label: 'Postgres (Recommended)', description: 'Row-level security per owner.', preview: 'create table ask_sessions (\n  id uuid\n);' },
      { label: 'Memory', description: 'Lost on every deploy.' },
    ],
  },
  {
    question: 'Which checks run?',
    header: 'Checks',
    multiSelect: true,
    options: [{ label: 'RLS', description: 'two JWTs' }, { label: 'Handlers', description: 'stubbed client' }],
  },
]);

function round(draft = emptyDraft([storage, checks]), canSend = false) {
  return renderToStaticMarkup(
    createElement(RoundForm, {
      roundId: 'r1',
      questions: [storage, checks],
      draft,
      onDraft: () => {},
      canSend,
      sending: false,
      onSend: () => {},
      minutesLeft: 8,
    }),
  );
}

const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

describe('the round, rendered', () => {
  const html = round();

  it('shows each question with its chip and its text as the heading', () => {
    expect(html).toContain('<span class="ask-chip">Storage</span>');
    expect(html).toMatch(/<h2 class="ask-question"[^>]*>Which storage should the sessions use\?<\/h2>/);
    expect(html).toMatch(/<h2 class="ask-question"[^>]*>Which checks run\?<\/h2>/);
  });

  it('shows the options as rows with their descriptions, radios for one choice and checkboxes for several', () => {
    expect(count(html, /class="ask-opt"/)).toBe(4);
    expect(html).toContain('<span class="ask-opt-desc">Lost on every deploy.</span>');
    expect(count(html, /type="radio"/)).toBe(3);
    expect(count(html, /type="checkbox"/)).toBe(3);
  });

  it('shows the Recommended badge in place of the suffix, and keeps the label as the value', () => {
    expect(html).toContain('Postgres<span class="ask-rec">Recommended</span>');
    expect(html).not.toMatch(/>[^<]*\(Recommended\)/);
    expect(html).toContain('value="Postgres (Recommended)"');
  });

  it('gives every question Other', () => {
    expect(count(html, /class="ask-opt ask-other"/)).toBe(2);
    expect(count(html, /<textarea/)).toBe(2);
  });

  it('shows the preview in a monospace panel beside the options of the question that has one', () => {
    expect(count(html, /class="ask-q has-preview"/)).toBe(1);
    expect(count(html, /<pre class="ask-preview"/)).toBe(1);
    expect(html).toContain('create table ask_sessions (\n  id uuid\n);');
  });

  it('keeps Send off until every question has an answer', () => {
    expect(html).toMatch(/<button type="button" class="ask-button" disabled="">Send to Claude<\/button>/);
    const draft = [pickOption(storage, emptyDraft([storage])[0], 'Memory'), pickOption(checks, emptyDraft([checks])[0], 'RLS')];
    expect(round(draft, true)).toMatch(/<button type="button" class="ask-button">Send to Claude<\/button>/);
  });

  it('says how long before the question moves to the terminal', () => {
    expect(html).toContain('moves to the terminal in 8 min');
  });
});

describe('screenshots on Other, rendered (PRD 620)', () => {
  const png = (id: string) => ({ id, type: 'image/png', size: 3, file: new Blob([id], { type: 'image/png' }) });

  it('gives every Other an Add screenshot button over a hidden image picker', () => {
    const html = round();
    expect(count(html, /<button type="button" class="ask-shot-add">Add screenshot<\/button>/)).toBe(2);
    expect(count(html, /type="file" multiple="" accept="image\/png,image\/jpeg,image\/gif,image\/webp"/)).toBe(2);
    expect(html).not.toContain('class="ask-shot"');
  });

  it('shows each screenshot as a thumbnail with a × that removes it', () => {
    const { draft } = addShots([storage, checks], emptyDraft([storage, checks]), 0, [png('a'), png('b')]);
    const html = round(draft, true);
    expect(count(html, /<li class="ask-shot">/)).toBe(2);
    expect(html).toContain('aria-label="Remove screenshot 1"');
    expect(html).toContain('aria-label="Remove screenshot 2"');
    expect(html).toMatch(/<input id="[^"]*-other" type="radio"[^>]*checked=""/);
  });

  it('says how far the upload got while Send runs, and where it stopped', () => {
    trayOf('r1').setProgress({ kind: 'uploading', at: 2, total: 3 });
    const sending = renderToStaticMarkup(createElement(RoundForm, {
      roundId: 'r1', questions: [storage, checks], draft: emptyDraft([storage, checks]), onDraft: () => {}, canSend: true, sending: true, onSend: () => {}, minutesLeft: 8,
    }));
    expect(sending).toContain('>Uploading 2 of 3…</button>');
    trayOf('r1').setProgress({ kind: 'failed', at: 2, total: 3 });
    expect(round(undefined, true)).toContain('<p class="ask-shot-problem" role="status">Could not upload 2 of 3 — Send again</p>');
    trayOf('r1').setProgress({ kind: 'idle' });
    expect(round()).not.toContain('ask-shot-problem');
  });
});

describe('the history, rendered', () => {
  const entries: HistoryEntry[] = [
    { id: 'a', outcome: 'answered', via: 'terminal', at: '', lines: [{ header: 'Host', question: 'Where?', answer: 'The galaxy app' }] },
    { id: 'b', outcome: 'answered', via: 'page', at: '', lines: [{ header: 'Mode', question: 'How?', answer: 'Hooks, nudge' }] },
    { id: 'c', outcome: 'moved', via: null, at: '', lines: [{ header: 'Access', question: 'Who?', answer: null }] },
  ];
  const html = renderToStaticMarkup(createElement(History, { history: entries }));

  it('tags each answered round page or terminal', () => {
    expect(html).toMatch(/Host: <b>The galaxy app<\/b>.*<span class="ask-via" data-via="terminal">terminal<\/span>/s);
    expect(html).toMatch(/Mode: <b>Hooks, nudge<\/b>.*<span class="ask-via" data-via="page">page<\/span>/s);
  });

  it('says so for a round that moved to the terminal without an answer', () => {
    expect(html).toContain('Access — moved to the terminal, no answer recorded');
  });

  it('shows nothing before the first answer', () => {
    expect(renderToStaticMarkup(createElement(History, { history: [] }))).toBe('');
  });
});

describe('the context line, rendered (PRD 144)', () => {
  const NOW = Date.parse('2026-09-26T10:00:00Z');
  const session = { repo: 'vertuoza/vertuo-omni-loop', branch: 'feat/question-history' };
  const base = {
    id: 'r1', questions: [], answers: { 'Where?': 'Here' }, answered_via: 'page' as const, status: 'answered' as const,
    created_at: new Date(NOW - 200_000).toISOString(), answered_at: new Date(NOW - 20_000).toISOString(),
  };
  const line = (parts: string[] | undefined) => renderToStaticMarkup(createElement(ContextLine, { parts }));

  it('shows every field of a round that has them all, and the time to answer', () => {
    const round = { ...base, prd: 144, skill: '/omni:brainstorm', model: 'claude-opus-4-8', tokens: { input: 10, output: 20, cacheRead: 30_000, cacheWrite: 0 }, cost_usd: 1.2345 };
    expect(line(contextParts(session, round))).toBe(
      '<p class="ask-title ask-context" aria-label="Where this question came from">'
      + 'vertuoza/vertuo-omni-loop · feat/question-history · PRD #144 · /omni:brainstorm · claude-opus-4-8 · 30k tokens · $1.23 · answered in 3 min 0 s</p>',
    );
  });

  it('shows only the time to answer for a round whose context is null, and nothing for an open one', () => {
    const nulls = { ...base, prd: null, skill: null, model: null, tokens: null, cost_usd: null };
    expect(line(contextParts({ repo: null, branch: null }, nulls))).toContain('>answered in 3 min 0 s</p>');
    expect(line(contextParts({}, { ...nulls, status: 'open', answers: null, answered_via: null, answered_at: null }))).toBe('');
    expect(line(undefined)).toBe('');
  });

  it('sits under each round of the history', () => {
    const entry: HistoryEntry = { id: 'a', outcome: 'answered', via: 'page', at: '', lines: [{ header: 'H', question: 'Q?', answer: 'A' }], context: ['acme/widgets', 'answered in 5 s'] };
    expect(renderToStaticMarkup(createElement(History, { history: [entry] }))).toMatch(/<\/details><p class="ask-title ask-context"[^>]*>acme\/widgets · answered in 5 s<\/p><\/li>/);
  });
});

describe('the session page, for its owner and for another member (PRD 144)', () => {
  const NOW = Date.parse('2026-09-26T10:00:00Z');
  const page = (viewer: 'owner' | 'member', scenario: 'open' | 'moved' | 'closed' = 'open') =>
    renderToStaticMarkup(createElement(AskSession, { source: { kind: 'demo' }, initial: demoState('s1', scenario, NOW), serverNow: NOW, viewer }));

  it('gives the owner the answer form and the delete button', () => {
    const html = page('owner');
    expect(html).toContain('Send to Claude');
    expect(html).toMatch(/<button type="button" class="ask-button quiet">Delete this session<\/button>/);
  });

  it('shows another member the open question read-only: no form, no delete', () => {
    const html = page('member');
    expect(html).not.toContain('Send to Claude');
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('type="radio"');
    expect(html).not.toContain('Delete this session');
    expect(html).toContain('Waiting for the owner&#x27;s answer');
    expect(html).toContain('How should the page and the agent be authenticated?');
    expect(html).toContain('Earlier in this session');
  });

  it('tells another member where a moved question went without asking them to answer it', () => {
    const html = page('member', 'moved');
    expect(html).toContain('Moved to the terminal');
    expect(html).not.toContain('Answer it there');
    expect(html).not.toContain('Delete this session');
  });

  it('keeps the delete button for the owner of a closed session, and never shows it to a member', () => {
    expect(page('owner', 'closed')).toContain('Delete this session');
    expect(page('member', 'closed')).not.toContain('Delete this session');
  });
});

describe('the category chip, rendered (PRD 144)', () => {
  const chip = (props: Parameters<typeof CategoryChip>[0]) => renderToStaticMarkup(createElement(CategoryChip, props));
  const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

  it('offers unsorted and the six, with the round\'s category picked', () => {
    const html = chip({ chip: { value: 'ux-ui', label: 'UX/UI', setBy: 'sorted by the model' }, onChange: () => {} });
    expect(html).toMatch(/<select[^>]*aria-label="Category"/);
    expect(count(html, /<option /)).toBe(7);
    expect(html).toContain('<option value="">unsorted</option>');
    expect(html).toContain('<option value="ux-ui" selected="">UX/UI</option>');
    expect(html).toContain('data-category="ux-ui"');
    expect(html).not.toMatch(/<select[^>]*disabled/);
  });

  it('says who set it', () => {
    expect(chip({ chip: { value: 'business', label: 'Business', setBy: 'sorted by the model' } })).toContain('<span class="ask-category-by">sorted by the model</span>');
    expect(chip({ chip: { value: 'product', label: 'Product', setBy: 'set by a teammate' } })).toContain('set by a teammate');
  });

  it('shows an unsorted round as such, with nobody named', () => {
    const html = chip({ chip: { value: null, label: 'unsorted', setBy: null }, onChange: () => {} });
    expect(html).toContain('data-category="unsorted"');
    expect(html).toContain('<option value="" selected="">unsorted</option>');
    expect(html).not.toContain('ask-category-by');
  });

  it('cannot be changed while it saves, or where nothing can save it', () => {
    expect(chip({ chip: { value: 'other', label: 'Other', setBy: null }, onChange: () => {}, saving: true })).toMatch(/<select[^>]*disabled=""/);
    expect(chip({ chip: { value: 'other', label: 'Other', setBy: null } })).toMatch(/<select[^>]*disabled=""/);
  });

  describe('on the session page', () => {
    const NOW = Date.parse('2026-09-26T10:00:00Z');
    const page = (viewer: 'owner' | 'member', me: string) =>
      renderToStaticMarkup(createElement(AskSession, { source: { kind: 'demo' }, initial: demoState('s1', 'open', NOW), serverNow: NOW, viewer, me }));

    it('sits on the open round and on each earlier one, for the owner', () => {
      const html = page('owner', 'demo');
      expect(count(html, /<select[^>]*aria-label="Category"/)).toBe(3);
      expect(html).toContain('<option value="" selected="">unsorted</option>');
      expect(html).toContain('<option value="architecture" selected="">Architecture</option>');
      expect(html).toContain('sorted by the model');
      expect(html).toContain('<option value="product" selected="">Product</option>');
      expect(html).toContain('set by you');
    });

    it('can be changed by another member too, who reads who set it', () => {
      const html = page('member', 'bob');
      expect(count(html, /<select[^>]*aria-label="Category"/)).toBe(3);
      expect(html).not.toMatch(/<select[^>]*disabled/);
      expect(html).toContain('set by the session owner');
    });
  });
});

describe("the person's page, rendered", () => {
  const NOW = Date.parse('2026-09-26T10:00:00Z');
  const page = (sessions: ReturnType<typeof demoSessions>, selected: string | null) => {
    const rows = sessions.map(rowOf);
    const start = startPage(rows, selected, null, NOW);
    const pane = sessions.find((s) => s.session.id === start.selected) ?? null;
    return renderToStaticMarkup(createElement(AskPage, { source: { kind: 'demo' }, page: start, pane, serverNow: NOW, me: 'demo' }));
  };

  it('names /omni:ask on when no terminal has ask mode on', () => {
    const html = page([], null);
    expect(html).toContain('Ask mode is not on in any terminal');
    expect(html).toContain('<code>/omni:ask on</code>');
    expect(html).not.toContain('ask-tabs');
  });

  it('lists every terminal as a tab, the one that needs you first, badged and selected', () => {
    const html = page(demoSessions('open', NOW), null);
    expect(count(html, /class="ask-tab"/)).toBe(3);
    expect(html).toContain('Terminals (3) · <b>1 needs you</b>');
    expect(count(html, /class="ask-badge"/)).toBe(1);
    expect(html).toMatch(/<a class="ask-tab" data-state="needs-you" aria-current="page" href="\/ask\/demo-terminal-1">/);
    expect(html).toContain('needs you · 1 min');
    expect(count(html, />working</)).toBe(2);
    expect(html).toContain('<span class="ask-tab-header">Access</span>');
  });

  it('shows the pane of the tab the link names', () => {
    const html = page(demoSessions('open', NOW), 'demo-terminal-2');
    expect(html).toMatch(/<a class="ask-tab" data-state="working" aria-current="page" href="\/ask\/demo-terminal-2">/);
    expect(html).toContain('<p class="ask-title">vertuo-omni-loop · main</p>');
  });

  it('folds the tabs into one row that says how many there are and how many need you, the list closed', () => {
    const html = page(demoSessions('open', NOW), null);
    expect(html).toMatch(/<button type="button" class="ask-tabs-fold" aria-expanded="false" aria-controls="ask-tab-list"><span>Terminals \(3\) · <b>1 needs you<\/b>/);
    expect(html).toMatch(/<nav class="ask-tabs" aria-label="Terminals">/);
    expect(html).toContain('<ul class="ask-tab-list" id="ask-tab-list">');
  });
});
