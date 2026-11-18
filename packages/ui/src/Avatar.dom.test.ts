// @vitest-environment happy-dom
// The display parts in a DOM: the avatar draws the hero at a whole-number scale and is named by the person.
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar } from './Avatar.tsx';
import { Progress } from './Progress.tsx';

afterEach(cleanup);

const hero = { v: 1, body: 'boy', skin: 3, hair: 1, suit: 0, cape: 0 } as const;

describe('Avatar', () => {
  it('is an image named by the person, drawn at a whole-number scale', () => {
    const { container } = render(createElement(Avatar, { hero, name: 'Grace Hopper', size: 'lg' }));
    expect(screen.getByRole('img', { name: 'Grace Hopper' })).not.toBeNull();
    const svg = container.querySelector('svg');
    const width = Number(svg?.getAttribute('width'));
    expect(width % 32).toBe(0);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});

describe('Progress', () => {
  it('is a progress bar named by its label, clamped to its range', () => {
    render(createElement(Progress, { label: 'Tokens used', value: 250, max: 100 }));
    const bar = screen.getByRole('progressbar', { name: 'Tokens used' });
    expect(bar.getAttribute('value')).toBe('100');
    expect(screen.getByText('100%')).not.toBeNull();
  });
});
