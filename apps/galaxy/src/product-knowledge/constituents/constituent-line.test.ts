import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConstituentsPanel } from '../../business/ConstituentsPanel';
import { initialConstituentsState } from '../../business/constituents-panel';
import type { Constituent, ConstituentEvent } from '../../constituents/model';

// A line's page draws the Constituents panel for that one line (PRD 2240 s4): its edit, remove and
// history, none of the product's other lines, and no way to add one.

const line = (id: string, displayId: string, kind: Constituent['kind'], text: string): Constituent =>
  ({ id, product: 'p-1', kind, displayId, text, removed: false, updatedAt: '2026-10-01T00:00:00Z' });
const LINES = [line('k-s', 'statement', 'statement', 'A quoting tool'), line('k-1', 'never#1', 'never', 'Build for groups'), line('k-2', 'never#2', 'never', 'Answer tenders')];
const event = (id: number, constituent: string, after: string): ConstituentEvent =>
  ({ id, product: 'p-1', constituent, action: 'added', before: null, after, note: null, by: null, at: '2026-10-01T00:00:00Z' });
const EVENTS = [event(1, 'k-s', 'A quoting tool'), event(2, 'k-1', 'Build for groups'), event(3, 'k-2', 'Answer tenders')];

const render = (focus?: string, owner = true) =>
  renderToStaticMarkup(createElement(ConstituentsPanel, {
    state: initialConstituentsState(LINES, EVENTS), product: 'p-1', owner, people: {}, ...(focus === undefined ? {} : { focus }),
  }));

describe('the panel drawn for one line', () => {
  it('draws a Never line alone, with its own history and no add button', () => {
    const html = render('k-2');
    expect(html).toContain('data-constituent="never#2"');
    expect(html).not.toContain('data-constituent="never#1"');
    expect(html).not.toContain('data-constituent="statement"');
    expect(html).toContain('Remove');
    expect(html).not.toContain('+ Never line');
    expect(html).toContain('History · 1');
    expect(html).toContain('Answer tenders');
  });

  it('draws the Statement alone, with its edit', () => {
    const html = render('k-s');
    expect(html).toContain('data-constituent="statement"');
    expect(html).not.toContain('data-constituent="never#1"');
    expect(html).toContain('Edit');
    expect(html).toContain('History · 1');
  });

  it('draws no control for a member', () => {
    const html = render('k-1', false);
    expect(html).toContain('Build for groups');
    expect(html).not.toContain('<button');
  });

  it('still draws every line, its add button and the whole history without a focus', () => {
    const html = render();
    expect(html).toContain('data-constituent="never#1"');
    expect(html).toContain('data-constituent="never#2"');
    expect(html).toContain('+ Never line');
    expect(html).toContain('History · 3');
  });
});
