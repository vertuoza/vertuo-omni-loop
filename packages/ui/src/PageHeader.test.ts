// PageHeader's anatomy: one 32 px title, the subtitle, at most five unlabelled facts, the Actions menu,
// the secondary and the one primary action (absent when none is given), and no className or style prop.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { Button } from './Button.tsx';
import { PageHeader } from './PageHeader.tsx';
import type { PageHeaderMeta, PageHeaderProps } from './PageHeader.tsx';

const facts = ['one', 'two', 'three', 'four', 'five'] as const;

describe('PageHeader', () => {
  it('draws the title at type-7, 32 px', () => {
    const css = readFileSync(new URL('./PageHeader.css', import.meta.url), 'utf8');
    expect(/\.omni-page-header__title\s*\{[^}]*font-size: var\(--type-7-size\)/.exec(css)).not.toBeNull();
  });

  it('draws the eyebrow, the title and the subtitle in that order', () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: 'The title', eyebrow: 'PRD 12', lede: 'One sentence.' }));
    expect(html.indexOf('PRD 12')).toBeLessThan(html.indexOf('The title'));
    expect(html.indexOf('The title')).toBeLessThan(html.indexOf('One sentence.'));
  });

  it('draws up to five facts with no label', () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: 'T', meta: facts }));
    expect(html.match(/<li /g)).toHaveLength(5);
  });

  it('refuses a sixth fact in its props type and drops it when it comes anyway', () => {
    // @ts-expect-error a sixth fact does not fit PageHeaderMeta
    const six: PageHeaderMeta = [...facts, 'six'];
    const html = renderToStaticMarkup(createElement(PageHeader, { title: 'T', meta: six }));
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html).not.toContain('six');
  });

  it('draws no meta row without facts', () => {
    expect(renderToStaticMarkup(createElement(PageHeader, { title: 'T' }))).not.toContain('omni-page-header__meta');
  });

  it('draws the primary last, after the secondary action and the Actions menu', () => {
    const html = renderToStaticMarkup(createElement(PageHeader, {
      title: 'T',
      actions: [{ id: 'delete', label: 'Delete draft', tone: 'danger' }],
      secondary: createElement(Button, null, 'Copy link'),
      action: createElement(Button, { variant: 'primary' }, 'Review and approve'),
    }));
    expect(html.indexOf('Actions')).toBeLessThan(html.indexOf('Copy link'));
    expect(html.indexOf('Copy link')).toBeLessThan(html.indexOf('Review and approve'));
    expect(html.match(/data-primary=""/g)).toHaveLength(1);
  });

  it('has no primary and no action area when none is given', () => {
    const html = renderToStaticMarkup(createElement(PageHeader, { title: 'T', lede: 'x' }));
    expect(html).not.toContain('data-primary');
    expect(html).not.toContain('omni-page-header__action');
  });

  it('draws no Actions menu for an empty list', () => {
    expect(renderToStaticMarkup(createElement(PageHeader, { title: 'T', actions: [] }))).not.toContain('Actions');
  });

  it('takes no className and no style', () => {
    expectTypeOf<PageHeaderProps>().not.toHaveProperty('className');
    expectTypeOf<PageHeaderProps>().not.toHaveProperty('style');
  });
});
