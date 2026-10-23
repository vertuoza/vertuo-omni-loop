import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AntiPage } from './AntiPage';

// The two placeholder pages (PRD 2490): a title and two short lines, and nothing else.

const text = (html: string) => html.replace(/<[^>]+>/g, '|').split('|').filter(Boolean).map((t) => t.replace(/&#x27;/g, '\''));

describe('the anti-loop pages', () => {
  it('Anti-dashboard shows its title and its two lines', () => {
    expect(text(renderToStaticMarkup(createElement(AntiPage, { page: 'dashboard' })))).toEqual(['Anti-dashboard', 'Harness, architecture and retros, at a glance.', 'Not open yet.']);
  });

  it('Anti-work shows its title and its two lines', () => {
    expect(text(renderToStaticMarkup(createElement(AntiPage, { page: 'work' })))).toEqual(['Anti-work', 'The tech team\'s harness, architecture and retros.', 'Not open yet.']);
  });

  it('keeps every line under eight words', () => {
    for (const page of ['dashboard', 'work'] as const) {
      for (const line of text(renderToStaticMarkup(createElement(AntiPage, { page }))).slice(1)) expect(line.split(' ').length, line).toBeLessThan(8);
    }
  });
});
