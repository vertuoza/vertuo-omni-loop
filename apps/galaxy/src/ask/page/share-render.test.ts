import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { AskQuestion } from './AskQuestion';
import { AskSession } from './AskSession';
import { DEMO_MEMBERS, DEMO_OWNER, DEMO_TEAMMATE, demoQuestion, demoState } from './demo';
import { ForMe } from './ForMe';
import { ShareButton } from './ShareButton';

// Sharing a question and For me (PRD 144), as the server renders them: what a person sees before any
// script runs.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

describe('Share, on the session page', () => {
  const page = (viewer: 'owner' | 'member', scenario: 'open' | 'working' | 'moved' = 'open', members = DEMO_MEMBERS) =>
    renderToStaticMarkup(createElement(AskSession, { source: { kind: 'demo' }, initial: demoState('s1', scenario, NOW), serverNow: NOW, viewer, me: DEMO_OWNER, members }));

  it('sits on the open round, for its owner', () => {
    expect(page('owner')).toMatch(/<p class="ask-share"><button type="button" class="ask-button quiet">Share<\/button><\/p>/);
  });

  it('is not there for another member, on a round no longer open, or with nobody to share with', () => {
    expect(page('member')).not.toContain('ask-share');
    expect(page('owner', 'moved')).not.toContain('ask-share');
    expect(page('owner', 'working')).not.toContain('ask-share');
    expect(page('owner', 'open', DEMO_MEMBERS.filter((m) => m.user_id === DEMO_OWNER))).not.toContain('ask-share');
  });
});

describe('the Share button', () => {
  const candidates = [{ id: 'po', label: 'PAULA' }, { id: 'ux', label: 'uma@vertuoza.com' }];
  const button = (initial: Parameters<typeof ShareButton>[0]['initial']) =>
    renderToStaticMarkup(createElement(ShareButton, { roundId: 'r1', candidates, onShare: async () => true, origin: 'https://galaxy.example', initial }));

  it('picks a member of the workspace', () => {
    const html = button({ kind: 'picking' });
    expect(html).toMatch(/<select[^>]*class="ask-share-pick"/);
    expect(html).toContain('<option value="po" selected="">PAULA</option>');
    expect(html).toContain('<option value="ux">uma@vertuoza.com</option>');
  });

  it('then gives the link to copy, and who it went to', () => {
    const html = button({ kind: 'shared', with: 'po', copy: 'idle' });
    expect(html).toContain('Shared with PAULA');
    expect(html).toMatch(/<input[^>]*readOnly=""[^>]*value="https:\/\/galaxy.example\/ask\/q\/r1"/);
    expect(html).toContain('>Copy</button>');
  });

  it('says how to copy the link when the browser would not', () => {
    expect(button({ kind: 'shared', with: 'po', copy: 'selected' })).toContain('The link is selected');
    expect(button({ kind: 'shared', with: 'po', copy: 'copied' })).toContain('Copied.');
  });
});

describe('the shared question, at /ask/q/<round>', () => {
  const page = (me: string, answered = false) =>
    renderToStaticMarkup(createElement(AskQuestion, { source: { kind: 'demo' }, initial: demoQuestion(NOW, answered), serverNow: NOW, me, members: DEMO_MEMBERS }));

  it('gives the member it is shared with the form, the time left and the session\'s earlier rounds', () => {
    const html = page(DEMO_TEAMMATE);
    expect(html).toContain('Send to Claude');
    expect(html).toContain('moves to the terminal in 8 min');
    expect(html).toContain('Earlier in this session');
    expect(count(html, /<details class="ask-past">/)).toBe(2);
  });

  it('shows it read-only to any other member, with the time left', () => {
    const html = page('demo-ux');
    expect(html).not.toContain('Send to Claude');
    expect(html).not.toContain('type="radio"');
    expect(html).toContain('Waiting for an answer');
    expect(html).toContain('How should the page and the agent be authenticated?');
  });

  it('says who answered first, with the answer, once answered', () => {
    const html = page(DEMO_TEAMMATE, true);
    expect(html).toContain('<h1>Already answered by ADA</h1>');
    expect(html).toContain('Answered in the terminal.');
    expect(html).toMatch(/<dt>How should the page and the agent be authenticated\?<\/dt><dd>Google sign-in through the galaxy \(Recommended\)<\/dd>/);
    expect(html).not.toContain('Send to Claude');
    expect(page(DEMO_OWNER, true)).toContain('<h1>Answered by you</h1>');
  });
});

describe('For me', () => {
  it('lists each question with its session, who shared it and its time left, linking to it', () => {
    const html = renderToStaticMarkup(createElement(ForMe, {
      entries: [{ roundId: 'r1', question: 'Which plan?', sessionTitle: 'vertuo-core · feat/plans', sharedBy: 'ADA', minutesLeft: 4 }],
    }));
    expect(html).toContain('<a class="ask-for-me-link" href="/ask/q/r1">');
    expect(html).toContain('Which plan?');
    expect(html).toContain('vertuo-core · feat/plans · shared by ADA');
    expect(html).toContain('4 min left');
  });

  it('says when nothing waits', () => {
    expect(renderToStaticMarkup(createElement(ForMe, { entries: [] }))).toContain('Nothing waits for you');
  });

  it('is reached from the sidebar, not the ask header: the layout renders the app shell (PRD 438)', () => {
    const layout = readFileSync(new URL('../../../app/ask/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toMatch(/<AppShell\b/);
    expect(layout).not.toMatch(/ForMeLink|HistoryLink|AskBar/);
    expect(layout).toContain("import '../../src/ask/page/share.css';");
  });
});

describe('the sharing styles', () => {
  const css = readFileSync(new URL('./share.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('draw every colour from the theme tokens, so light and dark follow the switch', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
    expect(css).toMatch(/var\(--ask-plasma\)/);
  });
});
