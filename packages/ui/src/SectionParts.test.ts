// The section parts of the page anatomy: SectionHeading, DefinitionList, EmptyState and Notice.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { DefinitionList } from './DefinitionList.tsx';
import type { DefinitionListProps } from './DefinitionList.tsx';
import { EmptyState } from './EmptyState.tsx';
import { Notice } from './Notice.tsx';
import { SectionHeading } from './SectionHeading.tsx';
import type { SectionHeadingProps } from './SectionHeading.tsx';

const css = (name: string) => readFileSync(new URL(`./${name}.css`, import.meta.url), 'utf8');

describe('SectionHeading', () => {
  it('draws an h2 at 20 px and an h3 at 16 px', () => {
    expect(renderToStaticMarkup(createElement(SectionHeading, null, 'Plan'))).toContain('<h2 ');
    expect(renderToStaticMarkup(createElement(SectionHeading, { level: '3' }, 'Plan'))).toContain('<h3 ');
    expect(/--h2 \.omni-section-heading__title\s*\{[^}]*var\(--type-5-size\)/.exec(css('SectionHeading'))).not.toBeNull();
    expect(/--h3 \.omni-section-heading__title\s*\{[^}]*var\(--type-4-size\)/.exec(css('SectionHeading'))).not.toBeNull();
  });

  it('draws the count beside the title and one quiet link at its right', () => {
    const html = renderToStaticMarkup(createElement(SectionHeading, { count: '3/7', link: { label: 'Open', href: '/q' } }, 'Questions'));
    expect(html.indexOf('Questions')).toBeLessThan(html.indexOf('3/7'));
    expect(html.indexOf('3/7')).toBeLessThan(html.indexOf('Open'));
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(renderToStaticMarkup(createElement(SectionHeading, null, 'Plan'))).not.toMatch(/<a |__count/);
  });

  it('takes no className and no style', () => {
    expectTypeOf<'className' extends keyof SectionHeadingProps ? true : false>().toEqualTypeOf<false>();
  });
});

describe('DefinitionList', () => {
  it('draws a dl with each label over its value', () => {
    const html = renderToStaticMarkup(createElement(DefinitionList, { facts: [{ id: 'a', label: 'Owner', value: 'ann' }] }));
    expect(html).toMatch(/^<dl /);
    expect(html.indexOf('<dt')).toBeLessThan(html.indexOf('<dd'));
  });

  it('leaves out a fact whose value is empty, never a dash', () => {
    const html = renderToStaticMarkup(createElement(DefinitionList, {
      facts: [
        { id: 'a', label: 'Owner', value: 'ann' },
        { id: 'b', label: 'Roadmap', value: '' },
        { id: 'c', label: 'Blank', value: '   ' },
        { id: 'd', label: 'Null', value: null },
        { id: 'e', label: 'Unset' },
      ],
    }));
    expect(html.match(/<dt/g)).toHaveLength(1);
    expect(html).not.toMatch(/Roadmap|Blank|Null|Unset|—|–/);
  });

  it('draws the label at 12 px tertiary and the value at 14 px', () => {
    const sheet = css('DefinitionList');
    expect(/__label\s*\{[^}]*text-tertiary[^}]*type-1-size/.exec(sheet)).not.toBeNull();
    expect(/__value\s*\{[^}]*type-2-size/.exec(sheet)).not.toBeNull();
  });

  it('takes no className and no style', () => {
    expectTypeOf<'style' extends keyof DefinitionListProps ? true : false>().toEqualTypeOf<false>();
  });
});

describe('EmptyState', () => {
  it('says why, when it fills in, and offers one action at most', () => {
    const html = renderToStaticMarkup(createElement(EmptyState, { title: 'No questions yet', action: createElement('button', null, 'Ask') }, 'They appear once the plan is read.'));
    expect(html.indexOf('No questions yet')).toBeLessThan(html.indexOf('They appear'));
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it('draws inline and page sizes', () => {
    expect(renderToStaticMarkup(createElement(EmptyState, { title: 'x', size: 'inline' }))).toContain('omni-empty-state--inline');
    expect(renderToStaticMarkup(createElement(EmptyState, { title: 'x' }))).toContain('omni-empty-state--page');
  });
});

describe('Notice', () => {
  it('draws a tone icon of the 1-bit set, a title and one line', () => {
    for (const tone of ['info', 'success', 'warning', 'danger'] as const) {
      const html = renderToStaticMarkup(createElement(Notice, { tone, title: 'Title' }, 'One line.'));
      expect(html).toContain('<svg');
      expect(html).toContain('currentColor');
      expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('Title'));
      expect(html.indexOf('Title')).toBeLessThan(html.indexOf('One line.'));
    }
  });

  it('has a full thin border and no coloured stripe on one side', () => {
    const sheet = css('Notice');
    expect(sheet).toMatch(/\.omni-notice \{[^}]*border: 1px solid var\(--notice-edge/);
    expect(sheet).not.toMatch(/border-(inline|left|right)-(start|end)?\s*:/);
  });
});
