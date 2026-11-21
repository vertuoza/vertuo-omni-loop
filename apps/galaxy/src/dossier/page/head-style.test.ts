// The PRD page's head on the page anatomy (omni-loop-20 s6), read from dossier.css as text: only the tab
// row pins, on the page's ground, its rule across the whole page; the head above it scrolls away. A
// concept's page keeps the header box of PRD 498, s2 — no rounded corners, no side or top border, pulled
// out to the page's edges by the gutter, one strong bottom rule, the tabs' rule spanning the whole header —
// and the PRD list stays free of its width cap.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstPart } from 'omni-loop/kit/lib/narrow.ts';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';

const CSS = readFileSync(new URL('./dossier.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Every declaration of every rule whose selector list is exactly `selector`, media queries included. */
function declarations(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = [...CSS.matchAll(new RegExp(`(?:^|[}{;])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  return rules.flatMap(([, body]) => {
    assertDefined(body, `the body of a ${selector} rule`);
    return body.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean);
  });
}

const props = (selector: string) => declarations(selector).map((d) => firstPart(d, ':').trim());
const value = (selector: string, prop: string) =>
  declarations(selector).filter((d) => firstPart(d, ':').trim() === prop).map((d) => d.slice(d.indexOf(':') + 1).trim());

describe('the PRD page\'s head (omni-loop-20 s6)', () => {
  it('pins the tab row alone from 900 × 700, on the page\'s ground, above the content', () => {
    expect(CSS).toMatch(/@media \(min-width: 900px\) and \(min-height: 700px\) \{\s*\.dossier-tabbar \{ position: sticky; top: 0; z-index: var\(--layer-sticky\); \}/);
    expect(value('.dossier-tabbar', 'background')).toEqual(['var(--ask-ground)']);
  });

  it('never pins the head above the tab row', () => {
    expect(props('.dossier-top')).not.toContain('position');
    expect(CSS).not.toMatch(/\.dossier-top \{[^}]*sticky/);
  });

  it('draws the tab row\'s rule across the whole page, pulled out by the page gutter', () => {
    expect(value('.dossier-tabbar', 'margin')).toEqual(['0 var(--dossier-gutter-pull)']);
    expect(value('.dossier-tabbar', 'border-bottom')).toEqual(['1px solid var(--color-border-subtle)']);
  });
});

describe('a concept\'s header frame', () => {
  it('has no rounded corners and no side or top border', () => {
    expect(props('.dossier-head')).not.toContain('border-radius');
    for (const prop of ['border', 'border-top', 'border-left', 'border-right', 'border-inline', 'border-block-start']) {
      expect(props('.dossier-head'), prop).not.toContain(prop);
    }
  });

  it('keeps the surface and one 1.5 px strong bottom rule', () => {
    expect(value('.dossier-head', 'background')).toEqual(['var(--ask-surface)']);
    expect(value('.dossier-head', 'border-bottom')).toEqual(['1.5px solid var(--ask-line-strong)']);
  });

  it('is pulled out to the edges by the page gutter, and pads its rows by it', () => {
    const margins = value('.dossier-head', 'margin');
    expect(margins).toHaveLength(1);
    expect(margins[0]).toContain('var(--dossier-gutter-pull)');
    for (const padding of value('.dossier-head', 'padding')) expect(padding).toContain('var(--dossier-gutter)');
    expect(value('.dossier-head', 'padding').length).toBeGreaterThan(0);
  });

  it('stays pinned from 900 × 700', () => {
    expect(CSS).toMatch(/@media \(min-width: 900px\) and \(min-height: 700px\) \{\s*\.dossier-head \{ position: sticky; top: 0;/);
  });

  it('draws the tabs rule across the whole header', () => {
    for (const margin of value('.dossier-tabs', 'margin')) expect(margin).toBe('0 var(--dossier-gutter-pull)');
    expect(value('.dossier-tabs', 'margin').length).toBeGreaterThan(0);
    expect(value('.dossier-tabs', 'border-top')).toEqual(['1px solid var(--color-border-subtle)']);
  });
});

describe('the PRD list', () => {
  it('declares no max-width', () => {
    expect(props('.dossier-history')).not.toContain('max-width');
  });

  it('draws a row\'s stage pill at its own 12 px, at the card\'s right edge, and above the title on a phone (issue #703)', () => {
    expect(value('.dossier-history-top .stage-stop', 'font')).toEqual(['800 12px/1 var(--ask-mono)']);
    expect(value('.dossier-history-top', 'justify-content')).toEqual(['space-between']);
    expect(CSS).toMatch(/@media \(max-width: 719\.98px\) \{[^@]*\.dossier-history-top \{ flex-direction: column-reverse;/);
  });
});
