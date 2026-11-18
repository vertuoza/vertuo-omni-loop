// @omni/ui: every registered part (src/generated/catalogue.ts, written by build/parts.ts). Each variant
// of each closed prop renders through react-dom/server, no props type accepts a className or a style,
// every colour pair a part's meta names passes WCAG AA in Omni, Light and Dark, and every custom
// property a stylesheet reads is a token (or one the stylesheet defines itself). A part added later is
// covered here with no edit to this file.
import { readFileSync, readdirSync } from 'node:fs';
import { THEME_ROLES, contrast } from '@omni/design';
import type { AskTheme } from '@omni/design';
import { createElement } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { COMPONENTS, PARTS } from './generated/catalogue.ts';
import { Badge, Button, Notice, Tabs } from './index.ts';

const tabItems = [
  { id: 'spec', label: 'Spec', href: '#spec' },
  { id: 'plan', label: 'Plan', href: '#plan' },
];

describe('@omni/ui registers every part', () => {
  it('lists each part whose X.tsx is in the folder, once, with its own meta', () => {
    const dir = new URL('./', import.meta.url);
    const present = readdirSync(dir).flatMap((file) => /^([A-Z][A-Za-z0-9]*)\.tsx$/.exec(file)?.[1] ?? []).sort();
    expect(PARTS.map(({ meta }) => meta.name)).toEqual(present);
    expect(Object.keys(COMPONENTS)).toEqual(present);
    expect(present.length).toBeGreaterThanOrEqual(10);
  });
});

describe('@omni/ui renders every variant', () => {
  for (const { meta, specimen } of PARTS) {
    for (const [prop, values] of Object.entries(meta.variants)) {
      for (const value of values) {
        it(`${meta.name} ${prop}=${value}`, () => {
          const html = renderToStaticMarkup(specimen(prop, value));
          expect(html).toMatch(/class="omni-/);
        });
      }
    }
  }

  it('marks the current tab and names the navigation', () => {
    const html = renderToStaticMarkup(createElement(Tabs, { label: 'Sections', items: tabItems, current: 'plan' }));
    expect(html).toContain('aria-label="Sections"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('omni-tab--current');
  });

  it('turns a button with an href into a link, and a disabled one back into a button', () => {
    expect(renderToStaticMarkup(createElement(Button, { href: '/x' }, 'Go'))).toMatch(/^<a /);
    expect(renderToStaticMarkup(createElement(Button, { href: '/x', disabled: true }, 'Go'))).toMatch(/^<button /);
  });

  it('draws each tab with the link it is given, a plain anchor by default (bug #3011)', () => {
    const link = ({ className, href, children }: { className: string; href: string; children?: ReactNode }) => createElement('a', { className, href, 'data-router': '' }, children);
    const routed = renderToStaticMarkup(createElement(Tabs, { label: 'Sections', items: tabItems, current: 'plan', link }));
    expect(routed.match(/<a [^>]*data-router=""/g)).toHaveLength(tabItems.length);
    expect(renderToStaticMarkup(createElement(Tabs, { label: 'Sections', items: tabItems, current: 'plan' }))).not.toContain('data-router');
  });

  it('opens an external button link in a new window, says its title and whether its panel is open, and marks a primary (bug #3011)', () => {
    const out = renderToStaticMarkup(createElement(Button, { href: 'https://example.com', external: true, title: 'Hint' }, 'Go'));
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('title="Hint"');
    expect(renderToStaticMarkup(createElement(Button, { href: '/x' }, 'Go'))).not.toContain('target=');
    expect(renderToStaticMarkup(createElement(Button, { expanded: false }, 'Open'))).toContain('aria-expanded="false"');
    expect(renderToStaticMarkup(createElement(Button, null, 'Open'))).not.toContain('aria-expanded');
    expect(renderToStaticMarkup(createElement(Button, { variant: 'primary' }, 'Go'))).toContain('data-primary=""');
    expect(renderToStaticMarkup(createElement(Button, { variant: 'quiet' }, 'Go'))).not.toContain('data-primary');
    expect(renderToStaticMarkup(createElement(Badge, { title: 'PR care' }, 'CI'))).toContain('title="PR care"');
  });

  it('says alerts for warning and danger notices, status for the rest', () => {
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'danger' }, 'x'))).toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'info' }, 'x'))).toContain('role="status"');
  });
});

/** The registered parts whose props accept `key`: none, when every API is closed. */
type Accepting<Key extends string> = {
  [Name in keyof typeof COMPONENTS]: Key extends keyof ComponentProps<(typeof COMPONENTS)[Name]> ? Name : never;
}[keyof typeof COMPONENTS];

describe('@omni/ui closes its APIs', () => {
  it('accepts no className and no style on any registered part', () => {
    expectTypeOf<Accepting<'className'>>().toEqualTypeOf<never>();
    expectTypeOf<Accepting<'style'>>().toEqualTypeOf<never>();
  });

  it('never writes a className or a style prop in a component source', () => {
    const dir = new URL('./', import.meta.url);
    for (const file of readdirSync(dir).filter((name) => /^[A-Z][A-Za-z]*\.tsx$/.test(name))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      const props = /export type \w+Props = \{[\s\S]*?\n\};/.exec(source)?.[0] ?? '';
      expect(props, file).not.toMatch(/\b(className|style)\??:/);
      expect(source, file).not.toMatch(/style=\{/);
    }
  });
});

describe('@omni/ui keeps to the tokens', () => {
  const dir = new URL('./', import.meta.url);
  const designDir = new URL('../../design/', import.meta.url);
  const defined = new Set<string>();
  for (const file of ['tokens.css', 'fonts.css']) {
    for (const match of readFileSync(new URL(file, designDir), 'utf8').matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(match[1] ?? '');
  }

  it('reads only custom properties that a token file or the stylesheet itself defines', () => {
    const sheets = readdirSync(dir).filter((name) => name.endsWith('.css'));
    expect(sheets.map((sheet) => sheet.replace(/\.css$/, '')).sort()).toEqual(PARTS.map(({ meta }) => meta.name));
    for (const sheet of sheets) {
      const css = readFileSync(new URL(sheet, dir), 'utf8');
      const own = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? ''));
      for (const match of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const name = match[1] ?? '';
        expect(defined.has(name) || own.has(name), `${sheet} reads ${name}`).toBe(true);
      }
    }
  });
});

describe('@omni/ui passes contrast in every theme', () => {
  const themes: readonly AskTheme[] = ['omni', 'light', 'dark'];

  for (const { meta } of PARTS) {
    it(`${meta.name}: every colour pair of every variant reaches WCAG AA in Omni, Light and Dark`, () => {
      const variants = new Set(Object.entries(meta.variants).flatMap(([prop, values]) => values.map((value) => `${prop}=${value}`)));
      const failures: string[] = [];
      for (const [variant, pairs] of Object.entries(meta.contrast)) {
        expect(variant === 'base' || variants.has(variant), `${meta.name} names ${variant}, no variant of its own`).toBe(true);
        for (const { text, on, edge } of pairs) {
          const floor = edge === true ? 3 : 4.5;
          for (const theme of themes) {
            const ratio = contrast(THEME_ROLES[theme][text], THEME_ROLES[theme][on]);
            if (ratio < floor) failures.push(`${theme}: ${variant} ${text} on ${on} is ${ratio.toFixed(2)}:1, under ${String(floor)}:1`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }
});

describe('@omni/ui describes each part', () => {
  for (const { meta } of PARTS) {
    it(`${meta.name} names its variants, its usage, do and don't, its accessibility notes, what it replaces and one example`, () => {
      expect(Object.keys(meta.variants).length).toBeGreaterThan(0);
      expect(meta.usage.length).toBeGreaterThan(0);
      expect(meta.do.length).toBeGreaterThan(0);
      expect(meta.dont.length).toBeGreaterThan(0);
      expect(meta.accessibility.length).toBeGreaterThan(0);
      expect(meta.replaces.length).toBeGreaterThan(0);
      expect(meta.example).toContain(`<${meta.name}`);
    });
  }
});

describe('@omni/ui keeps its behaviour libraries to itself', () => {
  it('leaves Base UI, Testing Library and the DOM environment out of the kit', () => {
    const kit = new URL('../../../kit/', import.meta.url);
    const sources = readdirSync(kit, { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.(ts|tsx|mjs)$/.test(file) && !file.includes('node_modules') && !file.startsWith('dist'));
    for (const file of sources) {
      const source = readFileSync(new URL(file, kit), 'utf8');
      expect(source, file).not.toMatch(/from ['"](@base-ui\/react|@testing-library\/[a-z-]+|happy-dom)['"/]/);
    }
  });
});
