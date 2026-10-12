import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { UNREAD } from '../dossier/github/summary';
import { nestedLinks } from '../people/nested-links';
import { ConceptPage, ConceptPageScreen } from './ConceptPage';
import { conceptView, readConceptPick, type ConceptRead } from './ConceptPage.view';
import { CONCEPT_1269 } from './list.fixture';

// A concept's page, /concepts/<id> (PRD 1272, s3): the header with its issue and its concept PR, then
// Overview, Areas, Vision tour, Boards and Debate, a file that was not sent reading "not sent: too large".

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const ALL_SENT = [
  { id: 'v-record', kind: 'concept-record' }, { id: 'v-vision', kind: 'vision' }, { id: 'v-b1', kind: 'board' },
  { id: 'v-b2', kind: 'board' }, { id: 'v-debate', kind: 'debate' },
];

const read = (over: Partial<ConceptRead> = {}): ConceptRead => ({
  id: 'c-1269', repo: 'acme/widgets', number: parseIssue(1269), title: 'Products replace plan repositories, with phase 0 approved on the server',
  versions: ALL_SENT, record: CONCEPT_1269, debate: null, pages: new Map(), facts: null, ...over,
});

const render = (r: ConceptRead, query: Record<string, string> = {}) =>
  renderToStaticMarkup(createElement(ConceptPage, { view: conceptView(r, readConceptPick(query)) }));

describe('the address', () => {
  it('opens on Overview, and picks a tab and a round', () => {
    expect(readConceptPick({})).toEqual({ tab: 'overview', round: null });
    expect(readConceptPick({ tab: 'boards', round: '2' })).toEqual({ tab: 'boards', round: 2 });
    expect(readConceptPick({ tab: 'spec', round: '0' })).toEqual({ tab: 'overview', round: null });
  });
});

describe('a concept\'s page', () => {
  it('shows its title, links to its issue and its concept PR, and the five tabs', () => {
    const html = render(read());
    expect(html).toContain('<span class="dossier-kind">Concept</span>');
    expect(html).toContain('href="https://github.com/acme/widgets/issues/1269" target="_blank" rel="noopener noreferrer">#1269 ↗</a>');
    expect(html).toContain('Products replace plan repositories, with phase 0 approved on the server');
    expect(html).toContain('>issue #1269</a>');
    expect(html).toContain(`href="https://github.com/acme/widgets/pulls?q=${encodeURIComponent('is:pr "Refs #1269"').replace(/&/g, '&amp;')}"`);
    const tabs = /<nav class="dossier-tabs" aria-label="Concept">(.*?)<\/nav>/.exec(html)?.[1] ?? '';
    expect(text(tabs)).toBe('Overview Areas Vision tour Boards Debate');
    expect(tabs).toContain('href="/concepts/c-1269" aria-current="page"');
    expect(tabs).toContain('href="/concepts/c-1269?tab=areas"');
    expect(nestedLinks(html)).toBe(0);
  });

  it('shows its state chip, and links its concept PR straight once its facts name it (PRD 1272, s4)', () => {
    const pull = (state: 'open' | 'merged') => ({
      number: parsePr(1270), url: 'https://github.com/acme/widgets/pull/1270', state, mergedAt: state === 'merged' ? '2026-10-07T09:00:00Z' : null, mergedBy: null,
    });
    const open = render(read({ facts: { issue: UNREAD, pull: pull('open') } }));
    expect(open).toContain('<span class="fix-state fix-state-in-review">in review</span>');
    expect(open).toContain('href="https://github.com/acme/widgets/pull/1270" target="_blank" rel="noopener noreferrer">concept PR #1270</a>');
    expect(open).not.toContain('pulls?q=');
    expect(render(read({ facts: { issue: UNREAD, pull: pull('merged') } }))).toContain('<span class="fix-state fix-state-merged">in the inbox</span>');
    const unknown = render(read({ facts: { issue: UNREAD, pull: UNREAD } }));
    expect(unknown).toContain('<span class="fix-state fix-state-unknown">state unknown</span>');
    expect(unknown).toContain('>concept PR</a>');
    expect(unknown).toContain('<h2>The brief</h2>');
    expect(render(read({ facts: null }))).toContain('state unknown');
  });

  it('renders Overview\'s five sections from concept.md, raw HTML off', () => {
    const record = CONCEPT_1269.replace('A product page holds everything.', 'A product page <script>alert(1)</script> holds everything.');
    const html = render(read({ record }));
    const pane = text(/<section class="dossier-pane"[^>]*>(.*)<\/section>/s.exec(html)?.[1] ?? '');
    expect(pane).toMatch(/^The brief One product holds its repositories.* The vision A product page .* Why this one It removes the plan repository\. Killed and why Keeping plan repositories\. Fuel The loop today\.$/);
    expect(pane).not.toContain('server-approval');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('lists the six areas on Areas, the wedge first and marked, and the first area\'s brainstorm line with a Copy button', () => {
    const html = render(read(), { tab: 'areas' });
    const areas = /<ol class="concept-areas"[^>]*>(.*?)<\/ol>/s.exec(html)?.[1] ?? '';
    expect((areas.match(/<li /g) ?? []).length).toBe(6);
    expect(areas.indexOf('server-approval')).toBeLessThan(areas.indexOf('approval-handshake'));
    expect(areas).toMatch(/^<li class="concept-area concept-wedge">.*?server-approval.*?<span class="dossier-kind">wedge<\/span>/);
    expect((areas.match(/wedge<\/span>/g) ?? []).length).toBe(1);
    expect(html).toContain('<button type="button" class="ask-button stage-action" title="/omni:brainstorm --concept 1269 server-approval">Copy</button>');
    expect((html.match(/omni:brainstorm --concept/g) ?? []).length).toBe(2);
  });

  it('links an area\'s PRD to its page, or to its issue when it has none', () => {
    const record = CONCEPT_1269
      .replace('| Approval pins the hashes. | |', '| Approval pins the hashes. | #1300 |')
      .replace('| omni wait approval. | |', '| omni wait approval. | #1301 |');
    const html = render(read({ record, pages: new Map([[parsePrd(1300), 'd-1300']]) }), { tab: 'areas' });
    expect(html).toContain('<a href="/prd/d-1300">PRD #1300</a>');
    expect(html).toContain('<a href="https://github.com/acme/widgets/issues/1301" target="_blank" rel="noopener noreferrer">PRD #1301 ↗</a>');
    expect(html).toContain('title="/omni:brainstorm --concept 1269 product-home"');
  });

  it('frames the vision tour from its sandboxed route, never inline', () => {
    const html = render(read({ versions: [...ALL_SENT, { id: 'v-vision-2', kind: 'vision' }] }), { tab: 'vision' });
    expect(html).toContain('<iframe src="/concepts/c-1269/v/2/page" sandbox="allow-scripts" title="Vision tour"></iframe>');
    expect(html).not.toContain('srcdoc');
  });

  it('picks each round of the boards, the latest when none is named, each framed from its sandboxed route', () => {
    const latest = render(read(), { tab: 'boards' });
    expect(latest).toContain('<iframe src="/concepts/c-1269/r/2/page" sandbox="allow-scripts" title="Boards, Round 2"></iframe>');
    const rounds = /<nav class="dossier-tabs" aria-label="Rounds">(.*?)<\/nav>/.exec(latest)?.[1] ?? '';
    expect(text(rounds)).toBe('Round 1 Round 2');
    expect(rounds).toContain('href="/concepts/c-1269?tab=boards&amp;round=1"');
    const first = render(read(), { tab: 'boards', round: '1' });
    expect(first).toContain('<iframe src="/concepts/c-1269/r/1/page" sandbox="allow-scripts" title="Boards, Round 1"></iframe>');
    expect(first).toContain('href="/concepts/c-1269?tab=boards&amp;round=1" aria-current="page">Round 1</a>');
    expect(render(read(), { tab: 'boards', round: '9' })).toContain('src="/concepts/c-1269/r/2/page"');
  });

  it('renders debate.md as Markdown, raw HTML off', () => {
    const html = render(read({ debate: '## Round 1\n\nThe Skeptic: <b>no</b>.\n' }), { tab: 'debate' });
    expect(html).toContain('<h2>Round 1</h2>');
    expect(html).toContain('&lt;b&gt;no&lt;/b&gt;');
  });

  it('reads "not sent: too large" on the tab of a file that was not sent, never missing', () => {
    const versions = ALL_SENT.filter((v) => v.kind !== 'vision');
    const html = render(read({ versions }), { tab: 'vision' });
    expect(html).toContain('<a class="dossier-tab dossier-tab-empty" href="/concepts/c-1269?tab=vision" aria-current="page">Vision tour<small>not sent: too large</small></a>');
    expect(text(html)).toContain('vision.html was not sent: too large');
    expect(html).not.toContain('<iframe');
    const none = render(read({ versions: [], record: null }));
    expect((none.match(/not sent: too large<\/small>/g) ?? []).length).toBe(5);
    expect(text(none)).toContain('concept.md was not sent: too large');
  });

  it('says concept.md could not be read when it does not parse', () => {
    expect(text(render(read({ record: 'not a concept' }), { tab: 'areas' }))).toContain('concept.md could not be read');
  });
});

describe('the page in each state', () => {
  const screen = (state: Parameters<typeof ConceptPageScreen>[0]['state']) =>
    text(renderToStaticMarkup(createElement(ConceptPageScreen, { state, id: 'c-1269', supabase: { url: 'http://x', key: 'anon' } })));

  it('asks a signed-out person to sign in, and says when there is no database or it did not answer', () => {
    expect(screen({ kind: 'signed-out' })).toContain('Sign in with GitHub');
    expect(screen({ kind: 'closed' })).toContain('Concepts are not open here');
    expect(screen({ kind: 'down' })).toContain('The dossier database could not answer');
  });
});
