import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MASCOTS } from '../fleets';
import { ScreenContext } from '../Screen';
import { TALL, WIDE } from './common.ts';
import { RaiseOverlay } from './raise.tsx';

const render = (owner: boolean, grid = WIDE) => renderToStaticMarkup(createElement(
  ScreenContext.Provider, { value: { form: grid === TALL ? 'handheld' : 'full', grid, page: 0, pages: 1 } }, createElement(RaiseOverlay, { owner }),
));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('NO FLEETS YET — RAISE YOUR OWN! (PRD 400)', () => {
  it('invites, over a parade of every mascot', () => {
    const html = render(true);
    expect(text(html)).toContain('NO FLEETS YET — RAISE YOUR OWN!');
    expect(MASCOTS.length).toBeGreaterThan(1);
    expect(html.match(/<canvas/g)).toHaveLength(MASCOTS.length);
  });

  it('points the owner at /app/settings/fleets, and tells a member to ask the owner', () => {
    const owner = render(true);
    expect(text(owner)).toContain('SET THEM UP AT /app/settings/fleets');
    expect(owner).toContain('href="/app/settings/fleets"');
    expect(text(owner)).not.toContain('ASK YOUR OWNER');
    const member = text(render(false, TALL));
    expect(member).toContain('ASK YOUR OWNER');
    expect(member).not.toContain('/app/settings/fleets');
  });
});
