// @vitest-environment happy-dom
// The Memory drawer in a browser (PRD omni-loop-34 s6, 2.C): opened from `Memory · <n>`, its notes read; one note
// deleted, a scope cleared and all memory cleared, each only after its in-place confirmation; a cancel sends nothing;
// a refusal said in place. The routes are fakes: no database.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import type { Note } from '../api/supervisor.contract';
import { MemoryDrawer, type MemoryCalls } from './MemoryDrawer';

afterEach(() => { cleanup(); refresh.mockReset(); });

const note = (id: string, scope: Note['scope'], line: string): Note => ({
  id, scope, line, cites: ['8f21aa00-0000-4000-8000-000000000001'], createdAt: '2026-11-25T14:10:00.000Z', expiresAt: null,
});
const NOTES = [
  note('s1', 'short', 'Job 8f21 silent since 13:18.'), note('s2', 'short', 'box-3 kit drift: wait for nightly.'),
  note('l1', 'long', 'Step build usually takes 2.5 min.'),
];

function drawer(change: Partial<MemoryCalls> = {}) {
  const calls: MemoryCalls = {
    read: vi.fn<MemoryCalls['read']>(() => Promise.resolve({ ok: true, value: NOTES })),
    forgetNote: vi.fn<MemoryCalls['forgetNote']>(() => Promise.resolve({ ok: true, value: 1 })),
    clear: vi.fn<MemoryCalls['clear']>(() => Promise.resolve({ ok: true, value: 3 })),
    ...change,
  };
  render(createElement(MemoryDrawer, { workspace: 'ws-1', count: 3, calls }));
  return calls;
}

async function press(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); await new Promise((resolve) => setTimeout(resolve, 0)); });
}

async function opened(change: Partial<MemoryCalls> = {}) {
  const calls = drawer(change);
  await press('Memory · 3');
  await screen.findByText('Job 8f21 silent since 13:18.');
  return calls;
}

describe('the Memory drawer', () => {
  it('opens from Memory · <n> and reads the notes, Short-term first, each with its source', async () => {
    const calls = await opened();
    expect(calls.read).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText('Workspace owners only')).toBeTruthy();
    expect(screen.getByText('Expires after 24 h')).toBeTruthy();
    expect(screen.getAllByText('cites 8f21 · 14:10')).toHaveLength(2);
    expect(screen.queryByText('Step build usually takes 2.5 min.')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('radio', { name: /^Long-term/ })); await Promise.resolve(); });
    expect(screen.getByText('Step build usually takes 2.5 min.')).toBeTruthy();
    expect(screen.getByText('Kept until cleared')).toBeTruthy();
  });

  it('deletes one note only after its in-place confirmation, then reads the page again', async () => {
    const calls = await opened();
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0] as HTMLElement); await Promise.resolve(); });
    expect(calls.forgetNote).not.toHaveBeenCalled();
    const asked = screen.getByRole('group', { name: 'Delete this note?' });
    expect(within(asked).getByText('Findings and chat stay.')).toBeTruthy();
    await press('Delete the note');
    expect(calls.forgetNote).toHaveBeenCalledWith('ws-1', 's1');
    expect(screen.queryByText('Job 8f21 silent since 13:18.')).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('clears a scope after asking how many notes go', async () => {
    const calls = await opened();
    await press('Clear short-term');
    expect(screen.getByRole('group', { name: 'Clear 2 short-term notes?' })).toBeTruthy();
    await press('Clear 2 notes');
    expect(calls.clear).toHaveBeenCalledWith('ws-1', 'short');
    expect(screen.getByText('No short-term note.')).toBeTruthy();
  });

  it('clears all memory after `Clear all 3 notes? Findings and chat stay.`, and a cancel sends nothing', async () => {
    const calls = await opened();
    await press('Clear all memory');
    await press('Cancel');
    expect(calls.clear).not.toHaveBeenCalled();
    await press('Clear all memory');
    const asked = screen.getByRole('group', { name: 'Clear all 3 notes?' });
    expect(within(asked).getByText('Findings and chat stay.')).toBeTruthy();
    await press('Clear 3 notes');
    expect(calls.clear).toHaveBeenCalledWith('ws-1', 'all');
    expect(screen.getByText('No short-term note.')).toBeTruthy();
  });

  it('says a refusal in place and keeps the notes', async () => {
    await opened({ clear: vi.fn<MemoryCalls['clear']>(() => Promise.resolve({ ok: false, error: 'Only an owner clears the Supervisor’s memory.' })) });
    await press('Clear all memory');
    await press('Clear 3 notes');
    expect(screen.getByRole('alert').textContent).toBe('Only an owner clears the Supervisor’s memory.');
    expect(screen.getByText('Job 8f21 silent since 13:18.')).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
