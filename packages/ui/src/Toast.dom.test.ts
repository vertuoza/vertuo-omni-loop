// @vitest-environment happy-dom
// The feedback parts in a DOM: a Toast is announced through a polite live region and dismisses on
// Escape and by its button (Base UI's queue); a Skeleton is a status named by its label and stills its
// shimmer under prefers-reduced-motion; an ErrorState says what failed and holds one action.
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './Button.tsx';
import { ErrorState } from './ErrorState.tsx';
import { Skeleton } from './Skeleton.tsx';
import { Toast, useToast } from './Toast.tsx';

afterEach(cleanup);

function Raise({ timeout }: { timeout?: number }) {
  const toast = useToast();
  return createElement('button', {
    type: 'button',
    onClick: () => { toast.show({ title: 'Answer saved', description: 'The plan reads it next.', tone: 'success', timeout }); },
  }, 'Save');
}

function page(timeout?: number) {
  return render(createElement(Toast, { timeout }, createElement(Raise, { timeout })));
}

describe('Toast', () => {
  it('AC-1: announces a toast through a polite live region named Notifications', async () => {
    const user = userEvent.setup();
    page();
    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region.getAttribute('aria-live')).toBe('polite');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const toast = await screen.findByRole('dialog', { name: 'Answer saved' });
    expect(region.contains(toast)).toBe(true);
    expect(toast.className).toContain('omni-toast--success');
  });

  it('AC-1: dismisses a focused toast on Escape', async () => {
    const user = userEvent.setup();
    page(0);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const toast = await screen.findByRole('dialog', { name: 'Answer saved' });
    toast.focus();
    await user.keyboard('{Escape}');
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Answer saved' })).toBeNull(); });
  });

  it('dismisses a toast with its close button, named in words', async () => {
    const user = userEvent.setup();
    page(0);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const toast = await screen.findByRole('dialog', { name: 'Answer saved' });
    toast.focus();
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Answer saved' })).toBeNull(); });
  });

  it('goes by itself once its timeout is over', async () => {
    const user = userEvent.setup();
    page(50);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('dialog', { name: 'Answer saved' });
    await waitFor(() => { expect(screen.queryByRole('dialog', { name: 'Answer saved' })).toBeNull(); }, { timeout: 3000 });
  });
});

describe('Skeleton', () => {
  it('is a status named by its label, with its shapes hidden from a screen reader', () => {
    const { container } = render(createElement(Skeleton, { label: 'Loading the plan', lines: 3 }));
    expect(screen.getByRole('status').textContent).toBe('Loading the plan');
    const shapes = container.querySelectorAll('.omni-skeleton__shape');
    expect(shapes).toHaveLength(3);
    for (const shape of shapes) expect(shape.getAttribute('aria-hidden')).toBe('true');
  });

  it('AC-2: stills its shimmer under prefers-reduced-motion', () => {
    const css = readFileSync('packages/ui/src/Skeleton.css', 'utf8');
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(reduced).toContain('animation: none');
  });
});

describe('ErrorState', () => {
  it('AC-3: says what failed in an alert and offers its one action', () => {
    render(createElement(ErrorState, { title: 'The plan did not load', action: createElement(Button, null, 'Try again') }, 'The server did not answer.'));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('The plan did not load');
    expect(alert.querySelectorAll('button')).toHaveLength(1);
  });
});
