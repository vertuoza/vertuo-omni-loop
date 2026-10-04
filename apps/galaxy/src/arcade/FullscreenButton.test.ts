import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Form } from './form';
import type { FullscreenPress } from './fullscreen';
import { FullscreenButton, type FullscreenButtonProps } from './FullscreenButton';
import { sure } from './test/sure';

// The ⛶ button (PRD 451): on desktop, the one visible way into fullscreen besides F. Rendered as the
// server would; the click and the mouse press are read off the element it returns, since nothing here
// runs a browser. Its look (dim, bottom-right, outside the screen) is checked by eye.

const base: FullscreenButtonProps = { form: 'full', allowed: true, on: false, fullscreen: () => true };
const html = (props: Partial<FullscreenButtonProps> = {}) =>
  renderToStaticMarkup(createElement(FullscreenButton, { ...base, ...props }));
const BUTTON = /<button[^>]*aria-label="Full screen \(F\)"[^>]*>[\s\S]*?<\/button>/g;
const buttons = (markup: string) => markup.match(BUTTON) ?? [];

describe('the full-screen button', () => {
  it('shows on desktop while fullscreen is allowed and off: one button named and titled "Full screen (F)", reading ⛶', () => {
    const found = buttons(html());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^<button type="button" class="fs-button"/);
    expect(found[0]).toContain('title="Full screen (F)"');
    expect(sure(found[0], 'found[0]').replace(/<[^>]+>/g, '').trim()).toBe('⛶');
  });

  it('hides while the page is fullscreen', () => {
    expect(html({ on: true })).toBe('');
  });

  for (const form of ['handheld', 'advance'] as Form[]) {
    it(`is not drawn on the ${form} body, fullscreen allowed or not`, () => {
      expect(html({ form })).toBe('');
      expect(html({ form, allowed: false })).toBe('');
    });
  }

  it('is not drawn where the browser cannot go fullscreen', () => {
    expect(html({ allowed: false })).toBe('');
  });

  it('sends exactly one toggle press when clicked', () => {
    const sent: FullscreenPress[] = [];
    const el = FullscreenButton({ ...base, fullscreen: (p) => { sent.push(p); return true; } }) as ReactElement<{ onClick: () => void }>;
    el.props.onClick();
    expect(sent).toEqual([{ kind: 'toggle' }]);
  });

  it('takes no focus on a mouse press, so Enter and Space keep meaning START and A', () => {
    let prevented = 0;
    const el = FullscreenButton(base) as ReactElement<{ onMouseDown: (e: { preventDefault: () => void }) => void }>;
    el.props.onMouseDown({ preventDefault: () => { prevented += 1; } });
    expect(prevented).toBe(1);
  });
});
