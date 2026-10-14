import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AskPage } from './AskPage';
import { AskQuestion } from './AskQuestion';
import { AskSession } from './AskSession';
import { DEMO_MEMBERS, DEMO_TEAMMATE, demoQuestion, demoSessions, demoState } from './demo';
import { ForMe } from './ForMe';
import { AskNotOpen } from './Notice';
import { SignInCard } from './SignInCard';
import { rowOf, startPage } from './tabs';
import { WorkspaceHistory } from './WorkspaceHistory';
import { historyChoices } from './workspace-history';

// /ask speaks of the agent, never of one product (PRD 1915): whoever runs the loop, Claude Code,
// Codex, Cursor or Gemini CLI, reads the same words. A model id in a round's cost line is data, and
// stays as sent.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const session = (scenario: 'working' | 'moved' | 'empty', viewer: 'owner' | 'member' = 'owner') =>
  renderToStaticMarkup(createElement(AskSession, { source: { kind: 'demo' }, initial: demoState('s1', scenario, NOW), serverNow: NOW, viewer }));

describe('the /ask words name the agent, not a product (PRD 1915)', () => {
  it('says the agent is working, the hint in two short lines', () => {
    const html = session('working');
    expect(html).toContain('<h1 class="ask-working">The agent is working</h1>');
    expect(html).toContain('The next question shows here.<br/>Keep this tab open.');
  });

  it('says no questions yet in two short lines before the first round', () => {
    expect(session('empty')).toContain('No questions yet.<br/>The first one shows here.');
  });

  it('says the agent asks a moved round in the terminal, to the owner and to a member', () => {
    expect(session('moved')).toContain('so the agent asks this in the terminal instead. Answer it there');
    expect(session('moved', 'member')).toContain('so the agent asks this in the terminal instead. The answer shows below');
  });

  it('says the agent asks a shared question in the terminal once it moved', () => {
    const open = demoQuestion(NOW);
    const html = renderToStaticMarkup(createElement(AskQuestion, { source: { kind: 'demo' }, initial: open, serverNow: NOW + 3_600_000, me: DEMO_TEAMMATE, members: DEMO_MEMBERS }));
    expect(html).toContain('Nobody answered it on the page in time, so the agent asks it in the terminal instead.');
  });

  it('labels the round and its button with the agent', () => {
    const html = renderToStaticMarkup(createElement(AskSession, { source: { kind: 'demo' }, initial: demoState('s1', 'open', NOW), serverNow: NOW, viewer: 'owner' }));
    expect(html).toContain('<section class="ask-round" aria-label="The agent asks">');
    expect(html).toContain('Send to the agent');
  });

  it('asks the signed-out person to answer their agent', () => {
    const html = renderToStaticMarkup(createElement(SignInCard, { supabase: { url: 'http://127.0.0.1:54321', key: 'anon' }, returnPath: '/ask/callback' }));
    expect(html).toContain('Sign in to answer your agent');
    expect(html).toContain('This page shows your agent&#x27;s questions to the person who switched ask mode on.');
  });

  it('names the coding agent\'s terminal on the empty page, and one agent\'s terminal per tab', () => {
    const page = (sessions: ReturnType<typeof demoSessions>, selected: string | null) => {
      const start = startPage(sessions.map(rowOf), selected, null, NOW);
      return renderToStaticMarkup(createElement(AskPage, { source: { kind: 'demo' }, page: start, pane: null, serverNow: NOW, me: 'demo' }));
    };
    expect(page([], null)).toContain('Run <code>/omni:ask on</code> in your coding agent&#x27;s terminal.');
    expect(page(demoSessions('open', NOW), 'demo-terminal-2')).toContain('Each tab is one agent&#x27;s terminal.');
  });

  it('says the agent waits, and an agent asks, on the empty For me and History pages', () => {
    expect(renderToStaticMarkup(createElement(ForMe, { entries: [] }))).toContain('while the agent waits for it');
    const history = renderToStaticMarkup(createElement(WorkspaceHistory, { items: [], choices: historyChoices([], DEMO_MEMBERS), filters: {} }));
    expect(history).toContain('Every question an agent asks your workspace while ask mode is on is kept here.');
  });

  it('says a deployment with no database cannot show the agent\'s questions', () => {
    expect(renderToStaticMarkup(createElement(AskNotOpen))).toContain('cannot show the agent&#x27;s questions.');
  });

  it('describes the /ask pages as the agent\'s questions', () => {
    const layout = readFileSync(new URL('../../../app/ask/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toContain('description: \'Your agent’s questions, on a page made for reading.\'');
  });

  it('keeps no "Claude" in the words the /ask pages show', () => {
    for (const html of [session('working'), session('empty'), session('moved'), session('moved', 'member')]) {
      expect(html).not.toContain('Claude');
    }
  });
});
