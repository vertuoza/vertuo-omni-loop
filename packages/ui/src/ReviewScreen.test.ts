// ReviewScreen: numbered sections in reading order, a step list whose links reach each section's heading
// and the decision bar, a bar that sticks to the bottom of the window, prose at 900 px, no className or style.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { Button } from './Button.tsx';
import { ReviewScreen } from './ReviewScreen.tsx';
import type { ReviewScreenProps } from './ReviewScreen.tsx';

const props: ReviewScreenProps = {
  title: 'Review and approve',
  sections: [
    { title: 'What changed', children: 'Diff text' },
    { title: 'Business laws', children: 'Laws text' },
    { title: 'What you approve', children: 'Plan text' },
  ],
  question: 'Approve this spec and plan?',
  detail: 'Covers the files you read.',
  secondary: createElement(Button, null, 'Back'),
  decision: createElement(Button, { variant: 'primary' }, 'Approve'),
};
const html = renderToStaticMarkup(createElement(ReviewScreen, props));
const css = readFileSync(new URL('./ReviewScreen.css', import.meta.url), 'utf8');

describe('ReviewScreen', () => {
  it('lists the steps 1 · What changed, 2 · Business laws, 3 · What you approve, then Decide, in a nav', () => {
    const nav = /<nav[^>]*>.*<\/nav>/s.exec(html)?.[0] ?? '';
    const labels = [...nav.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
    expect(labels).toEqual(['1 · What changed', '2 · Business laws', '3 · What you approve', 'Decide']);
  });

  it('links each step to the id of its section heading, and Decide to the decision bar', () => {
    const hrefs = [...html.matchAll(/<a [^>]*href="#([^"]+)"/g)].map((m) => m[1] ?? '');
    expect(hrefs).toHaveLength(4);
    for (const id of hrefs) expect(html).toContain(`id="${id}"`);
    expect(html).toContain(`<h2 class="omni-review__heading" id="${hrefs[0] ?? ''}">`);
    expect(html).toContain(`class="omni-review__bar" id="${hrefs[3] ?? ''}" role="group"`);
  });

  it('draws the sections in order, then the decision bar last with the question, secondary and the one decision', () => {
    const at = (text: string) => html.indexOf(text);
    expect(at('Diff text')).toBeLessThan(at('Laws text'));
    expect(at('Laws text')).toBeLessThan(at('Plan text'));
    expect(at('Plan text')).toBeLessThan(at('Approve this spec and plan?'));
    expect(at('Approve this spec and plan?')).toBeLessThan(at('Back'));
    expect(at('Back')).toBeLessThan(at('>Approve<'));
    expect(html.match(/data-primary=""/g)).toHaveLength(1);
  });

  it('keeps the decision bar at the bottom of the window and prose at 900 px, with no width cap on the screen', () => {
    expect(/\.omni-review__bar\s*\{[^}]*position: sticky;[^}]*bottom: 0/s.exec(css)).not.toBeNull();
    expect(/\.omni-review__prose\s*\{[^}]*max-width: 900px/.exec(css)).not.toBeNull();
    expect(/\.omni-review\s*\{[^}]*width: 100%/.exec(css)).not.toBeNull();
    expect(/\.omni-review\s*\{[^}]*max-width/.exec(css)).toBeNull();
  });

  it('names each section a region by its heading, in a div (the /design page ends its components at the first section element)', () => {
    expect(html).not.toContain('<section');
    expect(html.match(/role="region"/g)).toHaveLength(3);
  });

  it('draws no detail line when none is given', () => {
    expect(renderToStaticMarkup(createElement(ReviewScreen, { ...props, detail: undefined }))).not.toContain('omni-review__detail');
  });

  it('takes no className and no style', () => {
    expectTypeOf<ReviewScreenProps>().not.toHaveProperty('className');
    expectTypeOf<ReviewScreenProps>().not.toHaveProperty('style');
  });
});
