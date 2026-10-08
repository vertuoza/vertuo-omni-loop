import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nestedLinks } from '../people/nested-links';
import { ConceptList, ConceptListLoading, ConceptListScreen } from './ConceptList';
import { conceptCards, type ConceptCard, type ConceptListState } from './list';
import { CONCEPT_1269, conceptRow } from './list.fixture';

// /concepts (PRD 1272, s2): one card per concept, newest first, and the line that starts one when there
// is none.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const render = (cards: ConceptCard[]) => renderToStaticMarkup(createElement(ConceptList, { cards }));
const C1269 = conceptCards([conceptRow('c-1269', 1269, '2026-10-06T09:00:00Z')], new Map([['c-1269', CONCEPT_1269]]));

describe('the Concepts list', () => {
  it('shows concept #1269: its title, kind and scale, "0 of 6 areas have a PRD" and the date it was recorded, linking to its page', () => {
    const html = render(C1269);
    expect(text(html)).toBe(
      'Concepts #1269 Products replace plan repositories, with phase 0 approved on the server platform · vast 0 of 6 areas have a PRD recorded 6 Oct 2026',
    );
    expect(html).toContain('href="/concepts/c-1269"');
    expect(html).toContain('<time class="ask-hint" dateTime="2026-10-06T09:00:00Z">recorded 6 Oct 2026</time>');
    expect(nestedLinks(html)).toBe(0);
  });

  it('says "1 of 1 area has a PRD" for a lite concept whose area has one', () => {
    const [card] = C1269;
    expect(text(render([{ ...(card as ConceptCard), scale: 'lite', areas: { withPrd: 1, total: 1 } }]))).toContain('1 of 1 area has a PRD');
  });

  it('keeps a card whose concept.md could not be read, saying so', () => {
    const [card] = conceptCards([conceptRow('c-9', 9, '2026-10-06T09:00:00Z', null)], new Map());
    expect(text(render([card as ConceptCard]))).toBe('Concepts #9 Concept 9 record not readable recorded 6 Oct 2026');
  });

  it('lists the cards in the order given, newest first', () => {
    const cards = conceptCards([conceptRow('old', 746, '2026-09-01T09:00:00Z'), conceptRow('new', 1269, '2026-10-06T09:00:00Z')], new Map());
    const html = render(cards);
    expect(html.indexOf('/concepts/new')).toBeLessThan(html.indexOf('/concepts/old'));
  });

  it('shows how to start one when the workspace has no concept', () => {
    const html = render([]);
    expect(text(html)).toMatch(/^Concepts No concept yet A concept shows here once \/omni:think-big records it\. Start one in Claude Code: /);
    expect(html).toContain('<code>/omni:think-big &#x27;&lt;your idea&gt;&#x27;</code>');
  });

  it('draws the heading and the rows\' skeleton while the page starts', () => {
    expect(renderToStaticMarkup(createElement(ConceptListLoading))).toContain('<h1 class="dossier-title">Concepts</h1>');
  });
});

describe('/concepts in each state', () => {
  const screen = (state: ConceptListState) => text(renderToStaticMarkup(createElement(ConceptListScreen, { state })));

  it('lists the cards once read', () => {
    expect(screen({ kind: 'listed', cards: C1269 })).toContain('0 of 6 areas have a PRD');
  });

  it('says a deployment with no database keeps no concept', () => {
    expect(screen({ kind: 'closed' })).toBe('Concepts are not open here This deployment has no database, so it keeps no dossier.');
  });

  it('points a signed-out person to the PRDs list to sign in', () => {
    expect(renderToStaticMarkup(createElement(ConceptListScreen, { state: { kind: 'signed-out' } }))).toContain('<a href="/prd">Sign in from the PRDs page</a>');
  });

  it('says the database did not answer', () => {
    expect(screen({ kind: 'down' })).toBe('The dossier database could not answer Reload the page in a moment.');
  });
});
