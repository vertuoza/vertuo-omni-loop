// @vitest-environment happy-dom
// SegmentedControl as a set of links: sub-views, filters and versions as one control, the current one
// marked aria-current, the arrow keys moving the focus along it.
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SegmentedControl } from './SegmentedControl.tsx';

afterEach(cleanup);

const views = [
  { id: 'before-after', label: 'Before/after', href: '?view=before-after' },
  { id: 'spec', label: 'Spec', href: '?view=spec' },
  { id: 'plan', label: 'Plan', href: '?view=plan' },
];

describe('SegmentedControl as links', () => {
  it('draws one control of links, the current one marked aria-current', () => {
    render(createElement(SegmentedControl, { label: 'Specifications', options: views, value: 'spec' }));
    const group = screen.getByRole('group', { name: 'Specifications' });
    expect(group.className).toContain('omni-segmented');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['?view=before-after', '?view=spec', '?view=plan']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    expect(links[1]?.className).toContain('omni-segment--chosen');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('keeps one tab stop, on the current link, and moves the focus with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(createElement(SegmentedControl, { label: 'Specifications', options: views, value: 'spec' }));
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    await user.tab();
    expect(document.activeElement).toBe(links[1]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(links[2]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(links[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(links[2]);
    await user.keyboard('{Home}{ArrowLeft}');
    expect(document.activeElement).toBe(links[2]);
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
  });

  it('draws each link with the link it is given', () => {
    const link = ({ children, ...rest }: { className: string; href: string; children?: ReactNode }) => createElement('a', { ...rest, 'data-router': '' }, children);
    render(createElement(SegmentedControl, { label: 'Versions', options: views, value: 'plan', link }));
    expect(screen.getAllByRole('link').every((a) => a.hasAttribute('data-router'))).toBe(true);
  });
});
