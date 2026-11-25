// @vitest-environment happy-dom
// SettingsSaveBar in a DOM, in light and dark: one state at a time, said in words, and a retry when it failed.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE_BAR_WORDS, SettingsSaveBar } from './SettingsSaveBar.tsx';
import type { SettingsSaveBarState } from './SettingsSaveBar.tsx';

afterEach(cleanup);

const STATES: SettingsSaveBarState[] = ['idle', 'saving', 'saved', 'failed'];

describe.each(['light', 'dark'])('SettingsSaveBar in %s', (theme) => {
  const show = (state: SettingsSaveBarState, props: Record<string, unknown> = {}) =>
    render(createElement('div', { 'data-theme': theme }, createElement(SettingsSaveBar, { state, ...props })));

  it.each(STATES)('AC-3: %s shows its own words and no other state', (state) => {
    show(state);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(SAVE_BAR_WORDS[state]);
    for (const other of STATES.filter((s) => s !== state)) expect(screen.queryByText(SAVE_BAR_WORDS[other])).toBeNull();
  });

  it('AC-3: failed offers a retry that calls its handler', () => {
    const onRetry = vi.fn();
    show('failed', { onRetry });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['idle', 'saving', 'saved'] as const)('AC-3: %s offers no retry', (state) => {
    show(state);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('AC-3: saving disables the save button, the others call onSave', () => {
    const onSave = vi.fn();
    show('saving', { onSave });
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
    cleanup();
    show('idle', { onSave });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
