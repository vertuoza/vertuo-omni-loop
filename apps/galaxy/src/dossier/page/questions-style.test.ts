// The Questions tab breathes (PRD 533, s1): read dossier.css as text and prove the roomier spacing of
// the rounds — their lines, their bodies, the answers' line height, the footer and the space under the
// "answered" strip — while the phone view (under 720px) keeps the padding it had.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { firstPart } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';

const CSS = readFileSync(new URL('./dossier.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const PHONE_QUERY = '@media (max-width: 719.98px)';

/** The body of every `@media` block opened by `query`, braces balanced. */
function mediaBlocks(css: string, query: string): string[] {
  const blocks: string[] = [];
  let from = css.indexOf(query);
  while (from !== -1) {
    const open = css.indexOf('{', from);
    let depth = 1;
    let at = open + 1;
    while (depth > 0 && at < css.length) {
      if (css[at] === '{') depth += 1;
      else if (css[at] === '}') depth -= 1;
      at += 1;
    }
    blocks.push(css.slice(open + 1, at - 1));
    from = css.indexOf(query, at);
  }
  return blocks;
}

/** The sheet with every `@media` block cut out: the rules every width reads. */
function withoutMedia(css: string): string {
  let out = '';
  let at = 0;
  for (let from = css.indexOf('@media', at); from !== -1; from = css.indexOf('@media', at)) {
    out += css.slice(at, from);
    let cursor = css.indexOf('{', from) + 1;
    let depth = 1;
    while (depth > 0 && cursor < css.length) {
      if (css[cursor] === '{') depth += 1;
      else if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    at = cursor;
  }
  return out + css.slice(at);
}

/** Every declaration of every rule in `css` whose selector list is exactly `selector`. */
function declarations(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = [...css.matchAll(new RegExp(`(?:^|[}{;])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  return rules.flatMap(([, body]) => {
    assertDefined(body, `the body of a ${selector} rule`);
    return body.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean);
  });
}

const valueIn = (css: string, selector: string, prop: string) =>
  declarations(css, selector)
    .filter((d) => firstPart(d, ':').trim() === prop)
    .map((d) => d.slice(d.indexOf(':') + 1).trim());

const BASE = withoutMedia(CSS);
const PHONE = mediaBlocks(CSS, PHONE_QUERY).join('\n');
const desktop = (selector: string, prop: string) => valueIn(BASE, selector, prop);
const phone = (selector: string, prop: string) => valueIn(PHONE, selector, prop);

const OPEN_LINE = ".dossier-round[data-state='open'] .dossier-round-line";

describe('the Questions tab, on a desktop width', () => {
  it('sets the answered strip 20px above the list: the pane gap plus 4px of its own', () => {
    expect(desktop('.dossier-progress', 'margin-bottom')).toEqual(['4px']);
  });

  it("pads a round's line 16px above and below and 24px at the sides", () => {
    expect(desktop('.dossier-round-line', 'padding')).toEqual(['16px 24px']);
  });

  it("moves an open round's line 8px right too, so its dot stays under the folded rounds' ✓", () => {
    expect(desktop(OPEN_LINE, 'padding-left')).toEqual(['46px']);
  });

  it("gives a round's body 16px between questions and pads it so the text starts under the title", () => {
    expect(desktop('.dossier-round-body', 'gap')).toEqual(['16px']);
    expect(desktop('.dossier-round-body', 'padding')).toEqual(['4px 24px 22px 52px']);
  });

  it("runs an answered question's line at 1.6", () => {
    expect(desktop('.dossier-q-line', 'line-height')).toEqual(['1.6']);
  });

  it("gives a round's footer 4px of its own above it", () => {
    expect(desktop('.dossier-round-foot', 'padding-top')).toEqual(['4px']);
  });
});

describe('the Questions tab, under 720px', () => {
  it('keeps the phone block', () => {
    expect(mediaBlocks(CSS, PHONE_QUERY).length).toBeGreaterThan(0);
  });

  it("keeps a round's line at 10px 12px, and an open one's left at 12px", () => {
    expect(phone('.dossier-round-line', 'padding')).toEqual(['10px 12px']);
    expect(phone(OPEN_LINE, 'padding-left')).toEqual(['12px']);
  });

  it("keeps a round's body at 4px 12px 12px", () => {
    expect(phone('.dossier-round-body', 'padding')).toEqual(['4px 12px 12px']);
  });
});
