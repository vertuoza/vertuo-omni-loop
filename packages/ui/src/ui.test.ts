// @omni/ui: ten components with closed APIs. Each variant of each closed prop renders through
// react-dom/server, no props type accepts a className or a style, and every custom property a
// stylesheet reads is a token (or one the stylesheet defines itself).
import { readFileSync, readdirSync } from 'node:fs';
import { createElement } from 'react';
import type { ComponentProps, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { Badge, Button, Card, EmptyState, ListRow, Notice, PageHeader, Stack, Tabs, Text } from './index.ts';
import { badgeMeta } from './Badge.meta.ts';
import { buttonMeta } from './Button.meta.ts';
import { cardMeta } from './Card.meta.ts';
import { emptyStateMeta } from './EmptyState.meta.ts';
import { listRowMeta } from './ListRow.meta.ts';
import { noticeMeta } from './Notice.meta.ts';
import { pageHeaderMeta } from './PageHeader.meta.ts';
import { stackMeta } from './Stack.meta.ts';
import { tabsMeta } from './Tabs.meta.ts';
import { textMeta } from './Text.meta.ts';
import type { ComponentMeta } from './meta.ts';

type Case = { meta: ComponentMeta; render: (prop: string, value: string) => ReactElement };

/** The one of the closed values that is `value`: a test names a variant that exists, or fails. */
function one<T extends string>(values: readonly T[], value: string): T {
  const found = values.find((v) => v === value);
  if (found === undefined) throw new Error(`${value} is not one of ${values.join(', ')}`);
  return found;
}

const tabItems = [
  { id: 'spec', label: 'Spec', href: '#spec' },
  { id: 'plan', label: 'Plan', href: '#plan' },
];

/** One render per closed prop value: the closed props are strings, so the table narrows each to its union. */
const cases: Case[] = [
  {
    meta: badgeMeta,
    render: (_prop, value) => createElement(Badge, { tone: one(badgeMeta.variants.tone, value) }, 'Draft'),
  },
  {
    meta: buttonMeta,
    render: (prop, value) =>
      createElement(
        Button,
        {
          ...(prop === 'variant' ? { variant: one(buttonMeta.variants.variant, value) } : {}),
          ...(prop === 'size' ? { size: one(buttonMeta.variants.size, value) } : {}),
          disabled: prop === 'disabled' && value === 'true',
        },
        'Approve',
      ),
  },
  {
    meta: cardMeta,
    render: (prop, value) =>
      createElement(
        Card,
        {
          ...(prop === 'surface' ? { surface: one(cardMeta.variants.surface, value) } : {}),
          ...(prop === 'padding' ? { padding: one(cardMeta.variants.padding, value) } : {}),
        },
        'Body',
      ),
  },
  {
    meta: emptyStateMeta,
    render: (_prop, value) => createElement(EmptyState, { title: 'Nothing yet', size: one(emptyStateMeta.variants.size, value) }, 'Why'),
  },
  {
    meta: listRowMeta,
    render: (prop, value) =>
      createElement(ListRow, {
        title: 'Row',
        detail: 'detail',
        trailing: 'end',
        ...(prop === 'link' && value === 'true' ? { href: '#row' } : {}),
        ...(prop === 'density' ? { density: one(listRowMeta.variants.density, value) } : {}),
      }),
  },
  {
    meta: noticeMeta,
    render: (_prop, value) => createElement(Notice, { title: 'Heads up', tone: one(noticeMeta.variants.tone, value) }, 'Body'),
  },
  {
    meta: pageHeaderMeta,
    render: (_prop, value) =>
      createElement(PageHeader, {
        title: 'Checkout rewrite',
        eyebrow: 'PRD 12',
        lede: 'One line',
        status: createElement(Badge, null, 'Building'),
        action: createElement(Button, { variant: 'primary' }, 'Approve'),
        level: one(pageHeaderMeta.variants.level, value),
      }),
  },
  {
    meta: stackMeta,
    render: (prop, value) =>
      createElement(
        Stack,
        {
          ...(prop === 'direction' ? { direction: one(stackMeta.variants.direction, value) } : {}),
          ...(prop === 'gap' ? { gap: one(stackMeta.variants.gap, value) } : {}),
          ...(prop === 'align' ? { align: one(stackMeta.variants.align, value) } : {}),
          wrap: prop === 'wrap' && value === 'true',
        },
        'a',
        'b',
      ),
  },
  {
    meta: tabsMeta,
    render: (_prop, value) => createElement(Tabs, { label: 'Sections', items: tabItems, current: 'plan', size: one(tabsMeta.variants.size, value) }),
  },
  {
    meta: textMeta,
    render: (prop, value) =>
      createElement(
        Text,
        {
          ...(prop === 'size' ? { size: one(textMeta.variants.size, value) } : {}),
          ...(prop === 'tone' ? { tone: one(textMeta.variants.tone, value) } : {}),
          ...(prop === 'as' ? { as: one(textMeta.variants.as, value) } : {}),
          strong: prop === 'strong' && value === 'true',
        },
        'Words',
      ),
  },
];

describe('@omni/ui renders every variant', () => {
  for (const { meta, render } of cases) {
    for (const [prop, values] of Object.entries(meta.variants)) {
      for (const value of values) {
        it(`${meta.name} ${prop}=${value}`, () => {
          const html = renderToStaticMarkup(render(prop, value));
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

  it('says alerts for warning and danger notices, status for the rest', () => {
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'danger' }, 'x'))).toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(Notice, { tone: 'info' }, 'x'))).toContain('role="status"');
  });
});

describe('@omni/ui closes its APIs', () => {
  it('accepts no className and no style on any component', () => {
    expectTypeOf<ComponentProps<typeof Badge>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Button>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Card>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof EmptyState>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof ListRow>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Notice>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof PageHeader>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Stack>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Tabs>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Text>>().not.toHaveProperty('className');
    expectTypeOf<ComponentProps<typeof Badge>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof Button>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof Card>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof EmptyState>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof ListRow>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof Notice>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof PageHeader>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof Stack>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof Tabs>>().not.toHaveProperty('style');
    expectTypeOf<ComponentProps<typeof Text>>().not.toHaveProperty('style');
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
    expect(sheets).toHaveLength(10);
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

describe('@omni/ui describes each component', () => {
  for (const { meta } of cases) {
    it(`${meta.name} names its variants, its accessibility notes, what it replaces and one example`, () => {
      expect(Object.keys(meta.variants).length).toBeGreaterThan(0);
      expect(meta.accessibility.length).toBeGreaterThan(0);
      expect(meta.replaces.length).toBeGreaterThan(0);
      expect(meta.example).toContain(`<${meta.name}`);
    });
  }
});
