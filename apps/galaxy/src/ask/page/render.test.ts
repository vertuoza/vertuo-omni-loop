import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { emptyDraft, pickOption, readQuestions } from '../answer-model';
import { AskPage } from './AskPage';
import { demoSessions } from './demo';
import { History } from './History';
import { RoundForm } from './RoundForm';
import { rowOf, startPage } from './tabs';
import type { HistoryEntry } from './view';

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

describe("the person's page, rendered", () => {
  const NOW = Date.parse('2026-09-26T10:00:00Z');
  const page = (sessions: ReturnType<typeof demoSessions>, selected: string | null) => {
    const rows = sessions.map(rowOf);
    const start = startPage(rows, selected, null, NOW);
    const pane = sessions.find((s) => s.session.id === start.selected) ?? null;
    return renderToStaticMarkup(createElement(AskPage, { source: { kind: 'demo' }, page: start, pane, serverNow: NOW }));
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
