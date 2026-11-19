// @vitest-environment happy-dom
// The action parts in a DOM: the icon is decoration unless labelled, an icon button is named by its
// label, a link opens outside safely, and the segmented control moves with the arrow keys.
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Icon } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
import { Link } from './Link.tsx';
import { SegmentedControl } from './SegmentedControl.tsx';

afterEach(cleanup);

const options = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
];

function Harness() {
  const [value, setValue] = useState('all');
  return createElement(SegmentedControl, { label: 'Show', options, value, onChange: setValue });
}

describe('Icon', () => {
  it('draws the 1-bit set in currentColor, hidden from a screen reader unless it has a label', () => {
    const { container } = render(createElement(Icon, { name: 'home' }));
    expect(container.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    cleanup();
    render(createElement(Icon, { name: 'home', label: 'Home' }));
    expect(screen.getByRole('img', { name: 'Home' })).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('is named by its label and clicks', async () => {
    const user = userEvent.setup();
    let clicked = 0;
    render(createElement(IconButton, { icon: 'close', label: 'Close', onClick: () => { clicked += 1; } }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(clicked).toBe(1);
  });

  it('requires an accessible label', () => {
    // @ts-expect-error a label is required
    createElement(IconButton, { icon: 'close' });
    expect(true).toBe(true);
  });
});

describe('Link', () => {
  it('opens an external link without handing it the page', () => {
    render(createElement(Link, { href: 'https://example.com', external: true }, 'GitHub'));
    const link = screen.getByRole('link', { name: 'GitHub' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('SegmentedControl', () => {
  it('moves the choice and the focus with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(createElement(Harness));
    await user.tab();
    const all = screen.getByRole('radio', { name: 'All' });
    expect(document.activeElement).toBe(all);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Open' }).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Open' }));
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Closed' }).getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{Home}');
    expect(all.getAttribute('aria-checked')).toBe('true');
    await user.keyboard('{End}');
    expect(screen.getByRole('radio', { name: 'Closed' }).getAttribute('aria-checked')).toBe('true');
  });

  it('keeps one tab stop, on the chosen segment', () => {
    render(createElement(Harness));
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });
});
